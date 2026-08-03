const { query, getClient }   = require('../../config/database');
const { schedulePost, cancelScheduledPost } = require('./queue/publish.queue');
const { publishToFacebook, getFacebookAnalytics, refreshFacebookToken } = require('./publishers/facebook.publisher');
const { publishToInstagram, getInstagramAnalytics } = require('./publishers/instagram.publisher');
const { publishToYouTube, getYouTubeAnalytics, refreshYouTubeToken } = require('./publishers/youtube.publisher');
const { publishToGoogleBusinessProfile, refreshGBPToken } = require('./publishers/google-business-profile.publisher');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const env      = require('../../config/env');
const axios    = require('axios');
const { getSetting } = require('../commerce/settings.service');

const FB_API = 'https://graph.facebook.com/v19.0';
const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'youtube', 'google_business_profile'];
const META_REQUIRED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
];
const META_REQUESTED_SCOPES = [...META_REQUIRED_SCOPES, 'public_profile'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const inferContentTypeFromMedia = (currentType, mediaItems = []) => {
  const normalizedType = String(currentType || '').toLowerCase();
  const items = Array.isArray(mediaItems) ? mediaItems.filter(Boolean) : [];
  const mediaTypes = items.map((item) => String(item.media_type || '').toLowerCase());

  if (normalizedType === 'carousel' || items.length > 1) {
    return 'carousel';
  }
  if (normalizedType === 'reel' || normalizedType === 'short') {
    return normalizedType;
  }
  if (mediaTypes.includes('video')) {
    return 'video';
  }
  if (items.length === 1) {
    return mediaTypes[0] === 'video' ? 'video' : 'image';
  }
  return normalizedType || 'text';
};

const resolveFacebookPageAccessToken = async (pageId, candidateToken) => {
  if (!pageId || !candidateToken) return candidateToken || null;

  try {
    const tokenRes = await axios.get(`${FB_API}/${pageId}`, {
      params: {
        fields: 'access_token',
        access_token: candidateToken,
      },
    });

    return tokenRes.data?.access_token || candidateToken;
  } catch (err) {
    logger.debug('Facebook page access token lookup skipped', {
      pageId,
      error: err.message,
    });
    return candidateToken;
  }
};

const deleteRemotePublishedPost = async (platformRow) => {
  if (!platformRow?.platform_post_id) return;

  const accessToken =
    platformRow.platform === 'facebook'
      ? await resolveFacebookPageAccessToken(platformRow.page_id, platformRow.access_token)
      : platformRow.access_token;

  if (!accessToken) {
    throw new Error(`Missing access token for ${platformRow.platform} delete`);
  }

  if (platformRow.platform === 'facebook' || platformRow.platform === 'instagram') {
    const candidateIds = [platformRow.platform_post_id];

    if (platformRow.platform === 'facebook') {
      try {
        const nodeRes = await axios.get(`${FB_API}/${platformRow.platform_post_id}`, {
          params: {
            fields: 'id,post_id,permalink_url',
            access_token: accessToken,
          },
        });
        const node = nodeRes.data || {};
        if (node.post_id && node.post_id !== platformRow.platform_post_id) {
          candidateIds.unshift(node.post_id);
        }
        if (node.id && node.id !== platformRow.platform_post_id) {
          candidateIds.unshift(node.id);
        }
      } catch (lookupErr) {
        logger.debug('Facebook delete target lookup skipped', {
          pageId: platformRow.page_id,
          platformPostId: platformRow.platform_post_id,
          error: lookupErr.message,
        });
      }
    }

    let lastError = null;
    for (const candidateId of [...new Set(candidateIds.filter(Boolean))]) {
      try {
        await axios.delete(`${FB_API}/${candidateId}`, {
          params: { access_token: accessToken },
        });
        return;
      } catch (err) {
        lastError = err;
        const metaCode = err.response?.data?.error?.code;
        if (platformRow.platform !== 'facebook' || metaCode !== 100) {
          break;
        }
      }
    }

    const metaMessage = lastError?.response?.data?.error?.message || lastError?.message || 'Unknown delete error';
    const metaCode = lastError?.response?.data?.error?.code;
    throw new Error(`Meta delete failed (${metaCode || 'no-code'}): ${metaMessage}`);
  }

  logger.warn('Remote delete skipped for unsupported platform', {
    platform: platformRow.platform,
    platformPostId: platformRow.platform_post_id,
  });
};

const fetchFacebookPageDetails = async (account) => {
  if (!account.page_id) return null;

  const pageAccessToken = await resolveFacebookPageAccessToken(
    account.page_id,
    account.access_token
  );

  const pageRes = await axios.get(`${FB_API}/${account.page_id}`, {
    params: {
      fields: 'id,name,fan_count,followers_count,posts.limit(1).summary(true)',
      access_token: pageAccessToken,
    },
  });

  const page = pageRes.data || {};
  const fanCount = safeNumber(page.fan_count, 0) || 0;
  const followersCount = safeNumber(page.followers_count, fanCount) || fanCount;
  const postsCount = safeNumber(page.posts?.summary?.total_count, null);
  const insightsAvailable = fanCount >= 100;

  let linkedInstagram = null;
  let linkedInstagramId = null;
  try {
    const igLinkRes = await axios.get(`${FB_API}/${account.page_id}`, {
      params: {
        fields: 'instagram_business_account',
        access_token: pageAccessToken,
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
          access_token: pageAccessToken,
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
    pageAccessToken,
    page,
    stats: {
      insights_available: insightsAvailable,
      insights_reason: insightsAvailable ? null : 'min_100_followers_required',
      followers_count: followersCount,
      page_likes_count: fanCount,
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
    },
  };
};

const fetchFacebookPageStats = async (account) => {
  try {
    const details = await fetchFacebookPageDetails(account);
    return details?.stats || null;
  } catch (err) {
    logger.debug('Facebook account stats fetch unavailable', {
      accountId: account.id,
      pageId: account.page_id,
      error: err.message,
    });
    return {
      insights_available: false,
      insights_reason: 'unavailable',
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

  if (platform === 'google_business_profile') {
    const params = new URLSearchParams({
      client_id:     env.social.googleBusinessProfile.clientId,
      redirect_uri:  env.social.googleBusinessProfile.redirectUri,
      scope:         'https://www.googleapis.com/auth/business.manage',
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

  if (platform === 'google_business_profile') {
    return handleGoogleBusinessProfileCallback(userId, code);
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
    const pageAccessToken = await resolveFacebookPageAccessToken(page.id, page.access_token || longToken);

    // Get Instagram Business Account linked to this page
    let igAccountId = null;
    try {
      const igRes = await axios.get(`${FB_API}/${page.id}`, {
        params: {
          fields:       'instagram_business_account',
          access_token: pageAccessToken,
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
      accessToken:        pageAccessToken,  // page-level token
      tokenExpiresAt:     expiresAt,
      tokenScope:         META_REQUESTED_SCOPES.join(','),
      instagramAccountId: igAccountId,
    });
    savedAccounts.push(fbAccount);

    try {
      await importHistoricalFacebookPosts(userId, fbAccount, pageAccessToken);
    } catch (importErr) {
      logger.warn('Historical Facebook post import skipped during OAuth callback', {
        userId,
        accountId: fbAccount.id,
        pageId: page.id,
        error: importErr.message,
      });
    }

    // Save Instagram account if linked
    if (igAccountId) {
      const igInfoRes = await axios.get(`${FB_API}/${igAccountId}`, {
        params: {
          fields:       'id,name,username,profile_picture_url',
          access_token: pageAccessToken,
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
        accessToken:        pageAccessToken,
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

const handleGoogleBusinessProfileCallback = async (userId, code) => {
  const { google } = require('googleapis');
  const auth = new google.auth.OAuth2(
    env.social.googleBusinessProfile.clientId,
    env.social.googleBusinessProfile.clientSecret,
    env.social.googleBusinessProfile.redirectUri
  );

  const { tokens } = await auth.getToken(code);
  auth.setCredentials(tokens);

  // Retrieve accounts
  let accountsList = [];
  try {
    const accResponse = await axios.get('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    accountsList = accResponse.data.accounts || [];
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('Google Business Profile fetch accounts failed', { error: msg });
    throw new AppError(`Google Business Profile error: ${msg}`, 400);
  }

  if (accountsList.length === 0) {
    throw new AppError('No Google Business Accounts found', 404);
  }

  const savedAccounts = [];

  for (const businessAcc of accountsList) {
    try {
      const locResponse = await axios.get(`https://mybusinessbusinessinformation.googleapis.com/v1/${businessAcc.name}/locations`, {
        params: { readMask: 'name,title,storefrontAddress' },
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      
      const locations = locResponse.data.locations || [];
      for (const loc of locations) {
        const account = await upsertSocialAccount({
          userId,
          platform:          'google_business_profile',
          platformUserId:    loc.name,
          platformName:      loc.title,
          platformAvatarUrl: null,
          accessToken:       tokens.access_token,
          refreshToken:      tokens.refresh_token,
          tokenExpiresAt:    new Date(tokens.expiry_date),
          tokenScope:        tokens.scope,
        });
        savedAccounts.push(account);
      }
    } catch (err) {
      logger.warn('Google Business Profile fetch locations failed for account', {
        accountName: businessAcc.name,
        error:       err.response?.data?.error?.message || err.message,
      });
    }
  }

  if (savedAccounts.length === 0) {
    throw new AppError('No Google Business Profile locations found for this account. Create one inside Google Business Profile Manager first.', 404);
  }

  logger.info('Google Business Profile OAuth completed', { userId, locationsConnected: savedAccounts.length });
  return savedAccounts;
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

const buildConnectedAccountsQuery = (userId) => query(
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

const importHistoricalFacebookPosts = async (userId, account, pageAccessToken) => {
  if (!account?.page_id || !pageAccessToken) return 0;

  const sinceUnix = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);
  const result = await axios.get(`${FB_API}/${account.page_id}/posts`, {
    params: {
      fields: 'id,message,story,created_time,permalink_url,full_picture,type',
      since: sinceUnix,
      limit: 100,
      access_token: pageAccessToken,
    },
  });

  const posts = result.data?.data || [];
  let imported = 0;

  for (const fbPost of posts) {
    const existing = await query(
      `SELECT sp.id
       FROM social_posts sp
       JOIN social_post_platforms spp ON spp.post_id = sp.id
       WHERE sp.user_id = $1
         AND spp.platform = 'facebook'
         AND spp.platform_post_id = $2
       LIMIT 1`,
      [userId, fbPost.id]
    );

    if (existing.rows[0]) continue;

    const message = String(fbPost.message || fbPost.story || '').trim();
    const caption = message || 'Imported Facebook post';
    const createdAt = fbPost.created_time ? new Date(fbPost.created_time) : new Date();
    const contentType = fbPost.type === 'video'
      ? 'video'
      : fbPost.type === 'photo' || fbPost.full_picture
        ? 'image'
        : 'text';

    const postResult = await query(
      `INSERT INTO social_posts
         (user_id, title, caption, hashtags, mentions,
          content_type, target_platforms, publish_at,
          status, source_job_id, metadata, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        userId,
        fbPost.story || fbPost.message?.slice(0, 80) || 'Imported Facebook post',
        caption,
        [],
        [],
        contentType,
        ['facebook'],
        createdAt,
        'published',
        null,
        JSON.stringify({
          source: 'historical_import',
          source_platform: 'facebook',
          source_external_id: fbPost.id,
          source_page_id: account.page_id,
          source_page_name: account.page_name || null,
        }),
        createdAt,
      ]
    );

    const postId = postResult.rows[0].id;

    await query(
      `INSERT INTO social_post_platforms
         (post_id, social_account_id, platform, status, platform_post_id,
          platform_post_url, platform_title, platform_description,
          published_at, source)
       VALUES ($1,$2,'facebook','published',$3,$4,$5,$6,$7,'historical_import')`,
      [
        postId,
        account.id,
        fbPost.id,
        fbPost.permalink_url || `https://www.facebook.com/${fbPost.id}`,
        fbPost.story || fbPost.message?.slice(0, 120) || null,
        message || null,
        createdAt,
      ]
    );

    if (fbPost.full_picture) {
      await query(
        `INSERT INTO social_post_media
           (post_id, user_id, media_url, media_type, mime_type, sort_order)
         VALUES ($1,$2,$3,'image','image/jpeg',0)`,
        [postId, userId, fbPost.full_picture]
      );
    }

    imported += 1;
  }

  logger.info(`Historical import completed: ${imported} posts fetched`, {
    userId,
    pageId: account.page_id,
    imported,
  });

  return imported;
};

const hydrateConnectedAccounts = async (userId, { importHistoricalPosts = false } = {}) => {
  const result = await buildConnectedAccountsQuery(userId);

  let rows = await Promise.all(result.rows.map(async (account) => {
    let stats = null;

    if (account.platform === 'facebook') {
      try {
        const details = await fetchFacebookPageDetails(account);
        stats = details?.stats || null;

        if (importHistoricalPosts && details?.pageAccessToken) {
          try {
            await importHistoricalFacebookPosts(userId, account, details.pageAccessToken);
          } catch (importErr) {
            logger.warn('Historical Facebook post import skipped', {
              userId,
              accountId: account.id,
              pageId: account.page_id,
              error: importErr.message,
            });
          }
        }
      } catch (err) {
        logger.warn('Facebook account hydration skipped', {
          userId,
          accountId: account.id,
          pageId: account.page_id,
          error: err.message,
        });
        stats = {
          insights_available: false,
          insights_reason: 'unavailable',
          followers_count: null,
          page_likes_count: null,
          posts_count: null,
          linked_instagram: null,
        };
      }
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

    const refreshed = await buildConnectedAccountsQuery(userId);
    rows = await Promise.all(refreshed.rows.map(async (account) => {
      let stats = null;
      if (account.platform === 'facebook') {
        try {
          const details = await fetchFacebookPageDetails(account);
          stats = details?.stats || null;
        } catch (err) {
          logger.warn('Facebook account refresh hydration skipped', {
            userId,
            accountId: account.id,
            pageId: account.page_id,
            error: err.message,
          });
          stats = {
            insights_available: false,
            insights_reason: 'unavailable',
            followers_count: null,
            page_likes_count: null,
            posts_count: null,
            linked_instagram: null,
          };
        }
      } else if (account.platform === 'instagram') {
        stats = await fetchInstagramAccountStats(account);
      }
      return { ...account, stats };
    }));
  }

  return rows;
};

const getMyAccounts = async (userId) => hydrateConnectedAccounts(userId);

const refreshAccountsFromMeta = async (userId) => hydrateConnectedAccounts(userId, { importHistoricalPosts: true });

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
const refreshTokenIfNeeded = async (account, thresholdDays = 7) => {
  if (!account.token_expires_at) return account;

  const thresholdDate = new Date(Date.now() + thresholdDays * 24 * 60 * 60 * 1000);
  const expiresAt        = new Date(account.token_expires_at);

  if (expiresAt > thresholdDate) return account; // still fresh

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
  } else if (account.platform === 'google_business_profile') {
    newTokenData = await refreshGBPToken(account);
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
    `SELECT id, status, content_type
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

  const inferredType = inferContentTypeFromMedia(post.content_type, inserted.map((item) => ({
    media_type: item.media_type,
  })));

  if (inferredType && inferredType !== post.content_type) {
    await query(
      `UPDATE social_posts
       SET content_type = $1
       WHERE id = $2 AND user_id = $3`,
      [inferredType, postId, userId]
    );
  }

  return inserted;
};

const updatePost = async (postId, userId, data) => {
  const result = await query(
    `SELECT * FROM social_posts WHERE id = $1 AND user_id = $2`,
    [postId, userId]
  );
  const post = result.rows[0];
  if (!post) throw new AppError('Post not found', 404);

  if (!['draft', 'failed', 'scheduled'].includes(post.status)) {
    throw new AppError(`Post cannot be edited from status: ${post.status}`, 400);
  }

  const targetPlatforms = normalizeTargetPlatforms(data.target_platforms || post.target_platforms);
  if (!targetPlatforms.length) {
    throw new AppError('Choose at least one connected platform', 400);
  }

  if (post.queue_job_id && ['scheduled', 'draft'].includes(post.status)) {
    await cancelScheduledPost(post.queue_job_id);
  }

  await query(
    `UPDATE social_posts
     SET title = $1,
         caption = $2,
         hashtags = $3,
         mentions = $4,
         content_type = $5,
         target_platforms = $6,
         publish_at = $7,
         status = 'draft',
         queue_job_id = NULL,
         metadata = COALESCE($8::jsonb, metadata)
     WHERE id = $9 AND user_id = $10`,
    [
      data.title ?? post.title ?? null,
      data.caption ?? post.caption ?? null,
      data.hashtags ?? post.hashtags ?? [],
      data.mentions ?? post.mentions ?? [],
      data.content_type ?? post.content_type ?? 'text',
      targetPlatforms,
      data.publish_at || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      postId,
      userId,
    ]
  );

  await query(
    `DELETE FROM social_post_platforms WHERE post_id = $1`,
    [postId]
  );

  return normalizePostRow((await query('SELECT * FROM social_posts WHERE id = $1', [postId])).rows[0]);
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
  const targetAccounts = Array.isArray(post.metadata?.target_accounts)
    ? post.metadata.target_accounts.filter(Boolean)
    : [];

  let publishTargets = [];

  if (targetAccounts.length > 0) {
    const accountResult = await query(
      `SELECT id, platform
       FROM social_accounts
       WHERE user_id = $1
         AND is_active = true
         AND id = ANY($2::uuid[])`,
      [userId, targetAccounts]
    );

    publishTargets = accountResult.rows;

    if (publishTargets.length !== targetAccounts.length) {
      const foundIds = new Set(publishTargets.map((row) => row.id));
      const missing = targetAccounts.filter((id) => !foundIds.has(id));
      throw new AppError(`One or more selected accounts are unavailable: ${missing.join(', ')}`, 400);
    }
  } else {
    if (!targetPlatforms.length) throw new AppError('Choose at least one platform before publishing', 400);

    for (const platform of targetPlatforms) {
      const accountResult = await query(
        `SELECT id, platform FROM social_accounts
         WHERE user_id = $1 AND platform = $2 AND is_active = true
         ORDER BY last_used_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [userId, platform]
      );

      const account = accountResult.rows[0];
      if (!account) {
        throw new AppError(`Connect a ${platform} account before publishing there`, 400);
      }
      publishTargets.push(account);
    }
  }

  if (!publishTargets.length) {
    throw new AppError('Choose at least one connected account before publishing', 400);
  }

  // YouTube safety validation
  const hasYouTube = publishTargets.some(t => t.platform === 'youtube');
  if (hasYouTube) {
    if (!post.title || !post.title.trim()) {
      throw new AppError('A video title is required for YouTube uploads', 400);
    }
    const mediaResult = await query(
      `SELECT * FROM social_post_media WHERE post_id = $1`,
      [postId]
    );
    const videos = mediaResult.rows.filter(m => m.media_type === 'video');
    const images = mediaResult.rows.filter(m => m.media_type === 'image');
    if (videos.length !== 1 || images.length > 0) {
      throw new AppError('YouTube uploading requires exactly one video (no images allowed)', 400);
    }
  }

  // Google Business Profile safety validation
  const hasGBP = publishTargets.some(t => t.platform === 'google_business_profile');
  if (hasGBP) {
    const mediaResult = await query(
      `SELECT * FROM social_post_media WHERE post_id = $1`,
      [postId]
    );
    if (mediaResult.rows.length > 1) {
      throw new AppError('Google Business Profile only supports a single image or video per post (carousels are not supported)', 400);
    }
  }

  // Create per-account status rows
  for (const account of publishTargets) {
    await query(
      `INSERT INTO social_post_platforms
         (post_id, social_account_id, platform, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (post_id, social_account_id) DO UPDATE SET
         status = 'pending'`,
      [postId, account.id, account.platform]
    );
  }

  const isScheduled = post.publish_at && new Date(post.publish_at) > new Date();

  // Check if Redis is connected
  let redisConnected = false;
  try {
    const { getRedisCircuitState } = require('../../config/redis');
    const state = getRedisCircuitState();
    if (!state.open) {
      const { getRedis } = require('../../config/redis');
      redisConnected = !!getRedis();
    }
  } catch {
    redisConnected = false;
  }

  if (isScheduled && !redisConnected) {
    throw new AppError('Redis is temporarily unavailable. Future post scheduling requires Redis.', 503);
  }

  if (!isScheduled && !redisConnected) {
    logger.warn('Redis unavailable - executing immediate social publish in-process', { postId });
    await query(
      `UPDATE social_posts
       SET status = 'publishing', queue_job_id = NULL
       WHERE id = $1`,
      [postId]
    );

    // Execute immediately in background process so API call returns immediately
    executePublish(postId).catch((err) => {
      logger.error('In-process immediate publish failed', { postId, error: err.message });
    });

    return { postId, status: 'publishing', queue_job_id: null };
  }

  const newStatus   = isScheduled ? 'scheduled' : 'publishing';
  const queueJobId = await schedulePost(postId, post.publish_at);

  await query(
    `UPDATE social_posts
     SET status = $1, queue_job_id = $2
     WHERE id = $3`,
    [newStatus, queueJobId ? queueJobId.toString() : null, postId]
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
           'id', spm.id,
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

  // Resolve any internal Mintbox proxy URLs to direct Supabase signed URLs for publishers
  // This bypasses the Node.js proxy and allows Facebook/Instagram to download long videos directly
  // with full chunked/range request support.
  for (const m of media) {
    if (m.media_url && m.media_url.includes('/api/v1/mintbox/public/files/')) {
      const match = m.media_url.match(/\/api\/v1\/mintbox\/public\/files\/([^\/]+)\/content/);
      if (match) {
        const token = match[1];
        try {
          const { getPublicFileStream } = require('../mintbox/mintbox.service');
          // Give Facebook 24 hours to crawl the video
          const { signedUrl } = await getPublicFileStream(token, 24 * 60 * 60);
          if (signedUrl) {
            m.media_url = signedUrl;
            logger.debug('Resolved internal Mintbox URL to direct signed URL for social publish', { token });
          }
        } catch (e) {
          logger.warn('Failed to resolve internal Mintbox URL to direct signed URL', { token, error: e.message });
        }
      }
    }
  }

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
        case 'google_business_profile':
          result = await publishToGoogleBusinessProfile(account, post, media);
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

  // --- Video Cleanup Logic ---
  // If the post is fully published across all its platforms, clean up directly-uploaded videos
  const checkStatusRes = await query(`SELECT status FROM social_post_platforms WHERE post_id = $1`, [postId]);
  const allPlatformsPublished = checkStatusRes.rows.every(r => r.status === 'published' || r.status === 'skipped');
  
  if (allPlatformsPublished) {
    try {
      const { extractThumbnail } = require('../../utils/video.utils');
      const { uploadFile, deleteFile } = require('../storage/app-storage.provider');

      for (const m of media) {
        if (m.media_type === 'video' && m.media_url) {
          // Check if it's a directly uploaded video (not a mintbox file)
          // Mintbox files originally have /api/v1/mintbox/public/files/ (we mutated it in memory above but we can check if m.id exists and originally had it)
          // Actually, if it's directly uploaded, the media_url contains '/social/'
          if (m.media_url.includes('/social/')) {
            logger.info('Extracting thumbnail and cleaning up directly uploaded video', { mediaId: m.id });
            
            // 1. Extract thumbnail
            const thumbBuffer = await extractThumbnail(m.media_url);
            
            // 2. Upload thumbnail to storage
            const thumbPath = `social/${post.user_id}/${postId}/${m.id}_thumbnail.jpg`;
            const thumbUrl = await uploadFile('job-attachments', thumbPath, thumbBuffer, 'image/jpeg');
            
            // 3. Delete original video from storage
            const urlPathMatch = m.media_url.match(/\/(social\/.*)/);
            if (urlPathMatch && urlPathMatch[1]) {
              await deleteFile('job-attachments', urlPathMatch[1]);
              logger.info('Deleted original video to save space', { path: urlPathMatch[1] });
            }

            // 4. Update DB record
            await query(
              `UPDATE social_post_media 
               SET media_url = NULL, thumbnail_url = $1 
               WHERE id = $2`,
              [thumbUrl, m.id]
            );
          }
        }
      }
    } catch (cleanupErr) {
      logger.error('Failed to cleanup video after publishing', { error: cleanupErr.message });
    }
  }
  // ---------------------------

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

const deletePost = async (postId, userId) => {
  const dbClient = await getClient();
  try {
    const platformRowsResult = await dbClient.query(
      `SELECT spp.platform, spp.platform_post_id, spp.platform_post_url, sa.access_token, sa.page_id
       FROM social_post_platforms spp
       JOIN social_accounts sa ON sa.id = spp.social_account_id
       WHERE spp.post_id = $1 AND sa.user_id = $2`,
      [postId, userId]
    );

    const postResult = await dbClient.query(
      'SELECT id, status, queue_job_id FROM social_posts WHERE id = $1 AND user_id = $2',
      [postId, userId]
    );
    const post = postResult.rows[0];
    if (!post) throw new AppError('Post not found', 404);

    if (post.status === 'scheduled' && post.queue_job_id) {
      await cancelScheduledPost(post.queue_job_id);
    }

    const remoteDeleteErrors = [];
    for (const platformRow of platformRowsResult.rows) {
      try {
        await deleteRemotePublishedPost(platformRow);
      } catch (err) {
        remoteDeleteErrors.push(`${platformRow.platform}: ${err.message}`);
      }
    }

    if (remoteDeleteErrors.length > 0) {
      throw new AppError(`Could not delete remote post(s): ${remoteDeleteErrors.join('; ')}`, 400);
    }

    await dbClient.query('BEGIN');

    await dbClient.query('DELETE FROM social_post_platforms WHERE post_id = $1', [postId]);
    await dbClient.query('DELETE FROM social_post_media WHERE post_id = $1', [postId]);
    await dbClient.query('DELETE FROM social_posts WHERE id = $1 AND user_id = $2', [postId, userId]);

    await dbClient.query('COMMIT');
    return { deleted: true, postId };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
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
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'platform', spp.platform,
             'status', spp.status,
             'platform_post_url', spp.platform_post_url,
             'error_message', spp.error_message,
             'published_at', spp.published_at,
             'source', spp.source
           )
           ORDER BY spp.published_at NULLS LAST, spp.id
         )
         FROM social_post_platforms spp
         WHERE spp.post_id = sp.id
       ), '[]'::json) AS platform_statuses,
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'media_url', spm.media_url,
             'media_type', spm.media_type,
             'mime_type', spm.mime_type,
             'duration_seconds', spm.duration_seconds,
             'width', spm.width,
             'height', spm.height,
             'thumbnail_url', spm.thumbnail_url,
             'alt_text', spm.alt_text,
             'sort_order', spm.sort_order
           )
           ORDER BY spm.sort_order
         )
         FROM social_post_media spm
         WHERE spm.post_id = sp.id
       ), '[]'::json) AS media
     FROM social_posts sp
     WHERE sp.user_id = $1 ${whereExtra}
     ORDER BY COALESCE(sp.published_at, sp.created_at) DESC
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
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'platform', spp.platform,
             'status', spp.status,
             'platform_post_id', spp.platform_post_id,
             'platform_post_url', spp.platform_post_url,
             'error_message', spp.error_message,
             'views_count', spp.views_count,
             'likes_count', spp.likes_count,
             'published_at', spp.published_at,
             'source', spp.source
           )
           ORDER BY spp.published_at NULLS LAST, spp.id
         )
         FROM social_post_platforms spp
         WHERE spp.post_id = sp.id
       ), '[]'::json) AS platform_statuses,
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'media_url', spm.media_url,
             'media_type', spm.media_type,
             'sort_order', spm.sort_order
           )
           ORDER BY spm.sort_order
         )
         FROM social_post_media spm
         WHERE spm.post_id = sp.id
       ), '[]'::json) AS media
     FROM social_posts sp
     WHERE sp.id = $1`,
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
      const details = await fetchFacebookPageDetails(row);
      if (!details?.stats?.insights_available) {
        continue;
      }
      analytics = await getFacebookAnalytics({ ...row, access_token: details.pageAccessToken }, row.platform_post_id);
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

const refreshExpiringSocialTokens = async () => {
  const result = await query(
    `SELECT *
     FROM social_accounts
     WHERE is_active = true
       AND token_expires_at IS NOT NULL
       AND token_expires_at <= NOW() + INTERVAL '14 days'`
  );

  const refreshed = [];

  for (const account of result.rows) {
    try {
      const updated = await refreshTokenIfNeeded(account, 14);
      if (updated && updated !== account) {
        refreshed.push({ accountId: account.id, platform: account.platform });
      }
    } catch (err) {
      logger.warn('Scheduled social token refresh failed', {
        accountId: account.id,
        platform: account.platform,
        error: err.message,
      });
    }
  }

  return refreshed;
};

const refreshRecentSocialAnalytics = async () => {
  const refreshed = [];

  const accountsResult = await query(
    `SELECT DISTINCT sa.*
     FROM social_accounts sa
     JOIN social_post_platforms spp ON spp.social_account_id = sa.id
     JOIN social_posts sp ON sp.id = spp.post_id
     WHERE sa.is_active = true
       AND sa.platform = 'facebook'
       AND spp.status = 'published'
       AND spp.published_at IS NOT NULL
       AND spp.published_at >= NOW() - INTERVAL '30 days'
     ORDER BY sa.id`
  );

  for (const account of accountsResult.rows) {
    try {
      const details = await fetchFacebookPageDetails(account);
      if (!details?.stats?.insights_available) {
        continue;
      }

      const postsResult = await query(
        `SELECT DISTINCT sp.id AS post_id, sp.user_id, MAX(spp.published_at) AS published_at
         FROM social_posts sp
         JOIN social_post_platforms spp ON spp.post_id = sp.id
         WHERE spp.social_account_id = $1
           AND spp.status = 'published'
           AND spp.published_at IS NOT NULL
           AND spp.published_at >= NOW() - INTERVAL '30 days'
         GROUP BY sp.id, sp.user_id
         ORDER BY MAX(spp.published_at) DESC`,
        [account.id]
      );

      for (const row of postsResult.rows) {
        try {
          const updates = await pullAnalytics(row.post_id, row.user_id);
          refreshed.push({ postId: row.post_id, updates: updates.length });
        } catch (err) {
          logger.warn('Scheduled analytics refresh failed', {
            postId: row.post_id,
            userId: row.user_id,
            accountId: account.id,
            error: err.message,
          });
        }
        await sleep(1000);
      }
    } catch (err) {
      logger.warn('Scheduled analytics account refresh failed', {
        accountId: account.id,
        pageId: account.page_id,
        error: err.message,
      });
    }
  }

  return refreshed;
};


const getSocialHealth = async () => {
  const config = {
    facebookConfigured: Boolean(env.social.facebook.appId && env.social.facebook.appSecret && env.social.facebook.redirectUri),
    instagramConfigured: Boolean(env.social.facebook.appId && env.social.facebook.appSecret && env.social.facebook.redirectUri),
    youtubeConfigured: Boolean(env.social.youtube.clientId && env.social.youtube.clientSecret && env.social.youtube.redirectUri),
  };

  return {
    configured: config,
    mode: env.node_env,
    meta: {
      facebookRedirectUri: env.social.facebook.redirectUri || null,
      youtubeRedirectUri: env.social.youtube.redirectUri || null,
      oauthConfigured: config.facebookConfigured || config.youtubeConfigured,
      liveModeDetectable: false,
      currentMode: 'unknown_from_code',
      note: 'Meta dashboard app mode cannot be read from the backend. Confirm Live mode in Meta manually.',
    },
  };
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

// ── Calendar view ─────────────────────────────────────────────────────────────
// Returns all posts for a given month, grouped by date (YYYY-MM-DD).
// month param: "2026-07" (YYYY-MM)
const getCalendarPosts = async (userId, { month } = {}) => {
  // Default to current month
  const key = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = key.split('-').map(Number);
  const start = new Date(year, mon - 1, 1);
  const end   = new Date(year, mon, 1); // exclusive

  const result = await query(
    `SELECT
       sp.id,
       sp.title,
       sp.caption,
       sp.status,
       sp.content_type,
       sp.target_platforms,
       sp.publish_at,
       sp.published_at,
       sp.created_at,
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'platform', spp.platform,
             'status',   spp.status,
             'platform_post_url', spp.platform_post_url,
             'published_at', spp.published_at
           )
           ORDER BY spp.id
         )
         FROM social_post_platforms spp
         WHERE spp.post_id = sp.id
       ), '[]'::json) AS platform_statuses,
       COALESCE((
         SELECT json_agg(
           json_build_object(
             'media_url',     spm.media_url,
             'media_type',    spm.media_type,
             'thumbnail_url', spm.thumbnail_url,
             'sort_order',    spm.sort_order
           )
           ORDER BY spm.sort_order
         )
         FROM social_post_media spm
         WHERE spm.post_id = sp.id
       ), '[]'::json) AS media
     FROM social_posts sp
     WHERE sp.user_id = $1
       AND (
         sp.publish_at  BETWEEN $2 AND $3
         OR sp.published_at BETWEEN $2 AND $3
         OR (sp.publish_at IS NULL AND sp.published_at IS NULL AND sp.created_at BETWEEN $2 AND $3)
       )
     ORDER BY COALESCE(sp.publish_at, sp.published_at, sp.created_at) ASC`,
    [userId, start.toISOString(), end.toISOString()]
  );

  const posts = [];
  for (const post of result.rows) {
    const rawPlatforms = normalizeTargetPlatforms(post.target_platforms || []);
    const statusPlatforms = (post.platform_statuses || []).map(s => s.platform);
    const platforms = [...new Set([...rawPlatforms, ...statusPlatforms])].filter(Boolean);

    posts.push({
      id:               post.id,
      title:            post.title,
      caption:          post.caption,
      status:           post.status,
      content_type:     post.content_type,
      platforms,
      platform_statuses: post.platform_statuses,
      publish_at:       post.publish_at,
      published_at:     post.published_at,
      media:            post.media || [],
      created_at:       post.created_at
    });
  }

  return { month: key, posts, total: posts.length };
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
  deletePost,
  getMyPosts,
  getPostById,
  updatePost,
  pullAnalytics,
  refreshAccountsFromMeta,
  refreshRecentSocialAnalytics,
  refreshExpiringSocialTokens,
  getSocialHealth,
  getAnalyticsSummary,
  getCalendarPosts,
};
