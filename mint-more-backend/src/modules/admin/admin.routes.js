const { Router } = require('express');
const controller = require('./admin.controller');
const jobController = require('../jobs/job.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();

router.use(authenticate, authorize('admin'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', controller.getDashboardStats);
router.get('/operations/outbox', requirePermission('audit.read'), controller.getOutboxEvents);
router.post('/operations/outbox/:eventId/retry', requirePermission('operations.manage'), controller.retryOutbox);
router.post('/system/reset', requirePermission('admins.manage'), controller.resetOperationalData);

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users',                    requirePermission('users.manage'), controller.getUsers);
router.post('/users/admin',             requirePermission('admins.manage'), controller.createAdminUser);
router.post('/users/designer',          requirePermission('ops.manage'), controller.createDesignerUser);
router.patch('/users/:userId/admin-permissions', requirePermission('admins.manage'), controller.setAdminPermissions);
router.get('/users/:userId',            requirePermission('users.manage'), controller.getUserById);
router.post('/users/:userId/impersonate', requirePermission('users.manage'), controller.impersonateUser);
router.patch('/users/:userId/approval', requirePermission('users.manage'), controller.setUserApproval);
router.patch('/users/:userId/tier',     requirePermission('users.manage'), controller.setUserTier);
router.patch('/users/:userId/level',    requirePermission('matching.manage'), controller.setFreelancerLevel);
router.delete('/users/:userId',         requirePermission('users.manage'), controller.deleteUserData);

router.get('/brands', requirePermission('users.manage'), controller.getBrandWorkspaces);
router.get('/brands/:userId', requirePermission('users.manage'), controller.getBrandWorkspace);

// ── Category Management ───────────────────────────────────────────────────────
router.get('/categories',                       controller.getCategories);
router.post('/categories',                      requirePermission('pricing.manage'), controller.createCategory);
router.patch('/categories/:categoryId/toggle',  requirePermission('pricing.manage'), controller.toggleCategory);

// ── Job Management ────────────────────────────────────────────────────────────
router.get('/jobs',                jobController.adminListAllJobs);    // ← was adminListJobs
router.patch('/jobs/:jobId/status', requirePermission('matching.manage'), jobController.adminUpdateJobStatus);

// ── Price Ranges ──────────────────────────────────────────────────────────────
router.get('/price-ranges',                  controller.getAllCategoryPriceRanges);
router.put('/price-ranges/:categoryId',      requirePermission('pricing.manage'), controller.upsertCategoryPriceRange);

module.exports = router;
