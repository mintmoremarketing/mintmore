const { query, getClient }   = require('../../config/database');
const { getRedis }           = require('../../config/redis');
const { enqueueGeneration }  = require('./queue/ai.queue');
const {
  incrementActive, decrementActive, getBestFreeModel,
} = require('./models/model.traffic');
const {
  getAllModels, getModelByOpenRouterId,
  getFreeModels, bustModelCache,
} = require('./models/model.registry');
const {
  generateText,
  generateImage,
  generateVideo,
} = require('./providers/openrouter.provider');
const { uploadFile }         = require('../../config/supabase');
const AppError  = require('../../utils/AppError');
const logger    = require('../../utils/logger');
const env       = require('../../config/env');
const {
  recordCreditTransaction,
  getCreditAccount,
  expireCreditsForUser,
} = require('../commerce/credits.service');
const { getSetting } = require('../commerce/settings.service');
const { getWalletByUserId, recordTransaction } = require('../wallet/wallet.service');

const RATE_LIMIT_KEY      = (userId) => `ai:ratelimit:${userId}`;
const AI_PROGRESS_CHANNEL = 'mint_more:ai_progress';
const userPrice = (model) => Number(model?.user_price_per_1k_tokens ?? model?.cost_per_1k_tokens ?? 0);

// ── Tool Prompts ──────────────────────────────────────────────────────────────

const buildPrompt = (toolType, userPrompt, params = {}, modelSystemPrompts = {}) => {
  // Use model-specific system prompt override if admin configured one
  const customSystemPrompt = modelSystemPrompts[toolType] || null;

  const builtPrompts = {
    text: {
      system: customSystemPrompt ||
        'You are a professional content writer for Indian businesses. Write clear, engaging, SEO-friendly content.',
      user: `Write content based on this request:\n${userPrompt}\n\nTone: ${params.tone || 'professional'}\nLength: ${params.length || '300-500 words'}\n${params.keywords ? `Keywords to include: ${params.keywords}` : ''}\n\nWrite directly without preamble.`,
    },
    caption: {
      system: customSystemPrompt ||
        'You are a social media expert for Indian brands. Write captions that drive engagement.',
      user: `Create social media caption for:\n${userPrompt}\n\nPlatform: ${params.platform || 'Instagram'}\nTone: ${params.tone || 'engaging'}\nHashtags: ${params.hashtag_count || 10}\n\nFormat:\n[Caption text]\n\n[Hashtags]`,
    },
    video_script: {
      system: customSystemPrompt ||
        'You are a video scriptwriter for Indian brands. Write punchy, engaging scripts for short-form video.',
      user: `Write a ${params.duration || '30-60 second'} video script for:\n${userPrompt}\n\nPlatform: ${params.platform || 'Instagram Reels / YouTube Shorts'}\n\nFormat:\n[HOOK - first 3 seconds]\n[MAIN CONTENT]\n[CTA]`,
    },
    repurpose: {
      system: customSystemPrompt ||
        'You are a content repurposing expert. Transform content into multiple platform-specific formats.',
      user: `Repurpose this content into all formats:\n\n${userPrompt}\n\n1. Instagram Caption (150 words max + 10 hashtags)\n2. Twitter/X Post (280 chars max)\n3. LinkedIn Post (professional, 150-200 words)\n4. WhatsApp Status (casual, 100 chars max)\n5. YouTube Description (100-150 words)\n\nLabel each format clearly.`,
    },
    image: {
      system: customSystemPrompt || '',
      user:   userPrompt, // image prompts go direct
    },
    video: {
     system: customSystemPrompt ||
      'You are helping generate a video. Output only a clean, descriptive prompt optimised for video generation AI models.',
     user: userPrompt, // video prompts go direct to the model
    },
  };

  return builtPrompts[toolType] || { system: '', user: userPrompt };
};

// ── Rate Limit ────────────────────────────────────────────────────────────────

const checkRateLimit = async (userId) => {
  const redis = getRedis();
  const key   = RATE_LIMIT_KEY(userId);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600);

  const limit = env.ai.maxRequestsPerHour;
  if (count > limit) {
    const ttl        = await redis.ttl(key);
    const minutesLeft = Math.ceil(ttl / 60);
    throw new AppError(
      `AI rate limit reached (${limit}/hour). Resets in ${minutesLeft} min.`,
      429
    );
  }
  return { count, limit, remaining: limit - count };
};

const assertIncludedQuota = async (userId, toolType, model) => {
  if (userPrice(model) > 0) return;
  const membershipResult = await query(
    'SELECT status, current_period_start FROM memberships WHERE user_id = $1',
    [userId]
  );
  const membership = membershipResult.rows[0];
  if (!membership) throw new AppError('AI access requires a membership or trial', 403);

  const isTrial = membership.status === 'trial';
  const quota = await getSetting(isTrial ? 'membership.trial' : 'ai.quotas', {});
  const group = toolType === 'image' ? 'image' : toolType === 'video' ? 'video' : 'text';
  const limit = Number(quota[`${group}_generations`] || 0);
  if (!limit) throw new AppError(`No included ${group} generations are configured`, 403);

  const tools = group === 'text' ? ['text', 'caption', 'video_script', 'repurpose'] : [group];
  const usage = await query(
    `SELECT COUNT(*)::int AS count
     FROM ai_generations
     WHERE user_id = $1
       AND tool_type = ANY($2::text[])
       AND created_at >= COALESCE($3::timestamptz, date_trunc('month', NOW()))
       AND status <> 'failed'`,
    [userId, tools, isTrial ? membership.current_period_start : null]
  );
  if (usage.rows[0].count >= limit) {
    throw new AppError(`Included ${group} generation quota reached. Choose a premium model or wait for renewal.`, 402);
  }
};

// ── Credit Deduction ──────────────────────────────────────────────────────────

const deductCredits = async (userId, generationId, creditCost) => {
  if (creditCost <= 0) return;

  await expireCreditsForUser(userId);
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const existingCreditTx = await dbClient.query(
      'SELECT amount FROM mint_credit_transactions WHERE idempotency_key = $1',
      [`ai-credit:${generationId}`]
    );
    const creditAccount = await getCreditAccount(userId, dbClient, true);
    const creditSpend = existingCreditTx.rows[0]
      ? Math.abs(Number(existingCreditTx.rows[0].amount))
      : Math.min(Number(creditAccount.balance), Number(creditCost));
    if (creditSpend > 0) {
      await recordCreditTransaction(dbClient, {
        userId,
        type: 'platform_spend',
        amount: -creditSpend,
        referenceId: generationId,
        referenceType: 'ai_generation',
        idempotencyKey: `ai-credit:${generationId}`,
        description: 'Mint AI generation',
      });
    }
    const cashSpend = Number(creditCost) - creditSpend;
    if (cashSpend <= 0) {
      await dbClient.query('COMMIT');
      return;
    }

    const wallet = await getWalletByUserId(userId, dbClient, true);
    if (!wallet || parseFloat(wallet.balance) < cashSpend) {
      throw new AppError('Insufficient balance for this AI generation', 402);
      logger.warn('Credit deduction skipped — insufficient balance', { userId, creditCost });
    }

    await recordTransaction(dbClient, {
      walletId: wallet.id,
      userId,
      type: 'adjustment',
      amount: -cashSpend,
      referenceId: generationId,
      referenceType: 'ai_generation',
      idempotencyKey: `ai-cash:${generationId}`,
      description: 'Mint AI generation',
      metadata: { generation_id: generationId },
    });

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    logger.error('Credit deduction failed', { error: err.message });
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Publish SSE Progress ──────────────────────────────────────────────────────

const publishProgress = async (generationId, userId, status, data = {}) => {
  try {
    const redis = getRedis();
    await redis.publish(
      AI_PROGRESS_CHANNEL,
      JSON.stringify({ generationId, userId, status, ...data })
    );
  } catch (err) {
    logger.warn('AI progress publish failed', { error: err.message });
  }
};

// ── Create Generation ─────────────────────────────────────────────────────────

const createGeneration = async (userId, {
  tool_type, model_id, prompt, parameters = {},
  source_post_id, source_job_id,
}) => {
  // model_id here is the UUID from ai_models table
  const modelResult = await query(
    'SELECT * FROM ai_models WHERE id = $1 AND is_active = true',
    [model_id]
  );
  const model = modelResult.rows[0];
  if (!model) throw new AppError('Model not found or inactive', 404);

  if (!model.supported_tools?.includes(tool_type)) {
    throw new AppError(`Model "${model.name}" does not support ${tool_type}`, 400);
  }

  await assertIncludedQuota(userId, tool_type, model);
  await checkRateLimit(userId);

  // Credit preflight check
  if (userPrice(model) > 0) {
    await expireCreditsForUser(userId);
    const walletResult = await query(
      `SELECT w.balance AS cash_balance, COALESCE(c.balance, 0) AS credit_balance
       FROM wallets w
       LEFT JOIN mint_credit_accounts c ON c.user_id = w.user_id
       WHERE w.user_id = $1`,
      [userId]
    );
    const minRequired = userPrice(model);
    const available = Number(walletResult.rows[0]?.cash_balance || 0) + Number(walletResult.rows[0]?.credit_balance || 0);
    if (available < minRequired) {
      throw new AppError(
        `Insufficient wallet balance. This model costs ₹${(minRequired / 100).toFixed(2)} per 1K tokens. Add credits to continue.`,
        402
      );
    }
  }

  const promptData  = buildPrompt(tool_type, prompt, parameters, model.system_prompts || {});

  const result = await query(
    `INSERT INTO ai_generations
       (user_id, ai_model_id, tool_type, openrouter_id, model_name,
        prompt, parameters, status, source_post_id, source_job_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9)
     RETURNING *`,
    [
      userId, model.id, tool_type,
      model.openrouter_id, model.name,
      promptData.user,
      JSON.stringify({ ...parameters, _system: promptData.system }),
      source_post_id || null,
      source_job_id  || null,
    ]
  );

  const generation  = result.rows[0];
  const queueJobId  = await enqueueGeneration(generation.id);

  await query(
    'UPDATE ai_generations SET queue_job_id = $1 WHERE id = $2',
    [queueJobId.toString(), generation.id]
  );

  await incrementActive(model.openrouter_id);

  // Increment model request counter
  await query(
    'UPDATE ai_models SET total_requests = total_requests + 1 WHERE id = $1',
    [model.id]
  );

  return {
    generation_id: generation.id,
    status:        'queued',
    model: {
      id:         model.id,
      name:       model.name,
      tier:       model.tier,
      is_free:    model.tier === 'free',
    },
  };
};

// ── Process Generation (BullMQ worker) ───────────────────────────────────────

const processGeneration = async (generationId) => {
  const genResult = await query(
    'SELECT * FROM ai_generations WHERE id = $1',
    [generationId]
  );
  const generation = genResult.rows[0];
  if (!generation) throw new Error(`Generation ${generationId} not found`);

  await query(
    `UPDATE ai_generations SET status = 'processing', started_at = NOW() WHERE id = $1`,
    [generationId]
  );
  await publishProgress(generationId, generation.user_id, 'processing');

  const modelResult = await query(
    'SELECT * FROM ai_models WHERE id = $1',
    [generation.ai_model_id]
  );
  const model = modelResult.rows[0];

  let openrouterId = generation.openrouter_id;
  let usedFailover = false;
  let failoverModel = null;

  const params = generation.parameters || {};
  const systemPrompt = params._system || null;

  try {
    let result;
    const isImage = generation.tool_type === 'image';
    const isVideo = generation.tool_type === 'video';

    if (isImage) {
      // ── Image generation ────────────────────────────────────────────────────
      try {
        result = await generateImage(openrouterId, generation.prompt, params);
      } catch (err) {
        // Failover to free text model for image prompts is not applicable
        // Re-throw so admin knows
        throw err;
      }

      // Upload to Supabase Storage
      const imageRes  = await fetch(result.url);
      const buffer    = Buffer.from(await imageRes.arrayBuffer());
      const filePath  = `ai-generated/${generation.user_id}/${generationId}.webp`;
      const storedUrl = await uploadFile('job-attachments', filePath, buffer, 'image/webp');

      const creditCost = userPrice(model);
      if (creditCost > 0) await deductCredits(generation.user_id, generationId, creditCost);

      await query(
        `UPDATE ai_generations
         SET status       = 'completed',
             result_url   = $1,
             credits_used = $2,
             duration_ms  = $3,
             completed_at = NOW()
         WHERE id = $4`,
        [storedUrl, creditCost, result.duration_ms, generationId]
      );
    } else if (isVideo) {
      // ── Video generation ────────────────────────────────────────────────────
      result = await generateVideo(openrouterId, generation.prompt, params);

      // Download video and store in Supabase Storage
      const videoRes  = await fetch(result.url);
      const buffer    = Buffer.from(await videoRes.arrayBuffer());
      const filePath  = `ai-generated/${generation.user_id}/${generationId}.mp4`;
      const storedUrl = await uploadFile('job-attachments', filePath, buffer, 'video/mp4');

      // Cost: per second of output video
      // Admin sets cost in model metadata - we use a flat per-second rate
      // Default: free models = 0 credits, paid = cost_per_1k_tokens as flat credit
      const creditCost = userPrice(model) > 0
        ? userPrice(model) * (result.duration_seconds || 5)
        : 0;

      if (creditCost > 0) await deductCredits(generation.user_id, generationId, creditCost);

      await query(
        `UPDATE ai_generations
         SET status        = 'completed',
             result_url    = $1,
             credits_used  = $2,
             duration_ms   = $3,
             completed_at  = NOW(),
             result_metadata = $4
         WHERE id = $5`,
        [
          storedUrl,
          creditCost,
          result.duration_ms,
          JSON.stringify({
            duration_seconds:  result.duration_seconds,
            generation_job_id: result.generation_job_id,
            original_url:      result.url,
          }),
          generationId,
        ]
      );

    } else {
      // ── Text generation ─────────────────────────────────────────────────────
      try {
        result = await generateText(openrouterId, generation.prompt, params, systemPrompt);
      } catch (primaryErr) {
        logger.warn('Primary model failed — failover', {
          openrouterId, error: primaryErr.message,
        });

        let bestFree = null;
        if (model?.failover_model_id) {
          const configured = await query(
            `SELECT * FROM ai_models
             WHERE id=$1 AND is_active=true AND $2::ai_tool_type = ANY(supported_tools)`,
            [model.failover_model_id, generation.tool_type]
          );
          bestFree = configured.rows[0] || null;
        }
        if (!bestFree) {
          const freeModels = await getFreeModels(generation.tool_type);
          bestFree = await getBestFreeModel(freeModels);
        }

        if (bestFree && bestFree.openrouter_id !== openrouterId) {
          logger.info('Failover activated', {
            from: openrouterId,
            to:   bestFree.openrouter_id,
          });
          openrouterId  = bestFree.openrouter_id;
          failoverModel = bestFree.openrouter_id;
          usedFailover  = true;

          result = await generateText(openrouterId, generation.prompt, params, systemPrompt);
        } else {
          throw primaryErr;
        }
      }

      const totalTokens = result.tokens_input + result.tokens_output;
      const creditCost  = usedFailover ? 0 :
        Math.ceil((totalTokens / 1000) * userPrice(model));

      if (creditCost > 0) await deductCredits(generation.user_id, generationId, creditCost);

      // Update avg_response_ms on model
      if (model) {
        await query(
          `UPDATE ai_models
           SET avg_response_ms = CASE
             WHEN avg_response_ms IS NULL THEN $1
             ELSE (avg_response_ms * 0.8 + $1 * 0.2)::INTEGER
           END
           WHERE id = $2`,
          [result.duration_ms, model.id]
        );
      }

      await query(
        `UPDATE ai_generations
         SET status          = 'completed',
             result_text     = $1,
             tokens_input    = $2,
             tokens_output   = $3,
             credits_used    = $4,
             duration_ms     = $5,
             completed_at    = NOW(),
             used_failover   = $6,
             failover_model  = $7
         WHERE id = $8`,
        [
          result.text,
          result.tokens_input,
          result.tokens_output,
          creditCost,
          result.duration_ms,
          usedFailover,
          failoverModel,
          generationId,
        ]
      );
    }

    await decrementActive(generation.openrouter_id, result.duration_ms, false);

    await publishProgress(generationId, generation.user_id, 'completed', {
      result_text: result?.text?.slice(0, 300),
      result_url:  result?.url,
      used_failover: usedFailover,
    });

    // Log usage
    await query(
      `INSERT INTO ai_usage_log
         (user_id, ai_model_id, generation_id, tool_type,
          openrouter_id, credits_used, tokens_input, tokens_output)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        generation.user_id,
        generation.ai_model_id,
        generationId,
        generation.tool_type,
        openrouterId,
        0,
        result?.tokens_input || 0,
        result?.tokens_output || 0,
      ]
    );

  } catch (err) {
    await query(
      `UPDATE ai_generations
       SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE id = $2`,
      [err.message, generationId]
    );

    if (model) {
      await query(
        'UPDATE ai_models SET total_failures = total_failures + 1 WHERE id = $1',
        [model.id]
      );
    }

    await decrementActive(generation.openrouter_id, null, true);
    await publishProgress(generationId, generation.user_id, 'failed', { error: err.message });
    throw err;
  }
};

// ── Read Methods ──────────────────────────────────────────────────────────────

const getGeneration = async (generationId, userId, role) => {
  const result = await query(
    'SELECT * FROM ai_generations WHERE id = $1',
    [generationId]
  );
  const gen = result.rows[0];
  if (!gen) throw new AppError('Generation not found', 404);
  if (role !== 'admin' && gen.user_id !== userId) throw new AppError('Not found', 404);
  return gen;
};

const getMyGenerations = async (userId, { page = 1, limit = 20, tool_type, status } = {}) => {
  const offset = (page - 1) * limit;
  const params = [userId];
  const conds  = [];

  if (tool_type) { params.push(tool_type); conds.push(`tool_type = $${params.length}`); }
  if (status)    { params.push(status);    conds.push(`status = $${params.length}`); }

  const where = conds.length > 0 ? `AND ${conds.join(' AND ')}` : '';

  const result = await query(
    `SELECT id, tool_type, openrouter_id, model_name,
            status, result_text, result_url,
            credits_used, tokens_input, tokens_output,
            duration_ms, error_message, used_failover,
            created_at, completed_at
     FROM ai_generations
     WHERE user_id = $1 ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const count = await query(
    `SELECT COUNT(*) FROM ai_generations WHERE user_id = $1 ${where}`,
    params
  );

  return {
    generations: result.rows,
    pagination: {
      page, limit,
      total: parseInt(count.rows[0].count, 10),
      pages: Math.ceil(count.rows[0].count / limit),
    },
  };
};

const getUsageSummary = async (userId) => {
  const result = await query(
    `SELECT
       COUNT(*)                                              AS total_generations,
       COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
       COUNT(*) FILTER (WHERE status = 'failed')            AS failed,
       COALESCE(SUM(credits_used), 0)                       AS total_credits_used,
       COALESCE(SUM(tokens_input + tokens_output), 0)       AS total_tokens,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS this_hour
     FROM ai_generations
     WHERE user_id = $1`,
    [userId]
  );

  return {
    ...result.rows[0],
    rate_limit: {
      limit:     env.ai.maxRequestsPerHour,
      used:      parseInt(result.rows[0].this_hour, 10),
      remaining: Math.max(0, env.ai.maxRequestsPerHour - parseInt(result.rows[0].this_hour, 10)),
    },
  };
};

module.exports = {
  AI_PROGRESS_CHANNEL,
  createGeneration,
  processGeneration,
  getGeneration,
  getMyGenerations,
  getUsageSummary,
  bustModelCache,
};
