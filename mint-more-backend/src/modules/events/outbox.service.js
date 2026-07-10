const { query, getClient } = require('../../config/database');
const logger = require('../../utils/logger');
const notificationTriggers = require('../notifications/notification.triggers');
const notificationService = require('../notifications/notification.service');
const AppError = require('../../utils/AppError');

const MAX_ATTEMPTS = 10;
const PROCESSING_TIMEOUT_MINUTES = 10;

const handlers = {
  'notification.trigger': async ({ trigger, args = [] }) => {
    const handler = notificationTriggers[trigger];
    if (typeof handler !== 'function') {
      throw new Error(`Unknown notification trigger: ${trigger}`);
    }
    return handler(...args);
  },
  'notification.create': async (payload) => notificationService.createNotification(payload),
  'notification.bulk_create': async ({ notifications }) =>
    notificationService.createBulkNotifications(notifications),
  'matching.run': async ({ jobId, reason }) => {
    const { getSetting } = require('../commerce/settings.service');
    const flags = await getSetting('feature_flags', { freelancer_matching: false });
    if (flags?.freelancer_matching === false) {
      logger.info('[Outbox] Matching event skipped by feature flag', { jobId, reason });
      return { skipped: true, reason: 'freelancer_matching_disabled' };
    }
    const { runMatchingForJob } = require('../matching/matching.service');
    const result = await runMatchingForJob(jobId);
    logger.info(`[Outbox] Auto-matching completed (${reason || 'event'})`, { jobId });
    return result;
  },
  'chat.create_for_job': async ({ jobId, clientId, freelancerId }) => {
    const { createChatRoom } = require('../chat/chat.service');
    const [clientResult, jobCategoryResult] = await Promise.all([
      query('SELECT whatsapp_number FROM users WHERE id = $1', [clientId]),
      query(
        `SELECT wn.waba_phone_id
         FROM whatsapp_numbers wn
         JOIN categories category ON category.id = wn.category_id
         JOIN jobs job ON job.category_id = category.id
         WHERE job.id = $1 AND wn.is_active = true
         LIMIT 1`,
        [jobId]
      ),
    ]);
    return createChatRoom({
      jobId,
      clientId,
      freelancerId,
      clientWaNumber: clientResult.rows[0]?.whatsapp_number || null,
      mmWaNumberId: jobCategoryResult.rows[0]?.waba_phone_id || null,
    });
  },
};

const enqueueOutboxEvent = async (
  eventType,
  payload,
  { dedupeKey = null, availableAt = null, db = query } = {}
) => {
  const result = await db(
    `INSERT INTO event_outbox (event_type, payload, dedupe_key, available_at)
     VALUES ($1, $2::JSONB, $3, COALESCE($4::TIMESTAMPTZ, NOW()))
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE
       SET dedupe_key = EXCLUDED.dedupe_key
     RETURNING *`,
    [eventType, JSON.stringify(payload || {}), dedupeKey, availableAt]
  );
  return result.rows[0];
};

const claimPendingEvents = async (limit = 50) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `WITH claimable AS (
         SELECT id
         FROM event_outbox
         WHERE (
           status = 'pending'
           OR (
             status = 'processing'
             AND locked_at < NOW() - ($2::TEXT || ' minutes')::INTERVAL
           )
         )
           AND available_at <= NOW()
           AND attempts < $3
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE event_outbox event
       SET status = 'processing',
           attempts = event.attempts + 1,
           locked_at = NOW(),
           updated_at = NOW()
       FROM claimable
       WHERE event.id = claimable.id
       RETURNING event.*`,
      [limit, PROCESSING_TIMEOUT_MINUTES, MAX_ATTEMPTS]
    );
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const markCompleted = async (eventId) => {
  await query(
    `UPDATE event_outbox
     SET status = 'completed', completed_at = NOW(), locked_at = NULL,
         last_error = NULL, updated_at = NOW()
     WHERE id = $1`,
    [eventId]
  );
};

const markFailed = async (event, error) => {
  const exhausted = Number(event.attempts) >= MAX_ATTEMPTS;
  const retryDelaySeconds = Math.min(15 * (2 ** Math.max(Number(event.attempts) - 1, 0)), 3600);
  await query(
    `UPDATE event_outbox
     SET status = $2,
         available_at = CASE WHEN $2 = 'pending'
           THEN NOW() + ($3::TEXT || ' seconds')::INTERVAL
           ELSE available_at
         END,
         locked_at = NULL,
         last_error = $4,
         updated_at = NOW()
     WHERE id = $1`,
    [event.id, exhausted ? 'failed' : 'pending', retryDelaySeconds, error.message.slice(0, 2000)]
  );
};

const dispatchPendingEvents = async ({ limit = 50 } = {}) => {
  const events = await claimPendingEvents(limit);
  let completed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const handler = handlers[event.event_type];
      if (!handler) throw new Error(`No outbox handler registered for ${event.event_type}`);
      await handler(event.payload || {});
      await markCompleted(event.id);
      completed += 1;
    } catch (error) {
      await markFailed(event, error);
      failed += 1;
      logger.error('[Outbox] Event dispatch failed', {
        eventId: event.id,
        eventType: event.event_type,
        attempts: event.attempts,
        error: error.message,
      });
    }
  }

  return { claimed: events.length, completed, failed };
};

const dispatchOutboxImmediately = async () => {
  try {
    return await dispatchPendingEvents();
  } catch (error) {
    logger.warn('[Outbox] Immediate dispatch failed; safety-net sweep will retry', {
      error: error.message,
    });
    return null;
  }
};

const listOutboxEvents = async ({ status = null, limit = 50 } = {}) => {
  const result = await query(
    `SELECT id, event_type, dedupe_key, status, attempts, available_at,
            locked_at, completed_at, last_error, created_at, updated_at
     FROM event_outbox
     WHERE ($1::TEXT IS NULL OR status = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [status, Math.min(Number(limit) || 50, 200)]
  );
  return result.rows;
};

const retryOutboxEvent = async (eventId) => {
  const result = await query(
    `UPDATE event_outbox
     SET status = 'pending', attempts = 0, available_at = NOW(),
         locked_at = NULL, last_error = NULL, updated_at = NOW()
     WHERE id = $1 AND status = 'failed'
     RETURNING id, event_type, dedupe_key, status, attempts, available_at, created_at`,
    [eventId]
  );
  if (!result.rows[0]) throw new AppError('Failed outbox event not found', 404);
  return result.rows[0];
};

module.exports = {
  enqueueOutboxEvent,
  dispatchPendingEvents,
  dispatchOutboxImmediately,
  listOutboxEvents,
  retryOutboxEvent,
};
