const { Router } = require('express');
const controller = require('./payment.controller');
const { authenticate } = require('../../middleware/authenticate');
const { rawBody } = require('../../middleware/rawBody');
const {
  paymentCheckoutLimiter,
  paymentVerifyLimiter,
} = require('../../middleware/rateLimiter');

const router = Router();

// ── Razorpay webhook — NO auth middleware, uses rawBody ───────────────────────
// MUST be before express.json() — mounted in app.js with special handling
router.post('/webhook/razorpay', rawBody, controller.razorpayWebhook);

// ── Authenticated payment routes ──────────────────────────────────────────────
router.use(authenticate);

// POST  /api/v1/payments/topup/order     — create Razorpay order (step 1)
router.post('/topup/order', paymentCheckoutLimiter, controller.createTopUpOrder);

// POST  /api/v1/payments/topup/verify    — verify payment after checkout (step 2)
router.post('/topup/verify', paymentVerifyLimiter, controller.verifyPayment);

module.exports = router;
