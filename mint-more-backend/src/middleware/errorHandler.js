const logger = require('../utils/logger');
const { sendError } = require('../utils/apiResponse');

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;

  if (statusCode >= 500) {
    logger.error('Unhandled server error', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      message: err.message,
      statusCode,
      url: req.originalUrl,
    });
  }

  return sendError(res, {
    statusCode,
    message: err.isOperational
      ? err.message
      : statusCode >= 500
      ? 'Something went wrong on our end. Please try again.'
      : err.message,
    // Include field-level validation errors if present
    ...(err.errors && { errors: err.errors }),
    ...(err.isOperational && err.code && { code: err.code }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };