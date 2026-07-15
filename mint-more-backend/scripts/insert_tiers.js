const { query } = require('../src/config/database');
async function insert() {
  try {
    await query(`
      INSERT INTO subscription_tiers (name, price, features) VALUES 
      ('Basic', 0, '["mint_ai"]'),
      ('Middle', 999, '["mint_ai", "social_insights", "posting"]'),
      ('Top', 4999, '["mint_ai", "social_insights", "posting", "custom_requests"]')
    `);
    console.log('Tiers inserted');
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    process.exit(0);
  }
}
insert();
