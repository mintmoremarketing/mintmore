const mintboxService = require('./mintbox.service');
const { sendSuccess } = require('../../utils/apiResponse');
const AppError = require('../../utils/AppError');

const getProjectFolder = async (req, res, next) => {
  try {
    const result = await mintboxService.getFolderByJob(
      req.params.jobId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const listFolders = async (req, res, next) => {
  try {
    const result = await mintboxService.listClientFolders(req.user.sub, req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const listGallery = async (req, res, next) => {
  try {
    const result = await mintboxService.listClientGallery(req.user.sub, req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const listAdminGallery = async (req, res, next) => {
  try {
    const result = await mintboxService.listAdminGallery(req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const listBrandLibrary = async (req, res, next) => {
  try {
    const result = await mintboxService.listBrandLibrary(req.user.sub, req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getBrandFolder = async (req, res, next) => {
  try {
    const result = await mintboxService.getBrandFolder(req.params.folderId, req.user.sub, req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const createBrandFolder = async (req, res, next) => {
  try {
    const folder = await mintboxService.createBrandFolder(req.user.sub, req.user.role, req.body);
    return sendSuccess(res, { data: { folder }, message: 'Brand folder created', statusCode: 201 });
  } catch (err) { next(err); }
};

const updateBrandFolder = async (req, res, next) => {
  try {
    const folder = await mintboxService.updateBrandFolder(req.params.folderId, req.user.sub, req.user.role, req.body);
    return sendSuccess(res, { data: { folder }, message: 'Brand folder updated' });
  } catch (err) { next(err); }
};

const deleteBrandFolder = async (req, res, next) => {
  try {
    const result = await mintboxService.deleteBrandFolder(req.params.folderId, req.user.sub, req.user.role);
    return sendSuccess(res, { data: result, message: 'Brand folder deleted' });
  } catch (err) { next(err); }
};

const prepareBrandUpload = async (req, res, next) => {
  try {
    const upload = await mintboxService.prepareBrandUpload(
      req.params.folderId,
      req.user.sub,
      req.user.role,
      req.body
    );
    return sendSuccess(res, {
      data: { upload },
      message: 'Brand upload prepared',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const completeBrandUpload = async (req, res, next) => {
  try {
    const file = await mintboxService.completeBrandUpload(
      req.params.uploadId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { file }, message: 'Brand asset uploaded' });
  } catch (err) { next(err); }
};

const cancelBrandUpload = async (req, res, next) => {
  try {
    const upload = await mintboxService.cancelBrandUpload(
      req.params.uploadId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { upload }, message: 'Brand upload cancelled' });
  } catch (err) { next(err); }
};

const deleteBrandFile = async (req, res, next) => {
  try {
    const result = await mintboxService.deleteBrandFile(req.params.fileId, req.user.sub, req.user.role);
    return sendSuccess(res, { data: result, message: 'Brand file deleted' });
  } catch (err) { next(err); }
};

const getSharedFolder = async (req, res, next) => {
  try {
    const result = await mintboxService.getFolderByShareToken(
      req.params.token,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getPublicSharedFolder = async (req, res, next) => {
  try {
    const result = await mintboxService.getPublicFolderByShareToken(req.params.token);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getPublicSharedCategory = async (req, res, next) => {
  try {
    const result = await mintboxService.getPublicCategoryByShareToken(req.params.token);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const getPublicFile = async (req, res, next) => {
  try {
    const file = await mintboxService.getPublicFile(req.params.token);
    if (mintboxService.isLockedDelivery(file)) throw new AppError('This delivery can be opened once the client approves it', 403);
    return sendSuccess(res, {
      data: {
        file: {
          id: file.id,
          original_name: file.original_name,
          mime_type: file.mime_type,
          size_bytes: file.size_bytes,
          file_category: file.file_category,
          created_at: file.created_at,
        },
      },
    });
  } catch (err) { next(err); }
};

const streamPublicFile = async (req, res, next) => {
  try {
    const { signedUrl } = await mintboxService.getPublicFileStream(req.params.token, { download: req.query.download === '1' });
    // Let object storage serve range requests and video bytes directly rather than
    // routing every playback/download byte through the API process.
    res.setHeader('Cache-Control', 'private, no-store');
    // The web app is on another origin; helmet's same-origin default makes browsers refuse
    // the redirect, so <video> and <img> in the chat fail to load.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.redirect(302, signedUrl);
  } catch (err) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next(err);
  }
};

const revokeShare = async (req, res, next) => {
  try {
    const share = await mintboxService.revokeShare(
      req.params.scope,
      req.params.id,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { share }, message: 'Share link revoked' });
  } catch (err) { next(err); }
};

const rotateShare = async (req, res, next) => {
  try {
    const share = await mintboxService.rotateShare(
      req.params.scope,
      req.params.id,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { share }, message: 'New share link created' });
  } catch (err) { next(err); }
};

const prepareUpload = async (req, res, next) => {
  try {
    const upload = await mintboxService.prepareUpload(
      req.params.jobId,
      req.user.sub,
      req.user.role,
      req.body
    );
    return sendSuccess(res, {
      data: { upload },
      message: 'Resumable upload prepared',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const markSeen = async (req, res, next) => {
  try {
    const result = await mintboxService.markSeen(req.params.jobId, req.user.sub, req.user.role);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const completeUpload = async (req, res, next) => {
  try {
    const file = await mintboxService.completeUpload(
      req.params.uploadId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { file }, message: 'Work uploaded to Mintbox' });
  } catch (err) { next(err); }
};

const listMyFirstDrafts = async (req, res, next) => {
  try {
    const drafts = await mintboxService.listMyFirstDrafts(req.user.sub);
    return sendSuccess(res, { data: { drafts } });
  } catch (err) { next(err); }
};

const listAdminFirstDrafts = async (req, res, next) => {
  try {
    const drafts = await mintboxService.listAdminFirstDrafts();
    return sendSuccess(res, { data: { drafts } });
  } catch (err) { next(err); }
};

const reviewFirstDraft = async (req, res, next) => {
  try {
    const result = await mintboxService.reviewFirstDraft(req.params.draftId, req.user.sub, req.body);
    return sendSuccess(res, { data: { result }, message: 'First draft review saved' });
  } catch (err) { next(err); }
};

const cancelUpload = async (req, res, next) => {
  try {
    const upload = await mintboxService.cancelUpload(
      req.params.uploadId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: { upload }, message: 'Upload cancelled' });
  } catch (err) { next(err); }
};

const reviewFile = async (req, res, next) => {
  try {
    const file = await mintboxService.reviewFile(
      req.params.fileId,
      req.user.sub,
      req.user.role,
      req.body
    );
    return sendSuccess(res, { data: { file }, message: 'Work review saved' });
  } catch (err) { next(err); }
};

const deleteFile = async (req, res, next) => {
  try {
    const result = await mintboxService.deleteFile(
      req.params.fileId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: result, message: 'File deleted from Mintbox.' });
  } catch (err) { next(err); }
};

const deleteCategory = async (req, res, next) => {
  try {
    const result = await mintboxService.deleteCategory(
      req.params.jobId,
      req.params.category,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: result, message: 'Folder deleted from Mintbox.' });
  } catch (err) { next(err); }
};

const deleteProject = async (req, res, next) => {
  try {
    const result = await mintboxService.deleteProject(
      req.params.jobId,
      req.user.sub,
      req.user.role
    );
    return sendSuccess(res, { data: result, message: 'Project files deleted from Mintbox.' });
  } catch (err) { next(err); }
};

const completeProject = async (req, res, next) => {
  try {
    const result = await mintboxService.completeProject(
      req.params.jobId,
      req.user.sub,
      req.user.role,
      req.body
    );
    return sendSuccess(res, {
      data: result,
      message: 'Project completed, review submitted, and escrow released',
    });
  } catch (err) { next(err); }
};

module.exports = {
  listFolders,
  listGallery,
  listAdminGallery,
  listBrandLibrary,
  getProjectFolder,
  getBrandFolder,
  getSharedFolder,
  getPublicSharedFolder,
  getPublicSharedCategory,
  getPublicFile,
  streamPublicFile,
  revokeShare,
  rotateShare,
  createBrandFolder,
  updateBrandFolder,
  deleteBrandFolder,
  prepareBrandUpload,
  completeBrandUpload,
  cancelBrandUpload,
  deleteBrandFile,
  prepareUpload,
  markSeen,
  completeUpload,
  listMyFirstDrafts,
  listAdminFirstDrafts,
  reviewFirstDraft,
  cancelUpload,
  reviewFile,
  deleteFile,
  deleteCategory,
  deleteProject,
  completeProject,
};
