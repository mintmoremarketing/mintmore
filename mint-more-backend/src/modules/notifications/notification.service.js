const { query } = require('../../config/database');
const { getRedis } = require('../../config/redis');
const logger = require('../../utils/logger');

/**
 * Redis channel used for SSE broadcasting.
 * Publisher: notification.service → createNotification
 * Subscriber: sse.js middleware → active SSE connections
 */
const SSE_CHANNEL = 'mint_more:notifications';

// ── Core: Create + Publish ────────────────────────────────────────────────────

/**
 * Create a notification row in the DB and publish it to Redis pub/sub
 * so all SSE subscribers receive it in real time.
 *
 * @param {object} params
 * @param {string} params.userId      - recipient user ID
 * @param {string} params.type        - notification_type enum value
 * @param {string} params.title       - short title (shown in notification bell)
 * @param {string} params.body        - full message text
 * @param {string} [params.entityType] - 'job' | 'negotiation' | 'kyc' | 'assignment'
 * @param {string} [params.entityId]  - UUID of the related entity
 * @param {object} [params.data]      - arbitrary JSON payload for frontend
 */
const createNotification = async ({
  userId,
  type,
  title,
  body,
  entityType = null,
  entityId   = null,
  data       = {},
  dedupeKey  = null,
}) => {
  try {
    const result = await query(
      `INSERT INTO notifications
         (user_id, type, title, body, entity_type, entity_id, data, dedupe_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE
         SET dedupe_key = EXCLUDED.dedupe_key
       RETURNING *`,
      [userId, type, title, body, entityType, entityId, JSON.stringify(data), dedupeKey]
    );

    const notification = result.rows[0];

    // Publish to Redis so SSE connections receive it instantly
    try {
      const redis = getRedis();
      await redis.publish(
        SSE_CHANNEL,
        JSON.stringify({
          userId,
          notification,
        })
      );
    } catch (redisErr) {
      // Redis publish failure must NEVER fail the notification insert
      logger.warn('Redis publish failed for notification', {
        notificationId: notification.id,
        error: redisErr.message,
      });
    }

    return notification;
  } catch (err) {
    // Notification failures must NEVER crash the calling service
    logger.error('Failed to create notification', {
      userId, type, error: err.message,
    });
    return null;
  }
};

/**
 * Bulk create notifications (e.g. admin broadcast, matched candidates).
 * Uses a single multi-row INSERT for efficiency.
 */
const createBulkNotifications = async (notifications) => {
  if (!notifications || notifications.length === 0) return [];

  try {
    const values = [];
    const params = [];
    let   paramIdx = 1;

    notifications.forEach(({ userId, type, title, body, entityType, entityId, data }) => {
      values.push(
        `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
      );
      params.push(
        userId, type, title, body,
        entityType || null,
        entityId   || null,
        JSON.stringify(data || {})
      );
    });

    const result = await query(
      `INSERT INTO notifications
         (user_id, type, title, body, entity_type, entity_id, data)
       VALUES ${values.join(', ')}
       RETURNING *`,
      params
    );

    // Publish each to Redis. Live delivery is best-effort; persisted
    // notifications must still count as created if Redis is unavailable.
    try {
      const redis = getRedis();
      await Promise.allSettled(
        result.rows.map((notification) =>
          redis.publish(
            SSE_CHANNEL,
            JSON.stringify({ userId: notification.user_id, notification })
          )
        )
      );
    } catch (redisErr) {
      logger.warn('Redis publish failed for bulk notifications', {
        count: result.rows.length,
        error: redisErr.message,
      });
    }

    return result.rows;
  } catch (err) {
    logger.error('Bulk notification insert failed', { error: err.message });
    return [];
  }
};

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Get paginated notifications for a user.
 * Supports filter by read/unread.
 */
const getUserNotifications = async (userId, { page = 1, limit = 20, unread_only = false } = {}) => {
  const offset = (page - 1) * limit;
  const params = [userId];
  let   whereExtra = '';

  if (unread_only) {
    whereExtra = 'AND is_read = false';
  }

  const result = await query(
    `SELECT * FROM notifications
     WHERE user_id = $1 ${whereExtra}
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [...params, limit, offset]
  );

  const countResult = await query(
    `SELECT
       COUNT(*)                                    AS total,
       COUNT(*) FILTER (WHERE is_read = false)    AS unread_count
     FROM notifications
     WHERE user_id = $1`,
    [userId]
  );

  return {
    notifications: result.rows,
    pagination: {
      page,
      limit,
      total:        parseInt(countResult.rows[0].total, 10),
      unread_count: parseInt(countResult.rows[0].unread_count, 10),
      pages:        Math.ceil(countResult.rows[0].total / limit),
    },
  };
};

/**
 * Get unread count only — lightweight for notification bell badge.
 */
const getUnreadCount = async (userId) => {
  const result = await query(
    `SELECT COUNT(*) AS unread_count
     FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return parseInt(result.rows[0].unread_count, 10);
};

// ── Mark Read ─────────────────────────────────────────────────────────────────

/**
 * Mark a single notification as read.
 * Only the owner can mark their own notification.
 */
const markAsRead = async (notificationId, userId) => {
  const result = await query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND is_read = false
     RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0] || null;
};

/**
 * Mark all of a user's notifications as read.
 */
const markAllAsRead = async (userId) => {
  const result = await query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false
     RETURNING id`,
    [userId]
  );
  return { marked_count: result.rowCount };
};

// ── Admin Broadcast ───────────────────────────────────────────────────────────

/**
 * Admin sends a broadcast notification to all users or a role group.
 * Fetches matching user IDs then bulk inserts.
 */
const adminBroadcast = async ({ title, body, role, data = {} }) => {
  const params = [];
  let   roleClause = '';

  if (role) {
    params.push(role);
    roleClause = `AND role = $${params.length}`;
  }

  const usersResult = await query(
    `SELECT id FROM users WHERE is_active = true ${roleClause}`,
    params
  );

  if (usersResult.rows.length === 0) {
    return { sent_count: 0 };
  }

  const notifications = usersResult.rows.map((u) => ({
    userId:     u.id,
    type:       'admin_broadcast',
    title,
    body,
    entityType: null,
    entityId:   null,
    data,
  }));

  const created = await createBulkNotifications(notifications);
  logger.info('Admin broadcast sent', { count: created.length, role: role || 'all' });
  return { sent_count: created.length };
};

module.exports = {
  SSE_CHANNEL,
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  adminBroadcast,
};
