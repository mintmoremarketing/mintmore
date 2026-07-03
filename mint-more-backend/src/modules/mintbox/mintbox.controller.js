const mintboxService = require('./mintbox.service');
const { sendSuccess } = require('../../utils/apiResponse');

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
    const { file, signedUrl } = await mintboxService.getPublicFileStream(req.params.token);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok || !upstream.body) throw new Error('Storage download failed');
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.size_bytes));
    res.setHeader('Content-Disposition', `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.original_name)}"`);
    const { Readable } = require('stream');
    const { pipeline } = require('stream/promises');
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (err) {
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
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
  getProjectFolder,
  getSharedFolder,
  getPublicSharedFolder,
  getPublicSharedCategory,
  getPublicFile,
  streamPublicFile,
  revokeShare,
  rotateShare,
  prepareUpload,
  markSeen,
  completeUpload,
  cancelUpload,
  reviewFile,
  deleteFile,
  deleteCategory,
  deleteProject,
  completeProject,
};
