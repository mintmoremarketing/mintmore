## 2026-07-31T15:58:49Z
Implement calendar state management and restore the edge-to-edge calendar UI and interactive sidebar in `PreviewApprovePage.jsx`.

Refer to the handoff reports from the explorers:
- Explorer 1 handoff: c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_1\handoff.md
- Explorer 2 handoff: c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_2\handoff.md
- Explorer 3 handoff: c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_3\handoff.md

Detailed Steps:
1. Create `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\onboarding\useCalendarState.js`:
   - Implement topic generation (`generateTopicsForBrand(form)`) tailored to `form.business_name` and `form.business_type`.
   - Manage state: `topics`, `approvedTopicIds`, `calendarOverrides`, `hoveredDateKey`, `expandedTopicId`, `formatFilter`, `swapModalState`.
   - Compute `scheduledDays` (28-day grid starting from nearest Sunday, matching posting frequency 1/3/5/7, applying `calendarOverrides`).
   - Export action handlers: `handleSwapTopic`, `toggleTopicApproval`, `setHoveredDateKey`, `setExpandedTopicId`, `setFormatFilter`, `openSwapModal`, `closeSwapModal`.

2. Update `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\Onboarding.jsx`:
   - Import `useCalendarState` from `./onboarding/useCalendarState`.
   - Call `const calendarState = useCalendarState(form, onboardingEvents)`.
   - Spread `calendarState` into `onboardingContext` passed to `<Outlet context={onboardingContext} />`.
   - Ensure the container wrapper allows Step 12 (`PreviewApprovePage.jsx`) to expand to full-bleed edge-to-edge layout without being restricted by `max-w-[640px]`.

3. Update `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\onboarding\PreviewApprovePage.jsx`:
   - Consume state and actions from `useOnboardingContext()`.
   - **R1: Calendar UI Restoration**: Restore the 28-day edge-to-edge calendar grid with format pills (`All`, `Reels` 📹, `Carousels` 🖼️, `Posts` 📝). Ensure the calendar panel has no outer margins or rounded corners isolating top or left edges.
   - **R2: Interactive Sidebar Integration**:
     - Implement right-hand sidebar with dual-mode functionality:
       - Default mode: Scrollable list of scheduled topics across the plan.
       - Hover mode: Hovering a calendar date cell highlights the date cell and focuses sidebar on that day's topic.
       - Click to Expand: Clicking a topic card expands inline accordion view showing details and the "Swap Scheduled Topic" button.
     - Include Swap Scheduled Topic modal/dialog allowing topic selection or custom topic entry, calling `handleSwapTopic(dateKey, newTopicId)`.
   - **R3: Modularity and State Management**: Cleanly integrate state via `useOnboardingContext()`.

4. Run build verification:
   - Run `npm run build` in `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend`.
   - Verify build succeeds with exit code 0 and no compilation errors.

5. Document all changes and build results in `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\worker_1\handoff.md`.
6. Update `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\worker_1\progress.md`.
7. Send a completion message back to parent using `send_message` with summary and handoff path.
