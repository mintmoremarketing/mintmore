const {
  createSignedDownloadUrl,
  createSignedUpload,
  getBucket: resolveBucket,
  storageObjectExists,
} = require('./app-storage.provider');

const bucket = resolveBucket('mintbox');

const prepareResumableUpload = (storagePath, options = {}) =>
  createSignedUpload(bucket, storagePath, options);

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
