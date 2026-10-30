const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/070_chat_moderation.sql'), 'utf8');
  await query(sql);
  const result = await query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = ANY($1)",
    [['flagged_at', 'flagged_by', 'flag_reason', 'closed_at', 'closed_by', 'close_reason']]
  );
  if (result.rows.length !== 6) throw new Error('Chat moderation columns missing');
  console.log('Migration 070 applied; all six chat moderation columns confirmed.');
}
main().then(() => pool.end()).catch(async error => {
  console.error('Migration 070 failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
