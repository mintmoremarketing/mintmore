const { Router } = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');
const { authLoginLimiter } = require('../../middleware/rateLimiter');

const router = Router();

// Public routes
router.post('/register', controller.register);
router.post('/login',    authLoginLimiter, controller.login);
router.post('/reset-password', controller.resetPassword);
router.post('/refresh',  controller.refresh);

// Protected routes (require valid access token)
router.post('/logout',   authenticate, controller.logout);
router.get('/me',        authenticate, controller.getMe);

module.exports = router;
