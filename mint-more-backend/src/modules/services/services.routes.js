const { Router } = require('express');
const controller = require('./services.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/permissions');
const { paymentCheckoutLimiter, paymentVerifyLimiter } = require('../../middleware/rateLimiter');

const router = Router();

// ── Public catalogue (no login) ───────────────────────────────────────────────
router.get('/storefront', controller.getStorefront);
router.get('/categories', controller.listCategories);
router.get('/categories/:slug', controller.getCategoryPage);
router.get('/catalog', controller.listCatalog);
router.get('/catalog/:slug', controller.getCatalogItem);

router.use(authenticate);

// ── Client ────────────────────────────────────────────────────────────────────
router.post('/checkout', authorize('client'), paymentCheckoutLimiter, controller.createCheckout);
router.post('/checkout/:id/verify', authorize('client'), paymentVerifyLimiter, controller.verifyCheckout);
router.get('/bookings', authorize('client'), controller.listMyBookings);
router.get('/bookings/:id', authorize('client'), controller.getMyBooking);
router.patch('/bookings/:id/brief', authorize('client'), controller.updateMyBookingBrief);
router.get('/past-freelancers', authorize('client'), controller.listPastFreelancers);

// ── Freelancer ────────────────────────────────────────────────────────────────
router.get('/templates', authorize('freelancer'), controller.listTemplatesForFreelancer);
router.post('/templates/:id/opt-in', authorize('freelancer'), controller.optIn);
router.delete('/templates/:id/opt-in', authorize('freelancer'), controller.optOut);
router.get('/work', authorize('freelancer'), controller.listMyWork);
router.get('/offers', authorize('freelancer'), controller.listMyOffers);
router.post('/offers/:id/accept', authorize('freelancer'), controller.acceptOffer);
router.post('/offers/:id/decline', authorize('freelancer'), controller.declineOffer);
router.get('/work/:id', authorize('freelancer'), controller.getMyWork);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get('/admin/templates', authorize('admin'), requirePermission('ops.manage'), controller.adminListTemplates);
router.get('/admin/brief-defaults', authorize('admin'), requirePermission('ops.manage'), controller.adminBriefDefaults);
router.post('/admin/templates', authorize('admin'), requirePermission('ops.manage'), controller.adminCreateTemplate);
router.put('/admin/templates/:id', authorize('admin'), requirePermission('ops.manage'), controller.adminUpdateTemplate);
router.get('/admin/bookings', authorize('admin'), requirePermission('ops.manage'), controller.adminListBookings);
router.get('/admin/bookings/:id/freelancers', authorize('admin'), requirePermission('ops.manage'), controller.adminEligibleFreelancers);
router.post('/admin/bookings/:id/assign', authorize('admin'), requirePermission('ops.manage'), controller.adminAssign);

module.exports = router;
