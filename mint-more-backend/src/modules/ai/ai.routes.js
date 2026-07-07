const { Router } = require('express');
const controller = require('./ai.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireEntitlement, requirePermission } = require('../../middleware/permissions');
const { upload, handleUploadError } = require('../../middleware/upload');

const router = Router();

router.use(authenticate);

// ── Model Discovery ───────────────────────────────────────────────────────────

// GET  /api/v1/ai/models                         — all models + live traffic
router.get('/models', controller.getModels);

// GET  /api/v1/ai/models/:modelId/traffic        — single model live traffic
router.get('/models/:modelId/traffic', controller.getSingleModelTraffic);

router.get('/engine/models', requireEntitlement('can_use_ai'), controller.getEngineModels);
router.get('/engine/styles', requireEntitlement('can_use_ai'), controller.getStylePresets);
router.post(
  '/engine/references',
  requireEntitlement('can_use_ai'),
  handleUploadError(upload.single('file')),
  controller.uploadReference
);
router.post('/engine/image/generate', requireEntitlement('can_use_ai'), controller.generateEngineImage);

// ── Generation ────────────────────────────────────────────────────────────────

// POST /api/v1/ai/generate                       — create generation (all tools)
router.post('/generate', requireEntitlement('can_use_ai'), controller.generate);

// GET  /api/v1/ai/generations                    — history
router.get('/generations', controller.getMyGenerations);

// GET  /api/v1/ai/generations/:generationId      — single generation result
router.get('/generations/:generationId', controller.getGeneration);

// GET  /api/v1/ai/usage                          — credits + rate limit summary
router.get('/usage', controller.getUsageSummary);

router.get('/admin/stats', authorize('admin'), requirePermission('pricing.manage'), controller.adminGetAIStats);
router.get('/admin/models/:modelId/stats', authorize('admin'), requirePermission('pricing.manage'), controller.adminGetModelStats);
router.get('/admin/openrouter/browse', authorize('admin'), requirePermission('pricing.manage'), controller.adminBrowseOpenRouterModels);
router.post('/admin/models', authorize('admin'), requirePermission('pricing.manage'), controller.adminAddModel);
router.patch('/admin/models/:modelId', authorize('admin'), requirePermission('pricing.manage'), controller.adminUpdateModel);
router.patch('/admin/models/:modelId/toggle', authorize('admin'), requirePermission('pricing.manage'), controller.adminToggleModel);

module.exports = router;
