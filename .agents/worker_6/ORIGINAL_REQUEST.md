## 2026-08-01T07:54:28Z
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You are Worker 6 for the Calendar Page Upgrade mission.
Your working directory is c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\worker_6

Your mission is to upgrade `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\Calendar.jsx` to satisfy requirements R1, R2, R3, and R4.

Before modifying code, carefully read the 3 Explorer handoff reports:
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_7\handoff.md` (UI Porting R1 & Non-Destructive Refactoring R4)
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_8\handoff.md` (Action Menu Dropdown R2 & Swap Topic Modal)
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_9\handoff.md` (Instant Grid Rendering R3 & Inline Skeleton Hydration)

Requirements Breakdown:
- R1. Port Premium UI Elements: Migrate sleek calendar grid, sidebar UI, and format filters (`All`, `Reels`, `Carousels`, `Posts`) from `PreviewApprovePage.jsx` into `Calendar.jsx` with dense edge-to-edge layout (`grid-cols-[1fr_360px] border-t border-l border-hairline`). Ensure hovering a tile highlights the sidebar item and auto-scrolls it into view via `sidebarItemRefs.current[dateKey].scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
- R2. Feature Integration: Expand the existing `+` action button dropdown in day cells to contain 3 items: "Schedule post", "Custom request", and "Swap topic" (with `<Icon name="refresh" size={13} />`). Wire up `openSwapModal` and render the `SwapTopicModal` (with tabs: Unused Topics, Other Festivals, Custom Request).
- R3. Instant Rendering (No UI Jumps): Decouple `baseGridCells` calculation so calendar structural grid, weekday headers, and date numbers (1..31) render synchronously / instantly on frame 0. Asynchronous data (`creativeData`, `socialData`) populates into day cells using inline cell skeleton placeholders (`.cal-inline-skeleton-bar`) when loading, ensuring zero layout shifts or whole-grid skeleton flashes.
- R4. Non-Destructive Refactoring: Do NOT delete old UI/logic code blocks in `Calendar.jsx`. Wrap them in `{/* R4 LEGACY: ... */}` / `/* R4 LEGACY: ... */` comment tags so the user can easily inspect or revert.

Verification:
After completing edits, execute the frontend build to verify zero syntax/compilation errors:
Run `npm run build` inside `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend`.

Report:
Write your handoff report to `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\worker_6\handoff.md` including build command output, and message the parent with your results.
