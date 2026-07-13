const { handleRedisError, isRedisQuotaError } = require('../config/redis');
const { verifyAccessToken } = require('../utils/jwt');
const { SSE_CHANNEL } = require('../modules/notifications/notification.service');
const logger = require('../utils/logger');
const { AI_PROGRESS_CHANNEL } = require('../modules/ai/ai.service');
const env = require('../config/env');

/**
 * Active SSE connections map.
 * Map<userId, Set<Response>>
 *
 * A user may have multiple tabs open — each gets its own SSE response object.
 * We store a Set so all tabs receive the notification simultaneously.
 */
const activeConnections = new Map();

/**
 * SSE connection handler middleware.
 *
 * Client connects to GET /api/v1/notifications/stream
 * with Authorization: Bearer <token> in the header.
 *
 * The connection stays open. Every time a notification is published to Redis,
 * this handler writes it to the matching user's response(s).
 *
 * Uses a dedicated Redis subscriber instance (one per process).
 * The subscriber is created once and reused for all connections.
 */

let redisSubscriber = null;

const initSSESubscriber = () => {
  if (redisSubscriber) return;

  const Redis = require('ioredis');
  const env   = require('../config/env');

  redisSubscriber = new Redis(env.redis.url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  redisSubscriber.subscribe(SSE_CHANNEL, (err) => {
    if (err) {
      logger.error('SSE Redis subscriber failed to subscribe', { error: err.message });
    } else {
      logger.info('SSE Redis subscriber ready', { channel: SSE_CHANNEL });
    }
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel !== SSE_CHANNEL) return;

    try {
      const { userId, notification } = JSON.parse(message);
      const userConnections = activeConnections.get(userId);

      if (!userConnections || userConnections.size === 0) return;

      const payload = `data: ${JSON.stringify(notification)}\n\n`;

      userConnections.forEach((res) => {
        try {
          res.write(payload);
        } catch (writeErr) {
          // Connection was closed — cleanup happens in the 'close' handler
          logger.debug('SSE write failed — connection likely closed', { userId });
        }
      });
    } catch (parseErr) {
      logger.warn('SSE message parse error', { error: parseErr.message });
    }
  });

  redisSubscriber.on('error', (err) => {
    handleRedisError(err);
    if (isRedisQuotaError(err)) return;
    logger.error('SSE Redis subscriber error', { error: err.message });
  });

  // Also subscribe to chat channel
  const { CHAT_REDIS_CHANNEL } = require('../modules/chat/chat.service');

  redisSubscriber.subscribe(CHAT_REDIS_CHANNEL, (err) => {
    if (err) {
      logger.error('SSE chat subscriber failed', { error: err.message });
    } else {
      logger.info('SSE chat subscriber ready', { channel: CHAT_REDIS_CHANNEL });
    }
  });

  // Subscribe to AI progress channel
  redisSubscriber.subscribe(AI_PROGRESS_CHANNEL, (err) => {
    if (err) logger.error('SSE AI subscriber failed', { error: err.message });
    else logger.info('SSE AI progress subscriber ready');
  });

  // Handle chat messages — push to room participants
  // NOTE: The existing 'message' handler already runs.
  // We extend it to handle both channels:
  redisSubscriber.removeAllListeners('message');

  redisSubscriber.on('message', (channel, rawMessage) => {
    try {
      const payload = JSON.parse(rawMessage);

      if (channel === SSE_CHANNEL) {
        // Notification
        const { userId, notification } = payload;
        const userConns = activeConnections.get(userId);
        if (!userConns || userConns.size === 0) return;
        const data = `data: ${JSON.stringify({ type: 'notification', payload: notification })}\n\n`;
        userConns.forEach((res) => { try { res.write(data); } catch {} });
      }

      if (channel === CHAT_REDIS_CHANNEL) {
        // Chat message — push to both client and freelancer in the room
        const { eventType = 'chat_message', roomId, recipientIds = [], ...eventPayload } = payload;

        // We need room participants — fetch from a local in-memory cache or
        // push to ALL connected users and let the client filter by roomId
        // Simple approach: broadcast with roomId, client filters
        recipientIds.forEach((userId) => {
          const connections = activeConnections.get(userId);
          if (!connections) return;
          const data = `data: ${JSON.stringify({ type: eventType, roomId, ...eventPayload })}\n\n`;
          connections.forEach((res) => { try { res.write(data); } catch {} });
        });
      }

      if (channel === AI_PROGRESS_CHANNEL) {
        const { userId } = payload;
        const userConns  = activeConnections.get(userId);
        if (!userConns)  return;
        const data = `data: ${JSON.stringify({ type: 'ai_progress', ...payload })}\n\n`;
        userConns.forEach((res) => { try { res.write(data); } catch {} });
      }
    } catch (err) {
      logger.warn('SSE message handler error', { error: err.message });
    }
  
    
  
  });

};

const closeSSESubscriber = async () => {
  activeConnections.forEach((connections) => {
    connections.forEach((res) => {
      try {
        res.end();
      } catch {}
    });
  });
  activeConnections.clear();

  if (!redisSubscriber) return;
  const subscriber = redisSubscriber;
  redisSubscriber = null;
  await subscriber.quit();
};

/**
 * Express middleware for SSE stream endpoint.
 * Authenticates via Bearer token in Authorization header or ?token= query param.
 */
const sseHandler = async (req, res) => {
  // ── Auth ────────────────────────────────────────────────────────────────────
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    // Allow token via query param for EventSource (browser API doesn't support headers)
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Authorization token required' });
    return;
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return;
  }

  const userId = decoded.sub;
  const origin = req.headers.origin;
  if (origin && env.security.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // ── SSE Headers ─────────────────────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // ── Register connection ──────────────────────────────────────────────────────
  if (!activeConnections.has(userId)) {
    activeConnections.set(userId, new Set());
  }
  activeConnections.get(userId).add(res);

  logger.debug('SSE client connected', {
    userId,
    total_connections: activeConnections.get(userId).size,
  });

  // ── Keepalive ping every 30 seconds ─────────────────────────────────────────
  // Prevents proxy/load balancer from closing the idle connection
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 30_000);

  // ── Welcome event ────────────────────────────────────────────────────────────
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connected' })}\n\n`);

  // ── Cleanup on disconnect ────────────────────────────────────────────────────
  req.on('close', () => {
    clearInterval(keepAliveInterval);

    const userConns = activeConnections.get(userId);
    if (userConns) {
      userConns.delete(res);
      if (userConns.size === 0) {
        activeConnections.delete(userId);
      }
    }

    logger.debug('SSE client disconnected', { userId });
  });
};

module.exports = { sseHandler, initSSESubscriber, closeSSESubscriber };
