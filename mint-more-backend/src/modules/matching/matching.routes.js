const { Router } = require('express');
const controller = require('./matching.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();

// All matching routes — admin only
router.use(authenticate, authorize('admin'), requirePermission('matching.manage'));

// POST  /api/v1/matching/jobs/:jobId/run      — run matching engine
router.post('/jobs/:jobId/run', controller.runMatching);

// GET   /api/v1/matching/jobs/:jobId/preview  — preview without status change
router.get('/jobs/:jobId/preview', controller.previewMatching);

// GET   /api/v1/matching/jobs/:jobId/pool     — full scored freelancer pool
router.get('/jobs/:jobId/pool', controller.getFreelancerPool);

module.exports = router;
