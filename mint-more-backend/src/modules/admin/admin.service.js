const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { hashPassword } = require('../../utils/hash');
const { writeAudit } = require('../audit/audit.service');
const { sanitizeSubmissions } = require('../kyc/kyc.service');

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
  const [result, walletResult, creditsResult, kycResult, portfolioResult] = await Promise.all([
    query(
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
    ),
    query(
      `SELECT id, balance, escrow_balance, currency, created_at, updated_at
       FROM wallets WHERE user_id=$1`,
      [userId]
    ),
    query(
      `SELECT id, balance, created_at, updated_at
       FROM mint_credit_accounts WHERE user_id=$1`,
      [userId]
    ),
    query(
      `SELECT * FROM kyc_submissions
       WHERE user_id=$1 ORDER BY created_at DESC`,
      [userId]
    ),
    query(
      `SELECT id, title, description, cover_image_url, media_urls, tags, created_at
       FROM portfolio_items WHERE freelancer_id=$1 ORDER BY created_at DESC`,
      [userId]
    ),
  ]);

  if (!result.rows[0]) throw new AppError('User not found', 404);
  return {
    user: result.rows[0],
    wallet: walletResult.rows[0] || null,
    mint_credit_account: creditsResult.rows[0] || null,
    kyc_submissions: sanitizeSubmissions(kycResult.rows),
    portfolio_items: portfolioResult.rows,
  };
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
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'admin.created',
    entityType: 'user',
    entityId: result.rows[0].id,
    afterState: result.rows[0],
    metadata: {
      email: result.rows[0].email,
      permissions,
    },
  });

  return result.rows[0];
};

const createDesignerUser = async (adminId, { email, password, full_name }) => {
  if (!email || !password || !full_name) {
    throw new AppError('email, password, and full_name are required', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows[0]) throw new AppError('An account with this email already exists', 409);

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users
       (email, password_hash, full_name, role, is_approved, approved_by, approved_at)
     VALUES ($1, $2, $3, 'designer', true, $4, NOW())
     RETURNING id, email, full_name, role, is_approved, created_at`,
    [normalizedEmail, passwordHash, full_name.trim(), adminId]
  );

  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'designer.created',
    entityType: 'user',
    entityId: result.rows[0].id,
    afterState: result.rows[0],
    metadata: { email: result.rows[0].email },
  });

  logger.info('Designer user created', { createdBy: adminId, designerId: result.rows[0].id });
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
const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;
const qualifiedTable = (ref) => `${quoteIdent(ref.schema_name)}.${quoteIdent(ref.table_name)}`;

const getUserForeignKeyReferences = async (dbClient) => {
  const result = await dbClient.query(
    `SELECT
       con.conname,
       n.nspname AS schema_name,
       c.relname AS table_name,
       a.attname AS column_name,
       a.attnotnull
     FROM pg_constraint con
     JOIN pg_class c ON c.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid = 'public.users'::regclass
       AND cardinality(con.conkey) = 1
     ORDER BY a.attnotnull ASC, c.relname ASC`
  );
  return result.rows;
};

const deleteUserData = async (targetUserId, adminId, { confirm_email } = {}) => {
  if (targetUserId === adminId) throw new AppError('You cannot delete your own account', 400);

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const userResult = await dbClient.query(
      `SELECT id, email, full_name, role, is_super_admin, created_at
       FROM users WHERE id = $1 FOR UPDATE`,
      [targetUserId]
    );
    const user = userResult.rows[0];
    if (!user) throw new AppError('User not found', 404);
    if (user.is_super_admin) throw new AppError('Super admin accounts cannot be hard-deleted here', 403);
    if (confirm_email !== user.email) {
      throw new AppError('Type the user email exactly to confirm deletion', 400);
    }

    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'user.hard_delete.requested',
      entityType: 'user',
      entityId: targetUserId,
      beforeState: user,
    });

    const touched = [];
    const refs = await getUserForeignKeyReferences(dbClient);

    for (const ref of refs.filter(row => !row.attnotnull)) {
      const result = await dbClient.query(
        `UPDATE ${qualifiedTable(ref)} SET ${quoteIdent(ref.column_name)} = NULL WHERE ${quoteIdent(ref.column_name)} = $1`,
        [targetUserId]
      );
      if (result.rowCount) touched.push({ table: `${ref.schema_name}.${ref.table_name}`, action: 'nullified', rows: result.rowCount });
    }

    for (let pass = 0; pass < 4; pass += 1) {
      let changed = false;
      for (const ref of refs.filter(row => row.attnotnull && row.table_name !== 'users')) {
        const result = await dbClient.query(
          `DELETE FROM ${qualifiedTable(ref)} WHERE ${quoteIdent(ref.column_name)} = $1`,
          [targetUserId]
        );
        if (result.rowCount) {
          changed = true;
          touched.push({ table: `${ref.schema_name}.${ref.table_name}`, action: 'deleted', rows: result.rowCount });
        }
      }
      if (!changed) break;
    }

    const deleted = await dbClient.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, email, full_name, role`,
      [targetUserId]
    );
    if (!deleted.rows[0]) throw new AppError('User could not be deleted', 409);

    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'user.hard_deleted',
      entityType: 'user',
      entityId: targetUserId,
      beforeState: user,
      afterState: { deleted: true, touched },
    });

    await dbClient.query('COMMIT');
    logger.warn('User hard deleted by admin', { targetUserId, adminId, touched });
    return { user: deleted.rows[0], touched };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

const resetOperationalData = async (adminId, { confirm_phrase } = {}) => {
  if (confirm_phrase !== 'RESET CREATYV') {
    throw new AppError('Type RESET CREATYV exactly to confirm the clean start reset', 400);
  }

  const resetTables = [
    'audit_logs',
    'chat_rooms',
    'client_addons',
    'client_event_selections',
    'client_memberships',
    'commerce_payments',
    'creative_calendar_events',
    'creative_requests',
    'creative_tasks',
    'event_outbox',
    'job_assignments',
    'job_matches',
    'job_proposals',
    'jobs',
    'messages',
    'mint_credit_accounts',
    'mint_credit_lots',
    'mint_credit_transactions',
    'mintbox_category_shares',
    'mintbox_files',
    'mintbox_folders',
    'mintbox_revision_feedback',
    'mintbox_revision_rounds',
    'mintbox_upload_sessions',
    'notifications',
    'payment_orders',
    'reviews',
    'social_accounts',
    'social_post_media',
    'social_posts',
    'support_tickets',
    'user_presence',
    'wallet_transactions',
    'wallets',
  ];

  const dbClient = await getClient();
  let auditPayload = null;
  let resetResult = null;
  try {
    await dbClient.query('BEGIN');

    const existingTables = await dbClient.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename = ANY($1::text[])`,
      [resetTables]
    );
    const tableRefs = existingTables.rows.map((row) => `public.${quoteIdent(row.tablename)}`);
    if (tableRefs.length) {
      await dbClient.query(`TRUNCATE TABLE ${tableRefs.join(', ')} RESTART IDENTITY CASCADE`);
    }

    const refs = await getUserForeignKeyReferences(dbClient);
    const nonAdminUsers = await dbClient.query(
      `SELECT id, email, role
       FROM users
       WHERE role <> 'admin'`
    );
    const userIds = nonAdminUsers.rows.map((user) => user.id);
    const touched = [];

    if (userIds.length) {
      for (const ref of refs.filter(row => !row.attnotnull && row.table_name !== 'users')) {
        const result = await dbClient.query(
          `UPDATE ${qualifiedTable(ref)}
           SET ${quoteIdent(ref.column_name)} = NULL
           WHERE ${quoteIdent(ref.column_name)} = ANY($1::uuid[])`,
          [userIds]
        );
        if (result.rowCount) touched.push({ table: `${ref.schema_name}.${ref.table_name}`, action: 'nullified', rows: result.rowCount });
      }

      for (let pass = 0; pass < 5; pass += 1) {
        let changed = false;
        for (const ref of refs.filter(row => row.attnotnull && row.table_name !== 'users')) {
          const result = await dbClient.query(
            `DELETE FROM ${qualifiedTable(ref)}
             WHERE ${quoteIdent(ref.column_name)} = ANY($1::uuid[])`,
            [userIds]
          );
          if (result.rowCount) {
            changed = true;
            touched.push({ table: `${ref.schema_name}.${ref.table_name}`, action: 'deleted', rows: result.rowCount });
          }
        }
        if (!changed) break;
      }
    }

    const deletedUsers = await dbClient.query(
      `DELETE FROM users
       WHERE role <> 'admin'
       RETURNING id, email, role`,
    );

    await dbClient.query(
      `INSERT INTO user_presence (user_id)
       SELECT id FROM users
       ON CONFLICT (user_id) DO NOTHING`
    );

    auditPayload = {
      actorId: adminId,
      actorRole: 'admin',
      action: 'system.clean_start_reset',
      entityType: 'system',
      entityId: adminId,
      afterState: {
        truncated_tables: existingTables.rows.map((row) => row.tablename),
        deleted_users: deletedUsers.rows,
        touched,
      },
    };

    await dbClient.query('COMMIT');
    resetResult = {
      deleted_users: deletedUsers.rowCount,
      truncated_tables: existingTables.rows.map((row) => row.tablename),
      touched,
    };
    logger.warn('Operational data reset by admin', {
      adminId,
      deletedUsers: deletedUsers.rowCount,
      truncatedTables: existingTables.rowCount,
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }

  try {
    await writeAudit(auditPayload);
  } catch (error) {
    logger.error('Failed to write clean start reset audit record', {
      adminId,
      error: error.message,
    });
  }

  return resetResult;
};

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
  const [users, jobs, kyc, proposals, operations, escrow, stalled, reconciliation, outbox] = await Promise.all([
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
    query(`
      SELECT
        (SELECT COUNT(*) FROM jobs WHERE status='pending_admin_approval') AS pending_deals,
        (SELECT COUNT(*) FROM withdrawals WHERE status='pending') AS pending_withdrawals,
        (SELECT COUNT(*) FROM disputes WHERE status IN ('open','under_review')) AS open_disputes
    `),
    query(`
      SELECT COALESCE(SUM(amount),0) AS total_escrow
      FROM escrow_records WHERE status IN ('held','disputed')
    `),
    query(`
      SELECT COUNT(DISTINCT j.id) AS stalled_deliveries
      FROM jobs j
      JOIN mintbox_files file ON file.job_id=j.id AND file.purpose='delivery'
      WHERE j.status='in_progress'
        AND file.status <> 'approved'
        AND file.created_at <= NOW() - INTERVAL '48 hours'
        AND NOT EXISTS (
          SELECT 1 FROM mintbox_files newer
          WHERE newer.job_id=j.id AND newer.purpose='delivery'
            AND newer.deleted_by_client_at IS NULL
            AND newer.created_at > file.created_at
        )
    `),
    query(`
      WITH latest_transactions AS (
        SELECT DISTINCT ON (wallet_id)
          wallet_id, balance_after, escrow_after
        FROM transactions
        WHERE status = 'completed'
        ORDER BY wallet_id, created_at DESC, id DESC
      ),
      held_escrow AS (
        SELECT client_id, COALESCE(SUM(amount), 0) AS amount
        FROM escrow_records
        WHERE status IN ('held', 'disputed')
        GROUP BY client_id
      )
      SELECT COUNT(*) AS reconciliation_issues
      FROM wallets wallet
      LEFT JOIN latest_transactions latest ON latest.wallet_id = wallet.id
      LEFT JOIN held_escrow held ON held.client_id = wallet.user_id
      WHERE
        (latest.wallet_id IS NOT NULL AND (
          wallet.balance <> latest.balance_after
          OR wallet.escrow_balance <> latest.escrow_after
        ))
        OR wallet.escrow_balance <> COALESCE(held.amount, 0)
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_events,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'processing')
            AND available_at < NOW() - INTERVAL '15 minutes'
        ) AS delayed_events
      FROM event_outbox
    `),
  ]);

  const operationStats = operations.rows[0];
  const pendingActions =
    Number(kyc.rows[0].pending_kyc) +
    Number(proposals.rows[0].pending_proposals) +
    Number(operationStats.pending_deals) +
    Number(operationStats.pending_withdrawals) +
    Number(operationStats.open_disputes) +
    Number(stalled.rows[0].stalled_deliveries) +
    Number(reconciliation.rows[0].reconciliation_issues) +
    Number(outbox.rows[0].failed_events) +
    Number(outbox.rows[0].delayed_events);
  return {
    users:     users.rows[0],
    jobs:      jobs.rows[0],
    kyc:       { pending_kyc: kyc.rows[0].pending_kyc },
    proposals: { pending_proposals: proposals.rows[0].pending_proposals },
    operations: {
      ...operationStats,
      stalled_deliveries: stalled.rows[0].stalled_deliveries,
      reconciliation_issues: reconciliation.rows[0].reconciliation_issues,
      failed_events: outbox.rows[0].failed_events,
      delayed_events: outbox.rows[0].delayed_events,
      pending_actions: pendingActions,
    },
    total_escrow: Number(escrow.rows[0].total_escrow),
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
};
