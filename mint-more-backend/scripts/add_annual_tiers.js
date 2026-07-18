const { query } = require('../src/config/database');

async function migrate() {
  try {
    console.log('Adding columns...');
    await query(`ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS annual_price NUMERIC DEFAULT 0;`);
    await query(`ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS annual_razorpay_plan_id VARCHAR;`);

    console.log('Updating existing tiers...');
    // The user's changes: SOCIAL is 1999/mo, 1699/mo annually -> 20388.
    // MANAGED BY MMM is 9999/mo, 7999/mo annually -> 95988.
    await query(`UPDATE subscription_tiers SET annual_price = 20388 WHERE name = 'SOCIAL'`);
    await query(`UPDATE subscription_tiers SET annual_price = 95988 WHERE name = 'MANAGED BY MMM'`);
    await query(`UPDATE subscription_tiers SET annual_price = 0 WHERE name = 'FREE'`);

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
