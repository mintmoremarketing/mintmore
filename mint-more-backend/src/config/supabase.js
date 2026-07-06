const { createClient } = require('@supabase/supabase-js');
const env = require('./env');
const logger = require('../utils/logger');

if (!env.supabase.url || !env.supabase.serviceKey) {
  throw new Error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
}

/**
 * Service-role client — bypasses RLS.
 * ONLY use server-side. Never expose the service key to the frontend.
 */
const supabase = createClient(env.supabase.url, env.supabase.serviceKey, {
  auth: { persistSession: false },
});
const bucketChecks = new Map();
const PRIVATE_BUCKETS = new Set(['kyc-docs', 'mintbox-files']);

const isMissingBucketError = (error) => {
  const status = Number(error?.statusCode || error?.status);
  return status === 404 || /bucket.+not found|not found.+bucket|does not exist/i.test(error?.message || '');
};

const ensureStorageBucket = async (bucket, options = {}) => {
  if (!bucketChecks.has(bucket)) {
    const check = (async () => {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (data && !error) {
        if (bucket === 'kyc-docs' && data.public) {
          throw new Error('The kyc-docs bucket is public. Set it to private before accepting KYC uploads.');
        }
        return data;
      }

      if (error && !isMissingBucketError(error)) {
        logger.error('Supabase bucket lookup failed', {
          bucket,
          error: error.message,
          status: error.statusCode || error.status,
        });
        throw new Error(
          `Storage bucket lookup failed: ${error.message}. ` +
          'Check that SUPABASE_URL is the project API URL and SUPABASE_SERVICE_KEY belongs to the same project.'
        );
      }

      if (bucket === 'kyc-docs') {
        throw new Error('The kyc-docs bucket is missing. Create it explicitly as private before accepting KYC uploads.');
      }

      const { data: created, error: createError } = await supabase.storage.createBucket(bucket, {
        public: false,
        ...options,
      });
      if (createError) {
        logger.error('Supabase bucket setup failed', { bucket, error: createError.message });
        throw new Error(`Storage bucket is unavailable: ${createError.message}`);
      }
      logger.info('Supabase storage bucket created', { bucket });
      return created;
    })();

    bucketChecks.set(bucket, check);
    check.catch(() => bucketChecks.delete(bucket));
  }
  return bucketChecks.get(bucket);
};

const uploadBucketOptions = (bucket) => {
  if (bucket === 'avatars') {
    return {
      public: true,
      fileSizeLimit: env.upload.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    };
  }

  if (bucket === 'kyc-docs') {
    return {
      public: false,
      fileSizeLimit: env.upload.maxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: env.upload.allowedFileTypes,
    };
  }

  if (bucket === 'job-attachments') {
    return {
      public: true,
      fileSizeLimit: env.upload.mintboxMaxFileSizeMb * 1024 * 1024,
      allowedMimeTypes: [...env.upload.mintboxAllowedFileTypes, 'application/octet-stream'],
    };
  }

  return {};
};

/**
 * Upload a file buffer to Supabase Storage.
 *
 * @param {string} bucket     - Storage bucket name (e.g. 'avatars', 'kyc-docs')
 * @param {string} filePath   - Path inside bucket (e.g. 'user-id/front.jpg')
 * @param {Buffer} buffer     - File buffer from multer memoryStorage
 * @param {string} mimeType   - MIME type of the file
 * @returns {string|object}   - Public URL for public buckets, or { bucket, path } for private buckets
 */
const uploadFile = async (bucket, filePath, buffer, mimeType) => {
  const bucketInfo = await ensureStorageBucket(bucket, uploadBucketOptions(bucket));

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true, // overwrite if exists (e.g. re-uploading avatar)
    });

  if (error) {
    logger.error('Supabase Storage upload failed', { bucket, filePath, error: error.message });
    throw new Error(`File upload failed: ${error.message}`);
  }

  if (PRIVATE_BUCKETS.has(bucket) || !bucketInfo?.public) {
    return { bucket, path: filePath };
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);
  return urlData.publicUrl;
};

/**
 * Delete a file from Supabase Storage.
 */
const deleteFile = async (bucket, filePath) => {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) {
    logger.warn('Supabase Storage delete failed', { bucket, filePath, error: error.message });
  }
};

const createSignedResumableUpload = async (bucket, filePath) => {
  await ensureStorageBucket(bucket, {
    fileSizeLimit: env.upload.mintboxMaxFileSizeMb * 1024 * 1024,
    allowedMimeTypes: [...env.upload.mintboxAllowedFileTypes, 'application/octet-stream'],
  });
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath, { upsert: false });

  if (error) {
    logger.error('Supabase signed upload URL failed', { bucket, filePath, error: error.message });
    throw new Error(`Could not prepare file upload: ${error.message}`);
  }

  const token = String(data.token || '').trim();
  if (token.split('.').length !== 3) {
    logger.error('Supabase returned an invalid signed upload token', {
      bucket,
      filePath,
      tokenParts: token.split('.').length,
    });
    throw new Error(
      'Supabase returned an invalid signed upload token. Check that SUPABASE_SERVICE_KEY is the legacy service_role JWT from the same project.'
    );
  }

  const baseUrl = env.supabase.url.replace(/\/+$/, '');

  return {
    token,
    endpoint: `${baseUrl}/storage/v1/upload/resumable/sign`,
  };
};

const createSignedDownloadUrl = async (bucket, filePath, expiresIn = 3600) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);
  if (error) {
    logger.warn('Supabase signed download URL failed', { bucket, filePath, error: error.message });
    return null;
  }
  return data.signedUrl;
};

const createSignedDownloadUrls = async (bucket, filePaths, expiresIn = 3600) => {
  if (!filePaths.length) return new Map();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(filePaths, expiresIn);
  if (error) {
    logger.warn('Supabase batch signed download URLs failed', { bucket, count: filePaths.length, error: error.message });
    return new Map();
  }
  return new Map((data || []).map((item) => [item.path, item.signedUrl]));
};

const storageObjectExists = async (bucket, filePath) => {
  const slash = filePath.lastIndexOf('/');
  const folder = slash >= 0 ? filePath.slice(0, slash) : '';
  const fileName = slash >= 0 ? filePath.slice(slash + 1) : filePath;
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, { search: fileName, limit: 2 });

  if (error) {
    logger.error('Supabase object verification failed', { bucket, filePath, error: error.message });
    throw new Error(`Could not verify uploaded file: ${error.message}`);
  }

  return data?.some((item) => item.name === fileName) || false;
};

module.exports = {
  supabase,
  uploadFile,
  deleteFile,
  ensureStorageBucket,
  createSignedResumableUpload,
  createSignedDownloadUrl,
  createSignedDownloadUrls,
  storageObjectExists,
};
