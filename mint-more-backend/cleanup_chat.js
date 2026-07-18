const { query } = require('./src/config/database');

async function run() {
  try {
    const res = await query("UPDATE ai_generations SET deleted_at = NOW() WHERE tool_type = 'text';");
    console.log("Rows affected:", res.rowCount);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
