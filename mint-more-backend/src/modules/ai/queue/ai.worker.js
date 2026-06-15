const { Worker, UnrecoverableError } = require('bullmq');
const { getRedis }  = require('../../../config/redis');
const { processGeneration } = require('../ai.service');
const logger = require('../../../utils/logger');

let aiWorker = null;

const startAIWorker = () => {
  if (aiWorker) return aiWorker;

  aiWorker = new Worker(
    'ai-generations',
    async (job) => {
      const { generationId } = job.data;
      logger.info('AI worker processing', { generationId, attempt: job.attemptsMade + 1 });
      try {
        await processGeneration(generationId);
      } catch (error) {
        if (error.retryable === false) {
          throw new UnrecoverableError(error.message);
        }
        throw error;
      }
    },
    {
      connection:  getRedis(),
      concurrency: 5,
    }
  );

  aiWorker.on('completed', (job) => {
    logger.info('AI job completed', { jobId: job.id, generationId: job.data.generationId });
  });

  aiWorker.on('failed', (job, err) => {
    logger.error('AI job failed', {
      jobId:         job?.id,
      generationId:  job?.data?.generationId,
      attempt:       job?.attemptsMade,
      error:         err.message,
    });
  });

  logger.info('AI worker started');
  return aiWorker;
};

module.exports = { startAIWorker };
