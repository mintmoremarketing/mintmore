const { randomUUID }         = require('crypto');
const { query, getClient }   = require('../../config/database');
const { getRedis, handleRedisError } = require('../../config/redis');
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
  generateImage: generateOpenRouterImage,
  generateVideo,
  getOpenRouterVideoModel,
  normalizeVideoParameters,
} = require('./providers/openrouter.provider');
const { generateImage: generatePollinationsImage } = require('./providers/pollinations.provider');
const { generateImage: generateReplicateImage } = require('./providers/replicate.provider');
const {
  buildEnhancementMessages,
  buildVideoEnhancementMessages,
  parseImagePromptIntent,
  composeImagePrompt,
  normalizeEnhancedPrompt,
} = require('./image-prompt.orchestrator');
const { uploadFile, getBucket, createSignedDownloadUrl } = require('../storage/app-storage.provider');
const AppError  = require('../../utils/AppError');
const logger    = require('../../utils/logger');
const env       = require('../../config/env');
const {
  recordCreditTransaction,
  getCreditAccount,
  expireCreditsForUser,
} = require('../commerce/credits.service');

const RATE_LIMIT_KEY      = (userId) => `ai:ratelimit:${userId}`;
const AI_PROGRESS_CHANNEL = 'mint_more:ai_progress';
const userPrice = (model) => Number(model?.user_price_per_1k_tokens ?? model?.cost_per_1k_tokens ?? 0);
const IMAGE_REFERENCE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_REFERENCE_MAX_BYTES = 5 * 1024 * 1024;
const RESOLUTION_MULTIPLIERS = { '1K': 1, '2K': 4, '4K': 16 };
const TRIAL_IMAGE_GENERATIONS_LIMIT = 5;

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (_) { return {}; }
  }
  return {};
};

const getSupportedTools = (model) => {
  const tools = parseJsonObject(model?.supported_tools);
  if (Array.isArray(tools)) return tools.map((tool) => String(tool).toLowerCase());
  return [];
};

const getTierAliases = (model, resolutionTier = '1K') => {
  const tier = String(resolutionTier || '1K');
  const isVideoModel = getSupportedTools(model).includes('video');

  if (isVideoModel) {
    if (tier === 'normal') return ['normal', '1K'];
    if (tier === '2560p') return ['2560p', '2K', '4K'];
    if (tier === '1K') return ['1K', 'normal'];
    if (tier === '2K' || tier === '4K') return [tier, '2560p'];
  }

  return [tier];
};

const isUnlimitedForResolution = (model, resolutionTier = '1K') => {
  const tiers = parseJsonObject(model?.is_unlimited_tier);
  return getTierAliases(model, resolutionTier).some((tier) => Boolean(tiers[tier]));
};

const modelResolutionCost = (model, resolutionTier = '1K') => {
  if (isUnlimitedForResolution(model, resolutionTier)) return 0;
  const customCosts = parseJsonObject(model.mintcoin_costs);
  for (const tier of getTierAliases(model, resolutionTier)) {
    if (customCosts && customCosts[tier] !== undefined) {
      return Number(customCosts[tier] || 0);
    }
  }
  const multiplier = RESOLUTION_MULTIPLIERS[resolutionTier] || 1;
  return Math.max(0, Math.ceil(userPrice(model) * multiplier));
};

const modelCostSummary = (model) => {
  const tiers = ['1K', '2K', '4K'].map((tier) => ({
    tier,
    unlimited: isUnlimitedForResolution(model, tier),
    cost: modelResolutionCost(model, tier),
  }));
  const paid = tiers.filter((tier) => !tier.unlimited).map((tier) => tier.cost);
  return {
    tiers,
    label: paid.length === 0 ? '∞' : paid.length === 1 ? `${paid[0]}` : `${Math.min(...paid)} - ${Math.max(...paid)}`,
  };
};

const resolveImageProvider = (modelId) => {
  const normalizedId = String(modelId || '');
  if (normalizedId.startsWith('pollinations/')) {
    return {
      modelId: normalizedId,
      generate: generatePollinationsImage,
    };
  }
  if (normalizedId.startsWith('replicate/')) {
    return {
      modelId: normalizedId.replace(/^replicate\//, ''),
      generate: generateReplicateImage,
    };
  }
  return {
    modelId: normalizedId,
    generate: generateOpenRouterImage,
  };
};

const requireNonEmptyTextResult = (result, openrouterId) => {
  const text = typeof result?.text === 'string' ? result.text.trim() : '';
  if (!text) {
    throw new Error(`AI model ${openrouterId} returned an empty response`);
  }
  return {
    ...result,
    text,
    tokens_input:  Number(result?.tokens_input || 0),
    tokens_output: Number(result?.tokens_output || 0),
    duration_ms:   Number(result?.duration_ms || 0),
  };
};

// ── Tool Prompts ──────────────────────────────────────────────────────────────

const buildPrompt = (toolType, userPrompt, params = {}, modelSystemPrompts = {}) => {
  // Use model-specific system prompt override if admin configured one
  const customSystemPrompt = modelSystemPrompts[toolType] || null;

  const builtPrompts = {
    text: {
      system: customSystemPrompt ||
        'You are a practical creative assistant for Indian businesses. Follow the requested format exactly. If the user asks for a caption, headline, tagline, or short copy, keep it short instead of writing an article.',
      user: params.session_id ? userPrompt : `Create the requested content:\n${userPrompt}\n\nTone: ${params.tone || 'clear and useful'}\nLength: ${params.length || 'as short as the request naturally needs'}\n${params.keywords ? `Keywords to include: ${params.keywords}` : ''}\n\nWrite directly without preamble. Do not add unrelated marketing theory.`,
    },
    caption: {
      system: customSystemPrompt ||
        'You are a social media caption writer for Indian brands. Captions must be crisp, usable, and specific. Never write an essay.',
      user: `Create captions for:\n${userPrompt}\n\nPlatform: ${params.platform || 'Instagram'}\nTone: ${params.tone || 'natural and engaging'}\nHashtags: ${params.hashtag_count || 5}\n\nFormat:\n1. [caption under 25 words]\n2. [caption under 25 words]\n3. [caption under 25 words]\n\nHashtags: [5 relevant hashtags]\n\nIf the post context is missing, ask one short follow-up question after the options.`,
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
      system: params._system || customSystemPrompt || '',
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
  const limit = env.ai.maxRequestsPerHour;

  const fallbackToDatabaseLimit = async (error) => {
    logger.warn('AI Redis rate limit unavailable, falling back to database usage count', {
      userId,
      error: error.message,
    });

    const usage = await query(
      `SELECT COUNT(*)::int AS count
       FROM ai_generations
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '1 hour'
         AND status <> 'failed'`,
      [userId]
    );
    const count = Number(usage.rows[0]?.count || 0) + 1;
    if (count > limit) {
      throw new AppError(
        `AI rate limit reached (${limit}/hour). Please try again later.`,
        429
      );
    }
    return { count, limit, remaining: Math.max(0, limit - count) };
  };

  try {
    const redis = getRedis();
    const key   = RATE_LIMIT_KEY(userId);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);

    if (count > limit) {
      const ttl         = await redis.ttl(key);
      const minutesLeft = Math.ceil(ttl / 60);
      throw new AppError(
        `AI rate limit reached (${limit}/hour). Resets in ${minutesLeft} min.`,
        429
      );
    }
    return { count, limit, remaining: limit - count };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (env.node_env === 'production') return fallbackToDatabaseLimit(err);
    logger.warn('AI rate limit skipped because Redis is unavailable in development', {
      userId,
      error: err.message,
    });
    return { count: 0, limit, remaining: limit };
  }
};

const getMembershipTrialState = async (userId, dbClient = null, forUpdate = false) => {
  const executor = dbClient || { query };
  const result = await executor.query(
    `SELECT id, status, trial_image_generations_used, trial_image_generations_limit
     FROM memberships
     WHERE user_id = $1
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId]
  );
  return result.rows[0] || null;
};

const consumeTrialImageGeneration = async (userId, count = 1) => {
  const units = Math.max(1, Number(count || 1));
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const membership = await getMembershipTrialState(userId, dbClient, true);
    if (!membership || membership.status !== 'trial') {
      await dbClient.query('COMMIT');
      return {
        applied: false,
        used: Number(membership?.trial_image_generations_used || 0),
        limit: Number(membership?.trial_image_generations_limit || TRIAL_IMAGE_GENERATIONS_LIMIT),
        remaining: 0,
      };
    }

    const limit = Math.max(0, Number(membership.trial_image_generations_limit || TRIAL_IMAGE_GENERATIONS_LIMIT));
    const used = Math.max(0, Number(membership.trial_image_generations_used || 0));
    if (used + units > limit) {
      await dbClient.query('COMMIT');
      return {
        applied: false,
        used,
        limit,
        remaining: Math.max(0, limit - used),
      };
    }

    const nextUsed = used + units;
    await dbClient.query(
      'UPDATE memberships SET trial_image_generations_used = $1 WHERE id = $2',
      [nextUsed, membership.id]
    );
    await dbClient.query('COMMIT');
    return {
      applied: true,
      used: nextUsed,
      limit,
      remaining: Math.max(0, limit - nextUsed),
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const releaseTrialImageGeneration = async (userId, count = 1) => {
  const units = Math.max(1, Number(count || 1));
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const membership = await getMembershipTrialState(userId, dbClient, true);
    if (membership && membership.status === 'trial') {
      const used = Math.max(0, Number(membership.trial_image_generations_used || 0));
      const nextUsed = Math.max(0, used - units);
      if (nextUsed !== used) {
        await dbClient.query(
          'UPDATE memberships SET trial_image_generations_used = $1 WHERE id = $2',
          [nextUsed, membership.id]
        );
      }
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    logger.warn('Trial image generation release failed', {
      userId,
      error: err.message,
    });
  } finally {
    dbClient.release();
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
    if (existingCreditTx.rows[0]) {
      await dbClient.query('COMMIT');
      return;
    }

    const creditAccount = await getCreditAccount(userId, dbClient, true);
    if (Number(creditAccount.balance) < Number(creditCost)) {
      throw new AppError('Insufficient Mintcoins for this generation', 402);
    }

    await recordCreditTransaction(dbClient, {
      userId,
      type: 'platform_spend',
      amount: -Number(creditCost),
      referenceId: generationId,
      referenceType: 'ai_generation',
      idempotencyKey: `ai-credit:${generationId}`,
      description: 'Mint AI generation',
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

const refundPrepaidGenerationCredits = async (userId, generationId) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const generationResult = await dbClient.query(
      'SELECT parameters FROM ai_generations WHERE id = $1 FOR UPDATE',
      [generationId]
    );
    const generationParams = generationResult.rows[0]?.parameters || {};
    if (generationParams._trial_image_generation) {
      await releaseTrialImageGeneration(userId);
    }

    const creditTx = await dbClient.query(
      'SELECT amount FROM mint_credit_transactions WHERE idempotency_key = $1',
      [`ai-credit:${generationId}`]
    );
    const existingCreditRefund = await dbClient.query(
      'SELECT id FROM mint_credit_transactions WHERE idempotency_key = $1',
      [`ai-credit-refund:${generationId}`]
    );
    const creditRefund = creditTx.rows[0] && !existingCreditRefund.rows[0]
      ? Math.abs(Number(creditTx.rows[0].amount))
      : 0;

    if (creditRefund > 0) {
      await recordCreditTransaction(dbClient, {
        userId,
        type: 'reversal',
        amount: creditRefund,
        referenceId: generationId,
        referenceType: 'ai_generation',
        idempotencyKey: `ai-credit-refund:${generationId}`,
        description: 'Mint AI generation refund - queue unavailable',
      });
    }

    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    logger.error('Credit refund after queue failure failed', {
      generationId,
      error: err.message,
    });
  } finally {
    dbClient.release();
  }
};

const publishProgress = async (generationId, userId, status, data = {}) => {
  try {
    const redis = getRedis();
    await redis.publish(
      AI_PROGRESS_CHANNEL,
      JSON.stringify({ generationId, userId, status, ...data })
    );
  } catch (err) {
    handleRedisError(err);
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

  let normalizedParameters = parameters;
  if (tool_type === 'video') {
    let capabilities;
    try {
      capabilities = await getOpenRouterVideoModel(model.openrouter_id);
    } catch (error) {
      throw new AppError(error.message, error.retryable === false ? 400 : 503);
    }

    normalizedParameters = normalizeVideoParameters(capabilities, parameters);
  }

  const engineCost = Number(normalizedParameters._engine_credit_cost || 0);
  const engineUnlimited = normalizedParameters._engine_unlimited === true;
  const isTextTool = ['text', 'caption', 'video_script', 'repurpose'].includes(String(tool_type));
  const isImageTool = tool_type === 'image';
  const isVideoTool = tool_type === 'video';

  await checkRateLimit(userId);

  // Credit preflight check
  let preflightCost = isTextTool ? 0 : (engineCost > 0 ? engineCost : userPrice(model));

  if (isImageTool && !engineUnlimited && preflightCost > 0) {
    const trialResult = await consumeTrialImageGeneration(userId, 1);
    if (trialResult.applied) {
      preflightCost = 0;
      normalizedParameters._trial_image_generation = true;
      normalizedParameters._engine_credit_cost = 0;
      normalizedParameters._engine_deduct_before_enqueue = false;
    }
  }

  if ((isImageTool || isVideoTool) && !engineUnlimited && preflightCost > 0) {
    await expireCreditsForUser(userId);
    const walletResult = await query(
      `SELECT COALESCE(c.balance, 0) AS credit_balance
       FROM mint_credit_accounts c
       WHERE c.user_id = $1`,
      [userId]
    );

    const availableMintcoins = Number(walletResult.rows[0]?.credit_balance || 0);
    if (availableMintcoins < preflightCost) {
      throw new AppError(
        `INSUFFICIENT_MINTCOINS: You need ${preflightCost} Mintcoins to generate this ${tool_type}.`,
        402
      );
    }
  }

  const promptData  = buildPrompt(tool_type, prompt, normalizedParameters, model.system_prompts || {});

  const result = await query(
    `INSERT INTO ai_generations
       (user_id, ai_model_id, tool_type, openrouter_id, model_name,
        prompt, parameters, status, source_post_id, source_job_id,
        raw_prompt, enhanced_prompt, seed, aspect_ratio, resolution_tier,
        style_preset_id, reference_asset_ids, thinking_level, google_search_enabled,
        batch_count, engine_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING *`,
    [
      userId, model.id, tool_type,
      model.openrouter_id, model.name,
      promptData.user,
      JSON.stringify({ ...normalizedParameters, _system: promptData.system }),
      source_post_id || null,
      source_job_id  || null,
      normalizedParameters._raw_prompt || null,
      normalizedParameters._enhanced_prompt || null,
      normalizedParameters.seed || null,
      normalizedParameters.aspect_ratio || null,
      normalizedParameters.resolution_tier || null,
      normalizedParameters.style_preset_id || null,
      normalizedParameters.reference_asset_ids || [],
      normalizedParameters.thinking_level || null,
      Boolean(normalizedParameters.google_search_enabled),
      normalizedParameters.batch_count || 1,
      JSON.stringify(normalizedParameters.engine_metadata || {}),
    ]
  );

  const generation  = result.rows[0];
  if (engineCost > 0 && normalizedParameters._engine_deduct_before_enqueue) {
    await deductCredits(userId, generation.id, engineCost);
    await query(
      'UPDATE ai_generations SET credits_used = $1 WHERE id = $2',
      [engineCost, generation.id]
    );
  }
  let queueJobId;
  try {
    queueJobId = await enqueueGeneration(generation.id);
  } catch (err) {
    if (engineCost > 0 && normalizedParameters._engine_deduct_before_enqueue) {
      await refundPrepaidGenerationCredits(userId, generation.id);
    }
    logger.error('AI generation enqueue failed', {
      generationId: generation.id,
      error: err.message,
      code: err.code,
      name: err.name,
      statusCode: err.statusCode,
      redisCircuitOpen: Boolean(err.redisCircuitOpen),
    });
    const queueErrorMessage = err.isOperational
      ? err.message
      : err.message
        ? `AI queue is unavailable: ${err.message}`
        : 'AI queue is unavailable. Check Redis/worker configuration.';
    const queueStatusCode = err.isOperational && err.statusCode
      ? err.statusCode
      : 503;
    await query(
      `UPDATE ai_generations
       SET status = 'failed', error_message = $1, completed_at = NOW()
       WHERE id = $2`,
      [queueErrorMessage, generation.id]
    );
    throw new AppError(queueErrorMessage, queueStatusCode);
  }

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
  if (generation.status === 'completed') {
    logger.info('AI generation already completed; skipping retry', { generationId });
    return;
  }

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
        const referenceUrls = [];
        const references = Array.isArray(params.engine_metadata?.references)
          ? params.engine_metadata.references
          : [];
        for (const reference of references) {
          if (!reference?.bucket || !reference?.path) continue;
          try {
            const signed = await createSignedDownloadUrl(reference.bucket, reference.path, 900);
            if (signed) referenceUrls.push(signed);
          } catch (err) {
            logger.warn('AI reference signing failed', {
              generationId,
              referenceId: reference.id,
              error: err.message,
            });
          }
        }

        const imageProvider = resolveImageProvider(openrouterId);

        result = await imageProvider.generate(imageProvider.modelId, generation.prompt, {
          ...params,
          reference_urls: referenceUrls,
        });
      } catch (err) {
        // Failover to free text model for image prompts is not applicable
        // Re-throw so admin knows
        throw err;
      }

      const imageDownloadStartedAt = Date.now();
      const imageRes  = await fetch(result.url);
      if (!imageRes.ok) {
        const error = new Error(`Generated image download failed with status ${imageRes.status}`);
        error.retryable = imageRes.status === 429 || imageRes.status >= 500;
        throw error;
      }
      const buffer    = Buffer.from(await imageRes.arrayBuffer());
      const contentType = (imageRes.headers.get('content-type') || 'image/jpeg').split(';')[0];
      const extension = contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
          ? 'webp'
          : contentType.includes('svg')
            ? 'svg'
            : 'jpg';
      const filePath  = `ai-generated/${generation.user_id}/${generationId}.${extension}`;
      const storedUrl = await uploadFile('job-attachments', filePath, buffer, contentType);
      const imageDurationMs = Number(result.duration_ms) > 1000
        ? result.duration_ms
        : Date.now() - imageDownloadStartedAt;

      const prepaidEngineCost = params._engine_deduct_before_enqueue
        ? Number(params._engine_credit_cost || 0)
        : 0;
      const creditCost = params._trial_image_generation
        ? 0
        : (prepaidEngineCost > 0 ? prepaidEngineCost : userPrice(model));
      if (!prepaidEngineCost && creditCost > 0) {
        await deductCredits(generation.user_id, generationId, creditCost);
      }

      await query(
        `UPDATE ai_generations
         SET status       = 'completed',
             result_url   = $1,
             credits_used = $2,
             duration_ms  = $3,
             completed_at = NOW(),
             result_metadata = $4
         WHERE id = $5`,
        [
          storedUrl,
          creditCost,
          imageDurationMs,
          JSON.stringify({
            seed: params.seed || null,
            aspect_ratio: params.aspect_ratio || null,
            resolution_tier: params.resolution_tier || null,
            style_preset_id: params.style_preset_id || null,
            reference_asset_ids: params.reference_asset_ids || [],
            enhanced_prompt: params._enhanced_prompt || null,
            provider_prompt: params._provider_prompt || generation.prompt,
            prompt_profile_version: params._prompt_profile_version || null,
            reference_policy: params._reference_policy || null,
          }),
          generationId,
        ]
      );
    } else if (isVideo) {
      // ── Video generation ────────────────────────────────────────────────────
      const supplementalReferenceUrls = [];
      const startReferenceAlias = params.start_reference_alias || null;
      const endReferenceAlias = params.end_reference_alias || null;
      const references = Array.isArray(params.engine_metadata?.references)
        ? params.engine_metadata.references
        : [];
      for (const reference of references) {
        if (!reference?.bucket || !reference?.path) continue;
        if (reference.alias === startReferenceAlias || reference.alias === endReferenceAlias) continue;
        try {
          const signed = await createSignedDownloadUrl(reference.bucket, reference.path, 900);
          if (signed) supplementalReferenceUrls.push(signed);
        } catch (err) {
          logger.warn('AI video reference signing failed', {
            generationId,
            referenceId: reference.id,
            error: err.message,
          });
        }
      }

      const startFrameReference = startReferenceAlias
        ? references.find((item) => item.alias === startReferenceAlias) || null
        : null;
      const endFrameReference = endReferenceAlias
        ? references.find((item) => item.alias === endReferenceAlias) || null
        : null;
      const startFrameUrl = startFrameReference?.bucket && startFrameReference?.path
        ? await createSignedDownloadUrl(startFrameReference.bucket, startFrameReference.path, 900).catch(() => null)
        : null;
      const lastFrameUrl = endFrameReference?.bucket && endFrameReference?.path
        ? await createSignedDownloadUrl(endFrameReference.bucket, endFrameReference.path, 900).catch(() => null)
        : null;

      const videoParams = {
        ...params,
        duration: Number(params.duration || 6),
        reference_urls: supplementalReferenceUrls,
        first_frame_url: params.first_frame_url || startFrameUrl || null,
        last_frame_url: params.last_frame_url || lastFrameUrl || null,
      };

      result = await generateVideo(openrouterId, generation.prompt, videoParams);

      // Download video and store in Supabase Storage
      const videoRes  = await fetch(result.url, { headers: result.download_headers || {} });
      if (!videoRes.ok) {
        const error = new Error(`Generated video download failed with status ${videoRes.status}`);
        error.retryable = videoRes.status === 429 || videoRes.status >= 500;
        throw error;
      }
      const buffer    = Buffer.from(await videoRes.arrayBuffer());
      const filePath  = `ai-generated/${generation.user_id}/${generationId}.mp4`;
      const storedUrl = await uploadFile('job-attachments', filePath, buffer, 'video/mp4');

      const resKey = params.resolution_tier || 'normal';
      const mintcoinCosts = model.mintcoin_costs || {};
      const creditCost = Number(mintcoinCosts[resKey] || 0);

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
        // Fetch chat history for context memory (last 10 interactions)
        let chat_history = [];
        if (params.session_id) {
          const historyResult = await query(
            `SELECT raw_prompt, result_metadata FROM ai_generations 
             WHERE parameters->>'session_id' = $1 AND status = 'completed' AND id != $2
             ORDER BY created_at DESC LIMIT 10`,
            [params.session_id, generationId]
          );
          chat_history = historyResult.rows.reverse().flatMap(row => {
            const assistantText = typeof row.result_metadata === 'string' ? JSON.parse(row.result_metadata).text : row.result_metadata?.text;
            if (!assistantText) return [];
            return [
              { role: 'user', content: row.raw_prompt },
              { role: 'assistant', content: assistantText }
            ];
          });
        }
        params.chat_history = chat_history;

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
        
        // If no free models available, aggressively fallback to any active model for the tool type
        if (!bestFree) {
          const allToolModels = await query(
            `SELECT * FROM ai_models WHERE is_active=true AND $1::text = ANY(supported_tools) AND openrouter_id != $2 LIMIT 1`,
            [generation.tool_type, openrouterId]
          );
          bestFree = allToolModels.rows[0] || null;
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

      result = requireNonEmptyTextResult(result, openrouterId);

      const totalTokens = result.tokens_input + result.tokens_output;
      const creditCost  = 0;

      if (creditCost > 0) await deductCredits(generation.user_id, generationId, creditCost);

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

      // Telemetry must never turn a successful generation into a failed one.
      if (model) {
        try {
          await query(
            `UPDATE ai_models
             SET avg_response_ms = CASE
               WHEN avg_response_ms IS NULL THEN $1::INTEGER
               ELSE (avg_response_ms * 0.8 + $1::INTEGER * 0.2)::INTEGER
             END
             WHERE id = $2::UUID`,
            [result.duration_ms, model.id]
          );
        } catch (metricError) {
          logger.warn('AI response-time metric update failed', {
            modelId: model.id,
            error: metricError.message,
          });
        }
      }
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

const getEngineModels = async (userId, { tool_type = 'image' } = {}) => {
  const models = (await getAllModels()).filter((model) => model.supported_tools?.includes(tool_type));
  const creditAccount = await getCreditAccount(userId).catch(() => null);
  return {
    balance: Number(creditAccount?.balance || 0),
    models: models.map((model) => ({
      ...model,
      cost_summary: modelCostSummary(model),
    })),
  };
};

const getStylePresets = async () => {
  const result = await query(
    `SELECT id, name, thumbnail_url
     FROM ai_style_presets
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`
  );
  return result.rows;
};

const uploadReferenceAsset = async (userId, { file, sessionId, projectId = null, referenceRole = 'reference' }) => {
  if (!sessionId) throw new AppError('Reference session_id is required', 400);
  if (!file) throw new AppError('Reference image is required', 400);
  if (!IMAGE_REFERENCE_TYPES.has(file.mimetype)) {
    throw new AppError('Reference image must be JPEG, PNG, or WebP', 415);
  }
  if (file.size > IMAGE_REFERENCE_MAX_BYTES) {
    throw new AppError('Reference image too large. Max size: 5MB', 413);
  }

  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM ai_reference_assets
     WHERE user_id = $1 AND session_id = $2`,
    [userId, sessionId]
  );
  const currentCount = Number(countResult.rows[0]?.count || 0);
  if (currentCount >= 4) {
    throw new AppError('You can add up to 4 image references in this phase', 400);
  }

  const normalizedRole = ['start', 'end', 'reference'].includes(String(referenceRole || '').toLowerCase())
    ? String(referenceRole).toLowerCase()
    : 'reference';
  const alias = `img${currentCount + 1}`;
  const extension = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const bucket = getBucket('mintbox');
  const storagePath = `ai-references/${userId}/${sessionId}/${alias}-${randomUUID()}.${extension}`;
  await uploadFile(bucket, storagePath, file.buffer, file.mimetype);

  const inserted = await query(
    `INSERT INTO ai_reference_assets
       (user_id, session_id, project_id, alias, reference_role, storage_bucket, storage_path,
        original_filename, mime_type, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, alias, reference_role, original_filename, mime_type, size_bytes, created_at`,
    [
      userId,
      sessionId,
      projectId || null,
      alias,
      normalizedRole,
      bucket,
      storagePath,
      file.originalname || `${alias}.${extension}`,
      file.mimetype,
      file.size,
    ]
  );

  const asset = inserted.rows[0];
  const preview_url = await createSignedDownloadUrl(bucket, storagePath, 900).catch(() => null);
  return { ...asset, preview_url };
};

const resolveReferenceAssets = async (userId, sessionId, aliases = []) => {
  const uniqueAliases = [...new Set((aliases || []).filter(Boolean))];
  if (!uniqueAliases.length) return [];
  const result = await query(
    `SELECT id, alias, reference_role, storage_bucket, storage_path, mime_type
     FROM ai_reference_assets
     WHERE user_id = $1 AND session_id = $2 AND alias = ANY($3::text[])
     ORDER BY created_at ASC`,
    [userId, sessionId, uniqueAliases]
  );
  return result.rows;
};

const getImagePromptContext = async (userId, projectId) => {
  const [userResult, projectResult] = await Promise.all([
    query(
      `SELECT business_name, business_type, customer_profile
       FROM users
       WHERE id = $1`,
      [userId]
    ),
    projectId
      ? query(
        `SELECT title, description
         FROM jobs
         WHERE id = $1 AND client_id = $2`,
        [projectId, userId]
      )
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    businessContext: userResult.rows[0] || {},
    projectContext: projectResult.rows[0] || {},
  };
};

const enhancePrompt = async ({
  rawPrompt,
  styleModifier,
  references = [],
  businessContext = {},
  projectContext = {},
  aspectRatio,
  resolutionTier,
  promptIntent = {},
}) => {
  const freeModels = await getFreeModels('text');
  if (!freeModels.length) {
    logger.warn('enhancePrompt: no free text models available — skipping enhancement');
    return null;
  }
  // Pick the best (lowest-load) free text model instead of always using the weakest fallback
  const model = await getBestFreeModel(freeModels);
  if (!model) return null;
  logger.info('enhancePrompt: starting prompt enhancement', {
    model: model.openrouter_id,
    rawPrompt: rawPrompt.slice(0, 120),
    hasReferences: references.length > 0,
  });
  try {
    const enhancement = buildEnhancementMessages({
      rawPrompt,
      styleModifier,
      references,
      businessContext,
      projectContext,
      aspectRatio,
      resolutionTier,
      promptIntent,
    });
    const result = await generateText(
      model.openrouter_id,
      enhancement.user,
      { temperature: 0.35, max_tokens: 600 },
      enhancement.system
    );
    const enhanced = normalizeEnhancedPrompt(requireNonEmptyTextResult(result, model.openrouter_id).text);
    logger.info('enhancePrompt: enhancement succeeded', {
      model: model.openrouter_id,
      enhancedPrompt: (enhanced || '').slice(0, 200),
    });
    return enhanced;
  } catch (err) {
    logger.warn('enhancePrompt: AI prompt enhancement skipped', {
      model: model.openrouter_id,
      error: err.message,
    });
    return null;
  }
};

// Video-specific prompt enhancer — uses cinematic/motion-aware system prompt
const enhanceVideoPrompt = async ({
  rawPrompt,
  references = [],
  businessContext = {},
  projectContext = {},
  aspectRatio,
  duration,
  startFrameAlias = null,
  endFrameAlias = null,
}) => {
  const freeModels = await getFreeModels('text');
  if (!freeModels.length) return null;
  const model = await getBestFreeModel(freeModels);
  if (!model) return null;
  try {
    const enhancement = buildVideoEnhancementMessages({
      rawPrompt,
      references,
      businessContext,
      projectContext,
      aspectRatio,
      duration,
      startFrameAlias,
      endFrameAlias,
    });
    const result = await generateText(
      model.openrouter_id,
      enhancement.user,
      { temperature: 0.4, max_tokens: 600 },
      enhancement.system
    );
    return normalizeEnhancedPrompt(requireNonEmptyTextResult(result, model.openrouter_id).text);
  } catch (err) {
    logger.warn('AI video prompt enhancement skipped', {
      model: model.openrouter_id,
      error: err.message,
    });
    return null;
  }
};

const createEngineImageGeneration = async (userId, payload = {}) => {
  const {
    model_id,
    prompt,
    session_id,
    project_id,
    reference_aliases = [],
    style_preset_id,
    ai_prompt = false,
    fixed_seed = false,
    seed,
    batch_count = 1,
    aspect_ratio = 'Auto',
    resolution_tier = '1K',
    thinking_level,
    google_search_enabled = false,
  } = payload;

  const modelResult = await query(
    'SELECT * FROM ai_models WHERE id = $1 AND is_active = true',
    [model_id]
  );
  const model = modelResult.rows[0];
  if (!model) throw new AppError('Image model not found or inactive', 404);
  if (!model.supported_tools?.includes('image')) {
    throw new AppError(`Model "${model.name}" does not support image generation`, 400);
  }

  const rawPrompt = String(prompt || '').trim();
  if (!rawPrompt) throw new AppError('Prompt is required', 400);

  const styleResult = style_preset_id
    ? await query(
      `SELECT id, prompt_modifier
       FROM ai_style_presets
       WHERE id = $1 AND is_active = true`,
      [style_preset_id]
    )
    : { rows: [] };
  const stylePreset = styleResult.rows[0] || null;

  const references = await resolveReferenceAssets(userId, session_id, reference_aliases);
  const styleModifier = stylePreset?.prompt_modifier || '';
  const promptContext = await getImagePromptContext(userId, project_id || null);
  const promptIntent = parseImagePromptIntent({
    rawPrompt,
    businessContext: promptContext.businessContext,
    projectContext: promptContext.projectContext,
    aspectRatio: aspect_ratio,
    resolutionTier: resolution_tier,
    references,
  });
  const enhancedPrompt = ai_prompt
    ? await enhancePrompt({
      rawPrompt,
      styleModifier,
      references,
      businessContext: promptContext.businessContext,
      projectContext: promptContext.projectContext,
      aspectRatio: aspect_ratio,
      resolutionTier: resolution_tier,
      promptIntent,
    })
    : null;
  const promptOrchestration = composeImagePrompt({
    rawPrompt,
    enhancedPrompt,
    styleModifier,
    references,
    model,
    businessContext: promptContext.businessContext,
    projectContext: promptContext.projectContext,
    aspectRatio: aspect_ratio,
    resolutionTier: resolution_tier,
    promptIntent,
  });
  const finalPrompt = promptOrchestration.providerPrompt;

  const safeBatchCount = Math.max(1, Math.min(4, Number(batch_count || 1)));
  const allowedThinkingLevel = model.supports_thinking_level ? (thinking_level || null) : null;
  const allowedGoogleSearch = Boolean(model.supports_google_search && google_search_enabled);
  const creditCostPerItem = modelResolutionCost(model, resolution_tier);
  const unlimited = isUnlimitedForResolution(model, resolution_tier);

  const results = [];
  for (let i = 0; i < safeBatchCount; i++) {
    const usedSeed = fixed_seed
      ? Number(seed || 123456789)
      : Math.floor(Math.random() * 2147483647);

    const generation = await createGeneration(userId, {
      tool_type: 'image',
      model_id,
      prompt: finalPrompt,
      source_job_id: project_id || null,
      parameters: {
        aspect_ratio,
        resolution_tier,
        batch_count: 1, // each row represents 1 item
        seed: usedSeed,
        reference_asset_ids: references.map((item) => item.id),
        reference_aliases: references.map((item) => item.alias),
        style_preset_id: stylePreset?.id || null,
        thinking_level: allowedThinkingLevel,
        google_search_enabled: allowedGoogleSearch,
        _system: promptOrchestration.systemPrompt,
        _raw_prompt: rawPrompt,
        _enhanced_prompt: enhancedPrompt,
        _provider_prompt: finalPrompt,
        _prompt_profile_version: promptOrchestration.profileVersion,
        _reference_policy: promptOrchestration.referencePolicy,
        _engine_credit_cost: unlimited ? 0 : creditCostPerItem,
        _engine_unlimited: unlimited,
        _engine_deduct_before_enqueue: !unlimited && creditCostPerItem > 0,
        engine_metadata: {
          project_id: project_id || null,
          prompt_orchestration: {
            profile_version: promptOrchestration.profileVersion,
            reference_policy: promptOrchestration.referencePolicy,
            intent: promptIntent,
            has_business_context: Boolean(
              promptContext.businessContext?.business_name ||
              promptContext.businessContext?.business_type ||
              promptContext.businessContext?.customer_profile
            ),
            has_project_context: Boolean(
              promptContext.projectContext?.title ||
              promptContext.projectContext?.description
            ),
          },
          references: references.map((item) => ({
            id: item.id,
            alias: item.alias,
            bucket: item.storage_bucket,
            path: item.storage_path,
            mime_type: item.mime_type,
          })),
          prompt_intent: promptIntent,
        },
      },
    });

    results.push({
      ...generation,
      seed: usedSeed,
      cost: unlimited ? 0 : creditCostPerItem,
      unlimited,
      raw_prompt: rawPrompt,
      enhanced_prompt: enhancedPrompt,
      prompt_intent: promptIntent,
    });
  }

  return results;
};

// ── Engine Video Generation ───────────────────────────────────────────────────

const createEngineVideoGeneration = async (userId, payload = {}) => {
  const {
    model_id,
    prompt,
    session_id,
    project_id,
    reference_aliases = [],
    start_reference_alias = null,
    end_reference_alias = null,
    duration = 6,
    ai_prompt = false,
    aspect_ratio = 'Auto',
    resolution_tier = 'normal',
    ...restParameters
  } = payload;

  const modelResult = await query(
    'SELECT * FROM ai_models WHERE id = $1 AND is_active = true',
    [model_id]
  );
  const model = modelResult.rows[0];
  if (!model) throw new AppError('Video model not found or inactive', 404);
  if (!model.supported_tools?.includes('video')) {
    throw new AppError(`Model "${model.name}" does not support video generation`, 400);
  }

  const rawPrompt = String(prompt || '').trim();
  if (!rawPrompt) throw new AppError('Prompt is required', 400);

  const resolvedAliases = [
    ...new Set(
      [ ...(Array.isArray(reference_aliases) ? reference_aliases : []), start_reference_alias, end_reference_alias ]
        .filter(Boolean)
    ),
  ];
  const references = await resolveReferenceAssets(userId, session_id, resolvedAliases);
  const startReference = start_reference_alias
    ? references.find((item) => item.alias === start_reference_alias) || null
    : null;
  const endReference = end_reference_alias
    ? references.find((item) => item.alias === end_reference_alias) || null
    : null;
  const promptContext = await getImagePromptContext(userId, project_id || null);
  const promptIntent = parseImagePromptIntent({
    rawPrompt,
    businessContext: promptContext.businessContext,
    projectContext: promptContext.projectContext,
    aspectRatio: aspect_ratio,
    resolutionTier: resolution_tier,
    references,
  });

  const enhancedPrompt = ai_prompt
    ? await enhanceVideoPrompt({
      rawPrompt,
      references,
      businessContext: promptContext.businessContext,
      projectContext: promptContext.projectContext,
      aspectRatio: aspect_ratio,
      duration,
      startFrameAlias: startReference?.alias || null,
      endFrameAlias: endReference?.alias || null,
      promptIntent,
    })
    : null;

  // Use the enhanced prompt as the final prompt sent to the video model
  const finalPrompt = enhancedPrompt || rawPrompt;

  // Delegate to the standard createGeneration which handles credits, queueing, etc.
  const generation = await createGeneration(userId, {
    tool_type: 'video',
    model_id,
    prompt: finalPrompt,
    parameters: {
      duration: Number(duration || 6),
      aspect_ratio,
      resolution_tier,
      reference_asset_ids: references.map((item) => item.id),
      reference_aliases: references.map((item) => item.alias),
      start_reference_alias: startReference?.alias || null,
      end_reference_alias: endReference?.alias || null,
      _raw_prompt: rawPrompt,
      _enhanced_prompt: enhancedPrompt,
      _provider_prompt: finalPrompt,
      _prompt_profile_version: promptIntent?.profile_version || null,
      engine_metadata: {
        project_id: project_id || null,
        prompt_orchestration: {
          profile_version: promptIntent?.profile_version || null,
          intent: promptIntent,
          has_business_context: Boolean(
            promptContext.businessContext?.business_name ||
            promptContext.businessContext?.business_type ||
            promptContext.businessContext?.customer_profile
          ),
          has_project_context: Boolean(
            promptContext.projectContext?.title ||
            promptContext.projectContext?.description
          ),
        },
        prompt_intent: promptIntent,
        references: references.map((item) => ({
          id: item.id,
          alias: item.alias,
          role: item.reference_role || 'reference',
          bucket: item.storage_bucket,
          path: item.storage_path,
          mime_type: item.mime_type,
        })),
        video_frame_anchors: {
          start_reference_alias: startReference?.alias || null,
          end_reference_alias: endReference?.alias || null,
          duration: Number(duration || 6),
        },
      },
      ...restParameters,
    },
    source_job_id: project_id || null,
  });

  return {
    ...generation,
    raw_prompt: rawPrompt,
    enhanced_prompt: enhancedPrompt,
    prompt_intent: promptIntent,
  };
};

const generationSelect = `
  SELECT g.*,
         m.provider_name,
         m.provider_display_name,
         m.icon_key,
         m.avg_latency_seconds,
         m.best_for,
         j.title AS project_title
  FROM ai_generations g
  LEFT JOIN ai_models m ON m.id = g.ai_model_id
  LEFT JOIN jobs j ON j.id = g.source_job_id
`;

const getGeneration = async (generationId, userId, role) => {
  const result = await query(
    `${generationSelect}
     WHERE g.id = $1 AND g.deleted_at IS NULL`,
    [generationId]
  );
  const gen = result.rows[0];
  if (!gen) throw new AppError('Generation not found', 404);
  if (role !== 'admin' && gen.user_id !== userId) throw new AppError('Not found', 404);
  return gen;
};

const getMyGenerations = async (
  userId,
  { page = 1, limit = 20, tool_type, status, project_id, favorite, search } = {}
) => {
  const offset = (page - 1) * limit;
  const params = [userId];
  const conds  = ['g.deleted_at IS NULL'];

  if (tool_type) { params.push(tool_type); conds.push(`g.tool_type = $${params.length}`); }
  if (status)    { params.push(status);    conds.push(`g.status = $${params.length}`); }
  if (project_id) {
    params.push(project_id);
    conds.push(`g.source_job_id = $${params.length}`);
  }
  if (favorite === true || favorite === 'true') {
    conds.push('g.is_favorite = true');
  }
  if (search) {
    params.push(`%${String(search).trim()}%`);
    conds.push(`(g.prompt ILIKE $${params.length} OR g.raw_prompt ILIKE $${params.length} OR g.enhanced_prompt ILIKE $${params.length})`);
  }

  const where = conds.length > 0 ? `AND ${conds.join(' AND ')}` : '';

  const result = await query(
    `${generationSelect}
     WHERE g.user_id = $1 ${where}
     ORDER BY g.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const count = await query(
    `SELECT COUNT(*)
     FROM ai_generations g
     WHERE g.user_id = $1 ${where}`,
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

const setGenerationFavorite = async (generationId, userId, isFavorite) => {
  const result = await query(
    `UPDATE ai_generations
     SET is_favorite = $1
     WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [Boolean(isFavorite), generationId, userId]
  );
  if (!result.rows[0]) throw new AppError('Generation not found', 404);
  return result.rows[0];
};

const deleteGenerations = async (generationIds, userId) => {
  const ids = Array.isArray(generationIds) ? generationIds.filter(Boolean) : [generationIds].filter(Boolean);
  if (!ids.length) throw new AppError('No generation IDs provided', 400);
  const result = await query(
    `UPDATE ai_generations
     SET deleted_at = NOW()
     WHERE user_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
     RETURNING id`,
    [userId, ids]
  );
  return { deleted: result.rows.map((row) => row.id), count: result.rowCount };
};

const publishGenerationPost = async (generationId, userId, payload = {}) => {
  const generation = await getGeneration(generationId, userId, 'client');
  if (generation.status !== 'completed' || !generation.result_url) {
    throw new AppError('Only completed image or video generations can be published', 400);
  }
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12)
    : [];
  const destinationPlatforms = Array.isArray(payload.destination_platforms)
    ? payload.destination_platforms.map((platform) => String(platform).trim()).filter(Boolean).slice(0, 10)
    : [];
  const contentType = generation.tool_type === 'video' ? 'video' : 'image';
  const result = await query(
    `INSERT INTO published_posts
       (user_id, generation_id, media_url, content_type, destination_platforms, caption, tags, share_generation_parameters, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'published')
     RETURNING *`,
    [
      userId,
      generationId,
      generation.result_url,
      contentType,
      destinationPlatforms,
      String(payload.caption || '').trim() || null,
      tags,
      Boolean(payload.share_generation_parameters),
    ]
  );
  return result.rows[0];
};

const getPublishedPosts = async (userId, { page = 1, limit = 20, search } = {}) => {
  const offset = (page - 1) * limit;
  const params = [userId];
  let searchSql = '';

  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    searchSql = `AND (
      pp.caption ILIKE $${params.length}
      OR EXISTS (
        SELECT 1
        FROM unnest(pp.tags) tag
        WHERE tag ILIKE $${params.length}
      )
    )`;
  }

  const result = await query(
    `SELECT pp.*
     FROM published_posts pp
     WHERE pp.user_id = $1
     ${searchSql}
     ORDER BY pp.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM published_posts pp
     WHERE pp.user_id = $1
     ${searchSql}`,
    params
  );

  return {
    posts: result.rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].count,
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

const deletePublishedPost = async (publishedPostId, userId) => {
  const result = await query(
    `DELETE FROM published_posts
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [publishedPostId, userId]
  );
  if (!result.rows[0]) {
    throw new AppError('Published post not found', 404);
  }
  return { deleted: true, id: result.rows[0].id };
};

const getUsageSummary = async (userId, filters = {}) => {
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

  const [membership, creditAccount] = await Promise.all([
    getMembershipTrialState(userId).catch(() => null),
    getCreditAccount(userId).catch(() => null),
  ]);
  const balance = Number(creditAccount?.balance || 0);
  const trialLimit = Math.max(0, Number(membership?.trial_image_generations_limit || TRIAL_IMAGE_GENERATIONS_LIMIT));
  const trialUsed = Math.max(0, Number(membership?.trial_image_generations_used || 0));
  const trialRemaining = membership?.status === 'trial'
    ? Math.max(0, trialLimit - trialUsed)
    : 0;

  const requestedModelId = filters.model_id || null;
  const requestedToolType = filters.tool_type || null;
  const requestedResolution = filters.resolution_tier || (requestedToolType === 'video' ? 'normal' : '1K');
  const requestedDuration = Number(filters.duration || 6);

  const selectedModel = requestedModelId
    ? await query('SELECT * FROM ai_models WHERE id = $1 AND is_active = true', [requestedModelId]).then((r) => r.rows[0] || null)
    : null;

  const fallbackImageModel = await query(
    `SELECT *
     FROM ai_models
     WHERE is_active = true AND 'image' = ANY(supported_tools)
     ORDER BY
       COALESCE((mintcoin_costs->>'1K')::numeric, (mintcoin_costs->>'2K')::numeric, (mintcoin_costs->>'4K')::numeric, 999999) ASC,
       sort_order ASC,
       name ASC
     LIMIT 1`
  ).then((r) => r.rows[0] || null);

  const fallbackVideoModel = await query(
    `SELECT *
     FROM ai_models
     WHERE is_active = true AND 'video' = ANY(supported_tools)
     ORDER BY
       COALESCE((mintcoin_costs->>'normal')::numeric, (mintcoin_costs->>'1K')::numeric, 999999) ASC,
       sort_order ASC,
       name ASC
     LIMIT 1`
  ).then((r) => r.rows[0] || null);

  const imageModel = selectedModel && selectedModel.supported_tools?.includes('image')
    ? selectedModel
    : fallbackImageModel;
  const videoModel = selectedModel && selectedModel.supported_tools?.includes('video')
    ? selectedModel
    : fallbackVideoModel;

  const imageCostPerGeneration = imageModel
    ? modelResolutionCost(imageModel, requestedResolution === 'normal' ? '1K' : requestedResolution)
    : 0;
  const videoCostPerGeneration = videoModel
    ? modelResolutionCost(videoModel, requestedResolution)
    : 0;

  const imageCoinGenerationsLeft = imageCostPerGeneration > 0
    ? Math.floor(balance / imageCostPerGeneration)
    : null;
  const videoCoinGenerationsLeft = videoCostPerGeneration > 0
    ? Math.floor(balance / videoCostPerGeneration)
    : null;

  return {
    ...result.rows[0],
    mintcoin_balance: balance,
    trial: {
      active: Boolean(membership?.status === 'trial'),
      used: trialUsed,
      limit: trialLimit,
      remaining: trialRemaining,
    },
    selected: {
      model_id: selectedModel?.id || null,
      model_name: selectedModel?.name || null,
      tool_type: requestedToolType,
      resolution_tier: requestedResolution,
      duration: requestedDuration,
      image_cost: imageCostPerGeneration,
      video_cost: videoCostPerGeneration,
      image_generations_left: imageCostPerGeneration > 0 ? trialRemaining + imageCoinGenerationsLeft : null,
      video_generations_left: videoCostPerGeneration > 0 ? videoCoinGenerationsLeft : null,
      image_unlimited: imageCostPerGeneration === 0,
      video_unlimited: videoCostPerGeneration === 0,
      text_free: true,
    },
    capacity: {
      text_free: true,
      image: {
        free_trials_remaining: trialRemaining,
        coin_generations_left: imageCoinGenerationsLeft,
        cost_per_generation: imageCostPerGeneration,
        unlimited: imageCostPerGeneration === 0,
      },
      video: {
        coin_generations_left: videoCoinGenerationsLeft,
        cost_per_generation: videoCostPerGeneration,
        unlimited: videoCostPerGeneration === 0,
      },
    },
    rate_limit: {
      limit:     env.ai.maxRequestsPerHour,
      used:      parseInt(result.rows[0].this_hour, 10),
      remaining: Math.max(0, env.ai.maxRequestsPerHour - parseInt(result.rows[0].this_hour, 10)),
    },
  };
};
const generateOnboardingTopics = async (payload) => {
  const { business_name, business_type, description, preferred_language, address_state, festival_mode } = payload;
  
  // Fetch upcoming festivals from the DB (next 35 days)
  let upcomingFestivals = [];
  try {
    const res = await query(`
      SELECT id, title, description, event_date 
      FROM creative_events 
      WHERE event_date >= CURRENT_DATE 
        AND event_date <= CURRENT_DATE + interval '35 days'
        AND status = 'active'
      ORDER BY event_date ASC
    `);
    upcomingFestivals = res.rows;
  } catch (err) {
    logger.error('Failed to fetch upcoming festivals for AI:', err);
  }

  const systemPrompt = "You are an expert social media content strategist. Output strictly valid JSON format. Make sure all strings are enclosed in double quotes.";
  
  const prompt = `Create a 15-topic content strategy for a business with the following details:
Business Name: ${business_name || 'My Business'}
Industry/Type: ${business_type || 'Retail'}
Customer Profile/Description: ${description || 'General audience'}
Language: ${preferred_language || 'English'}
Region/State: ${address_state || 'India'}
Festival Mode: ${festival_mode || 'autopilot'}

We have the following upcoming festivals in the next 35 days:
${upcomingFestivals.map(f => `- ${f.title} (${f.event_date.toISOString().split('T')[0]}): ${f.description || ''} [ID: ${f.id}]`).join('\n') || 'None'}

Your task:
1. Select up to 5 MOST RELEVANT festivals for this business based on their region and industry (if Festival Mode is autopilot). If manual, you can still recommend them.
2. Generate highly engaging brand-specific topics for the remaining slots to make exactly 15 topics in total.
3. Every topic must have a "type" field: either "festival" or "brand".
4. If it's a festival, include the "festival_id" and "date" exactly as provided above.
5. Keep titles punchy and descriptions clear (1-2 sentences).

CRITICAL: Return ONLY a raw JSON array of 15 objects. Ensure all keys and string values are enclosed in double quotes. Do not include markdown code blocks.
Example Format:
[
  { "title": "Top 5 benefits of our service", "desc": "Educational carousel highlighting key advantages.", "type": "brand" },
  { "title": "Happy Diwali", "desc": "Wishing our customers a bright and prosperous Diwali.", "type": "festival", "festival_id": "uuid-here", "date": "2026-11-12" }
]`;

  const response = await generateText('openrouter/free', prompt, { max_tokens: 2000, temperature: 0.7 }, systemPrompt);
  
  try {
    let rawContent = (response.text || '').trim();
    if (rawContent.startsWith('```json')) {
      rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(rawContent);
  } catch (error) {
    logger.error('Failed to parse onboarding AI topics:', error);
    // Fallback if AI messes up the JSON formatting completely
    return [
      { title: `Top 5 benefits of our ${business_type || 'service'}`, desc: 'Educational carousel highlighting key advantages.', type: 'brand' },
      { title: `Behind the scenes at ${business_name || 'our company'}`, desc: 'Showcasing our workspace and team.', type: 'brand' },
      { title: `Customer Success Story`, desc: 'Sharing a glowing review from a happy client.', type: 'brand' },
      { title: `Did you know? (Industry Fact)`, desc: 'An interesting fact about your industry.', type: 'brand' },
      { title: `How to choose the right ${business_type || 'product'}`, desc: 'A buyer\'s guide style post.', type: 'brand' },
      { title: `Common misconceptions`, desc: 'Busting popular myths.', type: 'brand' },
      { title: `Product Spotlight`, desc: 'Focusing on your top offering.', type: 'brand' },
      { title: `A day in the life`, desc: 'Personal branding and connection.', type: 'brand' },
      { title: `Why we started`, desc: 'Sharing your origin story.', type: 'brand' },
      { title: `Quick tips`, desc: 'Value-driven instructional content.', type: 'brand' },
      { title: `Sneak peek`, desc: 'Building excitement for the future.', type: 'brand' },
      { title: `FAQ`, desc: 'Addressing common customer queries.', type: 'brand' },
      { title: `Weekend Motivation`, desc: 'A light-hearted inspirational quote.', type: 'brand' },
      { title: `Industry Trends`, desc: 'Educational deep-dive into your niche.', type: 'brand' },
      { title: `Flash Sale Announcement`, desc: 'Promotional content to drive immediate sales.', type: 'brand' }
    ];
  }
};

module.exports = {
  AI_PROGRESS_CHANNEL,
  generateOnboardingTopics,
  createGeneration,
  processGeneration,
  getEngineModels,
  getStylePresets,
  uploadReferenceAsset,
  createEngineImageGeneration,
  createEngineVideoGeneration,
  getGeneration,
  getMyGenerations,
  setGenerationFavorite,
  deleteGenerations,
  publishGenerationPost,
  getPublishedPosts,
  deletePublishedPost,
  getUsageSummary,
  bustModelCache,
};
