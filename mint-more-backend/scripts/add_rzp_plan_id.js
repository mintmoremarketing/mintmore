const { query } = require('../src/config/database');
async function run() {
  try {
    await query(`ALTER TABLE subscription_tiers ADD COLUMN IF NOT EXISTS razorpay_plan_id VARCHAR`);
    console.log('Added razorpay_plan_id');
  } catch(e) { console.error(e) }
  process.exit();
}
run();
