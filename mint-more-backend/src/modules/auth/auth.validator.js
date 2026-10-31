const AppError = require('../../utils/AppError');
const { passwordProblem } = require('../../utils/passwordPolicy');

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

  const problem = passwordProblem(password);
  if (problem) errors.push(problem);

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

  const problem = passwordProblem(newPassword);
  if (problem) errors.push(problem);

  if (errors.length > 0) {
    const err = new AppError('Validation failed', 422);
    err.errors = errors;
    throw err;
  }
};

const validateChangePassword = (body) => {
  const errors = [];
  if (!body.current_password) errors.push('Enter your current password');
  const problem = passwordProblem(body.new_password);
  if (problem) errors.push(problem);
  if (body.current_password && body.new_password && body.current_password === body.new_password) {
    errors.push('Choose a password different from your current one');
  }
  if (errors.length > 0) {
    const err = new AppError(errors[0], 422);
    err.errors = errors;
    throw err;
  }
};

module.exports = { validateRegister, validateLogin, validateResetPassword, validateChangePassword };