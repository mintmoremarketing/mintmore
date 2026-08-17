const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.grnnqilqrzlnrtbfrpyx:Devdeep@1202@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = userRes.rows[0].id;
    console.log("Using user_id:", userId);

    const res = await pool.query(
      `INSERT INTO social_posts
        (user_id, title, caption, hashtags, mentions,
         content_type, target_platforms, publish_at,
         status, source_job_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        userId,
        'Test title',
        'Test caption',
        [],
        [],
        'image',
        ['facebook'],
        null, // publish_at is NULL!
        'draft',
        null,
        '{}'
      ]
    );
    console.log("Success!", res.rows);
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    pool.end();
  }
}
test();
