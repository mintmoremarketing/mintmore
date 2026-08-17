const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://postgres.grnnqilqrzlnrtbfrpyx:Devdeep@1202@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

pool.query("DELETE FROM social_posts WHERE user_id = '6ea800be-df70-4fb7-b4d1-1af447efb854'")
  .then(res => console.log('Deleted:', res.rowCount))
  .catch(console.error)
  .finally(() => pool.end());
