const AppError = require('../../utils/AppError');

/**
 * Minimal hand-rolled validators — Phase 3 will add Zod/Joi for
 * full schema validation. This is enough for Phase 2.
 */

const validateRegister = (body) => {
  const { email, password, full_name, role } = body;
  const errors = [];

  if (!full_name || full_name.trim().length < 2) {
    errors.push('full_name must be at least 2 characters');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email is required');
  }

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (password && !/(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter and one number');
  }

  const allowedRoles = ['client', 'freelancer'];
  if (role && !allowedRoles.includes(role)) {
    errors.push(`role must be one of: ${allowedRoles.join(', ')}`);
  }

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

const validateLogin = (body) => {
  const { email, password } = body;
  const errors = [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

const validateResetPassword = (body) => {
  const { email, newPassword } = body;
  const errors = [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email is required');
  }

  if (!newPassword || newPassword.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

module.exports = { validateRegister, validateLogin, validateResetPassword };