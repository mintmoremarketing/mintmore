const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgres://postgres.grnnqilqrzlnrtbfrpyx:Devdeep@1202@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const userId = '6ea800be-df70-4fb7-b4d1-1af447efb854';
    const start = new Date(2026, 7, 1);
    const end = new Date(2026, 8, 1);
    
    const result = await pool.query(
      `SELECT
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
       WHERE sp.user_id = $1
         AND (
           sp.publish_at  BETWEEN $2 AND $3
           OR sp.published_at BETWEEN $2 AND $3
           OR (sp.publish_at IS NULL AND sp.published_at IS NULL AND sp.created_at BETWEEN $2 AND $3)
         )
       ORDER BY COALESCE(sp.publish_at, sp.published_at, sp.created_at) ASC`,
      [userId, start.toISOString(), end.toISOString()]
    );
    console.log("Success! Posts fetched:", result.rows.length);
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    pool.end();
  }
}
test();
