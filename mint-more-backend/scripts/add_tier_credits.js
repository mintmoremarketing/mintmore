const { query } = require('../src/config/database');

async function migrate() {
  try {
    console.log('Adding monthly_credits column...');
    await query(`ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS monthly_credits NUMERIC DEFAULT 0;`);

    console.log('Updating existing tiers...');
    await query(`UPDATE subscription_tiers SET monthly_credits = 1000 WHERE name = 'FREE'`);
    await query(`UPDATE subscription_tiers SET monthly_credits = 10000 WHERE name = 'SOCIAL'`);
    await query(`UPDATE subscription_tiers SET monthly_credits = 10000 WHERE name = 'MANAGED BY MMM'`);

    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
