const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.grnnqilqrzlnrtbfrpyx:Devdeep@1202@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query(
      `SELECT id, user_id, title, publish_at, created_at FROM social_posts WHERE created_at >= '2026-08-08'`
    );
    console.log("Posts created today:", res.rows);
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    pool.end();
  }
}
test();
