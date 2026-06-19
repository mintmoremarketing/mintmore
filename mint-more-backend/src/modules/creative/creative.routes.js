const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');
const controller = require('./creative.controller');

const router = Router();
router.use(authenticate);

router.get('/calendar', authorize('client'), controller.calendar);
router.post('/calendar/:eventId/select', authorize('client'), controller.selectEvent);
router.get('/work', authorize('client'), controller.myWork);
router.post('/requests', authorize('client'), controller.createRequest);

router.get('/designer/tasks', authorize('designer'), controller.designerTasks);
router.patch('/designer/tasks/:taskId', authorize('designer'), controller.updateDesignerTask);

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
