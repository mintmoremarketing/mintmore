const { query } = require('../../config/database');
const notificationService = require('../notifications/notification.service');
const logger = require('../../utils/logger');

const claimReminder = async ({ key, jobId, recipientId, type, metadata = {} }) => {
  const result = await query(
    `INSERT INTO workflow_reminders
       (reminder_key, job_id, recipient_id, reminder_type, metadata)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (reminder_key) DO NOTHING
     RETURNING id`,
    [key, jobId, recipientId, type, JSON.stringify(metadata)]
  );
  return result.rows[0]?.id || null;
};

const releaseReminderClaim = async (id) => {
  if (id) await query('DELETE FROM workflow_reminders WHERE id=$1', [id]);
};

const getSupportAdminIds = async () => {
  const result = await query(
    `SELECT id FROM users
     WHERE role='admin' AND is_active=true
       AND (is_super_admin=true OR admin_permissions @> ARRAY['*']::TEXT[]
            OR admin_permissions @> ARRAY['support.manage']::TEXT[])`
  );
  return result.rows.map((row) => row.id);
};

const getStalledDeliveries = async () => {
  const result = await query(
    `SELECT DISTINCT ON (j.id)
       j.id AS job_id, j.title, j.client_id, j.active_freelancer_id,
       file.id AS file_id, file.created_at AS delivered_at
     FROM jobs j
     JOIN mintbox_files file ON file.job_id=j.id
       AND file.purpose='delivery'
       AND file.deleted_by_client_at IS NULL
     WHERE j.status='in_progress'
       AND file.status NOT IN ('approved')
       AND file.created_at <= NOW() - INTERVAL '24 hours'
       AND NOT EXISTS (
         SELECT 1 FROM disputes dispute
         WHERE dispute.job_id=j.id AND dispute.status IN ('open','under_review')
       )
       AND NOT EXISTS (
         SELECT 1 FROM mintbox_files newer
         WHERE newer.job_id=j.id AND newer.purpose='delivery'
           AND newer.deleted_by_client_at IS NULL
           AND newer.created_at > file.created_at
       )
     ORDER BY j.id, file.created_at DESC`
  );
  return result.rows;
};

const sendReminder = async (delivery) => {
  const reminderId = await claimReminder({
    key: `delivery-reminder:${delivery.file_id}:24h`,
    jobId: delivery.job_id,
    recipientId: delivery.client_id,
    type: 'delivery_reminder',
    metadata: { file_id: delivery.file_id, delivered_at: delivery.delivered_at },
  });
  if (!reminderId) return false;

  const notification = await notificationService.createNotification({
    userId: delivery.client_id,
    type: 'delivery_reminder',
    title: 'Delivery waiting for your review',
    body: `New work for "${delivery.title}" is waiting in Mintbox. Approve it, request a revision, or contact support.`,
    entityType: 'job',
    entityId: delivery.job_id,
    data: { job_id: delivery.job_id, file_id: delivery.file_id },
  });
  if (!notification) {
    await releaseReminderClaim(reminderId);
    return false;
  }
  return true;
};

const escalateDelivery = async (delivery, adminIds) => {
  if (new Date(delivery.delivered_at).getTime() > Date.now() - 48 * 60 * 60 * 1000) return 0;
  let sent = 0;
  for (const adminId of adminIds) {
    const reminderId = await claimReminder({
      key: `delivery-escalation:${delivery.file_id}:48h:${adminId}`,
      jobId: delivery.job_id,
      recipientId: adminId,
      type: 'stalled_order',
      metadata: { file_id: delivery.file_id, client_id: delivery.client_id },
    });
    if (!reminderId) continue;
    const notification = await notificationService.createNotification({
      userId: adminId,
      type: 'stalled_order',
      title: 'Delivery review is stalled',
      body: `"${delivery.title}" has been waiting for client review for more than 48 hours.`,
      entityType: 'job',
      entityId: delivery.job_id,
      data: { job_id: delivery.job_id, file_id: delivery.file_id, client_id: delivery.client_id },
    });
    if (!notification) {
      await releaseReminderClaim(reminderId);
    } else {
      sent += 1;
    }
  }
  return sent;
};

const scanStalledDeliveries = async () => {
  const deliveries = await getStalledDeliveries();
  const adminIds = await getSupportAdminIds();
  let reminders = 0;
  let escalations = 0;
  for (const delivery of deliveries) {
    if (await sendReminder(delivery)) reminders += 1;
    escalations += await escalateDelivery(delivery, adminIds);
  }
  logger.info('[Fulfillment] Stalled delivery scan complete', {
    deliveries: deliveries.length,
    reminders,
    escalations,
  });
  return { deliveries: deliveries.length, reminders, escalations };
};

module.exports = { scanStalledDeliveries };
