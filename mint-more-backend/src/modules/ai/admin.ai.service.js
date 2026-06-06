const { query }   = require('../../config/database');
const { fetchOpenRouterModels } = require('./providers/openrouter.provider');
const { bustModelCache }        = require('./models/model.registry');
const { getAllModelTraffic }     = require('./models/model.traffic');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');

// ── Model CRUD ────────────────────────────────────────────────────────────────

/**
 * Browse all available models from OpenRouter.
 * Admin uses this to discover and add new models.
 */
const browseOpenRouterModels = async () => {
  const models = await fetchOpenRouterModels();
  // Mark which ones are already in our DB
  const existing = await query('SELECT openrouter_id FROM ai_models');
  const existingIds = new Set(existing.rows.map((r) => r.openrouter_id));

  return models.map((m) => ({
    ...m,
    already_added: existingIds.has(m.openrouter_id),
  }));
};

/**
 * Add a model to the platform.
 * Admin fills in the details from the browse list or manually.
 */
const addModel = async (adminId, data) => {
  const {
    openrouter_id, name, description, provider_name,
    supported_tools, tier, cost_per_1k_tokens,
    provider_cost_per_1k_tokens, user_price_per_1k_tokens,
    failover_model_id, resolution_labels, margin_alert_below_pct,
    context_window, tags, is_trending, sort_order,
    system_prompts,
  } = data;

  if (!openrouter_id || !name) {
    throw new AppError('openrouter_id and name are required', 400);
  }

  const result = await query(
    `INSERT INTO ai_models
       (openrouter_id, name, description, provider_name,
        supported_tools, tier, cost_per_1k_tokens,
        provider_cost_per_1k_tokens, user_price_per_1k_tokens,
        failover_model_id, resolution_labels, margin_alert_below_pct,
        context_window, tags, is_trending, sort_order,
        system_prompts, added_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (openrouter_id) DO UPDATE SET
       name                = EXCLUDED.name,
       description         = EXCLUDED.description,
       provider_name       = EXCLUDED.provider_name,
       supported_tools     = EXCLUDED.supported_tools,
       tier                = EXCLUDED.tier,
       cost_per_1k_tokens  = EXCLUDED.cost_per_1k_tokens,
       provider_cost_per_1k_tokens = EXCLUDED.provider_cost_per_1k_tokens,
       user_price_per_1k_tokens = EXCLUDED.user_price_per_1k_tokens,
       failover_model_id   = EXCLUDED.failover_model_id,
       resolution_labels   = EXCLUDED.resolution_labels,
       margin_alert_below_pct = EXCLUDED.margin_alert_below_pct,
       context_window      = EXCLUDED.context_window,
       tags                = EXCLUDED.tags,
       is_trending         = EXCLUDED.is_trending,
       sort_order          = EXCLUDED.sort_order,
       system_prompts      = EXCLUDED.system_prompts,
       is_active           = true
     RETURNING *`,
    [
      openrouter_id, name, description || null, provider_name || null,
      supported_tools || ['text'],
      tier || 'free',
      parseFloat(user_price_per_1k_tokens ?? cost_per_1k_tokens ?? 0),
      parseFloat(provider_cost_per_1k_tokens || 0),
      parseFloat(user_price_per_1k_tokens ?? cost_per_1k_tokens ?? 0),
      failover_model_id || null,
      resolution_labels || [],
      parseFloat(margin_alert_below_pct ?? 20),
      context_window || 8192,
      tags || [],
      is_trending || false,
      sort_order || 0,
      JSON.stringify(system_prompts || {}),
      adminId,
    ]
  );

  bustModelCache();
  logger.info('AI model added', { openrouter_id, adminId });
  return result.rows[0];
};

/**
 * Update model settings — admin can change pricing, tools, prompts, toggle active.
 */
const updateModel = async (modelId, adminId, updates) => {
  const allowed = [
    'name', 'description', 'supported_tools', 'tier',
    'cost_per_1k_tokens', 'provider_cost_per_1k_tokens', 'user_price_per_1k_tokens',
    'failover_model_id', 'resolution_labels', 'margin_alert_below_pct', 'tags', 'is_trending',
    'is_active', 'sort_order', 'system_prompts', 'context_window',
  ];

  const normalizedUpdates = { ...updates };
  if (
    normalizedUpdates.cost_per_1k_tokens !== undefined &&
    normalizedUpdates.user_price_per_1k_tokens === undefined
  ) {
    normalizedUpdates.user_price_per_1k_tokens = normalizedUpdates.cost_per_1k_tokens;
  }
  if (normalizedUpdates.user_price_per_1k_tokens !== undefined) {
    normalizedUpdates.cost_per_1k_tokens = normalizedUpdates.user_price_per_1k_tokens;
  }
  const fields = Object.keys(normalizedUpdates).filter((k) => allowed.includes(k));
  if (fields.length === 0) throw new AppError('No valid fields to update', 400);

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`);
  const values     = fields.map((f) => normalizedUpdates[f]);

  const result = await query(
    `UPDATE ai_models
     SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING *`,
    [modelId, ...values]
  );

  if (!result.rows[0]) throw new AppError('Model not found', 404);

  bustModelCache();
  logger.info('AI model updated', { modelId, adminId, fields });
  return result.rows[0];
};

/**
 * Toggle a model active/inactive.
 */
const toggleModel = async (modelId, adminId) => {
  const result = await query(
    `UPDATE ai_models SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
    [modelId]
  );
  if (!result.rows[0]) throw new AppError('Model not found', 404);
  bustModelCache();
  return result.rows[0];
};

// ── Admin Analytics ───────────────────────────────────────────────────────────

/**
 * Full AI dashboard for admin.
 * Shows: total usage, per-model breakdown, per-tool breakdown,
 * top users, live traffic, error rates.
 */
const getAdminAIStats = async ({ days = 7 } = {}) => {
  const [
    overallStats,
    perModelStats,
    perToolStats,
    topUsers,
    recentFailures,
    allModels,
  ] = await Promise.all([
    // Overall platform stats
    query(
      `SELECT
         COUNT(*)                                              AS total_generations,
         COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')            AS failed,
         COUNT(*) FILTER (WHERE used_failover = true)         AS used_failover,
         COALESCE(SUM(credits_used), 0)                       AS total_credits_consumed,
         COALESCE(SUM(tokens_input + tokens_output), 0)       AS total_tokens,
         COALESCE(AVG(duration_ms) FILTER (WHERE status = 'completed'), 0)::INTEGER AS avg_duration_ms,
         COUNT(DISTINCT user_id)                              AS unique_users
       FROM ai_generations
       WHERE created_at > NOW() - INTERVAL '${days} days'`
    ),

    // Per-model breakdown
    query(
      `SELECT
         g.openrouter_id,
         g.model_name,
         m.tier,
         m.cost_per_1k_tokens,
         m.provider_cost_per_1k_tokens,
         m.user_price_per_1k_tokens,
         m.is_active,
         COUNT(*)                                              AS total_requests,
         COUNT(*) FILTER (WHERE g.status = 'completed')       AS completed,
         COUNT(*) FILTER (WHERE g.status = 'failed')          AS failed,
         COALESCE(SUM(g.credits_used), 0)                     AS credits_consumed,
         COALESCE(SUM(g.tokens_input + g.tokens_output), 0)   AS total_tokens,
         COALESCE(AVG(g.duration_ms) FILTER (WHERE g.status = 'completed'), 0)::INTEGER AS avg_ms,
         ROUND(
           COUNT(*) FILTER (WHERE g.status = 'failed')::NUMERIC /
           NULLIF(COUNT(*), 0) * 100, 1
         ) AS error_rate_pct
       FROM ai_generations g
       LEFT JOIN ai_models m ON m.id = g.ai_model_id
       WHERE g.created_at > NOW() - INTERVAL '${days} days'
       GROUP BY g.openrouter_id, g.model_name, m.tier, m.cost_per_1k_tokens,
                m.provider_cost_per_1k_tokens, m.user_price_per_1k_tokens, m.is_active
       ORDER BY total_requests DESC`
    ),

    // Per-tool type breakdown
    query(
      `SELECT
         tool_type,
         COUNT(*)                                        AS total_requests,
         COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
         COALESCE(SUM(credits_used), 0)                 AS credits_consumed,
         COUNT(DISTINCT user_id)                        AS unique_users
       FROM ai_generations
       WHERE created_at > NOW() - INTERVAL '${days} days'
       GROUP BY tool_type
       ORDER BY total_requests DESC`
    ),

    // Top users by usage
    query(
      `SELECT
         u.full_name, u.email, u.role,
         COUNT(g.id)                                    AS total_generations,
         COALESCE(SUM(g.credits_used), 0)               AS credits_spent,
         COALESCE(SUM(g.tokens_input + g.tokens_output), 0) AS tokens_used,
         COUNT(g.id) FILTER (WHERE g.created_at > NOW() - INTERVAL '1 day') AS today_count
       FROM ai_generations g
       JOIN users u ON u.id = g.user_id
       WHERE g.created_at > NOW() - INTERVAL '${days} days'
       GROUP BY u.id, u.full_name, u.email, u.role
       ORDER BY total_generations DESC
       LIMIT 10`
    ),

    // Recent failures (for debugging)
    query(
      `SELECT
         g.id, g.openrouter_id, g.model_name, g.tool_type,
         g.error_message, g.created_at,
         u.email AS user_email
       FROM ai_generations g
       JOIN users u ON u.id = g.user_id
       WHERE g.status = 'failed'
         AND g.created_at > NOW() - INTERVAL '24 hours'
       ORDER BY g.created_at DESC
       LIMIT 20`
    ),

    // All models with DB stats
    query(
      `SELECT * FROM ai_models ORDER BY sort_order ASC, name ASC`
    ),
  ]);

  // Get live Redis traffic for all models
  const modelIds    = allModels.rows.map((m) => m.openrouter_id);
  const trafficMap  = await getAllModelTraffic(modelIds);

  const modelsWithLive = allModels.rows.map((m) => ({
    ...m,
    live_traffic: trafficMap[m.openrouter_id] || null,
  }));

  return {
    period_days:     days,
    overall:         overallStats.rows[0],
    per_model:       perModelStats.rows,
    per_tool:        perToolStats.rows,
    top_users:       topUsers.rows,
    recent_failures: recentFailures.rows,
    models:          modelsWithLive,
  };
};

/**
 * Get detailed stats for a single model.
 */
const getModelStats = async (modelId, { days = 7 } = {}) => {
  const [model, stats, dailyBreakdown] = await Promise.all([
    query('SELECT * FROM ai_models WHERE id = $1', [modelId]),

    query(
      `SELECT
         COUNT(*)                                              AS total_requests,
         COUNT(*) FILTER (WHERE status = 'completed')         AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')            AS failed,
         COUNT(*) FILTER (WHERE used_failover = true)         AS times_as_failover,
         COALESCE(SUM(credits_used), 0)                       AS total_credits,
         COALESCE(SUM(tokens_input), 0)                       AS total_input_tokens,
         COALESCE(SUM(tokens_output), 0)                      AS total_output_tokens,
         COALESCE(AVG(duration_ms) FILTER (WHERE status='completed'), 0)::INTEGER AS avg_ms,
         COUNT(DISTINCT user_id)                              AS unique_users
       FROM ai_generations
       WHERE ai_model_id = $1
         AND created_at > NOW() - INTERVAL '${days} days'`,
      [modelId]
    ),

    query(
      `SELECT
         DATE(created_at) AS date,
         COUNT(*)         AS requests,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'failed')    AS failed
       FROM ai_generations
       WHERE ai_model_id = $1
         AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [modelId]
    ),
  ]);

  if (!model.rows[0]) throw new AppError('Model not found', 404);

  const { getAllModelTraffic: getTraffic } = require('./models/model.traffic');
  const traffic = await getTraffic([model.rows[0].openrouter_id]);

  return {
    model:           model.rows[0],
    stats:           stats.rows[0],
    daily_breakdown: dailyBreakdown.rows,
    live_traffic:    traffic[model.rows[0].openrouter_id],
  };
};

module.exports = {
  browseOpenRouterModels,
  addModel,
  updateModel,
  toggleModel,
  getAdminAIStats,
  getModelStats,
};
