const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const { enqueueOutboxEvent, dispatchOutboxImmediately } = require('../events/outbox.service');
const { getSetting } = require('../commerce/settings.service');

// ── Lazy-load matching service to avoid circular dependency ───────────────────
// Dependency chain: job.service → matching.service → negotiation.service
// negotiation.service does NOT import job.service — chain is safe.
// We use a function-level require so Node resolves it after all modules load.
const redactManagedJobForClient = (job) => {
  if (!job) return job;
  const {
    active_freelancer_id,
    backup_freelancer_id,
    assigned_by,
    deal_approved_by,
    ...safeJob
  } = job;

  return {
    ...safeJob,
    has_active_creative: Boolean(active_freelancer_id),
  };
};

// ── Internal helper ───────────────────────────────────────────────────────────

const queueMatching = async (jobId, reason) => {
  const flags = await getSetting('feature_flags', { freelancer_matching: false });
  if (flags?.freelancer_matching === false) {
    logger.info('[Jobs] Matching skipped by feature flag', { jobId, reason });
    return null;
  }
  // Fire-and-forget — never blocks the HTTP response.
  // Errors are caught and logged; they must not surface to the caller.
  await enqueueOutboxEvent('matching.run', { jobId, reason });
  await dispatchOutboxImmediately();
  logger.info(`[Jobs] Auto-matching queued (${reason})`, { jobId });
};

const getPublishedStatus = async () => {
  const flags = await getSetting('feature_flags', { freelancer_matching: false });
  return flags?.freelancer_matching === false ? 'pending_admin_approval' : 'open';
};

const normalizeBriefPricing = ({
  pricing_mode,
  budget_type,
  budget_amount,
  required_level,
  metadata,
}) => {
  const mode = pricing_mode === 'expert' ? 'expert' : 'budget';
  const normalizedBudgetType = budget_type === 'expert' ? 'expert' : 'fixed';

  return {
    pricing_mode: mode,
    budget_type: normalizedBudgetType,
    budget_amount: budget_amount === '' || budget_amount === undefined ? null : budget_amount,
    required_level: mode === 'expert' ? 'experienced' : null,
    metadata: {
      ...(metadata || {}),
      talent_pool: mode === 'expert' ? 'pro' : 'budget',
      client_budget_hidden: true,
      original_required_level: required_level || null,
    },
  };
};

// ── Create Job ────────────────────────────────────────────────────────────────

/**
 * Client creates a job → status: 'open' → matching triggers automatically.
 *
 * Jobs are created as 'open' (not draft) so matching can run immediately.
 * If your product requires a draft → publish flow, use createJobAsDraft +
 * publishJob instead. Both paths trigger matching.
 */
const createJob = async (clientId, {
  category_id,
  title,
  description,
  requirements,
  attachments,
  budget_type,
  budget_amount,
  currency,
  pricing_mode,
  required_level,
  required_skills,
  deadline,
  metadata,
}) => {
  const publishStatus = await getPublishedStatus();
  const pricing = normalizeBriefPricing({
    pricing_mode,
    budget_type,
    budget_amount,
    required_level,
    metadata,
  });

  const result = await query(
    `INSERT INTO jobs
       (client_id, category_id, title, description, requirements,
        attachments, budget_type, budget_amount, currency,
        pricing_mode, required_level, required_skills,
        deadline, metadata, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      clientId,
      category_id,
      title,
      description,
      requirements    || null,
      attachments     || [],
      pricing.budget_type,
      pricing.budget_amount,
      currency        || 'INR',
      pricing.pricing_mode,
      pricing.required_level,
      required_skills || [],
      deadline        || null,
      JSON.stringify(pricing.metadata),
      publishStatus,
    ]
  );

  const job = result.rows[0];
  logger.info('[Jobs] Job created', { jobId: job.id, clientId });

  // ── Auto-trigger matching ─────────────────────────────────────────────────
  if (job.status === 'open' && job.pricing_mode === 'budget') {
    await queueMatching(job.id, 'job_created');
  } else {
    logger.info('[Jobs] Pro brief awaiting admin matching review', { jobId: job.id, clientId });
  }

  return job;
};

// ── Create Job as Draft ───────────────────────────────────────────────────────

/**
 * Client creates a job in 'draft' status.
 * Matching does NOT run until the job is published.
 */
const createJobAsDraft = async (clientId, {
  category_id,
  title,
  description,
  requirements,
  attachments,
  budget_type,
  budget_amount,
  currency,
  pricing_mode,
  required_level,
  required_skills,
  deadline,
  metadata,
}) => {
  const pricing = normalizeBriefPricing({
    pricing_mode,
    budget_type,
    budget_amount,
    required_level,
    metadata,
  });

  const result = await query(
    `INSERT INTO jobs
       (client_id, category_id, title, description, requirements,
        attachments, budget_type, budget_amount, currency,
        pricing_mode, required_level, required_skills,
        deadline, metadata, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
     RETURNING *`,
    [
      clientId,
      category_id || null,
      title?.trim() || 'Untitled brief',
      description?.trim() || 'Brief in progress',
      requirements    || null,
      attachments     || [],
      pricing.budget_type,
      pricing.budget_amount,
      currency        || 'INR',
      pricing.pricing_mode,
      pricing.required_level,
      required_skills || [],
      deadline        || null,
      JSON.stringify(pricing.metadata),
    ]
  );

  const job = result.rows[0];
  logger.info('[Jobs] Draft job created', { jobId: job.id, clientId });
  return job;
};

// ── Publish Job ───────────────────────────────────────────────────────────────

/**
 * Client publishes a draft → status: 'open' → matching triggers automatically.
 */
const publishJob = async (clientId, jobId) => {
  const publishStatus = await getPublishedStatus();
  const result = await query(
    `UPDATE jobs
     SET status = $3
     WHERE id        = $1
       AND client_id = $2
       AND status    = 'draft'
     RETURNING *`,
    [jobId, clientId, publishStatus]
  );

  if (!result.rows[0]) {
    const existing = await query(
      `SELECT *
       FROM jobs
       WHERE id = $1
         AND client_id = $2`,
      [jobId, clientId]
    );

    const job = existing.rows[0];
    if (!job) {
      throw new AppError('Job not found or not owned by you', 404);
    }

    if (['open', 'matching'].includes(job.status)) {
      logger.info('[Jobs] Publish skipped; job already published', {
        jobId,
        clientId,
        status: job.status,
      });
      return job;
    }

    throw new AppError(
      `Job cannot be published in its current status: ${job.status}`,
      400
    );
  }

  const job = result.rows[0];
  logger.info('[Jobs] Job published', { jobId: job.id, clientId });

  // ── Auto-trigger matching ─────────────────────────────────────────────────
  if (job.status === 'open' && job.pricing_mode === 'budget') {
    await queueMatching(job.id, 'job_published');
  } else {
    logger.info('[Jobs] Pro brief awaiting admin matching review', { jobId: job.id, clientId });
  }

  return job;
};

// ── Update Job ────────────────────────────────────────────────────────────────

/**
 * Client updates a draft job.
 * Only 'draft' jobs may be edited.
 */
const updateJob = async (clientId, jobId, updates) => {
  const normalizedUpdates = { ...updates };
  if (normalizedUpdates.deadline === '') normalizedUpdates.deadline = null;
  if (
    updates.pricing_mode !== undefined ||
    updates.budget_type !== undefined ||
    updates.budget_amount !== undefined ||
    updates.required_level !== undefined ||
    updates.metadata !== undefined
  ) {
    Object.assign(normalizedUpdates, normalizeBriefPricing(updates));
  }

  const allowed = [
    'category_id', 'title', 'description', 'requirements',
    'attachments', 'budget_type', 'budget_amount', 'currency',
    'pricing_mode', 'required_level', 'required_skills',
    'deadline', 'metadata',
  ];

  const fields = [];
  const values = [];
  let   idx    = 1;

  for (const key of allowed) {
    if (normalizedUpdates[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(
        key === 'metadata' ? JSON.stringify(normalizedUpdates[key]) : normalizedUpdates[key]
      );
      idx++;
    }
  }

  if (fields.length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  values.push(jobId, clientId);

  const result = await query(
    `UPDATE jobs
     SET ${fields.join(', ')}
     WHERE id        = $${idx}
       AND client_id = $${idx + 1}
       AND status    = 'draft'
     RETURNING *`,
    values
  );

  if (!result.rows[0]) {
    throw new AppError(
      'Job not found, not owned by you, or not in draft status',
      404
    );
  }

  logger.info('[Jobs] Job updated', { jobId, clientId });
  return result.rows[0];
};

const deleteDraftJob = async (clientId, jobId) => {
  const result = await query(
    `DELETE FROM jobs
     WHERE id = $1
       AND client_id = $2
       AND status = 'draft'
     RETURNING id, title`,
    [jobId, clientId]
  );

  if (!result.rows[0]) {
    throw new AppError(
      'Draft request not found or cannot be deleted',
      404
    );
  }

  logger.info('[Jobs] Draft deleted', { jobId, clientId });
  return { deleted: true, job: result.rows[0] };
};

const pauseMatching = async (clientId, jobId) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const jobResult = await client.query(
      `SELECT *
       FROM jobs
       WHERE id = $1
         AND client_id = $2
       FOR UPDATE`,
      [jobId, clientId]
    );

    const job = jobResult.rows[0];
    if (!job) {
      throw new AppError('Job not found or not owned by you', 404);
    }

    if (job.status === 'draft') {
      await client.query('COMMIT');
      logger.info('[Jobs] Pause matching skipped; job already draft', {
        jobId,
        clientId,
      });
      return job;
    }

    if (!['open', 'matching'].includes(job.status)) {
      throw new AppError(
        `Matching cannot be paused in its current status: ${job.status}`,
        400
      );
    }

    await client.query(
      `DELETE FROM job_matched_candidates
       WHERE job_id = $1`,
      [jobId]
    );

    const updated = await client.query(
      `UPDATE jobs
       SET status = 'draft'
       WHERE id = $1
       RETURNING *`,
      [jobId]
    );

    await client.query('COMMIT');

    logger.info('[Jobs] Matching paused', { jobId, clientId });
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Cancel Job ────────────────────────────────────────────────────────────────

const cancelJob = async (requesterId, requesterRole, jobId) => {
  let result;

  if (requesterRole === 'admin') {
    result = await query(
      `UPDATE jobs
       SET status = 'cancelled'
       WHERE id     = $1
         AND status NOT IN ('completed', 'cancelled')
       RETURNING *`,
      [jobId]
    );
  } else {
    // Clients can only cancel jobs not yet in active negotiation / assignment
    result = await query(
      `UPDATE jobs
       SET status = 'cancelled'
       WHERE id        = $1
         AND client_id = $2
         AND status IN ('draft', 'open', 'matching')
       RETURNING *`,
      [jobId, requesterId]
    );
  }

  if (!result.rows[0]) {
    throw new AppError(
      'Job not found or cannot be cancelled in its current status',
      404
    );
  }

  logger.info('[Jobs] Job cancelled', {
    jobId,
    by:   requesterId,
    role: requesterRole,
  });

  return result.rows[0];
};

// ── List Jobs ─────────────────────────────────────────────────────────────────

/**
 * Role-aware job listing.
 *
 * ┌─────────────┬──────────────────────────────────────────────────────────┐
 * │ Role        │ Visibility                                               │
 * ├─────────────┼──────────────────────────────────────────────────────────┤
 * │ admin       │ ALL jobs, ALL statuses                                   │
 * │ client      │ Only their own jobs                                      │
 * │ freelancer  │ ONLY jobs where they appear in job_matched_candidates    │
 * │             │ (controlled marketplace — not an open listing)           │
 * └─────────────┴──────────────────────────────────────────────────────────┘
 */
const listJobs = async (requesterId, requesterRole, {
  page        = 1,
  limit       = 20,
  status,
  category_id,
} = {}) => {
  const offset     = (page - 1) * limit;
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  // ── Role-based base filter ────────────────────────────────────────────────
  if (requesterRole === 'client') {
    conditions.push(`j.client_id = $${idx}`);
    values.push(requesterId);
    idx++;
  } else if (requesterRole === 'freelancer') {
    // Only the current primary candidate can see/respond to a matched job.
    // Backup/candidate rows stay hidden until fallback promotes them.
    conditions.push(`j.active_freelancer_id = $${idx}`);
    values.push(requesterId);
    idx++;
  }
  // admin: no base filter — sees everything

  // ── Optional filters ──────────────────────────────────────────────────────
  if (status) {
    conditions.push(`j.status = $${idx}`);
    values.push(status);
    idx++;
  }

  if (category_id) {
    conditions.push(`j.category_id = $${idx}`);
    values.push(category_id);
    idx++;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const dataResult = await query(
    `SELECT
       j.*,
       u.full_name   AS client_name,
       cat.name      AS category_name,
       cat.slug      AS category_slug
     FROM   jobs j
     LEFT JOIN users       u   ON u.id   = j.client_id
     LEFT JOIN categories  cat ON cat.id = j.category_id
     ${whereClause}
     ORDER BY j.created_at DESC
     LIMIT  $${idx}
     OFFSET $${idx + 1}`,
    [...values, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*)
     FROM   jobs j
     ${whereClause}`,
    values
  );

  return {
    jobs: requesterRole === 'client'
      ? dataResult.rows.map(redactManagedJobForClient)
      : dataResult.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

// ── Get Single Job ────────────────────────────────────────────────────────────

/**
 * Role-aware single job fetch.
 *
 * - admin:      always succeeds
 * - client:     only their own jobs
 * - freelancer: only if they are the current primary candidate for this job
 *               → returns 404 (not 403) to avoid leaking job existence
 */
const getJobById = async (requesterId, requesterRole, jobId) => {
  const result = await query(
    `SELECT
       j.*,
       u.full_name   AS client_name,
       cat.name      AS category_name,
       cat.slug      AS category_slug
     FROM   jobs j
     LEFT JOIN users       u   ON u.id   = j.client_id
     LEFT JOIN categories  cat ON cat.id = j.category_id
     WHERE  j.id = $1`,
    [jobId]
  );

  const job = result.rows[0];
  if (!job) throw new AppError('Job not found', 404);

  // ── Access control ────────────────────────────────────────────────────────
  if (requesterRole === 'client' && job.client_id !== requesterId) {
    throw new AppError('Job not found', 404);
  }

  if (requesterRole === 'freelancer') {
    // Intentional 404 — do not reveal job exists to backup/unmatched freelancers.
    if (job.active_freelancer_id !== requesterId) {
      throw new AppError('Job not found', 404);
    }
  }

  return requesterRole === 'client' ? redactManagedJobForClient(job) : job;
};

// ── Client Job Summary ────────────────────────────────────────────────────────

const getClientJobSummary = async (clientId) => {
  const result = await query(
    `SELECT status, COUNT(*) AS count
     FROM   jobs
     WHERE  client_id = $1
     GROUP  BY status`,
    [clientId]
  );

  const summary = {
    draft:                  0,
    open:                   0,
    matching:               0,
    locked:                 0,
    pending_admin_approval: 0,
    assigned:               0,
    in_progress:            0,
    completed:              0,
    cancelled:              0,
  };

  result.rows.forEach((row) => {
    if (summary[row.status] !== undefined) {
      summary[row.status] = parseInt(row.count, 10);
    }
  });

  return summary;
};

// ── Admin: list all jobs ──────────────────────────────────────────────────────

const adminListAllJobs = async ({
  page = 1,
  limit = 20,
  status,
  category_id,
} = {}) => {
  const conditions = [];
  const values     = [];
  let   idx        = 1;

  if (status) {
    conditions.push(`j.status = $${idx}`);
    values.push(status);
    idx++;
  }

  if (category_id) {
    conditions.push(`j.category_id = $${idx}`);
    values.push(category_id);
    idx++;
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const offset = (page - 1) * limit;

  const dataResult = await query(
    `SELECT
       j.*,
       u.full_name   AS client_name,
       u.email       AS client_email,
       cat.name      AS category_name
     FROM   jobs j
     LEFT JOIN users       u   ON u.id   = j.client_id
     LEFT JOIN categories  cat ON cat.id = j.category_id
     ${whereClause}
     ORDER BY j.created_at DESC
     LIMIT  $${idx}
     OFFSET $${idx + 1}`,
    [...values, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*)
     FROM   jobs j
     ${whereClause}`,
    values
  );

  return {
    jobs: dataResult.rows,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

// ── Admin: update job status ──────────────────────────────────────────────────

const adminUpdateJobStatus = async (adminId, jobId, { status, admin_note }) => {
  const result = await query(
    `UPDATE jobs
     SET status     = $1,
         admin_note = COALESCE($2, admin_note)
     WHERE id = $3
     RETURNING *`,
    [status, admin_note || null, jobId]
  );

  if (!result.rows[0]) throw new AppError('Job not found', 404);

  logger.info('[Jobs] Admin updated job status', { jobId, status, adminId });
  return result.rows[0];
};

const approveProMatching = async (jobId, adminId) => {
  const flags = await getSetting('feature_flags', { freelancer_matching: false });
  if (flags?.freelancer_matching === false) {
    throw new AppError('Freelancer matching is disabled by feature flag', 403);
  }
  const result = await query(
    `UPDATE jobs
     SET pro_reviewed_by = $1, pro_reviewed_at = NOW()
     WHERE id = $2 AND pricing_mode = 'expert' AND status IN ('open','matching')
     RETURNING *`,
    [adminId, jobId]
  );
  if (!result.rows[0]) throw new AppError('Pro brief not found or cannot be reviewed', 404);
  await queueMatching(jobId, 'pro_admin_approved');
  return result.rows[0];
};

module.exports = {
  createJob,
  createJobAsDraft,
  publishJob,
  updateJob,
  deleteDraftJob,
  pauseMatching,
  cancelJob,
  listJobs,
  getJobById,
  getClientJobSummary,
  adminListAllJobs,
  adminUpdateJobStatus,
  approveProMatching,
};
