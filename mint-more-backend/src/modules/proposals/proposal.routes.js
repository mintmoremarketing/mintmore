const { Router } = require('express');
const controller = require('./proposal.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireApproved } = require('../../middleware/requireApproved');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();

router.use(authenticate);

// ── Freelancer routes ─────────────────────────────────────────────────────────

// POST   /api/v1/proposals/jobs/:jobId       — submit proposal
router.post(
  '/jobs/:jobId',
  authorize('freelancer'),
  requireApproved,
  controller.submitProposal
);

// DELETE /api/v1/proposals/:proposalId       — withdraw proposal
router.delete(
  '/:proposalId',
  authorize('freelancer'),
  controller.withdrawProposal
);

// GET    /api/v1/proposals/my                — freelancer's own proposals
router.get(
  '/my',
  authorize('freelancer'),
  controller.getMyProposals
);

// ── Client routes ─────────────────────────────────────────────────────────────

// GET    /api/v1/proposals/jobs/:jobId/client — client sees shortlisted proposals
router.get(
  '/jobs/:jobId/client',
  authorize('client'),
  controller.getJobProposalsForClient
);

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET    /api/v1/proposals/jobs/:jobId/admin  — admin sees all proposals
router.get(
  '/jobs/:jobId/admin',
  authorize('admin'),
  requirePermission('matching.manage'),
  controller.adminGetJobProposals
);

// PATCH  /api/v1/proposals/:proposalId/review — admin shortlist or reject
router.patch(
  '/:proposalId/review',
  authorize('admin'),
  requirePermission('matching.manage'),
  controller.adminReviewProposal
);

module.exports = router;
