const { verifyAccessToken } = require('../utils/jwt');
const { getRedis, handleRedisError, isRedisQuotaError } = require('../config/redis');
const env = require('../config/env');
const AppError = require('../utils/AppError');

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
