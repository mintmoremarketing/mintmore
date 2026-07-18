const { query } = require('../../config/database');

const listTiers = async (includeInactive = false) => {
  const sql = includeInactive 
    ? 'SELECT * FROM subscription_tiers ORDER BY price ASC'
    : 'SELECT * FROM subscription_tiers WHERE is_active = true ORDER BY price ASC';
  const result = await query(sql);
  return result.rows;
};

const updateTier = async (id, data) => {
  const result = await query(
    `UPDATE subscription_tiers 
     SET name = $1, price = $2, features = $3, is_active = $4, annual_price = $6, annual_razorpay_plan_id = $7, monthly_credits = $8, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [data.name, data.price, JSON.stringify(data.features || []), data.is_active, id, data.annual_price || 0, data.annual_razorpay_plan_id || null, data.monthly_credits || 0]
  );
  if (!result.rows[0]) throw Object.assign(new Error('Tier not found'), { statusCode: 404 });
  return result.rows[0];
};

const createTier = async (data) => {
  const result = await query(
    `INSERT INTO subscription_tiers (name, price, features, is_active, annual_price, annual_razorpay_plan_id, monthly_credits)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.name, data.price, JSON.stringify(data.features || []), data.is_active !== false, data.annual_price || 0, data.annual_razorpay_plan_id || null, data.monthly_credits || 0]
  );
  return result.rows[0];
};

const deleteTier = async (id) => {
  try {
    const result = await query('DELETE FROM subscription_tiers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw Object.assign(new Error('Tier not found'), { statusCode: 404 });
    return true;
  } catch (err) {
    if (err.code === '23503') { // foreign_key_violation
      throw Object.assign(new Error('Cannot delete this tier because users are subscribed to it. Deactivate it instead.'), { statusCode: 400 });
    }
    throw err;
  }
};

module.exports = {
  listTiers,
  updateTier,
  createTier,
  deleteTier
};
