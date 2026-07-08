const AppError = require('./AppError');
const logger = require('./logger');
const {
  assertRedisAvailable,
  handleRedisError,
  isRedisQuotaError,
  markRedisUnavailable,
} = require('../config/redis');

const unavailableMessage = (queueName) =>
  `${queueName} is temporarily unavailable because Redis request quota is exhausted.`;

const normalizeQueueError = (queueName, err) => {
  if (err?.redisCircuitOpen || isRedisQuotaError(err)) {
    handleRedisError(err);
    return new AppError(unavailableMessage(queueName), 503);
  }
  return err;
};

const withRedisQueueOperation = async (queueName, operation) => {
  try {
    assertRedisAvailable(queueName);
    return await operation();
  } catch (err) {
    throw normalizeQueueError(queueName, err);
  }
};

const attachRedisQueueErrorHandler = (emitter, queueName, closeFn = null) => {
  let closing = false;

  emitter.on('error', async (err) => {
    if (!isRedisQuotaError(err)) {
      logger.error(`${queueName} Redis error`, { error: err.message });
      return;
    }

    markRedisUnavailable(err);
    if (!closeFn || closing) return;

    closing = true;
    try {
      logger.warn(`${queueName} closing after Redis quota exhaustion`);
      await closeFn();
    } catch (closeErr) {
      logger.error(`${queueName} close after Redis quota exhaustion failed`, {
        error: closeErr.message,
      });
    }
  });
};

module.exports = {
  withRedisQueueOperation,
  attachRedisQueueErrorHandler,
  normalizeQueueError,
};
