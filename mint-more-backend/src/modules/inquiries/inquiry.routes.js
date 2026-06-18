const { Router } = require('express');
const controller = require('./inquiry.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireAddon } = require('../../middleware/requireAddon');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();
router.use(authenticate);

router.post('/',
	authorize('client'),
	requireFeatureFlag('marketplace'),
	requireAddon('direct_inquiry'),
	controller.sendInquiry
);

router.get('/', requireFeatureFlag('marketplace'), controller.getMyInquiries);

router.patch('/:inquiryId/respond',
	authorize('freelancer'),
	requireFeatureFlag('freelancer_portal'),
	controller.respondToInquiry
);

module.exports = router;
