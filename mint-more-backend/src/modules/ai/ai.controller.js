const aiService      = require('./ai.service');
const adminAIService = require('./admin.ai.service');
const { validateGenerateRequest } = require('./ai.validator');
const {
  getAllModels, getModelById, getModelsByToolType, getTrendingModels,
} = require('./models/model.registry');
const { getAllModelTraffic, getModelTraffic } = require('./models/model.traffic');
const { fetchOpenRouterVideoModels } = require('./providers/openrouter.provider');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');

// ── Model Discovery ───────────────────────────────────────────────────────────

const getModels = async (req, res, next) => {
  try {
    const { tool_type } = req.query;
    const models  = tool_type
      ? await getModelsByToolType(tool_type)
      : await getAllModels();

    const trafficMap = await getAllModelTraffic(models.map((m) => m.openrouter_id));
    const videoCapabilities = models.some((m) => m.supported_tools?.includes('video'))
      ? await fetchOpenRouterVideoModels()
      : [];
    const videoCapabilityMap = Object.fromEntries(
      videoCapabilities.map((model) => [model.id, model])
    );

    const enriched = models.map((m) => ({
      ...m,
      traffic: trafficMap[m.openrouter_id] || null,
      video_capabilities: videoCapabilityMap[m.openrouter_id] || null,
    }));

    enriched.sort((a, b) => {
      if (a.tier === 'free' && b.tier !== 'free') return -1;
      if (a.tier !== 'free' && b.tier === 'free') return 1;
      return (a.traffic?.load_percentage || 0) - (b.traffic?.load_percentage || 0);
    });

    const trending = await getTrendingModels(tool_type);

    return sendSuccess(res, {
      data: { models: enriched, trending, total: enriched.length },
    });
  } catch (err) { next(err); }
};

const getSingleModelTraffic = async (req, res, next) => {
  try {
    const model = await getModelById(req.params.modelId);
    if (!model) throw new AppError('Model not found or inactive', 404);
    const traffic = await getModelTraffic(model.openrouter_id);
    return sendSuccess(res, { data: { traffic } });
  } catch (err) { next(err); }
};

// ── Generation ────────────────────────────────────────────────────────────────

const generate = async (req, res, next) => {
  try {
    validateGenerateRequest(req.body);
    const result = await aiService.createGeneration(req.user.sub, req.body);
    return sendSuccess(res, {
      data:       result,
      message:    'Generation queued. Connect to the SSE stream for live progress.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const getGeneration = async (req, res, next) => {
  try {
    const gen = await aiService.getGeneration(
      req.params.generationId, req.user.sub, req.user.role
    );
    return sendSuccess(res, { data: { generation: gen } });
  } catch (err) { next(err); }
};

const getMyGenerations = async (req, res, next) => {
  try {
    const { page, limit, tool_type, status } = req.query;
    const result = await aiService.getMyGenerations(req.user.sub, {
      page:  parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      tool_type, status,
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getUsageSummary = async (req, res, next) => {
  try {
    const summary = await aiService.getUsageSummary(req.user.sub);
    return sendSuccess(res, { data: { usage: summary } });
  } catch (err) { next(err); }
};

const getEngineModels = async (req, res, next) => {
  try {
    const result = await aiService.getEngineModels(req.user.sub, {
      tool_type: req.query.tool_type || 'image',
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getStylePresets = async (req, res, next) => {
  try {
    const styles = await aiService.getStylePresets();
    return sendSuccess(res, { data: { styles } });
  } catch (err) { next(err); }
};

const uploadReference = async (req, res, next) => {
  try {
    const asset = await aiService.uploadReferenceAsset(req.user.sub, {
      file: req.file,
      sessionId: req.body.session_id,
      projectId: req.body.project_id || null,
    });
    return sendSuccess(res, {
      data: { asset },
      message: 'Reference uploaded',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const generateEngineImage = async (req, res, next) => {
  try {
    const result = await aiService.createEngineImageGeneration(req.user.sub, req.body);
    return sendSuccess(res, {
      data: result,
      message: 'Image generation queued. Connect to the SSE stream for live progress.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

// ── Admin Controllers ─────────────────────────────────────────────────────────

const adminGetAIStats = async (req, res, next) => {
  try {
    const { days } = req.query;
    const stats = await adminAIService.getAdminAIStats({
      days: parseInt(days, 10) || 7,
    });
    return sendSuccess(res, { data: stats });
  } catch (err) { next(err); }
};

const adminGetModelStats = async (req, res, next) => {
  try {
    const { days } = req.query;
    const stats = await adminAIService.getModelStats(req.params.modelId, {
      days: parseInt(days, 10) || 7,
    });
    return sendSuccess(res, { data: stats });
  } catch (err) { next(err); }
};

const adminBrowseOpenRouterModels = async (req, res, next) => {
  try {
    const models = await adminAIService.browseOpenRouterModels();
    return sendSuccess(res, { data: { models, total: models.length } });
  } catch (err) { next(err); }
};

const adminAddModel = async (req, res, next) => {
  try {
    const model = await adminAIService.addModel(req.user.sub, req.body);
    return sendSuccess(res, {
      data:       { model },
      message:    `Model "${model.name}" added successfully`,
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const adminUpdateModel = async (req, res, next) => {
  try {
    const model = await adminAIService.updateModel(
      req.params.modelId, req.user.sub, req.body
    );
    return sendSuccess(res, {
      data:    { model },
      message: 'Model updated',
    });
  } catch (err) { next(err); }
};

const adminToggleModel = async (req, res, next) => {
  try {
    const model = await adminAIService.toggleModel(req.params.modelId, req.user.sub);
    return sendSuccess(res, {
      data:    { model },
      message: `Model ${model.is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) { next(err); }
};

module.exports = {
  getModels,
  getSingleModelTraffic,
  generate,
  getEngineModels,
  getStylePresets,
  uploadReference,
  generateEngineImage,
  getGeneration,
  getMyGenerations,
  getUsageSummary,
  adminGetAIStats,
  adminGetModelStats,
  adminBrowseOpenRouterModels,
  adminAddModel,
  adminUpdateModel,
  adminToggleModel,
};
