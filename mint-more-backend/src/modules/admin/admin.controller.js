const adminService = require('./admin.service');
const {
  validateApproveUser,
  validateSetFreelancerLevel,
  validateCategoryCreate,
} = require('./admin.validator');
const { sendSuccess } = require('../../utils/apiResponse');

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
    const user = await adminService.getUserById(req.params.userId);
    return sendSuccess(res, { data: { user } });
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


module.exports = {
  getUsers,
  getUserById,
  setUserApproval,
  createAdminUser,
  setFreelancerLevel,
  getCategories,
  createCategory,
  toggleCategory,
  getDashboardStats,
  upsertCategoryPriceRange,
  getAllCategoryPriceRanges,
};
