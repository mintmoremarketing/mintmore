const { query, getClient } = require('../../config/database');
const { uploadFile } = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { notifyKycReviewed } = require('../notifications/notification.triggers');

/**
 * KYC Level progression order.
 * A user must complete lower levels before submitting higher ones.
 */
const KYC_LEVEL_ORDER = { basic: 1, identity: 2, address: 3 };

/**
 * Map KYC level to the kyc_status field value on users table.
 */
const KYC_STATUS_MAP = {
  basic:    'pending',
  identity: 'pending',
  address:  'pending',
};

/**
 * Submit Basic KYC — personal info only, no documents.
 */
const submitBasicKyc = async (userId, data) => {
  // Check if already approved at this level
  const existing = await query(
    `SELECT id, status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'basic'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (existing.rows[0]?.status === 'approved') {
    throw new AppError('Basic KYC already approved', 409);
  }

  if (existing.rows[0]?.status === 'pending') {
    throw new AppError('Basic KYC already submitted and under review', 409);
  }

  const result = await query(
    `INSERT INTO kyc_submissions
       (user_id, level, date_of_birth, gender, nationality)
     VALUES ($1, 'basic', $2, $3, $4)
     RETURNING *`,
    [userId, data.date_of_birth, data.gender, data.nationality]
  );

  // Update user kyc_status to pending
  await query(
    `UPDATE users SET kyc_status = 'pending' WHERE id = $1`,
    [userId]
  );

  logger.info('Basic KYC submitted', { userId });
  return result.rows[0];
};

/**
 * Submit Identity KYC — requires document images.
 * files: { document_front, document_back, selfie }
 */
const submitIdentityKyc = async (userId, data, files) => {
  // Must have basic KYC approved first
  const basicKyc = await query(
    `SELECT status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'basic' AND status = 'approved'`,
    [userId]
  );

  if (!basicKyc.rows[0]) {
    throw new AppError('You must complete Basic KYC before submitting Identity KYC', 400);
  }

  // Check existing identity submission
  const existing = await query(
    `SELECT status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'identity'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (existing.rows[0]?.status === 'approved') {
    throw new AppError('Identity KYC already approved', 409);
  }
  if (existing.rows[0]?.status === 'pending') {
    throw new AppError('Identity KYC already submitted and under review', 409);
  }

  // Upload documents to Supabase Storage (private bucket)
  const uploadDoc = async (file, name) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const filePath = `${userId}/${name}-${uuidv4()}${ext}`;
    return uploadFile('kyc-docs', filePath, file.buffer, file.mimetype);
  };

  if (!files.document_front?.[0]) {
    throw new AppError('document_front image is required', 400);
  }
  if (!files.selfie?.[0]) {
    throw new AppError('selfie image is required', 400);
  }

  const document_front_url = await uploadDoc(files.document_front[0], 'doc-front');
  const document_back_url  = files.document_back?.[0]
    ? await uploadDoc(files.document_back[0], 'doc-back')
    : null;
  const selfie_url = await uploadDoc(files.selfie[0], 'selfie');

  const result = await query(
    `INSERT INTO kyc_submissions
       (user_id, level, document_type, document_number,
        document_front_url, document_back_url, selfie_url)
     VALUES ($1, 'identity', $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      data.document_type,
      data.document_number,
      document_front_url,
      document_back_url,
      selfie_url,
    ]
  );

  logger.info('Identity KYC submitted', { userId, document_type: data.document_type });
  return result.rows[0];
};

/**
 * Submit Address KYC — requires address proof document.
 * files: { address_proof }
 */
const submitAddressKyc = async (userId, data, files) => {
  // Must have identity KYC approved first
  const identityKyc = await query(
    `SELECT status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'identity' AND status = 'approved'`,
    [userId]
  );

  if (!identityKyc.rows[0]) {
    throw new AppError('You must complete Identity KYC before submitting Address KYC', 400);
  }

  const existing = await query(
    `SELECT status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'address'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (existing.rows[0]?.status === 'approved') {
    throw new AppError('Address KYC already approved', 409);
  }
  if (existing.rows[0]?.status === 'pending') {
    throw new AppError('Address KYC already submitted and under review', 409);
  }

  if (!files.address_proof?.[0]) {
    throw new AppError('address_proof document is required', 400);
  }

  const ext = path.extname(files.address_proof[0].originalname).toLowerCase() || '.jpg';
  const filePath = `${userId}/address-proof-${uuidv4()}${ext}`;
  const address_proof_url = await uploadFile(
    'kyc-docs',
    filePath,
    files.address_proof[0].buffer,
    files.address_proof[0].mimetype
  );

  const result = await query(
    `INSERT INTO kyc_submissions
       (user_id, level, address_line1, address_line2,
        city, state, pincode, country, address_proof_url)
     VALUES ($1, 'address', $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      data.address_line1,
      data.address_line2 || null,
      data.city,
      data.state,
      data.pincode,
      data.country || 'India',
      address_proof_url,
    ]
  );

  logger.info('Address KYC submitted', { userId });
  return result.rows[0];
};

/**
 * Get all KYC submissions for the logged-in user.
 */
const getMyKycStatus = async (userId) => {
  const submissions = await query(
    `SELECT id, level, status, admin_note, created_at, reviewed_at
     FROM kyc_submissions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  const userResult = await query(
    'SELECT role, kyc_status, kyc_level FROM users WHERE id = $1',
    [userId]
  );
  const portfolioResult = userResult.rows[0]?.role === 'freelancer'
    ? await query('SELECT COUNT(*)::int AS count FROM portfolio_items WHERE freelancer_id = $1', [userId])
    : { rows: [{ count: 0 }] };

  return {
    role: userResult.rows[0]?.role,
    overall_status: userResult.rows[0]?.kyc_status,
    current_level:  userResult.rows[0]?.kyc_level,
    submissions:    submissions.rows,
    portfolio_count: Number(portfolioResult.rows[0]?.count || 0),
    required_portfolio_count: userResult.rows[0]?.role === 'freelancer' ? 3 : 0,
  };
};

/**
 * ADMIN: Get all pending KYC submissions (paginated).
 */
const getPendingSubmissions = async ({ page = 1, limit = 20, level } = {}) => {
  const offset = (page - 1) * limit;
  const params = ['pending'];
  let levelClause = '';

  if (level) {
    params.push(level);
    levelClause = `AND ks.level = $${params.length}`;
  }

  params.push(limit, offset);

  const result = await query(
    `SELECT
       ks.*,
       u.full_name, u.email, u.phone, u.role,
       CASE WHEN u.role = 'freelancer' THEN
         (SELECT COUNT(*)::int FROM portfolio_items pi WHERE pi.freelancer_id = u.id)
       ELSE 0 END AS portfolio_count
     FROM kyc_submissions ks
     JOIN users u ON u.id = ks.user_id
     WHERE ks.status = $1 ${levelClause}
     ORDER BY ks.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM kyc_submissions WHERE status = 'pending'`
  );

  return {
    submissions: result.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

/**
 * ADMIN: Approve or reject a KYC submission.
 * Uses a transaction to keep kyc_submissions + users table in sync.
 */
const reviewSubmission = async (submissionId, adminId, { status, admin_note }) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Fetch the submission
    const subResult = await client.query(
      'SELECT * FROM kyc_submissions WHERE id = $1 FOR UPDATE',
      [submissionId]
    );

    const submission = subResult.rows[0];
    if (!submission) throw new AppError('Submission not found', 404);
    if (submission.status !== 'pending') {
      throw new AppError(`Submission is already ${submission.status}`, 409);
    }

    // 2. Update submission status
    await client.query(
      `UPDATE kyc_submissions
       SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4`,
      [status, admin_note || null, adminId, submissionId]
    );

    if (status === 'approved') {
      if (submission.level === 'address') {
        const target = await client.query('SELECT role FROM users WHERE id = $1', [submission.user_id]);
        if (target.rows[0]?.role === 'freelancer') {
          const portfolio = await client.query(
            'SELECT COUNT(*)::int AS count FROM portfolio_items WHERE freelancer_id = $1',
            [submission.user_id]
          );
          if (Number(portfolio.rows[0]?.count || 0) < 3) {
            throw new AppError('Freelancer must submit at least 3 portfolio work samples before final verification', 409);
          }
        }
      }
      // 3. Always sync BOTH kyc_level AND kyc_status together.
      //
      //    Rule:
      //    - kyc_level  = the level just approved (basic / identity / address)
      //    - kyc_status = 'verified' when ALL 3 levels approved, else 'pending'
      //
      //    Fetch previously approved levels (excluding current submission
      //    since it was 'pending' until the UPDATE above).

      const prevApproved = await client.query(
        `SELECT level FROM kyc_submissions
         WHERE user_id = $1
           AND status = 'approved'
           AND id != $2`,
        [submission.user_id, submissionId]
      );

      const approvedLevels = new Set(prevApproved.rows.map((r) => r.level));
      approvedLevels.add(submission.level); // add the one just approved

      const isFullyVerified =
        approvedLevels.has('basic') &&
        approvedLevels.has('identity') &&
        approvedLevels.has('address');

      // Always update BOTH fields — they must never be out of sync
      await client.query(
        `UPDATE users
         SET kyc_level  = $1,
             kyc_status = $2
         WHERE id = $3`,
        [
          submission.level,                          // kyc_level = this submission's level
          isFullyVerified ? 'verified' : 'pending',  // kyc_status = verified only when all 3 done
          submission.user_id,
        ]
      );
    }

    if (status === 'rejected') {
      // On rejection — mark status as rejected, do NOT change kyc_level
      // (level reflects last approved level, not the rejected attempt)
      await client.query(
        `UPDATE users
         SET kyc_status = 'rejected'
         WHERE id = $1`,
        [submission.user_id]
      );
    }

    await client.query('COMMIT');

    // Fire notification — post-commit, non-blocking
    setImmediate(async () => {
      try {
        await notifyKycReviewed({
          userId:    submission.user_id,
          level:     submission.level,
          status,
          adminNote: admin_note || null,
        });
      } catch (err) {
        logger.error('KYC notification trigger failed', { error: err.message });
      }
    });

    logger.info('KYC submission reviewed', {
      submissionId,
      adminId,
      status,
      userId: submission.user_id,
      level: submission.level,
    });

    const updated = await query(
      'SELECT * FROM kyc_submissions WHERE id = $1',
      [submissionId]
    );
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  submitBasicKyc,
  submitIdentityKyc,
  submitAddressKyc,
  getMyKycStatus,
  getPendingSubmissions,
  reviewSubmission,
};
