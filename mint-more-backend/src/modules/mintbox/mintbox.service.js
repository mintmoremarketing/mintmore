const path = require('path');
const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const {
  supabase,
  createSignedResumableUpload,
  createSignedDownloadUrl,
  storageObjectExists,
} = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const notificationService = require('../notifications/notification.service');
const { getWalletByUserId, recordTransaction, completeJob } = require('../wallet/wallet.service');
const reviewService = require('../reviews/review.service');

const BUCKET = env.supabase.mintboxBucket;
const CLIENT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;
const FREE_REVISION_ROUNDS = 3;
const PAID_REVISION_PRICE = 20;

const makeToken = () => crypto.randomBytes(24).toString('base64url');
const toSharedFile = (file) => ({
  ...file,
  public_url: `/mintbox/file/${file.share_token}`,
  share_url: `/mintbox/file/${file.share_token}`,
  storage_bucket: undefined,
  storage_path: undefined,
});
const safeName = (value) => String(value || 'file').replace(/[^\w.\- ]+/g, '').trim() || 'file';
const MINTBOX_MAX_FILE_BYTES = env.upload.mintboxMaxFileSizeMb * 1024 * 1024;

const getUploadPolicy = () => ({
  max_file_size_bytes: MINTBOX_MAX_FILE_BYTES,
  max_file_size_mb: env.upload.mintboxMaxFileSizeMb,
  allowed_file_types: env.upload.mintboxAllowedFileTypes,
  allowed_extensions: env.upload.mintboxAllowedExtensions,
  resumable: true,
  chunk_size_bytes: 6 * 1024 * 1024,
});

const getFileCategory = ({ name, type }) => {
  const extension = path.extname(name || '').toLowerCase();
  if (String(type || '').startsWith('image/') || ['.psd', '.ai', '.eps'].includes(extension)) return 'photos';
  if (String(type || '').startsWith('audio/')) return 'audio';
  if (String(type || '').startsWith('video/')) return 'video';
  if (['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv'].includes(extension)) return 'documents';
  if (['.zip', '.rar', '.7z'].includes(extension)) return 'archives';
  return 'other';
};

const getRevisionSummary = async (jobId) => {
  const result = await query(
    `SELECT revision.*,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', feedback.id,
                  'file_id', feedback.file_id,
                  'file_name', file.original_name,
                  'note', feedback.note,
                  'seen_by_freelancer_at', feedback.seen_by_freelancer_at,
                  'created_at', feedback.created_at
                )
                ORDER BY feedback.created_at
              ) FILTER (WHERE feedback.id IS NOT NULL),
              '[]'::jsonb
            ) AS feedback
     FROM mintbox_revision_rounds revision
     LEFT JOIN mintbox_revision_feedback feedback ON feedback.revision_id = revision.id
     LEFT JOIN mintbox_files file ON file.id = feedback.file_id
     WHERE revision.job_id = $1
     GROUP BY revision.id
     ORDER BY revision.round_number DESC`,
    [jobId]
  );
  const rounds = result.rows;
  return {
    definition: 'One revision includes all client feedback submitted within a single 24-hour window after delivery.',
    free_rounds: FREE_REVISION_ROUNDS,
    paid_revision_price: PAID_REVISION_PRICE,
    completed_rounds: rounds.filter((round) => round.status === 'delivered').length,
    active_round: rounds.find((round) => round.status !== 'delivered') || null,
    rounds,
  };
};

const validateMintboxFile = ({ name, size, type }) => {
  const fileSize = Number(size);
  if (!name || !Number.isFinite(fileSize) || fileSize <= 0) {
    throw new AppError('name and size are required', 400);
  }
  if (fileSize > MINTBOX_MAX_FILE_BYTES) {
    throw new AppError(`File is too large. Maximum size is ${env.upload.mintboxMaxFileSizeMb}MB`, 413);
  }
  const extension = path.extname(name).toLowerCase();
  const allowedMime = type && env.upload.mintboxAllowedFileTypes.includes(type);
  const allowedExtension = env.upload.mintboxAllowedExtensions.includes(extension);
  if (!allowedMime && !allowedExtension) {
    throw new AppError(`File type is not allowed: ${type || extension || 'unknown'}`, 415);
  }
};

const getClientUsage = async (clientId, dbClient = null) => {
  const executor = dbClient || { query: (sql, params) => query(sql, params) };
  const result = await executor.query(
    `SELECT COALESCE(SUM(storage_used), 0)::BIGINT AS used
     FROM mintbox_folders
     WHERE client_id = $1`,
    [clientId]
  );
  return Number(result.rows[0]?.used || 0);
};

const getClientStorageLimit = async (clientId, dbClient = null) => {
  const executor = dbClient || { query: (sql, params) => query(sql, params) };
  const result = await executor.query(
    `SELECT COALESCE(SUM(ap.storage_gb), 0)::INTEGER AS extra_gb
     FROM client_addons ca
     JOIN addon_plans ap ON ap.id = ca.addon_plan_id
     WHERE ca.user_id = $1
       AND ca.is_active = true
       AND ca.expires_at > NOW()
       AND 'mintbox_storage' = ANY(ca.features)`,
    [clientId]
  );
  return CLIENT_QUOTA_BYTES + (Number(result.rows[0]?.extra_gb || 0) * BYTES_PER_GB);
};

const getJobForAccess = async (jobId, requesterId, role, dbClient = null) => {
  const executor = dbClient || { query: (sql, params) => query(sql, params) };
  const result = await executor.query(
    `SELECT j.*, ja.freelancer_id AS assignment_freelancer_id
     FROM jobs j
     LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status IN ('accepted', 'pending_acceptance')
     WHERE j.id = $1`,
    [jobId]
  );
  const job = result.rows[0];
  if (!job) throw new AppError('Project not found', 404);

  const isClient = role === 'client' && job.client_id === requesterId;
  const isFreelancer = role === 'freelancer' && (
    job.active_freelancer_id === requesterId ||
    job.assignment_freelancer_id === requesterId
  );
  const isAdmin = role === 'admin';

  if (!isClient && !isFreelancer && !isAdmin) {
    throw new AppError('Mintbox folder not found', 404);
  }

  return job;
};

const ensureFolder = async (job, dbClient = null) => {
  const executor = dbClient || { query: (sql, params) => query(sql, params) };
  const existing = await executor.query(
    `SELECT * FROM mintbox_folders WHERE job_id = $1`,
    [job.id]
  );
  if (existing.rows[0]) return existing.rows[0];

  const token = makeToken();
  const prefix = `mintbox/${job.client_id}/${job.id}`;
  const created = await executor.query(
    `INSERT INTO mintbox_folders
       (client_id, job_id, name, share_token, storage_prefix)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [job.client_id, job.id, job.title || 'Project folder', token, prefix]
  );
  return created.rows[0];
};

const getFolderByJob = async (jobId, requesterId, role) => {
  const job = await getJobForAccess(jobId, requesterId, role);
  const folder = await ensureFolder(job);
  const files = await listFiles(folder.id);
  const used = await getClientUsage(folder.client_id);
  const limit = await getClientStorageLimit(folder.client_id);

  return {
    folder,
    files,
    category_shares: await listCategoryShares(folder.id),
    revisions: await getRevisionSummary(job.id),
    upload_policy: getUploadPolicy(),
    quota: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    },
  };
};

const listClientFolders = async (clientId, role) => {
  if (role !== 'client' && role !== 'admin') {
    throw new AppError('Only clients can view Mintbox storage overview', 403);
  }

  const jobs = await query(
    `SELECT id, client_id, title, status, created_at
     FROM jobs
     WHERE client_id = $1
     ORDER BY created_at DESC`,
    [clientId]
  );

  for (const job of jobs.rows) {
    await ensureFolder(job);
  }

  const folders = await query(
    `SELECT
       mf.*,
       j.status AS job_status,
       COUNT(files.id)::INT AS file_count,
       MAX(files.created_at) AS last_file_at
     FROM mintbox_folders mf
     JOIN jobs j ON j.id = mf.job_id
     LEFT JOIN mintbox_files files ON files.folder_id = mf.id
     WHERE mf.client_id = $1
     GROUP BY mf.id, j.status
     ORDER BY mf.created_at DESC`,
    [clientId]
  );
  const used = await getClientUsage(clientId);
  const limit = await getClientStorageLimit(clientId);

  return {
    folders: folders.rows,
    upload_policy: getUploadPolicy(),
    quota: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    },
  };
};

const getFolderByShareToken = async (token, requesterId, role) => {
  const folderResult = await query(
    `SELECT mf.*, j.client_id, j.active_freelancer_id, j.status AS job_status
     FROM mintbox_folders mf
     JOIN jobs j ON j.id = mf.job_id
     WHERE mf.share_token = $1`,
    [token]
  );
  const folder = folderResult.rows[0];
  if (!folder) throw new AppError('Mintbox folder not found', 404);

  await getJobForAccess(folder.job_id, requesterId, role);
  const files = await listFiles(folder.id);
  const used = await getClientUsage(folder.client_id);
  const limit = await getClientStorageLimit(folder.client_id);

  return {
    folder,
    files,
    category_shares: await listCategoryShares(folder.id),
    revisions: await getRevisionSummary(folder.job_id),
    upload_policy: getUploadPolicy(),
    quota: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    },
  };
};

const getPublicFolderByShareToken = async (token) => {
  const folderResult = await query(
    `SELECT mf.*, j.title AS job_title
     FROM mintbox_folders mf
     JOIN jobs j ON j.id = mf.job_id
     WHERE mf.share_token = $1`,
    [token]
  );
  const folder = folderResult.rows[0];
  if (!folder) throw new AppError('Mintbox folder not found', 404);
  const files = await listFiles(folder.id);
  return { folder, files, category_shares: await listCategoryShares(folder.id) };
};

const getPublicCategoryByShareToken = async (token) => {
  const result = await query(
    `SELECT share.*, folder.name, folder.job_id
     FROM mintbox_category_shares share
     JOIN mintbox_folders folder ON folder.id = share.folder_id
     WHERE share.share_token = $1`,
    [token]
  );
  const share = result.rows[0];
  if (!share) throw new AppError('Shared folder not found', 404);
  return {
    folder: { id: share.folder_id, job_id: share.job_id, name: `${share.name} / ${share.category}`, shared_category: share.category },
    files: await listFiles(share.folder_id, share.category),
    category_shares: [],
  };
};

const prepareUpload = async (jobId, uploaderId, role, { name, size, type, note, purpose = 'delivery' } = {}) => {
  if (!['client', 'freelancer'].includes(role)) throw new AppError('Only project participants can upload files', 403);
  const uploadPurpose = role === 'client' ? 'brief' : 'delivery';
  validateMintboxFile({ name, size, type });

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const job = await getJobForAccess(jobId, uploaderId, role, dbClient);
    if (role === 'freelancer' && !['assigned', 'in_progress'].includes(job.status)) {
      throw new AppError('Work can only be submitted after the assignment starts', 400);
    }
    if (role === 'client' && !['draft', 'open', 'matching'].includes(job.status)) {
      throw new AppError('Brief references can only be added before negotiation starts', 400);
    }

    await dbClient.query('SELECT pg_advisory_xact_lock(hashtext($1))', [job.client_id]);
    await dbClient.query(
      `UPDATE mintbox_upload_sessions
       SET status = 'expired'
       WHERE client_id = $1
         AND status = 'pending'
         AND expires_at <= NOW()`,
      [job.client_id]
    );
    const folder = await ensureFolder(job, dbClient);
    const used = await getClientUsage(job.client_id, dbClient);
    const limit = await getClientStorageLimit(job.client_id, dbClient);
    const reservedResult = await dbClient.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::BIGINT AS reserved
       FROM mintbox_upload_sessions
       WHERE client_id = $1
         AND status = 'pending'
         AND expires_at > NOW()`,
      [job.client_id]
    );
    const reserved = Number(reservedResult.rows[0]?.reserved || 0);
    if (used + reserved + Number(size) > limit) {
      throw new AppError('Client Mintbox storage does not have enough available space', 400);
    }

    const ext = path.extname(safeName(name)).toLowerCase();
    const fileCategory = getFileCategory({ name, type });
    const activeRevision = role === 'freelancer' ? await dbClient.query(
      `SELECT round_number
       FROM mintbox_revision_rounds
       WHERE job_id = $1 AND status IN ('feedback_open', 'awaiting_delivery')
       ORDER BY round_number DESC LIMIT 1`,
      [job.id]
    ) : { rows: [] };
    const revisionRound = activeRevision.rows[0]?.round_number || null;
    const storagePath = `${folder.storage_prefix}/${uploadPurpose}/${fileCategory}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    const signedUpload = await createSignedResumableUpload(BUCKET, storagePath);
    const session = await dbClient.query(
      `INSERT INTO mintbox_upload_sessions
         (folder_id, job_id, client_id, uploaded_by, original_name, storage_bucket,
          storage_path, mime_type, size_bytes, freelancer_note, file_category, revision_round, purpose)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, expires_at`,
      [
        folder.id,
        job.id,
        job.client_id,
        uploaderId,
        safeName(name),
        BUCKET,
        storagePath,
        type,
        Number(size),
        note || null,
        fileCategory,
        revisionRound,
        uploadPurpose,
      ]
    );

    await dbClient.query('COMMIT');
    return {
      upload_id: session.rows[0].id,
      expires_at: session.rows[0].expires_at,
      bucket: BUCKET,
      storage_path: storagePath,
      ...signedUpload,
      policy: getUploadPolicy(),
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const completeUpload = async (uploadId, uploaderId, role) => {
  if (!['client', 'freelancer'].includes(role)) throw new AppError('Only project participants can complete uploads', 403);

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const sessionResult = await dbClient.query(
      `SELECT * FROM mintbox_upload_sessions
       WHERE id = $1 AND uploaded_by = $2
       FOR UPDATE`,
      [uploadId, uploaderId]
    );
    const session = sessionResult.rows[0];
    if (!session) throw new AppError('Upload session not found', 404);
    if (session.status === 'completed') {
      const existing = await dbClient.query(
        'SELECT * FROM mintbox_files WHERE storage_path = $1',
        [session.storage_path]
      );
      await dbClient.query('COMMIT');
      return toSharedFile(existing.rows[0]);
    }
    if (session.status !== 'pending' || new Date(session.expires_at) <= new Date()) {
      throw new AppError('Upload session has expired', 410);
    }

    const exists = await storageObjectExists(session.storage_bucket, session.storage_path);
    if (!exists) throw new AppError('Upload has not finished yet', 409);

    const { data: urlData } = supabase.storage
      .from(session.storage_bucket)
      .getPublicUrl(session.storage_path);
    const inserted = await dbClient.query(
      `INSERT INTO mintbox_files
         (folder_id, job_id, uploaded_by, original_name, storage_bucket, storage_path,
          public_url, mime_type, size_bytes, freelancer_note, file_category, revision_round, purpose)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (storage_path) DO UPDATE SET storage_path = EXCLUDED.storage_path
       RETURNING *`,
      [
        session.folder_id,
        session.job_id,
        session.uploaded_by,
        session.original_name,
        session.storage_bucket,
        session.storage_path,
        urlData.publicUrl,
        session.mime_type,
        session.size_bytes,
        session.freelancer_note,
        session.file_category,
        session.revision_round,
        session.purpose,
      ]
    );

    await dbClient.query(
      `UPDATE mintbox_folders
       SET storage_used = storage_used + $1
       WHERE id = $2`,
      [session.size_bytes, session.folder_id]
    );
    await dbClient.query(
      `UPDATE mintbox_upload_sessions
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [session.id]
    );
    await dbClient.query(
      `INSERT INTO mintbox_category_shares (folder_id, category)
       VALUES ($1, $2)
       ON CONFLICT (folder_id, category) DO NOTHING`,
      [session.folder_id, session.purpose === 'brief' ? 'brief' : session.file_category]
    );
    let deliveredRevision = null;
    if (session.revision_round) {
      const delivered = await dbClient.query(
        `UPDATE mintbox_revision_rounds
         SET status = 'delivered', delivered_at = NOW()
         WHERE job_id = $1 AND round_number = $2 AND status <> 'delivered'
         RETURNING *`,
        [session.job_id, session.revision_round]
      );
      deliveredRevision = delivered.rows[0] || null;
    }
    await dbClient.query('COMMIT');
    logger.info('[Mintbox] Resumable upload completed', {
      jobId: session.job_id,
      uploaderId,
      fileId: inserted.rows[0].id,
    });
    if (role === 'freelancer') {
      const job = await query('SELECT title, client_id FROM jobs WHERE id = $1', [session.job_id]);
      notificationService.createNotification({
        userId: job.rows[0].client_id,
        type: deliveredRevision ? 'revision_delivered' : 'work_delivered',
        title: deliveredRevision ? `Revision ${deliveredRevision.round_number} delivered` : 'New work delivered',
        body: `New work for "${job.rows[0].title}" is ready in Mintbox.`,
        entityType: 'job',
        entityId: session.job_id,
        data: { job_id: session.job_id, revision_round: deliveredRevision?.round_number || null },
      });
    }
    return toSharedFile(inserted.rows[0]);
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const cancelUpload = async (uploadId, uploaderId, role) => {
  if (!['client', 'freelancer'].includes(role)) throw new AppError('Only project participants can cancel uploads', 403);
  const result = await query(
    `UPDATE mintbox_upload_sessions
     SET status = 'cancelled'
     WHERE id = $1
       AND uploaded_by = $2
       AND status = 'pending'
     RETURNING id`,
    [uploadId, uploaderId]
  );
  if (!result.rows[0]) throw new AppError('Active upload session not found', 404);
  return { upload_id: result.rows[0].id, status: 'cancelled' };
};

const listFiles = async (folderId, category = null) => {
  const result = await query(
    `SELECT mf.*, u.full_name AS uploaded_by_name, u.role AS uploaded_by_role
     FROM mintbox_files mf
     JOIN users u ON u.id = mf.uploaded_by
     WHERE mf.folder_id = $1
       AND mf.deleted_by_client_at IS NULL
       AND ($2::VARCHAR IS NULL OR CASE WHEN mf.purpose = 'brief' THEN 'brief' ELSE mf.file_category END = $2)
     ORDER BY mf.created_at DESC`,
    [folderId, category]
  );
  return result.rows.map(toSharedFile);
};

const listCategoryShares = async (folderId) => {
  const categories = await query(
    `SELECT DISTINCT CASE WHEN purpose = 'brief' THEN 'brief' ELSE file_category END AS category
     FROM mintbox_files
     WHERE folder_id = $1 AND deleted_by_client_at IS NULL`,
    [folderId]
  );
  for (const row of categories.rows) {
    await query(
      `INSERT INTO mintbox_category_shares (folder_id, category)
       VALUES ($1, $2)
       ON CONFLICT (folder_id, category) DO NOTHING`,
      [folderId, row.category]
    );
  }
  const result = await query(
    `SELECT category, share_token
     FROM mintbox_category_shares
     WHERE folder_id = $1
     ORDER BY category`,
    [folderId]
  );
  return result.rows.map((share) => ({
    ...share,
    share_url: `/mintbox/share-category/${share.share_token}`,
  }));
};

const getPublicFile = async (token) => {
  const result = await query(
    `SELECT id, original_name, storage_bucket, storage_path, mime_type, size_bytes,
            file_category, created_at
     FROM mintbox_files
     WHERE share_token = $1 AND deleted_by_client_at IS NULL`,
    [token]
  );
  const file = result.rows[0];
  if (!file) throw new AppError('Shared file not found', 404);
  return file;
};

const getPublicFileStream = async (token) => {
  const file = await getPublicFile(token);
  const signedUrl = await createSignedDownloadUrl(file.storage_bucket, file.storage_path, 60);
  if (!signedUrl) throw new AppError('File is temporarily unavailable', 503);
  return { file, signedUrl };
};

const markSeen = async (jobId, requesterId, role) => {
  const job = await getJobForAccess(jobId, requesterId, role);
  if (!['client', 'freelancer'].includes(role)) return { updated: 0 };

  const field = role === 'client' ? 'seen_by_client_at' : 'seen_by_freelancer_at';
  const result = await query(
    `UPDATE mintbox_files
     SET ${field} = COALESCE(${field}, NOW())
     WHERE job_id = $1 AND uploaded_by <> $2 AND ${field} IS NULL
     RETURNING uploaded_by`,
    [jobId, requesterId]
  );

  let feedbackResult = { rows: [] };
  if (role === 'freelancer') {
    feedbackResult = await query(
      `UPDATE mintbox_revision_feedback feedback
       SET seen_by_freelancer_at = COALESCE(seen_by_freelancer_at, NOW())
       FROM mintbox_revision_rounds revision
       WHERE feedback.revision_id = revision.id
         AND revision.job_id = $1
         AND feedback.seen_by_freelancer_at IS NULL
       RETURNING feedback.client_id`,
      [jobId]
    );
  }

  const recipients = [...new Set([
    ...result.rows.map((row) => row.uploaded_by),
    ...feedbackResult.rows.map((row) => row.client_id),
  ])];
  recipients.forEach((userId) => notificationService.createNotification({
    userId,
    type: 'mintbox_seen',
    title: role === 'client' ? 'Client viewed your delivery' : 'Creative viewed your feedback',
    body: `"${job.title}" was viewed in Mintbox.`,
    entityType: 'job',
    entityId: jobId,
    data: { job_id: jobId, seen_by_role: role },
  }));
  return { updated: result.rowCount };
};

const reviewFile = async (fileId, clientId, role, { action, note }) => {
  if (role !== 'client') throw new AppError('Only clients can review submitted work', 403);
  if (!['approve', 'revision'].includes(action)) {
    throw new AppError('action must be one of: approve, revision', 400);
  }

  if (action === 'revision' && !String(note || '').trim()) {
    throw new AppError('Tell the creative what needs to change', 400);
  }

  const dbClient = await getClient();
  let result;
  let revision = null;
  try {
    await dbClient.query('BEGIN');
    const fileResult = await dbClient.query(
      `SELECT mf.*, folder.client_id, j.title, j.active_freelancer_id
       FROM mintbox_files mf
       JOIN mintbox_folders folder ON folder.id = mf.folder_id
       JOIN jobs j ON j.id = mf.job_id
       WHERE mf.id = $1 AND folder.client_id = $2
       FOR UPDATE`,
      [fileId, clientId]
    );
    const file = fileResult.rows[0];
    if (!file) throw new AppError('File not found', 404);

    if (action === 'revision') {
      const openResult = await dbClient.query(
        `SELECT * FROM mintbox_revision_rounds
         WHERE job_id = $1
           AND status IN ('feedback_open', 'awaiting_delivery')
         ORDER BY round_number DESC LIMIT 1
         FOR UPDATE`,
        [file.job_id]
      );
      revision = openResult.rows[0];
      if (revision && new Date(revision.feedback_window_ends_at) <= new Date()) {
        await dbClient.query(
          `UPDATE mintbox_revision_rounds SET status = 'awaiting_delivery' WHERE id = $1`,
          [revision.id]
        );
        throw new AppError('The 24-hour feedback window has closed. Wait for the revised delivery before starting another revision.', 409);
      }

      if (!revision) {
        const countResult = await dbClient.query(
          'SELECT COALESCE(MAX(round_number), 0)::INTEGER AS count FROM mintbox_revision_rounds WHERE job_id = $1',
          [file.job_id]
        );
        const roundNumber = Number(countResult.rows[0].count) + 1;
        const charge = roundNumber > FREE_REVISION_ROUNDS ? PAID_REVISION_PRICE : 0;

        if (charge > 0) {
          const clientWallet = await getWalletByUserId(clientId, dbClient, true);
          const freelancerWallet = await getWalletByUserId(file.active_freelancer_id, dbClient, true);
          await recordTransaction(dbClient, {
            walletId: clientWallet.id, userId: clientId, type: 'adjustment', amount: -charge,
            referenceId: file.job_id, referenceType: 'revision',
            description: `Paid revision ${roundNumber}`, metadata: { revision_round: roundNumber },
          });
          await recordTransaction(dbClient, {
            walletId: freelancerWallet.id, userId: file.active_freelancer_id, type: 'adjustment', amount: charge,
            referenceId: file.job_id, referenceType: 'revision',
            description: `Paid revision ${roundNumber}`, metadata: { revision_round: roundNumber },
          });
        }

        const created = await dbClient.query(
          `INSERT INTO mintbox_revision_rounds
             (job_id, folder_id, client_id, freelancer_id, round_number,
              feedback_window_ends_at, charge_amount, charged_at)
           VALUES ($1,$2,$3,$4,$5,NOW() + INTERVAL '24 hours',$6::NUMERIC,
                   CASE WHEN $6::NUMERIC > 0 THEN NOW() ELSE NULL END)
           RETURNING *`,
          [file.job_id, file.folder_id, clientId, file.active_freelancer_id, roundNumber, charge]
        );
        revision = created.rows[0];
      }

      await dbClient.query(
        `INSERT INTO mintbox_revision_feedback (revision_id, file_id, client_id, note)
         VALUES ($1,$2,$3,$4)`,
        [revision.id, file.id, clientId, String(note).trim()]
      );
    }

    const status = action === 'approve' ? 'approved' : 'revision_requested';
    result = await dbClient.query(
      `UPDATE mintbox_files
       SET status = $1, client_note = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, note || null, clientId, fileId]
    );
    await dbClient.query('COMMIT');

    if (action === 'revision') {
      notificationService.createNotification({
        userId: file.active_freelancer_id,
        type: 'revision_requested',
        title: `Revision ${revision.round_number} requested`,
        body: `The client added feedback for "${file.title}". Open Mintbox to review it.`,
        entityType: 'job',
        entityId: file.job_id,
        data: { job_id: file.job_id, revision_round: revision.round_number, charge_amount: revision.charge_amount },
      });
      logger.info('[Mintbox] Revision requested', {
        jobId: file.job_id, fileId, revisionRound: revision.round_number, chargeAmount: revision.charge_amount,
      });
    }
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  return { ...result.rows[0], revision };
};

const completeProject = async (jobId, clientId, role, review = {}) => {
  if (role !== 'client') throw new AppError('Only the client can complete this project', 403);

  const ratings = [
    review.rating_overall,
    review.rating_communication,
    review.rating_quality,
    review.rating_value,
  ].map(Number);
  if (ratings.some((rating) => !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new AppError('Rate every category from 1 to 5 before completing the project', 400);
  }

  const result = await query(
    `SELECT j.id, j.status, j.active_freelancer_id,
            EXISTS (
              SELECT 1 FROM mintbox_files file
              WHERE file.job_id = j.id
                AND file.purpose = 'delivery'
                AND file.status = 'approved'
            ) AS has_approved_delivery
     FROM jobs j
     WHERE j.id = $1 AND j.client_id = $2`,
    [jobId, clientId]
  );
  const job = result.rows[0];
  if (!job) throw new AppError('Project not found', 404);
  if (job.status !== 'in_progress') {
    throw new AppError(`Project cannot be completed in its current status: ${job.status}`, 400);
  }
  if (!job.active_freelancer_id) throw new AppError('No creative is assigned to this project', 400);
  if (!job.has_approved_delivery) throw new AppError('Approve a delivery before completing the project', 400);

  const completion = await completeJob(jobId, clientId, {
    completion_note: String(review.review_text || '').trim() || null,
  });
  const submittedReview = await reviewService.submitReview(clientId, {
    freelancer_id: job.active_freelancer_id,
    job_id: jobId,
    rating_overall: ratings[0],
    rating_communication: ratings[1],
    rating_quality: ratings[2],
    rating_value: ratings[3],
    review_text: String(review.review_text || '').trim() || null,
  });
  notificationService.createNotification({
    userId: job.active_freelancer_id,
    type: 'job_completed',
    title: 'Project completed',
    body: 'The client completed the project. Payment has been released to your wallet.',
    entityType: 'job',
    entityId: jobId,
    data: { job_id: jobId },
  });

  return { completion, review: submittedReview };
};

module.exports = {
  CLIENT_QUOTA_BYTES,
  getUploadPolicy,
  listClientFolders,
  getFolderByJob,
  getFolderByShareToken,
  getPublicFolderByShareToken,
  getPublicCategoryByShareToken,
  getPublicFile,
  getPublicFileStream,
  prepareUpload,
  completeUpload,
  cancelUpload,
  reviewFile,
  markSeen,
  completeProject,
};
