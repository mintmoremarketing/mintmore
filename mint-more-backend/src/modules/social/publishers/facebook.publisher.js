const axios  = require('axios');
const logger = require('../../../utils/logger');

const FB_API       = 'https://graph.facebook.com/v19.0';
const FB_VIDEO_API = 'https://graph-video.facebook.com/v19.0';

// ── Content-type inference ─────────────────────────────────────────────────────

const inferPublishContentType = (post, media) => {
  const contentType = String(post?.content_type || '').toLowerCase();
  const mediaItems = Array.isArray(media) ? media.filter(Boolean) : [];
  const mediaTypes = mediaItems.map((item) => String(item.media_type || '').toLowerCase());

  if (contentType === 'carousel') {
    return 'carousel';
  }

  // Reel is an explicit user choice — respect it
  if (contentType === 'reel' || contentType === 'short') {
    return 'reel';
  }

  if (mediaItems.length > 1 && mediaTypes.every((type) => type === 'image')) {
    return 'carousel';
  }

  if (mediaTypes.includes('video')) {
    return 'video';
  }

  if (mediaItems.length === 1) {
    return mediaTypes[0] === 'video' ? 'video' : 'image';
  }

  return contentType || 'text';
};

// ── Video status polling ───────────────────────────────────────────────────────

/**
 * Poll Facebook until a video finishes processing.
 * Facebook video upload is async — the video_id exists immediately but
 * the post is not live until status becomes "ready".
 *
 * @returns {{ post_id: string, permalink_url: string }}
 */
const waitForFbVideoReady = async (videoId, pageToken, maxWaitMs = 300000) => {
  const startTime   = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const res = await axios.get(`${FB_API}/${videoId}`, {
      params: {
        fields:       'status,post_id,permalink_url',
        access_token: pageToken,
      },
    });

    const status = res.data.status;
    const processingProgress = status?.processing_progress;

    logger.debug('Facebook video processing status', {
      videoId,
      status: status?.video_status,
      processingProgress,
    });

    if (status?.video_status === 'ready') {
      return {
        post_id:       res.data.post_id || videoId,
        permalink_url: res.data.permalink_url || `https://www.facebook.com/${res.data.post_id || videoId}`,
      };
    }

    if (status?.video_status === 'error') {
      const reason = status?.error?.message || 'Video processing failed on Facebook';
      throw new Error(`Facebook video processing error: ${reason}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  // Timed out — the video may still process eventually, but we return what we have.
  // This is better than failing — the video_id is valid and will link to the post.
  logger.warn('Facebook video polling timed out — returning video ID', { videoId });
  return { post_id: videoId, permalink_url: `https://www.facebook.com/${videoId}` };
};

// ── Facebook Reel (3-step flow) ───────────────────────────────────────────────

/**
 * Publish a Facebook Reel.
 * Facebook Reels use a different endpoint + 3-step initialize/upload/publish flow.
 * Unlike regular video posts, Reels require the video to be uploaded as bytes,
 * not via file_url. Since we have a public URL we use the upload_url approach.
 */
const publishFacebookReel = async (pageId, pageToken, videoUrl, caption) => {
  // Step 1: Initialize the reel upload session
  const initRes = await axios.post(
    `${FB_VIDEO_API}/${pageId}/video_reels`,
    null,
    {
      params: {
        upload_phase:  'start',
        access_token:  pageToken,
      },
    }
  );

  const videoId   = initRes.data.video_id;
  const uploadUrl = initRes.data.upload_url;

  if (!videoId || !uploadUrl) {
    throw new Error('Facebook Reel init did not return video_id or upload_url');
  }

  // Step 2: Transfer the video bytes via the provided upload_url
  // We stream the source video through our server to Facebook's upload_url
  const videoRes = await axios.get(videoUrl, { responseType: 'stream' });
  const contentLength = videoRes.headers['content-length'];

  await axios.post(uploadUrl, videoRes.data, {
    headers: {
      'Authorization':   `OAuth ${pageToken}`,
      'offset':          '0',
      'file_size':       contentLength || '0',
      'Content-Type':    videoRes.headers['content-type'] || 'video/mp4',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // Step 3: Publish the reel
  const publishRes = await axios.post(
    `${FB_VIDEO_API}/${pageId}/video_reels`,
    null,
    {
      params: {
        video_id:     videoId,
        upload_phase: 'finish',
        video_state:  'PUBLISHED',
        description:  caption,
        access_token: pageToken,
      },
    }
  );

  logger.info('Facebook Reel published', { videoId, pageId });

  // Reels don't immediately return a post_id in finish phase — use video_id
  const postId = publishRes.data.post_id || videoId;
  return {
    platform_post_id:  postId,
    platform_post_url: `https://www.facebook.com/reels/${videoId}`,
  };
};

// ── Main publisher ─────────────────────────────────────────────────────────────

/**
 * Publish a post to a Facebook Page.
 * Supports: text, single image, single video, reel, carousel (multi-image).
 */
const publishToFacebook = async (account, post, media) => {
  const pageId    = account.page_id;
  const pageToken = account.access_token;
  const effectiveContentType = inferPublishContentType(post, media);

  if (!pageId) {
    throw new Error('No Facebook Page ID found for this account. Please reconnect.');
  }

  try {
    let response;

    if (effectiveContentType === 'reel' && media.length > 0) {
      // ── Reel — separate 3-step flow ────────────────────────────────────────
      return await publishFacebookReel(
        pageId,
        pageToken,
        media[0].media_url,
        buildFacebookCaption(post)
      );

    } else if (effectiveContentType === 'video' && media.length > 0) {
      // ── Regular video post ─────────────────────────────────────────────────
      // Upload via file_url — Facebook fetches from the public URL
      const uploadRes = await axios.post(
        `${FB_VIDEO_API}/${pageId}/videos`,
        null,
        {
          params: {
            file_url:     media[0].media_url,
            description:  buildFacebookCaption(post),
            access_token: pageToken,
          },
        }
      );

      const videoId = uploadRes.data.id;

      logger.info('Facebook video upload accepted — polling for ready status', {
        videoId,
        pageId,
      });

      // Poll until video is processed (async on Facebook's side)
      const { post_id, permalink_url } = await waitForFbVideoReady(videoId, pageToken);

      return {
        platform_post_id:  post_id,
        platform_post_url: permalink_url,
      };

    } else if (effectiveContentType === 'carousel' && media.length > 1) {
      // ── Carousel / multi-image post ────────────────────────────────────────
      // Step 1: Upload each image as an unpublished child
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
            message:        buildFacebookCaption(post),
            attached_media: childIds.map((id) => JSON.stringify({ media_fbid: id })),
            access_token:   pageToken,
          },
        }
      );
      response = res.data;

    } else if (media.length === 1 && effectiveContentType === 'image') {
      // ── Single image post ──────────────────────────────────────────────────
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
      response = {
        ...res.data,
        post_id: res.data.post_id || res.data.id,
      };

    } else {
      // ── Text / link post ───────────────────────────────────────────────────
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

    const postId  = response.post_id || response.id;
    const postUrl = `https://www.facebook.com/${postId}`;

    logger.info('Facebook publish success', { postId, pageId });
    return { platform_post_id: postId, platform_post_url: postUrl };

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('Facebook publish failed', { error: msg, pageId });
    throw new Error(`Facebook: ${msg}`);
  }
};

// ── Analytics ──────────────────────────────────────────────────────────────────

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

// ── Token management ───────────────────────────────────────────────────────────

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
  if (post.caption)          parts.push(post.caption);
  if (post.hashtags?.length) parts.push(post.hashtags.join(' '));
  if (post.mentions?.length) parts.push(post.mentions.join(' '));
  return parts.join('\n\n');
};

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate that a page token is still valid and has required permissions.
 * Call this before attempting to post.
 */
const validatePageToken = async (account) => {
  const pageId = account.page_id;
  if (!pageId) {
    return {
      valid:  false,
      reason: 'No Facebook Page ID found for this account. Please reconnect.',
    };
  }

  try {
    const res = await axios.get(`${FB_API}/${pageId}`, {
      params: {
        fields:       'id,name',
        access_token: account.access_token,
      },
    });

    if (!res.data.id) {
      return { valid: false, reason: 'Token returned no page data' };
    }

    return { valid: true, page_id: res.data.id, page_name: res.data.name };
  } catch (err) {
    const errorCode = err.response?.data?.error?.code;
    const errorMsg  = err.response?.data?.error?.message || err.message;

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

// ── Rate limit handling ───────────────────────────────────────────────────────

/**
 * Handle Meta API rate limit.
 * Returns true if we hit a rate limit and should retry after delay.
 */
const handleRateLimit = (error) => {
  const code    = error.response?.data?.error?.code;
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
