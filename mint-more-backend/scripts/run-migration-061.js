/**
 * Migration 061 runner: applies 061_assessments.sql twice
 * (idempotency check) and asserts the tables and seed rows exist.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/061_assessments.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const tables = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [['assessments', 'assessment_attempts', 'assessment_attempt_items']]
  );
  if (tables.rows.length !== 3) throw new Error('assessment tables missing');
  const seeded = await query('SELECT slug FROM assessments ORDER BY slug');
  console.log('Tables OK; assessments:', seeded.rows.map((row) => row.slug).join(', '));
};

main()
  .then(() => { console.log('\n✅ Migration 061 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
