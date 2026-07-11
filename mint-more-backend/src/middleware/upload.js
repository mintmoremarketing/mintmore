const multer = require('multer');
const AppError = require('../utils/AppError');
const env = require('../config/env');

/**
 * Use memory storage — we pipe the buffer directly to Supabase Storage.
 * Never write uploads to disk on the server.
 */
const storage = multer.memoryStorage();

const createUpload = ({
  allowedFileTypes = env.upload.allowedFileTypes,
  maxFileSizeMb = env.upload.maxFileSizeMb,
} = {}) => {
  const fileFilter = (req, file, cb) => {
    if (allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `File type not allowed. Accepted: ${allowedFileTypes.join(', ')}`,
          415
        ),
        false
      );
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSizeMb * 1024 * 1024, // convert MB to bytes
    },
  });
};

const fileFilter = (req, file, cb) => {
  if (env.upload.allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `File type not allowed. Accepted: ${env.upload.allowedFileTypes.join(', ')}`,
        415
      ),
      false
    );
  }
};

const upload = createUpload();

/**
 * Multer error wrapper — converts multer errors to AppError
 * so they flow through our global error handler cleanly.
 */
const handleUploadError = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError(`File too large. Max size: ${env.upload.maxFileSizeMb}MB`, 413)
        );
      }
      return next(new AppError(`Upload error: ${err.message}`, 400));
    }
    next(err);
  });
};

module.exports = { upload, handleUploadError, createUpload };
