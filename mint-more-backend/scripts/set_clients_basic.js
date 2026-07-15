const { query } = require('../src/config/database');

async function run() {
  try {
    const tierRes = await query(`SELECT id FROM subscription_tiers WHERE name = 'Basic'`);
    if (!tierRes.rows[0]) {
      console.error('Basic tier not found');
      process.exit(1);
    }
    const tierId = tierRes.rows[0].id;

    const clients = await query(`SELECT id FROM users WHERE role = 'client'`);
    for (const c of clients.rows) {
      await query(`
        INSERT INTO memberships (user_id, tier_id, status, current_period_end)
        VALUES ($1, $2, 'active', NOW() + INTERVAL '1 month')
        ON CONFLICT (user_id) DO UPDATE SET 
          tier_id = EXCLUDED.tier_id, 
          status = 'active', 
          updated_at = NOW()
      `, [c.id, tierId]);
    }
    console.log(`Updated ${clients.rows.length} clients to Basic tier.`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
