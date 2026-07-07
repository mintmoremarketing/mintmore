const env = require('../../config/env');

let provider;

const getProvider = () => {
  if (!provider) {
    provider = env.storage.provider === 'r2'
      ? require('./r2-storage.provider')
      : require('./supabase-storage.provider');
  }
  return provider;
};

const getBucket = (key) => getProvider().getBucket(key);

const uploadFile = (...args) => getProvider().uploadFile(...args);
const deleteFile = (...args) => getProvider().deleteFile(...args);
const createSignedUpload = (...args) => getProvider().createSignedUpload(...args);
const createSignedDownloadUrl = (...args) => getProvider().createDownloadUrl(...args);
const createSignedDownloadUrls = (...args) => getProvider().createDownloadUrls(...args);
const storageObjectExists = (...args) => getProvider().objectExists(...args);

module.exports = {
  getProvider,
  getBucket,
  uploadFile,
  deleteFile,
  createSignedUpload,
  createSignedDownloadUrl,
  createSignedDownloadUrls,
  storageObjectExists,
};
