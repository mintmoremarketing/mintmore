# External notification setup

Migration 068 adds a transactional queue trigger for new notifications. It does not backfill historical notifications. The Postgres worker runs every 15 seconds in production, independently of Redis. Initial delivery plus three retries use 1, 5 and 30 minute delays. Push retries are per device. An email provider acceptance is `sent`, not proof that a person received/read it. WhatsApp receipts update delivered/read status. Providers can deliver twice if a worker dies after acceptance; Resend uses an idempotency key, while push uses notification tags.

## Railway

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (HTTPS URL or mailto contact). Generate a single persistent pair with `node scripts/setup-notification-push.js`; this writes to ignored local `.env` without printing secrets. Copy the same pair privately to Railway. Never rotate it casually: subscriptions are bound to it.
- `RESEND_API_KEY`, `EMAIL_FROM`: verified Resend sending domain and sender. No email SDK dependency is needed; uses Resend HTTPS API.
- `META_WA_ACCESS_TOKEN`: permanent approved sender token, existing `META_APP_SECRET`, `META_WA_API_VERSION`: a currently supported version for your Meta app.
- `META_WA_NOTIFICATION_PHONE_ID`: explicitly selects the business sender; avoids guessing between the existing category business numbers.
- `META_WA_NOTIFICATION_LANGUAGE`: exact approved language, default `en`.
- `META_WA_NOTIFICATION_TEMPLATES`: JSON mapping event keys to approved utility template names. Keys: `delivery_ready`, `draft_approved`, `draft_changes`, `delivery_approved`, `payout_released`, `new_offer`, `ai_edit_ready`; optional admin test `notification_test`.
- Every template must have TWO body text variables (notification title and message) and ONE dynamic URL button with base `https://mintmore.vercel.app/` and variable suffix. Map only approved templates with this exact structure. Keep promotional copy out of utility templates.
- Optional `NOTIFICATIONS_APP_URL` for a new frontend origin; defaults to the production Vercel origin. Optional `NOTIFICATIONS_API_URL` for a new API origin, used in email unsubscribe links.
- Optional kill switch `NOTIFICATION_DELIVERY_ENABLED=false`. This is an environment setting, not a database feature flag. In-app notifications still work.

The public VAPID key comes from the authenticated preferences endpoint, so no Vercel environment variable is required. Vercel must serve `/sw.js` and `/manifest.webmanifest` at their real paths (Vite public assets do this). The worker does not cache pages, API responses or auth tokens. HTTPS is required, except localhost.

## Local and safety

Run `node scripts/run-migration-068.js` once. This is additive against the shared production database. All new tables have RLS enabled; browser clients cannot access them directly. Routes authenticate via the existing bearer token and scope subscriptions/preferences to the user.

Local worker is off unless `ENABLE_NOTIFICATION_WORKER=true`; even then it only claims demo-account rows ending in `@creatyv-demo.test`. Do not use real phone numbers/email recipients for automated tests. Runtime provider errors cannot roll back order actions.

## Verify on devices

1. Sign into a demo account, open Settings → Notifications and enable this device. Native permission must be granted by the person using the browser.
2. Close the Creatyv tab, trigger a demo event from another account, and check the OS notification. Click it and verify the order destination survives sign-in.
3. On iPhone/iPad, add Creatyv to Home Screen and open it from that icon before enabling push.
4. Verify Resend on an authorized recipient and WhatsApp on an explicitly opted-in test number, then inspect Operations → Notifications.
5. Broken credentials must produce a failed delivery with retries while the in-app notification and order remain intact.

Preferences support account-level channel toggles, a separate device enable/disable control, explicit WhatsApp consent and IST quiet hours. Urgent offers bypass quiet hours and are discarded after expiry. Chat alerts are grouped per room over five minutes and suppressed when the message has been read. Signing out disconnects the browser subscription.

Before broad launch, the privacy policy should describe external notifications and their opt-out controls. Verify sender domain and Meta template approval in the provider dashboards; code cannot perform those approvals.

## Verification on 2026-10-30

- Migration 068 applied once and the four tables plus RLS confirmed. Only additive schema changes; no feature flags changed.
- Five automated checks passed: IST quiet hours, channel policy, closed-page service worker handling, notification click routing, and a simulated push-provider failure saved for retry.
- Demo REST checks passed: valid/invalid preferences, WhatsApp consent, push-service endpoint validation, per-account subscription ownership, admin access and unsubscribe token separation. Temporary subscription and preference changes were cleaned up/restored.
- Database verification passed: notification/dispatch atomicity and per-device idempotency; transaction rolled back.
- Scoped demo worker verification passed: real queue SQL, missing-provider handling, repeated-sweep deduplication and WhatsApp receipt ordering. Only the verification's own demo notification rows were removed; no external messages were sent.
- Backend app load and frontend production build passed. New frontend files pass ESLint. The existing Settings page has four pre-existing ESLint errors (purity and constant expressions), confirmed against HEAD. Existing bundle-size and Wallet dynamic-import build warnings remain.
- Settings and the delivery log were visually inspected with mock data at 1440, 768 and 390 pixels; no layout failures. The temporary preview files were removed. Browser native permission and physical OS delivery have not been exercised.
- Local VAPID keys were generated privately in ignored `.env`. Email and WhatsApp credentials/sender templates are not configured locally. Production provider configuration has not been inspected or changed; nothing has been pushed or deployed by this implementation task.
