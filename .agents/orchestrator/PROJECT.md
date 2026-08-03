# Project: Mint-More SaaS - Calendar Page Upgrade (R1 - R4)

## Architecture
- Root directory: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas`
- Frontend: `mint-more-frontend`
  - Target: `src/pages/client/Calendar.jsx`
  - Source Reference: `src/pages/client/onboarding/PreviewApprovePage.jsx`
  - State hook: `src/pages/client/onboarding/useCalendarState.js` or equivalent calendar state

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Analysis | Analyze `Calendar.jsx`, `PreviewApprovePage.jsx`, `useCalendarState.js`, action buttons & modals | None | DONE |
| 2 | R1 & R4: UI Porting & Non-Destructive Refactor | Port edge-to-edge calendar grid, sidebar UI, format filters to `Calendar.jsx`. Comment out old JSX/logic blocks. | M1 | BLOCKED: Forensic Audit Failed (R4 Legacy code truncated/stubs inserted) |
| 3 | R2: Feature & Dropdown Integration | Expand `+` action button dropdown ("Schedule Post", "Custom Request", "Swap Topic"). Hook up swap modal. | M1, M2 | IN_PROGRESS (Code built, awaiting audit remediation) |
| 4 | R3: Instant Grid Rendering | Render calendar grid structure & dates instantly; populate fetched data asynchronously without UI jumps. | M1, M2 | IN_PROGRESS (Code built, awaiting audit remediation) |
| 5 | Verification & Peer Review | Build checks (`npm run build`), Reviewers verify UI match & action menu, Challengers test instant loading & swap logic. | M2, M3, M4 | RE-ITERATING (Iteration 2) |
| 6 | Forensic Integrity Audit | Systematic forensic check for genuine implementation, no hardcoded results, clean audit verdict. | M5 | RE-ITERATING (Iteration 2) |

## Code Layout
`mint-more-frontend/src/`
- `pages/client/Calendar.jsx`
- `pages/client/onboarding/PreviewApprovePage.jsx`
- `pages/client/onboarding/useCalendarState.js`
