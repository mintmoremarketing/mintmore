const { query, getClient } = require('../../config/database');
const AppError = require('../../utils/AppError');
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
  return { dispute, messages: messages.rows };
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

module.exports = { listDisputes, getDispute, openDispute, addMessage, resolveDispute };
