const { Router } = require('express');
const controller = require('./aiEdits.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { paymentCheckoutLimiter, paymentVerifyLimiter, aiEditRedeemLimiter } = require('../../middleware/rateLimiter');

const router = Router();

// ── Desktop app (its own token, no login) ─────────────────────────────────────
router.post('/redeem', aiEditRedeemLimiter, controller.redeem);
router.post('/app/state', controller.appState);

router.use(authenticate);

// ── Client ────────────────────────────────────────────────────────────────────
router.get('/', authorize('client'), controller.list);
router.post('/', authorize('client'), controller.create);
router.get('/:id', authorize('client'), controller.get);
router.post('/:id/pay', authorize('client'), paymentCheckoutLimiter, controller.pay);
router.post('/:id/verify', authorize('client'), paymentVerifyLimiter, controller.verify);
// The page hands a paid video to the helper on the client's computer.
router.post('/:id/connect', authorize('client'), aiEditRedeemLimiter, controller.connect);

module.exports = router;
