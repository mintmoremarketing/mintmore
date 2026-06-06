# Mint More Master Plan Implementation Status

## Implemented

- Centralized membership, access-pass, KYC, add-on, active-order, and admin entitlements
- Separate cash wallet, Mint Credits, escrow economics, managed margins, and freelancer commission rules
- Recurring Razorpay membership lifecycle with welcome and renewal credits
- Budget auto-matching, Pro admin review, workload limits, primary-only visibility, and preferred-creator boost
- Four-offer negotiation sequence with live updates and stale-action protection
- Deal approval with transactional escrow, durable chat creation, and durable notifications
- Project chat, seen states, admin read-only access, and WhatsApp-compatible backend state transitions
- Mintbox project folders, categorized/versioned files, resumable uploads, revocable provider-hidden share links, and storage add-ons
- Revision windows, three included rounds, paid later rounds, delivery timeline, disputes, ratings, and escrow release
- Admin roles, scoped permissions, admin creation, pricing controls, AI controls, audit logs, operational queues, and financial reconciliation signals
- AI quotas, Mint Credit-first billing, provider/user pricing, failover controls, and margin alerts
- Social publishing plus plain-language analytics with admin-controlled benchmarks
- Restored public demo-dashboard entry with account-gated live actions
- Social composer supports direct uploads and reusable Mintbox media through Mint More proxy URLs
- Durable event outbox with retries, dead-letter visibility, audited operator retry, and health monitoring

## Deployment Requirements

Apply backend migrations in numeric order, including:

1. `023_mintbox_share_revocation.sql`
2. `024_dispute_workflow.sql`
3. `025_recurring_memberships.sql`
4. `026_fulfillment_reminders.sql`
5. `027_ai_commercial_controls.sql`
6. `028_wallet_idempotency.sql`
7. `029_event_outbox.sql`
8. `030_notification_idempotency.sql`
9. `031_social_benchmarks.sql`
10. `032_payout_options.sql`

Deploy the backend only after migrations complete. The API health check intentionally reports degraded if the outbox schema is unavailable or dead-letter events exist.

## External Work Still Required

- Configure the live Razorpay subscription plan ID and production webhook secrets.
- Approve and configure WhatsApp templates for business-initiated membership and project updates.
- Complete Meta and YouTube production app reviews.
- Run qualified Indian legal and tax review for GST, TDS, credits, refunds, and escrow-style flows.
- Perform production load, concurrency, security, and payment-reconciliation testing.
- Configure a production media-delivery hostname and verify Meta/YouTube can fetch Mint More proxy media URLs.
- Migrate Supabase Storage, Vercel, and Render only after workflow acceptance testing passes.

## Local Verification Completed

- Frontend production build passes.
- Targeted frontend lint for changed product surfaces passes.
- Full backend application module graph loads successfully.
- Demo dashboard renders without browser console errors and account-gates live actions.
- Social controller/routes load successfully after upload, scheduling, analytics, and Mintbox-library changes.
- `git diff --check` passes; remaining output is Windows line-ending warnings only.
