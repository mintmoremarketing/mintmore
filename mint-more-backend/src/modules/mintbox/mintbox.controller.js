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

const uploadWork = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('file is required', 400);
    const file = await mintboxService.uploadWork(
      req.params.jobId,
      req.user.sub,
      req.user.role,
      req.file,
      req.body
    );
    return sendSuccess(res, {
      data: { file },
      message: 'Work uploaded to Mintbox',
      statusCode: 201,
    });
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

module.exports = {
  getProjectFolder,
  getSharedFolder,
  uploadWork,
  reviewFile,
};
