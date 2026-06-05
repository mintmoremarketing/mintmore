const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');
const controller = require('./commerce.controller');

const router = Router();
router.use(authenticate);

router.get('/entitlements/me', controller.entitlements);
router.get('/credits/me', controller.credits);
router.get('/membership/me', controller.membership);
router.post('/membership/checkout', authorize('client'), controller.createCheckout);
router.post('/membership/verify', authorize('client'), controller.verifyCheckout);
router.post('/membership/pause', authorize('client'), controller.pause);

router.get('/admin/settings', authorize('admin'), requirePermission('pricing.manage'), controller.settings);
router.put('/admin/settings/:key', authorize('admin'), requirePermission('pricing.manage'), controller.updateSetting);
router.get('/admin/audit', authorize('admin'), requirePermission('audit.read'), controller.audit);

module.exports = router;
