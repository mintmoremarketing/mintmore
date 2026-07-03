const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

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
      logger.error('Redis error', { error: err.message });
      // Don't reject here — ioredis manages reconnection internally
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
  if (!redisClient) {
    throw new Error('Redis client not initialised. Call connectRedis() first.');
  }
  return redisClient;
};

module.exports = { connectRedis, getRedis };
