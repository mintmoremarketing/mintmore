const kycService = require('./kyc.service');
const {
  validateBasicKyc,
  validateIdentityKyc,
  validateAddressKyc,
  validateAdminReview,
} = require('./kyc.validator');
const { sendSuccess } = require('../../utils/apiResponse');

const submitBasic = async (req, res, next) => {
  try {
    validateBasicKyc(req.body);
    const submission = await kycService.submitBasicKyc(req.user.sub, req.body);
    return sendSuccess(res, {
      data: { submission },
      message: 'Personal details saved.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const submitIdentity = async (req, res, next) => {
  try {
    validateIdentityKyc(req.body);
    const submission = await kycService.submitIdentityKyc(
      req.user.sub,
      req.body,
      req.files
    );
    return sendSuccess(res, {
      data: { submission },
      message: 'Identity documents saved.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const submitAddress = async (req, res, next) => {
  try {
    validateAddressKyc(req.body);
    const submission = await kycService.submitAddressKyc(
      req.user.sub,
      req.body,
      req.files
    );
    return sendSuccess(res, {
      data: { submission },
      message: 'Verification application submitted for review.',
      statusCode: 201,
    });
  } catch (err) { next(err); }
};

const getMyKycStatus = async (req, res, next) => {
  try {
    const status = await kycService.getMyKycStatus(req.user.sub);
    return sendSuccess(res, { data: status });
  } catch (err) { next(err); }
};

// ADMIN controllers
const getPendingSubmissions = async (req, res, next) => {
  try {
    const { page, limit, level } = req.query;
    const result = await kycService.getPendingSubmissions({
      page:  parseInt(page, 10)  || 1,
      limit: parseInt(limit, 10) || 20,
      level,
    });
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const reviewSubmission = async (req, res, next) => {
  try {
    validateAdminReview(req.body);
    const submission = await kycService.reviewSubmission(
      req.params.submissionId,
      req.user.sub,
      req.body
    );
    return sendSuccess(res, {
      data: { submission },
      message: `KYC submission ${req.body.status}`,
    });
  } catch (err) { next(err); }
};

const getAdminDocumentUrl = async (req, res, next) => {
  try {
    const document = await kycService.getAdminDocumentUrl(
      req.params.submissionId,
      req.params.field
    );
    return sendSuccess(res, { data: { document } });
  } catch (err) { next(err); }
};

module.exports = {
  submitBasic,
  submitIdentity,
  submitAddress,
  getMyKycStatus,
  getPendingSubmissions,
  reviewSubmission,
  getAdminDocumentUrl,
};
