const { query } = require('../../../config/database');
const logger = require('../../../utils/logger');

// Simple in-memory cache — refreshed every 5 minutes
let modelCache     = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
const userPrice = (model) => Number(model.user_price_per_1k_tokens ?? model.cost_per_1k_tokens ?? 0);
const normalizeEnumArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.startsWith('{') || !value.endsWith('}')) return [];
  return value
    .slice(1, -1)
    .split(',')
    .map((item) => item.replace(/^"|"$/g, '').trim())
    .filter(Boolean);
};
const normalizeTextArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  if (value.startsWith('{') && value.endsWith('}')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  return [];
};
const normalizeJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (_) { return {}; }
  }
  return {};
};
const normalizeModel = (model) => ({
  ...model,
  supported_tools: normalizeEnumArray(model.supported_tools),
  tags: normalizeTextArray(model.tags),
  best_for: normalizeTextArray(model.best_for),
  is_unlimited_tier: normalizeJsonObject(model.is_unlimited_tier),
  avg_latency_seconds: model.avg_latency_seconds == null ? null : Number(model.avg_latency_seconds),
});

/**
 * Get all active models from DB (cached).
 */
const getAllModels = async () => {
  if (modelCache && Date.now() < cacheExpiresAt) {
    return modelCache;
  }

  const result = await query(
    `SELECT * FROM ai_models
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`
  );

  modelCache     = result.rows.map(normalizeModel);
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return modelCache;
};

/**
 * Bust the cache — called after admin adds/edits a model.
 */
const bustModelCache = () => {
  modelCache     = null;
  cacheExpiresAt = 0;
};

const getModelById = async (id) => {
  const models = await getAllModels();
  return models.find((m) => m.id === id) || null;
};

const getModelByOpenRouterId = async (openrouterId) => {
  const models = await getAllModels();
  return models.find((m) => m.openrouter_id === openrouterId) || null;
};

const getModelsByToolType = async (toolType) => {
  const models = await getAllModels();
  return models.filter((m) => m.supported_tools?.includes(toolType));
};

const getTrendingModels = async (toolType) => {
  const models = await getAllModels();
  return models.filter(
    (m) => m.is_trending && (!toolType || m.supported_tools?.includes(toolType))
  );
};

const getFreeModels = async (toolType) => {
  const models = await getAllModels();
  return models.filter(
    (m) =>
      m.tier === 'free' &&
      userPrice(m) === 0 &&
      (!toolType || m.supported_tools?.includes(toolType))
  );
};

module.exports = {
  getAllModels,
  bustModelCache,
  getModelById,
  getModelByOpenRouterId,
  getModelsByToolType,
  getTrendingModels,
  getFreeModels,
};
