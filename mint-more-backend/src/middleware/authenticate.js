const { verifyAccessToken } = require('../utils/jwt');
const { getRedis, handleRedisError, isRedisQuotaError } = require('../config/redis');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Freelancers idle for 24 hours have booking switched off, so record when each one was
// last active. Written at most every 5 minutes per user to keep it off the hot path.
const ACTIVITY_WRITE_MS = 5 * 60 * 1000;
const lastActivityWrite = new Map();
const recordActivity = (userId) => {
  const now = Date.now();
  if (now - (lastActivityWrite.get(userId) || 0) < ACTIVITY_WRITE_MS) return;
  lastActivityWrite.set(userId, now);
  if (lastActivityWrite.size > 50000) lastActivityWrite.clear();
  query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [userId])
    .catch((err) => logger.warn('Could not record user activity', { userId, error: err.message }));
};

/**
 * Authenticate middleware.
 * - Extracts Bearer token from Authorization header
 * - Verifies JWT signature and expiry
 * - Checks token is not blacklisted (logged out)
 * - Attaches decoded payload to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization header missing or malformed', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) throw new AppError('Token not provided', 401);

    // 2. Verify token
    const decoded = verifyAccessToken(token);

    // 3. Check blacklist (Redis). Local development can run without Redis so
    // smoke tests still work; production must keep the revocation check strict.
    try {
      const redis = getRedis();
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new AppError('Token has been revoked. Please log in again.', 401);
      }
    } catch (redisErr) {
      handleRedisError(redisErr);
      const skipBlacklist = redisErr.redisCircuitOpen || isRedisQuotaError(redisErr);
      // JWT signature/expiry is still enforced. Only the logout blacklist
      // check is skipped while Redis quota is exhausted.
      if (!skipBlacklist && (!env.isDev || redisErr instanceof AppError)) {
        throw redisErr;
      }
    }

    // 4. Attach to request
    req.user  = decoded; // { sub, email, role, iat, exp }
    req.token = token;
    if (decoded.role === 'freelancer') recordActivity(decoded.sub);

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role guard factory — use AFTER authenticate.
 * Example: router.delete('/users/:id', authenticate, authorize('admin'), controller.delete)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

module.exports = { authenticate, authorize };
