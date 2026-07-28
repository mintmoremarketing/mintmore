const { query } = require('../src/config/database');

async function inspect() {
  try {
    const colRes = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'social_posts'
    `);
    console.log('\nsocial_posts columns:');
    colRes.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
inspect();
