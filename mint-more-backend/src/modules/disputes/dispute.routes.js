const { Router } = require('express');
const controller = require('./dispute.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireApproved } = require('../../middleware/requireApproved');
const { requirePermission, requirePermissionIfAdmin } = require('../../middleware/permissions');

const router = Router();
router.use(authenticate, requireApproved);

router.get('/', requirePermissionIfAdmin('support.manage'), controller.list);
router.post('/jobs/:jobId', controller.open);
router.get('/:disputeId', requirePermissionIfAdmin('support.manage'), controller.get);
router.post('/:disputeId/messages', requirePermissionIfAdmin('support.manage'), controller.addMessage);
router.patch('/:disputeId/resolve', authorize('admin'), requirePermission('support.manage'), controller.resolve);

module.exports = router;
