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

const ensureStorageBucket = async (bucket, options = {}) => {
  if (!bucketChecks.has(bucket)) {
    bucketChecks.set(bucket, (async () => {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (data && !error) return data;

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
    })());
  }
  return bucketChecks.get(bucket);
};

/**
 * Upload a file buffer to Supabase Storage.
 *
 * @param {string} bucket     - Storage bucket name (e.g. 'avatars', 'kyc-docs')
 * @param {string} filePath   - Path inside bucket (e.g. 'user-id/front.jpg')
 * @param {Buffer} buffer     - File buffer from multer memoryStorage
 * @param {string} mimeType   - MIME type of the file
 * @returns {string}          - Public URL of the uploaded file
 */
const uploadFile = async (bucket, filePath, buffer, mimeType) => {
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

  // Get the public URL
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

  const baseUrl = env.supabase.url.replace(/\/+$/, '');
  const directStorageUrl = baseUrl.includes('.supabase.co')
    ? baseUrl.replace('.supabase.co', '.storage.supabase.co')
    : baseUrl;

  return {
    token: data.token,
    signedUrl: data.signedUrl,
    endpoint: `${directStorageUrl}/storage/v1/upload/resumable`,
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
