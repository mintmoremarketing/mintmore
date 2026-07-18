const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { writeAudit } = require('../audit/audit.service');

const getCreditAccount = async (userId, dbClient = null, forUpdate = false) => {
  const executor = dbClient || { query };
  let result = await executor.query(
    `SELECT * FROM mint_credit_accounts WHERE user_id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId]
  );
  if (!result.rows[0]) {
    await executor.query(
      `INSERT INTO mint_credit_accounts (user_id)
       SELECT id FROM users WHERE id = $1
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    result = await executor.query(
      `SELECT * FROM mint_credit_accounts WHERE user_id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
      [userId]
    );
  }
  if (!result.rows[0]) throw new AppError('Mint Credit account not found', 404);
  return result.rows[0];
};

const recordCreditTransaction = async (dbClient, {
  userId,
  type,
  amount,
  expiresAt = null,
  referenceId = null,
  referenceType = null,
  idempotencyKey = null,
  description = '',
  metadata = {},
  consumeLots = true,
}) => {
  const lockKey = idempotencyKey ? `mint-credit:${idempotencyKey}` : null;
  let locked = false;
  if (lockKey) {
    await dbClient.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
    locked = true;
  }

  try {
    if (idempotencyKey) {
      const existing = await dbClient.query(
        'SELECT * FROM mint_credit_transactions WHERE idempotency_key = $1',
        [idempotencyKey]
      );
      if (existing.rows[0]) return existing.rows[0];
    }
    const account = await getCreditAccount(userId, dbClient, true);
    const balanceAfter = Number(account.balance) + Number(amount);
    if (balanceAfter < 0) throw new AppError('Insufficient Mint Credits', 400);
    await dbClient.query('UPDATE mint_credit_accounts SET balance = $1 WHERE id = $2', [balanceAfter, account.id]);
    const result = await dbClient.query(
      `INSERT INTO mint_credit_transactions
         (account_id,user_id,type,amount,balance_after,expires_at,reference_id,
          reference_type,idempotency_key,description,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        account.id, userId, type, amount, balanceAfter, expiresAt, referenceId,
        referenceType, idempotencyKey, description, JSON.stringify(metadata),
      ]
    );
    const transaction = result.rows[0];
    if (Number(amount) > 0 && type !== 'reversal') {
      await dbClient.query(
        `INSERT INTO mint_credit_lots (user_id,grant_tx_id,granted_amount,remaining_amount,expires_at)
         VALUES ($1,$2,$3,$3,$4) ON CONFLICT (grant_tx_id) DO NOTHING`,
        [userId, transaction.id, amount, expiresAt]
      );
    }
    if (Number(amount) < 0 && consumeLots) {
      let remaining = Math.abs(Number(amount));
      const lots = await dbClient.query(
        `SELECT * FROM mint_credit_lots
         WHERE user_id=$1 AND remaining_amount > 0 AND expired_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY expires_at ASC NULLS LAST, created_at ASC FOR UPDATE`,
        [userId]
      );
      for (const lot of lots.rows) {
        if (remaining <= 0) break;
        const used = Math.min(Number(lot.remaining_amount), remaining);
        await dbClient.query(
          'UPDATE mint_credit_lots SET remaining_amount = remaining_amount - $1 WHERE id = $2',
          [used, lot.id]
        );
        remaining -= used;
      }
    }
    return transaction;
  } finally {
    if (locked) {
      await dbClient.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
    }
  }
};

const expireCreditsForUser = async (userId) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const lots = await dbClient.query(
      `SELECT * FROM mint_credit_lots
       WHERE user_id=$1 AND remaining_amount > 0 AND expired_at IS NULL AND expires_at <= NOW()
       FOR UPDATE`,
      [userId]
    );
    const amount = lots.rows.reduce((sum, lot) => sum + Number(lot.remaining_amount), 0);
    if (amount > 0) {
      await recordCreditTransaction(dbClient, {
        userId, type: 'expiry', amount: -amount,
        idempotencyKey: `credit-expiry:${lots.rows.map(lot => lot.id).sort().join(':')}`,
        description: 'Expired Mint Credits',
        consumeLots: false,
      });
      await dbClient.query(
        `UPDATE mint_credit_lots SET remaining_amount=0, expired_at=NOW()
         WHERE id = ANY($1::uuid[])`,
        [lots.rows.map(lot => lot.id)]
      );
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const grantCredits = async (userId, opts, externalClient = null) => {
  const dbClient = externalClient || await getClient();
  try {
    if (!externalClient) await dbClient.query('BEGIN');
    const tx = await recordCreditTransaction(dbClient, { userId, ...opts });
    if (!externalClient) await dbClient.query('COMMIT');
    return tx;
  } catch (err) {
    if (!externalClient) await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    if (!externalClient) dbClient.release();
  }
};

const ensureTrialCredits = async (userId) => {
  const [membershipResult, settingResult] = await Promise.all([
    query('SELECT status FROM memberships WHERE user_id = $1', [userId]),
    query("SELECT value FROM platform_settings WHERE key = 'membership.trial'"),
  ]);
  if (membershipResult.rows[0]?.status !== 'trial') return null;

  const rules = settingResult.rows[0]?.value || {};
  const amount = Number(rules.mint_credits || 0);
  const expiryDays = Math.max(1, Number(rules.mint_credit_expiry_days || rules.duration_days || 14));
  if (amount <= 0) return null;

  return grantCredits(userId, {
    type: 'trial_grant',
    amount,
    expiresAt: new Date(Date.now() + expiryDays * 86400000),
    referenceType: 'membership_trial',
    idempotencyKey: `trial-mintcoin:${userId}`,
    description: 'Trial MintCoins',
    metadata: { expiry_days: expiryDays },
  });
};

const getCredits = async (userId) => {
  await expireCreditsForUser(userId);
  const account = await getCreditAccount(userId);
  const transactions = await query(
    'SELECT * FROM mint_credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return { balance: Number(account.balance), transactions: transactions.rows };
};

const adjustCreditsByAdmin = async ({
  userId,
  adminId,
  amount,
  note,
  expiryDays = null,
  idempotencyKey,
  requestMeta = {},
}) => {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
    throw new AppError('A non-zero MintCoin amount is required', 400);
  }
  if (!String(note || '').trim()) throw new AppError('A note is required', 400);
  if (!idempotencyKey) throw new AppError('Idempotency-Key header is required', 400);

  const target = await query('SELECT id, role, full_name, email FROM users WHERE id = $1', [userId]);
  if (!target.rows[0]) throw new AppError('User not found', 404);
  if (target.rows[0].role !== 'client') throw new AppError('MintCoins can only be adjusted for client accounts', 400);

  const days = parsedAmount > 0 && expiryDays !== null && expiryDays !== ''
    ? Number(expiryDays)
    : null;
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    throw new AppError('Expiry days must be between 1 and 3650', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const existing = await dbClient.query(
      'SELECT * FROM mint_credit_transactions WHERE idempotency_key = $1',
      [`admin-mintcoin:${idempotencyKey}`]
    );
    if (existing.rows[0]) {
      await dbClient.query('COMMIT');
      return {
        balance: Number(existing.rows[0].balance_after),
        transaction: existing.rows[0],
        user: target.rows[0],
        idempotent_replay: true,
      };
    }
    const before = await getCreditAccount(userId, dbClient, true);
    const transaction = await recordCreditTransaction(dbClient, {
      userId,
      type: parsedAmount > 0 ? 'admin_grant' : 'reversal',
      amount: parsedAmount,
      expiresAt: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
      referenceType: 'admin_adjustment',
      idempotencyKey: `admin-mintcoin:${idempotencyKey}`,
      description: String(note).trim(),
      metadata: { adjusted_by: adminId, expiry_days: days },
    });
    await writeAudit({
      actorId: adminId,
      actorRole: 'admin',
      action: 'mintcoin.adjusted',
      entityType: 'mint_credit_account',
      entityId: before.id,
      beforeState: { balance: Number(before.balance) },
      afterState: { balance: Number(transaction.balance_after), transaction_id: transaction.id },
      metadata: {
        target_user_id: userId,
        amount: parsedAmount,
        note: String(note).trim(),
        expiry_days: days,
      },
      ...requestMeta,
    }, dbClient);
    await dbClient.query('COMMIT');
    return {
      balance: Number(transaction.balance_after),
      transaction,
      user: target.rows[0],
    };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

module.exports = {
  getCreditAccount,
  recordCreditTransaction,
  grantCredits,
  ensureTrialCredits,
  getCredits,
  expireCreditsForUser,
  adjustCreditsByAdmin,
};
