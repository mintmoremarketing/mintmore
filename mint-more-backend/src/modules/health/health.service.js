const { query } = require('../../config/database');
const { getRedis, getRedisCircuitState, handleRedisError } = require('../../config/redis');
const logger = require('../../utils/logger');

/**
 * Runs lightweight connectivity checks against DB and Redis.
 * Returns structured status object used by the health controller.
 */
const getHealthStatus = async () => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    redis: 'unknown',
    outbox: 'unknown',
  };

  try {
    await query('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    logger.error('Health check - DB failed', { error: err.message });
    checks.database = 'error';
  }

  try {
    const redisState = getRedisCircuitState();
    if (redisState.open) {
      checks.redis = 'error';
      checks.redis_reason = 'request_quota_exhausted';
      checks.redis_unavailable_until = redisState.unavailableUntil;
    } else {
      const redis = getRedis();
      const pong = await redis.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'degraded';
    }
  } catch (err) {
    handleRedisError(err);
    logger.error('Health check - Redis failed', { error: err.message });
    checks.redis = 'error';
  }

  try {
    const outbox = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'failed') AS failed,
         COUNT(*) FILTER (
           WHERE status IN ('pending', 'processing')
             AND available_at < NOW() - INTERVAL '15 minutes'
         ) AS delayed
       FROM event_outbox`
    );
    const failed = Number(outbox.rows[0].failed);
    const delayed = Number(outbox.rows[0].delayed);
    checks.outbox = failed > 0 ? 'error' : delayed > 0 ? 'degraded' : 'ok';
  } catch (err) {
    logger.error('Health check - outbox failed', { error: err.message });
    checks.outbox = 'error';
  }

  const allOk = ['server', 'database', 'redis', 'outbox'].every((key) => checks[key] === 'ok');

  return {
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    checks,
  };
};

module.exports = { getHealthStatus };
