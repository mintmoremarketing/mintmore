require('dotenv').config();

const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { startPublishWorker } = require('./src/modules/social/queue/publish.worker');
const { startAIWorker } = require('./src/modules/ai/queue/ai.worker');
const { startFulfillmentWorker } = require('./src/modules/fulfillment/queue/fulfillment.worker');
const { startOutboxWorker } = require('./src/modules/events/queue/outbox.worker');

let server;

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

    logger.info('🔄 Connecting to Redis...');
    await connectRedis();

    // Start Redis-dependent background workers after Redis is ready
    startPublishWorker();
    startAIWorker();
    await startFulfillmentWorker();
    await startOutboxWorker();

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
const shutdown = (signal) => {
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

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections (never let them silently fail)
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
  shutdown('unhandledRejection');
});

bootstrap();
