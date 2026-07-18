const { Router } = require('express');
const controller = require('./mintbox.controller');
const { authenticate } = require('../../middleware/authenticate');
const { requireEntitlement } = require('../../middleware/permissions');

const router = Router();

router.get('/public/share/:token', controller.getPublicSharedFolder);
router.get('/public/share-category/:token', controller.getPublicSharedCategory);
router.get('/public/files/:token', controller.getPublicFile);
router.get('/public/files/:token/content', controller.streamPublicFile);

router.use(authenticate);

router.get('/', requireEntitlement('can_access_mintbox'), controller.listFolders);
router.get('/library', requireEntitlement('can_access_mintbox'), controller.listBrandLibrary);
router.post('/library/folders', requireEntitlement('can_access_mintbox'), controller.createBrandFolder);
router.get('/library/folders/:folderId', requireEntitlement('can_access_mintbox'), controller.getBrandFolder);
router.patch('/library/folders/:folderId', requireEntitlement('can_access_mintbox'), controller.updateBrandFolder);
router.delete('/library/folders/:folderId', requireEntitlement('can_access_mintbox'), controller.deleteBrandFolder);
router.post('/library/folders/:folderId/uploads/prepare', requireEntitlement('can_access_mintbox'), controller.prepareBrandUpload);
router.post('/library/uploads/:uploadId/complete', requireEntitlement('can_access_mintbox'), controller.completeBrandUpload);
router.delete('/library/uploads/:uploadId', requireEntitlement('can_access_mintbox'), controller.cancelBrandUpload);
router.delete('/library/files/:fileId', requireEntitlement('can_access_mintbox'), controller.deleteBrandFile);
router.get('/jobs/:jobId', controller.getProjectFolder);
router.patch('/jobs/:jobId/seen', controller.markSeen);
router.post('/jobs/:jobId/complete', controller.completeProject);
router.delete('/jobs/:jobId', controller.deleteProject);
router.delete('/jobs/:jobId/categories/:category', controller.deleteCategory);
router.post('/jobs/:jobId/uploads/prepare', controller.prepareUpload);
router.post('/uploads/:uploadId/complete', controller.completeUpload);
router.delete('/uploads/:uploadId', controller.cancelUpload);
router.patch('/files/:fileId/review', controller.reviewFile);
router.delete('/files/:fileId', controller.deleteFile);
router.patch('/shares/:scope/:id/revoke', controller.revokeShare);
router.patch('/shares/:scope/:id/rotate', controller.rotateShare);
router.get('/share/:token', controller.getSharedFolder);

module.exports = router;
