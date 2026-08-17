const { validateCreatePost } = require('./src/modules/social/social.validator');

const payload = {
  title: '[object Object] Post',
  caption: 'Draft post about [object Object]',
  status: 'draft',
  content_type: 'image',
  publish_at: null,
  target_platforms: ['facebook', 'google']
};

try {
  validateCreatePost(payload);
  console.log("Validation passed");
} catch (err) {
  console.error("Validation failed:", err.errors || err);
}
