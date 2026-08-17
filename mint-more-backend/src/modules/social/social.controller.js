const socialService = require('./social.service');
const { validateCreatePost } = require('./social.validator');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');
const env = require('../../config/env');
const { uploadFile } = require('../storage/app-storage.provider');
const crypto = require('crypto');
const path = require('path');

// ── OAuth ──────────────────────────────────────────────────────────────────────

const connectPlatform = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const url = socialService.getOAuthUrl(platform, req.user.sub);
    return res.redirect(url);
  } catch (err) { require('fs').writeFileSync('error_trace.txt', err.stack); next(err); }
};

const oauthCallback = async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { code, state, error } = req.query;
    const dashboardUrl = `${env.social.frontendUrl}/dashboard`;

    if (error) {
      return res.redirect(
        `${dashboardUrl}?social_error=${encodeURIComponent(error)}&platform=${encodeURIComponent(platform)}`
      );
    }

    if (!code || !state) {
      throw new AppError('Missing code or state from OAuth provider', 400);
    }

    const accounts = await socialService.handleOAuthCallback(platform, code, state);

    return res.redirect(
      `${dashboardUrl}?social_connected=true&platform=${encodeURIComponent(platform)}&accounts=${accounts.length}`
    );
  } catch (err) {
    return res.redirect(
      `${env.social.frontendUrl}/dashboard?social_error=${encodeURIComponent(err.message)}`
    );
  }
};

// ── Accounts ───────────────────────────────────────────────────────────────────

const getMyAccounts = async (req, res, next) => {
  try {
    const accounts = await socialService.getMyAccounts(req.user.sub);
    return sendSuccess(res, { data: { accounts } });
  } catch (err) { next(err); }
};

const refreshFromMeta = async (req, res, next) => {
  try {
    const accounts = await socialService.refreshAccountsFromMeta(req.user.sub);
    return sendSuccess(res, {
      data: { accounts },
      message: 'Connections refreshed from Meta',
    });
  } catch (err) { next(err); }
};

const getHealth = async (req, res, next) => {
  try {
    const health = await socialService.getSocialHealth();
    return sendSuccess(res, { data: health });
  } catch (err) { next(err); }
};

const disconnectAccount = async (req, res, next) => {
  try {
    const result = await socialService.disconnectAccount(
      req.params.accountId,
      req.user.sub
    );
    return sendSuccess(res, {
      data:    result,
      message: `${result.platform} account disconnected`,
    });
  } catch (err) { next(err); }
};

// ── Posts ──────────────────────────────────────────────────────────────────────

const createPost = async (req, res, next) => {
  try {
    console.log('--- Incoming createPost ---');
    console.log('User ID:', req.user.sub);
    console.log('Body:', req.body);
    
    validateCreatePost(req.body);

    if (req.user.impersonated_by) {
      req.body.metadata = {
        ...(req.body.metadata || {}),
        impersonated_by: req.user.impersonated_by,
      };
    }

    const post = await socialService.createPost(req.user.sub, req.body);
    return sendSuccess(res, {
      data:       { post },
      message:    'Post created as draft',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const updatePost = async (req, res, next) => {
  try {
    if (req.user.impersonated_by) {
      req.body.metadata = {
        ...(req.body.metadata || {}),
        impersonated_by: req.user.impersonated_by,
      };
    }
    const post = await socialService.updatePost(req.params.postId, req.user.sub, req.body);
    return sendSuccess(res, {
      data: { post },
      message: 'Post updated',
    });
  } catch (err) { next(err); }
};

const addMedia = async (req, res, next) => {
  try {
    const post = await socialService.getPostById(
      req.params.postId,
      req.user.sub,
      req.user.role
    );
    if (!['draft', 'failed'].includes(post.status)) {
      throw new AppError(`Media cannot be added to a post with status: ${post.status}`, 409);
    }

    let { media_items } = req.body;
    if (typeof media_items === 'string') {
      try {
        media_items = JSON.parse(media_items);
      } catch {
        throw new AppError('media_items must be valid JSON', 400);
      }
    }

    const uploadedFiles = Array.isArray(req.files) && req.files.length
      ? req.files
      : req.file
        ? [req.file]
        : [];

    if (uploadedFiles.length) {
      media_items = await Promise.all(uploadedFiles.map(async (file) => {
        const extension = path.extname(file.originalname || '').toLowerCase();
        const filePath = `social/${req.user.sub}/${req.params.postId}/${crypto.randomUUID()}${extension}`;
        const mediaUrl = await uploadFile(
          'job-attachments',
          filePath,
          file.buffer,
          file.mimetype
        );
        return {
          media_url: mediaUrl,
          media_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          mime_type: file.mimetype,
          file_size_bytes: file.size,
        };
      }));
    }

    if (!Array.isArray(media_items) || media_items.length === 0) {
      throw new AppError('A media file or media_items array is required', 400);
    }
    const media = await socialService.addMediaToPost(
      req.params.postId, req.user.sub, media_items
    );
    return sendSuccess(res, {
      data:    { media },
      message: `${media.length} media item(s) added`,
    });
  } catch (err) { next(err); }
};

const publishPost = async (req, res, next) => {
  try {
    const result = await socialService.publishPost(req.params.postId, req.user.sub);
    return sendSuccess(res, {
      data:    result,
      message: result.status === 'scheduled'
        ? 'Post scheduled successfully'
        : 'Post queued for publishing',
    });
  } catch (err) { next(err); }
};

const cancelPost = async (req, res, next) => {
  try {
    const result = await socialService.cancelPost(req.params.postId, req.user.sub);
    return sendSuccess(res, { data: result, message: 'Post cancelled' });
  } catch (err) { next(err); }
};

const deletePost = async (req, res, next) => {
  try {
    const result = await socialService.deletePost(req.params.postId, req.user.sub);
    return sendSuccess(res, { data: result, message: 'Post deleted' });
  } catch (err) { next(err); }
};

const getMyPosts = async (req, res, next) => {
  try {
    const { page, limit, status, platform } = req.query;
    const result = await socialService.getMyPosts(req.user.sub, {
      page:  parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      platform,
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getPost = async (req, res, next) => {
  try {
    const post = await socialService.getPostById(
      req.params.postId, req.user.sub, req.user.role
    );
    return sendSuccess(res, { data: { post } });
  } catch (err) { next(err); }
};

const pullAnalytics = async (req, res, next) => {
  try {
    const results = await socialService.pullAnalytics(
      req.params.postId, req.user.sub
    );
    return sendSuccess(res, {
      data:    { analytics: results },
      message: `Analytics updated for ${results.length} platform(s)`,
    });
  } catch (err) { next(err); }
};

const getMediaLibrary = async (req, res, next) => {
  try {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const media = await socialService.getMintboxMediaLibrary(req.user.sub, baseUrl);
    return sendSuccess(res, { data: { media } });
  } catch (err) { next(err); }
};

const getAnalyticsSummary = async (req, res, next) => {
  try {
    const summary = await socialService.getAnalyticsSummary(req.user.sub, req.query.days);
    return sendSuccess(res, { data: { summary } });
  } catch (err) { next(err); }
};

const getCalendarPosts = async (req, res, next) => {
  try {
    const result = await socialService.getCalendarPosts(req.user.sub, { month: req.query.month, year: req.query.year });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

module.exports = {
  connectPlatform,
  oauthCallback,
  getMyAccounts,
  refreshFromMeta,
  getHealth,
  disconnectAccount,
  createPost,
  updatePost,
  addMedia,
  getMediaLibrary,
  publishPost,
  cancelPost,
  deletePost,
  getMyPosts,
  getPost,
  pullAnalytics,
  getAnalyticsSummary,
  getCalendarPosts,
};
