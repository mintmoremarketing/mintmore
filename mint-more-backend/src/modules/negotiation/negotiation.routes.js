const { Router } = require('express');
const controller = require('./negotiation.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireApproved } = require('../../middleware/requireApproved');
const { requirePermission } = require('../../middleware/permissions');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();

router.use(authenticate);

// ── Freelancer routes ─────────────────────────────────────────────────────────

// POST  /api/v1/negotiations/jobs/:jobId/initiate
// Freelancer opens negotiation (locks job)
router.post(
  '/jobs/:jobId/initiate',
  authorize('freelancer'),
  requireFeatureFlag('negotiation'),
  requireApproved,
  controller.initiateNegotiation
);

// PATCH /api/v1/negotiations/jobs/:jobId/freelancer-respond
// Freelancer counters / accepts / rejects client counter
router.patch(
  '/jobs/:jobId/freelancer-respond',
  authorize('freelancer'),
  requireFeatureFlag('negotiation'),
  requireApproved,
  controller.freelancerRespond
);

// PATCH /api/v1/negotiations/jobs/:jobId/assignment-respond
// Freelancer accepts or declines the final assignment
router.patch(
  '/jobs/:jobId/assignment-respond',
  authorize('freelancer'),
  requireFeatureFlag('negotiation'),
  requireApproved,
  controller.respondToAssignment
);

// ── Client routes ─────────────────────────────────────────────────────────────

// PATCH /api/v1/negotiations/jobs/:jobId/client-respond
// Client counters / accepts / rejects freelancer offer
router.patch(
  '/jobs/:jobId/client-respond',
  authorize('client'),
  requireFeatureFlag('negotiation'),
  requireApproved,
  controller.clientRespond
);

// ── Shared ────────────────────────────────────────────────────────────────────

// GET   /api/v1/negotiations/jobs/:jobId/status
// View current negotiation state (admin sees all, client/freelancer see own)
router.get(
  '/jobs/:jobId/status',
  requireFeatureFlag('negotiation'),
  controller.getNegotiationStatus
);

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET   /api/v1/negotiations/admin/pending-approvals
router.get(
  '/admin/pending-approvals',
  authorize('admin'),
  requirePermission('deals.approve'),
  controller.getAdminPendingApprovals
);

// POST  /api/v1/negotiations/admin/jobs/:jobId/approve-deal
router.post(
  '/admin/jobs/:jobId/approve-deal',
  authorize('admin'),
  requirePermission('deals.approve'),
  controller.adminApproveDeal
);

// POST  /api/v1/negotiations/admin/jobs/:jobId/reject-deal
router.post(
  '/admin/jobs/:jobId/reject-deal',
  authorize('admin'),
  requirePermission('deals.approve'),
  controller.adminRejectDeal
);

module.exports = router;
