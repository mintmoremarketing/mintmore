const { Router } = require('express');
const controller = require('./notification.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();
const channels = require('./notification-channels.controller');

router.get('/email/unsubscribe', channels.emailUnsubscribe);
router.post('/email/unsubscribe', channels.emailUnsubscribe);

// ── SSE stream — authenticate inline (token via query param supported) ─────────
// Must be BEFORE router.use(authenticate) because EventSource can't set headers
router.get('/stream', controller.stream);

// All other routes require standard Bearer token auth
router.use(authenticate);
router.get('/preferences', channels.getPreferences);
router.patch('/preferences', channels.savePreferences);
router.post('/push/subscribe', channels.subscribe);
router.delete('/push/subscribe', channels.unsubscribe);
router.get('/admin/deliveries', authorize('admin'), requirePermission('support.manage'), channels.deliveries);
router.post('/admin/test', authorize('admin'), requirePermission('support.manage'), channels.testToMe);

// GET    /api/v1/notifications                   — paginated list
router.get('/', controller.getNotifications);

// GET    /api/v1/notifications/unread-count       — badge count
router.get('/unread-count', controller.getUnreadCount);

// PATCH  /api/v1/notifications/read-all           — mark all read
router.patch('/read-all', controller.markAllAsRead);

// PATCH  /api/v1/notifications/:notificationId/read — mark one read
router.patch('/:notificationId/read', controller.markAsRead);

// POST   /api/v1/notifications/admin/broadcast    — admin only
router.post(
  '/admin/broadcast',
  authorize('admin'),
  requirePermission('support.manage'),
  controller.adminBroadcast
);

module.exports = router;
