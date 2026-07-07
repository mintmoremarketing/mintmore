require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const dryRun = !execute;

const buckets = [
  process.env.MINTBOX_STORAGE_BUCKET || 'mintbox-files',
  process.env.R2_AVATARS_BUCKET || 'avatars',
  process.env.R2_KYC_DOCS_BUCKET || 'kyc-docs',
  process.env.R2_JOB_ATTACHMENTS_BUCKET || 'job-attachments',
];

const privateBuckets = new Set([
  process.env.R2_KYC_DOCS_BUCKET || 'kyc-docs',
  process.env.R2_MINTBOX_BUCKET || process.env.MINTBOX_STORAGE_BUCKET || 'mintbox-files',
]);

const requireEnv = (name) => {
  if (!process.env[name]) throw new Error(`Missing required env var: ${name}`);
  return process.env[name];
};

const normalizeSupabaseUrl = (rawUrl) => {
  const url = new URL(String(rawUrl || '').trim().replace(/^(['"])(.*)\1$/, '$2'));
  return url.origin;
};

const supabase = createClient(
  normalizeSupabaseUrl(requireEnv('SUPABASE_URL')),
  requireEnv('SUPABASE_SERVICE_KEY'),
  { auth: { persistSession: false } }
);

const makeR2Client = () => {
  if (dryRun) return null;
  const accountId = requireEnv('R2_ACCOUNT_ID');
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });
};

const r2 = makeR2Client();

const listSupabaseObjects = async (bucket, prefix = '') => {
  const all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix || undefined, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`Could not list ${bucket}/${prefix}: ${error.message}`);
    const rows = data || [];
    if (!rows.length) break;

    for (const item of rows) {
      const key = prefix ? `${prefix}/${item.name}` : item.name;
      const looksLikeFolder = !item.id && !item.metadata;
      if (looksLikeFolder) {
        all.push(...await listSupabaseObjects(bucket, key));
      } else {
        all.push({
          bucket,
          key,
          size: Number(item.metadata?.size || 0),
          mimeType: item.metadata?.mimetype || item.metadata?.mimeType || 'application/octet-stream',
          updatedAt: item.updated_at || item.created_at || null,
        });
      }
    }

    if (rows.length < limit) break;
    offset += limit;
  }

  return all;
};

const r2ObjectExists = async (bucket, key) => {
  if (!r2) return false;
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const status = Number(error?.$metadata?.httpStatusCode);
    if (status === 404 || error.name === 'NotFound') return false;
    throw error;
  }
};

const copyObject = async ({ bucket, key, mimeType }) => {
  const exists = await r2ObjectExists(bucket, key);
  if (exists && !args.has('--overwrite')) return 'exists';

  const { data, error } = await supabase.storage.from(bucket).download(key);
  if (error) throw new Error(`Could not download ${bucket}/${key}: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(arrayBuffer),
    ContentType: mimeType || 'application/octet-stream',
  }));
  return exists ? 'overwritten' : 'copied';
};

const dbAvailable = () => (
  process.env.DB_HOST &&
  process.env.DB_PASSWORD &&
  process.env.DB_USER
);

const reportDbReferences = async () => {
  if (!dbAvailable()) {
    return { skipped: 'DB env vars are not available; DB reference scan skipped.' };
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const safeQuery = async (label, text) => {
      try {
        const result = await pool.query(text);
        return { label, rows: result.rows };
      } catch (error) {
        return { label, error: error.message };
      }
    };

    const [mintbox, kyc, usersAvatar, portfolioMedia, socialPostMedia] = await Promise.all([
      safeQuery('mintbox_files_by_bucket', 'SELECT storage_bucket, COUNT(*)::int AS count FROM mintbox_files GROUP BY storage_bucket ORDER BY storage_bucket'),
      safeQuery('kyc_public_url_like_rows', `
        SELECT COUNT(*)::int AS count
        FROM kyc_submissions
        WHERE document_front_url ILIKE '%/storage/v1/object/%'
           OR document_back_url ILIKE '%/storage/v1/object/%'
           OR selfie_url ILIKE '%/storage/v1/object/%'
           OR address_proof_url ILIKE '%/storage/v1/object/%'
      `),
      safeQuery('users.avatar_url', "SELECT COUNT(*)::int AS count FROM users WHERE avatar_url ILIKE '%/storage/v1/object/%'"),
      safeQuery('portfolio_media.url', "SELECT COUNT(*)::int AS count FROM portfolio_media WHERE url ILIKE '%/storage/v1/object/%'"),
      safeQuery('social_post_media.media_url', "SELECT COUNT(*)::int AS count FROM social_post_media WHERE media_url ILIKE '%/storage/v1/object/%'"),
    ]);

    return {
      mintbox_files_by_bucket: mintbox.error ? mintbox : mintbox.rows,
      kyc_public_url_like_rows: kyc.error ? kyc : kyc.rows[0]?.count || 0,
      public_url_columns_to_review_before_supabase_deletion: [
        usersAvatar,
        portfolioMedia,
        socialPostMedia,
      ].map((entry) => entry.error ? entry : {
        field: entry.label,
        count: entry.rows[0]?.count || 0,
      }),
    };
  } finally {
    await pool.end();
  }
};

const main = async () => {
  console.log(`Storage migration mode: ${dryRun ? 'DRY RUN / REPORT ONLY' : 'EXECUTE COPY'}`);
  console.log('Buckets:', buckets.map((bucket) => `${bucket}${privateBuckets.has(bucket) ? ' (private)' : ' (public)'}`).join(', '));

  const report = [];
  for (const bucket of buckets) {
    let objects = [];
    try {
      objects = await listSupabaseObjects(bucket);
    } catch (error) {
      report.push({
        bucket,
        privacy: privateBuckets.has(bucket) ? 'private' : 'public',
        error: error.message,
        object_count: null,
        total_bytes: null,
      });
      continue;
    }
    const totalBytes = objects.reduce((sum, item) => sum + item.size, 0);
    const bucketReport = {
      bucket,
      privacy: privateBuckets.has(bucket) ? 'private' : 'public',
      object_count: objects.length,
      total_bytes: totalBytes,
      largest_objects: [...objects].sort((a, b) => b.size - a.size).slice(0, 10),
      copied: 0,
      existing: 0,
      overwritten: 0,
      failed: 0,
    };

    if (execute) {
      for (const object of objects) {
        try {
          const status = await copyObject(object);
          if (status === 'copied') bucketReport.copied += 1;
          if (status === 'exists') bucketReport.existing += 1;
          if (status === 'overwritten') bucketReport.overwritten += 1;
        } catch (error) {
          bucketReport.failed += 1;
          console.error(`FAILED ${object.bucket}/${object.key}: ${error.message}`);
        }
      }
    }

    report.push(bucketReport);
  }

  const dbReferences = await reportDbReferences();
  console.log(JSON.stringify({ report, db_references: dbReferences }, null, 2));
  if (dryRun) {
    console.log('Dry run complete. No files were copied, deleted, or modified.');
    console.log('Run with --execute only after reviewing this report and adding R2 env vars.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
