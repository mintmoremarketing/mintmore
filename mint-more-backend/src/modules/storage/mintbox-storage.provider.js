const {
  getProvider,
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

// Files uploaded before the move to R2 (and any uploaded through a Supabase-backed backend)
// still live in Supabase Storage. Serve those from there instead of signing an R2 URL that 404s.
const createDownloadUrl = async (storagePath, expiresIn = 60) => {
  if (getProvider().name !== 'r2') return createSignedDownloadUrl(bucket, storagePath, expiresIn);
  const inR2 = await storageObjectExists(bucket, storagePath).catch(() => true);
  if (inR2) return createSignedDownloadUrl(bucket, storagePath, expiresIn);
  const supabase = require('./supabase-storage.provider');
  return supabase.createDownloadUrl(supabase.getBucket('mintbox'), storagePath, expiresIn);
};

const getBucket = () => bucket;

module.exports = {
  prepareResumableUpload,
  objectExists,
  createDownloadUrl,
  getBucket,
};
