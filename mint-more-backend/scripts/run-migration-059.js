/**
 * Migration 059 runner: applies 059_chat_file_messages.sql twice
 * (idempotency check) and asserts the new message columns exist.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/059_chat_file_messages.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = ANY($1)`,
    [['file_id', 'delivered_at_client', 'delivered_at_freelancer']]
  );
  if (cols.rows.length !== 3) throw new Error('messages file/delivery columns missing');
  console.log('Columns OK: messages.file_id, delivered_at_client, delivered_at_freelancer');
};

main()
  .then(() => { console.log('\n✅ Migration 059 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
