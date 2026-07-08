const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let redisClient = null;
let redisUnavailableUntil = 0;
let lastRedisLimitLogAt = 0;

const REDIS_LIMIT_COOLDOWN_MS = Number(process.env.REDIS_LIMIT_COOLDOWN_MS || 5 * 60 * 1000);
const REDIS_LIMIT_LOG_INTERVAL_MS = 60 * 1000;

const isRedisQuotaError = (err) =>
  /ERR max requests limit exceeded|max requests limit exceeded/i.test(err?.message || String(err || ''));

const markRedisUnavailable = (err) => {
  if (!isRedisQuotaError(err)) return;

  redisUnavailableUntil = Date.now() + REDIS_LIMIT_COOLDOWN_MS;
  const now = Date.now();
  if (now - lastRedisLimitLogAt > REDIS_LIMIT_LOG_INTERVAL_MS) {
    lastRedisLimitLogAt = now;
    logger.error('Redis request quota exhausted; pausing Redis-backed features temporarily', {
      error: err.message,
      cooldownMs: REDIS_LIMIT_COOLDOWN_MS,
    });
  }
};

const getRedisCircuitState = () => ({
  open: Date.now() < redisUnavailableUntil,
  unavailableUntil: redisUnavailableUntil ? new Date(redisUnavailableUntil).toISOString() : null,
});

const assertRedisAvailable = (operation = 'Redis operation') => {
  const state = getRedisCircuitState();
  if (!state.open) return;

  const err = new Error(`${operation} unavailable because Redis request quota is exhausted`);
  err.redisCircuitOpen = true;
  err.retryAfterMs = Math.max(0, redisUnavailableUntil - Date.now());
  throw err;
};

const handleRedisError = (err) => {
  if (isRedisQuotaError(err)) markRedisUnavailable(err);
  return err;
};

const connectRedis = () => {
  return new Promise((resolve, reject) => {
    let startupTimer;
    let resolved = false;
    const client = new Redis(env.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times === 1 || times % 20 === 0) {
          logger.warn(`Redis: reconnecting (attempt ${times})`);
        }
        return Math.min(times * 250, 5000);
      },
    });

    client.on('connect', () => {
      logger.info('✅ Redis connected');
    });

    client.on('ready', () => {
      redisClient = client;
      if (!resolved) {
        resolved = true;
        if (startupTimer) clearTimeout(startupTimer);
        resolve(client);
      }
    });

    client.on('error', (err) => {
      if (isRedisQuotaError(err)) {
        markRedisUnavailable(err);
        return;
      }
      logger.error(`Redis error: ${err.message}`, { error: err.message });
      // Don't reject here - ioredis manages reconnection internally
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    // If it doesn't connect within 10s, reject (startup guard)
    startupTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Redis connection timed out after 10s'));
      }
    }, 10000);
  });
};

const getRedis = () => {
  assertRedisAvailable('Redis');
  if (!redisClient) {
    throw new Error('Redis client not initialised. Call connectRedis() first.');
  }
  return redisClient;
};

const closeRedis = async () => {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = null;
  await client.quit();
};

module.exports = {
  connectRedis,
  getRedis,
  closeRedis,
  isRedisQuotaError,
  markRedisUnavailable,
  handleRedisError,
  assertRedisAvailable,
  getRedisCircuitState,
};
