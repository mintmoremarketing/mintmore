const { query } = require('../src/config/database');

async function main() {
  try {
    const res = await query('SELECT * FROM platform_settings');
    console.log('Settings:', res.rows.map(r => ({ key: r.key, value: JSON.stringify(r.value) })));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
