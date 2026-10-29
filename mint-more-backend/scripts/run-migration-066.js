/**
 * Migration 066 runner: applies 066_ai_edits.sql twice
 * (idempotency check) and asserts the new tables exist.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/066_ai_edits.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('ai_edits', 'ai_edit_unlocks', 'ai_edit_usage')`
  );
  if (tables.rows.length !== 3) throw new Error('ai edit tables missing');
  const enabled = await query('SELECT slug FROM service_templates WHERE ai_enabled ORDER BY slug');
  console.log('Tables OK. AI enabled on:', enabled.rows.map((row) => row.slug).join(', '));
};

main()
  .then(() => { console.log('\n✅ Migration 066 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
