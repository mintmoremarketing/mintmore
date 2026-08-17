const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.grnnqilqrzlnrtbfrpyx:Devdeep@1202@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query(
      `SELECT * FROM social_posts WHERE user_id = '6ea800be-df70-4fb7-b4d1-1af447efb854' ORDER BY created_at DESC LIMIT 5`
    );
    console.log("Recent posts:", JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    pool.end();
  }
}
test();
