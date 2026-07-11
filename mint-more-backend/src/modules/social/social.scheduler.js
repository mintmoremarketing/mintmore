const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const {
  refreshRecentSocialAnalytics,
  refreshExpiringSocialTokens,
} = require('./social.service');

const ANALYTICS_INTERVAL_MS = 6 * 60 * 60 * 1000;
const TOKEN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let analyticsTimer = null;
let tokenTimer = null;
let runningAnalytics = false;
let runningTokens = false;

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

const startSocialSchedulers = () => {
  if (!analyticsTimer) {
    analyticsTimer = setInterval(runAnalyticsRefresh, ANALYTICS_INTERVAL_MS);
    analyticsTimer.unref?.();
  }

  if (!tokenTimer) {
    tokenTimer = setInterval(runTokenRefresh, TOKEN_INTERVAL_MS);
    tokenTimer.unref?.();
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
  logger.info('[Social] Scheduler stopped');
};

module.exports = {
  startSocialSchedulers,
  closeSocialSchedulers,
};

