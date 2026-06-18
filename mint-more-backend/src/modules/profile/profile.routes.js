const { Router } = require('express');
const controller = require('./profile.controller');
const { authenticate } = require('../../middleware/authenticate');
const { upload, handleUploadError } = require('../../middleware/upload');
const { authorize } = require('../../middleware/authenticate');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// GET  /api/v1/profile/me            — get own full profile
router.get('/me', controller.getMyProfile);

// PATCH /api/v1/profile/me           — update own profile fields
router.patch('/me', controller.updateMyProfile);

// PATCH /api/v1/profile/me/avatar    — upload/replace avatar
router.patch(
  '/me/avatar',
  handleUploadError(upload.single('avatar')),
  controller.updateAvatar
);

// GET  /api/v1/profile/:userId       — get public profile (marketplace)
router.get('/:userId', requireFeatureFlag('marketplace'), controller.getPublicProfile);

// GET /api/v1/profile/me/pricing-guidance   — freelancer pricing market hints
router.get(
  '/me/pricing-guidance',
  authorize('freelancer'),
  requireFeatureFlag('freelancer_portal'),
  controller.getPricingGuidance
);

module.exports = router;
