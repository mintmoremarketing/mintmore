const { Router } = require('express');
const controller = require('./mintbox.controller');
const { authenticate } = require('../../middleware/authenticate');
const { requireApproved } = require('../../middleware/requireApproved');

const router = Router();

router.use(authenticate, requireApproved);

router.get('/', controller.listFolders);
router.get('/jobs/:jobId', controller.getProjectFolder);
router.patch('/jobs/:jobId/seen', controller.markSeen);
router.post('/jobs/:jobId/uploads/prepare', controller.prepareUpload);
router.post('/uploads/:uploadId/complete', controller.completeUpload);
router.delete('/uploads/:uploadId', controller.cancelUpload);
router.patch('/files/:fileId/review', controller.reviewFile);
router.get('/share/:token', controller.getSharedFolder);

module.exports = router;
