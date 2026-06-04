const { Router } = require('express');
const controller = require('./admin.controller');
const jobController = require('../jobs/job.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');

const router = Router();

router.use(authenticate, authorize('admin'));

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', controller.getDashboardStats);

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users',                    controller.getUsers);
router.post('/users/admin',             controller.createAdminUser);
router.get('/users/:userId',            controller.getUserById);
router.patch('/users/:userId/approval', controller.setUserApproval);
router.patch('/users/:userId/level',    controller.setFreelancerLevel);

// ── Category Management ───────────────────────────────────────────────────────
router.get('/categories',                       controller.getCategories);
router.post('/categories',                      controller.createCategory);
router.patch('/categories/:categoryId/toggle',  controller.toggleCategory);

// ── Job Management ────────────────────────────────────────────────────────────
router.get('/jobs',                jobController.adminListAllJobs);    // ← was adminListJobs
router.patch('/jobs/:jobId/status', jobController.adminUpdateJobStatus);

// ── Price Ranges ──────────────────────────────────────────────────────────────
router.get('/price-ranges',                  controller.getAllCategoryPriceRanges);
router.put('/price-ranges/:categoryId',      controller.upsertCategoryPriceRange);

module.exports = router;
