const { Worker } = require('bullmq');
const { getRedis } = require('../../../config/redis');
const logger = require('../../../utils/logger');
const { scanStalledDeliveries } = require('../fulfillment.service');
const { scheduleFulfillmentMonitor } = require('./fulfillment.queue');

let worker = null;

const startFulfillmentWorker = async () => {
  if (worker) return worker;
  worker = new Worker(
    'fulfillment-monitor',
    async (job) => {
      if (job.name !== 'scan-stalled-deliveries') return null;
      return scanStalledDeliveries();
    },
    { connection: getRedis(), concurrency: 1 }
  );
  worker.on('failed', (job, err) => {
    logger.error('[Fulfillment] Monitor job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: err.message,
    });
  });
  await scheduleFulfillmentMonitor();
  logger.info('[Fulfillment] Monitor worker started');
  return worker;
};

module.exports = { startFulfillmentWorker };
