const { Queue } = require('bullmq');
const { getRedis } = require('../../../config/redis');
const { attachRedisQueueErrorHandler, withRedisQueueOperation } = require('../../../utils/redisQueueGuard');

let publishQueue = null;

const getPublishQueue = () => {
  if (!publishQueue) {
    publishQueue = new Queue('social-publish', {
      connection: getRedis(),
      defaultJobOptions: {
        attempts:    3,
        backoff: {
          type:  'exponential',
          delay: 10000,   // 10s, 20s, 40s
        },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 200 },
      },
    });
    attachRedisQueueErrorHandler(publishQueue, 'Social publish queue', closePublishQueue);
  }
  return publishQueue;
};

/**
 * Schedule a post for publishing.
 * If publish_at is in the past or null → publish immediately.
 * If publish_at is in the future → BullMQ delays the job.
 */
const schedulePost = async (postId, publishAt = null) => {
  return withRedisQueueOperation('Social publish queue', async () => {
    const queue = getPublishQueue();

    const delay = publishAt
      ? Math.max(0, new Date(publishAt).getTime() - Date.now())
      : 0;

    const job = await queue.add(
      'publish-post',
      { postId },
      { delay }
    );

    return job.id;
  });
};

/**
 * Cancel a scheduled post (remove from queue).
 */
const cancelScheduledPost = async (queueJobId) => {
  try {
    const queue = getPublishQueue();
    const job = await queue.getJob(queueJobId);
    if (job) await job.remove();
    return true;
  } catch (err) {
    return false;
  }
};

const closePublishQueue = async () => {
  if (!publishQueue) return;
  const queue = publishQueue;
  publishQueue = null;
  await queue.close();
};

module.exports = { getPublishQueue, schedulePost, cancelScheduledPost, closePublishQueue };
