const service = require('./services.service');
const { sendSuccess } = require('../../utils/apiResponse');

const handle = (fn) => async (req, res, next) => {
  try {
    const { data, message, statusCode } = await fn(req);
    return sendSuccess(res, { data, message, statusCode });
  } catch (err) { next(err); }
};

// ── Public catalogue ──────────────────────────────────────────────────────────
const listCategories = handle(async () => ({ data: await service.listCategories() }));
const listCatalog = handle(async (req) => ({ data: await service.listCatalog({ category: req.query.category, q: req.query.q }) }));
const getStorefront = handle(async () => ({ data: await service.getStorefront() }));
const getCategoryPage = handle(async (req) => ({ data: await service.getCategoryPage(req.params.slug) }));
const getCatalogItem = handle(async (req) => ({ data: await service.getCatalogItem(req.params.slug) }));

// ── Client ────────────────────────────────────────────────────────────────────
const createCheckout = handle(async (req) => ({
  data: await service.createCheckout(req.user.sub, req.body || {}),
  statusCode: 201,
}));
const verifyCheckout = handle(async (req) => ({
  data: await service.verifyCheckout(req.user.sub, req.params.id, req.body || {}),
  message: 'Payment confirmed',
}));
const listMyBookings = handle(async (req) => ({ data: await service.listClientBookings(req.user.sub, req.query) }));
const getMyBooking = handle(async (req) => ({ data: await service.getClientBooking(req.user.sub, req.params.id) }));
const listPastFreelancers = handle(async (req) => ({ data: await service.listPastFreelancers(req.user.sub, req.query) }));

// ── Freelancer ────────────────────────────────────────────────────────────────
const listTemplatesForFreelancer = handle(async (req) => ({ data: await service.listTemplatesForFreelancer(req.user.sub) }));
const optIn = handle(async (req) => ({ data: await service.setOptIn(req.user.sub, req.params.id, true), message: 'You will now receive orders for this service' }));
const optOut = handle(async (req) => ({ data: await service.setOptIn(req.user.sub, req.params.id, false), message: 'You will no longer receive new orders for this service' }));
const listMyWork = handle(async (req) => ({ data: await service.listFreelancerWork(req.user.sub, req.query) }));
const getMyWork = handle(async (req) => ({ data: await service.getFreelancerWork(req.user.sub, req.params.id) }));

// ── Admin ─────────────────────────────────────────────────────────────────────
const listMyOffers = handle(async (req) => ({ data: await service.listMyOffers(req.user.sub) }));
const acceptOffer = handle(async (req) => ({ data: await service.acceptOffer(req.user.sub, req.params.id), message: 'Order accepted' }));
const declineOffer = handle(async (req) => ({ data: await service.declineOffer(req.user.sub, req.params.id), message: 'Offer declined' }));
const adminListTemplates = handle(async () => ({ data: await service.adminListTemplates() }));
const adminBriefDefaults = handle(async () => ({ data: await service.adminBriefDefaults() }));
const adminCreateTemplate = handle(async (req) => ({
  data: await service.saveTemplate(req.user.sub, null, req.body || {}),
  statusCode: 201,
  message: 'Service created',
}));
const adminUpdateTemplate = handle(async (req) => ({
  data: await service.saveTemplate(req.user.sub, req.params.id, req.body || {}),
  message: 'Service saved',
}));
const adminListBookings = handle(async (req) => ({ data: await service.adminListBookings(req.query) }));
const adminEligibleFreelancers = handle(async (req) => ({ data: await service.adminEligibleFreelancers(req.params.id) }));
const adminAssign = handle(async (req) => ({
  data: await service.assignBooking(req.params.id, {
    freelancerId: req.body?.freelancer_id || null,
    actorId: req.user.sub,
  }),
  message: 'Assignment updated',
}));

module.exports = {
  listCategories,
  listCatalog,
  getStorefront,
  getCategoryPage,
  getCatalogItem,
  createCheckout,
  verifyCheckout,
  listMyBookings,
  getMyBooking,
  listPastFreelancers,
  listTemplatesForFreelancer,
  optIn,
  optOut,
  listMyWork,
  getMyWork,
  listMyOffers,
  acceptOffer,
  declineOffer,
  adminListTemplates,
  adminBriefDefaults,
  adminCreateTemplate,
  adminUpdateTemplate,
  adminListBookings,
  adminEligibleFreelancers,
  adminAssign,
};
