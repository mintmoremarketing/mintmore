const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const { writeAudit } = require('../audit/audit.service');

const getSetting = async (key, fallback = null, dbClient = null) => {
  const executor = dbClient || { query };
  const result = await executor.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
  return result.rows[0]?.value ?? fallback;
};

const listSettings = async () => {
  const result = await query('SELECT * FROM platform_settings ORDER BY key ASC');
  return result.rows;
};

const setSetting = async (key, value, admin, requestMeta = {}) => {
  if (!key || value === undefined) throw new AppError('key and value are required', 400);
  const before = await getSetting(key);
  const result = await query(
    `INSERT INTO platform_settings (key, value, updated_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
    [key, JSON.stringify(value), admin.sub]
  );
  await writeAudit({
    actorId: admin.sub,
    actorRole: admin.role,
    action: 'platform_setting.updated',
    entityType: 'platform_setting',
    entityId: key,
    beforeState: before,
    afterState: value,
    ...requestMeta,
  });
  return result.rows[0];
};

module.exports = { getSetting, listSettings, setSetting };
