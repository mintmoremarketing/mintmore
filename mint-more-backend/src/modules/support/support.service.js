const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { writeAudit } = require('../audit/audit.service');
const { createBulkNotifications } = require('../notifications/notification.service');

const ACTIVE_STATUSES = ['open', 'under_review', 'waiting_on_user'];

const getSupportAdmins = async () => {
  const result = await query(
    `SELECT id FROM users
     WHERE role = 'admin'
       AND is_active = true
       AND (
         is_super_admin = true
         OR admin_permissions @> ARRAY['support.manage']::TEXT[]
         OR admin_permissions @> ARRAY['*']::TEXT[]
       )`
  );
  return result.rows.map(row => row.id);
};

const getTicketAccess = async (ticketId, requesterId, role) => {
  const result = await query(
    `SELECT ticket.*, opener.full_name AS opened_by_name, opener.email AS opened_by_email,
            admin.full_name AS assigned_admin_name
     FROM support_tickets ticket
     JOIN users opener ON opener.id = ticket.opened_by
     LEFT JOIN users admin ON admin.id = ticket.assigned_admin_id
     WHERE ticket.id = $1
       AND ($2::BOOLEAN OR ticket.opened_by = $3)`,
    [ticketId, role === 'admin', requesterId]
  );
  const ticket = result.rows[0];
  if (!ticket) throw new AppError('Support ticket not found', 404);
  return ticket;
};

const listTickets = async (requesterId, role, { status } = {}) => {
  const values = [];
  const conditions = [];
  if (role !== 'admin') {
    values.push(requesterId);
    conditions.push(`ticket.opened_by = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`ticket.status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT ticket.*, opener.full_name AS opened_by_name, opener.email AS opened_by_email,
            admin.full_name AS assigned_admin_name,
            latest.body AS latest_message
     FROM support_tickets ticket
     JOIN users opener ON opener.id = ticket.opened_by
     LEFT JOIN users admin ON admin.id = ticket.assigned_admin_id
     LEFT JOIN LATERAL (
       SELECT body FROM support_ticket_messages message
       WHERE message.ticket_id = ticket.id
       ORDER BY message.created_at DESC
       LIMIT 1
     ) latest ON true
     ${where}
     ORDER BY
       CASE WHEN ticket.status IN ('open','under_review','waiting_on_user') THEN 0 ELSE 1 END,
       CASE ticket.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
       ticket.updated_at DESC`,
    values
  );
  return { tickets: result.rows };
};

const getTicket = async (ticketId, requesterId, role) => {
  const ticket = await getTicketAccess(ticketId, requesterId, role);
  const messages = await query(
    `SELECT message.*, sender.full_name AS sender_name
     FROM support_ticket_messages message
     JOIN users sender ON sender.id = message.sender_id
     WHERE message.ticket_id = $1
     ORDER BY message.created_at ASC`,
    [ticketId]
  );
  return { ticket, messages: messages.rows };
};

const createTicket = async (requesterId, role, payload = {}) => {
  const subject = String(payload.subject || '').trim();
  const body = String(payload.body || '').trim();
  if (subject.length < 3) throw new AppError('Subject is required', 400);
  if (body.length < 10) throw new AppError('Tell support what happened in at least 10 characters', 400);

  const result = await query(
    `INSERT INTO support_tickets
       (opened_by, opened_by_role, subject, category, priority, related_job_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      requesterId,
      role,
      subject,
      payload.category || 'general',
      payload.priority || 'normal',
      payload.related_job_id || null,
      JSON.stringify(payload.metadata || {}),
    ]
  );
  const ticket = result.rows[0];
  await query(
    `INSERT INTO support_ticket_messages (ticket_id, sender_id, sender_role, body)
     VALUES ($1,$2,$3,$4)`,
    [ticket.id, requesterId, role, body]
  );
  await writeAudit({
    actorId: requesterId,
    actorRole: role,
    action: 'support_ticket.created',
    entityType: 'support_ticket',
    entityId: ticket.id,
    afterState: ticket,
    metadata: { subject, category: ticket.category, priority: ticket.priority },
  });

  const admins = await getSupportAdmins();
  createBulkNotifications(admins.map(userId => ({
    userId,
    type: 'system',
    title: 'New support ticket',
    body: subject,
    entityType: 'support_ticket',
    entityId: ticket.id,
    data: { ticket_id: ticket.id },
  })));
  return ticket;
};

const addMessage = async (ticketId, requesterId, role, body) => {
  const cleanBody = String(body || '').trim();
  if (!cleanBody) throw new AppError('Message is required', 400);
  const ticket = await getTicketAccess(ticketId, requesterId, role);
  if (!ACTIVE_STATUSES.includes(ticket.status)) throw new AppError('This support ticket is closed', 409);

  const result = await query(
    `INSERT INTO support_ticket_messages (ticket_id, sender_id, sender_role, body)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [ticketId, requesterId, role, cleanBody]
  );

  if (role === 'admin') {
    await query(
      `UPDATE support_tickets
       SET status = 'waiting_on_user',
           assigned_admin_id = COALESCE(assigned_admin_id, $1)
       WHERE id = $2`,
      [requesterId, ticketId]
    );
  } else {
    await query(
      `UPDATE support_tickets
       SET status = CASE WHEN status = 'waiting_on_user' THEN 'open' ELSE status END
       WHERE id = $1`,
      [ticketId]
    );
  }
  return result.rows[0];
};

const updateTicket = async (ticketId, adminId, payload = {}) => {
  const before = await getTicketAccess(ticketId, adminId, 'admin');
  const allowedStatuses = ['open', 'under_review', 'waiting_on_user', 'resolved', 'closed'];
  if (payload.status && !allowedStatuses.includes(payload.status)) throw new AppError('Invalid support ticket status', 400);
  const result = await query(
    `UPDATE support_tickets
     SET status = COALESCE($1, status),
         priority = COALESCE($2, priority),
         assigned_admin_id = COALESCE($3, assigned_admin_id),
         resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN NOW() ELSE resolved_at END
     WHERE id = $4
     RETURNING *`,
    [payload.status || null, payload.priority || null, payload.assigned_admin_id || adminId, ticketId]
  );
  await writeAudit({
    actorId: adminId,
    actorRole: 'admin',
    action: 'support_ticket.updated',
    entityType: 'support_ticket',
    entityId: ticketId,
    beforeState: before,
    afterState: result.rows[0],
    metadata: { status: result.rows[0].status, priority: result.rows[0].priority },
  });
  return result.rows[0];
};

module.exports = { listTickets, getTicket, createTicket, addMessage, updateTicket };
