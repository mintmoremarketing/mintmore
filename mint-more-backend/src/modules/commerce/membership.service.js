const Razorpay = require('razorpay');
const crypto = require('crypto');
const { query, getClient } = require('../../config/database');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { getSetting } = require('./settings.service');
const { recordCreditTransaction } = require('./credits.service');
const { writeAudit } = require('../audit/audit.service');
const { enqueueOutboxEvent } = require('../events/outbox.service');
const logger = require('../../utils/logger');

const razorpay = env.payments.mockCheckout
  ? null
  : new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });

const assertRazorpayConfigured = () => {
  const keyId = env.razorpay.keyId || '';
  const keySecret = env.razorpay.keySecret || '';
  const mostlyPlaceholder = (value) => /^[x_\-\s]+$/i.test(value) || /^(test|live)?_?key_?(id|secret)?$/i.test(value);
  if (
    !/^rzp_(test|live)_/.test(keyId) ||
    keySecret.length < 20 ||
    mostlyPlaceholder(keyId.replace(/^rzp_(test|live)_/i, '')) ||
    mostlyPlaceholder(keySecret)
  ) {
    throw new AppError('Payment checkout is temporarily unavailable because Razorpay is not configured. Please contact support.', 503);
  }
};

const callRazorpay = async (operation, request) => {
  try {
    return await request();
  } catch (error) {
    const providerStatus = Number(error.statusCode || error.status || error.response?.status || 0);
    logger.error('Razorpay request failed', {
      operation,
      providerStatus,
      providerError: error.error?.description || error.error?.reason || error.message || 'Unknown Razorpay error',
    });
    if ([401, 403].includes(providerStatus)) {
      throw new AppError('Payment checkout is temporarily unavailable because Razorpay credentials are invalid. Please contact support.', 503);
    }
    throw new AppError('Payment checkout is temporarily unavailable. Please try again shortly.', 502);
  }
};

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
  const membership = await getMembership(userId);
  if (env.payments.mockCheckout) {
    const dbClient = await getClient();
    try {
      await dbClient.query('BEGIN');
      const result = await dbClient.query(
        `INSERT INTO membership_payments
           (membership_id,user_id,kind,amount,status,metadata)
         VALUES ($1,$2,$3,$4,'created',$5)
         RETURNING *`,
        [
          membership?.id || null,
          userId,
          kind,
          amount,
          JSON.stringify({ days: pass?.days || null, mock_checkout: true }),
        ]
      );
      const payment = result.rows[0];
      const activated = await activatePayment(dbClient, payment, `mock_${crypto.randomUUID()}`);
      await dbClient.query('COMMIT');
      logger.warn('Mock membership checkout activated', { userId, kind, amount, paymentId: payment.id });
      return {
        checkout_mode: 'mock',
        payment,
        amount,
        currency: 'INR',
        activated,
      };
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  }

  assertRazorpayConfigured();
  if (kind === 'membership' && config.razorpay_plan_id) {
    if (membership?.razorpay_subscription_id && membership.auto_renew && membership.status === 'active') {
      throw new AppError('Your recurring membership is already active', 409);
    }
    const subscription = await callRazorpay('subscriptions.create', () => razorpay.subscriptions.create({
      plan_id: config.razorpay_plan_id,
      total_count: Number(config.subscription_cycles || 120),
      quantity: 1,
      customer_notify: true,
      notes: { user_id: userId, purpose: 'membership' },
    }));
    await query(
      `UPDATE memberships
       SET razorpay_subscription_id=$1, auto_renew=true
       WHERE user_id=$2`,
      [subscription.id, userId]
    );
    const result = await query(
      `INSERT INTO membership_payments
         (membership_id,user_id,kind,amount,razorpay_subscription_id,status,metadata)
       VALUES ($1,$2,'membership',$3,$4,'created',$5)
       RETURNING *`,
      [
        membership?.id || null,
        userId,
        amount,
        subscription.id,
        JSON.stringify({ recurring: true, plan_id: config.razorpay_plan_id }),
      ]
    );
    return {
      payment: result.rows[0],
      checkout_mode: 'subscription',
      subscription_id: subscription.id,
      amount,
      currency: 'INR',
      key_id: env.razorpay.keyId,
    };
  }
  const order = await callRazorpay('orders.create', () => razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    notes: { user_id: userId, purpose: kind, days: pass?.days || '' },
  }));
  const result = await query(
    `INSERT INTO membership_payments
       (membership_id,user_id,kind,amount,razorpay_order_id,status,metadata)
     VALUES ($1,$2,$3,$4,$5,'created',$6)
     RETURNING *`,
    [membership?.id || null, userId, kind, amount, order.id, JSON.stringify({ days: pass?.days || null })]
  );
  return { payment: result.rows[0], order_id: order.id, amount, amount_paise: order.amount, currency: 'INR', key_id: env.razorpay.keyId };
};

const activatePayment = async (dbClient, payment, paymentId) => {
  if (payment.status === 'paid') {
    return { already_processed: true, kind: payment.kind, user_id: payment.user_id };
  }

  const membershipResult = await dbClient.query(
    'SELECT * FROM memberships WHERE user_id = $1 FOR UPDATE',
    [payment.user_id]
  );
  const membership = membershipResult.rows[0];
  if (!membership) throw new AppError('Membership record not found', 404);

  await dbClient.query(
    `UPDATE membership_payments SET status='paid', razorpay_payment_id=$1, paid_at=NOW() WHERE id=$2`,
    [paymentId, payment.id]
  );

  if (payment.kind === 'access_pass') {
    const days = Number(payment.metadata.days);
    await dbClient.query(
      `INSERT INTO access_passes (user_id,days,price,starts_at,ends_at,payment_id)
       VALUES ($1,$2,$3,NOW(),NOW() + ($2::text || ' days')::interval,$4)
       ON CONFLICT DO NOTHING`,
      [payment.user_id, days, payment.amount, payment.id]
    );
  } else {
    const config = await getSetting('membership.monthly', {}, dbClient);
    const priorPayment = await dbClient.query(
      `SELECT 1 FROM membership_payments
       WHERE user_id=$1 AND kind IN ('membership','renewal') AND status='paid' AND id<>$2
       LIMIT 1`,
      [payment.user_id, payment.id]
    );
    const isRenewal = Boolean(priorPayment.rows[0]);
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
      userId: payment.user_id,
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
    actorId: payment.user_id,
    actorRole: 'client',
    action: `membership.${payment.kind}.paid`,
    entityType: 'membership_payment',
    entityId: payment.id,
    afterState: { status: 'paid', amount: payment.amount, payment_id: paymentId },
  }, dbClient);

  await enqueueOutboxEvent(
    'notification.create',
    {
      userId: payment.user_id,
      type: 'system',
      title: payment.kind === 'access_pass' ? 'Access pass active' : 'Membership active',
      body: payment.kind === 'access_pass'
        ? 'Your CREATYV access pass is ready to use.'
        : 'Your CREATYV membership is active and your included benefits are ready.',
      entityType: 'membership_payment',
      entityId: payment.id,
      data: { kind: payment.kind, amount: payment.amount },
      dedupeKey: `membership-payment:${payment.id}:confirmation`,
    },
    {
      dedupeKey: `membership-payment:${payment.id}:confirmation`,
      db: (text, params) => dbClient.query(text, params),
    }
  );

  return { activated: true, kind: payment.kind, user_id: payment.user_id };
};

const verifyCheckout = async (userId, payload) => {
  const subscriptionId = payload.razorpay_subscription_id;
  const signatureBody = subscriptionId
    ? `${payload.razorpay_payment_id}|${subscriptionId}`
    : `${payload.razorpay_order_id}|${payload.razorpay_payment_id}`;
  const expected = crypto.createHmac('sha256', env.razorpay.keySecret)
    .update(signatureBody)
    .digest('hex');
  if (expected !== payload.razorpay_signature) throw new AppError('Payment signature verification failed', 400);

  const capturedPayment = await callRazorpay('payments.fetch', () => razorpay.payments.fetch(payload.razorpay_payment_id));
  if (capturedPayment.status !== 'captured') {
    throw new AppError('Membership payment has not been captured yet', 400);
  }
  if (subscriptionId) {
    if (capturedPayment.subscription_id !== subscriptionId) {
      throw new AppError('Payment does not belong to this subscription', 400);
    }
  } else if (capturedPayment.order_id !== payload.razorpay_order_id) {
    throw new AppError('Payment does not belong to this order', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const paymentResult = subscriptionId
      ? await dbClient.query(
          `SELECT * FROM membership_payments
           WHERE razorpay_subscription_id=$1 AND user_id=$2
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [subscriptionId, userId]
        )
      : await dbClient.query(
          `SELECT * FROM membership_payments
           WHERE razorpay_order_id = $1 AND user_id = $2 FOR UPDATE`,
          [payload.razorpay_order_id, userId]
        );
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError('Membership payment not found', 404);
    if (
      Number(capturedPayment.amount) !== Math.round(Number(payment.amount) * 100) ||
      capturedPayment.currency !== payment.currency
    ) {
      throw new AppError('Captured payment amount does not match this membership checkout', 400);
    }
    const activated = await activatePayment(dbClient, payment, payload.razorpay_payment_id);
    await dbClient.query('COMMIT');
    return activated;
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const processSubscriptionCharge = async (subscriptionId, paymentId, amountPaise) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const membershipResult = await dbClient.query(
      `SELECT * FROM memberships WHERE razorpay_subscription_id=$1 FOR UPDATE`,
      [subscriptionId]
    );
    const membership = membershipResult.rows[0];
    if (!membership) {
      await dbClient.query('COMMIT');
      return { handled: false };
    }
    if (!paymentId || !Number.isFinite(Number(amountPaise)) || Number(amountPaise) <= 0) {
      throw new AppError('Invalid recurring payment payload', 400);
    }
    const duplicate = await dbClient.query(
      `SELECT * FROM membership_payments WHERE razorpay_payment_id=$1 FOR UPDATE`,
      [paymentId]
    );
    if (duplicate.rows[0]) {
      await dbClient.query('COMMIT');
      return { handled: true, already_processed: true, user_id: membership.user_id };
    }
    let paymentResult = await dbClient.query(
      `SELECT * FROM membership_payments
       WHERE razorpay_subscription_id=$1 AND status='created'
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
      [subscriptionId]
    );
    if (!paymentResult.rows[0]) {
      paymentResult = await dbClient.query(
        `INSERT INTO membership_payments
           (membership_id,user_id,kind,amount,razorpay_subscription_id,status,metadata)
         VALUES ($1,$2,'renewal',$3,$4,'created','{"recurring":true}'::jsonb)
         RETURNING *`,
        [membership.id, membership.user_id, Number(amountPaise || 0) / 100, subscriptionId]
      );
    }
    const activated = await activatePayment(dbClient, paymentResult.rows[0], paymentId);
    await dbClient.query('COMMIT');
    return { handled: true, ...activated };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const processSubscriptionState = async (subscriptionId, state) => {
  const stateMap = {
    paused: { status: 'paused', auto_renew: false },
    cancelled: { status: 'cancelled', auto_renew: false },
    completed: { status: 'expired', auto_renew: false },
    halted: { status: 'paused', auto_renew: false },
  };
  const next = stateMap[state];
  if (!next) return { handled: false };
  const result = await query(
    `UPDATE memberships SET status=$1, auto_renew=$2
     WHERE razorpay_subscription_id=$3 RETURNING user_id`,
    [next.status, next.auto_renew, subscriptionId]
  );
  return { handled: Boolean(result.rows[0]), user_id: result.rows[0]?.user_id };
};

const processCapturedPayment = async (orderId, paymentId) => {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `SELECT * FROM membership_payments WHERE razorpay_order_id = $1 FOR UPDATE`,
      [orderId]
    );
    const payment = result.rows[0];
    if (!payment) {
      await dbClient.query('COMMIT');
      return { handled: false };
    }
    const activated = await activatePayment(dbClient, payment, paymentId);
    await dbClient.query('COMMIT');
    return { handled: true, ...activated };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

const pauseMembership = async (userId) => {
  const membership = await getMembership(userId);
  if (membership?.razorpay_subscription_id && membership.auto_renew) {
    await callRazorpay('subscriptions.cancel', () => razorpay.subscriptions.cancel(membership.razorpay_subscription_id, {
      cancel_at_cycle_end: true,
    }));
  }
  const result = await query(
    `UPDATE memberships SET status='paused', auto_renew=false, paused_at=NOW()
     WHERE user_id=$1 AND status='active' RETURNING *`,
    [userId]
  );
  if (!result.rows[0]) throw new AppError('Active membership not found', 404);
  return result.rows[0];
};

module.exports = {
  getMembership,
  createCheckout,
  verifyCheckout,
  processCapturedPayment,
  processSubscriptionCharge,
  processSubscriptionState,
  pauseMembership,
};
