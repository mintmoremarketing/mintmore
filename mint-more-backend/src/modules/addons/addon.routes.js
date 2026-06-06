const { Router } = require('express');
const controller = require('./addon.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();
router.use(authenticate);

// GET  /api/v1/addons/plans
router.get('/plans', controller.getPlans);

// GET  /api/v1/addons/my
router.get('/my', controller.getMyAddons);

// POST /api/v1/addons/purchase
router.post('/purchase', authorize('client'), controller.purchaseAddon);

// GET  /api/v1/addons/check/:feature
router.get('/check/:feature', controller.checkFeature);

// Admin
router.get('/admin/plans', authorize('admin'), requirePermission('pricing.manage'), controller.adminGetPlans);
router.post('/admin/plans', authorize('admin'), requirePermission('pricing.manage'), controller.adminCreatePlan);
router.patch('/admin/plans/:planId', authorize('admin'), requirePermission('pricing.manage'), controller.adminUpdatePlan);
router.get('/admin/plans/:planId/subscribers', authorize('admin'), requirePermission('pricing.manage'), controller.adminGetSubscribers);

module.exports = router;
