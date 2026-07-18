const { Router } = require('express');
const controller = require('./profile.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { upload, handleUploadError } = require('../../middleware/upload');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();

router.use(authenticate);

router.get('/me', controller.getMyProfile);
router.patch('/me', controller.updateMyProfile);

router.patch(
  '/me/avatar',
  handleUploadError(upload.single('avatar')),
  controller.updateAvatar
);

router.post(
  '/me/brand-assets/upload',
  handleUploadError(upload.single('asset')),
  controller.uploadBrandAsset
);

router.get('/:userId', requireFeatureFlag('marketplace'), controller.getPublicProfile);

router.get(
  '/me/pricing-guidance',
  authorize('freelancer'),
  requireFeatureFlag('freelancer_portal'),
  controller.getPricingGuidance
);

module.exports = router;
