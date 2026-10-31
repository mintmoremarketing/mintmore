# Creatyv handoff (31 Oct 2026)

Read this first, then `AGENTS.md` and `DESIGN.md`. The three design skills the user wants used for every UI change are in `.agents/skills/`:
- `impeccable`: the quality floor and craft rules.
- `emil-design-eng`: motion and interaction.
- `design-taste-frontend`: layout and frame.

## Project
- **Repo:** GitHub `mintmoremarketing/mintmore`, locally at `/home/user/mintmore` (it was `devdeepsaha/mintmore`; the redirect still works).
- **Apps:**
  - `mint-more-backend`: Express with `pg`, deployed on Railway.
  - `mint-more-frontend`: React, Vite, Tailwind, react-query and zustand, deployed on Vercel.
- **Work branch:** `claude/keen-newton-mpog2f`.
- **Deploying to main:** the branch and main share content but not history, so don't merge.
  1. `git fetch origin main`
  2. `git checkout -B deploy-tmp origin/main`
  3. `git cherry-pick <new commits>`
  4. `git diff claude/keen-newton-mpog2f --stat` must print nothing.
  5. `git push origin deploy-tmp:main`
- Push to main **only when the user says "push"**.
- **Database:** production is Supabase Postgres. Make only additive schema changes and don't change DB feature flags. The user runs SQL in Supabase themselves; give them the SQL to paste.
- **Local setup (cloud container):**
  - Postgres: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/pglocal/data -l /var/lib/pglocal/log -o '-p 5433 -k /tmp' start"`
  - Redis: `cd /tmp && redis-server --daemonize yes --save "" --dir /tmp`. Run it from `/tmp` so it doesn't write `dump.rdb` into the repo.
  - Backend: `cd mint-more-backend && node server.js`, on port 5000. The login rate limit is in memory, so restart the backend if logins return 429.
  - Frontend: `cd mint-more-frontend && npx vite --port 5173 --host 127.0.0.1`.
  - Local file storage is not available, so uploads fail locally. Test those in production.
- **Demo users** end in `@creatyv-demo.test`. Their passwords are in the git-ignored `mint-more-backend/scripts/.demo-accounts.json`; don't print them.

## Rules the user set
- Never print `.env` secrets. Never enter the user's real passwords.
- Don't touch the real order CRV-10007 or job 18c39631 (client@test.com).
- Hide features, don't delete them, and mark them `LAUNCH-HIDDEN` (`const SHOW_X = false`, never `false &&`).
- Don't add copy or features the user didn't ask for.
- Keep the UI minimal: sentence-case labels, no eyebrows, no tiny uppercase labels, and a word instead of a coloured dot.
- Easing is `cubic-bezier(0.23,1,0.32,1)`, motion only on entrance, and honour reduced motion.
- Page frame: `mx-auto w-full max-w-[1400px] px-4 py-8 md:px-8 md:py-10`.
- Use they/them for the user.

## SQL the user must run in Supabase (check with them whether it's done)
1. **`chat_rooms` moderation columns** (`mint-more-backend/src/db/migrations/070_chat_moderation.sql`). Flag, Warn and Close chat in the admin chat return 503 without it.
2. **Demo client photos** (`src/db/manual-only/071_demo_client_files.sql`). Main must have commit `67e2859` (demo photos served from `public/demo-files`) first.
3. **Demo KYC for 3 testers** (`src/db/manual-only/072_demo_kyc_for_assessment_testers.sql`). Already given to the user.

## Latest work (commit `ecd602b`, on the branch; check whether it's on main)
These are fixes from user testing on iPhone Safari:
- **Freelancer phone navigation** (`components/layout/MobileNav.jsx`):
  - The bottom bar has Home (`/home`, the dashboard), Explore (`/dashboard`), Work, Chat and Menu.
  - Menu opens a sheet with My services, Earnings (`/settings/freelancer?tab=earnings`), Assessments, Upskill, Inbox, Profile, Edit profile, Settings, Support, the profile checklist and sign out.
  - On phones the top bar no longer shows Chat or the account menu.
- **Profile checklist** (`ProfileCompletion.jsx`): no floating bar on phones any more. The sheet opens from Menu and from the dashboard card (`OPEN_COMPLETION_EVENT`).
- **iPhone Safari:**
  - `viewport-fit=cover` in `index.html`.
  - Safe-area padding on the top and bottom bars (`AppShell.jsx`).
  - Fields are 16px on touch screens, date fields can shrink, and taps use `touch-action: manipulation` (end of `styles/main.css`).
- **KYC** (`KycModal.jsx`): the form reset to step one on every re-render of its parent, which looked like the page vanishing. It now resets only when it opens.
- **Video posts:**
  - The portfolio route accepts MP4, MOV, M4V and WebM up to 50 MB in `media`. The cover must be an image.
  - The form grabs a cover frame in the browser (`pages/freelancer/Portfolio.jsx`).
  - Video posts play muted in Explore and get a badge on the profile grid (`components/freelancer/postMedia.js`).
- **After an assessment:**
  - The completion API's services step has a `qualified` field.
  - `OptInPrompt.jsx` shows "You aren't offering any services yet / Opt in now" on Dashboard (`pages/freelancer/Home.jsx`), My Work and Assessments.
- **Passwords:**
  - One rule everywhere: 8+ characters with uppercase, lowercase, a number and a special character.
  - Server side: `src/utils/passwordPolicy.js`. Frontend: `utils/passwordPolicy.js` and `components/ui/PasswordChecklist.jsx`.
  - The new `POST /auth/change-password` is used by Settings. The old call went to `PATCH /profile/me`, which ignored the password and still said it changed.
  - Signup, reset and admin-created accounts use the same rule.

## What the user asked for next
- The phone-level fixes above are done. The user said that once phone is sorted, they'll move on to **desktop-level fixes**. Ask them for their desktop list.
- **Still worth checking on a real iPhone** (no WebKit was available here; testing used Chromium in iPhone mode):
  - the Menu sheet;
  - KYC submit;
  - video post upload and cover grab;
  - the client Services and service detail pages;
  - the purchased-orders page.

## Earlier this session (all on main unless noted)
- **Purchases:** multi-order purchases with a separate brief per order, and "Save for later". The purchased-orders page has a fixed order list.
- **First drafts:** video orders take MP4/MOV/M4V/WebM and other orders take JPG/PNG. Admins review them in Operations > First drafts.
- **Delivery downloads:** locked until the client approves. The server refuses `?download=1` and share pages, and blocks non-previewable files.
- **Order chat:**
  - Links are clickable and blue.
  - Search sits in the header.
  - Brief files show as tiles in the order panel.
  - One shared full-screen viewer (`components/ui/MediaViewer.jsx`) serves Files and chat.
- **Admin chat:**
  - Grouped by client or freelancer, with a flag icon.
  - Flag, Warn, Close and Reopen, all written to the audit log.
  - A Client view / Freelancer view switch.
- **Client pages:** a month-grouped Files gallery and a cleaner My orders list.
- **Layout:** freelancer pages use the shared 1400px frame, and My services has categories in a sidebar.
