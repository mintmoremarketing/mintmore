const { query, getClient }   = require('../../config/database');
const { schedulePost, cancelScheduledPost } = require('./queue/publish.queue');
const { publishToFacebook, getFacebookAnalytics, refreshFacebookToken } = require('./publishers/facebook.publisher');
const { publishToInstagram, getInstagramAnalytics } = require('./publishers/instagram.publisher');
const { publishToYouTube, getYouTubeAnalytics, refreshYouTubeToken } = require('./publishers/youtube.publisher');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const env      = require('../../config/env');
const axios    = require('axios');
const { getSetting } = require('../commerce/settings.service');

const FB_API = 'https://graph.facebook.com/v19.0';
const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube'];
const META_REQUIRED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
];
const META_REQUESTED_SCOPES = [...META_REQUIRED_SCOPES, 'public_profile'];

const fetchFacebookPageStats = async (account) => {
  if (!account.page_id) return null;

  try {
    const pageRes = await axios.get(`${FB_API}/${account.page_id}`, {
      params: {
        fields: 'id,name,fan_count',
        access_token: account.access_token,
      },
    });

    let postsCount = null;
    try {
      const postsRes = await axios.get(`${FB_API}/${account.page_id}/published_posts`, {
        params: {
          summary: true,
          limit: 1,
          access_token: account.access_token,
        },
      });
      postsCount = postsRes.data?.summary?.total_count ?? null;
    } catch (postsErr) {
      logger.debug('Facebook page post count fetch skipped', {
        accountId: account.id,
        pageId: account.page_id,
        error: postsErr.message,
      });
    }

    const page = pageRes.data || {};
    let linkedInstagram = null;
    let linkedInstagramId = null;
    try {
      const igLinkRes = await axios.get(`${FB_API}/${account.page_id}`, {
        params: {
          fields: 'instagram_business_account',
          access_token: account.access_token,
        },
      });
      linkedInstagramId = igLinkRes.data?.instagram_business_account?.id || null;
    } catch (linkErr) {
      logger.debug('Facebook linked Instagram lookup skipped', {
        accountId: account.id,
        pageId: account.page_id,
        error: linkErr.message,
      });
    }

    if (linkedInstagramId) {
      try {
        const igRes = await axios.get(`${FB_API}/${linkedInstagramId}`, {
          params: {
            fields: 'id,name,username,followers_count,follows_count,media_count,profile_picture_url',
            access_token: account.access_token,
          },
        });
        linkedInstagram = igRes.data || null;
      } catch (igErr) {
        logger.warn('Facebook-linked Instagram stats fetch failed', {
          accountId: account.id,
          instagramAccountId: linkedInstagramId,
          error: igErr.message,
        });
      }
    }
    return {
      followers_count: Number(page.followers_count || page.fan_count || 0),
      page_likes_count: Number(page.fan_count || 0),
      posts_count: postsCount,
      linked_instagram: linkedInstagram ? {
        id: linkedInstagram.id || null,
        name: linkedInstagram.name || null,
        username: linkedInstagram.username || null,
        followers_count: linkedInstagram.followers_count ?? null,
        follows_count: linkedInstagram.follows_count ?? null,
        media_count: linkedInstagram.media_count ?? null,
        profile_picture_url: linkedInstagram.profile_picture_url || null,
      } : null,
    };
  } catch (err) {
    logger.debug('Facebook account stats fetch unavailable', {
      accountId: account.id,
      pageId: account.page_id,
      error: err.message,
    });
    return {
      followers_count: null,
      page_likes_count: null,
      posts_count: null,
      linked_instagram: null,
    };
  }
};

const fetchInstagramAccountStats = async (account) => {
  if (!account.instagram_account_id) return null;

  try {
    const res = await axios.get(`${FB_API}/${account.instagram_account_id}`, {
      params: {
        fields: 'id,name,username,followers_count,follows_count,media_count,profile_picture_url',
        access_token: account.access_token,
      },
    });

    const ig = res.data || {};
    return {
      followers_count: Number(ig.followers_count || 0),
      following_count: Number(ig.follows_count || 0),
      posts_count: Number(ig.media_count || 0),
      profile_picture_url: ig.profile_picture_url || null,
    };
  } catch (err) {
    logger.warn('Instagram account stats fetch failed', {
      accountId: account.id,
      instagramAccountId: account.instagram_account_id,
      error: err.message,
    });
    return null;
  }
};

const normalizeTargetPlatforms = (value) => {
  let platforms = value;

  if (typeof platforms === 'string') {
    const trimmed = platforms.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      platforms = trimmed
        .slice(1, -1)
        .split(',')
        .map(item => item.trim().replace(/^"|"$/g, ''));
    } else {
      try {
        platforms = JSON.parse(trimmed);
      } catch {
        platforms = trimmed.split(',').map(item => item.trim());
      }
    }
  }

  if (!Array.isArray(platforms)) platforms = [platforms];

  return [...new Set(
    platforms
      .map(platform => String(platform || '').trim().toLowerCase())
      .filter(platform => SOCIAL_PLATFORMS.includes(platform))
  )];
};

const normalizePostRow = (post) => post
  ? { ...post, target_platforms: normalizeTargetPlatforms(post.target_platforms) }
  : post;

// ── OAuth Flow ────────────────────────────────────────────────────────────────

/**
 * Generate the OAuth authorization URL for a platform.
 * Client is redirected here to grant permissions.
 */
const getOAuthUrl = (platform, userId) => {
  const state = Buffer.from(JSON.stringify({ platform, userId })).toString('base64');

  if (platform === 'facebook' || platform === 'instagram') {
    const scopes = META_REQUESTED_SCOPES.join(',');

    const params = new URLSearchParams({
      client_id:     env.social.facebook.appId,
      redirect_uri:  env.social.facebook.redirectUri,
      scope:         scopes,
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  }

  if (platform === 'youtube') {
    const params = new URLSearchParams({
      client_id:     env.social.youtube.clientId,
      redirect_uri:  env.social.youtube.redirectUri,
      scope:         'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      response_type: 'code',
      access_type:   'offline',
      prompt:        'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  throw new AppError(`Unsupported platform: ${platform}`, 400);
};

/**
 * Handle OAuth callback — exchange code for token and save account.
 * Called when platform redirects back to our callback URL.
 */
const handleOAuthCallback = async (platform, code, state) => {
  let parsedState;
  try {
    parsedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
  } catch {
    throw new AppError('Invalid OAuth state', 400);
  }

  const { userId } = parsedState;

  if (platform === 'facebook' || platform === 'instagram') {
    return handleFacebookCallback(userId, code);
  }

  if (platform === 'youtube') {
    return handleYouTubeCallback(userId, code);
  }

  throw new AppError(`Unsupported platform: ${platform}`, 400);
};

const handleFacebookCallback = async (userId, code) => {
  // Exchange code for short-lived token
  const tokenRes = await axios.get(`${FB_API}/oauth/access_token`, {
    params: {
      client_id:     env.social.facebook.appId,
      client_secret: env.social.facebook.appSecret,
      redirect_uri:  env.social.facebook.redirectUri,
      code,
    },
  });

  const shortToken = tokenRes.data.access_token;

  // Exchange for long-lived token (60 days)
  const longTokenRes = await axios.get(`${FB_API}/oauth/access_token`, {
    params: {
      grant_type:        'fb_exchange_token',
      client_id:         env.social.facebook.appId,
      client_secret:     env.social.facebook.appSecret,
      fb_exchange_token: shortToken,
    },
  });

  const longToken   = longTokenRes.data.access_token;
  const expiresIn   = longTokenRes.data.expires_in || 5184000; // 60 days
  const expiresAt   = new Date(Date.now() + expiresIn * 1000);

  const permissionsRes = await axios.get(`${FB_API}/me/permissions`, {
    params: { access_token: longToken },
  });
  const grantedScopes = new Set(
    (permissionsRes.data.data || [])
      .filter((item) => item.status === 'granted')
      .map((item) => item.permission)
  );
  const missingScopes = META_REQUIRED_SCOPES.filter((scope) => !grantedScopes.has(scope));

  logger.info('Meta permission audit completed', {
    userId,
    grantedScopes: [...grantedScopes],
    missingScopes,
  });
  if (missingScopes.length) {
    logger.warn('Meta permissions missing for richer Instagram publishing', {
      userId,
      missingScopes,
    });
  }

  // Get user info
  const meRes = await axios.get(`${FB_API}/me`, {
    params: { fields: 'id,name,picture', access_token: longToken },
  });

  // Get pages they manage
  const pagesRes = await axios.get(`${FB_API}/me/accounts`, {
    params: { access_token: longToken },
  });

  const pages = pagesRes.data.data || [];
  const savedAccounts = [];

  for (const page of pages) {
    // Get Instagram Business Account linked to this page
    let igAccountId = null;
    try {
      const igRes = await axios.get(`${FB_API}/${page.id}`, {
        params: {
          fields:       'instagram_business_account',
          access_token: page.access_token,
        },
      });
      igAccountId = igRes.data.instagram_business_account?.id || null;
    } catch {
      // Page may not have IG connected
    }

    // Save Facebook Page account
    const fbAccount = await upsertSocialAccount({
      userId,
      platform:           'facebook',
      platformUserId:     page.id,
      platformName:       page.name,
      pageId:             page.id,
      pageName:           page.name,
      accessToken:        page.access_token,  // page-level token
      tokenExpiresAt:     expiresAt,
      tokenScope:         META_REQUESTED_SCOPES.join(','),
      instagramAccountId: igAccountId,
    });
    savedAccounts.push(fbAccount);

    // Save Instagram account if linked
    if (igAccountId) {
      const igInfoRes = await axios.get(`${FB_API}/${igAccountId}`, {
        params: {
          fields:       'id,name,username,profile_picture_url',
          access_token: page.access_token,
        },
      });
      const igInfo = igInfoRes.data;

      const igAccount = await upsertSocialAccount({
        userId,
        platform:           'instagram',
        platformUserId:     igAccountId,
        platformUsername:   igInfo.username,
        platformName:       igInfo.name,
        platformAvatarUrl:  igInfo.profile_picture_url,
        pageId:             page.id,
        instagramAccountId: igAccountId,
        accessToken:        page.access_token,
        tokenExpiresAt:     expiresAt,
      });
      savedAccounts.push(igAccount);
    }
  }

  logger.info('Facebook OAuth completed', { userId, pagesConnected: pages.length });
  return savedAccounts;
};

const handleYouTubeCallback = async (userId, code) => {
  const { google } = require('googleapis');
  const auth = new google.auth.OAuth2(
    env.social.youtube.clientId,
    env.social.youtube.clientSecret,
    env.social.youtube.redirectUri
  );

  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);

  const youtube   = require('googleapis').google.youtube({ version: 'v3', auth });
  const channelRes = await youtube.channels.list({
    part: ['snippet', 'statistics'],
    mine: true,
  });

  const channel = channelRes.data.items?.[0];
  if (!channel) throw new AppError('No YouTube channel found for this account', 404);

  const account = await upsertSocialAccount({
    userId,
    platform:          'youtube',
    platformUserId:    channel.id,
    platformName:      channel.snippet.title,
    platformAvatarUrl: channel.snippet.thumbnails?.default?.url,
    accessToken:       tokens.access_token,
    refreshToken:      tokens.refresh_token,
    tokenExpiresAt:    new Date(tokens.expiry_date),
    tokenScope:        tokens.scope,
  });

  logger.info('YouTube OAuth completed', { userId, channelId: channel.id });
  return [account];
};

// ── Account Management ────────────────────────────────────────────────────────

const upsertSocialAccount = async ({
  userId, platform, platformUserId,
  platformUsername, platformName, platformAvatarUrl,
  pageId, pageName, instagramAccountId,
  accessToken, refreshToken, tokenExpiresAt, tokenScope,
}) => {
  const result = await query(
    `INSERT INTO social_accounts
       (user_id, platform, platform_user_id, platform_username, platform_name,
        platform_avatar_url, page_id, page_name, instagram_account_id,
        access_token, refresh_token, token_expires_at, token_scope)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (user_id, platform, platform_user_id) DO UPDATE SET
       platform_username   = EXCLUDED.platform_username,
       platform_name       = EXCLUDED.platform_name,
       platform_avatar_url = EXCLUDED.platform_avatar_url,
       access_token        = EXCLUDED.access_token,
       refresh_token       = COALESCE(EXCLUDED.refresh_token, social_accounts.refresh_token),
       token_expires_at    = EXCLUDED.token_expires_at,
       token_scope         = EXCLUDED.token_scope,
       instagram_account_id = COALESCE(EXCLUDED.instagram_account_id, social_accounts.instagram_account_id),
       is_active           = true,
       last_error          = NULL
     RETURNING *`,
    [
      userId, platform, platformUserId,
      platformUsername || null, platformName || null,
      platformAvatarUrl || null,
      pageId || null, pageName || null,
      instagramAccountId || null,
      accessToken, refreshToken || null,
      tokenExpiresAt || null, tokenScope || null,
    ]
  );
  return result.rows[0];
};

const getMyAccounts = async (userId) => {
  const result = await query(
    `SELECT
       id, platform, platform_user_id, platform_username,
       platform_name, platform_avatar_url,
       page_id, page_name, instagram_account_id,
       is_active, last_used_at, last_error,
       token_expires_at,
       -- Days until token expires
       GREATEST(0, EXTRACT(DAY FROM (token_expires_at - NOW()))::INTEGER) AS token_days_remaining,
       -- Token expiry warning
       CASE
         WHEN token_expires_at IS NULL THEN 'unknown'
         WHEN token_expires_at < NOW() THEN 'expired'
         WHEN token_expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
         ELSE 'valid'
      END AS token_status,
       created_at
     FROM social_accounts
     WHERE user_id = $1 AND is_active = true
     ORDER BY platform ASC, platform_name ASC`,
    [userId]
  );

  let rows = await Promise.all(result.rows.map(async (account) => {
    let stats = null;

    if (account.platform === 'facebook') {
      stats = await fetchFacebookPageStats(account);
    } else if (account.platform === 'instagram') {
      stats = await fetchInstagramAccountStats(account);
    }

    return {
      ...account,
      stats,
    };
  }));

  const facebookRowsNeedingSync = rows.filter((account) => {
    const linkedInstagram = account.stats?.linked_instagram;
    if (account.platform !== 'facebook' || !linkedInstagram?.id) return false;
    return !rows.some((other) => other.platform === 'instagram' && other.platform_user_id === linkedInstagram.id);
  });

  if (facebookRowsNeedingSync.length > 0) {
    await Promise.all(facebookRowsNeedingSync.map(async (account) => {
      const linkedInstagram = account.stats?.linked_instagram;
      if (!linkedInstagram?.id) return;
      try {
        await upsertSocialAccount({
          userId,
          platform: 'instagram',
          platformUserId: linkedInstagram.id,
          platformUsername: linkedInstagram.username || null,
          platformName: linkedInstagram.name || linkedInstagram.username || null,
          platformAvatarUrl: linkedInstagram.profile_picture_url || null,
          pageId: account.page_id || null,
          pageName: account.page_name || null,
          instagramAccountId: linkedInstagram.id,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          tokenExpiresAt: account.token_expires_at,
          tokenScope: account.token_scope,
        });
      } catch (err) {
        logger.warn('Failed to sync linked Instagram account', {
          userId,
          facebookAccountId: account.id,
          instagramAccountId: linkedInstagram.id,
          error: err.message,
        });
      }
    }));

    const refreshed = await query(
      `SELECT
         id, platform, platform_user_id, platform_username,
         platform_name, platform_avatar_url,
         page_id, page_name, instagram_account_id,
         is_active, last_used_at, last_error,
         token_expires_at,
         GREATEST(0, EXTRACT(DAY FROM (token_expires_at - NOW()))::INTEGER) AS token_days_remaining,
         CASE
           WHEN token_expires_at IS NULL THEN 'unknown'
           WHEN token_expires_at < NOW() THEN 'expired'
           WHEN token_expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
           ELSE 'valid'
         END AS token_status,
         created_at
       FROM social_accounts
       WHERE user_id = $1 AND is_active = true
       ORDER BY platform ASC, platform_name ASC`,
      [userId]
    );

    rows = await Promise.all(refreshed.rows.map(async (account) => {
      let stats = null;
      if (account.platform === 'facebook') {
        stats = await fetchFacebookPageStats(account);
      } else if (account.platform === 'instagram') {
        stats = await fetchInstagramAccountStats(account);
      }
      return { ...account, stats };
    }));
  }

  return rows;
};

const disconnectAccount = async (accountId, userId) => {
  const result = await query(
    `UPDATE social_accounts
     SET is_active = false
     WHERE id = $1 AND user_id = $2
     RETURNING id, platform, platform_name`,
    [accountId, userId]
  );
  if (!result.rows[0]) throw new AppError('Account not found', 404);
  return result.rows[0];
};

/**
 * Refresh a token if it's expiring within 7 days.
 */
const refreshTokenIfNeeded = async (account) => {
  if (!account.token_expires_at) return account;

  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt        = new Date(account.token_expires_at);

  if (expiresAt > sevenDaysFromNow) return account; // still fresh

  logger.info('Refreshing expiring token', {
    accountId: account.id,
    platform:  account.platform,
    expiresAt,
  });

  let newTokenData = null;

  if (account.platform === 'facebook' || account.platform === 'instagram') {
    newTokenData = await refreshFacebookToken(account);
  } else if (account.platform === 'youtube') {
    newTokenData = await refreshYouTubeToken(account);
  }

  if (!newTokenData) return account;

  await query(
    `UPDATE social_accounts
     SET access_token     = $1,
         token_expires_at = $2
     WHERE id = $3`,
    [newTokenData.access_token, newTokenData.token_expires_at, account.id]
  );

  return { ...account, ...newTokenData };
};

// ── Post Management ───────────────────────────────────────────────────────────

const createPost = async (userId, data) => {
  const targetPlatforms = normalizeTargetPlatforms(data.target_platforms);
  if (!targetPlatforms.length) throw new AppError('Choose at least one connected platform', 400);

  const result = await query(
    `INSERT INTO social_posts
       (user_id, title, caption, hashtags, mentions,
        content_type, target_platforms, publish_at,
        status, source_job_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      userId,
      data.title || null,
      data.caption || null,
      data.hashtags || [],
      data.mentions || [],
      data.content_type,
      targetPlatforms,
      data.publish_at || null,
      'draft',
      data.source_job_id || null,
      JSON.stringify(data.metadata || {}),
    ]
  );

  return normalizePostRow(result.rows[0]);
};

const addMediaToPost = async (postId, userId, mediaItems) => {
  const postResult = await query(
    `SELECT id, status
     FROM social_posts
     WHERE id = $1 AND user_id = $2`,
    [postId, userId]
  );
  const post = postResult.rows[0];
  if (!post) throw new AppError('Post not found', 404);
  if (!['draft', 'failed'].includes(post.status)) {
    throw new AppError(`Media cannot be added to a post with status: ${post.status}`, 409);
  }

  const values = mediaItems.map((m, i) => ({
    postId, userId,
    mediaUrl:     m.media_url,
    mediaType:    m.media_type,
    mimeType:     m.mime_type || null,
    fileSizeBytes: m.file_size_bytes || null,
    durationSecs: m.duration_seconds || null,
    width:        m.width || null,
    height:       m.height || null,
    thumbnailUrl: m.thumbnail_url || null,
    altText:      m.alt_text || null,
    sortOrder:    i,
  }));

  const inserted = [];
  for (const v of values) {
    const res = await query(
      `INSERT INTO social_post_media
         (post_id, user_id, media_url, media_type, mime_type,
          file_size_bytes, duration_seconds, width, height,
          thumbnail_url, alt_text, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        v.postId, v.userId, v.mediaUrl, v.mediaType, v.mimeType,
        v.fileSizeBytes, v.durationSecs, v.width, v.height,
        v.thumbnailUrl, v.altText, v.sortOrder,
      ]
    );
    inserted.push(res.rows[0]);
  }
  return inserted;
};

const getMintboxMediaLibrary = async (userId, baseUrl) => {
  const result = await query(
    `SELECT
       file.id,
       file.original_name,
       file.mime_type,
       file.size_bytes,
       file.file_category,
       file.created_at,
       file.share_token,
       job.id AS job_id,
       job.title AS job_title
     FROM mintbox_files file
     JOIN mintbox_folders folder ON folder.id = file.folder_id
     JOIN jobs job ON job.id = folder.job_id
     WHERE folder.client_id = $1
       AND file.deleted_by_client_at IS NULL
       AND file.share_revoked_at IS NULL
       AND (
         file.mime_type LIKE 'image/%'
         OR file.mime_type LIKE 'video/%'
       )
     ORDER BY file.created_at DESC
     LIMIT 100`,
    [userId]
  );

  return result.rows.map((file) => ({
    ...file,
    media_type: file.mime_type.startsWith('video/') ? 'video' : 'image',
    media_url: `${baseUrl}/api/v1/mintbox/public/files/${file.share_token}/content`,
  }));
};

/**
 * Publish a post immediately or schedule it.
 * Creates per-platform status rows and enqueues BullMQ job.
 */
const publishPost = async (postId, userId) => {
  const postResult = await query(
    'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
    [postId, userId]
  );
  const post = postResult.rows[0];
  if (!post) throw new AppError('Post not found', 404);
  if (!['draft', 'failed'].includes(post.status)) {
    throw new AppError(`Post cannot be published from status: ${post.status}`, 400);
  }

  const targetPlatforms = normalizeTargetPlatforms(post.target_platforms);
  if (!targetPlatforms.length) throw new AppError('Choose at least one platform before publishing', 400);

  // Create per-platform status rows
  for (const platform of targetPlatforms) {
    // Find user's connected account for this platform
    const accountResult = await query(
      `SELECT id FROM social_accounts
       WHERE user_id = $1 AND platform = $2 AND is_active = true
       LIMIT 1`,
      [userId, platform]
    );

    const account = accountResult.rows[0];
    if (!account) {
      throw new AppError(`Connect a ${platform} account before publishing there`, 400);
    }

    await query(
      `INSERT INTO social_post_platforms
         (post_id, social_account_id, platform, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (post_id, platform) DO UPDATE SET status = 'pending'`,
      [postId, account.id, platform]
    );
  }

  const isScheduled = post.publish_at && new Date(post.publish_at) > new Date();
  const newStatus   = isScheduled ? 'scheduled' : 'publishing';

  const queueJobId = await schedulePost(postId, post.publish_at);

  await query(
    `UPDATE social_posts
     SET status = $1, queue_job_id = $2
     WHERE id = $3`,
    [newStatus, queueJobId.toString(), postId]
  );

  logger.info('Post queued for publishing', { postId, isScheduled, queueJobId });
  return { postId, status: newStatus, queue_job_id: queueJobId };
};

/**
 * The actual publish execution — called by BullMQ worker.
 * Publishes to ALL target platforms in parallel.
 */
const executePublish = async (postId) => {
  const postResult = await query(
    `SELECT sp.*, 
       array_agg(
         json_build_object(
           'media_url', spm.media_url,
           'media_type', spm.media_type,
           'mime_type', spm.mime_type,
           'duration_seconds', spm.duration_seconds,
           'width', spm.width,
           'height', spm.height,
           'thumbnail_url', spm.thumbnail_url,
           'alt_text', spm.alt_text
         ) ORDER BY spm.sort_order
       ) FILTER (WHERE spm.id IS NOT NULL) AS media
     FROM social_posts sp
     LEFT JOIN social_post_media spm ON spm.post_id = sp.id
     WHERE sp.id = $1
     GROUP BY sp.id`,
    [postId]
  );

  const post = postResult.rows[0];
  if (!post) throw new Error(`Post ${postId} not found`);

  const media = post.media || [];

  // Get all retryable per-platform rows.
  // BullMQ retries the same job, so previously failed rows need to be picked up again
  // instead of being stranded in a terminal state that future attempts ignore.
  const platformsResult = await query(
    `SELECT spp.*, sa.*,
       spp.id AS platform_row_id
     FROM social_post_platforms spp
     JOIN social_accounts sa ON sa.id = spp.social_account_id
     WHERE spp.post_id = $1 AND spp.status IN ('pending', 'failed')`,
    [postId]
  );

  const platforms = platformsResult.rows;
  const platformRowIds = platforms.map((platformRow) => platformRow.platform_row_id);

  if (platforms.length === 0) {
    const existingRows = await query(
      `SELECT COUNT(*)::INT AS count
       FROM social_post_platforms
       WHERE post_id = $1`,
      [postId]
    );

    const rowCount = existingRows.rows[0]?.count || 0;
    if (rowCount === 0) {
      throw new Error(`No social platform rows found for post ${postId}`);
    }

    logger.info('executePublish skipped - no retryable platform rows found', {
      postId,
      rowCount,
    });
    return;
  }

  // Mark all as 'publishing'
  await query(
    `UPDATE social_post_platforms
     SET status = 'publishing'
     WHERE id = ANY($1::uuid[])`,
    [platformRowIds]
  );

  // Publish to each platform in parallel
  const results = await Promise.allSettled(
    platforms.map(async (platformRow) => {
      // 1. Refresh token if expiring
      const account = await refreshTokenIfNeeded(platformRow);

      // 2. Pre-flight validation
      if (platformRow.platform === 'facebook') {
        const { validatePageToken, validatePageAccess } = require('./publishers/facebook.publisher');

        const tokenCheck = await validatePageToken(account);
        if (!tokenCheck.valid) {
          const shouldDeactivate = tokenCheck.code === 190
            || tokenCheck.code === 200
            || /expired|invalid|revoked/i.test(String(tokenCheck.reason || ''));

          await query(
            `UPDATE social_accounts
             SET last_error = $1${shouldDeactivate ? ', is_active = false' : ''}
             WHERE id = $2`,
            [tokenCheck.reason, account.id]
          );
          throw new Error(`Facebook validation failed: ${tokenCheck.reason}`);
        }

        const pageCheck = await validatePageAccess(account.page_id, account.access_token);
        if (!pageCheck.accessible) {
          await query(
            `UPDATE social_accounts SET is_active = false, last_error = $1 WHERE id = $2`,
            [pageCheck.reason, account.id]
          );
          throw new Error(`Facebook page inaccessible: ${pageCheck.reason}`);
        }
      }

      if (platformRow.platform === 'instagram') {
        const { validateIGAccount } = require('./publishers/instagram.publisher');
        const igCheck = await validateIGAccount(account);
        if (!igCheck.valid) {
          await query(
            `UPDATE social_accounts SET last_error = $1 WHERE id = $2`,
            [igCheck.reason, account.id]
          );
          throw new Error(`Instagram validation failed: ${igCheck.reason}`);
        }
      }

      // 3. Publish with rate limit retry
      const { withRateLimitRetry } = require('./publishers/facebook.publisher');

      let result;
      switch (platformRow.platform) {
        case 'facebook':
          result = await withRateLimitRetry(() => publishToFacebook(account, post, media));
          break;
        case 'instagram':
          result = await withRateLimitRetry(() => publishToInstagram(account, post, media));
          break;
        case 'youtube':
          result = await publishToYouTube(account, post, media);
          break;
        default:
          throw new Error(`Unknown platform: ${platformRow.platform}`);
      }

      // 4. Mark published
      await query(
        `UPDATE social_post_platforms
         SET status            = 'published',
             platform_post_id  = $1,
             platform_post_url = $2,
             published_at      = NOW(),
             error_message     = NULL
         WHERE id = $3`,
        [result.platform_post_id, result.platform_post_url, platformRow.platform_row_id]
      );

      await query(
        'UPDATE social_accounts SET last_used_at = NOW(), last_error = NULL WHERE id = $1',
        [platformRow.id]
      );

      return { platform: platformRow.platform, success: true, ...result };
    })
  );

  // Assess overall post status
  const allSuccess = results.every((r) => r.status === 'fulfilled');
  const allFailed  = results.every((r) => r.status === 'rejected');
  const failureReasons = [];

  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      const platform = platforms[i].platform;
      const reason = result.reason?.message || 'Unknown error';
      failureReasons.push({ platform, reason });

      await query(
        `UPDATE social_post_platforms
         SET status        = 'failed',
             error_message = $1,
             retry_count   = retry_count + 1,
             last_retry_at = NOW()
         WHERE id = $2`,
        [reason, platforms[i].platform_row_id]
      );
    }
  }

  const finalStatus = allFailed ? 'failed' : 'published';
  await query(
    `UPDATE social_posts
     SET status       = $1,
         published_at = $2
     WHERE id = $3`,
    [finalStatus, allSuccess ? new Date() : null, postId]
  );

  logger.info('executePublish complete', {
    postId,
    finalStatus,
    results: results.map((r, i) => ({
      platform: platforms[i]?.platform,
      success:  r.status === 'fulfilled',
    })),
    failureReasons,
  });

  if (allFailed) {
    const detail = failureReasons.length
      ? `: ${failureReasons.map((item) => `${item.platform} -> ${item.reason}`).join(' | ')}`
      : '';
    throw new Error(`All platform publishes failed${detail}`);
  }
};

const cancelPost = async (postId, userId) => {
  const result = await query(
    'SELECT * FROM social_posts WHERE id = $1 AND user_id = $2',
    [postId, userId]
  );
  const post = result.rows[0];
  if (!post) throw new AppError('Post not found', 404);

  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new AppError(`Cannot cancel a post with status: ${post.status}`, 400);
  }

  if (post.queue_job_id) {
    await cancelScheduledPost(post.queue_job_id);
  }

  await query(
    `UPDATE social_posts SET status = 'cancelled' WHERE id = $1`,
    [postId]
  );

  return { postId, status: 'cancelled' };
};

const getMyPosts = async (userId, { page = 1, limit = 20, status, platform } = {}) => {
  const offset = (page - 1) * limit;
  const params = [userId];
  const conditions = [];

  if (status) {
    params.push(status);
    conditions.push(`sp.status = $${params.length}`);
  }

  const whereExtra = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
       sp.*,
       array_agg(
         json_build_object(
           'platform', spp.platform,
           'status', spp.status,
           'platform_post_url', spp.platform_post_url,
           'error_message', spp.error_message,
           'published_at', spp.published_at
         )
       ) FILTER (WHERE spp.id IS NOT NULL) AS platform_statuses
     FROM social_posts sp
     LEFT JOIN social_post_platforms spp ON spp.post_id = sp.id
     WHERE sp.user_id = $1 ${whereExtra}
     GROUP BY sp.id
     ORDER BY sp.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM social_posts sp WHERE sp.user_id = $1 ${whereExtra}`,
    params
  );

  return {
    posts: result.rows.map(normalizePostRow),
    pagination: {
      page, limit,
      total: parseInt(countResult.rows[0].count, 10),
      pages: Math.ceil(countResult.rows[0].count / limit),
    },
  };
};

const getPostById = async (postId, userId, role) => {
  const result = await query(
    `SELECT
       sp.*,
       array_agg(
         json_build_object(
           'platform', spp.platform,
           'status', spp.status,
           'platform_post_id', spp.platform_post_id,
           'platform_post_url', spp.platform_post_url,
           'error_message', spp.error_message,
           'views_count', spp.views_count,
           'likes_count', spp.likes_count,
           'published_at', spp.published_at
         )
       ) FILTER (WHERE spp.id IS NOT NULL) AS platform_statuses,
       array_agg(
         json_build_object(
           'media_url', spm.media_url,
           'media_type', spm.media_type,
           'sort_order', spm.sort_order
         ) ORDER BY spm.sort_order
       ) FILTER (WHERE spm.id IS NOT NULL) AS media
     FROM social_posts sp
     LEFT JOIN social_post_platforms spp ON spp.post_id = sp.id
     LEFT JOIN social_post_media spm ON spm.post_id = sp.id
     WHERE sp.id = $1
     GROUP BY sp.id`,
    [postId]
  );

  const post = result.rows[0];
  if (!post) throw new AppError('Post not found', 404);

  if (role !== 'admin' && post.user_id !== userId) {
    throw new AppError('Post not found', 404);
  }

  return normalizePostRow(post);
};

// ── Analytics ─────────────────────────────────────────────────────────────────

const pullAnalytics = async (postId, userId) => {
  const platformsResult = await query(
    `SELECT spp.*, sa.access_token, sa.refresh_token,
            sa.instagram_account_id, sa.page_id, sa.platform AS acc_platform
     FROM social_post_platforms spp
     JOIN social_accounts sa ON sa.id = spp.social_account_id
     WHERE spp.post_id = $1 AND spp.status = 'published'`,
    [postId]
  );

  const updated = [];

  for (const row of platformsResult.rows) {
    let analytics = null;

    if (row.platform === 'facebook') {
      analytics = await getFacebookAnalytics(row, row.platform_post_id);
    } else if (row.platform === 'instagram') {
      analytics = await getInstagramAnalytics(row, row.platform_post_id);
    } else if (row.platform === 'youtube') {
      analytics = await getYouTubeAnalytics(row, row.platform_post_id);
    }

    if (analytics) {
      await query(
        `UPDATE social_post_platforms
         SET views_count         = $1,
             likes_count         = $2,
             comments_count      = $3,
             shares_count        = $4,
             reach_count         = $5,
             analytics_pulled_at = NOW()
         WHERE id = $6`,
        [
          analytics.views_count,
          analytics.likes_count,
          analytics.comments_count,
          analytics.shares_count,
          analytics.reach_count,
          row.id,
        ]
      );
      updated.push({ platform: row.platform, analytics });
    }
  }

  return updated;
};

const getAnalyticsSummary = async (userId, requestedDays = null) => {
  const benchmarks = await getSetting('social_benchmarks', {
    engagement_rate_percent: 3,
    summary_days: 30,
  });
  const days = Math.min(Math.max(Number(requestedDays || benchmarks.summary_days || 30), 7), 365);
  const result = await query(
    `SELECT
       COUNT(DISTINCT sp.id) FILTER (
         WHERE spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL
       ) AS posts,
       COALESCE(SUM(spp.views_count) FILTER (
         WHERE spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL
       ), 0) AS views,
       COALESCE(SUM(spp.reach_count) FILTER (
         WHERE spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL
       ), 0) AS reach,
       COALESCE(SUM(spp.likes_count + spp.comments_count + spp.shares_count) FILTER (
         WHERE spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL
       ), 0) AS engagements,
       COALESCE(SUM(spp.views_count) FILTER (
         WHERE spp.published_at < NOW() - ($2::TEXT || ' days')::INTERVAL
           AND spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL * 2
       ), 0) AS previous_views,
       COALESCE(SUM(spp.reach_count) FILTER (
         WHERE spp.published_at < NOW() - ($2::TEXT || ' days')::INTERVAL
           AND spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL * 2
       ), 0) AS previous_reach,
       COALESCE(SUM(spp.likes_count + spp.comments_count + spp.shares_count) FILTER (
         WHERE spp.published_at < NOW() - ($2::TEXT || ' days')::INTERVAL
           AND spp.published_at >= NOW() - ($2::TEXT || ' days')::INTERVAL * 2
       ), 0) AS previous_engagements
     FROM social_posts sp
     JOIN social_post_platforms spp ON spp.post_id = sp.id
     WHERE sp.user_id = $1 AND spp.status = 'published'`,
    [userId, days]
  );
  const row = result.rows[0];
  const reach = Number(row.reach);
  const views = Number(row.views);
  const engagements = Number(row.engagements);
  const denominator = reach || views;
  const engagementRate = denominator > 0 ? (engagements / denominator) * 100 : 0;
  const benchmark = Number(benchmarks.engagement_rate_percent || 3);
  const compare = (current, previous) => previous > 0
    ? Math.round(((current - previous) / previous) * 1000) / 10
    : null;

  return {
    period_days: days,
    posts: Number(row.posts),
    views,
    reach,
    engagements,
    engagement_rate_percent: Math.round(engagementRate * 10) / 10,
    benchmark_engagement_rate_percent: benchmark,
    comparison: {
      views_percent: compare(views, Number(row.previous_views)),
      reach_percent: compare(reach, Number(row.previous_reach)),
      engagements_percent: compare(engagements, Number(row.previous_engagements)),
    },
    insight: denominator === 0
      ? 'Publish content and refresh post analytics to see performance guidance.'
      : engagementRate >= benchmark
        ? `Your engagement rate is above the ${benchmark}% platform benchmark.`
        : `Your engagement rate is below the ${benchmark}% platform benchmark. Try clearer calls to action and test a new format.`,
  };
};

module.exports = {
  getOAuthUrl,
  handleOAuthCallback,
  getMyAccounts,
  disconnectAccount,
  createPost,
  addMediaToPost,
  getMintboxMediaLibrary,
  publishPost,
  executePublish,
  cancelPost,
  getMyPosts,
  getPostById,
  pullAnalytics,
  getAnalyticsSummary,
};
