const { Router } = require('express');
const controller = require('./mintbox.controller');
const { authenticate } = require('../../middleware/authenticate');
const { requireApproved } = require('../../middleware/requireApproved');
const { upload, handleUploadError } = require('../../middleware/upload');

const router = Router();

router.use(authenticate, requireApproved);

router.get('/jobs/:jobId', controller.getProjectFolder);
router.post(
  '/jobs/:jobId/files',
  handleUploadError(upload.single('file')),
  controller.uploadWork
);
router.patch('/files/:fileId/review', controller.reviewFile);
router.get('/share/:token', controller.getSharedFolder);

module.exports = router;
