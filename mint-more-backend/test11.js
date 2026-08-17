const { validateCreatePost } = require('./src/modules/social/social.validator');

const payload1 = {
  title: 'Customer Spotlight & Testimonials - Meet the Team',
  caption: 'Draft post about Customer Spotlight & Testimonials',
  status: 'draft',
  content_type: 'image',
  publish_at: null,
  target_platforms: ['facebook']
};

const payload2 = {
  title: 'Customer Spotlight & Testimonials - Meet the Team',
  caption: 'Draft post about Customer Spotlight & Testimonials',
  status: 'draft',
  content_type: 'image',
  publish_at: new Date(Date.now() + 86400000).toISOString(),
  target_platforms: ['facebook']
};

try {
  validateCreatePost(payload1);
  console.log("Payload 1 passed!");
} catch (e) {
  console.error("Payload 1 failed:", e.errors || e.message);
}

try {
  validateCreatePost(payload2);
  console.log("Payload 2 passed!");
} catch (e) {
  console.error("Payload 2 failed:", e.errors || e.message);
}
