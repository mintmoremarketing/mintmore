const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');

const getCreditAccount = async (userId, dbClient = null, forUpdate = false) => {
  const executor = dbClient || { query };
  const result = await executor.query(
    `SELECT * FROM mint_credit_accounts WHERE user_id = $1 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId]
  );
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
}) => {
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
  if (Number(amount) < 0) {
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

const getCredits = async (userId) => {
  await expireCreditsForUser(userId);
  const account = await getCreditAccount(userId);
  const transactions = await query(
    'SELECT * FROM mint_credit_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return { balance: Number(account.balance), transactions: transactions.rows };
};

module.exports = { getCreditAccount, recordCreditTransaction, grantCredits, getCredits, expireCreditsForUser };
