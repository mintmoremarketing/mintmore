/**
 * Migration 063 runner: applies 063_freelancer_offers.sql twice
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
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/063_freelancer_offers.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const columns = await query(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND ((table_name = 'users' AND column_name = 'last_active_at')
         OR (table_name = 'service_bookings' AND column_name IN ('offered_freelancer_id', 'offered_at', 'offer_expires_at')))`
  );
  if (columns.rows.length !== 4) throw new Error('offer columns missing');
  console.log('Columns OK:', columns.rows.map((row) => `${row.table_name}.${row.column_name}`).join(', '));
};

main()
  .then(() => { console.log('\n✅ Migration 063 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
