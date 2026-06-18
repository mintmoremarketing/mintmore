const AppError = require('../utils/AppError');
const { getSetting } = require('../modules/commerce/settings.service');

const requireFeatureFlag = (flag, { defaultEnabled = false, allowAdmin = true } = {}) => async (req, _res, next) => {
  try {
    if (allowAdmin && req.user?.role === 'admin') return next();

    const flags = await getSetting('feature_flags', { [flag]: defaultEnabled });
    if (flags?.[flag] === true) return next();

    return next(new AppError(`This feature is currently unavailable: ${flag}`, 403));
  } catch (error) {
    return next(error);
  }
};

module.exports = { requireFeatureFlag };
