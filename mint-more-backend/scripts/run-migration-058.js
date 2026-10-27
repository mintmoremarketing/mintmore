/**
 * Migration 058 runner: applies 058_freelancer_profile_completion.sql twice
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
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/058_freelancer_profile_completion.sql'), 'utf8');
  const statements = parseSqlStatements(sql);
  for (const pass of ['Pass 1', 'Pass 2 (idempotency)']) {
    console.log(`\n=== ${pass} ===`);
    for (const stmt of statements) await query(stmt);
  }

  const cols = await query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = ANY($1)`,
    [['username', 'tools']]
  );
  if (cols.rows.length !== 2) throw new Error('users.username / users.tools missing');
  console.log('Columns OK: users.username, users.tools');
};

main()
  .then(() => { console.log('\n✅ Migration 058 applied'); return pool.end(); })
  .catch(async (err) => { console.error('\n❌', err.message); await pool.end(); process.exit(1); });
