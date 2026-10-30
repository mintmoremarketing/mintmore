# Creatyv session handoff (30 Oct 2026)

Read this first, then `AGENTS.md`. The design skills are in `.agents/skills/` (impeccable, emil-design-eng, design-taste-frontend).

## Project
- Repo: `saas/`, GitHub `devdeepsaha/mintmore`. GitHub says it has moved to `mintmoremarketing/mintmore`; pushes still work through the redirect.
- Work branch: `creatyv-services-storefront`.
- Deploy with `git push origin creatyv-services-storefront:main`. Push **only** when the user says "Push it".
  - The frontend (`mint-more-frontend`, React, Vite, Tailwind) goes to Vercel at mintmore.vercel.app.
  - The backend (`mint-more-backend`, Express) goes to Railway at mintmore-production.up.railway.app.
- The database is the remote Supabase Postgres that production also uses. Make only additive changes, and don't change DB feature flags.
- File storage:
  - Production uses Cloudflare R2 (`STORAGE_PROVIDER=r2`).
  - The local `.env` uses Supabase storage, so anything uploaded through the local backend lands in Supabase.
- The local dev server is at http://localhost:5173 and calls a local API at localhost:5000.

## Rules the user set
- Never print `.env` secrets. Never enter the user's real passwords.
- Demo users end in `@creatyv-demo.test`. Their passwords are in the git-ignored `mint-more-backend/scripts/.demo-accounts.json`; don't repeat them.
- Don't touch the real order CRV-10007 or job 18c39631… (client@test.com).
- Hide features, don't delete them, and mark them `LAUNCH-HIDDEN`.
- Don't write copy or features the user didn't ask for.
- Keep UI minimal: no eyebrows, no tiny uppercase labels, and a word instead of a dot.
- Use they/them for the user.
- Ask before committing or pushing the editing-os-saas repo. Never give the licence or key to clients.

## Shipped in this session (all on main)
- **72662f9 First drafts.**
  - A freelancer sends an MP4 first draft, and an admin reviews it in Operations > First drafts.
  - The client sees it only after approval.
  - Also in this commit: chat search, the media gallery, the inline brief editor, and the `delivery_approved` notification.
- **7403841 and e2865c6 Creatyv Pro.**
  - The Pro tab shows "Creatyv Pro", "Coming soon" and an "Edit with AI today" button (`ProComingSoon.jsx`).
  - The tab has a "Soon" badge: a chip on screens `sm` and up, and a text line under the label on phones.
  - The orange hero text is warm brown (`--hero-ink`).
- **351dbc1, 23a930a and 796bd8a Ask-anything widget.** It closes on an outside click or Esc, the chips fold open and shut, and the panel grows out of the bar.
- **7d9ad71 Home hero.**
  - The search bar is hidden on `/` and `/services`.
  - The hero is just the headline, one line and an "Explore services" button.
  - Behind it, `SurfCards.jsx` runs a card wave ported from Surf mode in `kolkata-brand-news`. It uses 40 photos in `public/surf/*.webp`, listed in `surfPhotos.json`.
  - Each card's height comes from its photo. The wave runs from the top right, through the text, to the bottom left. Corners are sharp.
- **011d8a3** Assessment buttons grow to fit their label, with a 210px minimum.
- **4d5afad** Two fixes:
  - **Old chat files:** 24 of 25 are stored in Supabase but production signs R2 URLs, so they returned 404. `mintbox-storage.provider.js` now falls back to Supabase when a file isn't in R2. Not yet checked on the live site after deploy.
  - **Freelancers** get only "Send first draft" in the chat + menu (`canAttach = !completed && role !== 'freelancer'` in `OrderConversation.jsx`).
- 4ee34e8 (notification channels: web push, email, WhatsApp, migration 068) was added outside this session and hasn't been reviewed. `HANDOFF_NOTIFICATIONS.md` describes the notification setup.

## Open items
1. On the live site, confirm old chat videos and images play now (for example, the demo job 083e1056 chat).
2. Design and thumbnail freelancers can't send work, because first drafts are MP4-only. The user may want image drafts for design orders.
3. A delivery under review hides the client's download on purpose; download returns after approval. The user asked about this; nothing is broken.
4. editing-os-saas helper: it's committed locally as cc7aecc. It needs a GitHub repo URL from the user before it can be pushed.
5. Not started:
   - an AI tab category grid (4 categories with AI-only buttons);
   - both buttons on each service in the Hire tab;
   - rebuilding the helper zip for Railway and setting `VITE_AI_HELPER_URL`;
   - delivery protection options.
6. Untracked and uncommitted: the `.agents/` run folders, `HANDOFF_NOTIFICATIONS.md` and this file.

## Later in the session (also on main)
- **17a9820** Two fixes:
  - Chat files return `Cross-Origin-Resource-Policy: cross-origin` on the content redirect. Helmet's same-origin default had made browsers block every chat video and image. Confirmed playing on mintmore.vercel.app after the deploy.
  - The admin dashboard has a "First drafts to review" row that links to `/admin/operations?tab=first-drafts`.
- The demo order's "Delivery v1" (job 083e1056) is a 3 KB test file, not a real video, so it stays blank.
- The local backend needs Redis on 127.0.0.1:6379 to start.
