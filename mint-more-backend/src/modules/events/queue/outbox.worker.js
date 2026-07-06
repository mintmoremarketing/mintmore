const { Worker } = require('bullmq');
const { getRedis } = require('../../../config/redis');
const logger = require('../../../utils/logger');
const { dispatchPendingEvents } = require('../outbox.service');
const { scheduleOutboxDispatcher } = require('./outbox.queue');

let worker = null;

const startOutboxWorker = async () => {
  if (worker) return worker;
  worker = new Worker(
    'event-outbox',
    async (job) => {
      if (job.name !== 'dispatch-pending-events') return null;
      return dispatchPendingEvents();
    },
    { connection: getRedis(), concurrency: 1 }
  );
  worker.on('failed', (job, error) => {
    logger.error('[Outbox] Dispatcher job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: error.message,
    });
  });
  await scheduleOutboxDispatcher();
  logger.info('[Outbox] Dispatcher worker started');
  return worker;
};

const closeOutboxWorker = async () => {
  if (!worker) return;
  const activeWorker = worker;
  worker = null;
  await activeWorker.close();
};

module.exports = { startOutboxWorker, closeOutboxWorker };
