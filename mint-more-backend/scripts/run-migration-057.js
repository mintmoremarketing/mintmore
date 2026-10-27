/**
 * Migration 057 runner: applies 057_service_storefront.sql twice (idempotency
 * check) and asserts the new table and columns exist.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/057_service_storefront.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }
  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'service_templates' AND column_name IN ('subcategory_id', 'highlights', 'badge')`
  );
  const table = await query(`SELECT to_regclass('public.service_subcategories') AS t`);
  if (cols.rows.length !== 3 || !table.rows[0].t) throw new Error('057 did not apply cleanly');
  console.log('\n057 OK: service_subcategories + template columns present');
};

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => pool.end());
