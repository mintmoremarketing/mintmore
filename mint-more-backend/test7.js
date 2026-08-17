const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.grnnqilqrzlnrtbfrpyx:Devdeep@1202@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query(
      `SELECT title, created_at, user_id FROM social_posts WHERE title LIKE '% Post'`
    );
    console.log("Onboarding posts:", res.rows);
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    pool.end();
  }
}
test();
