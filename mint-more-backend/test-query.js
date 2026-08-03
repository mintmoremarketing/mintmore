const { Pool } = require('pg');
require('dotenv').config({ path: 'c:\\Users\\devde\\OneDrive\\Desktop\\Demo projects\\Mint-more\\saas\\mint-more-backend\\.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query(`SELECT
       sp.id,
       sp.title,
       sp.caption,
       sp.status,
       sp.content_type,
       sp.target_platforms,
       sp.publish_at,
       sp.published_at,
       sp.created_at,
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'platform', spp.platform,
             'status',   spp.status,
             'platform_post_url', spp.platform_post_url,
             'published_at', spp.published_at
           )
           ORDER BY spp.id
         )
         FROM social_post_platforms spp
         WHERE spp.post_id = sp.id
       ), '[]'::json) AS platform_statuses,
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'media_url',     spm.media_url,
             'media_type',    spm.media_type,
             'thumbnail_url', spm.thumbnail_url,
             'sort_order',    spm.sort_order
           )
           ORDER BY spm.sort_order
         )
         FROM social_post_media spm
         WHERE spm.post_id = sp.id
       ), '[]'::json) AS media
     FROM social_posts sp
     LIMIT 50`);
     console.log('Query succeeded. Rows:', res.rows.length);
  } catch (e) {
    console.error('Query failed:', e);
  } finally {
    pool.end();
  }
}

test();
