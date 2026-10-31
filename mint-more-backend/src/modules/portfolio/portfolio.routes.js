const { Router } = require('express');
const controller = require('./portfolio.controller');
const { authenticate, authorize } = require('../../middleware/authenticate');
const { createUpload, handleUploadError } = require('../../middleware/upload');

// Posts can be a photo or a short video. The video goes in `media`; its cover is still an image.
const POST_MAX_MB = 50;
const POST_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-m4v', 'video/webm'];
const postUpload = createUpload({ allowedFileTypes: POST_TYPES, maxFileSizeMb: POST_MAX_MB });

const router = Router();

// Explore feed is readable by any signed-in user; managing posts is freelancer-only.
router.get('/feed', authenticate, controller.getFeed);

router.use(authenticate, authorize('freelancer'));

router.get('/', controller.getMyPortfolio);

router.post('/',
	handleUploadError(postUpload.fields([
		{ name: 'cover_image', maxCount: 1 },
		{ name: 'media',       maxCount: 10 },
	]), { maxFileSizeMb: POST_MAX_MB }),
	controller.createItem
);

router.patch('/:itemId', controller.updateItem);
router.delete('/:itemId', controller.deleteItem);

module.exports = router;
