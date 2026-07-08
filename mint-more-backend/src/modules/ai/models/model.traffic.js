const { getRedis, handleRedisError } = require('../../../config/redis');
const logger = require('../../../utils/logger');

/**
 * Redis keys for model traffic tracking.
 *
 * For each model we track:
 *   - active_requests:  how many requests currently in progress
 *   - queue_depth:      how many requests waiting in queue
 *   - avg_response_ms:  rolling average response time (last 100 requests)
 *   - error_rate:       error count in last 5 minutes
 *   - request_count:    total requests in last hour (for trending)
 */
const TRAFFIC_KEY     = (modelId) => `ai:traffic:${modelId}`;
const QUEUE_KEY       = (modelId) => `ai:queue:${modelId}`;
const RESPONSE_KEY    = (modelId) => `ai:response_ms:${modelId}`;
const ERROR_KEY       = (modelId) => `ai:errors:${modelId}`;
const HOURLY_KEY      = (modelId) => `ai:hourly:${modelId}`;

const TRAFFIC_TTL     = 300;  // 5 minutes
const HOURLY_TTL      = 3600; // 1 hour

// ── Track request lifecycle ───────────────────────────────────────────────────

const incrementActive = async (modelId) => {
  try {
    const redis = getRedis();
    await redis.incr(TRAFFIC_KEY(modelId));
    await redis.expire(TRAFFIC_KEY(modelId), TRAFFIC_TTL);
    await redis.incr(QUEUE_KEY(modelId));
    await redis.expire(QUEUE_KEY(modelId), TRAFFIC_TTL);
    await redis.incr(HOURLY_KEY(modelId));
    await redis.expire(HOURLY_KEY(modelId), HOURLY_TTL);
  } catch (err) {
    handleRedisError(err);
    logger.warn('Traffic increment failed', { modelId, error: err.message });
  }
};

const decrementActive = async (modelId, responseMs = null, isError = false) => {
  try {
    const redis = getRedis();
    const current = await redis.get(TRAFFIC_KEY(modelId));
    if (current && parseInt(current, 10) > 0) {
      await redis.decr(TRAFFIC_KEY(modelId));
    }
    const queueCurrent = await redis.get(QUEUE_KEY(modelId));
    if (queueCurrent && parseInt(queueCurrent, 10) > 0) {
      await redis.decr(QUEUE_KEY(modelId));
    }

    if (responseMs) {
      // Store response time in a list, keep last 20
      await redis.lpush(RESPONSE_KEY(modelId), responseMs);
      await redis.ltrim(RESPONSE_KEY(modelId), 0, 19);
      await redis.expire(RESPONSE_KEY(modelId), TRAFFIC_TTL);
    }

    if (isError) {
      await redis.incr(ERROR_KEY(modelId));
      await redis.expire(ERROR_KEY(modelId), 300); // 5 min window
    }
  } catch (err) {
    handleRedisError(err);
    logger.warn('Traffic decrement failed', { modelId, error: err.message });
  }
};

// ── Read traffic state ────────────────────────────────────────────────────────

const getModelTraffic = async (modelId) => {
  try {
    const redis = getRedis();
    const [active, queue, responseTimes, errors, hourly] = await Promise.all([
      redis.get(TRAFFIC_KEY(modelId)),
      redis.get(QUEUE_KEY(modelId)),
      redis.lrange(RESPONSE_KEY(modelId), 0, -1),
      redis.get(ERROR_KEY(modelId)),
      redis.get(HOURLY_KEY(modelId)),
    ]);

    const activeCount   = parseInt(active  || '0', 10);
    const queueDepth    = parseInt(queue   || '0', 10);
    const errorCount    = parseInt(errors  || '0', 10);
    const hourlyCount   = parseInt(hourly  || '0', 10);

    const avgResponseMs = responseTimes.length > 0
      ? Math.round(
          responseTimes.map(Number).reduce((a, b) => a + b, 0) / responseTimes.length
        )
      : null;

    // Compute load percentage (0-100)
    // Based on: active requests vs expected capacity per model tier
    const maxCapacity = 10; // assume 10 concurrent = 100% load
    const loadPct     = Math.min(100, Math.round((activeCount / maxCapacity) * 100));

    // Traffic status label
    let status, statusColor, estimatedWaitMin;
    if (loadPct === 0) {
      status = 'idle'; statusColor = 'green'; estimatedWaitMin = 0;
    } else if (loadPct < 30) {
      status = 'low'; statusColor = 'green'; estimatedWaitMin = 0;
    } else if (loadPct < 60) {
      status = 'moderate'; statusColor = 'yellow'; estimatedWaitMin = 1;
    } else if (loadPct < 85) {
      status = 'busy'; statusColor = 'orange'; estimatedWaitMin = 2;
    } else {
      status = 'high'; statusColor = 'red'; estimatedWaitMin = 5;
    }

    // Error rate (errors / hourly requests * 100)
    const errorRate = hourlyCount > 0
      ? Math.round((errorCount / hourlyCount) * 100)
      : 0;

    return {
      model_id:           modelId,
      active_requests:    activeCount,
      queue_depth:        queueDepth,
      load_percentage:    loadPct,
      avg_response_ms:    avgResponseMs,
      hourly_requests:    hourlyCount,
      error_rate:         errorRate,
      status,
      status_color:       statusColor,
      estimated_wait_min: estimatedWaitMin,
    };
  } catch (err) {
    handleRedisError(err);
    logger.warn('getModelTraffic failed', { modelId, error: err.message });
    return {
      model_id:           modelId,
      active_requests:    0,
      queue_depth:        0,
      load_percentage:    0,
      avg_response_ms:    null,
      hourly_requests:    0,
      error_rate:         0,
      status:             'unknown',
      status_color:       'gray',
      estimated_wait_min: 0,
    };
  }
};

/**
 * Get traffic for ALL models in the registry at once.
 * Used for the model selection UI — shows live status for every model.
 */
const getAllModelTraffic = async (modelIds) => {
  const trafficMap = {};
  await Promise.allSettled(
    modelIds.map(async (id) => {
      trafficMap[id] = await getModelTraffic(id);
    })
  );
  return trafficMap;
};

/**
 * Find the best available free model for failover.
 * Picks the free model with the lowest load percentage.
 */
const getBestFreeModel = async (freeModels) => {
  if (!freeModels || freeModels.length === 0) return null;

  const trafficData = await Promise.all(
    freeModels.map(async (model) => ({
      model,
      traffic: await getModelTraffic(model.id),
    }))
  );

  // Sort by load ascending, pick lowest load
  trafficData.sort((a, b) => a.traffic.load_percentage - b.traffic.load_percentage);
  return trafficData[0]?.model || freeModels[0];
};

module.exports = {
  incrementActive,
  decrementActive,
  getModelTraffic,
  getAllModelTraffic,
  getBestFreeModel,
};
