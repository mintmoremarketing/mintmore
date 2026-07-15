const axios  = require('axios');
const logger = require('../../../utils/logger');

const FB_API = 'https://graph.facebook.com/v19.0';

// ── Content-type inference ─────────────────────────────────────────────────────

const inferPublishContentType = (post, media) => {
  const contentType = String(post?.content_type || '').toLowerCase();
  const mediaItems = Array.isArray(media) ? media.filter(Boolean) : [];
  const mediaTypes = mediaItems.map((item) => String(item.media_type || '').toLowerCase());

  // Multi-item selection = carousel
  if (contentType === 'carousel' || mediaItems.length > 1) {
    return 'carousel';
  }

  // Explicit reel or short content type
  if (contentType === 'reel' || contentType === 'short') {
    return 'reel';
  }

  // Any video (including content_type='video') → Reel on Instagram.
  // Instagram deprecated standalone video posts in 2022 — all video posts
  // must now go through the Reels container endpoint.
  if (mediaTypes.includes('video')) {
    return 'reel';
  }

  if (mediaItems.length === 1) {
    return 'image';
  }

  return contentType || 'image';
};

/**
 * Publish to Instagram Business Account via Facebook Graph API.
 *
 * Instagram publishing requires:
 * 1. A Facebook Page connected to the IG Business Account
 * 2. The instagram_business_account_id (stored as instagram_account_id)
 *
 * Flow: Create media container → Poll until ready → Publish container
 */
const publishToInstagram = async (account, post, media) => {
  const igAccountId = account.instagram_account_id;
  const accessToken = account.access_token;
  const effectiveContentType = inferPublishContentType(post, media);

  if (!igAccountId) {
    throw new Error(
      'No Instagram Business Account found. To publish to Instagram, the user must: ' +
      '(1) Have an Instagram Business or Creator account, ' +
      '(2) Connect it to their Facebook Page in Instagram Settings → Account → Switch to Professional Account, ' +
      '(3) Link the Instagram account to their Facebook Page in Page Settings → Instagram.'
    );
  }

  logger.info('Instagram publishing', { igAccountId, effectiveContentType, mediaCount: media.length });

  try {
    let containerId;

    if (effectiveContentType === 'carousel' && media.length > 1) {
      // ── Carousel ──────────────────────────────────────────────────────────────
      // Step 1: Create child containers
      const childIds = await Promise.all(
        media.map(async (m) => {
          const isVideo = m.media_type === 'video';
          const res = await axios.post(
            `${FB_API}/${igAccountId}/media`,
            null,
            {
              params: {
                [isVideo ? 'video_url' : 'image_url']: m.media_url,
                is_carousel_item: true,
                access_token:     accessToken,
              },
            }
          );
          return res.data.id;
        })
      );

      // Step 2: Create parent carousel container
      const parentRes = await axios.post(
        `${FB_API}/${igAccountId}/media`,
        null,
        {
          params: {
            media_type:   'CAROUSEL',
            caption:      buildInstagramCaption(post),
            children:     childIds.join(','),
            access_token: accessToken,
          },
        }
      );
      containerId = parentRes.data.id;

    } else if (effectiveContentType === 'reel' && media.length > 0) {
      // ── Reel / Video ──────────────────────────────────────────────────────────
      // Instagram deprecated standalone VIDEO posts in 2022.
      // All single-video posts (content_type='video' or 'reel') now go through
      // the REELS container endpoint. share_to_feed=true makes it appear on the grid.
      logger.info('Instagram publishing video as Reel', { igAccountId, mediaUrl: media[0].media_url });
      const res = await axios.post(
        `${FB_API}/${igAccountId}/media`,
        null,
        {
          params: {
            media_type:    'REELS',
            video_url:     media[0].media_url,
            caption:       buildInstagramCaption(post),
            share_to_feed: true,
            access_token:  accessToken,
          },
        }
      );
      containerId = res.data.id;

      // Videos need processing time — poll until status is FINISHED
      await waitForIgMediaReady(igAccountId, containerId, accessToken);

    } else if (media.length > 0) {
      // ── Single image ──────────────────────────────────────────────────────────
      const res = await axios.post(
        `${FB_API}/${igAccountId}/media`,
        null,
        {
          params: {
            image_url:    media[0].media_url,
            caption:      buildInstagramCaption(post),
            access_token: accessToken,
          },
        }
      );
      containerId = res.data.id;

    } else {
      throw new Error('Instagram requires at least one media item (image or video)');
    }

    // ── Publish the container ──────────────────────────────────────────────────
    const publishRes = await axios.post(
      `${FB_API}/${igAccountId}/media_publish`,
      null,
      {
        params: {
          creation_id:  containerId,
          access_token: accessToken,
        },
      }
    );

    const mediaId = publishRes.data.id;
    const postUrl = `https://www.instagram.com/p/${await getIgShortcode(mediaId, accessToken)}`;

    logger.info('Instagram publish success', { mediaId, igAccountId });
    return { platform_post_id: mediaId, platform_post_url: postUrl };

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('Instagram publish failed', { error: msg, igAccountId });
    throw new Error(`Instagram: ${msg}`);
  }
};

/**
 * Poll Instagram until media container is ready to publish.
 * Video processing can take 30s–5min.
 */
const waitForIgMediaReady = async (igAccountId, containerId, accessToken, maxWaitMs = 300000) => {
  const startTime    = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const res = await axios.get(
      `${FB_API}/${containerId}`,
      {
        params: {
          fields:       'status_code,status',
          access_token: accessToken,
        },
      }
    );

    const statusCode = res.data.status_code;

    logger.debug('Instagram media container status', { containerId, statusCode });

    if (statusCode === 'FINISHED') return true;
    if (statusCode === 'ERROR')    throw new Error('Instagram media processing failed');

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Instagram media processing timed out after 5 minutes');
};

const getIgShortcode = async (mediaId, accessToken) => {
  try {
    const res = await axios.get(`${FB_API}/${mediaId}`, {
      params: { fields: 'shortcode', access_token: accessToken },
    });
    return res.data.shortcode || mediaId;
  } catch {
    return mediaId;
  }
};

/**
 * Validate Instagram Business Account is still accessible.
 */
const validateIGAccount = async (account) => {
  if (!account.instagram_account_id) {
    return {
      valid:  false,
      reason: 'No Instagram Business Account linked. The user must connect an Instagram Business or Creator account to their Facebook Page.',
    };
  }

  try {
    const res = await axios.get(
      `${FB_API}/${account.instagram_account_id}`,
      {
        params: {
          fields:       'id,name,username,account_type',
          access_token: account.access_token,
        },
      }
    );

    const accountType = res.data.account_type;
    if (!['BUSINESS', 'CREATOR'].includes(accountType)) {
      return {
        valid:  false,
        reason: `Instagram account type is "${accountType}". Only Business or Creator accounts can publish via API. The user must convert their personal account.`,
      };
    }

    return { valid: true, account_type: accountType };
  } catch (err) {
    const code = err.response?.data?.error?.code;
    if (code === 190) {
      return { valid: false, reason: 'Instagram access token expired or revoked' };
    }
    return { valid: false, reason: err.response?.data?.error?.message || err.message };
  }
};

/**
 * Check if a specific permission is granted on the current token.
 */
const checkPermission = async (accessToken, permission) => {
  try {
    const res = await axios.get(`${FB_API}/me/permissions`, {
      params: { access_token: accessToken },
    });
    const perms   = res.data.data || [];
    const granted = perms.find((p) => p.permission === permission && p.status === 'granted');
    return !!granted;
  } catch {
    return false;
  }
};

/**
 * Pull Instagram insights for a published post.
 */
const getInstagramAnalytics = async (account, platformPostId) => {
  try {
    const res = await axios.get(
      `${FB_API}/${platformPostId}/insights`,
      {
        params: {
          metric:       'impressions,reach,likes,comments,shares,saved',
          access_token: account.access_token,
        },
      }
    );

    const data   = res.data.data || [];
    const byName = Object.fromEntries(data.map((d) => [d.name, d.values?.[0]?.value || 0]));

    return {
      views_count:    byName['impressions']  || 0,
      reach_count:    byName['reach']        || 0,
      likes_count:    byName['likes']        || 0,
      comments_count: byName['comments']     || 0,
      shares_count:   byName['shares']       || 0,
    };
  } catch (err) {
    logger.warn('Instagram analytics failed', { error: err.message });
    return null;
  }
};

const buildInstagramCaption = (post) => {
  const parts = [];
  if (post.caption)          parts.push(post.caption);
  if (post.mentions?.length) parts.push(post.mentions.join(' '));
  if (post.hashtags?.length) parts.push(post.hashtags.join(' '));
  return parts.join('\n\n');
};

module.exports = {
  publishToInstagram,
  getInstagramAnalytics,
  validateIGAccount,
  checkPermission,
};
