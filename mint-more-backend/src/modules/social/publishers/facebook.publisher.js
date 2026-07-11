const axios  = require('axios');
const logger = require('../../../utils/logger');

const FB_API = 'https://graph.facebook.com/v19.0';

/**
 * Publish a post to a Facebook Page.
 * Supports: text, single image, single video, link posts.
 */
const publishToFacebook = async (account, post, media) => {
  const pageId    = account.page_id;
  const pageToken = account.access_token;

  if (!pageId) {
    throw new Error('No Facebook Page ID found for this account. Please reconnect.');
  }

  try {
    let response;

    if (post.content_type === 'video' && media.length > 0) {
      // ── Video post ──────────────────────────────────────────────────────────
      const videoMedia = media[0];

      // Step 1: Upload video to Facebook
      const uploadRes = await axios.post(
        `https://graph-video.facebook.com/v19.0/${pageId}/videos`,
        null,
        {
          params: {
            file_url:    videoMedia.media_url,
            description: buildFacebookCaption(post),
            access_token: pageToken,
          },
        }
      );

      response = { id: uploadRes.data.id };

    } else if (post.content_type === 'carousel' && media.length > 1) {
      // ── Carousel / multi-image post ─────────────────────────────────────────
      // Step 1: Upload each image as a child
      const childIds = await Promise.all(
        media.map(async (m) => {
          const res = await axios.post(
            `${FB_API}/${pageId}/photos`,
            null,
            {
              params: {
                url:          m.media_url,
                published:    false,
                access_token: pageToken,
              },
            }
          );
          return res.data.id;
        })
      );

      // Step 2: Publish parent post linking all children
      const res = await axios.post(
        `${FB_API}/${pageId}/feed`,
        null,
        {
          params: {
            message:      buildFacebookCaption(post),
            attached_media: childIds.map((id) => JSON.stringify({ media_fbid: id })),
            access_token:   pageToken,
          },
        }
      );
      response = res.data;

    } else if (media.length === 1 && post.content_type === 'image') {
      // ── Single image post ───────────────────────────────────────────────────
      const res = await axios.post(
        `${FB_API}/${pageId}/photos`,
        null,
        {
          params: {
            url:          media[0].media_url,
            caption:      buildFacebookCaption(post),
            access_token: pageToken,
          },
        }
      );
      response = res.data;

    } else {
      // ── Text / link post ────────────────────────────────────────────────────
      const res = await axios.post(
        `${FB_API}/${pageId}/feed`,
        null,
        {
          params: {
            message:      buildFacebookCaption(post),
            access_token: pageToken,
          },
        }
      );
      response = res.data;
    }

    const postId  = response.id || response.post_id;
    const postUrl = `https://www.facebook.com/${postId}`;

    logger.info('Facebook publish success', { postId, pageId });
    return { platform_post_id: postId, platform_post_url: postUrl };

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('Facebook publish failed', { error: msg, pageId });
    throw new Error(`Facebook: ${msg}`);
  }
};

/**
 * Pull analytics for a Facebook post.
 */
const getFacebookAnalytics = async (account, platformPostId) => {
  try {
    const res = await axios.get(
      `${FB_API}/${platformPostId}/insights`,
      {
        params: {
          metric:       'post_impressions,post_engaged_users,post_reactions_by_type_total',
          access_token: account.access_token,
        },
      }
    );

    const data   = res.data.data || [];
    const byName = Object.fromEntries(data.map((d) => [d.name, d.values?.[0]?.value || 0]));

    return {
      views_count:    byName['post_impressions'] || 0,
      reach_count:    byName['post_impressions_unique'] || 0,
      likes_count:    Object.values(byName['post_reactions_by_type_total'] || {})
                        .reduce((a, b) => a + b, 0),
      comments_count: 0,
      shares_count:   0,
    };
  } catch (err) {
    logger.warn('Facebook analytics failed', { error: err.message });
    return null;
  }
};

/**
 * Refresh a Facebook long-lived token.
 * FB tokens last 60 days — refresh before expiry.
 */
const refreshFacebookToken = async (account) => {
  const env = require('../../../config/env');
  try {
    const res = await axios.get(`${FB_API}/oauth/access_token`, {
      params: {
        grant_type:        'fb_exchange_token',
        client_id:         env.social.facebook.appId,
        client_secret:     env.social.facebook.appSecret,
        fb_exchange_token: account.access_token,
      },
    });
    return {
      access_token:     res.data.access_token,
      token_expires_at: new Date(Date.now() + (res.data.expires_in || 5184000) * 1000),
    };
  } catch (err) {
    logger.error('Facebook token refresh failed', { error: err.message });
    return null;
  }
};

const buildFacebookCaption = (post) => {
  const parts = [];
  if (post.caption)   parts.push(post.caption);
  if (post.hashtags?.length) parts.push(post.hashtags.join(' '));
  if (post.mentions?.length) parts.push(post.mentions.join(' '));
  return parts.join('\n\n');
};

/**
 * Validate that a page token is still valid and has required permissions.
 * Call this before attempting to post.
 */
const validatePageToken = async (account) => {
  const pageId = account.page_id;
  if (!pageId) {
    return {
      valid: false,
      reason: 'No Facebook Page ID found for this account. Please reconnect.',
    };
  }

  try {
    const res = await axios.get(`${FB_API}/${pageId}`, {
      params: {
        fields:       'id,name,tasks',
        access_token: account.access_token,
      },
    });

    if (!res.data.id) {
      return { valid: false, reason: 'Token returned no page data' };
    }

    // Check page has CREATE_CONTENT task (required for posting)
    const tasks = res.data.tasks || [];
    if (!tasks.includes('CREATE_CONTENT') && !tasks.includes('MANAGE')) {
      return {
        valid:  false,
        reason: 'Page token does not have CREATE_CONTENT permission. User may have revoked access.',
      };
    }

    return { valid: true, page_id: res.data.id, page_name: res.data.name };
  } catch (err) {
    const errorCode = err.response?.data?.error?.code;
    const errorMsg  = err.response?.data?.error?.message || err.message;

    // Error code 190 = invalid/expired token
    // Error code 200 = permission error
    if (errorCode === 190) {
      return { valid: false, reason: 'Token expired or invalid', code: 190 };
    }
    if (errorCode === 200) {
      return { valid: false, reason: 'Permission revoked by user', code: 200 };
    }

    return { valid: false, reason: errorMsg };
  }
};

/**
 * Check if a page still exists and the app has access to it.
 */
const validatePageAccess = async (pageId, accessToken) => {
  try {
    const res = await axios.get(`${FB_API}/${pageId}`, {
      params: {
        fields:       'id,name,is_published',
        access_token: accessToken,
      },
    });
    return { accessible: true, page: res.data };
  } catch (err) {
    const code = err.response?.data?.error?.code;
    if (code === 803 || code === 100) {
      return { accessible: false, reason: 'Page no longer exists or was removed' };
    }
    return { accessible: false, reason: err.response?.data?.error?.message || err.message };
  }
};

/**
 * Handle Meta API rate limit.
 * Returns true if we hit a rate limit and should retry after delay.
 */
const handleRateLimit = (error) => {
  const code    = error.response?.data?.error?.code;
  const subcode = error.response?.data?.error?.error_subcode;
  const headers = error.response?.headers || {};

  // Code 32 = app rate limit, code 613 = custom rate limit
  if (code === 32 || code === 613 || error.response?.status === 429) {
    const retryAfter = parseInt(headers['retry-after'] || headers['x-ratelimit-reset'] || '60', 10);
    return { isRateLimit: true, retryAfterSeconds: retryAfter };
  }
  return { isRateLimit: false };
};

/**
 * Publish with retry logic for rate limits.
 * Wraps any publisher call with up to 3 retries on rate limit.
 */
const withRateLimitRetry = async (fn, maxRetries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const { isRateLimit, retryAfterSeconds } = handleRateLimit(err);
      if (isRateLimit && attempt < maxRetries) {
        logger.warn(`Meta rate limit hit — retrying in ${retryAfterSeconds}s`, {
          attempt, retryAfterSeconds,
        });
        await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
};

module.exports = {
  publishToFacebook,
  getFacebookAnalytics,
  refreshFacebookToken,
  validatePageToken,
  validatePageAccess,
  withRateLimitRetry,
};
