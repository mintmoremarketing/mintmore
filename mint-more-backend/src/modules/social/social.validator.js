const AppError = require('../../utils/AppError');

const PLATFORMS      = ['facebook', 'instagram', 'youtube', 'google_business_profile'];
const CONTENT_TYPES  = ['text', 'image', 'video', 'carousel', 'reel', 'short', 'story'];
const CONTENT_RULES  = {
  instagram: ['image', 'carousel', 'reel', 'video', 'story'],
  google_business_profile: ['text', 'image', 'video', 'reel', 'short'],
  youtube: ['video', 'short', 'reel'],
  facebook: ['text', 'image', 'video', 'reel', 'carousel', 'story'],
  linkedin: ['text', 'image', 'video', 'carousel']
};

const validateCreatePost = (body) => {
  const { caption, content_type, target_platforms, publish_at } = body;
  const errors = [];

  if (!caption && !body.title) {
    errors.push('caption or title is required');
  }

  if (!content_type || !CONTENT_TYPES.includes(content_type)) {
    errors.push(`content_type must be one of: ${CONTENT_TYPES.join(', ')}`);
  }

  if (content_type && target_platforms) {
    const targets = Array.isArray(target_platforms) ? target_platforms : [target_platforms];
    for (const platform of targets) {
      const allowed = CONTENT_RULES[platform];
      if (allowed && !allowed.includes(content_type)) {
        errors.push(`${platform} posts must use one of: ${allowed.join(', ')}`);
      }
    }
  }

  if (!target_platforms || !Array.isArray(target_platforms) || target_platforms.length === 0) {
    errors.push('target_platforms must be a non-empty array');
  } else {
    const invalid = target_platforms.filter((p) => !PLATFORMS.includes(p));
    if (invalid.length > 0) {
      errors.push(`Invalid platforms: ${invalid.join(', ')}. Must be: ${PLATFORMS.join(', ')}`);
    }
  }

  if (publish_at) {
    const d = new Date(publish_at);
    if (isNaN(d.getTime())) {
      errors.push('publish_at must be a valid ISO datetime');
    } else if (d <= new Date()) {
      errors.push('publish_at must be in the future');
    }
  }

  if (body.hashtags !== undefined) {
    if (!Array.isArray(body.hashtags)) {
      errors.push('hashtags must be an array of strings');
    } else if (body.hashtags.some((h) => typeof h !== 'string')) {
      errors.push('Each hashtag must be a string');
    }
  }

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

module.exports = { validateCreatePost };
