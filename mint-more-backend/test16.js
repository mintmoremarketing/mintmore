const { validateCreatePost } = require('./src/modules/social/social.validator');

try {
  validateCreatePost({
    title: 'Hello',
    caption: 'World',
    status: 'draft',
    content_type: 'reel',
    publish_at: null,
    target_platforms: ['instagram', 'google_business_profile']
  });
  console.log("Passed");
} catch (err) {
  console.error("Failed:", err.errors || err);
}
