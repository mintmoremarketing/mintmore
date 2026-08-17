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
router.post('/engine/video/generate', requireEntitlement('can_use_ai'), controller.generateEngineVideo);

// ── Generation ────────────────────────────────────────────────────────────────

// POST /api/v1/ai/generate                       — create generation (all tools)
router.post('/generate', requireEntitlement('can_use_ai'), controller.generate);

// POST /api/v1/ai/onboarding-topics              — generate 15 topics for onboarding
router.post('/onboarding-topics', controller.generateOnboardingTopics);

// POST /api/v1/ai/extract-website                — auto-fill onboarding info from URL
router.post('/extract-website', controller.extractWebsite);

// POST /api/v1/ai/generate-tone-preview          — generate live tone preview for custom tone
router.post('/generate-tone-preview', controller.generateTonePreview);

// GET  /api/v1/ai/generations                    — history
router.get('/generations', controller.getMyGenerations);
router.get('/published-posts', controller.getPublishedPosts);
router.patch('/generations/:generationId/favorite', controller.favoriteGeneration);
router.delete('/generations', controller.deleteGenerations);
router.delete('/generations/:generationId', controller.deleteGenerations);
router.post('/generations/:generationId/publish', controller.publishGenerationPost);
router.delete('/published-posts/:publishedPostId', controller.deletePublishedPost);

// GET  /api/v1/ai/generations/:generationId      — single generation result
router.get('/generations/:generationId', controller.getGeneration);

// GET  /api/v1/ai/usage                          — credits + rate limit summary
router.get('/usage', controller.getUsageSummary);

router.get('/admin/stats', authorize('admin'), requirePermission('pricing.manage'), controller.adminGetAIStats);
router.get('/admin/models/:modelId/stats', authorize('admin'), requirePermission('pricing.manage'), controller.adminGetModelStats);
router.get('/admin/openrouter/browse', authorize('admin'), requirePermission('pricing.manage'), controller.adminBrowseOpenRouterModels);
router.post('/admin/openrouter/sync', authorize('admin'), requirePermission('pricing.manage'), controller.adminSyncOpenRouterModels);
router.post('/admin/models', authorize('admin'), requirePermission('pricing.manage'), controller.adminAddModel);
router.patch('/admin/models/:modelId', authorize('admin'), requirePermission('pricing.manage'), controller.adminUpdateModel);
router.patch('/admin/models/:modelId/toggle', authorize('admin'), requirePermission('pricing.manage'), controller.adminToggleModel);
router.delete('/admin/models/:modelId', authorize('admin'), requirePermission('pricing.manage'), controller.adminDeleteModel);

module.exports = router;
