const { query } = require('../src/config/database');
const socialService = require('../src/modules/social/social.service');

async function test() {
  const userId = '6ea800be-df70-4fb7-b4d1-1af447efb854';
  try {
    // 1. Create a mock draft post with facebook target platform and content_type = 'text'
    const insertRes = await query(`
      INSERT INTO social_posts 
        (user_id, caption, target_platforms, status, content_type)
      VALUES 
        ($1, 'Test publishing flow', '{"facebook"}', 'draft', 'text')
      RETURNING id
    `, [userId]);
    
    const postId = insertRes.rows[0].id;
    console.log('Created mock draft post:', postId);

    // 2. Call publishPost
    const result = await socialService.publishPost(postId, userId);
    console.log('Publish result:', result);

    // 3. Check post status in database
    const postRes = await query(`SELECT status, queue_job_id FROM social_posts WHERE id = $1`, [postId]);
    console.log('Post status in database:', postRes.rows[0]);

    // 4. Clean up mock post
    await query(`DELETE FROM social_post_platforms WHERE post_id = $1`, [postId]);
    await query(`DELETE FROM social_posts WHERE id = $1`, [postId]);
    console.log('Cleaned up mock post');

  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    process.exit(0);
  }
}
test();
