# Mint More — Frontend

Production React frontend for the Mint More platform. Controlled matchmaking and negotiation SaaS for Indian creative businesses.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| HTTP | Axios |
| Styling | Plain CSS (design tokens) + Geist font |

---

## Project Structure

```
mint-more/
├── public/
│   └── favicon.ico
├── src/
│   ├── api/                     # All backend API calls
│   │   ├── client.js            # Axios instance, token refresh, interceptors
│   │   ├── auth.js              # Login, register, logout, me
│   │   ├── jobs.js              # Job CRUD, categories
│   │   ├── wallet.js            # Balance, transactions, top-up, withdraw
│   │   ├── negotiations.js      # Initiate, respond, admin approve/reject
│   │   ├── notifications.js     # List, unread count, mark read
│   │   ├── addons.js            # Plans, purchase, check feature access
│   │   ├── freelancers.js       # Browse, profile, reviews, inquiries
│   │   ├── packages.js          # Freelancer package CRUD
│   │   ├── portfolio.js         # Portfolio item CRUD + image upload
│   │   ├── social.js            # Social accounts, posts, publish
│   │   └── ai.js                # Models, generate, history, usage
│   │
│   ├── store/                   # Zustand stores
│   │   ├── auth.js              # user, tokens, isAuthed, isGuest
│   │   └── ui.js                # toasts, modals, notifs, AI progress
│   │
│   ├── hooks/
│   │   └── useSSE.js            # EventSource connection for real-time
│   │
│   ├── components/
│   │   ├── ui/                  # Primitive components
│   │   │   ├── Icon.jsx         # SVG icon set (40+ icons)
│   │   │   ├── Avatar.jsx       # Initials avatar
│   │   │   ├── StatusChip.jsx   # Job status badge
│   │   │   ├── Tabs.jsx         # Tab bar
│   │   │   ├── Modal.jsx        # Dialog with backdrop
│   │   │   ├── Toast.jsx        # Toast notification host
│   │   │   └── Skeleton.jsx     # Loading shimmer
│   │   │
│   │   ├── layout/              # App shell components
│   │   │   ├── AppShell.jsx     # Auth guard, layout wrapper, SSE init
│   │   │   ├── Sidebar.jsx      # Desktop nav (role-aware)
│   │   │   ├── Topbar.jsx       # Header: hamburger + wallet + bell
│   │   │   ├── MobileNav.jsx    # Bottom tab bar (5 tabs)
│   │   │   └── MobileDrawer.jsx # Slide-out full nav for mobile
│   │   │
│   │   └── shared/              # Feature components
│   │       ├── GuestBanner.jsx  # Demo mode / KYC status strip
│   │       ├── KycGate.jsx      # Gate wrapper for KYC-required features
│   │       ├── NotifPanel.jsx   # Notification dropdown
│   │       └── TopUpModal.jsx   # Razorpay wallet top-up flow
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   │
│   │   ├── client/              # Client role pages
│   │   │   ├── Dashboard.jsx    # Wallet card, active jobs, quick actions
│   │   │   ├── Jobs.jsx         # Job list with tabs
│   │   │   ├── PostJob.jsx      # 3-step brief creation form
│   │   │   ├── JobDetail.jsx    # Brief + negotiation + matching panels
│   │   │   ├── Wallet.jsx       # Balance hero + transaction table
│   │   │   ├── Addons.jsx       # Browse and purchase add-on plans
│   │   │   ├── Freelancers.jsx  # Marketplace browse (addon-gated)
│   │   │   ├── FreelancerProfile.jsx # Full profile, packages, reviews
│   │   │   ├── Social.jsx       # Connect accounts, create/schedule posts
│   │   │   └── MintAI.jsx       # AI generation with model selector
│   │   │
│   │   ├── freelancer/          # Freelancer role pages
│   │   │   ├── Dashboard.jsx    # Earnings, active jobs, new match alerts
│   │   │   ├── Jobs.jsx         # Matched briefs list
│   │   │   ├── JobDetail.jsx    # Initiate/respond to negotiation
│   │   │   ├── Wallet.jsx       # Earnings + withdrawal request
│   │   │   ├── MarketplaceProfile.jsx # Edit tagline, bio, visibility
│   │   │   ├── Packages.jsx     # Basic / Standard / Premium packages
│   │   │   ├── Portfolio.jsx    # Portfolio items + cover image upload
│   │   │   └── Inquiries.jsx    # Direct inquiry inbox
│   │   │
│   │   ├── admin/               # Admin role pages
│   │   │   ├── Dashboard.jsx    # Platform KPIs, pending deals queue
│   │   │   ├── Users.jsx        # User table, KYC review, wallet adjust
│   │   │   ├── Negotiations.jsx # Approve / reject deals
│   │   │   ├── Wallet.jsx       # Platform stats + withdrawal processing
│   │   │   └── AIPanel.jsx      # Model management + OpenRouter browser
│   │   │
│   │   ├── DemoEntry.jsx        # Landing page for unauthenticated users
│   │   └── Settings.jsx         # Profile, avatar, password, KYC status
│   │
│   ├── styles/
│   │   └── main.css             # Design tokens + all component styles
│   │
│   ├── utils/
│   │   └── format.js            # rupee(), timeAgo(), STATUS_META
│   │
│   ├── App.jsx                  # BrowserRouter + all routes
│   └── main.jsx                 # QueryClient + React root
│
├── index.html
├── vite.config.js
├── .env
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Backend running at `http://localhost:5000`

### Install

```bash
npm install
```

### Environment

Create `.env` in the project root:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### Run

```bash
npm run dev
# → http://localhost:5173
```

### Build

```bash
npm run build
npm run preview   # preview production build locally
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api/v1` | Backend API base URL |

---

## Authentication

Tokens are stored in `sessionStorage` under the key `mm_auth`. On every request the Axios interceptor reads the current `accessToken` from Zustand and attaches it as `Authorization: Bearer <token>`.

**Token refresh** — on a 401 response the interceptor calls `POST /auth/refresh` with the stored refresh token. Concurrent requests that 401 at the same time are queued and retried once the new token arrives. If refresh fails, the user is logged out and redirected to `/login`.

### Guest / Demo mode

Unauthenticated users land on `/demo` and can enter guest mode. Guest mode sets `isGuest: true` in the auth store with a fake user object. The app shell renders normally but:

- No real API calls for wallet or notifications
- Marketplace and freelancer browse show a `KycGate` upsell wall
- Topbar shows "Get started free" instead of the notification bell
- A black `GuestBanner` strip explains demo limitations

Guest state is **not** persisted — refreshing the page exits guest mode.

---

## Routing

Routes are defined in `App.jsx`. All authenticated and guest routes render inside `AppShell` which handles:

- Auth guard (redirect to `/demo` if neither authed nor guest)
- SSE connection lifecycle
- Wallet balance polling
- Toast host
- Notification panel
- Top-up modal

### Role-aware routes

Three wrapper components handle role-based rendering for shared paths:

| Path | Client | Freelancer | Admin |
|---|---|---|---|
| `/dashboard` | `ClientDashboard` | `FreelancerDashboard` | → `/admin` |
| `/jobs` | `Jobs` | `FreelancerJobs` | — |
| `/jobs/:id` | `ClientJobDetail` | `FreelancerJobDetail` | — |
| `/wallet` | `ClientWallet` | `FreelancerWallet` | — |

Admin routes (`/admin/*`) are wrapped in `<AdminOnly>` which redirects non-admins to `/dashboard`.

---

## State Management

### Auth store (`src/store/auth.js`)

```js
{
  user,           // full user object from backend
  accessToken,    // JWT, 15-minute expiry
  refreshToken,   // 7-day expiry
  isAuthed,       // true when real user is logged in
  isGuest,        // true in demo mode

  setAuth(user, accessToken, refreshToken),
  enterGuestMode(),
  logout(),
}
```

### UI store (`src/store/ui.js`)

```js
{
  toasts,          // active toast notifications
  showTopUp,       // top-up modal open
  showNotif,       // notification panel open
  notifs,          // in-memory notification list (from SSE)
  unreadCount,     // badge count on bell icon
  aiProgress,      // { [generationId]: { status, result_text, ... } }

  pushToast({ title, body, icon, tone }),
  setShowTopUp(bool),
  setShowNotif(bool),
  addNotif(notif),
  setUnreadCount(n),
  markAllNotifsRead(),
  setAIProgress(generationId, status, data),
}
```

---

## Real-Time (SSE)

`useSSE()` is called once in `AppShell`. It opens an `EventSource` to:

```
GET /notifications/stream?token=<accessToken>
```

EventSource cannot send headers so the token is passed as a query parameter. The backend validates it and streams newline-delimited JSON.

**Event types handled:**

| Type | Action |
|---|---|
| `notification` | Adds to notif list, shows toast for important types, invalidates relevant queries |
| `chat_message` | Invalidates chat query for that room |
| `ai_progress` | Updates `aiProgress` in UI store, invalidates generations on completion |

The connection auto-reconnects on drop (native EventSource behaviour). No user-visible error is shown on disconnect.

---

## Layout System

The app uses a CSS grid layout that never lets the body scroll:

```
┌─────────────────────────────────────────┐
│  .app  {display:grid; height:100vh;     │
│         overflow:hidden}                 │
│  ┌──────────┬──────────────────────────┐│
│  │ .sidebar │ main                     ││
│  │ 240px    │ {display:flex;           ││
│  │ sticky   │  flex-direction:column;  ││
│  │ height:  │  height:100vh;           ││
│  │ 100vh    │  overflow:hidden}        ││
│  │          │ ┌──────────────────────┐ ││
│  │          │ │ .topbar (sticky)     │ ││
│  │          │ ├──────────────────────┤ ││
│  │          │ │ GuestBanner (if any) │ ││
│  │          │ ├──────────────────────┤ ││
│  │          │ │ .page                │ ││
│  │          │ │ {overflow-y:auto}    │ ││
│  │          │ │  ← ONLY THIS SCROLLS│ ││
│  │          │ └──────────────────────┘ ││
│  └──────────┴──────────────────────────┘│
└─────────────────────────────────────────┘
```

On mobile (`< 768px`):
- `.app` gets class `mobile` → single column grid
- Sidebar is hidden
- `MobileDrawer` slides in from left on hamburger tap
- `MobileNav` bottom tab bar appears (5 tabs)

---

## Mobile Navigation

Two layers work together on mobile:

**Bottom nav** (`MobileNav.jsx`) — 5 quick-access tabs always visible:
- Client: Home / Jobs / AI / Chat / Wallet
- Freelancer: Home / Briefs / Chat / Portfolio / Earnings

**Drawer** (`MobileDrawer.jsx`) — full nav via hamburger (☰) in topbar:
- All sidebar routes including Marketplace, Social, Settings
- User info + sign out at the bottom
- Closes on backdrop tap or route navigation

---

## Wallet & Payments

Top-up flow (`TopUpModal.jsx`):

1. User selects preset amount or types custom
2. `POST /payments/topup/order` → returns `{ order_id, key_id, amount_paise }`
3. Razorpay checkout opens (script loaded dynamically if not present)
4. On payment success → `POST /payments/topup/verify` with Razorpay signature
5. TanStack Query invalidates `['wallet']` and `['transactions']`
6. Success screen shows in modal, auto-closes after 1.8 seconds

Withdrawal flow (`FreelancerWallet.jsx`):

1. Freelancer enters amount + bank/UPI details
2. `POST /wallet/withdraw` creates a pending withdrawal request
3. Admin reviews and approves/rejects from `/admin/wallet`

---

## Social Media

Connect flow:
- Facebook/Instagram: `GET /social/connect/facebook?token=<jwt>` → OAuth redirect
- YouTube: `GET /social/connect/youtube?token=<jwt>` → OAuth redirect
- After OAuth, backend stores the access token and account appears in the accounts list

Post creation (`CreatePostModal`) is a 3-step flow:
1. Content type + caption + hashtags + optional media upload
2. Select which connected platforms to publish to
3. Schedule a date/time or publish immediately

---

## Mint AI

Model selector shows all active models from `GET /ai/models` filtered by the selected tool type. Traffic status (idle/low/moderate/busy/high) is shown as a coloured dot.

Generation flow:
1. `POST /ai/generate` → returns `{ generation_id }`
2. Poll `GET /ai/generations/:id` every 2 seconds
3. SSE `ai_progress` events update `aiProgress` in UI store in parallel
4. On `status: completed` → display `result_text` or `result_url`

Result display:
- Text: formatted with copy button
- Image: displayed inline with download
- Video: `<video>` player with download

---

## Add-On Plans

Plans are fetched from `GET /addons/plans`. Purchase flow:

1. User clicks plan → confirmation modal shows wallet balance check
2. If sufficient: `POST /addons/purchase { plan_id }` → deducted from wallet immediately
3. If insufficient: amber warning, suggests top-up
4. On success: `['my-addons']` and `['wallet']` queries invalidated

The `browse_freelancers` feature is checked via `GET /addons/check/browse_freelancers` before rendering the freelancer browse page. Users without access see either:
- A `KycGate` wall (guests / unapproved accounts)
- An `AddonUpsell` wall (approved accounts without the addon)

---

## Admin

All admin routes are behind `<AdminOnly>` which checks `user.role === 'admin'`.

### Key admin capabilities

| Feature | How |
|---|---|
| Approve deals | `POST /negotiations/admin/jobs/:id/approve-deal` — holds escrow |
| Reject deals | `POST /negotiations/admin/jobs/:id/reject-deal` — re-matches job |
| KYC review | `PATCH /kyc/admin/review/:submissionId` |
| User approval | `PATCH /admin/users/:id/approval` |
| Wallet adjust | `POST /wallet/admin/users/:id/adjust` |
| Withdrawal process | `PATCH /wallet/admin/withdrawals/:id` |
| AI model toggle | `PATCH /ai/admin/models/:id/toggle` |
| Add AI model | `POST /ai/admin/models` |
| Browse OpenRouter | `GET /ai/admin/openrouter/browse` |

---

## Design System

All styles live in `src/styles/main.css`. No CSS modules, no Tailwind — pure CSS with custom properties.

### Key tokens

```css
--mint-500        /* primary brand colour */
--ink-950         /* near-black for headings */
--ink-500         /* muted text */
--paper           /* page background #fcfcfb */
--paper-tint      /* card background #f7f7f4 */
--hairline        /* border colour #e8e8e5 */
--font-display    /* Geist — headings */
--font-mono       /* Geist Mono — numbers, code */
--radius-md       /* 12px — cards */
--radius-lg       /* 16px — modals, panels */
```

### Utility classes

```
.row              flex row, gap 10px
.row.between      space-between
.stack            flex column, gap 12px
.stack-6          flex column, gap 24px
.grid-2 / 3 / 4   responsive grid
.h-display        display heading style
.h-1 / 2 / 3      heading sizes
.h-eyebrow        small caps label
.mono             monospace font
.muted            var(--ink-500)
.card             white bordered card
.card-ink         dark card
.card-mint        mint tinted card
.badge.*          status chips (neutral/mint/amber/violet/rose/sky)
.btn.*            button variants (primary/mint/ghost/link/danger)
.reveal           entrance animation (stagger with data-d="0..12")
.skeleton         shimmer loading placeholder
```

---

## Common Patterns

### Fetching data

```jsx
const { data, isLoading } = useQuery({
  queryKey: ['jobs'],
  queryFn: () => jobsApi.list().then(r => r.data.data.jobs || []),
})
```

### Mutating with toast feedback

```jsx
const { mutate, isPending } = useMutation({
  mutationFn: () => jobsApi.create(data),
  onSuccess: () => {
    pushToast({ title: 'Brief posted!', icon: 'check' })
    queryClient.invalidateQueries({ queryKey: ['jobs'] })
    navigate('/jobs')
  },
  onError: (err) => {
    pushToast({
      title: 'Failed',
      body: err.response?.data?.message || 'Try again',
      tone: 'amber',
      icon: 'x',
    })
  },
})
```

### Backend response shape

The backend wraps all responses as `{ success, data: { ... } }`. Access payload with:

```js
const res = await api.get('/jobs/123')
const job = res.data?.data?.job ?? res.data?.data ?? null
```

### Adding a new page

1. Create `src/pages/<role>/PageName.jsx`
2. Add API calls in `src/api/<domain>.js`
3. Import page in `App.jsx` and add `<Route>`
4. Add nav item to `Sidebar.jsx` and `MobileDrawer.jsx`

---

## Build & Deploy

```bash
# Production build
npm run build
# Output: dist/

# Preview locally
npm run preview
```

The `dist/` folder is a standard Vite SPA build. Deploy to any static host (Vercel, Netlify, S3+CloudFront). Configure the host to serve `index.html` for all routes (SPA fallback).

### Vercel

```json
// vercel.json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Nginx

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

## Known Limitations

- **Chat page** is a stub (`/chat` → "Coming soon"). WhatsApp-bridged chat is built on the backend but the frontend UI is not yet implemented.
- **Guest mode AI** requires the backend to allow unauthenticated requests to `POST /ai/generate`. If the backend enforces auth, guests will see a "Sign in to use Mint AI" toast.
- **Razorpay** requires the backend `.env` to have valid `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. In development, use Razorpay test keys.
- **Social OAuth** redirects go through the backend (`/social/connect/facebook?token=...`). The token is passed in the query string — valid for the OAuth handshake duration only.
- **SSE token** is passed as a query parameter because `EventSource` does not support custom headers. The backend should validate and expire this token promptly.

---

## Dependencies

```json
{
  "react": "^18",
  "react-dom": "^18",
  "react-router-dom": "^6",
  "@tanstack/react-query": "^5",
  "axios": "^1",
  "zustand": "^4"
}
```

Dev:
```json
{
  "vite": "^5",
  "@vitejs/plugin-react": "^4"
}
```