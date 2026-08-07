const adminService = require('./admin.service');
const brandService = require('../brand/brand.service');
const {
  validateApproveUser,
  validateSetFreelancerLevel,
  validateCategoryCreate,
} = require('./admin.validator');
const { sendSuccess } = require('../../utils/apiResponse');
const { listOutboxEvents, retryOutboxEvent } = require('../events/outbox.service');
const { writeAudit } = require('../audit/audit.service');

// ── Users ─────────────────────────────────────────────────────────────────────

const getUsers = async (req, res, next) => {
  try {
    const { page, limit, role, is_approved, search } = req.query;
    const result = await adminService.getUsers({
      page:        parseInt(page, 10) || 1,
      limit:       parseInt(limit, 10) || 20,
      role,
      is_approved: is_approved === 'true'
        ? true
        : is_approved === 'false'
        ? false
        : undefined,
      search,
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getUserById = async (req, res, next) => {
  try {
    const detail = await adminService.getUserById(req.params.userId);
    return sendSuccess(res, { data: detail });
  } catch (err) { next(err); }
};

const getBrandWorkspaces = async (req, res, next) => {
  try {
    const data = await brandService.listBrandWorkspaces({
      limit: parseInt(req.query.limit, 10) || 100,
      search: req.query.search || '',
    });
    return sendSuccess(res, { data });
  } catch (err) {
    next(err);
  }
};

const getBrandWorkspace = async (req, res, next) => {
  try {
    const data = await brandService.getBrandWorkspace(req.params.userId);
    return sendSuccess(res, { data });
  } catch (err) {
    next(err);
  }
};

const impersonateUser = async (req, res, next) => {
  try {
    const result = await adminService.impersonateUser(req.params.userId, req.user.sub);
    return sendSuccess(res, {
      data: result,
      message: 'Impersonation token generated',
    });
  } catch (err) { next(err); }
};

const setUserApproval = async (req, res, next) => {
  try {
    validateApproveUser(req.body);
    const user = await adminService.setUserApproval(
      req.params.userId,
      req.user.sub,
      req.body
    );
    return sendSuccess(res, {
      data: { user },
      message: `User ${req.body.is_approved ? 'approved' : 'suspended'} successfully`,
    });
  } catch (err) { next(err); }
};

const setUserTier = async (req, res, next) => {
  try {
    const membership = await adminService.setUserTier(
      req.params.userId,
      req.user.sub,
      req.body
    );
    return sendSuccess(res, {
      data: { membership },
      message: `User tier updated successfully`,
    });
  } catch (err) { next(err); }
};

const createAdminUser = async (req, res, next) => {
  try {
    const user = await adminService.createAdminUser(req.user.sub, req.body);
    return sendSuccess(res, {
      data: { user },
      message: 'Admin created successfully',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const createDesignerUser = async (req, res, next) => {
  try {
    const user = await adminService.createDesignerUser(req.user.sub, req.body);
    return sendSuccess(res, {
      data: { user },
      message: 'Designer created successfully',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const setAdminPermissions = async (req, res, next) => {
  try {
    const user = await adminService.setAdminPermissions(
      req.params.userId,
      req.user.sub,
      req.body.permissions || [],
      Boolean(req.body.is_super_admin)
    );
    return sendSuccess(res, { data: { user }, message: 'Admin permissions updated' });
  } catch (err) { next(err); }
};

const deleteUserData = async (req, res, next) => {
  try {
    const result = await adminService.deleteUserData(
      req.params.userId,
      req.user.sub,
      req.body || {}
    );
    return sendSuccess(res, {
      data: result,
      message: 'User and related user data deleted',
    });
  } catch (err) { next(err); }
};

const resetOperationalData = async (req, res, next) => {
  try {
    const result = await adminService.resetOperationalData(req.user.sub, req.body || {});
    return sendSuccess(res, {
      data: result,
      message: 'Operational data reset complete',
    });
  } catch (err) { next(err); }
};

const setFreelancerLevel = async (req, res, next) => {
  try {
    validateSetFreelancerLevel(req.body);
    const user = await adminService.setFreelancerLevel(
      req.params.userId,
      req.user.sub,
      req.body
    );
    return sendSuccess(res, {
      data: { user },
      message: `Freelancer level set to: ${req.body.level}`,
    });
  } catch (err) { next(err); }
};

// ── Categories ────────────────────────────────────────────────────────────────

const getCategories = async (req, res, next) => {
  try {
    const categories = await adminService.getCategories(
      req.query.include_inactive === 'true'
    );
    return sendSuccess(res, { data: { categories } });
  } catch (err) { next(err); }
};

const createCategory = async (req, res, next) => {
  try {
    validateCategoryCreate(req.body);
    const category = await adminService.createCategory(req.body);
    return sendSuccess(res, {
      data: { category },
      message: 'Category created successfully',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const toggleCategory = async (req, res, next) => {
  try {
    const category = await adminService.toggleCategory(req.params.categoryId);
    return sendSuccess(res, {
      data: { category },
      message: `Category ${category.is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) { next(err); }
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminService.getDashboardStats();
    return sendSuccess(res, { data: { stats } });
  } catch (err) { next(err); }
};

const upsertCategoryPriceRange = async (req, res, next) => {
  try {
    const range = await adminService.upsertCategoryPriceRange(
      req.params.categoryId, req.user.sub, req.body
    );
    return sendSuccess(res, {
      data: { range },
      message: 'Price range saved successfully',
    });
  } catch (err) { next(err); }
};

const getAllCategoryPriceRanges = async (req, res, next) => {
  try {
    const ranges = await adminService.getAllCategoryPriceRanges();
    return sendSuccess(res, { data: { ranges } });
  } catch (err) { next(err); }
};


const getOutboxEvents = async (req, res, next) => {
  try {
    const events = await listOutboxEvents({
      status: req.query.status || null,
      limit: req.query.limit,
    });
    return sendSuccess(res, { data: { events } });
  } catch (err) { next(err); }
};

const retryOutbox = async (req, res, next) => {
  try {
    const event = await retryOutboxEvent(req.params.eventId);
    await writeAudit({
      actorId: req.user.sub,
      actorRole: 'admin',
      action: 'outbox.retry',
      entityType: 'event_outbox',
      entityId: event.id,
      afterState: event,
    });
    return sendSuccess(res, { data: { event }, message: 'Event queued for retry' });
  } catch (err) { next(err); }
};

module.exports = {
  getUsers,
  getUserById,
  getBrandWorkspaces,
  getBrandWorkspace,
  impersonateUser,
  setUserApproval,
  setUserTier,
  createAdminUser,
  createDesignerUser,
  setAdminPermissions,
  deleteUserData,
  resetOperationalData,
  setFreelancerLevel,
  getCategories,
  createCategory,
  toggleCategory,
  getDashboardStats,
  upsertCategoryPriceRange,
  getAllCategoryPriceRanges,
  getOutboxEvents,
  retryOutbox,
};
