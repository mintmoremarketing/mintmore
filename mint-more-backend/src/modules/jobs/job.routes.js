const { Router } = require('express');
const controller  = require('./job.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireApproved }         = require('../../middleware/requireApproved');

const router = Router();

router.use(authenticate);

// ── Client ────────────────────────────────────────────────────────────────────

// POST /jobs
// Create job as 'open' immediately — matching auto-triggers
router.post(
  '/',
  authorize('client'),
  requireApproved,
  controller.createJob
);

// POST /jobs/draft
// Create job as 'draft' — matching triggers on publish
router.post(
  '/draft',
  authorize('client'),
  requireApproved,
  controller.createJobAsDraft
);

// PATCH /jobs/:id/publish
// Publish draft → 'open' — matching auto-triggers
router.patch(
  '/:id/publish',
  authorize('client'),
  requireApproved,
  controller.publishJob
);

// PATCH /jobs/:id/pause-matching
router.patch(
  '/:id/pause-matching',
  authorize('client'),
  requireApproved,
  controller.pauseMatching
);

// PATCH /jobs/:id
// Update draft fields
router.patch(
  '/:id',
  authorize('client'),
  requireApproved,
  controller.updateJob
);

// PATCH /jobs/:id/cancel
router.patch(
  '/:id/cancel',
  requireApproved,
  controller.cancelJob
);

// GET /jobs/my/summary
// Client job status counts
router.get(
  '/my/summary',
  authorize('client'),
  controller.getClientJobSummary
);

// ── Shared (role-filtered in service) ────────────────────────────────────────

// GET /jobs
// - admin: all jobs
// - client: own jobs
// - freelancer: only matched jobs
router.get(
  '/',
  requireApproved,
  controller.listJobs
);

// GET /jobs/:id
// - admin: any job
// - client: own job only
// - freelancer: only if matched → else 404
router.get(
  '/:id',
  requireApproved,
  controller.getJobById
);

// ── Admin ─────────────────────────────────────────────────────────────────────

router.get(
  '/admin/all',
  authorize('admin'),
  controller.adminListAllJobs
);

router.patch(
  '/admin/:id/status',
  authorize('admin'),
  controller.adminUpdateJobStatus
);

module.exports = router;
