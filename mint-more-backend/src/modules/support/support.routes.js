const { Router } = require('express');
const controller = require('./support.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermissionIfAdmin, requirePermission } = require('../../middleware/permissions');

const router = Router();
router.use(authenticate);

router.get('/', requirePermissionIfAdmin('support.manage'), controller.list);
router.post('/', controller.create);
router.get('/:ticketId', requirePermissionIfAdmin('support.manage'), controller.get);
router.post('/:ticketId/messages', requirePermissionIfAdmin('support.manage'), controller.message);
router.patch('/:ticketId', authorize('admin'), requirePermission('support.manage'), controller.update);

module.exports = router;
