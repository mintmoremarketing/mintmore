const profileService = require('./profile.service');
const { validateProfileUpdate } = require('./profile.validator');
const { sendSuccess } = require('../../utils/apiResponse');
const cvService = require('./cv.service');

const getMyProfile = async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.sub);
    return sendSuccess(res, { data: { profile } });
  } catch (err) {
    next(err);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    validateProfileUpdate(req.body);
    const profile = await profileService.updateProfile(req.user.sub, req.body);
    return sendSuccess(res, {
      data: { profile },
      message: 'Profile updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      const { default: AppError } = await import('../../utils/AppError.js').catch(
        () => ({ default: require('../../utils/AppError') })
      );
      throw new AppError('No file uploaded', 400);
    }
    const profile = await profileService.updateAvatar(req.user.sub, req.file);
    return sendSuccess(res, {
      data: { profile },
      message: 'Avatar updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

const removeAvatar = async (req, res, next) => {
  try {
    const profile = await profileService.removeAvatar(req.user.sub);
    return sendSuccess(res, { data: { profile }, message: 'Avatar removed' });
  } catch (err) {
    next(err);
  }
};

const getMyCompletion = async (req, res, next) => {
  try {
    const completion = await profileService.getProfileCompletion(req.user.sub);
    return sendSuccess(res, { data: { completion } });
  } catch (err) {
    next(err);
  }
};

const getMyStats = async (req, res, next) => {
  try {
    const stats = await profileService.getProfileStats(req.user.sub);
    return sendSuccess(res, { data: { stats } });
  } catch (err) {
    next(err);
  }
};

const uploadBrandAsset = async (req, res, next) => {
  try {
    if (!req.file) {
      const { default: AppError } = await import('../../utils/AppError.js').catch(
        () => ({ default: require('../../utils/AppError') })
      );
      throw new AppError('No file uploaded', 400);
    }

    const profile = await profileService.uploadBrandAsset(req.user.sub, req.file, {
      kind: req.body.kind,
      label: req.body.label,
    });

    return sendSuccess(res, {
      data: { profile },
      message: 'Brand asset uploaded successfully',
    });
  } catch (err) {
    next(err);
  }
};

const getPublicProfile = async (req, res, next) => {
  try {
    const profile = await profileService.getPublicProfile(req.params.userId);
    return sendSuccess(res, { data: { profile } });
  } catch (err) {
    next(err);
  }
};

// Add this controller at the bottom:
const getPricingGuidance = async (req, res, next) => {
  try {
    const result = await profileService.getFreelancerPricingGuidance(req.user.sub);
    return sendSuccess(res, { data: result });
  } catch (err) { next(err); }
};

const parseCv = async (req, res, next) => {
  try {
    const result = await cvService.parseCv(req.user.sub, req.file);
    return sendSuccess(res, { data: result });
  } catch (err) {
    next(err);
  }
};

// Add to module.exports:
module.exports = {
  getMyProfile, updateMyProfile, updateAvatar, removeAvatar, getMyCompletion, getMyStats, parseCv,
  uploadBrandAsset,
  getPublicProfile, getPricingGuidance,
};
