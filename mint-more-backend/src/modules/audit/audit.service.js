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

const listAuditLogs = async ({ page = 1, limit = 50, entity_type, actor_id } = {}) => {
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
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, (page - 1) * limit);
  const result = await query(
    `SELECT a.*, u.full_name AS actor_name, u.email AS actor_email
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
};

module.exports = { writeAudit, listAuditLogs };
