const { Router } = require('express');
const controller = require('./admin.controller');
const jobController = require('../jobs/job.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');

const router = Router();

router.use(authenticate, authorize('admin'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', controller.getDashboardStats);

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users',                    requirePermission('users.manage'), controller.getUsers);
router.post('/users/admin',             requirePermission('admins.manage'), controller.createAdminUser);
router.patch('/users/:userId/admin-permissions', requirePermission('admins.manage'), controller.setAdminPermissions);
router.get('/users/:userId',            requirePermission('users.manage'), controller.getUserById);
router.patch('/users/:userId/approval', requirePermission('users.manage'), controller.setUserApproval);
router.patch('/users/:userId/level',    requirePermission('matching.manage'), controller.setFreelancerLevel);

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
