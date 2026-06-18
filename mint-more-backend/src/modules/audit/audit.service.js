const { query } = require('../../config/database');

const writeAudit = async ({
  actorId = null,
  actorRole = null,
  action,
  entityType,
  entityId = null,
  beforeState = null,
  afterState = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
}, dbClient = null) => {
  const executor = dbClient || { query };
  const result = await executor.query(
    `INSERT INTO audit_logs
       (actor_id, actor_role, action, entity_type, entity_id, before_state,
        after_state, metadata, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      actorId,
      actorRole,
      action,
      entityType,
      entityId ? String(entityId) : null,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      JSON.stringify(metadata || {}),
      ipAddress,
      userAgent,
    ]
  );
  return result.rows[0];
};

const listAuditLogs = async ({
  page = 1,
  limit = 50,
  entity_type,
  actor_id,
  action,
  search,
  date_from,
  date_to,
  sort = 'desc',
} = {}) => {
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const values = [];
  const conditions = [];
  if (entity_type) {
    values.push(entity_type);
    conditions.push(`a.entity_type = $${values.length}`);
  }
  if (actor_id) {
    values.push(actor_id);
    conditions.push(`a.actor_id = $${values.length}`);
  }
  if (action) {
    values.push(action);
    conditions.push(`a.action = $${values.length}`);
  }
  if (date_from) {
    values.push(date_from);
    conditions.push(`a.created_at >= $${values.length}::timestamptz`);
  }
  if (date_to) {
    values.push(date_to);
    conditions.push(`a.created_at <= $${values.length}::timestamptz`);
  }
  if (search) {
    values.push(`%${String(search).trim()}%`);
    conditions.push(`(
      a.action ILIKE $${values.length}
      OR a.entity_type ILIKE $${values.length}
      OR a.entity_id ILIKE $${values.length}
      OR COALESCE(u.full_name, '') ILIKE $${values.length}
      OR COALESCE(u.email, '') ILIKE $${values.length}
      OR a.metadata::text ILIKE $${values.length}
      OR a.before_state::text ILIKE $${values.length}
      OR a.after_state::text ILIKE $${values.length}
    )`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const countResult = await query(
    `SELECT COUNT(*)::int AS count
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     ${where}`,
    values
  );

  values.push(safeLimit, (safePage - 1) * safeLimit);
  const result = await query(
    `SELECT a.*, u.full_name AS actor_name, u.email AS actor_email
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     ${where}
     ORDER BY a.created_at ${order}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return {
    logs: result.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: countResult.rows[0]?.count || 0,
      pages: Math.ceil((countResult.rows[0]?.count || 0) / safeLimit),
    },
  };
};

module.exports = { writeAudit, listAuditLogs };
