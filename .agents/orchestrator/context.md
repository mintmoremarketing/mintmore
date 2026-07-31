# Context Notes

## Project Overview
Restoring edge-to-edge calendar UI and interactive sidebar into `PreviewApprovePage.jsx` within `mint-more-frontend/src/pages/client/onboarding`.

## Key Files to Investigate
- `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`
- `mint-more-frontend/src/pages/client/onboarding/Onboarding.jsx` (or legacy version/backups/git history if present)
- `mint-more-frontend/src/pages/client/onboarding/useOnboardingContext.js` or state context files
- Other components in `mint-more-frontend/src/pages/client/onboarding/`

## Requirements Summary
- Calendar UI: Edge-to-edge calendar grid, format pills (Reels, Carousels, Posts), no margins/rounded corners isolating top/left edges.
- Sidebar: Dual-mode functionality (Default scrollable topic list, Hover date focus, Accordion inline expansion with Swap button).
- State: Integrate calendar state cleanly into onboarding context / state architecture.
