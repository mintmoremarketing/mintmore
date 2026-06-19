const { google } = require('googleapis');
const axios      = require('axios');
const env        = require('../../../config/env');
const logger     = require('../../../utils/logger');

const getYouTubeClient = (accessToken, refreshToken) => {
  const auth = new google.auth.OAuth2(
    env.social.youtube.clientId,
    env.social.youtube.clientSecret,
    env.social.youtube.redirectUri
  );
  auth.setCredentials({
    access_token:  accessToken,
    refresh_token: refreshToken,
  });
  return google.youtube({ version: 'v3', auth });
};

/**
 * Upload a video to YouTube.
 * Supports: regular videos and Shorts (vertical video ≤60s).
 *
 * YouTube requires the video file to be downloadable from a URL.
 * We stream from Supabase Storage URL directly.
 */
const publishToYouTube = async (account, post, media) => {
  if (media.length === 0) {
    throw new Error('YouTube requires a video file');
  }

  const videoMedia = media.find((m) => m.media_type === 'video') || media[0];

  if (!videoMedia) {
    throw new Error('YouTube requires a video media item');
  }

  try {
    const youtube = getYouTubeClient(account.access_token, account.refresh_token);

    // Download video from Supabase Storage as a stream
    const videoStream = await axios.get(videoMedia.media_url, {
      responseType: 'stream',
    });

    const privacyStatus = post.metadata?.youtube_privacy || 'public';
    const title         = post.metadata?.youtube_title || post.title || post.caption?.slice(0, 100) || 'CREATYV Video';
    const description   = buildYouTubeDescription(post);
    const tags          = post.hashtags?.map((h) => h.replace('#', '')) || [];

    const isShort = post.content_type === 'short' ||
                    (videoMedia.duration_seconds && videoMedia.duration_seconds <= 60 &&
                     videoMedia.height > videoMedia.width);

    // Add #Shorts to title/tags if it's a Short
    const finalTitle = isShort && !title.includes('#Shorts')
      ? `${title} #Shorts`
      : title;

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title:       finalTitle,
          description,
          tags:        isShort ? [...tags, 'Shorts'] : tags,
          categoryId:  post.metadata?.youtube_category_id || '22', // 22 = People & Blogs
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: videoStream.data,
      },
    });

    const videoId  = response.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Upload thumbnail if provided
    if (videoMedia.thumbnail_url) {
      try {
        const thumbStream = await axios.get(videoMedia.thumbnail_url, {
          responseType: 'stream',
        });
        await youtube.thumbnails.set({
          videoId,
          media: { body: thumbStream.data },
        });
      } catch (thumbErr) {
        logger.warn('YouTube thumbnail upload failed', { error: thumbErr.message });
      }
    }

    logger.info('YouTube publish success', { videoId });
    return {
      platform_post_id:  videoId,
      platform_post_url: videoUrl,
      platform_title:    finalTitle,
    };

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    logger.error('YouTube publish failed', { error: msg });
    throw new Error(`YouTube: ${msg}`);
  }
};

/**
 * Pull YouTube video analytics.
 */
const getYouTubeAnalytics = async (account, platformPostId) => {
  try {
    const youtube  = getYouTubeClient(account.access_token, account.refresh_token);
    const response = await youtube.videos.list({
      part: ['statistics'],
      id:   [platformPostId],
    });

    const stats = response.data.items?.[0]?.statistics || {};
    return {
      views_count:    parseInt(stats.viewCount    || 0, 10),
      likes_count:    parseInt(stats.likeCount    || 0, 10),
      comments_count: parseInt(stats.commentCount || 0, 10),
      shares_count:   0,
      reach_count:    0,
    };
  } catch (err) {
    logger.warn('YouTube analytics failed', { error: err.message });
    return null;
  }
};

/**
 * Refresh YouTube (Google OAuth) access token using refresh token.
 */
const refreshYouTubeToken = async (account) => {
  try {
    const auth = new google.auth.OAuth2(
      env.social.youtube.clientId,
      env.social.youtube.clientSecret,
      env.social.youtube.redirectUri
    );
    auth.setCredentials({ refresh_token: account.refresh_token });

    const { credentials } = await auth.refreshAccessToken();
    return {
      access_token:     credentials.access_token,
      token_expires_at: new Date(credentials.expiry_date),
    };
  } catch (err) {
    logger.error('YouTube token refresh failed', { error: err.message });
    return null;
  }
};

const buildYouTubeDescription = (post) => {
  const parts = [];
  if (post.caption)          parts.push(post.caption);
  if (post.mentions?.length) parts.push(post.mentions.join(' '));
  if (post.hashtags?.length) parts.push(post.hashtags.join(' '));
  return parts.join('\n\n');
};

module.exports = { publishToYouTube, getYouTubeAnalytics, refreshYouTubeToken };
