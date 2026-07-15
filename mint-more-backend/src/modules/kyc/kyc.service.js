const { query, getClient } = require('../../config/database');
const { uploadFile, createSignedDownloadUrl } = require('../storage/app-storage.provider');
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

const KYC_DOCUMENT_FIELDS = new Set([
  'document_front_url',
  'document_back_url',
  'selfie_url',
  'address_proof_url',
]);

const serializePrivateFileRef = (ref) => {
  if (!ref?.bucket || !ref?.path) {
    throw new AppError('KYC document storage failed', 500);
  }
  return JSON.stringify({ bucket: ref.bucket, path: ref.path });
};

const parsePrivateFileRef = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value.bucket && value.path) return value;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.bucket && parsed?.path) return parsed;
  } catch (_) {
    return null;
  }
  return null;
};

const publicKycUrlPattern = /\/storage\/v1\/object\/(?:public|sign)\/kyc-docs\//i;

const sanitizeSubmissionDocuments = (submission) => {
  if (!submission) return submission;
  const copy = { ...submission };
  for (const field of KYC_DOCUMENT_FIELDS) {
    copy[field] = Boolean(parsePrivateFileRef(copy[field]));
    copy[`${field.replace(/_url$/, '')}_available`] = copy[field];
  }
  return copy;
};

const sanitizeSubmissions = (submissions) => submissions.map(sanitizeSubmissionDocuments);

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
  // The whole verification application is reviewed once at the end.
  const basicKyc = await query(
    `SELECT status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'basic'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (!basicKyc.rows[0]) {
    throw new AppError('Submit personal details before identity documents', 400);
  }
  if (basicKyc.rows[0].status === 'rejected') {
    throw new AppError('Resubmit personal details before identity documents', 400);
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
    const ref = await uploadFile('kyc-docs', filePath, file.buffer, file.mimetype);
    return serializePrivateFileRef(ref);
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
  // Identity only needs to be submitted, not separately approved.
  const identityKyc = await query(
    `SELECT status FROM kyc_submissions
     WHERE user_id = $1 AND level = 'identity'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (!identityKyc.rows[0]) {
    throw new AppError('Submit identity documents before address proof', 400);
  }
  if (identityKyc.rows[0].status === 'rejected') {
    throw new AppError('Resubmit identity documents before address proof', 400);
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
      serializePrivateFileRef(address_proof_url),
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
    submissions:    sanitizeSubmissions(submissions.rows),
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
     WHERE ks.status = $1 AND ks.level = 'address' ${levelClause}
     ORDER BY ks.created_at ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM kyc_submissions WHERE status = 'pending' AND level = 'address'`
  );

  return {
    submissions: sanitizeSubmissions(result.rows),
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

    if (submission.level !== 'address') {
      throw new AppError('Review the completed verification application, not an individual step', 409);
    }

    // Review every section together from the final address submission.
    await client.query(
      `UPDATE kyc_submissions
       SET status = $1, admin_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE user_id = $4 AND status = 'pending'`,
      [status, admin_note || null, adminId, submission.user_id]
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
      await client.query(
        `UPDATE users
         SET kyc_level = $3, kyc_status = 'verified'
         WHERE id = $1`,
        [submission.user_id]
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

const getAdminDocumentUrl = async (submissionId, field) => {
  if (!KYC_DOCUMENT_FIELDS.has(field)) {
    throw new AppError('Invalid KYC document field', 400);
  }

  const result = await query(
    `SELECT id, ${field}
     FROM kyc_submissions
     WHERE id = $1`,
    [submissionId]
  );
  const submission = result.rows[0];
  if (!submission) throw new AppError('KYC submission not found', 404);

  const ref = parsePrivateFileRef(submission[field]);
  if (!ref) {
    throw new AppError('KYC document is unavailable or needs migration', 404);
  }
  if (ref.bucket !== 'kyc-docs') {
    throw new AppError('Invalid KYC document storage bucket', 409);
  }

  const signed_url = await createSignedDownloadUrl(ref.bucket, ref.path, 120);
  if (!signed_url) throw new AppError('KYC document is temporarily unavailable', 503);

  return {
    submission_id: submission.id,
    field,
    expires_in_seconds: 120,
    signed_url,
  };
};

const findPublicKycDocumentReferences = async () => {
  const result = await query(
    `SELECT id, user_id, level,
            document_front_url, document_back_url, selfie_url, address_proof_url
     FROM kyc_submissions
     WHERE document_front_url ILIKE '%/storage/v1/object/%kyc-docs/%'
        OR document_back_url ILIKE '%/storage/v1/object/%kyc-docs/%'
        OR selfie_url ILIKE '%/storage/v1/object/%kyc-docs/%'
        OR address_proof_url ILIKE '%/storage/v1/object/%kyc-docs/%'
     ORDER BY created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    level: row.level,
    exposed_fields: [...KYC_DOCUMENT_FIELDS].filter((field) => publicKycUrlPattern.test(row[field] || '')),
  }));
};

module.exports = {
  submitBasicKyc,
  submitIdentityKyc,
  submitAddressKyc,
  getMyKycStatus,
  getPendingSubmissions,
  reviewSubmission,
  getAdminDocumentUrl,
  findPublicKycDocumentReferences,
  sanitizeSubmissions,
};
