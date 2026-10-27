/**
 * Migration 060 runner: applies 060_chat_message_edits.sql twice
 * (idempotency check) and asserts messages.edited_at exists.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/060_chat_message_edits.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = ANY($1)`,
    [['edited_at']]
  );
  if (cols.rows.length !== 1) throw new Error('messages.edited_at missing');
  console.log('Column OK: messages.edited_at');
};

main()
  .then(() => { console.log('\n✅ Migration 060 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
