const { Router } = require('express');
const controller = require('./ai.controller');
const { authenticate } = require('../../middleware/authenticate');
const { requireEntitlement } = require('../../middleware/permissions');

const router = Router();

router.use(authenticate);

// ── Model Discovery ───────────────────────────────────────────────────────────

// GET  /api/v1/ai/models                         — all models + live traffic
router.get('/models', controller.getModels);

// GET  /api/v1/ai/models/:modelId/traffic        — single model live traffic
router.get('/models/:modelId/traffic', controller.getSingleModelTraffic);

// ── Generation ────────────────────────────────────────────────────────────────

// POST /api/v1/ai/generate                       — create generation (all tools)
router.post('/generate', requireEntitlement('can_use_ai'), controller.generate);

// GET  /api/v1/ai/generations                    — history
router.get('/generations', controller.getMyGenerations);

// GET  /api/v1/ai/generations/:generationId      — single generation result
router.get('/generations/:generationId', controller.getGeneration);

// GET  /api/v1/ai/usage                          — credits + rate limit summary
router.get('/usage', controller.getUsageSummary);

module.exports = router;
