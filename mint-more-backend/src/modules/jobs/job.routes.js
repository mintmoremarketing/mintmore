const { Router } = require('express');
const controller  = require('./job.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireApproved }         = require('../../middleware/requireApproved');
const { requireEntitlement, requirePermission } = require('../../middleware/permissions');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();

router.use(authenticate);

// ── Client ────────────────────────────────────────────────────────────────────

// POST /jobs
// Create job as 'open' immediately — matching auto-triggers
router.post(
  '/',
  authorize('client'),
  requireFeatureFlag('freelancer_matching'),
  requireApproved,
  requireEntitlement('can_create_job'),
  controller.createJob
);

// POST /jobs/draft
// Create job as 'draft' — matching triggers on publish
router.post(
  '/draft',
  authorize('client'),
  requireEntitlement('can_draft_job'),
  controller.createJobAsDraft
);

// PATCH /jobs/:id/publish
// Publish draft → 'open' — matching auto-triggers
router.patch(
  '/:id/publish',
  authorize('client'),
  requireFeatureFlag('freelancer_matching'),
  requireApproved,
  requireEntitlement('can_create_job'),
  controller.publishJob
);

// PATCH /jobs/:id/pause-matching
router.patch(
  '/:id/pause-matching',
  authorize('client'),
  requireFeatureFlag('freelancer_matching'),
  requireApproved,
  controller.pauseMatching
);

// PATCH /jobs/:id
// Update draft fields
router.patch(
  '/:id',
  authorize('client'),
  controller.updateJob
);

// DELETE /jobs/:id
// Delete an unfinished draft request.
router.delete(
  '/:id',
  authorize('client'),
  controller.deleteDraftJob
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

router.get(
  '/admin/all',
  authorize('admin'),
  requirePermission('matching.manage'),
  controller.adminListAllJobs
);

router.patch(
  '/admin/:id/status',
  authorize('admin'),
  requirePermission('matching.manage'),
  controller.adminUpdateJobStatus
);

router.post(
  '/admin/:id/approve-pro-matching',
  authorize('admin'),
  requirePermission('matching.manage'),
  controller.approveProMatching
);

// ── Shared (role-filtered in service) ────────────────────────────────────────

// GET /jobs
// - admin: all jobs
// - client: own jobs
// - freelancer: only matched jobs
router.get(
  '/',
  controller.listJobs
);

// GET /jobs/:id
// - admin: any job
// - client: own job only
// - freelancer: only if matched → else 404
router.get(
  '/:id',
  controller.getJobById
);

// ── Admin ─────────────────────────────────────────────────────────────────────

module.exports = router;
