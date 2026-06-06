const env = require('../../config/env');
const {
  createSignedResumableUpload,
  createSignedDownloadUrl,
  storageObjectExists,
} = require('../../config/supabase');

const bucket = env.supabase.mintboxBucket;

const prepareResumableUpload = (storagePath) =>
  createSignedResumableUpload(bucket, storagePath);

const objectExists = (storagePath) =>
  storageObjectExists(bucket, storagePath);

const createDownloadUrl = (storagePath, expiresIn = 60) =>
  createSignedDownloadUrl(bucket, storagePath, expiresIn);

const getBucket = () => bucket;

module.exports = {
  prepareResumableUpload,
  objectExists,
  createDownloadUrl,
  getBucket,
};
