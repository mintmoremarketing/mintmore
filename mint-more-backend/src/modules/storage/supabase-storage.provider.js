const env = require('../../config/env');
const {
  uploadFile,
  deleteFile,
  createSignedResumableUpload,
  createSignedDownloadUrl,
  createSignedDownloadUrls,
  storageObjectExists,
} = require('../../config/supabase');

const buckets = {
  mintbox: env.supabase.mintboxBucket,
  avatars: 'avatars',
  kycDocs: 'kyc-docs',
  jobAttachments: 'job-attachments',
};

const getBucket = (key = 'mintbox') => buckets[key] || key;

const createSignedUpload = (bucket, storagePath) =>
  createSignedResumableUpload(bucket, storagePath);

const createDownloadUrl = (bucket, storagePath, expiresIn = 60) =>
  createSignedDownloadUrl(bucket, storagePath, expiresIn);

const createDownloadUrls = (bucket, storagePaths, expiresIn = 60) =>
  createSignedDownloadUrls(bucket, storagePaths, expiresIn);

const objectExists = (bucket, storagePath) =>
  storageObjectExists(bucket, storagePath);

module.exports = {
  name: 'supabase',
  getBucket,
  uploadFile,
  deleteFile,
  createSignedUpload,
  createDownloadUrl,
  createDownloadUrls,
  objectExists,
};
