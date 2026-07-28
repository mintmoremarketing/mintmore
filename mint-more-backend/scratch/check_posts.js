const { query } = require('../src/config/database');

async function check() {
  try {
    const postsRes = await query(`
      SELECT id, title, status, publish_at, published_at, queue_job_id, created_at
      FROM social_posts
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log('\nRecent social posts:');
    console.table(postsRes.rows);

    const platformRes = await query(`
      SELECT spp.post_id, spp.platform, spp.status, spp.error_message, spp.retry_count, spp.last_retry_at
      FROM social_post_platforms spp
      ORDER BY spp.id DESC
      LIMIT 15
    `);
    console.log('\nRecent post platforms status:');
    console.table(platformRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
