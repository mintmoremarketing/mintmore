/**
 * Standardised API response helper.
 * Every endpoint in Mint More uses this — ensures consistent shape.
 *
 * Success:  { success: true,  data: {...},  message: "..." }
 * Error:    { success: false, error: {...}, message: "..." }
 */

const sendSuccess = (res, { data = null, message = 'Success', statusCode = 200 } = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
  });
};

const sendError = (res, { message = 'Internal Server Error', statusCode = 500, errors = null, code = null } = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(code && { code }),
    ...(errors && { errors }),
  });
};

module.exports = { sendSuccess, sendError };