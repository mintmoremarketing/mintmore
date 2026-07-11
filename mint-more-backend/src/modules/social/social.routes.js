const { Router } = require('express');
const controller = require('./social.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { rawBody } = require('../../middleware/rawBody');
const { verifyWebhook, handleWebhook } = require('./social.webhook');
const { requireEntitlement } = require('../../middleware/permissions');
const { handleUploadError, createUpload } = require('../../middleware/upload');

const router = Router();
const socialMediaUpload = createUpload({
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
  ],
});

// ── OAuth (GET — browser redirects, no Bearer token) ─────────────────────────
// Token passed via query param: ?token=ACCESS_TOKEN
router.get('/connect/:platform', async (req, res, next) => {
  // Authenticate via query param for browser OAuth flow
  const token = req.query.token;
  if (!token) return res.status(401).json({ success: false, message: 'Token required' });
  const { verifyAccessToken } = require('../../utils/jwt');
  try {
    req.user = verifyAccessToken(token);
    return controller.connectPlatform(req, res, next);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// GET  /api/v1/social/callback/:platform  — OAuth callback (no auth — state contains userId)
router.get('/callback/:platform', controller.oauthCallback);

// Webhook routes — no auth, need raw body
router.get('/webhook/facebook', verifyWebhook);
router.post('/webhook/facebook', rawBody, handleWebhook);

// All other routes require standard auth
router.use(authenticate);

// ── Accounts ──────────────────────────────────────────────────────────────────

// GET    /api/v1/social/accounts               — list connected accounts
router.get('/accounts', controller.getMyAccounts);
router.post('/accounts/refresh', controller.refreshFromMeta);
router.get('/health', controller.getHealth);
router.get('/analytics/summary', controller.getAnalyticsSummary);
router.get('/media-library', requireEntitlement('can_use_social'), controller.getMediaLibrary);

// DELETE /api/v1/social/accounts/:accountId    — disconnect account
router.delete('/accounts/:accountId', controller.disconnectAccount);

// ── Posts ─────────────────────────────────────────────────────────────────────

// GET    /api/v1/social/posts                  — list posts
router.get('/posts', controller.getMyPosts);

// POST   /api/v1/social/posts                  — create draft post
router.post('/posts', requireEntitlement('can_use_social'), controller.createPost);

// GET    /api/v1/social/posts/:postId          — get single post
router.get('/posts/:postId', controller.getPost);
router.patch('/posts/:postId', requireEntitlement('can_use_social'), controller.updatePost);

// POST   /api/v1/social/posts/:postId/media    — add media to draft
router.post(
  '/posts/:postId/media',
  requireEntitlement('can_use_social'),
  handleUploadError(socialMediaUpload.array('media', 10)),
  controller.addMedia
);

// POST   /api/v1/social/posts/:postId/publish  — publish or schedule
router.post('/posts/:postId/publish', requireEntitlement('can_use_social'), controller.publishPost);

// POST   /api/v1/social/posts/:postId/cancel   — cancel draft or scheduled
router.post('/posts/:postId/cancel', controller.cancelPost);

// GET    /api/v1/social/posts/:postId/analytics — pull fresh analytics
router.get('/posts/:postId/analytics', controller.pullAnalytics);

module.exports = router;
