const { Queue } = require('bullmq');
const { getRedis } = require('../../../config/redis');
const { attachRedisQueueErrorHandler, withRedisQueueOperation } = require('../../../utils/redisQueueGuard');

let outboxQueue = null;

const getOutboxQueue = () => {
  if (!outboxQueue) {
    outboxQueue = new Queue('event-outbox', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
    attachRedisQueueErrorHandler(outboxQueue, 'Event outbox queue', closeOutboxQueue);
  }
  return outboxQueue;
};

const scheduleOutboxDispatcher = async () =>
  withRedisQueueOperation('Event outbox queue', () =>
    getOutboxQueue().add(
      'dispatch-pending-events',
      {},
      {
        jobId: 'event-outbox-dispatcher',
        repeat: { every: 5000 },
      }
    )
  );

const closeOutboxQueue = async () => {
  if (!outboxQueue) return;
  const queue = outboxQueue;
  outboxQueue = null;
  await queue.close();
};

module.exports = { getOutboxQueue, scheduleOutboxDispatcher, closeOutboxQueue };
