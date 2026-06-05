const path = require('path');
const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const {
  supabase,
  createSignedResumableUpload,
  createSignedDownloadUrls,
  storageObjectExists,
} = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const BUCKET = env.supabase.mintboxBucket;
const CLIENT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;
const BYTES_PER_GB = 1024 * 1024 * 1024;

const makeToken = () => crypto.randomBytes(24).toString('base64url');
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
    upload_policy: getUploadPolicy(),
    quota: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
    },
  };
};

const prepareUpload = async (jobId, freelancerId, role, { name, size, type, note } = {}) => {
  if (role !== 'freelancer') throw new AppError('Only freelancers can submit work files', 403);
  validateMintboxFile({ name, size, type });

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const job = await getJobForAccess(jobId, freelancerId, role, dbClient);
    if (!['assigned', 'in_progress'].includes(job.status)) {
      throw new AppError('Work can only be submitted after the assignment starts', 400);
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
    const storagePath = `${folder.storage_prefix}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    const signedUpload = await createSignedResumableUpload(BUCKET, storagePath);
    const session = await dbClient.query(
      `INSERT INTO mintbox_upload_sessions
         (folder_id, job_id, client_id, uploaded_by, original_name, storage_bucket,
          storage_path, mime_type, size_bytes, freelancer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, expires_at`,
      [
        folder.id,
        job.id,
        job.client_id,
        freelancerId,
        safeName(name),
        BUCKET,
        storagePath,
        type,
        Number(size),
        note || null,
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

const completeUpload = async (uploadId, freelancerId, role) => {
  if (role !== 'freelancer') throw new AppError('Only freelancers can complete work uploads', 403);

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const sessionResult = await dbClient.query(
      `SELECT * FROM mintbox_upload_sessions
       WHERE id = $1 AND uploaded_by = $2
       FOR UPDATE`,
      [uploadId, freelancerId]
    );
    const session = sessionResult.rows[0];
    if (!session) throw new AppError('Upload session not found', 404);
    if (session.status === 'completed') {
      const existing = await dbClient.query(
        'SELECT * FROM mintbox_files WHERE storage_path = $1',
        [session.storage_path]
      );
      await dbClient.query('COMMIT');
      return existing.rows[0];
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
          public_url, mime_type, size_bytes, freelancer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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
    await dbClient.query('COMMIT');
    logger.info('[Mintbox] Resumable upload completed', {
      jobId: session.job_id,
      freelancerId,
      fileId: inserted.rows[0].id,
    });
    return inserted.rows[0];
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const cancelUpload = async (uploadId, freelancerId, role) => {
  if (role !== 'freelancer') throw new AppError('Only freelancers can cancel work uploads', 403);
  const result = await query(
    `UPDATE mintbox_upload_sessions
     SET status = 'cancelled'
     WHERE id = $1
       AND uploaded_by = $2
       AND status = 'pending'
     RETURNING id`,
    [uploadId, freelancerId]
  );
  if (!result.rows[0]) throw new AppError('Active upload session not found', 404);
  return { upload_id: result.rows[0].id, status: 'cancelled' };
};

const listFiles = async (folderId) => {
  const result = await query(
    `SELECT mf.*, u.full_name AS uploaded_by_name, u.role AS uploaded_by_role
     FROM mintbox_files mf
     JOIN users u ON u.id = mf.uploaded_by
     WHERE mf.folder_id = $1
     ORDER BY mf.created_at DESC`,
    [folderId]
  );
  const filesByBucket = result.rows.reduce((groups, file) => {
    if (!groups[file.storage_bucket]) groups[file.storage_bucket] = [];
    groups[file.storage_bucket].push(file.storage_path);
    return groups;
  }, {});
  const signedByBucket = {};
  await Promise.all(Object.entries(filesByBucket).map(async ([bucket, paths]) => {
    signedByBucket[bucket] = await createSignedDownloadUrls(bucket, paths);
  }));
  return result.rows.map((file) => ({
    ...file,
    public_url: signedByBucket[file.storage_bucket]?.get(file.storage_path) || file.public_url,
  }));
};

const reviewFile = async (fileId, clientId, role, { action, note }) => {
  if (role !== 'client') throw new AppError('Only clients can review submitted work', 403);
  if (!['approve', 'revision'].includes(action)) {
    throw new AppError('action must be one of: approve, revision', 400);
  }

  const status = action === 'approve' ? 'approved' : 'revision_requested';
  const result = await query(
    `UPDATE mintbox_files mf
     SET status = $1,
         client_note = $2,
         reviewed_by = $3,
         reviewed_at = NOW()
     FROM mintbox_folders folder
     WHERE mf.folder_id = folder.id
       AND folder.client_id = $3
       AND mf.id = $4
     RETURNING mf.*`,
    [status, note || null, clientId, fileId]
  );

  if (!result.rows[0]) throw new AppError('File not found', 404);
  return result.rows[0];
};

module.exports = {
  CLIENT_QUOTA_BYTES,
  getUploadPolicy,
  listClientFolders,
  getFolderByJob,
  getFolderByShareToken,
  prepareUpload,
  completeUpload,
  cancelUpload,
  reviewFile,
};
