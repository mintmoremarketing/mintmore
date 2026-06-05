const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { hashPassword } = require('../../utils/hash');
const { writeAudit } = require('../audit/audit.service');

// ── User Management ───────────────────────────────────────────────────────────

/**
 * Get all users with filters (paginated).
 * Admin dashboard — user list.
 */
const getUsers = async ({ page = 1, limit = 20, role, is_approved, search } = {}) => {
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (role) {
    params.push(role);
    conditions.push(`role = $${params.length}`);
  }

  if (typeof is_approved === 'boolean') {
    params.push(is_approved);
    conditions.push(`is_approved = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const result = await query(
    `SELECT
       id, email, phone, full_name, role, avatar_url,
       is_active, is_approved, approved_at,
       admin_permissions, is_super_admin,
       kyc_status, kyc_level,
       freelancer_level, is_available,
       jobs_completed_count, average_rating,
       created_at
     FROM users
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const countResult = await query(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    countParams
  );

  return {
    users: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

/**
 * Get single user detail (admin view — all fields).
 */
const getUserById = async (userId) => {
  const result = await query(
    `SELECT
       id, email, phone, full_name, role, avatar_url,
       bio, skills, gender, date_of_birth,
       address_city, address_state, country,
       is_active, is_approved, approved_at, approved_by,
       admin_permissions, is_super_admin,
       kyc_status, kyc_level,
       freelancer_level, level_set_by_admin,
       is_available, jobs_completed_count, average_rating,
       last_login_at, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (!result.rows[0]) throw new AppError('User not found', 404);
  return result.rows[0];
};

/**
 * Approve or suspend a user.
 * Sets is_approved + records who approved and when.
 */
const setUserApproval = async (targetUserId, adminId, { is_approved }) => {
  // Prevent admin from suspending themselves
  if (targetUserId === adminId) {
    throw new AppError('You cannot change your own approval status', 400);
  }

  const result = await query(
    `UPDATE users
     SET
       is_approved  = $1,
       approved_by  = $2,
       approved_at  = $3
     WHERE id = $4
     RETURNING
       id, email, full_name, role, is_approved, approved_at`,
    [is_approved, adminId, is_approved ? new Date() : null, targetUserId]
  );

  if (!result.rows[0]) throw new AppError('User not found', 404);

  logger.info('User approval updated', {
    targetUserId,
    adminId,
    is_approved,
  });
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: is_approved ? 'user.approved' : 'user.suspended',
    entityType: 'user',
    entityId: targetUserId,
    afterState: result.rows[0],
  });

  return result.rows[0];
};

const createAdminUser = async (adminId, { email, password, full_name, permissions = [] }) => {
  if (!email || !password || !full_name) {
    throw new AppError('email, password, and full_name are required', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows[0]) {
    throw new AppError('An account with this email already exists', 409);
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users
       (email, password_hash, full_name, role, is_approved, approved_by, approved_at, admin_permissions)
     VALUES ($1, $2, $3, 'admin', true, $4, NOW(), $5)
     RETURNING id, email, full_name, role, is_approved, admin_permissions, is_super_admin, created_at`,
    [normalizedEmail, passwordHash, full_name.trim(), adminId, permissions]
  );

  logger.info('Admin user created', {
    createdBy: adminId,
    adminUserId: result.rows[0].id,
  });

  return result.rows[0];
};

const setAdminPermissions = async (targetUserId, adminId, permissions, isSuperAdmin = false) => {
  if (targetUserId === adminId && !isSuperAdmin) {
    throw new AppError('You cannot remove your own super-admin access', 400);
  }
  const beforeResult = await query(
    'SELECT id, role, admin_permissions, is_super_admin FROM users WHERE id = $1',
    [targetUserId]
  );
  const before = beforeResult.rows[0];
  if (!before || before.role !== 'admin') throw new AppError('Admin user not found', 404);
  const result = await query(
    `UPDATE users SET admin_permissions = $1, is_super_admin = $2
     WHERE id = $3 RETURNING id, email, full_name, role, admin_permissions, is_super_admin`,
    [permissions, isSuperAdmin, targetUserId]
  );
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'admin.permissions.updated',
    entityType: 'user',
    entityId: targetUserId,
    beforeState: before,
    afterState: result.rows[0],
  });
  return result.rows[0];
};

/**
 * Set freelancer level — admin controlled.
 *
 * Rules:
 * - beginner / intermediate: admin sets directly
 * - experienced: requires admin approval flag
 */
const setFreelancerLevel = async (targetUserId, adminId, { level }) => {
  const userResult = await query(
    'SELECT role FROM users WHERE id = $1',
    [targetUserId]
  );

  const user = userResult.rows[0];
  if (!user) throw new AppError('User not found', 404);

  if (user.role !== 'freelancer') {
    throw new AppError('Level can only be set for users with role: freelancer', 400);
  }

  const result = await query(
    `UPDATE users
     SET
       freelancer_level   = $1,
       level_set_by_admin = true
     WHERE id = $2
     RETURNING id, email, full_name, freelancer_level, level_set_by_admin`,
    [level, targetUserId]
  );

  logger.info('Freelancer level set', { targetUserId, adminId, level });
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'freelancer.level.updated',
    entityType: 'user',
    entityId: targetUserId,
    afterState: result.rows[0],
  });
  return result.rows[0];
};

// ── Category Management ───────────────────────────────────────────────────────

const getCategories = async (includeInactive = false) => {
  const result = await query(
    `SELECT * FROM categories
     ${includeInactive ? '' : "WHERE is_active = true"}
     ORDER BY sort_order ASC, name ASC`
  );
  return result.rows;
};

const createCategory = async ({ name, slug, description, sort_order = 0 }) => {
  const existing = await query(
    'SELECT id FROM categories WHERE slug = $1',
    [slug]
  );
  if (existing.rows[0]) throw new AppError('A category with this slug already exists', 409);

  const result = await query(
    `INSERT INTO categories (name, slug, description, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name.trim(), slug.trim(), description?.trim() || null, sort_order]
  );

  return result.rows[0];
};

const toggleCategory = async (categoryId) => {
  const result = await query(
    `UPDATE categories
     SET is_active = NOT is_active
     WHERE id = $1
     RETURNING *`,
    [categoryId]
  );
  if (!result.rows[0]) throw new AppError('Category not found', 404);
  return result.rows[0];
};

// ── Dashboard Stats ───────────────────────────────────────────────────────────

const getDashboardStats = async () => {
  const [users, jobs, kyc, proposals] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'client')     AS total_clients,
        COUNT(*) FILTER (WHERE role = 'freelancer') AS total_freelancers,
        COUNT(*) FILTER (WHERE role = 'admin')      AS total_admins,
        COUNT(*) FILTER (WHERE is_approved = false AND role != 'admin') AS pending_approval,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS new_this_week
      FROM users
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')        AS open_jobs,
        COUNT(*) FILTER (WHERE status = 'matching')    AS matching_jobs,
        COUNT(*) FILTER (WHERE status = 'assigned')    AS assigned_jobs,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS active_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')   AS completed_jobs
      FROM jobs
    `),
    query(`
      SELECT COUNT(*) AS pending_kyc
      FROM kyc_submissions WHERE status = 'pending'
    `),
    query(`
      SELECT COUNT(*) AS pending_proposals
      FROM proposals WHERE status = 'pending'
    `),
  ]);

  return {
    users:     users.rows[0],
    jobs:      jobs.rows[0],
    kyc:       { pending_kyc: kyc.rows[0].pending_kyc },
    proposals: { pending_proposals: proposals.rows[0].pending_proposals },
  };
};

// ── Price Range Management ─────────────────────────────────────────────────────

const upsertCategoryPriceRange = async (categoryId, adminId, data) => {
  const {
    beginner_min, beginner_max,
    intermediate_min, intermediate_max,
    experienced_min, experienced_max,
    currency = 'INR', notes,
  } = data;

  // Validate band ordering
  if (beginner_min >= beginner_max)       throw new AppError('beginner_min must be less than beginner_max', 400);
  if (intermediate_min >= intermediate_max) throw new AppError('intermediate_min must be less than intermediate_max', 400);
  if (experienced_min >= experienced_max)  throw new AppError('experienced_min must be less than experienced_max', 400);

  // Verify category exists
  const cat = await query('SELECT id FROM categories WHERE id = $1', [categoryId]);
  if (!cat.rows[0]) throw new AppError('Category not found', 404);

  const result = await query(
    `INSERT INTO category_price_ranges
       (category_id, beginner_min, beginner_max,
        intermediate_min, intermediate_max,
        experienced_min, experienced_max,
        currency, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)
     ON CONFLICT (category_id) DO UPDATE SET
       beginner_min     = EXCLUDED.beginner_min,
       beginner_max     = EXCLUDED.beginner_max,
       intermediate_min = EXCLUDED.intermediate_min,
       intermediate_max = EXCLUDED.intermediate_max,
       experienced_min  = EXCLUDED.experienced_min,
       experienced_max  = EXCLUDED.experienced_max,
       currency         = EXCLUDED.currency,
       notes            = EXCLUDED.notes,
       updated_by       = EXCLUDED.updated_by
     RETURNING *`,
    [
      categoryId,
      beginner_min, beginner_max,
      intermediate_min, intermediate_max,
      experienced_min, experienced_max,
      currency, notes || null, adminId,
    ]
  );

  logger.info('Category price range upserted', { categoryId, adminId });
  return result.rows[0];
};

const getAllCategoryPriceRanges = async () => {
  const result = await query(
    `SELECT cpr.*, c.name AS category_name, c.slug AS category_slug
     FROM category_price_ranges cpr
     JOIN categories c ON c.id = cpr.category_id
     ORDER BY c.sort_order ASC`
  );
  return result.rows;
};

module.exports = {
  getUsers,
  getUserById,
  setUserApproval,
  createAdminUser,
  setAdminPermissions,
  setFreelancerLevel,
  getCategories,
  createCategory,
  toggleCategory,
  getDashboardStats,
  upsertCategoryPriceRange,
  getAllCategoryPriceRanges,
};
