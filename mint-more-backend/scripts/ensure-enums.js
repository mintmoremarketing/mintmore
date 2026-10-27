const { query, pool } = require('../src/config/database');

async function ensureEnums() {
  try {
    await query("ALTER TYPE social_platform ADD VALUE IF NOT EXISTS 'linkedin'");
    console.log("✅ Added linkedin to social_platform enum");
  } catch (err) {
    console.error("Error adding enum value:", err.message);
  } finally {
    await pool.end();
  }
}

ensureEnums();
