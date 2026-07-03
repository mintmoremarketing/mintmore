# 🌿 Mint More — SaaS Platform
### Master Project README — Progress Tracker & Context Document
> **Purpose:** Tracks every phase, decision, config, and file in the Mint More backend.
> Paste the resume block at the bottom into a new Claude chat to continue exactly where you left off.

---

## 🧠 Project Summary

**Mint More** is a production-level creative services SaaS platform for Indian businesses.

- Controlled matchmaking + negotiation (admin-supervised, free)
- Clients interact via web app OR WhatsApp — freelancers use web app only
- Paid add-on marketplace — clients browse freelancer profiles, packages, portfolios
- Social media publishing — clients connect their own FB/IG/YT accounts and publish
- Mint AI — multi-model AI content generation (text, image, video) via OpenRouter
- Single wallet system — all payments flow through wallet only (Razorpay for top-up only)

### Core Modules
| # | Module | Status |
|---|--------|--------|
| 1 | Backend Foundation | ✅ Complete |
| 2 | Authentication System | ✅ Complete |
| 3 | User Profile + KYC | ✅ Complete |
| 4A | Admin System + Marketplace Foundation | ✅ Complete |
| 4B | Job System + Marketplace Core | ✅ Complete |
| 4C | Proposal System + AI Matching Engine | ✅ Complete |
| 4C-fix | Matching Engine Rebuild | ✅ Complete |
| 4C-pricing | Pricing Tiers + Market-Aware Matching | ✅ Complete |
| 4D | Negotiation + Assignment Loop | ✅ Complete |
| 4E | Auto Matching + Visibility Control | ✅ Complete |
| 5 | In-App Notifications (SSE + Redis) | ✅ Complete |
| 6 | Wallet + Escrow Payment System | ✅ Complete |
| 7 | WhatsApp-Bridged Chat System | ✅ Complete |
| 8 | Social Media Integration + Publishing | ✅ Complete |
| 8-audit | Social Media — Production Hardening | ✅ Complete |
| 9 | Mint AI — Multi-Model AI System | ✅ Complete |
| 10 | Freelancer Marketplace + Add-On Plans | ✅ Complete |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js v18+ |
| Framework | Express.js |
| Database | PostgreSQL via Supabase (Session Pooler — IPv4) |
| Cache / Queue | Redis + BullMQ |
| File Storage | Supabase Storage |
| Real-time | SSE + Redis pub/sub |
| Payments | Razorpay (wallet top-up only) |
| Messaging | Meta WhatsApp Cloud API v19.0 |
| Social Publishing | Facebook Graph API v19, Instagram Graph API, YouTube Data API v3 |
| AI | OpenRouter (400+ models — text, image, video) |

### Key npm Packages
| Package | Purpose |
|---------|---------|
| `pg` | PostgreSQL pool |
| `ioredis` | Redis client + pub/sub |
| `jsonwebtoken` | JWT tokens |
| `bcrypt` | Password hashing |
| `multer` | File upload (memory storage) |
| `@supabase/supabase-js` | Supabase Storage client |
| `razorpay` | Wallet top-up SDK |
| `bullmq` | Social publishing + AI generation queues |
| `@googleapis/youtube` | YouTube Data API v3 |
| `axios` | Meta/Google API calls |
| `form-data` | Multipart uploads |
| `helmet` | Security headers |
| `cors` | CORS |
| `compression` | Gzip |
| `winston` | Structured logging |
| `morgan` | HTTP request logging |
| `express-rate-limit` | Rate limiting |
| `uuid` | UUID generation |

---

## ⚙️ Environment Variables (Complete .env)

```env
# ── SERVER ──────────────────────────────────────────
NODE_ENV=development
PORT=5000
API_VERSION=v1

# ── DATABASE (Supabase Session Pooler — IPv4) ────────
# CRITICAL: NEVER use db.xxxxx.supabase.co (IPv6)
DB_HOST=aws-1-ap-south-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.grnnqilqrzlnrtbfrpyx
DB_PASSWORD=your_database_password
DB_SSL=true

# ── REDIS ────────────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379

# ── SECURITY ─────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000

# ── LOGGING ──────────────────────────────────────────
LOG_LEVEL=debug

# ── JWT ──────────────────────────────────────────────
JWT_ACCESS_SECRET=your_64_byte_hex_secret
JWT_REFRESH_SECRET=your_64_byte_hex_secret_different
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── BCRYPT ───────────────────────────────────────────
BCRYPT_SALT_ROUNDS=12

# ── SUPABASE STORAGE ──────────────────────────────────
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key

# ── FILE UPLOAD ───────────────────────────────────────
MAX_FILE_SIZE_MB=5
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp,application/pdf

# ── RAZORPAY ─────────────────────────────────────────
PAYMENT_MOCK_CHECKOUT=true
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# ── WHATSAPP (Meta Cloud API) ─────────────────────────
META_WA_ACCESS_TOKEN=your_permanent_system_user_token
META_WA_VERIFY_TOKEN=mintmore1
META_WA_API_VERSION=v19.0
META_APP_SECRET=your_meta_app_secret

# ── FACEBOOK / INSTAGRAM ─────────────────────────────
FACEBOOK_APP_ID=1509078710693292
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_REDIRECT_URI=http://localhost:5000/api/v1/social/callback/facebook
FACEBOOK_WEBHOOK_VERIFY_TOKEN=mintmore_social_webhook

# ── YOUTUBE (Google OAuth) ────────────────────────────
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:5000/api/v1/social/callback/youtube

# ── FRONTEND ─────────────────────────────────────────
FRONTEND_URL=http://localhost:3000

# ── AI (OpenRouter) ───────────────────────────────────
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key
AI_TEXT_CREDIT_PER_1K_TOKENS=2
AI_IMAGE_CREDIT_BASE=10
AI_MAX_REQUESTS_PER_HOUR=20
```

---

## 🗄️ Database

### Connection (CRITICAL — IPv4 only)
```
Host:  aws-1-ap-south-1.pooler.supabase.com
Port:  5432
User:  postgres.grnnqilqrzlnrtbfrpyx
SSL:   { rejectUnauthorized: false }
NEVER: db.xxxxx.supabase.co (IPv6 — ENOTFOUND error)
```

### Supabase Project
- **Org:** mintmoremarketing's Org
- **Project:** Mint-more-saas
- **App ID:** 1509078710693292
- **Business ID:** 1354367938420457 (Mint More Marketing — Verified ✅)

### Migrations (run in order)
| File | Description | Status |
|------|-------------|--------|
| `001_create_users.sql` | Users table, enums, indexes | ✅ Done |
| `002_create_kyc.sql` | KYC submissions | ✅ Done |
| `003_marketplace_foundation.sql` | Jobs, proposals, assignments, categories | ✅ Done |
| `004_jobs_metadata.sql` | metadata JSONB | ✅ Done |
| `005_pricing_system.sql` | category_price_ranges, pricing_mode | ✅ Done |
| `006_active_jobs_count.sql` | active_jobs_count on users | ✅ Done |
| `007_negotiation_system.sql` | negotiations, rounds, matched_candidates | ✅ Done |
| `008_notifications.sql` | notifications, 15 types | ✅ Done |
| `009_wallet_system.sql` | wallets, transactions, escrow, withdrawals, razorpay_orders | ✅ Done |
| `010_chat_system.sql` | whatsapp_numbers, chat_rooms, messages, user_presence | ✅ Done |
| `011_wa_sessions.sql` | wa_sessions state machine | ✅ Done |
| `012_social_media.sql` | social_accounts, posts, post_media, post_platforms | ✅ Done |
| `013_ai_system.sql` | ai_models, ai_generations, ai_usage_log | ✅ Done |
| `013_ai_video.sql` | ADD 'video' to ai_tool_type + 13 video models | ✅ Done |
| `014_marketplace.sql` | addon_plans, client_addons, freelancer_packages, portfolio_items, reviews, direct_inquiries | ✅ Done |

### Supabase Storage Buckets
| Bucket | Public | Purpose |
|--------|--------|---------|
| `avatars` | ✅ Yes | Profile pictures |
| `kyc-docs` | ❌ No | KYC documents |
| `job-attachments` | ✅ Yes | Job files + AI output + portfolio items |

---

## 📁 Full Folder Structure

```
mint-more-backend/
├── src/
│   ├── config/
│   │   ├── env.js                              ✅
│   │   ├── database.js                         ✅
│   │   ├── redis.js                            ✅
│   │   └── supabase.js                         ✅
│   ├── db/migrations/                          ✅ all 15 files
│   ├── middleware/
│   │   ├── authenticate.js                     ✅
│   │   ├── errorHandler.js                     ✅
│   │   ├── rateLimiter.js                      ✅
│   │   ├── requestLogger.js                    ✅
│   │   ├── requireApproved.js                  ✅
│   │   ├── requireAddon.js                     ✅
│   │   ├── upload.js                           ✅
│   │   ├── sse.js                              ✅
│   │   └── rawBody.js                          ✅
│   ├── modules/
│   │   ├── health/                             ✅
│   │   ├── auth/                               ✅
│   │   ├── profile/                            ✅
│   │   ├── kyc/                                ✅
│   │   ├── admin/                              ✅
│   │   ├── categories/                         ✅
│   │   ├── jobs/                               ✅
│   │   ├── proposals/                          ✅
│   │   ├── matching/                           ✅
│   │   ├── negotiation/                        ✅
│   │   ├── notifications/                      ✅
│   │   ├── wallet/                             ✅
│   │   ├── payments/                           ✅
│   │   ├── chat/
│   │   │   ├── chat.routes.js                  ✅
│   │   │   ├── chat.controller.js              ✅
│   │   │   ├── chat.service.js                 ✅
│   │   │   └── whatsapp.service.js             ✅
│   │   ├── whatsapp/
│   │   │   ├── webhook.routes.js               ✅
│   │   │   ├── webhook.controller.js           ✅
│   │   │   └── conversation.service.js         ✅
│   │   ├── social/
│   │   │   ├── social.routes.js                ✅
│   │   │   ├── social.controller.js            ✅
│   │   │   ├── social.service.js               ✅ fully hardened
│   │   │   ├── social.validator.js             ✅
│   │   │   ├── social.webhook.js               ✅ NEW — FB/IG webhook receiver
│   │   │   ├── publishers/
│   │   │   │   ├── facebook.publisher.js       ✅ + validation + rate limit retry
│   │   │   │   ├── instagram.publisher.js      ✅ + IG account validation
│   │   │   │   └── youtube.publisher.js        ✅
│   │   │   └── queue/
│   │   │       ├── publish.queue.js            ✅
│   │   │       └── publish.worker.js           ✅
│   │   ├── ai/
│   │   │   ├── ai.routes.js                    ✅
│   │   │   ├── ai.controller.js                ✅
│   │   │   ├── ai.service.js                   ✅
│   │   │   ├── ai.validator.js                 ✅
│   │   │   ├── admin.ai.service.js             ✅
│   │   │   ├── models/
│   │   │   │   ├── model.registry.js           ✅
│   │   │   │   └── model.traffic.js            ✅
│   │   │   ├── providers/
│   │   │   │   └── openrouter.provider.js      ✅
│   │   │   └── queue/
│   │   │       ├── ai.queue.js                 ✅
│   │   │       └── ai.worker.js                ✅
│   │   ├── addons/
│   │   │   ├── addon.routes.js                 ✅
│   │   │   ├── addon.controller.js             ✅
│   │   │   └── addon.service.js                ✅
│   │   ├── freelancers/
│   │   │   ├── freelancer.routes.js            ✅
│   │   │   ├── freelancer.controller.js        ✅
│   │   │   └── freelancer.service.js           ✅
│   │   ├── packages/
│   │   │   ├── package.routes.js               ✅
│   │   │   ├── package.controller.js           ✅
│   │   │   └── package.service.js              ✅
│   │   ├── portfolio/
│   │   │   ├── portfolio.routes.js             ✅
│   │   │   ├── portfolio.controller.js         ✅
│   │   │   └── portfolio.service.js            ✅
│   │   ├── reviews/
│   │   │   ├── review.routes.js                ✅
│   │   │   ├── review.controller.js            ✅
│   │   │   └── review.service.js               ✅
│   │   └── inquiries/
│   │       ├── inquiry.routes.js               ✅
│   │       ├── inquiry.controller.js           ✅
│   │       └── inquiry.service.js              ✅
│   └── app.js                                  ✅
├── .env
├── package.json
└── server.js
```

---

## 🔌 API Routes (Complete)

### Base URL: `http://localhost:5000/api/v1`

#### Health
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | None | Server + DB + Redis |

#### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | None | Register |
| POST | `/auth/login` | None | Login |
| POST | `/auth/refresh` | None | Rotate tokens |
| POST | `/auth/logout` | ✅ Bearer | Blacklist token |
| GET | `/auth/me` | ✅ Bearer | Own auth data |

#### Profile
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/profile/me` | ✅ Bearer | Full profile |
| PATCH | `/profile/me` | ✅ Bearer | Update |
| PATCH | `/profile/me/avatar` | ✅ Bearer | Upload avatar |
| GET | `/profile/me/pricing-guidance` | ✅ Freelancer | Market hints |
| GET | `/profile/:userId` | ✅ Bearer | Public profile |

#### KYC
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/kyc/status` | ✅ Bearer | Status |
| POST | `/kyc/basic` | ✅ Bearer | Basic KYC |
| POST | `/kyc/identity` | ✅ Bearer | Identity KYC |
| POST | `/kyc/address` | ✅ Bearer | Address KYC |
| GET | `/kyc/admin/pending` | ✅ Admin | Pending queue |
| PATCH | `/kyc/admin/review/:id` | ✅ Admin | Approve/reject |

#### Admin
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/admin/dashboard` | ✅ Admin | Platform stats |
| GET | `/admin/users` | ✅ Admin | User list |
| GET | `/admin/users/:id` | ✅ Admin | User detail |
| PATCH | `/admin/users/:id/approval` | ✅ Admin | Approve/suspend |
| PATCH | `/admin/users/:id/level` | ✅ Admin | Set freelancer level |
| GET | `/admin/categories` | ✅ Admin | All categories |
| POST | `/admin/categories` | ✅ Admin | Create category |
| PATCH | `/admin/categories/:id/toggle` | ✅ Admin | Toggle active |
| GET | `/admin/jobs` | ✅ Admin | All jobs |
| PATCH | `/admin/jobs/:id/status` | ✅ Admin | Update status |
| GET | `/admin/price-ranges` | ✅ Admin | Price ranges |
| PUT | `/admin/price-ranges/:categoryId` | ✅ Admin | Upsert range |

#### Categories
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/categories` | None | Active categories |
| GET | `/categories/:id/market-range` | None | Price range |

#### Jobs
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/jobs` | ✅ Client + Approved | Create → matching auto-triggers |
| POST | `/jobs/draft` | ✅ Client + Approved | Create draft |
| PATCH | `/jobs/:id/publish` | ✅ Client + Approved | Publish → matching |
| PATCH | `/jobs/:id` | ✅ Client + Approved | Update draft |
| PATCH | `/jobs/:id/cancel` | ✅ Approved | Cancel |
| GET | `/jobs/my/summary` | ✅ Client | Status counts |
| GET | `/jobs` | ✅ Approved | Role-filtered list |
| GET | `/jobs/:id` | ✅ Approved | Single job |
| GET | `/jobs/admin/all` | ✅ Admin | All jobs |
| PATCH | `/jobs/admin/:id/status` | ✅ Admin | Update status |

#### Proposals
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/proposals/jobs/:jobId` | ✅ Freelancer | Submit |
| DELETE | `/proposals/:id` | ✅ Freelancer | Withdraw |
| GET | `/proposals/my` | ✅ Freelancer | Own proposals |
| GET | `/proposals/jobs/:jobId/client` | ✅ Client | Shortlisted |
| GET | `/proposals/jobs/:jobId/admin` | ✅ Admin | All proposals |
| PATCH | `/proposals/:id/review` | ✅ Admin | Shortlist/reject |

#### Matching
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/matching/jobs/:jobId/run` | ✅ Admin | Manual re-run |
| GET | `/matching/jobs/:jobId/preview` | ✅ Admin | Preview |
| GET | `/matching/jobs/:jobId/pool` | ✅ Admin | Full pool |

#### Negotiations
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/negotiations/jobs/:jobId/initiate` | ✅ Freelancer | Lock + open |
| PATCH | `/negotiations/jobs/:jobId/freelancer-respond` | ✅ Freelancer | Counter/accept/reject |
| PATCH | `/negotiations/jobs/:jobId/client-respond` | ✅ Client | Counter/accept/reject |
| PATCH | `/negotiations/jobs/:jobId/assignment-respond` | ✅ Freelancer | Accept/decline |
| GET | `/negotiations/jobs/:jobId/status` | ✅ Any | State |
| GET | `/negotiations/admin/pending-approvals` | ✅ Admin | Pending deals |
| POST | `/negotiations/admin/jobs/:jobId/approve-deal` | ✅ Admin | Approve |
| POST | `/negotiations/admin/jobs/:jobId/reject-deal` | ✅ Admin | Reject |

#### Notifications
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/notifications/stream` | ✅ `?token=` | SSE stream |
| GET | `/notifications` | ✅ Bearer | List |
| GET | `/notifications/unread-count` | ✅ Bearer | Badge count |
| PATCH | `/notifications/read-all` | ✅ Bearer | Mark all read |
| PATCH | `/notifications/:id/read` | ✅ Bearer | Mark one |
| POST | `/notifications/admin/broadcast` | ✅ Admin | Broadcast |

#### Wallet
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/wallet` | ✅ Bearer | Balance + transactions |
| GET | `/wallet/transactions` | ✅ Bearer | History |
| POST | `/wallet/withdraw` | ✅ Freelancer | Request payout |
| GET | `/wallet/admin/stats` | ✅ Admin | Platform overview |
| GET | `/wallet/admin/withdrawals` | ✅ Admin | Pending queue |
| PATCH | `/wallet/admin/withdrawals/:id` | ✅ Admin | Approve/reject |
| POST | `/wallet/admin/jobs/:jobId/complete` | ✅ Admin | Complete → release escrow |
| POST | `/wallet/admin/jobs/:jobId/cancel` | ✅ Admin | Cancel → refund escrow |
| POST | `/wallet/admin/users/:userId/adjust` | ✅ Admin | Manual balance adjust (+ or -) |

#### Payments
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/payments/topup/order` | ✅ Bearer | Create Razorpay order |
| POST | `/payments/topup/verify` | ✅ Bearer | Verify payment |
| POST | `/payments/webhook/razorpay` | None (sig) | Razorpay webhook |

#### Chat
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/chat/rooms` | ✅ Bearer | My rooms |
| GET | `/chat/rooms/:id` | ✅ Bearer | Room detail |
| GET | `/chat/rooms/:id/messages` | ✅ Bearer | Messages |
| POST | `/chat/rooms/:id/messages` | ✅ Bearer | Send (bridges to WA) |
| POST | `/chat/presence/online` | ✅ Bearer | Mark online |
| POST | `/chat/presence/offline` | ✅ Bearer | Mark offline |
| GET | `/chat/presence/:userId` | ✅ Bearer | Check presence |
| GET | `/chat/admin/wa-numbers` | ✅ Admin | MM WA numbers |
| POST | `/chat/admin/wa-numbers` | ✅ Admin | Add/update number |

#### WhatsApp Webhook
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/whatsapp/webhook` | None | Meta verification |
| POST | `/whatsapp/webhook` | None (sig) | Incoming events |
| POST | `/whatsapp/test/simulate-message` | None (dev) | Local testing |

#### Social Media
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/social/connect/:platform` | `?token=` | Start OAuth |
| GET | `/social/callback/:platform` | None | OAuth callback |
| GET | `/social/webhook/facebook` | None | FB webhook verification |
| POST | `/social/webhook/facebook` | None (sig) | FB/IG events (rawBody) |
| GET | `/social/accounts` | ✅ Bearer | Connected accounts + token_status |
| DELETE | `/social/accounts/:id` | ✅ Bearer | Disconnect |
| GET | `/social/posts` | ✅ Bearer | List posts |
| POST | `/social/posts` | ✅ Approved | Create draft |
| GET | `/social/posts/:id` | ✅ Bearer | Post detail |
| POST | `/social/posts/:id/media` | ✅ Approved | Add media |
| POST | `/social/posts/:id/publish` | ✅ Approved | Publish/schedule |
| POST | `/social/posts/:id/cancel` | ✅ Bearer | Cancel |
| GET | `/social/posts/:id/analytics` | ✅ Bearer | Pull analytics |

#### Mint AI
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/ai/models` | ✅ Bearer | All models + live traffic |
| GET | `/ai/models/traffic/:openrouterId` | ✅ Bearer | Single model traffic |
| POST | `/ai/generate` | ✅ Bearer | Generate (all tools) |
| GET | `/ai/generations` | ✅ Bearer | History |
| GET | `/ai/generations/:id` | ✅ Bearer | Single result |
| GET | `/ai/usage` | ✅ Bearer | Credits + rate limit |
| GET | `/ai/admin/stats` | ✅ Admin | Full analytics |
| GET | `/ai/admin/models/:modelId/stats` | ✅ Admin | Model analytics |
| GET | `/ai/admin/openrouter/browse` | ✅ Admin | Browse 400+ models |
| POST | `/ai/admin/models` | ✅ Admin | Add model |
| PATCH | `/ai/admin/models/:modelId` | ✅ Admin | Edit model |
| PATCH | `/ai/admin/models/:modelId/toggle` | ✅ Admin | Enable/disable |

#### Add-On Plans
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/addons/plans` | ✅ Bearer | Available plans |
| GET | `/addons/my` | ✅ Bearer | My active addons |
| POST | `/addons/purchase` | ✅ Client | Buy plan (wallet deduct) |
| GET | `/addons/check/:feature` | ✅ Bearer | Check feature access |
| GET | `/addons/admin/plans` | ✅ Admin | All plans + stats |
| POST | `/addons/admin/plans` | ✅ Admin | Create plan |
| PATCH | `/addons/admin/plans/:planId` | ✅ Admin | Edit plan |
| GET | `/addons/admin/plans/:planId/subscribers` | ✅ Admin | Subscribers |

#### Freelancer Marketplace
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/freelancers` | ✅ Client + Addon | Browse |
| GET | `/freelancers/:freelancerId` | ✅ Client + Addon | Full profile |
| PATCH | `/freelancers/me/marketplace` | ✅ Freelancer | Update marketplace profile |

#### Packages
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/packages` | ✅ Freelancer | My packages |
| PUT | `/packages` | ✅ Freelancer | Upsert package |
| DELETE | `/packages/:packageType` | ✅ Freelancer | Remove |

#### Portfolio
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/portfolio` | ✅ Freelancer | My portfolio |
| POST | `/portfolio` | ✅ Freelancer | Add item (multipart) |
| PATCH | `/portfolio/:itemId` | ✅ Freelancer | Update |
| DELETE | `/portfolio/:itemId` | ✅ Freelancer | Delete |

#### Reviews
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/reviews` | ✅ Client | Submit review |
| GET | `/reviews/freelancer/:freelancerId` | ✅ Bearer | Reviews + summary |

#### Direct Inquiries
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/inquiries` | ✅ Client + Addon | Send inquiry |
| GET | `/inquiries` | ✅ Bearer | My inquiries |
| PATCH | `/inquiries/:id/respond` | ✅ Freelancer | Accept/decline |

---

## 📱 Social Media System — Full Audit (Phase 8 + Hardening)

### Meta App Status
| Item | Status |
|------|--------|
| App ID | 1509078710693292 |
| App Mode | Live ✅ |
| Business (Mint More Marketing) | Verified ✅ (ID: 1354367938420457) |
| Facebook Login product | Added ✅ |
| OAuth redirect URI | http://localhost:5000/api/v1/social/callback/facebook ✅ |
| OAuth flow end-to-end | Working ✅ (tested with admin account) |
| Page selection | Working ✅ |
| Instagram account selection | Working ✅ |
| Permission review screen | Working ✅ |
| Advanced Access (all permissions) | ⏳ Pending App Review submission |
| Screencast for App Review | ❌ Need to record |

### OAuth Scopes Requested
```
pages_show_list
pages_read_engagement
pages_manage_posts
instagram_basic
instagram_content_publish
instagram_manage_insights
public_profile
```

### Post-OAuth Token Flow
| Step | Status |
|------|--------|
| Code → short-lived token | ✅ |
| Short → long-lived token (60 days) | ✅ |
| Fetch Facebook Pages | ✅ |
| Fetch Instagram Business Account per page | ✅ |
| Fetch IG profile details | ✅ |
| Store in social_accounts table | ✅ |
| Page-level token stored per account | ✅ |
| Token refresh (7 days before expiry) | ✅ |
| `token_status` field on getMyAccounts | ✅ |
| `token_days_remaining` field | ✅ |

### Publishing Features
| Feature | Platform | Status |
|---------|----------|--------|
| Text post | Facebook | ✅ |
| Single image | Facebook | ✅ |
| Single video | Facebook | ✅ |
| Multi-image carousel | Facebook | ✅ |
| Single image | Instagram | ✅ |
| Single video | Instagram | ✅ |
| Carousel | Instagram | ✅ |
| Reels | Instagram | ✅ |
| Video upload + thumbnail | YouTube | ✅ |
| Shorts (#Shorts auto-tag) | YouTube | ✅ |
| Scheduled publishing | All | ✅ BullMQ delay |
| Cancel scheduled | All | ✅ BullMQ removal |
| Analytics pull | Facebook | ✅ |
| Analytics pull | Instagram | ✅ |
| Analytics pull | YouTube | ✅ |
| Facebook Stories | ❌ Not implemented |
| Instagram Stories | ❌ Not implemented |
| Facebook Reels | ❌ Not implemented |

### Production Hardening (added in audit)
| Feature | Status |
|---------|--------|
| Pre-flight token validation before posting | ✅ `validatePageToken()` |
| Pre-flight page access validation | ✅ `validatePageAccess()` |
| Pre-flight IG account type check (Business/Creator) | ✅ `validateIGAccount()` |
| Rate limit detection + backoff | ✅ `withRateLimitRetry()` — uses `Retry-After` header |
| Revoked permission detection | ✅ marks `is_active=false` + `last_error` |
| Disconnected page detection | ✅ marks `is_active=false` + `last_error` |
| Helpful IG Business account error message | ✅ step-by-step instructions |
| Facebook/IG webhook receiver | ✅ `social.webhook.js` |
| Permission revocation via webhook | ✅ marks accounts inactive |
| Webhook signature verification | ✅ sha256 HMAC |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` in env | ✅ |

### App Review — Permissions to Submit
| Permission | Advanced Access | Status |
|------------|----------------|--------|
| `pages_show_list` | Required | ⏳ Submit |
| `pages_manage_posts` | Required | ⏳ Submit |
| `pages_read_engagement` | Required | ⏳ Submit |
| `instagram_basic` | Required | ⏳ Submit |
| `instagram_content_publish` | Required | ⏳ Submit |
| `instagram_manage_insights` | Required | ⏳ Submit |
| `public_profile` | Auto-granted | Skip |

### App Review Checklist
| Item | Status |
|------|--------|
| Business verified | ✅ |
| App live | ✅ |
| Privacy policy URL | ✅ |
| App icon | ✅ |
| Facebook Login product | ✅ |
| Valid redirect URIs | ✅ |
| OAuth flow working | ✅ |
| Use case description per permission | ❌ Write before submitting |
| Screencast of full OAuth + publish flow | ❌ Record before submitting |
| Test FB Page + linked IG Business account | ❌ Need for screencast |

---

## 🛍️ Marketplace + Add-On System (Phase 10)

### Two Modes Coexist
```
Mode 1 — Controlled Matchmaking (FREE)
  Client posts job → Admin matching → Negotiation → Assignment

Mode 2 — Browse Marketplace (PAID ADD-ON)
  Purchase plan → Browse profiles → View packages/portfolio
  → Send direct inquiry → Freelancer responds
```

### Default Add-On Plans (admin can create more)
| Plan | Price | Duration |
|------|-------|----------|
| Browse — 7 Days | ₹199 | 7 days |
| Browse — 30 Days | ₹599 | 30 days |
| Browse — 90 Days | ₹1,299 | 90 days |

### Key Rules
- Wallet is deducted instantly on purchase — no Razorpay involved
- Re-purchase before expiry extends the existing expiry date
- `requireAddon('browse_freelancers')` middleware gates browse routes
- Freelancers must set `marketplace_visible = true` to appear in browse
- Review averages cached on users table, updated atomically per review

### Browse Filters
```
?sort=top_rated|most_reviews|newest|lowest_price
?category_id=UUID
?level=beginner|intermediate|experienced
?min_rating=4.0
?min_price=500&max_price=5000
?search=logo+designer
?page=1&limit=12
```

---

## 🤖 Mint AI System (Phase 9)

### Tool Types
| Tool | Description |
|------|-------------|
| `text` | Blog posts, ad copy, emails |
| `caption` | Social captions + hashtags |
| `video_script` | Reels/Shorts scripts |
| `repurpose` | 1 content → 5 platform formats |
| `image` | Marketing graphics, thumbnails |
| `video` | Text-to-video + image-to-video (13 models) |

### Key Rules
- All models stored in DB `ai_models` — admin adds/removes/edits via panel
- 5-minute in-memory cache, busted immediately on admin edit
- Credits deducted AFTER success only
- Failover: primary fails → lowest-load free model (credits = 0)
- Video: polls OpenRouter max 10 min, stores in Supabase Storage
- Rate limit: 20 req/hour per user (Redis TTL, configurable)

---

## 🟢 WhatsApp System (Phase 7)

### State Machine
```
Main Number:
  new_contact → welcome menu (1-6)
  awaiting_service → validate choice
  awaiting_brief → collect brief
  transferring → MMSTART-XXXX token → wa.me link

Category Number:
  awaiting_activation → validate token → create job → match
  active_job_chat → route to freelancer (anonymous)
  job_completed → redirect to main
```

### Numbers Status
| Number | Purpose | Status |
|--------|---------|--------|
| +1 415 523 8886 (Meta test) | MM Main (dev) | ✅ ID: 1092380853958380 |
| MM Videography | Video projects | ⏳ Need fresh SIM |
| MM Design | Design projects | ⏳ Need fresh SIM |

---

## 💰 Wallet System

### Rules
- **Only entry point:** Razorpay top-up → wallet balance
- **All spending from wallet:** escrow, addon purchases, AI credits
- Immutable transaction ledger (INSERT only)
- Auto-created for every new user via DB trigger

### Admin Controls
```bash
# Add balance (testing / corrections)
POST /wallet/admin/users/:userId/adjust
{ "amount": 10000, "note": "Test credit" }

# Remove balance
{ "amount": -500, "note": "Correction" }
```

### Transaction Types
| Type | Trigger |
|------|---------|
| `topup` | Razorpay webhook |
| `escrow_hold` | Admin approves deal |
| `escrow_release` | Job completed |
| `escrow_refund` | Job cancelled |
| `withdrawal` | Freelancer requests payout |
| `withdrawal_rejected` | Admin rejects |
| `adjustment` | Admin manual / addon / AI credits |

---

## 🧠 Matching Engine

### Scoring Formula
```
base = skill(0.40) + level(0.25) + rating(0.20) + fairness(0.15)
× workload_multiplier
+ new_freelancer_boost (+0.10)
+ idle_bonus (0.00–0.15)
+ kyc_bonus (+0.05)
+ profile_bonus (+0.05)
+ pricing_contribution (max 0.15)
clamped [0, 1]
```

### Constants
| Constant | Value |
|----------|-------|
| MAX_ACTIVE_JOBS | 5 (hard disqualifier) |
| TOP_N_CANDIDATES | 10 |
| MAX_NEGOTIATION_ROUNDS | 2 |
| NEW_FREELANCER_BOOST | +0.10 |

---

## 🔧 Bug Fixes Log

### FOR UPDATE + LEFT JOIN (Phase 4E)
```js
// Always lock without JOIN
await client.query(`SELECT * FROM jobs WHERE id = $1 FOR UPDATE`, [jobId]);
```

### admin.routes.js function name (Phase 4E)
```js
router.get('/jobs', jobController.adminListAllJobs);
```

### rawBody Buffer not string (Phase 7)
```js
let data = Buffer.alloc(0);
req.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
req.on('end', () => { req.rawBody = data.toString('utf8'); next(); });
```

### Social webhook raw body (Phase 8 audit)
Facebook social webhook mounted before `express.json()` in `app.js` — same pattern as Razorpay and WA webhooks.

---

## 🔐 Auth System

- Access Token: JWT 15min
- Refresh Token: JWT 7d — rotated on every use
- Logout: Redis blacklist (20min) + DB cleared
- RBAC: `authenticate` + `authorize('admin'|'freelancer'|'client')`
- Platform Gate: `requireApproved`
- Feature Gate: `requireAddon('feature_name')`
- Token Payload: `{ sub, email, role, iat, exp }`

---

## 🏗️ Key Architecture Decisions

| Decision | Reason |
|----------|--------|
| Session Pooler (IPv4) | Network only supports IPv4 |
| Wallet-only payments inside app | Single source of truth — Razorpay only for top-up |
| Pre-flight validation before social post | Catches expired/revoked tokens before API call |
| `withRateLimitRetry()` wraps all Meta calls | Respects `Retry-After` header, prevents blocks |
| `validatePageToken()` marks account inactive | User sees clear "reconnect" message instead of error |
| Facebook webhook receiver | Detects permission revocations in real-time |
| `token_status` + `token_days_remaining` | Frontend can warn user before token expires |
| AI models in DB not hardcoded | Admin adds/removes without code deploy |
| Model cache 5min + bust on edit | Fast reads, always fresh |
| Credits deducted after success | Never charge for failed generations |
| BullMQ for social + AI | Long async tasks cannot block HTTP |
| `Promise.allSettled` for multi-platform | Partial success better than total failure |
| Addon deducted from wallet | Wallet is universal payment layer inside app |
| Review averages cached on users | No JOIN needed in browse queries |
| `marketplace_visible` opt-in | Freelancers choose to appear — not forced |
| 404 not 403 for unmatched jobs | Prevents information leakage |
| `setImmediate` for all triggers | Trigger failures never affect main logic |
| WA handoff token single-use + 30min | Cannot reuse or share |
| Freelancer anonymous in chat | Client always sees "Mint More" |

---

## 📋 Resume Context (paste into new Claude chat)

```
You are a senior full-stack engineer continuing "Mint More" — a creative services SaaS for Indian businesses.

TECH: Node.js + Express + PostgreSQL (Supabase Session Pooler) + Redis + BullMQ +
      Supabase Storage + SSE + Razorpay + Meta WhatsApp Cloud API +
      Facebook/Instagram Graph API + YouTube Data API v3 + OpenRouter (AI)

DB: host=aws-1-ap-south-1.pooler.supabase.com port=5432 user=postgres.grnnqilqrzlnrtbfrpyx SSL=true

META APP: ID=1509078710693292, Business verified (Mint More Marketing ID=1354367938420457)
          App live, OAuth working, Advanced Access pending App Review submission

ALL 10 PHASES COMPLETE + PHASE 8 HARDENING:
- Phase 1:        Foundation
- Phase 2:        Auth (JWT + Redis blacklist + RBAC)
- Phase 3:        Profile + KYC (3-level, Supabase Storage)
- Phase 4A:       Admin (approval, levels, categories, dashboard)
- Phase 4B:       Jobs (lifecycle, role visibility, pricing_mode)
- Phase 4C:       Matching (scoring, pricing alignment)
- Phase 4D:       Negotiation (lock, 2-round, fallback, approval)
- Phase 4E:       Auto matching + visibility (404 unmatched)
- Phase 5:        Notifications (SSE + Redis + 15 types)
- Phase 6:        Wallet + Escrow (Razorpay top-up, escrow, withdrawals)
- Phase 7:        WhatsApp chat (state machine, handoff tokens, anonymous)
- Phase 8:        Social publishing (FB/IG/YT OAuth, BullMQ, analytics)
- Phase 8-audit:  Production hardening (token validation, rate limit retry,
                  revocation detection, FB webhook, IG account validation)
- Phase 9:        Mint AI (OpenRouter, text/image/video, admin panel, traffic)
- Phase 10:       Freelancer Marketplace + Add-On Plans

KEY RULES:
- Wallet is ONLY payment layer — Razorpay for top-up only
- Addon purchases deducted from wallet instantly
- Admin can adjust any user wallet: POST /wallet/admin/users/:userId/adjust
- Social: pre-flight validates token + page + IG account type before posting
- Social: withRateLimitRetry() wraps all Meta API calls
- Social: webhook at GET+POST /social/webhook/facebook (rawBody, before express.json)
- Social: getMyAccounts returns token_status (valid/expiring_soon/expired/unknown)
- AI models in DB (ai_models) — not hardcoded — admin controls all
- AI model cache 5min, busted on admin edit (bustModelCache())
- Credits deducted AFTER success only — failover = 0 credits
- FOR UPDATE never with LEFT JOIN
- active_jobs_count = workload; jobs_completed_count = historical
- Max negotiation rounds = 2
- Webhooks (Razorpay + WA + FB social) mounted BEFORE express.json()
- BullMQ: startPublishWorker() + startAIWorker() both in app.js
- requireAddon('browse_freelancers') gates GET /freelancers
- marketplace_visible = true required to appear in browse
- Review averages cached on users, updated atomically
- WA: MMSTART-XXXX only valid on category number (awaiting_activation)
- WA: freelancer always anonymous to client
- Notifications: in-app SSE only
- Response: { success, message, data } via apiResponse.js
- AppError for operational errors
- admin.routes.js: jobController.adminListAllJobs
- 404 not 403 for unmatched freelancer jobs

EXTERNAL STATUS:
- Meta Business: Verified ✅
- Facebook Login OAuth: Working ✅
- Facebook App Review (Advanced Access): ⏳ Not yet submitted
  → Need: screencast, use case descriptions per permission
- WhatsApp test number: +1 415 523 8886 (ID: 1092380853958380) seeded as MM Main
- WhatsApp real numbers: need 2 fresh SIMs
- YouTube OAuth: setup complete in Google Cloud Console
- OpenRouter: get API key from openrouter.ai

PENDING NEXT STEPS:
- Submit Meta App Review for Advanced Access (all 6 permissions)
- Record screencast for App Review
- WhatsApp real SIM numbers
- Production deployment
- Frontend integration
- Cron: expire client_addons (is_active=false on expires_at)
- Cron: refresh Facebook tokens 7 days before expiry
- Optional: Facebook/Instagram Stories publishing
- Optional: Facebook Reels publishing
```
