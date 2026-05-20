const morgan = require('morgan');
const logger = require('../utils/logger');

// Pipe morgan's HTTP logs into our winston logger
const stream = {
  write: (message) => logger.http(message.trim()),
};

const requestLogger = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { 
    stream,
    // ✅ Skip logging if the request URL contains '/health'
    skip: (req, res) => req.originalUrl.includes('/health')
  }
);

module.exports = requestLogger;