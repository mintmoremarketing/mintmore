const { Router } = require('express');
const controller = require('./profile.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { upload, handleUploadError, createUpload } = require('../../middleware/upload');
const { CV_MIME_TYPES } = require('./cv.service');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();

router.use(authenticate);

router.get('/me', controller.getMyProfile);
router.patch('/me', controller.updateMyProfile);
router.get('/me/completion', authorize('freelancer'), controller.getMyCompletion);
router.get('/me/stats', authorize('freelancer'), controller.getMyStats);

const cvUpload = createUpload({ allowedFileTypes: Object.keys(CV_MIME_TYPES), maxFileSizeMb: 5 });
router.post(
  '/me/cv/parse',
  authorize('freelancer'),
  handleUploadError(cvUpload.single('cv')),
  controller.parseCv
);

router.patch(
  '/me/avatar',
  handleUploadError(upload.single('avatar')),
  controller.updateAvatar
);
router.delete('/me/avatar', controller.removeAvatar);

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
