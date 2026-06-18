const { Router } = require('express');
const controller = require('./freelancer.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { requireAddon } = require('../../middleware/requireAddon');
const { requireFeatureFlag } = require('../../middleware/featureFlags');

const router = Router();
router.use(authenticate);

// Browse (requires addon)
router.get('/',
	authorize('client'),
	requireFeatureFlag('marketplace'),
	requireAddon('browse_freelancers'),
	controller.browse
);

router.get('/:freelancerId',
	authorize('client'),
	requireFeatureFlag('marketplace'),
	requireAddon('browse_freelancers'),
	controller.getProfile
);

router.post('/:freelancerId/preferred',
	authorize('client'),
	requireFeatureFlag('marketplace'),
	requireAddon('browse_freelancers'),
	controller.setPreferred
);

router.delete('/:freelancerId/preferred',
	authorize('client'),
	requireFeatureFlag('marketplace'),
	requireAddon('browse_freelancers'),
	controller.setPreferred
);

// Freelancer self-management
router.patch('/me/marketplace',
	authorize('freelancer'),
	requireFeatureFlag('freelancer_portal'),
	controller.updateMarketplaceProfile
);

module.exports = router;
