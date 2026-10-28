const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { assertNoContactInfo } = require('../../utils/contactGuard');
const { writeAudit } = require('../audit/audit.service');
const { createNotification, createBulkNotifications } = require('../notifications/notification.service');
const { releaseEscrow, refundEscrow } = require('../wallet/wallet.service');

const ACTIVE_STATUSES = ['open', 'under_review'];

const getAdminRecipients = async () => {
  const result = await query(
    `SELECT id FROM users
     WHERE role = 'admin' AND is_active = true
       AND (
         is_super_admin = true
         OR admin_permissions @> ARRAY['support.manage']::TEXT[]
         OR admin_permissions @> ARRAY['*']::TEXT[]
       )`
  );
  return result.rows.map((row) => row.id);
};

/**
 * What support reviews alongside a dispute: the order as booked (scope, brief, dates) and the
 * full order chat, read live so nothing has to be copied in by hand. Clients see the
 * freelancer as "Your freelancer", the same anonymity the order chat keeps.
 */
const getEvidence = async (jobId, role) => {
  const booking = await query(
    `SELECT b.booking_number, b.snapshot, b.quantity, b.brief, b.instructions, b.paid_at, b.assigned_at,
            b.due_at, b.completed_at, b.freelancer_payout, b.subtotal,
            (SELECT COUNT(*)::int FROM mintbox_files f WHERE f.job_id = b.job_id AND f.purpose = 'delivery') AS delivery_count,
            (SELECT COUNT(*)::int FROM mintbox_revision_rounds rr WHERE rr.job_id = b.job_id) AS revisions_used
     FROM service_bookings b WHERE b.job_id = $1 LIMIT 1`,
    [jobId]
  );
  const chat = await query(
    `SELECT m.id, m.sender_role, m.content, m.attachment_url, m.created_at, m.edited_at,
            mf.original_name AS file_name,
            CASE
              WHEN m.sender_role = 'system' THEN 'CREATYV'
              WHEN m.sender_role = 'freelancer' AND $2 = 'client' THEN 'Your freelancer'
              ELSE u.full_name
            END AS sender_name
     FROM chat_rooms room
     JOIN messages m ON m.room_id = room.id AND m.is_deleted = false
     LEFT JOIN users u ON u.id = m.sender_id
     LEFT JOIN mintbox_files mf ON mf.id = m.file_id
     WHERE room.job_id = $1
     ORDER BY m.created_at ASC
     LIMIT 500`,
    [jobId, role]
  );
  const order = booking.rows[0] || null;
  if (order && role === 'client') delete order.freelancer_payout;
  if (order && role === 'freelancer') delete order.subtotal;
  return { order, chat: chat.rows };
};

const getDispute = async (disputeId, requesterId, role) => {
  const result = await query(
    `SELECT d.*, j.title AS job_title, j.client_id, j.active_freelancer_id,
            escrow.amount AS escrow_amount, escrow.freelancer_payout, escrow.status AS escrow_status,
            opener.full_name AS opened_by_name, admin.full_name AS assigned_admin_name
     FROM disputes d
     JOIN jobs j ON j.id = d.job_id
     JOIN escrow_records escrow ON escrow.id = d.escrow_id
     JOIN users opener ON opener.id = d.opened_by
     LEFT JOIN users admin ON admin.id = d.assigned_admin_id
     WHERE d.id = $1
       AND ($2::BOOLEAN OR j.client_id = $3 OR j.active_freelancer_id = $3)`,
    [disputeId, role === 'admin', requesterId]
  );
  const dispute = result.rows[0];
  if (!dispute) throw new AppError('Dispute not found', 404);
  const messages = await query(
    `SELECT message.*, sender.full_name AS sender_name
     FROM dispute_messages message
     JOIN users sender ON sender.id = message.sender_id
     WHERE message.dispute_id = $1
     ORDER BY message.created_at ASC`,
    [disputeId]
  );
  const evidence = await getEvidence(dispute.job_id, role);
  return { dispute, messages: messages.rows, evidence };
};

const listDisputes = async (requesterId, role, { status } = {}) => {
  const values = [];
  const conditions = [];
  if (role !== 'admin') {
    values.push(requesterId);
    conditions.push(`(j.client_id = $${values.length} OR j.active_freelancer_id = $${values.length})`);
  }
  if (status) {
    values.push(status);
    conditions.push(`d.status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT d.*, j.title AS job_title, j.client_id, j.active_freelancer_id,
            escrow.amount AS escrow_amount, escrow.freelancer_payout, escrow.status AS escrow_status,
            opener.full_name AS opened_by_name
     FROM disputes d
     JOIN jobs j ON j.id = d.job_id
     JOIN escrow_records escrow ON escrow.id = d.escrow_id
     JOIN users opener ON opener.id = d.opened_by
     ${where}
     ORDER BY
       CASE WHEN d.status IN ('open', 'under_review') THEN 0 ELSE 1 END,
       d.created_at DESC`,
    values
  );
  return result.rows;
};

const openDispute = async (jobId, requesterId, role, { reason, description }) => {
  if (!['client', 'freelancer'].includes(role)) throw new AppError('Only project participants can open a dispute', 403);
  const cleanReason = String(reason || '').trim();
  const cleanDescription = String(description || '').trim();
  // Both sides read the case, so it can't become a way to swap numbers.
  assertNoContactInfo(cleanDescription, { userId: requesterId, role, where: 'dispute' });
  if (cleanReason.length < 3 || cleanDescription.length < 10) {
    throw new AppError('Choose a reason and describe the issue in at least 10 characters', 400);
  }

  const dbClient = await getClient();
  let dispute;
  let job;
  try {
    await dbClient.query('BEGIN');
    const jobResult = await dbClient.query(
      `SELECT j.*, escrow.id AS escrow_id, escrow.status AS escrow_status
       FROM jobs j
       JOIN escrow_records escrow ON escrow.job_id = j.id
       WHERE j.id = $1
         AND (j.client_id = $2 OR j.active_freelancer_id = $2)
       FOR UPDATE OF j, escrow`,
      [jobId, requesterId]
    );
    job = jobResult.rows[0];
    if (!job) throw new AppError('Active project with escrow not found', 404);
    if (job.status !== 'in_progress' || job.escrow_status !== 'held') {
      throw new AppError('This project cannot enter dispute in its current state', 409);
    }
    const existing = await dbClient.query(
      `SELECT id FROM disputes WHERE job_id = $1 AND status IN ('open', 'under_review') LIMIT 1`,
      [jobId]
    );
    if (existing.rows[0]) throw new AppError('This project already has an active dispute', 409);
    const inserted = await dbClient.query(
      `INSERT INTO disputes (job_id, escrow_id, opened_by, opened_by_role, reason, description)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [jobId, job.escrow_id, requesterId, role, cleanReason, cleanDescription]
    );
    dispute = inserted.rows[0];
    await dbClient.query(
      `INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, body)
       VALUES ($1,$2,$3,$4)`,
      [dispute.id, requesterId, role, cleanDescription]
    );
    await dbClient.query(
      `UPDATE escrow_records SET status = 'disputed', admin_note = $1 WHERE id = $2`,
      [`Dispute ${dispute.id} opened: ${cleanReason}`, job.escrow_id]
    );
    await writeAudit({
      actorId: requesterId,
      actorRole: role,
      action: 'dispute.opened',
      entityType: 'dispute',
      entityId: dispute.id,
      afterState: { job_id: jobId, reason: cleanReason, status: 'open' },
    }, dbClient);
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  const otherParty = role === 'client' ? job.active_freelancer_id : job.client_id;
  createNotification({
    userId: otherParty, type: 'system', title: 'Project dispute opened',
    body: `A dispute was opened for "${job.title}". Escrow remains safely locked while support reviews it.`,
    entityType: 'dispute', entityId: dispute.id, data: { dispute_id: dispute.id, job_id: jobId },
  });
  const admins = await getAdminRecipients();
  createBulkNotifications(admins.map((userId) => ({
    userId, type: 'system', title: 'New dispute needs review',
    body: `"${job.title}" has entered dispute.`, entityType: 'dispute', entityId: dispute.id,
    data: { dispute_id: dispute.id, job_id: jobId },
  })));
  return dispute;
};

const addMessage = async (disputeId, requesterId, role, body) => {
  const cleanBody = String(body || '').trim();
  if (!cleanBody) throw new AppError('Message is required', 400);
  assertNoContactInfo(cleanBody, { userId: requesterId, role, where: 'dispute_message' });
  const access = await getDispute(disputeId, requesterId, role);
  if (!ACTIVE_STATUSES.includes(access.dispute.status)) throw new AppError('This dispute is already resolved', 409);
  const result = await query(
    `INSERT INTO dispute_messages (dispute_id, sender_id, sender_role, body)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [disputeId, requesterId, role, cleanBody]
  );
  if (role === 'admin' && access.dispute.status === 'open') {
    await query(
      `UPDATE disputes SET status='under_review', assigned_admin_id=$1
       WHERE id=$2 AND status='open'`,
      [requesterId, disputeId]
    );
  }
  const recipients = role === 'admin'
    ? [access.dispute.client_id, access.dispute.active_freelancer_id]
    : [
        role === 'client' ? access.dispute.active_freelancer_id : access.dispute.client_id,
        ...await getAdminRecipients(),
      ];
  createBulkNotifications([...new Set(recipients.filter(Boolean))].map((userId) => ({
    userId,
    type: 'system',
    title: 'New dispute message',
    body: `A new message was added to the support case for "${access.dispute.job_title}".`,
    entityType: 'dispute',
    entityId: disputeId,
    data: { dispute_id: disputeId, job_id: access.dispute.job_id },
  })));
  return result.rows[0];
};

const resolveDispute = async (disputeId, adminId, { action, resolution_note }) => {
  if (!['release', 'refund'].includes(action)) throw new AppError('Resolution must be release or refund', 400);
  const cleanNote = String(resolution_note || '').trim();
  if (cleanNote.length < 10) throw new AppError('Resolution note must be at least 10 characters', 400);

  const dbClient = await getClient();
  let dispute;
  let job;
  try {
    await dbClient.query('BEGIN');
    const result = await dbClient.query(
      `SELECT d.*, j.client_id, j.active_freelancer_id, j.title AS job_title, j.status AS job_status
       FROM disputes d JOIN jobs j ON j.id = d.job_id
       WHERE d.id = $1 AND d.status IN ('open', 'under_review')
       FOR UPDATE OF d, j`,
      [disputeId]
    );
    dispute = result.rows[0];
    if (!dispute) throw new AppError('Active dispute not found', 404);
    job = dispute;

    if (action === 'release') {
      await releaseEscrow(dispute.job_id, adminId, dbClient);
      await dbClient.query(`UPDATE jobs SET status = 'completed' WHERE id = $1`, [dispute.job_id]);
      await dbClient.query(
        `UPDATE job_assignments
         SET status='completed', completed_at=NOW(), completed_at_confirmed=NOW(), completion_note=$2
         WHERE job_id=$1 AND status='accepted'`,
        [dispute.job_id, `Dispute resolved: ${cleanNote}`]
      );
      await dbClient.query(
        `UPDATE users SET active_jobs_count=GREATEST(0,active_jobs_count-1),
          jobs_completed_count=jobs_completed_count+1 WHERE id=$1`,
        [dispute.active_freelancer_id]
      );
    } else {
      await refundEscrow(dispute.job_id, `Dispute resolved: ${cleanNote}`, dbClient);
      await dbClient.query(`UPDATE jobs SET status='cancelled', admin_note=$2 WHERE id=$1`, [dispute.job_id, cleanNote]);
      await dbClient.query(
        `UPDATE job_assignments SET status='cancelled' WHERE job_id=$1 AND status IN ('pending_acceptance','accepted')`,
        [dispute.job_id]
      );
      await dbClient.query(
        `UPDATE users SET active_jobs_count=GREATEST(0,active_jobs_count-1) WHERE id=$1`,
        [dispute.active_freelancer_id]
      );
    }

    const status = action === 'release' ? 'resolved_release' : 'resolved_refund';
    const updated = await dbClient.query(
      `UPDATE disputes
       SET status=$1, assigned_admin_id=$2, resolved_by=$2, resolution_note=$3, resolved_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, adminId, cleanNote, disputeId]
    );
    dispute = updated.rows[0];
    await writeAudit({
      actorId: adminId, actorRole: 'admin', action: `dispute.resolved.${action}`,
      entityType: 'dispute', entityId: disputeId,
      beforeState: { status: job.status }, afterState: { status, resolution_note: cleanNote },
    }, dbClient);
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }

  await createBulkNotifications([job.client_id, job.active_freelancer_id].map((userId) => ({
    userId, type: 'system', title: 'Project dispute resolved',
    body: action === 'release'
      ? `Support completed "${job.job_title}" and released the escrowed payment.`
      : `Support cancelled "${job.job_title}" and refunded the escrowed payment.`,
    entityType: 'dispute', entityId: disputeId, data: { dispute_id: disputeId, job_id: job.job_id, action },
  })));
  return dispute;
};

module.exports = { listDisputes, getDispute, getEvidence, openDispute, addMessage, resolveDispute };
