const { Queue } = require('bullmq');
const { getRedis } = require('../../../config/redis');

let aiQueue = null;

const getAIQueue = () => {
  if (!aiQueue) {
    aiQueue = new Queue('ai-generations', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 500 },
      },
    });
  }
  return aiQueue;
};

const enqueueGeneration = async (generationId) => {
  const queue  = getAIQueue();
  const job    = await queue.add('generate', { generationId }, { priority: 1 });
  return job.id;
};

const closeAIQueue = async () => {
  if (!aiQueue) return;
  const queue = aiQueue;
  aiQueue = null;
  await queue.close();
};

module.exports = { getAIQueue, enqueueGeneration, closeAIQueue };
