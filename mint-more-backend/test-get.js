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

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube', 'google_business_profile'];

const normalizeTargetPlatforms = (value) => {
  let platforms = value;
  if (typeof platforms === 'string') {
    const trimmed = platforms.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      platforms = trimmed
        .slice(1, -1)
        .split(',')
        .map(item => item.trim().replace(/^"|"$/g, ''));
    } else {
      try {
        platforms = JSON.parse(trimmed);
      } catch {
        platforms = trimmed.split(',').map(item => item.trim());
      }
    }
  }
  if (!Array.isArray(platforms)) platforms = [platforms];
  return [...new Set(
    platforms
      .map(platform => String(platform || '').trim().toLowerCase())
      .filter(platform => SOCIAL_PLATFORMS.includes(platform))
  )];
};

async function test() {
  try {
    const month = '2026-08';
    const key = month;
    const [year, mon] = key.split('-').map(Number);
    const start = new Date(year, mon - 1, 1);
    const end   = new Date(year, mon, 1); 
    
    // Hardcode user ID for testing
    const userId = '13083dbb-ecce-4eb2-a39c-c9eebba397ba'; // some UUID, or we can just fetch one from DB
    const res = await pool.query('SELECT id FROM users LIMIT 1');
    const uId = res.rows[0]?.id || userId;

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
         AND sp.status != 'deleted'
       ORDER BY COALESCE(sp.publish_at, sp.published_at, sp.created_at) ASC`,
      [uId, start.toISOString(), end.toISOString()]
    );

    const posts = [];
    for (const post of result.rows) {
      const rawPlatforms = normalizeTargetPlatforms(post.target_platforms || []);
      const statusPlatforms = (post.platform_statuses || []).map(s => s.platform);
      const platforms = [...new Set([...rawPlatforms, ...statusPlatforms])].filter(Boolean);

      posts.push({
        id:               post.id,
        title:            post.title,
        caption:          post.caption,
        status:           post.status,
        content_type:     post.content_type,
        platforms,
        platform_statuses: post.platform_statuses,
        publish_at:       post.publish_at,
        published_at:     post.published_at,
        media:            post.media || [],
        created_at:       post.created_at
      });
    }

    console.log('Success!', posts.length, 'posts fetched');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    pool.end();
  }
}

test();
