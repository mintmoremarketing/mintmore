const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const { sendError } = require('../utils/apiResponse');

/**
 * Global rate limiter applied to all API routes.
 * Keep this broad limiter generous for the SPA shell; tighter per-route
 * limiters belong on auth, AI, payment, and upload endpoints.
 */
const globalRateLimiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs, // default: 15 minutes
  max: env.security.rateLimitMax, // default: 1000 requests / window
  skip: (req) => req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, {
      statusCode: 429,
      message: 'Too many requests. Please slow down and try again later.',
    });
  },
});

const createSensitiveEndpointLimiter = ({ max, message }) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  skip: (req) => req.method === 'OPTIONS',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return sendError(res, {
      statusCode: 429,
      message,
    });
  },
});

const authLoginLimiter = createSensitiveEndpointLimiter({
  max: 10,
  message: 'Too many login attempts. Please wait and try again.',
});

const paymentCheckoutLimiter = createSensitiveEndpointLimiter({
  max: 20,
  message: 'Too many checkout attempts. Please wait and try again.',
});

const paymentVerifyLimiter = createSensitiveEndpointLimiter({
  max: 30,
  message: 'Too many payment verification attempts. Please wait and try again.',
});

module.exports = {
  globalRateLimiter,
  authLoginLimiter,
  paymentCheckoutLimiter,
  paymentVerifyLimiter,
};
