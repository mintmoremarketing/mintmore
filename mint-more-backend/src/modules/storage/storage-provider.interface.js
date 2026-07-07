/**
 * Storage provider contract used by app modules.
 *
 * Implementations must keep private buckets private by returning only
 * { bucket, path } for private uploads, and by generating signed URLs only
 * at read time for private downloads.
 */

const BUCKET_KEYS = {
  mintbox: 'mintbox',
  avatars: 'avatars',
  kycDocs: 'kycDocs',
  jobAttachments: 'jobAttachments',
};

module.exports = { BUCKET_KEYS };
