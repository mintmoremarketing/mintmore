const authService = require('./auth.service');
const { validateRegister, validateLogin, validateResetPassword } = require('./auth.validator');
const { sendSuccess, sendError } = require('../../utils/apiResponse');

const register = async (req, res, next) => {
  try {
    validateRegister(req.body);
    const result = await authService.register(req.body);
    return sendSuccess(res, {
      data: result,
      message: 'Account created successfully',
      statusCode: 201,
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    validateLogin(req.body);
    const result = await authService.login(req.body);
    return sendSuccess(res, {
      data: result,
      message: 'Logged in successfully',
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.body.refresh_token;
    const result = await authService.refreshTokens(token);
    return sendSuccess(res, {
      data: result,
      message: 'Tokens refreshed successfully',
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    // req.user and req.token are set by authenticate middleware
    await authService.logout(req.user.sub, req.token);
    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.sub);
    return sendSuccess(res, { data: { user } });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    validateResetPassword(req.body);
    await authService.resetPassword(req.body);
    return sendSuccess(res, { message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, logout, getMe, resetPassword };