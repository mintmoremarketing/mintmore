require('dotenv').config();

const env = {
  node_env: process.env.NODE_ENV || 'development',
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
    rateLimitMax:      parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  supabase: {
    url:        process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },

  razorpay: {
    keyId:         process.env.RAZORPAY_KEY_ID,
    keySecret:     process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  upload: {
    maxFileSizeMb:    parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES
      ? process.env.ALLOWED_FILE_TYPES.split(',')
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
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

  ai: {
    openrouterKey:        process.env.OPENROUTER_API_KEY,
    replicateToken:       process.env.REPLICATE_API_TOKEN,
    textCreditPer1kTokens: parseInt(process.env.AI_TEXT_CREDIT_PER_1K_TOKENS || '2', 10),
    imageCreditBase:      parseInt(process.env.AI_IMAGE_CREDIT_BASE || '10', 10),
    maxRequestsPerHour:   parseInt(process.env.AI_MAX_REQUESTS_PER_HOUR || '20', 10),
  },

  isDev:  process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

const requiredAlways = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
];

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



module.exports = env;