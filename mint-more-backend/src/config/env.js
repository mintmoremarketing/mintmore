require('dotenv').config();

const normalizeSupabaseUrl = (rawUrl) => {
  const value = String(rawUrl || '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!value) return value;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('must use http or https');
    }
    if (url.hostname === 'supabase.com' || url.hostname === 'www.supabase.com') {
      throw new Error('must be the project API URL, not the Supabase dashboard URL');
    }
    return url.origin;
  } catch (error) {
    throw new Error(`Invalid SUPABASE_URL: ${error.message}`);
  }
};

const normalizeStorageBucket = (rawBucket, fallback = 'mintbox-files') => {
  const bucket = String(rawBucket || fallback)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .replace(/^\/+|\/+$/g, '');

  if (!/^[a-zA-Z0-9_-]+$/.test(bucket)) {
    throw new Error('Invalid storage bucket name: use only letters, numbers, hyphens, and underscores');
  }
  return bucket;
};

const normalizeStorageProvider = (value) => {
  const provider = String(value || 'supabase').trim().toLowerCase();
  if (!['supabase', 'r2'].includes(provider)) {
    throw new Error('Invalid STORAGE_PROVIDER: expected "supabase" or "r2"');
  }
  return provider;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const looksLikeRazorpayKey = (keyId) => /^rzp_(test|live)_/.test(String(keyId || '').trim());
const hasUsableRazorpayCredentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const placeholder = /your_|placeholder|example|xxx/i;
  return (
    looksLikeRazorpayKey(keyId) &&
    String(keySecret || '').length >= 20 &&
    String(webhookSecret || '').length >= 10 &&
    !placeholder.test(`${keyId} ${keySecret} ${webhookSecret}`)
  );
};
const mockCheckout = process.env.PAYMENT_MOCK_CHECKOUT === 'true' ||
  (!isProd && !hasUsableRazorpayCredentials());

if (isProd && process.env.PAYMENT_MOCK_CHECKOUT === 'true') {
  console.error(
    'FATAL: PAYMENT_MOCK_CHECKOUT=true is not allowed when NODE_ENV=production. ' +
    'Disable mock checkout and configure real Razorpay credentials before starting the server.'
  );
  throw new Error(
    'FATAL: PAYMENT_MOCK_CHECKOUT=true is not allowed when NODE_ENV=production. ' +
    'Disable mock checkout and configure real Razorpay credentials before starting the server.'
  );
}

const env = {
  node_env: nodeEnv,
  port: parseInt(process.env.PORT, 10) || 5000,
  apiVersion: process.env.API_VERSION || 'v1',

  db: {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT, 10) || 5432,
    name:     process.env.DB_NAME || 'postgres',
    user:     process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'true',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    accessSecret:     process.env.JWT_ACCESS_SECRET,
    refreshSecret:    process.env.JWT_REFRESH_SECRET,
    accessExpiresIn:  process.env.JWT_ACCESS_EXPIRES_IN  || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
  },

  security: {
    corsOrigins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    rateLimitMax:      parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
  },

  supabase: {
    url:        normalizeSupabaseUrl(process.env.SUPABASE_URL),
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
    mintboxBucket: normalizeStorageBucket(process.env.MINTBOX_STORAGE_BUCKET),
  },

  storage: {
    provider: normalizeStorageProvider(process.env.STORAGE_PROVIDER),
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID?.trim(),
    endpoint: process.env.R2_ENDPOINT?.trim() ||
      (process.env.R2_ACCOUNT_ID?.trim()
        ? `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`
        : undefined),
    accessKeyId: process.env.R2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY?.trim(),
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim(),
    publicBaseUrls: {
      avatars: process.env.R2_AVATARS_PUBLIC_BASE_URL?.trim(),
      jobAttachments: process.env.R2_JOB_ATTACHMENTS_PUBLIC_BASE_URL?.trim(),
    },
    buckets: {
      mintbox: normalizeStorageBucket(process.env.R2_MINTBOX_BUCKET || process.env.MINTBOX_STORAGE_BUCKET, 'mintbox-files'),
      avatars: normalizeStorageBucket(process.env.R2_AVATARS_BUCKET, 'avatars'),
      kycDocs: normalizeStorageBucket(process.env.R2_KYC_DOCS_BUCKET, 'kyc-docs'),
      jobAttachments: normalizeStorageBucket(process.env.R2_JOB_ATTACHMENTS_BUCKET, 'job-attachments'),
    },
  },

  razorpay: {
    keyId:         process.env.RAZORPAY_KEY_ID?.trim(),
    keySecret:     process.env.RAZORPAY_KEY_SECRET?.trim(),
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim(),
  },

  payments: {
    mockCheckout,
  },

  upload: {
    maxFileSizeMb:    parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES
      ? process.env.ALLOWED_FILE_TYPES.split(',')
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    mintboxMaxFileSizeMb: parseInt(process.env.MINTBOX_MAX_FILE_SIZE_MB, 10) || 2048,
    mintboxBucketMaxFileSizeMb: parseInt(process.env.MINTBOX_BUCKET_MAX_FILE_SIZE_MB, 10) || 50,
    mintboxAllowedFileTypes: process.env.MINTBOX_ALLOWED_FILE_TYPES
      ? process.env.MINTBOX_ALLOWED_FILE_TYPES.split(',').map((type) => type.trim())
      : [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff',
          'image/svg+xml', 'application/pdf', 'application/zip',
          'application/x-zip-compressed', 'application/vnd.rar',
          'application/x-rar-compressed', 'application/x-7z-compressed',
          'application/vnd.adobe.photoshop', 'application/x-photoshop',
          'image/vnd.adobe.photoshop', 'application/postscript',
          'video/mp4', 'video/quicktime', 'video/webm',
          'audio/mpeg', 'audio/wav', 'audio/x-wav',
          'font/otf', 'font/ttf', 'font/woff', 'font/woff2',
          'application/vnd.ms-fontobject',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain', 'text/csv',
        ],
    mintboxAllowedExtensions: process.env.MINTBOX_ALLOWED_EXTENSIONS
      ? process.env.MINTBOX_ALLOWED_EXTENSIONS.split(',').map((ext) => ext.trim().toLowerCase())
      : [
          '.jpg', '.jpeg', '.png', '.webp', '.gif', '.tif', '.tiff', '.svg',
          '.pdf', '.zip', '.rar', '.7z', '.psd', '.ai', '.eps',
          '.mp4', '.mov', '.webm', '.mp3', '.wav',
          '.otf', '.ttf', '.woff', '.woff2',
          '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv',
        ],
  },

  whatsapp: {
    accessToken:   process.env.META_WA_ACCESS_TOKEN,
    verifyToken:   process.env.META_WA_VERIFY_TOKEN,
    apiVersion:    process.env.META_WA_API_VERSION || 'v19.0',
    appSecret:     process.env.META_APP_SECRET,
  },

  social: {
    facebook: {
      appId:              process.env.FACEBOOK_APP_ID,
      appSecret:          process.env.FACEBOOK_APP_SECRET,
      redirectUri:        process.env.FACEBOOK_REDIRECT_URI,
      webhookVerifyToken: process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || 'mintmore_social_webhook',
    },
    youtube: {
      clientId:     process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri:  process.env.YOUTUBE_REDIRECT_URI,
    },
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEET_ID?.trim(),
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  },

  ai: {
    openrouterKey:        process.env.OPENROUTER_API_KEY,
    replicateToken:       process.env.REPLICATE_API_TOKEN,
    textCreditPer1kTokens: parseInt(process.env.AI_TEXT_CREDIT_PER_1K_TOKENS || '2', 10),
    imageCreditBase:      parseInt(process.env.AI_IMAGE_CREDIT_BASE || '10', 10),
    maxRequestsPerHour:   parseInt(process.env.AI_MAX_REQUESTS_PER_HOUR || '20', 10),
  },

  isDev:  nodeEnv === 'development',
  isProd,
};

const requiredAlways = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
];

if (!env.payments.mockCheckout) {
  requiredAlways.push('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET');
}

const requiredInProd = [
  'DB_HOST',
  'DB_PASSWORD',
  'REDIS_URL',
];

requiredAlways.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
});

if (env.isProd) {
  requiredInProd.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`❌ Missing required environment variable: ${key}`);
    }
  });
}

if (env.storage.provider === 'r2') {
  [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ].forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable for R2 storage: ${key}`);
    }
  });
}

module.exports = env;
