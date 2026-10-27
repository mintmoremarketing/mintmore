const { Router } = require('express');
const controller = require('./assessments.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();

router.use(authenticate);

// ── Admin review ──────────────────────────────────────────────────────────────
router.get('/admin/attempts', authorize('admin'), requirePermission('ops.manage'), controller.adminList);
router.post('/admin/attempts/:attemptId/review', authorize('admin'), requirePermission('ops.manage'), controller.adminReview);

// ── Attempts (freelancer owner, or admin for reading) ─────────────────────────
router.get('/attempts/:attemptId', authorize('freelancer', 'admin'), controller.getAttempt);
router.post('/attempts/:attemptId/files', authorize('freelancer'), controller.prepareFile);
router.post('/attempts/:attemptId/files/:itemId/complete', authorize('freelancer'), controller.completeFile);
router.post('/attempts/:attemptId/links', authorize('freelancer'), controller.addLink);
router.delete('/attempts/:attemptId/items/:itemId', authorize('freelancer'), controller.removeItem);
router.post('/attempts/:attemptId/submit', authorize('freelancer'), controller.submit);

// ── Catalogue for the freelancer ──────────────────────────────────────────────
router.get('/', authorize('freelancer'), controller.list);
router.get('/:slug', authorize('freelancer'), controller.get);
router.post('/:slug/start', authorize('freelancer'), controller.start);

module.exports = router;
