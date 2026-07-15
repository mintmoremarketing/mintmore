const { query } = require('./src/config/database');

async function inspect() {
  try {
    const colRes = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'addon_plans'
    `);
    console.log('\naddon_plans columns:');
    colRes.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    
    const clientAddons = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'client_addons'
    `);
    console.log('\nclient_addons columns:');
    clientAddons.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
inspect();
