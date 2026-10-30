const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/068_notification_channels.sql'), 'utf8');
  await query(sql);
  const result = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
    [['notification_preferences', 'push_subscriptions', 'notification_dispatch_jobs', 'notification_deliveries']]);
  if (result.rows.length !== 4) throw new Error('Notification tables missing');
  console.log('Migration 068 applied; all four notification tables confirmed.');
}
main().then(() => pool.end()).catch(async error => {
  console.error('Migration 068 failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
