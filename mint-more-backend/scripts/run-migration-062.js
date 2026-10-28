/**
 * Migration 062 runner: applies 062_service_briefs.sql twice
 * (idempotency check) and asserts the new columns exist.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/062_service_briefs.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const columns = await query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND ((table_name = 'service_templates' AND column_name = 'brief_fields')
         OR (table_name = 'service_bookings' AND column_name = 'brief'))`
  );
  if (columns.rows.length !== 2) throw new Error('brief columns missing');
  console.log('Columns OK:', columns.rows.map((row) => `${row.table_name}.${row.column_name}`).join(', '));
};

main()
  .then(() => { console.log('\n✅ Migration 062 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
