const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../../config/env');
const logger = require('../../utils/logger');

const buckets = {
  mintbox: env.r2.buckets.mintbox,
  avatars: env.r2.buckets.avatars,
  kycDocs: env.r2.buckets.kycDocs,
  jobAttachments: env.r2.buckets.jobAttachments,
};

const publicBuckets = new Set([buckets.avatars, buckets.jobAttachments]);
const privateBuckets = new Set([buckets.mintbox, buckets.kycDocs]);

const client = new S3Client({
  region: 'auto',
  endpoint: env.r2.endpoint,
  credentials: {
    accessKeyId: env.r2.accessKeyId || '',
    secretAccessKey: env.r2.secretAccessKey || '',
  },
  forcePathStyle: true,
});

const trimSlash = (value = '') => String(value).replace(/\/+$/, '');
const encodePath = (storagePath) =>
  String(storagePath || '').split('/').map(encodeURIComponent).join('/');

const getBucket = (key = 'mintbox') => buckets[key] || key;

const publicBaseForBucket = (bucket) => {
  if (bucket === buckets.avatars) return env.r2.publicBaseUrls.avatars || env.r2.publicBaseUrl;
  if (bucket === buckets.jobAttachments) return env.r2.publicBaseUrls.jobAttachments || env.r2.publicBaseUrl;
  return env.r2.publicBaseUrl;
};

const publicUrlFor = (bucket, storagePath) => {
  const base = publicBaseForBucket(bucket);
  if (!base) {
    throw new Error(
      `R2 public URL is not configured for public bucket "${bucket}". ` +
      'Set R2_PUBLIC_BASE_URL or the bucket-specific public base URL.'
    );
  }
  return `${trimSlash(base)}/${encodePath(storagePath)}`;
};

const uploadFile = async (bucket, filePath, buffer, mimeType) => {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: filePath,
    Body: buffer,
    ContentType: mimeType || 'application/octet-stream',
  }));

  if (privateBuckets.has(bucket) || !publicBuckets.has(bucket)) {
    return { bucket, path: filePath };
  }
  return publicUrlFor(bucket, filePath);
};

const deleteFile = async (bucket, filePath) => {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: filePath }));
  } catch (error) {
    logger.warn('R2 Storage delete failed', { bucket, filePath, error: error.message });
  }
};

const createSignedUpload = async (bucket, filePath, options = {}) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: filePath,
    ContentType: options.contentType || 'application/octet-stream',
  });
  const url = await getSignedUrl(client, command, { expiresIn: options.expiresIn || 900 });
  return {
    provider: 'r2',
    method: 'PUT',
    url,
    endpoint: url,
    headers: {
      'content-type': options.contentType || 'application/octet-stream',
    },
  };
};

const createDownloadUrl = async (bucket, filePath, expiresIn = 3600) => {
  const command = new GetObjectCommand({ Bucket: bucket, Key: filePath });
  return getSignedUrl(client, command, { expiresIn });
};

const createDownloadUrls = async (bucket, filePaths, expiresIn = 3600) => {
  const entries = await Promise.all(
    (filePaths || []).map(async (filePath) => [
      filePath,
      await createDownloadUrl(bucket, filePath, expiresIn),
    ])
  );
  return new Map(entries);
};

const objectExists = async (bucket, filePath) => {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: filePath }));
    return true;
  } catch (error) {
    const status = Number(error?.$metadata?.httpStatusCode);
    if (status === 404 || error?.name === 'NotFound') return false;
    logger.error('R2 object verification failed', { bucket, filePath, error: error.message });
    throw new Error(`Could not verify uploaded file: ${error.message}`);
  }
};

module.exports = {
  name: 'r2',
  getBucket,
  uploadFile,
  deleteFile,
  createSignedUpload,
  createDownloadUrl,
  createDownloadUrls,
  objectExists,
};
