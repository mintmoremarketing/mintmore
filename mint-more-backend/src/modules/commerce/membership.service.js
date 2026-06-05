const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { getSetting } = require('./settings.service');
const { recordCreditTransaction } = require('./credits.service');
const { writeAudit } = require('../audit/audit.service');

const razorpay = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });

const getMembership = async (userId) => {
  const result = await query('SELECT * FROM memberships WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
};

const createCheckout = async (userId, { kind = 'membership', days } = {}) => {
  const config = await getSetting(kind === 'access_pass' ? 'access_passes' : 'membership.monthly', {});
  const pass = kind === 'access_pass'
    ? (config || []).find((entry) => Number(entry.days) === Number(days))
    : null;
  if (kind === 'access_pass' && !pass) throw new AppError('Access pass is unavailable', 400);
  const amount = kind === 'access_pass' ? Number(pass.price) : Number(config.price || 999);
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    notes: { user_id: userId, purpose: kind, days: pass?.days || '' },
  });
  const membership = await getMembership(userId);
  const result = await query(
    `INSERT INTO membership_payments
       (membership_id,user_id,kind,amount,razorpay_order_id,status,metadata)
     VALUES ($1,$2,$3,$4,$5,'created',$6)
     RETURNING *`,
    [membership?.id || null, userId, kind, amount, order.id, JSON.stringify({ days: pass?.days || null })]
  );
  return { payment: result.rows[0], order_id: order.id, amount, amount_paise: order.amount, currency: 'INR', key_id: env.razorpay.keyId };
};

const verifyCheckout = async (userId, payload) => {
  const expected = crypto.createHmac('sha256', env.razorpay.keySecret)
    .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
    .digest('hex');
  if (expected !== payload.razorpay_signature) throw new AppError('Payment signature verification failed', 400);

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const paymentResult = await dbClient.query(
      `SELECT * FROM membership_payments
       WHERE razorpay_order_id = $1 AND user_id = $2 FOR UPDATE`,
      [payload.razorpay_order_id, userId]
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError('Membership payment not found', 404);
    if (payment.status === 'paid') {
      await dbClient.query('COMMIT');
      return { already_processed: true };
    }

    const membershipResult = await dbClient.query('SELECT * FROM memberships WHERE user_id = $1 FOR UPDATE', [userId]);
    const membership = membershipResult.rows[0];
    if (!membership) throw new AppError('Membership record not found', 404);

    await dbClient.query(
      `UPDATE membership_payments SET status='paid', razorpay_payment_id=$1, paid_at=NOW() WHERE id=$2`,
      [payload.razorpay_payment_id, payment.id]
    );

    if (payment.kind === 'access_pass') {
      const days = Number(payment.metadata.days);
      await dbClient.query(
        `INSERT INTO access_passes (user_id,days,price,starts_at,ends_at,payment_id)
         VALUES ($1,$2,$3,NOW(),NOW() + ($2::text || ' days')::interval,$4)`,
        [userId, days, payment.amount, payment.id]
      );
    } else {
      const config = await getSetting('membership.monthly', {}, dbClient);
      const isRenewal = membership.status === 'active' || membership.status === 'paused';
      const creditAmount = Number(isRenewal ? config.renewal_credits : config.welcome_credits);
      const expiryDays = Number(isRenewal ? config.renewal_expiry_days : config.welcome_expiry_days);
      await dbClient.query(
        `UPDATE memberships
         SET status='active', current_period_start=NOW(),
             current_period_end=GREATEST(COALESCE(current_period_end,NOW()),NOW()) + INTERVAL '30 days',
             paused_at=NULL, auto_renew=true
         WHERE id=$1`,
        [membership.id]
      );
      await recordCreditTransaction(dbClient, {
        userId,
        type: isRenewal ? 'renewal_grant' : 'welcome_grant',
        amount: creditAmount,
        expiresAt: new Date(Date.now() + expiryDays * 86400000),
        referenceId: payment.id,
        referenceType: 'membership_payment',
        idempotencyKey: `membership-credit:${payment.id}`,
        description: isRenewal ? 'Membership renewal Mint Credits' : 'Welcome Mint Credits',
      });
    }

    await writeAudit({
      actorId: userId,
      actorRole: 'client',
      action: `membership.${payment.kind}.paid`,
      entityType: 'membership_payment',
      entityId: payment.id,
      afterState: { status: 'paid', amount: payment.amount },
    }, dbClient);
    await dbClient.query('COMMIT');
    return { activated: true, kind: payment.kind };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const pauseMembership = async (userId) => {
  const result = await query(
    `UPDATE memberships SET status='paused', auto_renew=false, paused_at=NOW()
     WHERE user_id=$1 AND status='active' RETURNING *`,
    [userId]
  );
  if (!result.rows[0]) throw new AppError('Active membership not found', 404);
  return result.rows[0];
};

module.exports = { getMembership, createCheckout, verifyCheckout, pauseMembership };
