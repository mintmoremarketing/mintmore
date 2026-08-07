const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const {
  refreshRecentSocialAnalytics,
  refreshExpiringSocialTokens,
} = require('./social.service');

const ANALYTICS_INTERVAL_MS = 6 * 60 * 60 * 1000;
const TOKEN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WEEKLY_BATCH_INTERVAL_MS = 60 * 60 * 1000;

let analyticsTimer = null;
let tokenTimer = null;
let batchTimer = null;
let runningAnalytics = false;
let runningTokens = false;
let runningBatch = false;

const withAdvisoryLock = async (lockName, task) => {
  const lockResult = await query(
    'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
    [lockName]
  );
  if (!lockResult.rows[0]?.locked) {
    return false;
  }

  try {
    await task();
    return true;
  } finally {
    await query('SELECT pg_advisory_unlock(hashtext($1))', [lockName]);
  }
};

const runAnalyticsRefresh = async () => {
  if (runningAnalytics) return;
  runningAnalytics = true;
  try {
    await withAdvisoryLock('social-analytics-refresh', async () => {
      logger.info('[Social] Scheduled analytics refresh started');
      await refreshRecentSocialAnalytics();
      logger.info('[Social] Scheduled analytics refresh completed');
    });
  } catch (err) {
    logger.warn('[Social] Scheduled analytics refresh failed', { error: err.message });
  } finally {
    runningAnalytics = false;
  }
};

const runTokenRefresh = async () => {
  if (runningTokens) return;
  runningTokens = true;
  try {
    await withAdvisoryLock('social-token-refresh', async () => {
      logger.info('[Social] Scheduled token refresh started');
      await refreshExpiringSocialTokens();
      logger.info('[Social] Scheduled token refresh completed');
    });
  } catch (err) {
    logger.warn('[Social] Scheduled token refresh failed', { error: err.message });
  } finally {
    runningTokens = false;
  }
};

const runWeeklyBatchNotifications = async () => {
  if (runningBatch) return;
  runningBatch = true;
  try {
    const now = new Date();
    // Monday is 1, around 9 AM
    if (now.getDay() === 1 && now.getHours() === 9) {
      await withAdvisoryLock('social-weekly-batch', async () => {
        const redis = require('../../config/redis').getRedis();
        const dateKey = `weekly-batch-ran:${now.toISOString().split('T')[0]}`;
        const alreadyRan = await redis.get(dateKey);
        if (alreadyRan) return;

        logger.info('[Social] Scheduled weekly batch notifications started');
        const notificationService = require('../notifications/notification.service');
        const pending = await query(
          `SELECT sp.user_id, COUNT(sp.id) as pending_count
           FROM social_posts sp
           JOIN profiles p ON p.user_id = sp.user_id
           WHERE sp.status = 'in_review'
             AND p.posting_preferences->>'approval_mode' = 'weekly_batch'
           GROUP BY sp.user_id`
        );
        for (const row of pending.rows) {
          try {
            await notificationService.createNotification({
              type: 'batch_review',
              user_id: row.user_id,
              title: 'Weekly Batch Review',
              body: `You have ${row.pending_count} post${row.pending_count > 1 ? 's' : ''} waiting for your approval this week.`,
              dedupe_key: `batch_review_${row.user_id}_${dateKey}`,
            });
          } catch (err) {
            logger.error('Failed to send weekly batch notification', { error: err.message, user_id: row.user_id });
          }
        }
        await redis.setex(dateKey, 24 * 60 * 60, '1'); // prevent running again today
        logger.info('[Social] Scheduled weekly batch notifications completed');
      });
    }
  } catch (err) {
    logger.warn('[Social] Scheduled weekly batch notifications failed', { error: err.message });
  } finally {
    runningBatch = false;
  }
};

const startSocialSchedulers = () => {
  if (!analyticsTimer) {
    analyticsTimer = setInterval(runAnalyticsRefresh, ANALYTICS_INTERVAL_MS);
    analyticsTimer.unref?.();
  }

  if (!tokenTimer) {
    tokenTimer = setInterval(runTokenRefresh, TOKEN_INTERVAL_MS);
    tokenTimer.unref?.();
  }

  if (!batchTimer) {
    batchTimer = setInterval(runWeeklyBatchNotifications, WEEKLY_BATCH_INTERVAL_MS);
    batchTimer.unref?.();
  }

  void runAnalyticsRefresh();
  void runTokenRefresh();

  logger.info('[Social] Scheduler started');
};

const closeSocialSchedulers = async () => {
  if (analyticsTimer) {
    clearInterval(analyticsTimer);
    analyticsTimer = null;
  }
  if (tokenTimer) {
    clearInterval(tokenTimer);
    tokenTimer = null;
  }
  if (batchTimer) {
    clearInterval(batchTimer);
    batchTimer = null;
  }
  logger.info('[Social] Scheduler stopped');
};

module.exports = {
  startSocialSchedulers,
  closeSocialSchedulers,
};

