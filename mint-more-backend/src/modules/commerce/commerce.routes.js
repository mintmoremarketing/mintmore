const { Router } = require('express');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');
const {
  paymentCheckoutLimiter,
  paymentVerifyLimiter,
} = require('../../middleware/rateLimiter');
const controller = require('./commerce.controller');

const router = Router();
router.use(authenticate);

router.get('/entitlements/me', controller.entitlements);
router.get('/credits/me', controller.credits);
router.get('/membership/me', controller.membership);
router.post('/membership/checkout', authorize('client'), paymentCheckoutLimiter, controller.createCheckout);
router.post('/membership/verify', authorize('client'), paymentVerifyLimiter, controller.verifyCheckout);
router.post('/membership/pause', authorize('client'), controller.pause);

router.get('/admin/settings', authorize('admin'), requirePermission('pricing.manage'), controller.settings);
router.put('/admin/settings/:key', authorize('admin'), requirePermission('pricing.manage'), controller.updateSetting);
router.post('/admin/credits/:userId/adjust', authorize('admin'), requirePermission('pricing.manage'), controller.adjustCredits);
router.get('/admin/audit', authorize('admin'), requirePermission('audit.read'), controller.audit);

router.get('/tiers', controller.getTiers);
router.post('/admin/tiers', authorize('admin'), requirePermission('pricing.manage'), controller.createTier);
router.put('/admin/tiers/:id', authorize('admin'), requirePermission('pricing.manage'), controller.updateTier);
router.delete('/admin/tiers/:id', authorize('admin'), requirePermission('pricing.manage'), controller.deleteTier);

module.exports = router;
