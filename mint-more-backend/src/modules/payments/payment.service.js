const Razorpay = require('razorpay');
const crypto   = require('crypto');
const { query, getClient } = require('../../config/database');
const env      = require('../../config/env');
const { getWalletByUserId, recordTransaction } = require('../wallet/wallet.service');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const {
  processCapturedPayment,
  processSubscriptionCharge,
  processSubscriptionState,
} = require('../commerce/membership.service');

const razorpay = new Razorpay({
  key_id:     env.razorpay.keyId,
  key_secret: env.razorpay.keySecret,
});

/**
 * Step 1 — Create a Razorpay order.
 * Client calls this → gets back order_id → opens Razorpay checkout.
 */
const createTopUpOrder = async (userId, amount) => {
  const wallet        = await getWalletByUserId(userId);
  const amountPaise   = Math.round(amount * 100); // Razorpay uses paise

  // Create order on Razorpay
  const rpOrder = await razorpay.orders.create({
    amount:   amountPaise,
    currency: 'INR',
    notes:    { user_id: userId, wallet_id: wallet.id },
  });

  // Save order in our DB
  const result = await query(
    `INSERT INTO razorpay_orders
       (user_id, wallet_id, razorpay_order_id, amount, amount_paise, status)
     VALUES ($1, $2, $3, $4, $5, 'created')
     RETURNING *`,
    [userId, wallet.id, rpOrder.id, amount, amountPaise]
  );

  logger.info('Razorpay order created', {
    userId,
    orderId:     rpOrder.id,
    amount,
  });

  return {
    order_id:   rpOrder.id,
    amount,
    amount_paise: amountPaise,
    currency:   'INR',
    key_id:     env.razorpay.keyId,  // frontend needs this to open checkout
  };
};

/**
 * Step 2 — Webhook handler.
 * Razorpay POSTs to our webhook URL after payment.
 * We verify the signature then credit the wallet.
 *
 * IMPORTANT: This must use the raw body (not parsed JSON) for signature verification.
 */
const handleWebhook = async (rawBody, signature) => {
  // Verify Razorpay webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', env.razorpay.webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== signature) {
    logger.warn('Razorpay webhook signature mismatch');
    throw new AppError('Invalid webhook signature', 400);
  }

  const event = JSON.parse(rawBody);
  logger.info('Razorpay webhook received', { event: event.event });

  // Only handle payment.captured — the confirmed payment event
  if (event.event === 'subscription.charged') {
    const subscription = event.payload?.subscription?.entity;
    const payment = event.payload?.payment?.entity;
    if (!subscription?.id || !payment?.id) {
      throw new AppError('Malformed subscription charge webhook', 400);
    }
    const result = await processSubscriptionCharge(subscription.id, payment.id, payment.amount);
    logger.info('Membership subscription charge processed', {
      subscriptionId: subscription.id,
      paymentId: payment.id,
      userId: result.user_id,
      handled: result.handled,
    });
    return result;
  }

  const subscriptionStateEvents = {
    'subscription.paused': 'paused',
    'subscription.cancelled': 'cancelled',
    'subscription.completed': 'completed',
    'subscription.halted': 'halted',
  };
  if (subscriptionStateEvents[event.event]) {
    const subscriptionId = event.payload?.subscription?.entity?.id;
    if (!subscriptionId) throw new AppError('Malformed subscription state webhook', 400);
    const result = await processSubscriptionState(subscriptionId, subscriptionStateEvents[event.event]);
    logger.info('Membership subscription state updated', {
      subscriptionId,
      state: subscriptionStateEvents[event.event],
      handled: result.handled,
    });
    return result;
  }

  if (event.event !== 'payment.captured') {
    return { handled: false, event: event.event };
  }

  const payment  = event.payload.payment.entity;
  const orderId  = payment.order_id;
  const paymentId = payment.id;

  const membershipResult = await processCapturedPayment(orderId, paymentId);
  if (membershipResult.handled) {
    logger.info('Membership payment processed via Razorpay webhook', {
      orderId,
      paymentId,
      userId: membershipResult.user_id,
    });
    return membershipResult;
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // Find our order record
    const orderResult = await dbClient.query(
      `SELECT * FROM razorpay_orders
       WHERE razorpay_order_id = $1
         AND status = 'created'
       FOR UPDATE`,
      [orderId]
    );

    const order = orderResult.rows[0];
    if (!order) {
      // Already processed or unknown order
      await dbClient.query('COMMIT');
      logger.warn('Webhook: order not found or already processed', { orderId });
      return { handled: false, reason: 'order_not_found_or_duplicate' };
    }

    // Mark order as paid
    await dbClient.query(
      `UPDATE razorpay_orders
       SET status               = 'paid',
           razorpay_payment_id  = $1,
           webhook_verified     = true
       WHERE id = $2`,
      [paymentId, order.id]
    );

    // Credit the user's wallet
    const wallet = await getWalletByUserId(order.user_id, dbClient, true);

    await recordTransaction(dbClient, {
      walletId:      wallet.id,
      userId:        order.user_id,
      type:          'topup',
      amount:        +order.amount,
      escrowDelta:   0,
      referenceId:   order.id,
      referenceType: 'razorpay_order',
      idempotencyKey: `wallet-topup:${order.id}`,
      description:   `Wallet top-up via Razorpay (${paymentId})`,
      metadata:      {
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
      },
    });

    await dbClient.query('COMMIT');

    logger.info('Wallet credited via Razorpay webhook', {
      userId:    order.user_id,
      amount:    order.amount,
      paymentId,
    });

    return { handled: true, amount: order.amount, user_id: order.user_id };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    logger.error('Webhook processing failed', { orderId, error: err.message });
    throw err;
  } finally {
    dbClient.release();
  }
};

/**
 * Verify a payment manually (client-side verification fallback).
 * Called when client returns from Razorpay checkout.
 * Only used as a fallback — webhook is the primary credit mechanism.
 */
const verifyPayment = async (userId, {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  // Verify signature
  const body     = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expected = crypto
    .createHmac('sha256', env.razorpay.keySecret)
    .update(body)
    .digest('hex');

  if (expected !== razorpay_signature) {
    throw new AppError('Payment signature verification failed', 400);
  }

  // Check if webhook already credited the wallet
  const order = await query(
    `SELECT * FROM razorpay_orders
     WHERE razorpay_order_id = $1 AND user_id = $2`,
    [razorpay_order_id, userId]
  );

  if (!order.rows[0]) {
    throw new AppError('Order not found', 404);
  }

  if (order.rows[0].status === 'paid') {
    // Already credited by webhook — just confirm
    return { already_credited: true, amount: order.rows[0].amount };
  }

  // Webhook hasn't fired yet — credit manually (idempotent guard above prevents double-credit)
  logger.warn('Manual payment verification triggered — webhook may be delayed', {
    userId, razorpay_order_id,
  });

  // Reuse webhook handler logic
  const rpPayment = await razorpay.payments.fetch(razorpay_payment_id);
  if (rpPayment.status !== 'captured') {
    throw new AppError('Payment has not been captured yet', 400);
  }
  if (rpPayment.order_id !== razorpay_order_id) {
    throw new AppError('Payment does not belong to this order', 400);
  }
  if (Number(rpPayment.amount) !== Number(order.rows[0].amount_paise) || rpPayment.currency !== 'INR') {
    throw new AppError('Captured payment amount does not match this order', 400);
  }

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const lockedOrderResult = await dbClient.query(
      `SELECT * FROM razorpay_orders
       WHERE razorpay_order_id = $1 AND user_id = $2
       FOR UPDATE`,
      [razorpay_order_id, userId]
    );
    const lockedOrder = lockedOrderResult.rows[0];
    if (!lockedOrder) throw new AppError('Order not found', 404);
    if (lockedOrder.status === 'paid') {
      await dbClient.query('COMMIT');
      return { already_credited: true, amount: lockedOrder.amount };
    }
    if (lockedOrder.status !== 'created') {
      throw new AppError(`Order cannot be credited from status: ${lockedOrder.status}`, 409);
    }

    await dbClient.query(
      `UPDATE razorpay_orders
       SET status              = 'paid',
           razorpay_payment_id = $1,
           razorpay_signature  = $2,
           webhook_verified    = false
       WHERE id = $3 AND status = 'created'`,
      [razorpay_payment_id, razorpay_signature, lockedOrder.id]
    );

    const wallet = await getWalletByUserId(userId, dbClient, true);

    await recordTransaction(dbClient, {
      walletId:      wallet.id,
      userId,
      type:          'topup',
      amount:        +lockedOrder.amount,
      escrowDelta:   0,
      referenceId:   lockedOrder.id,
      referenceType: 'razorpay_order',
      idempotencyKey: `wallet-topup:${lockedOrder.id}`,
      description:   `Wallet top-up via manual verify (${razorpay_payment_id})`,
      metadata:      { razorpay_order_id, razorpay_payment_id },
    });

    await dbClient.query('COMMIT');

    return { credited: true, amount: lockedOrder.amount };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
};

module.exports = { createTopUpOrder, handleWebhook, verifyPayment };
