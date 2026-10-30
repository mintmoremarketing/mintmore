const fs = require('fs');
const path = require('path');
const { query, pool } = require('../src/config/database');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/migrations/069_service_purchase_items.sql'), 'utf8');
  await query(sql);
  const result = await query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
    [['service_purchase_groups', 'service_purchase_items']]);
  const columns = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'service_bookings' AND column_name = ANY($1)",
    [['purchase_item_id', 'matching_held_at']]);
  if (result.rows.length !== 2 || columns.rows.length !== 2) throw new Error('Purchase item tables or booking columns missing');
  console.log('Migration 069 applied; purchase item tables and booking columns confirmed.');
}
main().then(() => pool.end()).catch(async error => {
  console.error('Migration 069 failed:', error.message);
  await pool.end();
  process.exitCode = 1;
});
