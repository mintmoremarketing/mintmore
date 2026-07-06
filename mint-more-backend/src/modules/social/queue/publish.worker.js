const { Worker } = require('bullmq');
const { getRedis }   = require('../../../config/redis');
const { executePublish } = require('../social.service');
const logger = require('../../../utils/logger');

let worker = null;

const startPublishWorker = () => {
  if (worker) return worker;

  worker = new Worker(
    'social-publish',
    async (job) => {
      const { postId } = job.data;
      logger.info('Publish worker processing', { postId, attempt: job.attemptsMade + 1 });

      await executePublish(postId);

      logger.info('Publish worker completed', { postId });
    },
    {
      connection: getRedis(),
      concurrency: 3,   // process 3 posts in parallel max
    }
  );

  worker.on('completed', (job) => {
    logger.info('Publish job completed', { jobId: job.id, postId: job.data.postId });
  });

  worker.on('failed', (job, err) => {
    logger.error('Publish job failed', {
      jobId:   job?.id,
      postId:  job?.data?.postId,
      attempt: job?.attemptsMade,
      error:   err.message,
    });
  });

  logger.info('Social publish worker started');
  return worker;
};

const closePublishWorker = async () => {
  if (!worker) return;
  const activeWorker = worker;
  worker = null;
  await activeWorker.close();
};

module.exports = { startPublishWorker, closePublishWorker };
