# Calendar UI and Interactive Sidebar Investigation Report

## 1. Observation

### Key Codebase Discoveries & File Locations
1. **Current Step 12 Implementation (`PreviewApprovePage.jsx`)**:
   - **Path**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\onboarding\PreviewApprovePage.jsx`
   - **Lines 67–98**: Renders a basic 7-column calendar grid inside a rounded box (`grid grid-cols-7 gap-px bg-ink-200 border border-ink-200 rounded-xl`).
   - **Lines 82–95**: Generates generic post cards (`w-full aspect-[4/3] rounded bg-ink-100 mb-1.5 flex items-center justify-center`) without format pills (`Reels`, `Carousels`, `Posts`).
   - **Lines 100–133**: Displays a centered modal overlay on click instead of an interactive dual-mode sidebar.
   - **Deficit**: Lacks edge-to-edge layout, format pills, scrollable topic list, hover date focusing, inline accordion expansion, and swap topic workflow.

2. **Parent Context & Layout Wrapper (`Onboarding.jsx`)**:
   - **Path**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\Onboarding.jsx`
   - **Lines 886–890**:
     ```jsx
     <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 md:px-16 md:py-10">
       <div className="w-full max-w-[640px] mx-auto lg:mx-0">
         <Outlet context={onboardingContext} />
       </div>
     </div>
     ```
   - **Observation**: The `Outlet` is currently constrained inside `max-w-[640px]`, which prevents `PreviewApprovePage.jsx` from spanning edge-to-edge across the screen.

3. **Legacy Calendar Architecture & Refactoring Scripts (`fix_step12.cjs` & `refactor.cjs`)**:
   - **Paths**:
     - `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\fix_step12.cjs`
     - `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\refactor.cjs`
   - **Lines 19–272 in `fix_step12.cjs`**: Contains the full legacy implementation of Step 12:
     - **Calendar Grid**: 28-day 4-week grid (`grid grid-cols-7 gap-2 flex-1`) with format pills (`Reel`: `bg-pink-500 text-white`, `Carousel`: `bg-blue-500 text-white`, `Post`: `bg-orange-500 text-white` / `bg-mint-500 text-white`).
     - **Selected Day State**: `selectedDayIndex` highlights date cell with `bg-mint-500/10 border-mint-500 ring-2 ring-mint-500/30`.
     - **Right Side Panel**: Dark sidebar (`w-full lg:w-[340px] bg-gradient-to-b from-ink-950 to-ink-900 text-white`).
     - **Dual-Mode Sidebar**:
       - *Default Mode* (`selectedDayIndex === null`): Scrollable list of scheduled topics. Clicking a topic toggles `expandedTopicIndex` (inline accordion) showing description and `"Swap Scheduled Topic"` button.
       - *Focused / Hover View Mode* (`selectedDayIndex !== null` or `hoveredDayIndex !== null`): Displays full topic details for the active day.
     - **Swap Topic Modal**: Modal with tabs (`Other Festivals`, `Unused Topics`, `Custom Request`) allowing topic replacement.

---

## 2. Logic Chain

1. **Observation**: `PreviewApprovePage.jsx` was simplified during the modular split from `Onboarding.jsx`, resulting in a basic grid bounded within `max-w-[640px]`.
2. **Deduction**: Restoring R1 (Calendar UI edge-to-edge + format pills) requires:
   - Eliminating or overriding the `max-w-[640px]` wrapper constraint in `Onboarding.jsx` for Step 12 (`PreviewApprovePage.jsx`).
   - Re-implementing the 28-day calendar grid with format pills (`Reel`, `Carousel`, `Post`) with appropriate badge colors.
3. **Deduction**: Restoring R2 (Interactive Dual-mode Sidebar) requires:
   - Implementing sidebar state (`hoveredDayIndex`, `selectedDayIndex`, `expandedTopicIndex`, `swapModalOpen`, `swapDayIndex`, `swapTab`, `customSwapText`).
   - Render dual modes:
     - Default mode: Scrollable list of scheduled topics with inline accordion expansion and "Swap Scheduled Topic" button.
     - Focused mode: Triggered by hovering or clicking a calendar day cell, focusing the sidebar on that day's scheduled topic details.
4. **Deduction**: Satisfying R3 (Modularity & State Architecture) requires:
   - Elevating calendar state (`scheduledDays`, `selectedDayIndex`, `hoveredDayIndex`, `expandedTopicIndex`, `swapModalOpen`, `swapDayIndex`, `swapTab`, `customSwapText`, `setScheduledDays`, `handleSwapTopic`) into `Onboarding.jsx` state or a dedicated context hook.
   - Exposing state through `onboardingContext` via `useOnboardingContext.js`.
   - Seeding `scheduledDays` upon generation (Step 11 completion or `posting_frequency` change) so data seamlessly flows into `PreviewApprovePage.jsx`.

---

## 3. Caveats

- **Theme Consistency**: Legacy code in `fix_step12.cjs` used Tailwind `orange-500` classes in some areas. The implementer should align all highlight colors and buttons with the Mint More design tokens (`var(--mint-500)`, `bg-mint-500`, `text-mint-600`, `bg-mint-50/30`, `var(--ink-950)`).
- **Date Handling**: The legacy code used static date offset calculation `15 + i`. The implementer can make this dynamically map to a standard 4-week (28-day) calendar starting from the current week's Sunday.

---

## 4. Conclusion

To restore the edge-to-edge Calendar UI and Interactive Sidebar in `PreviewApprovePage.jsx`:

1. **State Architecture (`Onboarding.jsx`)**:
   - Add state: `scheduledDays`, `selectedDayIndex`, `hoveredDayIndex`, `expandedTopicIndex`, `swapModalOpen`, `swapDayIndex`, `swapTab`, `customSwapText`.
   - Provide an initializer/generator function that populates `scheduledDays` using `form.posting_frequency` and `form.selected_festivals`.
   - Expose state and handlers in `onboardingContext`.

2. **Layout Container Adjustment (`Onboarding.jsx`)**:
   - Update `Onboarding.jsx` so that Step 12 is rendered full-width/full-height (edge-to-edge) without `max-w-[640px]` wrapper bounds.

3. **Component Restoration (`PreviewApprovePage.jsx`)**:
   - Re-architect `PreviewApprovePage.jsx` into a flex layout:
     - **Left Section**: Full height scrollable area with header + 7-column Calendar Grid with format pills (`Reel`, `Carousel`, `Post`) and hover/click event listeners.
     - **Right Section**: Dark interactive sidebar with default scrollable topic list, hover date focus view, accordion expansion, and "Swap Scheduled Topic" action.
     - **Swap Modal**: Modal dialog for swapping topics with "Other Festivals", "Unused Topics", and "Custom Request" tabs.

---

## 5. Verification Method

1. **File Inspection**:
   - Verify `PreviewApprovePage.jsx` renders both left calendar grid and right interactive sidebar.
   - Verify `Onboarding.jsx` includes calendar state in `onboardingContext`.
2. **Build Validation**:
   - Run `npm run build` in `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend` to verify no JSX, import, or React Hook errors occur.
3. **Behavioral Checks**:
   - Verify grid displays format pills (`Reel`, `Carousel`, `Post`).
   - Verify hovering/clicking dates focuses sidebar.
   - Verify clicking sidebar card expands accordion and opens Swap modal.
