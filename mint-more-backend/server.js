require('dotenv').config();

const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { connectDB, pool } = require('./src/config/database');
const { connectRedis, closeRedis } = require('./src/config/redis');
const { initSSESubscriber, closeSSESubscriber } = require('./src/middleware/sse');
const { startPublishWorker, closePublishWorker } = require('./src/modules/social/queue/publish.worker');
const { startAIWorker, closeAIWorker } = require('./src/modules/ai/queue/ai.worker');
const { startFulfillmentWorker, closeFulfillmentWorker } = require('./src/modules/fulfillment/queue/fulfillment.worker');
const { startOutboxWorker, closeOutboxWorker } = require('./src/modules/events/queue/outbox.worker');
const { startSocialSchedulers, closeSocialSchedulers } = require('./src/modules/social/social.scheduler');
const { closePublishQueue } = require('./src/modules/social/queue/publish.queue');
const { closeAIQueue } = require('./src/modules/ai/queue/ai.queue');
const { closeFulfillmentQueue } = require('./src/modules/fulfillment/queue/fulfillment.queue');
const { closeOutboxQueue } = require('./src/modules/events/queue/outbox.queue');
const { ensureAIEngineSchema } = require('./src/modules/ai/ai.schema');

let server;
let shuttingDown = false;

/**
 * Boot sequence:
 * 1. Connect PostgreSQL
 * 2. Connect Redis
 * 3. Start HTTP server
 */
const bootstrap = async () => {
  try {
    logger.info('🔄 Connecting to PostgreSQL...');
    await connectDB();
    await ensureAIEngineSchema();

    logger.info('🔄 Connecting to Redis...');
    let redisReady = false;
    try {
      await connectRedis();
      initSSESubscriber();
      redisReady = true;
    } catch (redisErr) {
      if (env.node_env === 'production') throw redisErr;
      logger.warn('Redis unavailable - starting local API without live events or background workers', {
        error: redisErr.message,
      });
    }

    if (redisReady) {
      // Start Redis-dependent background workers after Redis is ready
      startPublishWorker();
      startAIWorker();
      await startFulfillmentWorker();
      await startOutboxWorker();
      startSocialSchedulers();
    }

    server = app.listen(env.port, () => {
      logger.info(`🚀 Mint More API running`);
      logger.info(`   ├─ Environment : ${env.node_env}`);
      logger.info(`   ├─ Port        : ${env.port}`);
      logger.info(`   └─ Base URL    : http://localhost:${env.port}/api/${env.apiVersion}`);
    });
  } catch (err) {
  console.error("❌ FULL ERROR:", err);
  logger.error('❌ Failed to start server', { error: err.message });
  process.exit(1);
}
};

// ── Graceful shutdown ─────────────────────────────────
const _legacyShutdown = (signal) => {
  logger.warn(`${signal} received — shutting down gracefully`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
    // Force-kill if graceful close takes > 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
};

const closeHttpServer = () => new Promise((resolve, reject) => {
  if (!server) return resolve();
  server.close((err) => (err ? reject(err) : resolve()));
});

const safeClose = async (label, closeFn) => {
  try {
    await closeFn();
    logger.info(`${label} closed`);
  } catch (err) {
    logger.error(`${label} close failed`, { error: err.message });
  }
};

const gracefulShutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`${signal} received - shutting down gracefully`);

  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
  forceTimer.unref();

  await safeClose('HTTP server', closeHttpServer);
  await Promise.all([
    safeClose('Social publish worker', closePublishWorker),
    safeClose('AI worker', closeAIWorker),
    safeClose('Fulfillment worker', closeFulfillmentWorker),
    safeClose('Outbox worker', closeOutboxWorker),
  ]);
  await Promise.all([
    safeClose('Social publish queue', closePublishQueue),
    safeClose('AI queue', closeAIQueue),
    safeClose('Fulfillment queue', closeFulfillmentQueue),
    safeClose('Outbox queue', closeOutboxQueue),
  ]);
  await safeClose('SSE subscriber', closeSSESubscriber);
  await safeClose('Redis', closeRedis);
  await safeClose('PostgreSQL pool', () => pool.end());
  await safeClose('Social schedulers', closeSocialSchedulers);

  clearTimeout(forceTimer);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled promise rejections (never let them silently fail)
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
  gracefulShutdown('unhandledRejection');
});

bootstrap();
