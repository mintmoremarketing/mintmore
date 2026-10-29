/**
 * Migration 067 runner: applies 067_ai_edit_notification.sql twice
 * (idempotency check) and asserts the notification type exists.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/067_ai_edit_notification.sql'), 'utf8')
    .replace(/--.*$/gm, '').trim().replace(/;$/, '');
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`=== ${pass} ===`);
    await query(sql);
  }
  const found = await query("SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND e.enumlabel = 'ai_edit_update'");
  if (!found.rows.length) throw new Error('ai_edit_update missing');
};

main()
  .then(() => { console.log('\n✅ Migration 067 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
