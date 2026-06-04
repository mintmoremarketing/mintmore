const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const triggers = require('../notifications/notification.triggers');
const { holdEscrow, getWalletByUserId } = require('../wallet/wallet.service');
const { createChatRoom } = require('../chat/chat.service');

const MAX_ROUNDS = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lock the job row for the duration of a transaction.
 *
 * FIX: Previous version used LEFT JOIN inside FOR UPDATE, which PostgreSQL
 * rejects: "FOR UPDATE cannot be applied to the nullable side of an outer join".
 *
 * Solution: Lock ONLY the jobs row (no joins). Fetch freelancer names
 * separately if needed, or rely on cached values already in application state.
 */
const getJobWithLock = async (client, jobId) => {
  const result = await client.query(
    `SELECT *
     FROM   jobs
     WHERE  id = $1
     FOR UPDATE`,
    [jobId]
  );
  return result.rows[0] || null;
};

const getUserName = async (userId) => {
  const result = await query('SELECT full_name FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.full_name || 'Unknown';
};

const getActiveNegotiation = async (jobId) => {
  const result = await query(
    `SELECT
       n.*,
       array_agg(
         json_build_object(
           'round_number',  nr.round_number,
           'sender',        nr.sender,
           'proposed_price', nr.proposed_price,
           'proposed_days', nr.proposed_days,
           'message',       nr.message,
           'created_at',    nr.created_at
         ) ORDER BY nr.round_number ASC
       ) FILTER (WHERE nr.id IS NOT NULL) AS rounds
     FROM   negotiations n
     LEFT JOIN negotiation_rounds nr ON nr.negotiation_id = n.id
     WHERE  n.job_id = $1
       AND  n.status IN ('active', 'pending', 'agreed')
     GROUP BY n.id`,
    [jobId]
  );
  return result.rows[0] || null;
};

const isMatchedCandidate = async (jobId, freelancerId) => {
  const result = await query(
    `SELECT id
     FROM   job_matched_candidates
     WHERE  job_id        = $1
       AND  freelancer_id = $2`,
    [jobId, freelancerId]
  );
  return !!result.rows[0];
};

const normalizeFreelancerLevel = (level) => {
  if (level === 'basic') return 'beginner';
  if (level === 'expert') return 'experienced';
  return level || 'beginner';
};

const formatAmount = (amount) => Number(amount).toLocaleString('en-IN');

const ensureClientCanFundOffer = async (dbClient, clientId, amount) => {
  const price = Number(amount);
  if (!Number.isFinite(price) || price <= 0) {
    throw new AppError('proposed_price must be a valid positive amount', 400);
  }

  const wallet = await getWalletByUserId(clientId, dbClient, true);
  const balance = Number(wallet.balance);
  if (balance < price) {
    throw new AppError(
      `Add funds to your wallet before making this offer. Required: INR ${formatAmount(price)}, Available: INR ${formatAmount(balance)}`,
      400
    );
  }
};

const validateFreelancerOfferPrice = async (client, freelancerId, job, proposedPrice) => {
  const price = Number(proposedPrice);

  if (!Number.isFinite(price) || price <= 0) {
    throw new AppError('proposed_price must be a valid positive amount', 400);
  }

  if (!job.category_id) return null;

  const userResult = await client.query(
    `SELECT freelancer_level
     FROM   users
     WHERE  id = $1`,
    [freelancerId]
  );
  const freelancerLevel = normalizeFreelancerLevel(userResult.rows[0]?.freelancer_level);

  const rangeResult = await client.query(
    `SELECT beginner_min, beginner_max,
            intermediate_min, intermediate_max,
            experienced_min, experienced_max
     FROM   category_price_ranges
     WHERE  category_id = $1`,
    [job.category_id]
  );
  const range = rangeResult.rows[0];
  if (!range) return null;

  const marketMin = Number(range[`${freelancerLevel}_min`]);
  const marketMax = Number(range[`${freelancerLevel}_max`]);

  if (!Number.isFinite(marketMin) || !Number.isFinite(marketMax)) return null;

  const outsideMarket = price < marketMin || price > marketMax;

  if (freelancerLevel !== 'experienced' && outsideMarket) {
    throw new AppError(
      `Your offer must be within the current ${freelancerLevel} market range: INR ${formatAmount(marketMin)} - INR ${formatAmount(marketMax)}`,
      400
    );
  }

  return {
    freelancer_level: freelancerLevel,
    market_min: marketMin,
    market_max: marketMax,
    outside_market: outsideMarket,
  };
};

// ── Save matched candidates after matching engine runs ────────────────────────

/**
 * Called by matching.service after ranking.
 * Persists top candidates and sets primary + backup on the job row.
 *
 * Position rules:
 *   rank 1  → 'primary'    → jobs.active_freelancer_id
 *   rank 2  → 'backup'     → jobs.backup_freelancer_id
 *   rank 3+ → 'candidate'
 */
const saveMatchedCandidates = async (jobId, rankedCandidates) => {
  if (!rankedCandidates || rankedCandidates.length === 0) return;

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // Clear previous candidates for this job
    await dbClient.query(
      'DELETE FROM job_matched_candidates WHERE job_id = $1',
      [jobId]
    );

    // Insert new ranked candidates with correct positions
    for (const candidate of rankedCandidates) {
      const position =
        candidate.rank === 1 ? 'primary'   :
        candidate.rank === 2 ? 'backup'    :
                               'candidate';

      await dbClient.query(
        `INSERT INTO job_matched_candidates
           (job_id, freelancer_id, rank, score, tier, notify_at, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (job_id, freelancer_id) DO UPDATE SET
           rank      = EXCLUDED.rank,
           score     = EXCLUDED.score,
           tier      = EXCLUDED.tier,
           notify_at = EXCLUDED.notify_at,
           position  = EXCLUDED.position`,
        [
          jobId,
          candidate.freelancer_id,
          candidate.rank,
          candidate.score,
          candidate.tier,
          candidate.notify_at,
          position,
        ]
      );
    }

    // Set primary + backup directly on the job row
    const primary = rankedCandidates.find((c) => c.rank === 1);
    const backup  = rankedCandidates.find((c) => c.rank === 2);

    await dbClient.query(
      `UPDATE jobs
       SET active_freelancer_id = $1,
           backup_freelancer_id = $2
       WHERE id = $3`,
      [
        primary?.freelancer_id || null,
        backup?.freelancer_id  || null,
        jobId,
      ]
    );

    await dbClient.query('COMMIT');
    logger.info('[Negotiation] Matched candidates saved', {
      jobId,
      count:   rankedCandidates.length,
      primary: primary?.freelancer_id,
      backup:  backup?.freelancer_id,
    });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Freelancer initiates negotiation (first proposal = lock) ──────────────────

/**
 * Freelancer submits first offer → locks the job.
 *
 * Rules:
 * 1. Freelancer must be in job_matched_candidates for this job
 * 2. Only the primary (active_freelancer_id / rank 1) can initiate
 * 3. Job must be in 'matching' or 'open' status
 * 4. Locking is transactional via FOR UPDATE — prevents race conditions
 */
const initiateNegotiation = async (freelancerId, jobId, {
  proposed_price,
  proposed_days,
  message,
}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const job = await getJobWithLock(dbClient, jobId);
    if (!job) throw new AppError('Job not found', 404);

    if (!['open', 'matching'].includes(job.status)) {
      throw new AppError(
        `Job is not available for negotiation. Current status: ${job.status}`,
        400
      );
    }

    // Must be a matched candidate
    const isMatched = await isMatchedCandidate(jobId, freelancerId);
    if (!isMatched) {
      throw new AppError('You were not selected as a candidate for this job', 403);
    }

    // Only the primary freelancer (rank 1) can initiate
    if (job.active_freelancer_id !== freelancerId) {
      throw new AppError(
        'You are not the primary candidate for this job. You may be notified if the primary candidate does not respond.',
        403
      );
    }

    // Guard: already locked by a different freelancer (shouldn't happen given above check)
    if (job.locked_at && job.active_freelancer_id !== freelancerId) {
      throw new AppError('This job is currently locked by another freelancer', 409);
    }

    await validateFreelancerOfferPrice(dbClient, freelancerId, job, proposed_price);

    // Guard: duplicate negotiation
    const existing = await dbClient.query(
      `SELECT id, status FROM negotiations
       WHERE  job_id        = $1
         AND  freelancer_id = $2`,
      [jobId, freelancerId]
    );

    if (existing.rows[0]) {
      throw new AppError(
        `A negotiation already exists for this job (status: ${existing.rows[0].status})`,
        409
      );
    }

    // Create negotiation record
    const negResult = await dbClient.query(
      `INSERT INTO negotiations
         (job_id, freelancer_id, client_id, status, current_round, max_rounds)
       VALUES ($1, $2, $3, 'active', 1, $4)
       RETURNING *`,
      [jobId, freelancerId, job.client_id, MAX_ROUNDS]
    );
    const negotiation = negResult.rows[0];

    // Create round 1 (freelancer opens)
    await dbClient.query(
      `INSERT INTO negotiation_rounds
         (negotiation_id, job_id, round_number, sender,
          proposed_price, proposed_days, message)
       VALUES ($1, $2, 1, 'freelancer', $3, $4, $5)`,
      [
        negotiation.id,
        jobId,
        proposed_price,
        proposed_days || null,
        message       || null,
      ]
    );

    // Lock the job
    await dbClient.query(
      `UPDATE jobs
       SET status               = 'locked',
           locked_at            = NOW(),
           negotiation_rounds   = 1,
           active_freelancer_id = $1
       WHERE id = $2`,
      [freelancerId, jobId]
    );

    await dbClient.query('COMMIT');

    setImmediate(async () => {
      try {
        const freelancerName = await getUserName(freelancerId);
        await triggers.notifyNegotiationInitiated({
          job: { ...job, client_id: job.client_id },
          freelancer: { id: freelancerId, full_name: freelancerName },
          proposed_price,
        });
      } catch (err) {
        logger.error('Notification trigger failed: initiateNegotiation', { error: err.message });
      }
    });

    logger.info('[Negotiation] Negotiation initiated — job locked', {
      jobId, freelancerId, proposed_price, round: 1,
    });

    return { negotiation, round_number: 1 };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Client responds ───────────────────────────────────────────────────────────

/**
 * Client responds to freelancer's offer.
 * action: 'counter' | 'accept' | 'reject'
 */
const clientRespond = async (clientId, jobId, {
  proposed_price,
  proposed_days,
  message,
  action,
}) => {
  if (!['counter', 'accept', 'reject'].includes(action)) {
    throw new AppError('action must be one of: counter, accept, reject', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const job = await getJobWithLock(dbClient, jobId);
    if (!job) throw new AppError('Job not found', 404);

    if (job.status !== 'locked') {
      throw new AppError('No active negotiation on this job', 400);
    }

    if (job.client_id !== clientId) {
      throw new AppError('You do not own this job', 403);
    }

    const negResult = await dbClient.query(
      `SELECT * FROM negotiations
       WHERE  job_id = $1
         AND  status = 'active'
       FOR UPDATE`,
      [jobId]
    );
    const negotiation = negResult.rows[0];
    if (!negotiation) throw new AppError('No active negotiation found', 404);

    // ── ACCEPT ─────────────────────────────────────────────────────────────
    if (action === 'accept') {
      const lastRound = await dbClient.query(
        `SELECT proposed_price, proposed_days
         FROM   negotiation_rounds
         WHERE  negotiation_id = $1
         ORDER  BY round_number DESC
         LIMIT  1`,
        [negotiation.id]
      );

      const agreedPrice = proposed_price || lastRound.rows[0]?.proposed_price;
      const agreedDays  = proposed_days  || lastRound.rows[0]?.proposed_days;

      await ensureClientCanFundOffer(dbClient, clientId, agreedPrice);

      await dbClient.query(
        `UPDATE negotiations
         SET status       = 'agreed',
             agreed_price = $1,
             agreed_days  = $2
         WHERE id = $3`,
        [agreedPrice, agreedDays, negotiation.id]
      );

      await dbClient.query(
        `UPDATE jobs SET status = 'pending_admin_approval' WHERE id = $1`,
        [jobId]
      );

      await dbClient.query('COMMIT');
      setImmediate(async () => {
      try {
        await triggers.notifyNegotiationAccepted({
          job,
          freelancerUserId: job.active_freelancer_id,
          clientUserId:     clientId,
          agreed_price:     agreedPrice,
          accepted_by:      'client',
        });
        await triggers.notifyAdminDealPending({ job, agreedPrice, agreedDays });
      } catch (err) { logger.error('Notification trigger failed: clientRespond accept', { error: err.message }); }
    });

      logger.info('[Negotiation] Client accepted', { jobId, clientId, agreedPrice });
      return { action: 'accepted', agreed_price: agreedPrice, agreed_days: agreedDays };
    }

    // ── REJECT ─────────────────────────────────────────────────────────────
    if (action === 'reject') {
      await dbClient.query(
        `UPDATE negotiations SET status = 'failed' WHERE id = $1`,
        [negotiation.id]
      );

      const fallbackResult = await triggerFallback(dbClient, job);

      await dbClient.query('COMMIT');
      setImmediate(async () => {
      try {
        await triggers.notifyNegotiationRejected({
          job,
          freelancerUserId: job.active_freelancer_id,
          clientUserId:     clientId,
          rejected_by:      'client',
          fallback:         fallbackResult,
        });
      } catch (err) { logger.error('Notification trigger failed: clientRespond reject', { error: err.message }); }
    });

      logger.info('[Negotiation] Client rejected — fallback triggered', { jobId, clientId });
      return { action: 'rejected', fallback: fallbackResult };
    }

    // ── COUNTER ────────────────────────────────────────────────────────────
    if (action === 'counter') {
      if (!proposed_price) {
        throw new AppError('proposed_price is required for counter action', 400);
      }

      await ensureClientCanFundOffer(dbClient, clientId, proposed_price);

      const nextRound = negotiation.current_round + 1;

      if (nextRound > MAX_ROUNDS) {
        throw new AppError(
          `Maximum negotiation rounds (${MAX_ROUNDS}) reached. You must accept or reject.`,
          400
        );
      }

      await dbClient.query(
        `INSERT INTO negotiation_rounds
           (negotiation_id, job_id, round_number, sender,
            proposed_price, proposed_days, message)
         VALUES ($1, $2, $3, 'client', $4, $5, $6)`,
        [
          negotiation.id, jobId, nextRound,
          proposed_price, proposed_days || null, message || null,
        ]
      );

      await dbClient.query(
        `UPDATE negotiations SET current_round = $1 WHERE id = $2`,
        [nextRound, negotiation.id]
      );

      await dbClient.query(
        `UPDATE jobs SET negotiation_rounds = $1 WHERE id = $2`,
        [nextRound, jobId]
      );

      await dbClient.query('COMMIT');
      setImmediate(async () => {
      try {
        const clientName = await getUserName(clientId);
        await triggers.notifyNegotiationCountered({
          job,
          senderName:      clientName,
          recipientUserId: job.active_freelancer_id,
          round_number:    nextRound,
          proposed_price,
        });
      } catch (err) { logger.error('Notification trigger failed: clientRespond counter', { error: err.message }); }
    });

      logger.info('[Negotiation] Client countered', {
        jobId, clientId, round: nextRound, proposed_price,
      });
      return { action: 'countered', round_number: nextRound, proposed_price };
    }
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Freelancer responds to client counter ─────────────────────────────────────

/**
 * Freelancer responds to a client counter-offer.
 * action: 'counter' | 'accept' | 'reject'
 */
const freelancerRespond = async (freelancerId, jobId, {
  proposed_price,
  proposed_days,
  message,
  action,
}) => {
  if (!['counter', 'accept', 'reject'].includes(action)) {
    throw new AppError('action must be one of: counter, accept, reject', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const job = await getJobWithLock(dbClient, jobId);
    if (!job) throw new AppError('Job not found', 404);

    if (job.status !== 'locked') {
      throw new AppError('No active negotiation on this job', 400);
    }

    if (job.active_freelancer_id !== freelancerId) {
      throw new AppError('You are not the active freelancer for this job', 403);
    }

    const negResult = await dbClient.query(
      `SELECT * FROM negotiations
       WHERE  job_id = $1
         AND  status = 'active'
       FOR UPDATE`,
      [jobId]
    );
    const negotiation = negResult.rows[0];
    if (!negotiation) throw new AppError('No active negotiation found', 404);

    // ── ACCEPT ─────────────────────────────────────────────────────────────
    if (action === 'accept') {
      const lastRound = await dbClient.query(
        `SELECT proposed_price, proposed_days
         FROM   negotiation_rounds
         WHERE  negotiation_id = $1
         ORDER  BY round_number DESC
         LIMIT  1`,
        [negotiation.id]
      );

      const agreedPrice = proposed_price || lastRound.rows[0]?.proposed_price;
      const agreedDays  = proposed_days  || lastRound.rows[0]?.proposed_days;

      await ensureClientCanFundOffer(dbClient, job.client_id, agreedPrice);

      await dbClient.query(
        `UPDATE negotiations
         SET status       = 'agreed',
             agreed_price = $1,
             agreed_days  = $2
         WHERE id = $3`,
        [agreedPrice, agreedDays, negotiation.id]
      );

      await dbClient.query(
        `UPDATE jobs SET status = 'pending_admin_approval' WHERE id = $1`,
        [jobId]
      );

      await dbClient.query('COMMIT');
      setImmediate(async () => {
      try {
        await triggers.notifyNegotiationAccepted({
          job,
          freelancerUserId: freelancerId,
          clientUserId:     job.client_id,
          agreed_price:     agreedPrice,
          accepted_by:      'freelancer',
        });
        await triggers.notifyAdminDealPending({ job, agreedPrice, agreedDays });
      } catch (err) { logger.error('Notification trigger failed: freelancerRespond accept', { error: err.message }); }
    });

      logger.info('[Negotiation] Freelancer accepted', { jobId, freelancerId, agreedPrice });
      return { action: 'accepted', agreed_price: agreedPrice, agreed_days: agreedDays };
    }

    // ── REJECT ─────────────────────────────────────────────────────────────
    if (action === 'reject') {
      await dbClient.query(
        `UPDATE negotiations SET status = 'failed' WHERE id = $1`,
        [negotiation.id]
      );

      const fallbackResult = await triggerFallback(dbClient, job);

      await dbClient.query('COMMIT');
      setImmediate(async () => {
      try {
        await triggers.notifyNegotiationRejected({
          job,
          freelancerUserId: freelancerId,
          clientUserId:     job.client_id,
          rejected_by:      'freelancer',
          fallback:         fallbackResult,
        });
      } catch (err) { logger.error('Notification trigger failed: freelancerRespond reject', { error: err.message }); }
    });

      logger.info('[Negotiation] Freelancer rejected — fallback triggered', {
        jobId, freelancerId,
      });
      return { action: 'rejected', fallback: fallbackResult };
    }

    // ── COUNTER ────────────────────────────────────────────────────────────
    if (action === 'counter') {
      if (!proposed_price) {
        throw new AppError('proposed_price is required for counter action', 400);
      }

      await validateFreelancerOfferPrice(dbClient, freelancerId, job, proposed_price);

      const nextRound = negotiation.current_round + 1;

      if (nextRound > MAX_ROUNDS) {
        throw new AppError(
          `Maximum negotiation rounds (${MAX_ROUNDS}) reached. You must accept or reject.`,
          400
        );
      }

      await dbClient.query(
        `INSERT INTO negotiation_rounds
           (negotiation_id, job_id, round_number, sender,
            proposed_price, proposed_days, message)
         VALUES ($1, $2, $3, 'freelancer', $4, $5, $6)`,
        [
          negotiation.id, jobId, nextRound,
          proposed_price, proposed_days || null, message || null,
        ]
      );

      await dbClient.query(
        `UPDATE negotiations SET current_round = $1 WHERE id = $2`,
        [nextRound, negotiation.id]
      );

      await dbClient.query(
        `UPDATE jobs SET negotiation_rounds = $1 WHERE id = $2`,
        [nextRound, jobId]
      );

      await dbClient.query('COMMIT');
      setImmediate(async () => {
      try {
        const freelancerName = await getUserName(freelancerId);
        await triggers.notifyNegotiationCountered({
          job,
          senderName:      freelancerName,
          recipientUserId: job.client_id,
          round_number:    nextRound,
          proposed_price,
        });
      } catch (err) { logger.error('Notification trigger failed: freelancerRespond counter', { error: err.message }); }
    });

      logger.info('[Negotiation] Freelancer countered', {
        jobId, freelancerId, round: nextRound,
      });
      return { action: 'countered', round_number: nextRound, proposed_price };
    }
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Fallback Logic ────────────────────────────────────────────────────────────

/**
 * Called inside an open transaction when a negotiation fails.
 *
 * Strategy:
 *   1. backup exists → promote to primary, find next candidate as new backup
 *   2. no backup     → return job to 'matching' for engine re-run
 */
const triggerFallback = async (dbClient, job) => {
  if (job.backup_freelancer_id) {
    // Find next candidate (rank 3+) to become the new backup
    const newBackup = await dbClient.query(
      `SELECT freelancer_id
       FROM   job_matched_candidates
       WHERE  job_id        = $1
         AND  position      = 'candidate'
         AND  freelancer_id != $2
         AND  freelancer_id != $3
       ORDER  BY rank ASC
       LIMIT  1`,
      [job.id, job.active_freelancer_id, job.backup_freelancer_id]
    );

    const nextBackupId = newBackup.rows[0]?.freelancer_id || null;

    await dbClient.query(
      `UPDATE jobs
       SET active_freelancer_id = $1,
           backup_freelancer_id = $2,
           locked_at            = NOW(),
           negotiation_rounds   = 0,
           status               = 'locked'
       WHERE id = $3`,
      [job.backup_freelancer_id, nextBackupId, job.id]
    );

    // Update candidate positions
    await dbClient.query(
      `UPDATE job_matched_candidates
       SET position = 'primary'
       WHERE job_id = $1 AND freelancer_id = $2`,
      [job.id, job.backup_freelancer_id]
    );

    if (nextBackupId) {
      await dbClient.query(
        `UPDATE job_matched_candidates
         SET position = 'backup'
         WHERE job_id = $1 AND freelancer_id = $2`,
        [job.id, nextBackupId]
      );
    }

    logger.info('[Negotiation] Fallback: backup promoted to primary', {
      jobId:      job.id,
      newPrimary: job.backup_freelancer_id,
      newBackup:  nextBackupId,
    });

    return {
      action:             'promoted_backup',
      next_freelancer_id: job.backup_freelancer_id,
      new_backup_id:      nextBackupId,
    };
  }

  // No backup — send back to matching queue
  await dbClient.query(
    `UPDATE jobs
     SET status               = 'matching',
         active_freelancer_id = NULL,
         backup_freelancer_id = NULL,
         locked_at            = NULL,
         negotiation_rounds   = 0
     WHERE id = $1`,
    [job.id]
  );

  logger.info('[Negotiation] Fallback: no backup — job returned to matching', {
    jobId: job.id,
  });

  return { action: 're_matching', message: 'Job returned to matching queue' };
};

// ── Admin approval ────────────────────────────────────────────────────────────

/**
 * Admin approves agreed deal → creates job_assignment → job status: 'assigned'.
 */
const adminApproveDeal = async (jobId, adminId, { admin_note }) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const job = await getJobWithLock(dbClient, jobId);
    if (!job) throw new AppError('Job not found', 404);

    if (job.status !== 'pending_admin_approval') {
      throw new AppError(
        `Job must be in pending_admin_approval status. Current: ${job.status}`,
        400
      );
    }

    const negResult = await dbClient.query(
      `SELECT * FROM negotiations
       WHERE  job_id = $1
         AND  status = 'agreed'
       FOR UPDATE`,
      [jobId]
    );
    const negotiation = negResult.rows[0];
    if (!negotiation) {
      throw new AppError('No agreed negotiation found for this job', 404);
    }

    await holdEscrow({
      jobId,
      clientId:     negotiation.client_id,
      freelancerId: negotiation.freelancer_id,
      amount:       parseFloat(negotiation.agreed_price),
      dbClient,
    });

    // Mark negotiation admin_approved
    await dbClient.query(
      `UPDATE negotiations
       SET status      = 'admin_approved',
           approved_by = $1,
           approved_at = NOW(),
           admin_note  = $2
       WHERE id = $3`,
      [adminId, admin_note || null, negotiation.id]
    );

    // Create assignment
    const assignResult = await dbClient.query(
      `INSERT INTO job_assignments
         (job_id, freelancer_id, assigned_by, status)
       VALUES ($1, $2, $3, 'pending_acceptance')
       RETURNING *`,
      [jobId, negotiation.freelancer_id, adminId]
    );

    // Update job → assigned
    await dbClient.query(
      `UPDATE jobs
       SET status           = 'assigned',
           assigned_by      = $1,
           assigned_at      = NOW(),
           deal_approved_by = $1,
           deal_approved_at = NOW(),
           admin_note       = $2
       WHERE id = $3`,
      [adminId, admin_note || null, jobId]
    );

    // Increment freelancer workload counter
    await dbClient.query(
      `UPDATE users
       SET active_jobs_count = active_jobs_count + 1
       WHERE id = $1`,
      [negotiation.freelancer_id]
    );

    await dbClient.query('COMMIT');
    // Hold escrow from client wallet — non-blocking, post-commit
    setImmediate(async () => {
      try {
        return;
        await holdEscrow({
          jobId:        jobId,
          clientId:     negotiation.client_id,
          freelancerId: negotiation.freelancer_id,
          amount:       parseFloat(negotiation.agreed_price),
        });
        logger.info('Escrow held after deal approval', {
          jobId, amount: negotiation.agreed_price,
        });
      } catch (escrowErr) {
        logger.error('Escrow hold failed — client may have insufficient balance', {
          jobId, error: escrowErr.message,
        });
        // Future: send admin notification that escrow failed
      }
    });
    // Create chat room for client ↔ freelancer communication
    setImmediate(async () => {
      try {
        // Find client's WhatsApp number + best MM channel for this job's category
        const [clientResult, jobCatResult] = await Promise.all([
          query('SELECT whatsapp_number FROM users WHERE id = $1', [negotiation.client_id]),
          query(
            `SELECT wn.waba_phone_id
             FROM whatsapp_numbers wn
             JOIN categories c ON c.id = wn.category_id
             JOIN jobs j ON j.category_id = c.id
             WHERE j.id = $1 AND wn.is_active = true
             LIMIT 1`,
            [jobId]
          ),
        ]);

        await createChatRoom({
          jobId,
          clientId:      negotiation.client_id,
          freelancerId:  negotiation.freelancer_id,
          clientWaNumber: clientResult.rows[0]?.whatsapp_number || null,
          mmWaNumberId:   jobCatResult.rows[0]?.waba_phone_id || null,
        });
      } catch (err) {
        logger.error('Chat room creation failed after deal approval', {
          jobId, error: err.message,
        });
      }
    });
    setImmediate(async () => {
      try {
        await triggers.notifyDealApproved({
          job,
          freelancerUserId: negotiation.freelancer_id,
          clientUserId:     negotiation.client_id,
          agreedPrice:      negotiation.agreed_price,
        });
        await triggers.notifyAssignmentCreated({
          job,
          freelancerUserId: negotiation.freelancer_id,
          agreedPrice:      negotiation.agreed_price,
        });
      } catch (err) { logger.error('Notification trigger failed: adminApproveDeal', { error: err.message }); }
    });

    logger.info('[Negotiation] Admin approved deal — assignment created', {
      jobId,
      adminId,
      freelancerId: negotiation.freelancer_id,
      agreedPrice:  negotiation.agreed_price,
    });

    return {
      assignment:   assignResult.rows[0],
      agreed_price: negotiation.agreed_price,
      agreed_days:  negotiation.agreed_days,
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

/**
 * Admin rejects deal → triggers fallback.
 */
const adminRejectDeal = async (jobId, adminId, { admin_note }) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const job = await getJobWithLock(dbClient, jobId);
    if (!job) throw new AppError('Job not found', 404);

    if (job.status !== 'pending_admin_approval') {
      throw new AppError(
        `Job must be in pending_admin_approval status. Current: ${job.status}`,
        400
      );
    }

    await dbClient.query(
      `UPDATE negotiations
       SET status     = 'failed',
           admin_note = $1
       WHERE job_id = $2
         AND status  = 'agreed'`,
      [admin_note || null, jobId]
    );

    const fallbackResult = await triggerFallback(dbClient, job);

    await dbClient.query('COMMIT');
    setImmediate(async () => {
      try {
        const neg = await query(
          `SELECT freelancer_id, client_id FROM negotiations WHERE job_id = $1 ORDER BY updated_at DESC LIMIT 1`,
          [jobId]
        );
        if (neg.rows[0]) {
          await triggers.notifyDealRejectedByAdmin({
            job,
            freelancerUserId: neg.rows[0].freelancer_id,
            clientUserId:     neg.rows[0].client_id,
            adminNote:        admin_note,
            fallback:         fallbackResult,
          });
        }
      } catch (err) { logger.error('Notification trigger failed: adminRejectDeal', { error: err.message }); }
    });

    logger.info('[Negotiation] Admin rejected deal — fallback triggered', { jobId, adminId });
    return { action: 'rejected', admin_note, fallback: fallbackResult };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Freelancer accepts/declines assignment ────────────────────────────────────

/**
 * After admin approval, freelancer formally accepts or declines the assignment.
 */
const respondToAssignment = async (freelancerId, jobId, { action, note }) => {
  if (!['accept', 'decline'].includes(action)) {
    throw new AppError('action must be accept or decline', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const assignResult = await dbClient.query(
      `SELECT ja.*
       FROM   job_assignments ja
       JOIN   jobs j ON j.id = ja.job_id
       WHERE  ja.job_id        = $1
         AND  ja.freelancer_id = $2
         AND  ja.status        = 'pending_acceptance'
       FOR UPDATE`,
      [jobId, freelancerId]
    );

    const assignment = assignResult.rows[0];
    if (!assignment) {
      throw new AppError('No pending assignment found for you on this job', 404);
    }

    if (action === 'accept') {
      await dbClient.query(
        `UPDATE job_assignments
         SET status          = 'accepted',
             freelancer_note = $1,
             responded_at    = NOW(),
             started_at      = NOW()
         WHERE id = $2`,
        [note || null, assignment.id]
      );

      await dbClient.query(
        `UPDATE jobs SET status = 'in_progress' WHERE id = $1`,
        [jobId]
      );

      await dbClient.query('COMMIT');
      // accept:
    setImmediate(async () => {
      try {
        const freelancerName = await getUserName(freelancerId);
        const jobRow = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
        await triggers.notifyAssignmentAccepted({
          job:             jobRow.rows[0],
          freelancerName,
          clientUserId:    jobRow.rows[0].client_id,
        });
      } catch (err) { logger.error('Notification trigger failed: respondToAssignment accept', { error: err.message }); }
    });


      logger.info('[Negotiation] Freelancer accepted assignment — job in progress', {
        jobId, freelancerId,
      });
      return { action: 'accepted', job_status: 'in_progress' };
    }

    if (action === 'decline') {
      await dbClient.query(
        `UPDATE job_assignments
         SET status          = 'declined',
             freelancer_note = $1,
             responded_at    = NOW()
         WHERE id = $2`,
        [note || null, assignment.id]
      );

      // Revert active_jobs_count (was incremented at admin approval)
      await dbClient.query(
        `UPDATE users
         SET active_jobs_count = GREATEST(0, active_jobs_count - 1)
         WHERE id = $1`,
        [freelancerId]
      );

      const job = await getJobWithLock(dbClient, jobId);
      const fallbackResult = await triggerFallback(dbClient, job);

      await dbClient.query('COMMIT');
      // decline:
    setImmediate(async () => {
      try {
        const freelancerName = await getUserName(freelancerId);
        const jobRow = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
        await triggers.notifyAssignmentDeclined({
          job:             jobRow.rows[0],
          freelancerName,
          clientUserId:    jobRow.rows[0].client_id,
          fallback:        fallbackResult,
        });
      } catch (err) { logger.error('Notification trigger failed: respondToAssignment decline', { error: err.message }); }
    });

      logger.info('[Negotiation] Freelancer declined assignment — fallback triggered', {
        jobId, freelancerId,
      });
      return { action: 'declined', fallback: fallbackResult };
    }
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Read methods ──────────────────────────────────────────────────────────────

const getNegotiationStatus = async (jobId, requesterId, requesterRole) => {
  const jobResult = await query(
    `SELECT
       j.id, j.title, j.status,
       j.active_freelancer_id, j.backup_freelancer_id,
       j.locked_at, j.negotiation_rounds,
       j.client_id
     FROM   jobs j
     WHERE  j.id = $1`,
    [jobId]
  );

  const jobRow = jobResult.rows[0];
  if (!jobRow) throw new AppError('Job not found', 404);

  if (requesterRole === 'client' && jobRow.client_id !== requesterId) {
    throw new AppError('You do not own this job', 403);
  }

  if (
    requesterRole === 'freelancer' &&
    jobRow.active_freelancer_id !== requesterId
  ) {
    throw new AppError('You are not the active freelancer for this job', 403);
  }

  const negotiation = await getActiveNegotiation(jobId);

  const candidates = await query(
    `SELECT
       jmc.rank, jmc.score, jmc.tier, jmc.position, jmc.notify_at,
       u.full_name, u.avatar_url, u.freelancer_level, u.average_rating
     FROM   job_matched_candidates jmc
     JOIN   users u ON u.id = jmc.freelancer_id
     WHERE  jmc.job_id = $1
     ORDER  BY jmc.rank ASC`,
    [jobId]
  );

  return {
    job:         jobRow,
    negotiation: negotiation || null,
    // Candidates list only exposed to admin
    candidates:  requesterRole === 'admin' ? candidates.rows : undefined,
  };
};

const getAdminPendingApprovals = async ({ page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT
       j.id              AS job_id,
       j.title,
       j.status,
       j.budget_amount,
       j.active_freelancer_id,
       j.locked_at,
       n.id              AS negotiation_id,
       n.agreed_price,
       n.agreed_days,
       n.current_round,
       n.max_rounds,
       n.created_at      AS negotiation_started,
       n.updated_at      AS negotiation_updated_at,
       u_f.full_name     AS freelancer_name,
       u_f.email         AS freelancer_email,
       u_f.freelancer_level,
       u_c.full_name     AS client_name,
       u_c.email         AS client_email,
       cat.name          AS category_name
     FROM   jobs j
     JOIN   negotiations n   ON n.job_id = j.id AND n.status = 'agreed'
     JOIN   users u_f        ON u_f.id = n.freelancer_id
     JOIN   users u_c        ON u_c.id = n.client_id
     LEFT JOIN categories cat ON cat.id = j.category_id
     WHERE  j.status = 'pending_admin_approval'
     ORDER  BY n.updated_at ASC
     LIMIT  $1
     OFFSET $2`,
    [limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*)
     FROM jobs j
     JOIN negotiations n ON n.job_id = j.id AND n.status = 'agreed'
     WHERE j.status = 'pending_admin_approval'`
  );

  const negotiations = result.rows.map(row => ({
    id: row.negotiation_id,
    negotiation_id: row.negotiation_id,
    job_id: row.job_id,
    agreed_price: row.agreed_price,
    agreed_days: row.agreed_days,
    current_round: row.current_round,
    max_rounds: row.max_rounds,
    created_at: row.negotiation_started,
    updated_at: row.negotiation_updated_at,
    negotiation_started: row.negotiation_started,
    job: {
      id: row.job_id,
      title: row.title,
      status: row.status,
      budget_amount: row.budget_amount,
      locked_at: row.locked_at,
      active_freelancer_id: row.active_freelancer_id,
      category: row.category_name ? { name: row.category_name } : null,
    },
    client: {
      full_name: row.client_name,
      email: row.client_email,
    },
    freelancer: {
      full_name: row.freelancer_name,
      email: row.freelancer_email,
      freelancer_level: row.freelancer_level,
    },
    title: row.title,
    category_name: row.category_name,
    client_name: row.client_name,
    client_email: row.client_email,
    freelancer_name: row.freelancer_name,
    freelancer_email: row.freelancer_email,
    freelancer_level: row.freelancer_level,
    budget_amount: row.budget_amount,
  }));

  return {
    pending: negotiations,
    negotiations,
    pagination: {
      page,
      limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

module.exports = {
  saveMatchedCandidates,
  initiateNegotiation,
  clientRespond,
  freelancerRespond,
  adminApproveDeal,
  adminRejectDeal,
  respondToAssignment,
  getNegotiationStatus,
  getAdminPendingApprovals,
};
