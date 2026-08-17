const { validateCreatePost } = require('./src/modules/social/social.validator');

const baseTopic = 'Product Showcase';
const cycle = 1;
const angle = 'Meet the Team';

// Mimic fallback assignment logic
let assignedTopic = {
  id: `brand-fallback-2026-08-08`,
  title: `${baseTopic} Post`,
  description: `Draft post about ${baseTopic}`,
  category: 'brand',
  format: 'post'
}

if (cycle > 0) {
  assignedTopic = {
    ...assignedTopic,
    title: `${baseTopic} - ${angle}`
  }
}

// Mimic payload in Onboarding.jsx
const ctype = assignedTopic.format === 'post' ? 'image' : assignedTopic.format;
let publishDate = new Date();
publishDate.setHours(10, 0, 0, 0);
if (publishDate <= new Date()) {
  publishDate = null;
}

const payload = {
  title: assignedTopic.title,
  caption: assignedTopic.captionPreview || assignedTopic.description || '',
  status: 'draft',
  content_type: ctype,
  publish_at: publishDate ? publishDate.toISOString() : null,
  target_platforms: ['facebook']
};

try {
  validateCreatePost(payload);
  console.log("Payload validation passed:", payload);
} catch (err) {
  console.error("Payload validation failed:", err.errors || err);
}

// Try for festival logic
const adminEvent = {
  id: 'c1e26298-0626-4f39-9e88-b5ad6b55e471',
  title: 'Environment Day Creative',
  description: 'environment day post',
  asset_type: 'social_post',
};

const assignedTopic2 = {
  id: adminEvent.id,
  title: adminEvent.title,
  description: adminEvent.description,
  format: adminEvent.asset_type || 'post',
  category: 'festival',
  festivalName: adminEvent.title,
  captionPreview: adminEvent.description,
}

const payload2 = {
  title: assignedTopic2.title,
  caption: assignedTopic2.captionPreview || assignedTopic2.description || '',
  status: 'draft',
  content_type: assignedTopic2.format === 'social_post' ? 'image' : assignedTopic2.format,
  publish_at: null, // assuming past date
  target_platforms: ['facebook']
};

try {
  validateCreatePost(payload2);
  console.log("Festival payload passed:", payload2);
} catch (err) {
  console.error("Festival payload failed:", err.errors || err);
}
