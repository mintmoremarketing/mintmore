const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');
const { upload, handleUploadError } = require('../../middleware/upload');
const controller = require('./creative.controller');

const router = Router();
router.use(authenticate);

// ── Milestone 2 Client Routes ──
router.post('/calendar/complete', authorize('client'), controller.completeCalendar);
router.get('/client/pending-review', authorize('client'), controller.listClientPendingReview);
router.post('/client/posts/:postId/approve', authorize('client'), controller.clientApprovePost);
router.post('/client/posts/:postId/reject', authorize('client'), controller.clientRejectPost);

// ── Milestone 2 Designer Routes ──
router.get('/designer/social-queue', authorize('designer', 'admin'), controller.designerSocialQueue);
router.patch('/designer/social-queue/:postId/upload', authorize('designer', 'admin'), controller.uploadCreativeToSocialPost);

// ── Milestone 2 Admin Routes ──
router.get('/admin/clients', authorize('admin'), controller.listAdminClients);
router.get('/admin/designers', authorize('admin'), controller.listAdminDesigners);
router.patch('/admin/clients/:clientId/assign-designer', authorize('admin'), controller.assignDesignerToClient);
router.get('/admin/review-queue', authorize('admin'), controller.listAdminReviewQueue);
router.post('/admin/posts/:postId/approve', authorize('admin'), controller.adminApprovePost);
router.post('/admin/posts/:postId/reject', authorize('admin'), controller.adminRejectPost);
router.post('/admin/direct-upload', authorize('admin'), controller.adminDirectUpload);

// ── General Upload Route ──
router.post(
  '/upload',
  handleUploadError(upload.single('file')),
  controller.uploadAsset
);

// ── Existing / Legacy Routes ──
router.get('/calendar', authorize('client'), controller.calendar);
router.post('/calendar/:eventId/select', authorize('client'), controller.selectEvent);
router.get('/work', authorize('client'), controller.myWork);
router.post('/requests', authorize('client'), controller.createRequest);
router.delete('/requests/:requestId', authorize('client'), controller.cancelRequest);
router.delete('/selections/:selectionId', authorize('client'), controller.cancelSelection);

router.get('/designer/tasks', authorize('designer'), controller.designerTasks);
router.patch('/designer/tasks/:taskId', authorize('designer'), controller.updateDesignerTask);
router.get('/brands/:userId/context', authorize('admin', 'designer'), controller.getBrandContext);

router.get(
  '/admin/overview',
  authorize('admin'),
  requirePermission('ops.manage'),
  controller.adminOverview
);

router.post(
  '/admin/events',
  authorize('admin'),
  requirePermission('calendar.manage'),
  controller.createEvent
);

router.get(
  '/admin/events/suggestions',
  authorize('admin'),
  requirePermission('calendar.manage'),
  controller.suggestEvents
);

router.patch(
  '/admin/events/:eventId',
  authorize('admin'),
  requirePermission('calendar.manage'),
  controller.updateEvent
);

router.delete(
  '/admin/events/:eventId',
  authorize('admin'),
  requirePermission('calendar.manage'),
  controller.deleteEvent
);

router.post(
  '/admin/tasks/sync-sheet',
  authorize('admin'),
  requirePermission('tasks.assign'),
  controller.syncTaskSheet
);

router.patch(
  '/admin/tasks/:taskId',
  authorize('admin'),
  requirePermission('tasks.assign'),
  controller.updateTask
);

router.post(
  '/admin/requests/:requestId/approve',
  authorize('admin'),
  requirePermission('tasks.review'),
  controller.approveRequest
);

router.post(
  '/admin/requests/:requestId/reject',
  authorize('admin'),
  requirePermission('tasks.review'),
  controller.rejectRequest
);

router.post(
  '/admin/selections/:selectionId/approve',
  authorize('admin'),
  requirePermission('tasks.review'),
  controller.approveSelection
);

router.post(
  '/admin/selections/:selectionId/reject',
  authorize('admin'),
  requirePermission('tasks.review'),
  controller.rejectSelection
);

module.exports = router;
