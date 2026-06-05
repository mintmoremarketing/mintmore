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
  prepareUpload,
  markSeen,
  completeUpload,
  cancelUpload,
  reviewFile,
  completeProject,
};
