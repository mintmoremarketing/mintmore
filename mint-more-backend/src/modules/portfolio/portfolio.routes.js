const { Router } = require('express');
const controller = require('./portfolio.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { upload, handleUploadError } = require('../../middleware/upload');

const router = Router();

// Explore feed is readable by any signed-in user; managing posts is freelancer-only.
router.get('/feed', authenticate, controller.getFeed);

router.use(authenticate, authorize('freelancer'));

router.get('/', controller.getMyPortfolio);

router.post('/',
	handleUploadError(upload.fields([
		{ name: 'cover_image', maxCount: 1 },
		{ name: 'media',       maxCount: 10 },
	])),
	controller.createItem
);

router.patch('/:itemId', controller.updateItem);
router.delete('/:itemId', controller.deleteItem);

module.exports = router;
