const { query } = require('./src/config/database');
const socialService = require('./src/modules/social/social.service');

async function run() {
  try {
    // Find a draft post
    const postRes = await query("SELECT id, user_id FROM social_posts WHERE status = 'draft' LIMIT 1;");
    if (postRes.rows.length === 0) {
      console.log("No draft posts found");
      process.exit(0);
    }
    const { id, user_id } = postRes.rows[0];
    console.log("Publishing post", id, "for user", user_id);
    const result = await socialService.publishPost(id, user_id);
    console.log("Result:", result);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit();
  }
}

run();
