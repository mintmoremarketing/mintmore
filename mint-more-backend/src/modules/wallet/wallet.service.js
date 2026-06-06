const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { markSessionCompleted } = require('../whatsapp/conversation.service');
const { writeAudit } = require('../audit/audit.service');
const { getSetting } = require('../commerce/settings.service');

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fetch wallet row by userId, with optional FOR UPDATE lock.
 * Always used inside a transaction when modifying balances.
 */
const getWalletByUserId = async (userId, dbClient = null, forUpdate = false) => {
  const executor = dbClient || { query: async (text, params) => query(text, params) };
  const lock     = forUpdate ? 'FOR UPDATE' : '';

  const result = await executor.query(
    `SELECT * FROM wallets WHERE user_id = $1 ${lock}`,
    [userId]
  );

  if (!result.rows[0]) {
    throw new AppError('Wallet not found for this user', 404);
  }

  return result.rows[0];
};

/**
 * Record a transaction and update the wallet balance atomically.
 * Must be called inside an existing transaction (dbClient required).
 *
 * @param {object} dbClient    - pg client (already in transaction)
 * @param {object} opts
 * @param {string} opts.walletId
 * @param {string} opts.userId
 * @param {string} opts.type          - transaction_type enum value
 * @param {number} opts.amount        - positive = credit, negative = debit
 * @param {number} opts.escrowDelta   - positive = lock, negative = unlock (default 0)
 * @param {string} opts.referenceId
 * @param {string} opts.referenceType
 * @param {string} opts.description
 * @param {object} opts.metadata
 */
const recordTransaction = async (dbClient, {
  walletId,
  userId,
  type,
  amount,
  escrowDelta = 0,
  referenceId = null,
  referenceType = null,
  idempotencyKey = null,
  description = '',
  metadata = {},
}) => {
  if (idempotencyKey) {
    const existing = await dbClient.query(
      'SELECT * FROM transactions WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existing.rows[0]) return existing.rows[0];
  }

  // Lock the wallet row
  const walletResult = await dbClient.query(
    'SELECT * FROM wallets WHERE id = $1 FOR UPDATE',
    [walletId]
  );
  const wallet = walletResult.rows[0];
  if (!wallet) throw new AppError('Wallet not found', 404);

  const newBalance = parseFloat(wallet.balance) + amount;
  const newEscrow  = parseFloat(wallet.escrow_balance) + escrowDelta;

  if (newBalance < 0) {
    throw new AppError(
      `Insufficient wallet balance. Available: ₹${parseFloat(wallet.balance).toLocaleString('en-IN')}`,
      400
    );
  }
  if (newEscrow < 0) {
    throw new AppError('Escrow balance cannot go negative', 400);
  }

  // Update wallet
  await dbClient.query(
    `UPDATE wallets
     SET balance        = $1,
         escrow_balance = $2
     WHERE id = $3`,
    [newBalance, newEscrow, walletId]
  );

  // Insert immutable ledger row
  const txResult = await dbClient.query(
    `INSERT INTO transactions
       (wallet_id, user_id, type, amount, currency,
        balance_after, escrow_after,
        reference_id, reference_type, idempotency_key, description, metadata)
     VALUES ($1, $2, $3, $4, 'INR', $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      walletId,
      userId,
      type,
      amount,
      newBalance,
      newEscrow,
      referenceId,
      referenceType,
      idempotencyKey,
      description,
      JSON.stringify(metadata),
    ]
  );

  return txResult.rows[0];
};

// ── Public service methods ────────────────────────────────────────────────────

/**
 * Get wallet + recent transactions for a user.
 */
const getWallet = async (userId) => {
  const wallet = await getWalletByUserId(userId);

  const [transactions, payoutRules] = await Promise.all([
    query(
      `SELECT * FROM transactions
       WHERE wallet_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [wallet.id]
    ),
    getSetting('payouts', {
      scheduled_fee: 0,
      instant_fee: 25,
      scheduled_label: 'Weekly payout',
      instant_label: 'Instant payout',
    }),
  ]);

  return {
    wallet: {
      id:              wallet.id,
      balance:         parseFloat(wallet.balance),
      escrow_balance:  parseFloat(wallet.escrow_balance),
      total:           parseFloat(wallet.balance) + parseFloat(wallet.escrow_balance),
      currency:        wallet.currency,
    },
    recent_transactions: transactions.rows,
    payout_rules: payoutRules,
  };
};

/**
 * Get paginated transaction history for a user.
 */
const getTransactions = async (userId, { page = 1, limit = 20, type } = {}) => {
  const wallet = await getWalletByUserId(userId);
  const offset = (page - 1) * limit;
  const params = [wallet.id];
  let   typeClause = '';

  if (type) {
    params.push(type);
    typeClause = `AND type = $${params.length}`;
  }

  params.push(limit, offset);

  const result = await query(
    `SELECT * FROM transactions
     WHERE wallet_id = $1 ${typeClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM transactions WHERE wallet_id = $1 ${typeClause}`,
    params.slice(0, -2)
  );

  return {
    transactions: result.rows,
    pagination: {
      page, limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

// ── Escrow operations (called from negotiation service) ────────────────────────

/**
 * Hold escrow for a job deal.
 * Called when admin approves a deal.
 * Moves amount from client's available balance → escrow balance.
 *
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {string} opts.clientId
 * @param {string} opts.freelancerId
 * @param {number} opts.amount
 * @param {object} [opts.dbClient]  - optional external tx client (if called inside one)
 */
const holdEscrow = async ({
  jobId,
  clientId,
  freelancerId,
  amount,
  freelancerPayout = amount,
  platformRevenue = 0,
  marginPercent = 0,
  commissionPercent = 0,
  dbClient: externalClient,
}) => {
  const useExternal = !!externalClient;
  const dbClient    = externalClient || await getClient();

  try {
    if (!useExternal) await dbClient.query('BEGIN');

    const existingEscrowResult = await dbClient.query(
      'SELECT * FROM escrow_records WHERE job_id = $1 FOR UPDATE',
      [jobId]
    );
    const existingEscrow = existingEscrowResult.rows[0];
    if (existingEscrow) {
      const sameHold =
        existingEscrow.client_id === clientId &&
        existingEscrow.freelancer_id === freelancerId &&
        Number(existingEscrow.amount) === Number(amount);
      if (!sameHold) {
        throw new AppError('Escrow already exists for this job with different terms', 409);
      }
      const existingTransaction = await dbClient.query(
        'SELECT * FROM transactions WHERE id = $1',
        [existingEscrow.hold_tx_id]
      );
      if (!useExternal) await dbClient.query('COMMIT');
      return existingTransaction.rows[0] || existingEscrow;
    }

    const clientWallet = await getWalletByUserId(clientId, dbClient, true);

    if (parseFloat(clientWallet.balance) < amount) {
      throw new AppError(
        `Client has insufficient balance for escrow. Required: ₹${Number(amount).toLocaleString('en-IN')}, Available: ₹${parseFloat(clientWallet.balance).toLocaleString('en-IN')}`,
        400
      );
    }

    // Debit client balance, credit escrow
    const holdTx = await recordTransaction(dbClient, {
      walletId:      clientWallet.id,
      userId:        clientId,
      type:          'escrow_hold',
      amount:        -amount,       // balance goes down
      escrowDelta:   +amount,       // escrow goes up
      referenceId:   jobId,
      referenceType: 'job',
      idempotencyKey: `escrow-hold:${jobId}`,
      description:   `Escrow held for job`,
      metadata:      { job_id: jobId, freelancer_id: freelancerId },
    });

    // Create escrow record
    await dbClient.query(
      `INSERT INTO escrow_records
         (job_id, client_id, freelancer_id, amount, freelancer_payout,
          platform_revenue, margin_percent, commission_percent, status, hold_tx_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'held', $9)`,
      [
        jobId, clientId, freelancerId, amount, freelancerPayout,
        platformRevenue, marginPercent, commissionPercent, holdTx.id,
      ]
    );

    if (!useExternal) await dbClient.query('COMMIT');

    logger.info('Escrow held', { jobId, clientId, freelancerId, amount });
    return holdTx;
  } catch (err) {
    if (!useExternal) await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    if (!useExternal) dbClient.release();
  }
};

/**
 * Release escrow to freelancer.
 * Called when job is marked complete.
 * Moves amount from client's escrow → freelancer's available balance.
 */
const releaseEscrow = async (jobId, adminId, externalClient = null) => {
  const useExternal = !!externalClient;
  const dbClient = externalClient || await getClient();
  try {
    if (!useExternal) await dbClient.query('BEGIN');

    // Fetch escrow record
    const escrowResult = await dbClient.query(
      `SELECT * FROM escrow_records WHERE job_id = $1 AND status IN ('held', 'disputed') FOR UPDATE`,
      [jobId]
    );
    const escrow = escrowResult.rows[0];
    if (!escrow) throw new AppError('No active escrow found for this job', 404);

    const clientWallet     = await getWalletByUserId(escrow.client_id, dbClient, true);
    const freelancerWallet = await getWalletByUserId(escrow.freelancer_id, dbClient, true);

    // Release from client escrow
    const clientReleaseTx = await recordTransaction(dbClient, {
      walletId:      clientWallet.id,
      userId:        escrow.client_id,
      type:          'escrow_release',
      amount:        0,               // no change to available balance
      escrowDelta:   -escrow.amount,  // escrow goes down
      referenceId:   jobId,
      referenceType: 'job',
      idempotencyKey: `escrow-release-client:${jobId}`,
      description:   'Escrow released — job completed',
      metadata:      { job_id: jobId, freelancer_id: escrow.freelancer_id },
    });

    // Credit freelancer balance
    const freelancerCreditTx = await recordTransaction(dbClient, {
      walletId:      freelancerWallet.id,
      userId:        escrow.freelancer_id,
      type:          'escrow_release',
      amount:        +escrow.freelancer_payout,  // balance goes up
      escrowDelta:   0,
      referenceId:   jobId,
      referenceType: 'job',
      idempotencyKey: `escrow-release-freelancer:${jobId}`,
      description:   'Payment received — job completed',
      metadata:      { job_id: jobId, client_id: escrow.client_id },
    });

    // Update escrow record
    await dbClient.query(
      `UPDATE escrow_records
       SET status         = 'released',
           released_at    = NOW(),
           release_tx_id  = $1
       WHERE id = $2`,
      [freelancerCreditTx.id, escrow.id]
    );

    if (Number(escrow.platform_revenue) > 0) {
      await dbClient.query(
        `INSERT INTO platform_financial_ledger
           (type,amount,reference_id,reference_type,idempotency_key,description,metadata)
         VALUES ('managed_job_revenue',$1,$2,'job',$3,$4,$5)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          escrow.platform_revenue,
          jobId,
          `managed-job-revenue:${jobId}`,
          'Managed job margin and freelancer commission',
          JSON.stringify({
            client_total: escrow.amount,
            freelancer_payout: escrow.freelancer_payout,
            margin_percent: escrow.margin_percent,
            commission_percent: escrow.commission_percent,
          }),
        ]
      );
    }

    if (!useExternal) await dbClient.query('COMMIT');

    logger.info('Escrow released', {
      jobId,
      adminId,
      amount:       escrow.amount,
      freelancerId: escrow.freelancer_id,
    });

    return {
      escrow,
      client_release_tx:    clientReleaseTx,
      freelancer_credit_tx: freelancerCreditTx,
    };
  } catch (err) {
    if (!useExternal) await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    if (!useExternal) dbClient.release();
  }
};

/**
 * Refund escrow to client.
 * Called when job is cancelled after deal approval.
 * Moves amount from client's escrow → client's available balance.
 */
const refundEscrow = async (jobId, reason = 'Job cancelled', externalClient = null) => {
  const useExternal = !!externalClient;
  const dbClient = externalClient || await getClient();
  try {
    if (!useExternal) await dbClient.query('BEGIN');

    const escrowResult = await dbClient.query(
      `SELECT * FROM escrow_records WHERE job_id = $1 AND status IN ('held', 'disputed') FOR UPDATE`,
      [jobId]
    );
    const escrow = escrowResult.rows[0];
    if (!escrow) {
      // No escrow — job may have been cancelled before deal approval
      if (!useExternal) await dbClient.query('COMMIT');
      return null;
    }

    const clientWallet = await getWalletByUserId(escrow.client_id, dbClient, true);

    const refundTx = await recordTransaction(dbClient, {
      walletId:      clientWallet.id,
      userId:        escrow.client_id,
      type:          'escrow_refund',
      amount:        +escrow.amount,  // balance goes back up
      escrowDelta:   -escrow.amount,  // escrow goes down
      referenceId:   jobId,
      referenceType: 'job',
      idempotencyKey: `escrow-refund:${jobId}`,
      description:   `Escrow refunded — ${reason}`,
      metadata:      { job_id: jobId, freelancer_id: escrow.freelancer_id },
    });

    await dbClient.query(
      `UPDATE escrow_records
       SET status        = 'refunded',
           refunded_at   = NOW(),
           refund_tx_id  = $1
       WHERE id = $2`,
      [refundTx.id, escrow.id]
    );

    if (!useExternal) await dbClient.query('COMMIT');

    logger.info('Escrow refunded', { jobId, amount: escrow.amount, clientId: escrow.client_id });
    return refundTx;
  } catch (err) {
    if (!useExternal) await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    if (!useExternal) dbClient.release();
  }
};

// ── Withdrawal ────────────────────────────────────────────────────────────────

/**
 * Freelancer requests a withdrawal.
 * Deducts from available balance immediately — held until admin approves/rejects.
 */
const requestWithdrawal = async (userId, {
  amount,
  account_name,
  account_number,
  ifsc_code,
  upi_id,
  payout_mode = 'scheduled',
}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const wallet = await getWalletByUserId(userId, dbClient, true);

    if (parseFloat(wallet.balance) < amount) {
      throw new AppError(
        `Insufficient balance. Available: ₹${parseFloat(wallet.balance).toLocaleString('en-IN')}`,
        400
      );
    }

    const payoutRules = await getSetting('payouts', {}, dbClient);
    const payoutMode = payout_mode === 'instant' ? 'instant' : 'scheduled';
    const feeAmount = Number(payoutMode === 'instant'
      ? payoutRules.instant_fee || 0
      : payoutRules.scheduled_fee || 0);
    const netAmount = Number(amount) - feeAmount;
    if (netAmount <= 0) throw new AppError('Withdrawal amount must be greater than the payout fee', 400);

    // Create withdrawal record
    const withdrawalResult = await dbClient.query(
      `INSERT INTO withdrawals
         (user_id, wallet_id, amount, account_name, account_number, ifsc_code, upi_id,
          payout_mode, fee_amount, net_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId, wallet.id, amount,
        account_name, account_number || null,
        ifsc_code || null, upi_id || null,
        payoutMode, feeAmount, netAmount,
      ]
    );
    const withdrawal = withdrawalResult.rows[0];

    // Deduct from available balance (held pending admin review)
    await recordTransaction(dbClient, {
      walletId:      wallet.id,
      userId,
      type:          'withdrawal',
      amount:        -amount,
      escrowDelta:   0,
      referenceId:   withdrawal.id,
      referenceType: 'withdrawal',
      description:   'Withdrawal requested — pending admin approval',
      metadata:      {
        withdrawal_id: withdrawal.id,
        payout_mode: payoutMode,
        fee_amount: feeAmount,
        net_amount: netAmount,
      },
    });

    await dbClient.query('COMMIT');

    logger.info('Withdrawal requested', { userId, amount, withdrawalId: withdrawal.id });
    return withdrawal;
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

/**
 * Admin approves or rejects a withdrawal.
 * On approve: mark as approved + paid (actual bank transfer is manual / via Razorpay Payouts).
 * On reject: refund the amount back to available balance.
 */
const reviewWithdrawal = async (withdrawalId, adminId, { action, admin_note }) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const result = await dbClient.query(
      `SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [withdrawalId]
    );
    const withdrawal = result.rows[0];
    if (!withdrawal) throw new AppError('Withdrawal not found or already reviewed', 404);

    if (action === 'approve') {
      await dbClient.query(
        `UPDATE withdrawals
         SET status      = 'paid',
             reviewed_by = $1,
             reviewed_at = NOW(),
             paid_at     = NOW(),
             admin_note  = $2
         WHERE id = $3`,
        [adminId, admin_note || null, withdrawalId]
      );

      logger.info('Withdrawal approved', { withdrawalId, adminId, amount: withdrawal.amount });
    }

    if (action === 'reject') {
      // Refund back to available balance
      const wallet = await getWalletByUserId(withdrawal.user_id, dbClient, true);

      await recordTransaction(dbClient, {
        walletId:      wallet.id,
        userId:        withdrawal.user_id,
        type:          'withdrawal_rejected',
        amount:        +withdrawal.amount,  // refund
        escrowDelta:   0,
        referenceId:   withdrawalId,
        referenceType: 'withdrawal',
        idempotencyKey: `withdrawal-refund:${withdrawalId}`,
        description:   `Withdrawal rejected — ${admin_note || 'no reason given'}`,
        metadata:      { withdrawal_id: withdrawalId },
      });

      await dbClient.query(
        `UPDATE withdrawals
         SET status      = 'rejected',
             reviewed_by = $1,
             reviewed_at = NOW(),
             admin_note  = $2
         WHERE id = $3`,
        [adminId, admin_note, withdrawalId]
      );

      logger.info('Withdrawal rejected + refunded', { withdrawalId, adminId });
    }

    await dbClient.query('COMMIT');

    const updated = await query('SELECT * FROM withdrawals WHERE id = $1', [withdrawalId]);
    return updated.rows[0];
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

/**
 * Get all pending withdrawals — admin dashboard.
 */
const getPendingWithdrawals = async ({ page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const result = await query(
    `SELECT w.*, u.full_name, u.email, u.role
     FROM withdrawals w
     JOIN users u ON u.id = w.user_id
     WHERE w.status = 'pending'
     ORDER BY w.created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'`
  );

  return {
    withdrawals: result.rows,
    pagination: {
      page, limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

// ── Job completion / cancellation ─────────────────────────────────────────────

/**
 * Mark a job as complete.
 * - Releases escrow to freelancer
 * - Decrements active_jobs_count
 * - Updates job + assignment status
 */
const completeJob = async (jobId, adminId, { completion_note } = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const jobResult = await dbClient.query(
      `SELECT * FROM jobs WHERE id = $1 FOR UPDATE`,
      [jobId]
    );
    const job = jobResult.rows[0];
    if (!job) throw new AppError('Job not found', 404);

    if (job.status !== 'in_progress') {
      throw new AppError(`Job must be in_progress to complete. Current: ${job.status}`, 400);
    }

    const activeDispute = await dbClient.query(
      `SELECT id FROM disputes WHERE job_id = $1 AND status IN ('open', 'under_review') LIMIT 1`,
      [jobId]
    );
    if (activeDispute.rows[0]) {
      throw new AppError('This project is in dispute. Escrow can only be released by support.', 409);
    }

    // Update job status
    await dbClient.query(
      `UPDATE jobs SET status = 'completed' WHERE id = $1`,
      [jobId]
    );

    // Update assignment
    await dbClient.query(
      `UPDATE job_assignments
       SET status                  = 'completed',
           completed_at            = NOW(),
           completed_at_confirmed  = NOW(),
           completion_note         = $1
       WHERE job_id = $2 AND status = 'accepted'`,
      [completion_note || null, jobId]
    );

    // Decrement active_jobs_count for freelancer
    if (job.active_freelancer_id) {
      await dbClient.query(
        `UPDATE users
         SET active_jobs_count     = GREATEST(0, active_jobs_count - 1),
             jobs_completed_count  = jobs_completed_count + 1
         WHERE id = $1`,
        [job.active_freelancer_id]
      );
    }

    await releaseEscrow(jobId, adminId, dbClient);
    await dbClient.query('COMMIT');
    // Mark WhatsApp session as completed
    setImmediate(async () => {
      try {
        await markSessionCompleted(jobId);
      } catch (err) {
        logger.warn('WA session mark complete failed', { jobId, error: err.message });
      }
    });

    logger.info('Job completed', { jobId, adminId });
    return { job_id: jobId, status: 'completed' };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

/**
 * Cancel a job that is in_progress or assigned.
 * - Refunds escrow to client
 * - Decrements active_jobs_count for freelancer
 */
const cancelActiveJob = async (jobId, cancelledBy, { cancel_reason } = {}) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const jobResult = await dbClient.query(
      `SELECT * FROM jobs WHERE id = $1 FOR UPDATE`,
      [jobId]
    );
    const job = jobResult.rows[0];
    if (!job) throw new AppError('Job not found', 404);

    if (!['assigned', 'in_progress'].includes(job.status)) {
      throw new AppError(
        `Only assigned or in_progress jobs can be cancelled. Current: ${job.status}`,
        400
      );
    }

    const activeDispute = await dbClient.query(
      `SELECT id FROM disputes WHERE job_id = $1 AND status IN ('open', 'under_review') LIMIT 1`,
      [jobId]
    );
    if (activeDispute.rows[0]) {
      throw new AppError('This project is in dispute. Support must resolve it before cancellation.', 409);
    }

    await dbClient.query(
      `UPDATE jobs SET status = 'cancelled', admin_note = $1 WHERE id = $2`,
      [cancel_reason || null, jobId]
    );

    await dbClient.query(
      `UPDATE job_assignments
       SET status = 'cancelled'
       WHERE job_id = $1 AND status IN ('pending_acceptance', 'accepted')`,
      [jobId]
    );

    // Decrement freelancer active_jobs_count
    if (job.active_freelancer_id) {
      await dbClient.query(
        `UPDATE users
         SET active_jobs_count = GREATEST(0, active_jobs_count - 1)
         WHERE id = $1`,
        [job.active_freelancer_id]
      );
    }

    // Keep cancellation and the escrow refund in one transaction.
    await refundEscrow(jobId, cancel_reason || 'Job cancelled', dbClient);
    await dbClient.query('COMMIT');

    // Refund escrow
    try {
      await refundEscrow(jobId, cancel_reason || 'Job cancelled');
    } catch (escrowErr) {
      logger.error('Escrow refund failed after cancellation — manual action required', {
        jobId, error: escrowErr.message,
      });
    }

    logger.info('Active job cancelled', { jobId, cancelledBy });
    return { job_id: jobId, status: 'cancelled' };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

// ── Admin wallet overview ─────────────────────────────────────────────────────

const getAdminWalletStats = async () => {
  const result = await query(
    `SELECT
       SUM(balance)                                          AS total_available,
       SUM(escrow_balance)                                   AS total_escrowed,
       SUM(balance + escrow_balance)                         AS total_platform_funds,
       COUNT(*)                                              AS total_wallets,
       COUNT(*) FILTER (WHERE balance > 0)                  AS active_wallets
     FROM wallets`
  );

  const pending = await query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM withdrawals WHERE status = 'pending'`
  );

  return {
    platform_funds:      result.rows[0],
    pending_withdrawals: pending.rows[0],
  };
};

/**
 * Admin manual wallet adjustment.
 * Used for testing, corrections, bonuses, and refunds outside Razorpay.
 * Creates a full ledger entry like any other transaction.
 *
 * @param {string} targetUserId  - user whose wallet to adjust
 * @param {string} adminId       - admin performing the action
 * @param {number} amount        - positive = credit, negative = debit
 * @param {string} note          - reason (required)
 */
const adminAdjustWallet = async (targetUserId, adminId, { amount, note }) => {
  if (!amount || amount === 0) {
    throw new AppError('amount must be a non-zero number', 400);
  }
  if (!note || note.trim().length < 3) {
    throw new AppError('note is required (min 3 characters)', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    const wallet = await getWalletByUserId(targetUserId, dbClient, true);

    const tx = await recordTransaction(dbClient, {
      walletId:      wallet.id,
      userId:        targetUserId,
      type:          'adjustment',
      amount:        parseFloat(amount),
      escrowDelta:   0,
      referenceId:   adminId,
      referenceType: 'manual',
      description:   `Admin adjustment: ${note.trim()}`,
      metadata:      { admin_id: adminId, note: note.trim() },
    });

    await dbClient.query('COMMIT');

    // Fetch updated wallet to return fresh balance
    const updated = await query(
      'SELECT balance, escrow_balance FROM wallets WHERE user_id = $1',
      [targetUserId]
    );

    logger.info('Admin wallet adjustment', {
      targetUserId,
      adminId,
      amount,
      note,
    });
    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'wallet.adjusted',
      entityType: 'wallet',
      entityId: wallet.id,
      afterState: { amount, new_balance: Number(updated.rows[0].balance), note },
    });

    return {
      transaction:     tx,
      new_balance:     parseFloat(updated.rows[0].balance),
      new_escrow:      parseFloat(updated.rows[0].escrow_balance),
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

module.exports = {
  getWallet,
  getTransactions,
  holdEscrow,
  releaseEscrow,
  refundEscrow,
  requestWithdrawal,
  reviewWithdrawal,
  getPendingWithdrawals,
  completeJob,
  cancelActiveJob,
  getAdminWalletStats,
  getWalletByUserId,
  recordTransaction,
  adminAdjustWallet,
};
