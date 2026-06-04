const path = require('path');
const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const { uploadFile } = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const BUCKET = 'job-attachments';
const CLIENT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024;

const makeToken = () => crypto.randomBytes(24).toString('base64url');
const safeName = (value) => String(value || 'file').replace(/[^\w.\- ]+/g, '').trim() || 'file';

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

const getJobForAccess = async (jobId, requesterId, role, dbClient = null) => {
  const executor = dbClient || { query: (sql, params) => query(sql, params) };
  const result = await executor.query(
    `SELECT j.*, ja.freelancer_id AS assignment_freelancer_id
     FROM jobs j
     LEFT JOIN job_assignments ja ON ja.job_id = j.id AND ja.status IN ('accepted', 'in_progress', 'pending_acceptance')
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

  return {
    folder,
    files,
    quota: {
      used,
      limit: CLIENT_QUOTA_BYTES,
      remaining: Math.max(0, CLIENT_QUOTA_BYTES - used),
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

  return {
    folder,
    files,
    quota: {
      used,
      limit: CLIENT_QUOTA_BYTES,
      remaining: Math.max(0, CLIENT_QUOTA_BYTES - used),
    },
  };
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
  return result.rows;
};

const uploadWork = async (jobId, freelancerId, role, file, { note } = {}) => {
  if (role !== 'freelancer') throw new AppError('Only freelancers can submit work files', 403);
  if (!file) throw new AppError('file is required', 400);

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const job = await getJobForAccess(jobId, freelancerId, role, dbClient);
    if (!['assigned', 'in_progress'].includes(job.status)) {
      throw new AppError('Work can only be submitted after the assignment starts', 400);
    }

    const folder = await ensureFolder(job, dbClient);
    const used = await getClientUsage(job.client_id, dbClient);
    if (used + file.size > CLIENT_QUOTA_BYTES) {
      throw new AppError('Client Mintbox storage is full. Ask the client to free up space or upgrade storage.', 400);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const storagePath = `${folder.storage_prefix}/${Date.now()}-${crypto.randomUUID()}${ext}`;
    const publicUrl = await uploadFile(BUCKET, storagePath, file.buffer, file.mimetype);

    const inserted = await dbClient.query(
      `INSERT INTO mintbox_files
         (folder_id, job_id, uploaded_by, original_name, storage_bucket, storage_path,
          public_url, mime_type, size_bytes, freelancer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        folder.id,
        job.id,
        freelancerId,
        safeName(file.originalname),
        BUCKET,
        storagePath,
        publicUrl,
        file.mimetype,
        file.size,
        note || null,
      ]
    );

    await dbClient.query(
      `UPDATE mintbox_folders
       SET storage_used = storage_used + $1
       WHERE id = $2`,
      [file.size, folder.id]
    );

    await dbClient.query('COMMIT');
    logger.info('[Mintbox] Work uploaded', { jobId, freelancerId, fileId: inserted.rows[0].id });
    return inserted.rows[0];
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
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
  getFolderByJob,
  getFolderByShareToken,
  uploadWork,
  reviewFile,
};
