const paymentService = require('./payment.service');
const { validateTopUp } = require('../wallet/wallet.validator');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const createTopUpOrder = async (req, res, next) => {
  try {
    validateTopUp(req.body);
    const result = await paymentService.createTopUpOrder(
      req.user.sub,
      parseFloat(req.body.amount)
    );
    return sendSuccess(res, {
      data:       result,
      message:    'Order created. Complete payment using the Razorpay checkout.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new AppError('razorpay_order_id, razorpay_payment_id, and razorpay_signature are required', 400);
    }
    const result = await paymentService.verifyPayment(req.user.sub, req.body);
    return sendSuccess(res, {
      data:    result,
      message: result.already_credited
        ? 'Payment already credited to your wallet.'
        : 'Payment verified and wallet credited.',
    });
  } catch (err) { next(err); }
};

/**
 * Razorpay webhook — must NOT use authenticate middleware.
 * Uses raw body for signature verification.
 */
const razorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing webhook signature' });
    }

    const result = await paymentService.handleWebhook(req.rawBody, signature);

    // Always return 200 to Razorpay — even if we skip processing
    // Returning non-200 causes Razorpay to retry the webhook
    return res.status(200).json({ success: true, handled: result.handled });
  } catch (err) {
    logger.error('Razorpay webhook handler error', { error: err.message });
    // Return 200 anyway — we log the error, don't want Razorpay to spam retries
    // Transient processing failures must be retried by Razorpay.
    const status = err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

module.exports = { createTopUpOrder, verifyPayment, razorpayWebhook };
