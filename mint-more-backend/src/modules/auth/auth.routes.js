const { Router } = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');
const { authLoginLimiter, passwordResetLimiter } = require('../../middleware/rateLimiter');

const router = Router();

// Public routes
router.post('/register', controller.register);
router.post('/login',    authLoginLimiter, controller.login);
router.post('/reset-password', passwordResetLimiter, controller.resetPassword);
router.post('/refresh',  controller.refresh);

// Protected routes (require valid access token)
router.post('/logout',   authenticate, controller.logout);
router.get('/me',        authenticate, controller.getMe);
// Wrong-current-password guesses share the login limit.
router.post('/change-password', authenticate, authLoginLimiter, controller.changePassword);

module.exports = router;
