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
  if (key === 'feature_flags') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError('feature_flags must be an object', 400);
    }
    for (const [flag, enabled] of Object.entries(value)) {
      if (typeof enabled !== 'boolean') {
        throw new AppError(`${flag} must be true or false`, 400);
      }
    }
  }
  if (key === 'membership.monthly') {
    const numericFields = [
      'price',
      'welcome_credits',
      'renewal_credits',
      'welcome_expiry_days',
      'renewal_expiry_days',
      'mintbox_gb',
    ];
    for (const field of numericFields) {
      if (!Number.isFinite(Number(value?.[field])) || Number(value[field]) < 0) {
        throw new AppError(`${field} must be a non-negative number`, 400);
      }
    }
    if (Number(value.welcome_expiry_days) < 1 || Number(value.renewal_expiry_days) < 1) {
      throw new AppError('MintCoin expiry periods must be at least 1 day', 400);
    }
  }
  if (key === 'membership.trial') {
    const numericFields = [
      'duration_days',
      'text_generations',
      'image_generations',
      'mint_credits',
      'mint_credit_expiry_days',
    ];
    for (const field of numericFields) {
      if (!Number.isFinite(Number(value?.[field])) || Number(value[field]) < 0) {
        throw new AppError(`${field} must be a non-negative number`, 400);
      }
    }
    if (Number(value.duration_days) < 1 || Number(value.mint_credit_expiry_days) < 1) {
      throw new AppError('Trial duration and MintCoin expiry must be at least 1 day', 400);
    }
  }
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
