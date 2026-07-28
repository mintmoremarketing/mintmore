const { query } = require('../src/config/database');

async function check() {
  try {
    const accounts = await query(`
      SELECT *
      FROM social_accounts
    `);
    console.log('\nConnected social accounts:');
    console.table(accounts.rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      platform: r.platform,
      is_active: r.is_active,
      last_error: r.last_error,
      created_at: r.created_at
    })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
