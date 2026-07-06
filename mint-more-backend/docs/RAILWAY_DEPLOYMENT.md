# Railway Backend Deployment Checklist

This backend is a single Node/Express process. `server.js` starts the HTTP API and the Redis-backed background workers in the same process:

- Social publish worker
- AI generation worker
- Fulfillment monitor worker
- Event outbox worker

Railway Nixpacks can auto-detect this as a Node app from `package.json`, but `railway.json` is included to make the production commands explicit:

- Build: `npm ci`
- Start: `npm start`
- Health check: `/health`

## Required Railway Variables

Set these before deploying production traffic.

```env
NODE_ENV=production
API_VERSION=v1

DB_HOST=
DB_PORT=5432
DB_NAME=postgres
DB_USER=
DB_PASSWORD=
DB_SSL=true

REDIS_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGINS=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=
MINTBOX_STORAGE_BUCKET=mintbox-files

# Never enable mock checkout in production.
PAYMENT_MOCK_CHECKOUT=false
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Railway supplies `PORT` automatically. Do not hardcode it unless you have a specific reason.

## Feature-Specific Variables

Add these only when the corresponding production feature is meant to be live.

```env
LOG_LEVEL=info
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

MAX_FILE_SIZE_MB=5
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,application/pdf
MINTBOX_MAX_FILE_SIZE_MB=2048
MINTBOX_ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,image/gif,image/tiff,image/svg+xml,application/pdf,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed,application/x-7z-compressed,application/vnd.adobe.photoshop,application/x-photoshop,image/vnd.adobe.photoshop,application/postscript,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/x-wav,font/otf,font/ttf,font/woff,font/woff2,application/vnd.ms-fontobject,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv
MINTBOX_ALLOWED_EXTENSIONS=.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,.svg,.pdf,.zip,.rar,.7z,.psd,.ai,.eps,.mp4,.mov,.webm,.mp3,.wav,.otf,.ttf,.woff,.woff2,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv

OPENROUTER_API_KEY=
REPLICATE_API_TOKEN=
AI_TEXT_CREDIT_PER_1K_TOKENS=2
AI_IMAGE_CREDIT_BASE=10
AI_MAX_REQUESTS_PER_HOUR=20

FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_REDIRECT_URI=https://your-api-domain.com/api/v1/social/callback/facebook
FACEBOOK_WEBHOOK_VERIFY_TOKEN=

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REDIRECT_URI=https://your-api-domain.com/api/v1/social/callback/youtube

META_WA_ACCESS_TOKEN=
META_WA_VERIFY_TOKEN=
META_WA_API_VERSION=v19.0
META_APP_SECRET=

GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
```

## Smoke-Test Variables

These are only for `npm run smoke`, not for the app itself.

```env
SMOKE_BASE_URL=https://your-api-domain.com/api/v1
SMOKE_READ_ONLY=true
SMOKE_STORAGE_UPLOAD=false
SMOKE_AI_GENERATE=false
SMOKE_SHEETS_SYNC=false
SMOKE_SOCIAL_OAUTH=false
SMOKE_PAYMENT_CHECKOUT=false
SMOKE_CLIENT_EMAIL=
SMOKE_CLIENT_PASSWORD=
SMOKE_ADMIN_EMAIL=
SMOKE_ADMIN_PASSWORD=
SMOKE_DESIGNER_EMAIL=
SMOKE_DESIGNER_PASSWORD=
```

## Render Assumptions Check

No runtime code depends on Render-specific environment variables. The only Render-specific references found are in `SMOKE.md`, where `https://mintmore.onrender.com/api/v1` is used as an example smoke-test target.

The app already reads `PORT` from the environment, which is compatible with Railway.

## Railway Setup Order

1. Create a Railway project.
2. Add a Redis service or connect an external Redis provider.
3. Confirm the Supabase Postgres pooler connection values.
4. Add all required variables listed above.
5. Deploy the backend service from this repo.
6. Confirm Railway health check passes at `/health`.
7. Open `/api/v1/health` and confirm `database`, `redis`, and `outbox` are `ok`.
8. Run read-only smoke tests against the Railway URL.
9. Update OAuth redirect URLs in Meta and Google to the Railway API domain.
10. Update Razorpay webhook URL to `https://your-api-domain.com/api/v1/payments/webhook/razorpay`.
11. Update frontend `VITE_API_URL` to the Railway API URL.
12. Deploy frontend against Railway.
13. Only after smoke tests pass, point DNS or production frontend traffic at Railway.

## Notes

- This service starts workers in the same Node process as the API. That is acceptable for the current architecture.
- If traffic grows, split API and workers into separate Railway services to scale them independently.
- Production will refuse to start if `PAYMENT_MOCK_CHECKOUT=true`.
