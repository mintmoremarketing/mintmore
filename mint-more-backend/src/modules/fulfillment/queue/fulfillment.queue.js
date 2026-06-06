const { Queue } = require('bullmq');
const { getRedis } = require('../../../config/redis');

let fulfillmentQueue = null;

const getFulfillmentQueue = () => {
  if (!fulfillmentQueue) {
    fulfillmentQueue = new Queue('fulfillment-monitor', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 15000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return fulfillmentQueue;
};

const scheduleFulfillmentMonitor = async () => {
  const queue = getFulfillmentQueue();
  return queue.add(
    'scan-stalled-deliveries',
    {},
    {
      jobId: 'stalled-delivery-monitor',
      repeat: { every: 15 * 60 * 1000 },
    }
  );
};

module.exports = { getFulfillmentQueue, scheduleFulfillmentMonitor };
