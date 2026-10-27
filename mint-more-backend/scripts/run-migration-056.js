/**
 * Migration 056 runner: applies 056_service_catalogue.sql twice (idempotency
 * check) and asserts the new tables exist.
 */
const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

const parseSqlStatements = (sql) => sql
  .split(';')
  .map((stmt) => stmt.trim())
  .filter((stmt) => stmt.replace(/--.*$/gm, '').trim().length > 0);

const runPass = async (name, statements) => {
  console.log(`\n=== ${name} ===`);
  for (const [i, stmt] of statements.entries()) {
    console.log(`[${i + 1}/${statements.length}] ${stmt.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim().slice(0, 70)}`);
    await query(stmt);
  }
};

const main = async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/056_service_catalogue.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  await runPass('Pass 1', statements);
  await runPass('Pass 2 (idempotency)', statements);

  const tables = ['service_templates', 'service_variants', 'freelancer_service_optins', 'service_checkouts', 'service_bookings'];
  const found = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [tables]
  );
  const missing = tables.filter((t) => !found.rows.some((r) => r.table_name === t));
  if (missing.length) throw new Error(`Missing tables: ${missing.join(', ')}`);

  const enums = await query(
    `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'notification_type' AND enumlabel LIKE 'service_%'`
  );
  console.log('\nTables OK:', tables.join(', '));
  console.log('Notification types:', enums.rows.map((r) => r.enumlabel).join(', '));
};

main()
  .then(() => { console.log('\n✅ Migration 056 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
