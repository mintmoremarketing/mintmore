# CREATYV Backend Smoke Checks

Run the backend smoke suite before every staging or production handoff.

## Local Full Smoke

This mode verifies the full local API surface and creates QA records for social drafts and support tickets.

```bash
npm run smoke
```

## Render Or Staging Read-Only Smoke

This mode skips write checks, so it is safer for Render/staging verification when you only want to confirm the deployed API, auth, feature flags, dashboards, and metadata are alive.

```bash
SMOKE_BASE_URL=https://mintmore.onrender.com/api/v1 SMOKE_READ_ONLY=true npm run smoke
```

## Optional Provider Checks

These checks intentionally touch external providers, so keep them off unless you are verifying a staging/production launch.

```bash
SMOKE_BASE_URL=https://mintmore.onrender.com/api/v1 \
SMOKE_READ_ONLY=true \
SMOKE_STORAGE_UPLOAD=true \
SMOKE_AI_GENERATE=true \
SMOKE_SHEETS_SYNC=true \
SMOKE_SOCIAL_OAUTH=true \
SMOKE_PAYMENT_CHECKOUT=true \
npm run smoke
```

Provider check behavior:

- `SMOKE_STORAGE_UPLOAD=true` uploads a tiny PNG avatar through the profile API and verifies an avatar URL is saved.
- `SMOKE_AI_GENERATE=true` queues a short text/caption generation, polls until completion, and verifies non-empty output.
- `SMOKE_SHEETS_SYNC=true` calls the admin task sheet sync endpoint and fails if Google Sheets is not configured.
- `SMOKE_SOCIAL_OAUTH=true` verifies Facebook and YouTube connect URLs redirect to provider OAuth pages.
- `SMOKE_PAYMENT_CHECKOUT=true` creates an unpaid Razorpay membership order or subscription and verifies the checkout payload.

## Account Overrides

Use environment-specific QA accounts when testing staging or production.

```bash
SMOKE_CLIENT_EMAIL=client@example.com \
SMOKE_CLIENT_PASSWORD=secret \
SMOKE_ADMIN_EMAIL=admin@example.com \
SMOKE_ADMIN_PASSWORD=secret \
SMOKE_DESIGNER_EMAIL=designer@example.com \
SMOKE_DESIGNER_PASSWORD=secret \
npm run smoke
```

## Coverage

The smoke suite verifies:

- Client, admin, and designer login
- Client entitlements and phase-1 feature flags
- MintCoin balance metadata
- Mintbox folder list
- Creative calendar events
- Client creative work list
- Designer task board
- Admin operations overview
- Admin commercial settings
- Admin audit records
- Social account and post lists
- Optional social OAuth provider redirects
- Social post draft target-platform shape
- Support ticket list
- Support ticket create
- AI model and usage metadata
- Optional storage avatar upload
- Optional Google Sheets task sync
- Optional Razorpay checkout order creation
- Optional AI generation result

In read-only mode, the social draft and support ticket create checks are skipped. Provider checks only run when their explicit environment flags are enabled.
