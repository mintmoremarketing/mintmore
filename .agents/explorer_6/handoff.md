# Handoff Report: Requirements R4 & R5 (UI/UX Click-to-Swap & Sidebar Hover Auto-Scroll)

**Author**: Explorer 6  
**Target Path**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_6\handoff.md`  
**Date**: 2026-07-31  
**Status**: Completed (Hard Handoff)

---

## 1. Observation

Direct observations from codebase inspection of `mint-more-frontend`:

- **File**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`
  - **Tile Click Handling** (Lines 140–144):
    ```javascript
    onClick={() => {
      if (day.topic?.id) {
        setExpandedTopicId(expandedTopicId === day.topic.id ? null : day.topic.id)
      }
    }}
    ```
    *Observation*: Currently only toggles `expandedTopicId` state, requiring users to look for the Swap button in the right sidebar.
  - **Modal Triggering** (Lines 317–326):
    ```javascript
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        openSwapModal(day.dateKey)
      }}
      className="btn secondary sm w-full mt-2 flex items-center justify-center gap-1.5"
    >
      <Icon name="refreshCw" size={12} /> Swap Scheduled Topic
    </button>
    ```
    *Observation*: `openSwapModal(dateKey)` opens the swap modal targeting `dateKey`, but it is currently only bound to the sidebar item's internal button.
  - **Tile Hover Handling** (Lines 138–139):
    ```javascript
    onMouseEnter={() => setHoveredDateKey(day.dateKey)}
    onMouseLeave={() => setHoveredDateKey(null)}
    ```
    *Observation*: Updates `hoveredDateKey` state on hover.
  - **Sidebar Item Rendering** (Lines 227–241):
    ```javascript
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {scheduledDays?.filter(d => d.hasPost).map((day) => {
        const isHighlighted = hoveredDateKey === day.dateKey
        ...
    ```
    *Observation*: Sidebar list is scrollable (`overflow-y-auto`). When `hoveredDateKey` changes, `isHighlighted` updates visual styling (`ring-2 ring-mint-500 bg-mint-50/10`), but no scroll operation is triggered to bring off-screen items into view.

- **File**: `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
  - **Modal State Functions** (Lines 374–380):
    `openSwapModal(dateKey)` sets `swapModalState` to `{ isOpen: true, targetDateKey: dateKey }`.

---

## 2. Logic Chain

1. **Requirement R4 (Click-to-Swap)**:
   - *Premise*: Users want an immediate action when clicking a scheduled calendar day to swap its topic.
   - *Step 1*: `openSwapModal(dateKey)` already exists and handles setting target date state and opening the modal.
   - *Step 2*: Updating calendar tile `<div onClick>` (or topic card `onClick`) to invoke `openSwapModal(day.dateKey)` directly allows single-click modal opening focused on that specific date.
   - *Step 3*: Setting `setExpandedTopicId(day.topic.id)` alongside `openSwapModal` ensures sidebar accordion synchronization.

2. **Requirement R5 (Sidebar Hover Auto-Scroll)**:
   - *Premise*: Hovering a calendar tile should instantly draw attention to its topic details in the right-hand sidebar.
   - *Step 1*: `hoveredDateKey` is already updated on `onMouseEnter` of grid tiles.
   - *Step 2*: Storing DOM element references for sidebar cards using a `useRef` ref map indexed by `dateKey` enables direct imperative DOM element target access.
   - *Step 3*: React `useEffect` triggered on `hoveredDateKey` changes can look up `sidebarItemRefs.current[hoveredDateKey]` and execute `targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
   - *Step 4*: `block: 'nearest'` ensures smooth scrolling occurs only when the hovered topic is outside the visible container bounds, avoiding viewport jitter.

---

## 3. Caveats

- **Network Mode**: Operates in CODE_ONLY mode. Findings were established entirely via static code analysis of frontend source files.
- **Scroll Behavior Edge Cases**: On small screen sizes (`lg:hidden`), the sidebar stacks below the calendar grid. `block: 'nearest'` is essential so that hovering on mobile/tablet screens does not cause unexpected full-page viewport scroll jumps.
- **Filtered Topics**: When a format filter (e.g. Reels only) is active, `scheduledDays.filter(d => d.hasPost)` filters the sidebar list. The ref map cleanup inside `ref={(el) => ...}` ensures stale refs are removed properly.

---

## 4. Conclusion

- **R4 Implementation Path**: Update calendar tile click handlers in `PreviewApprovePage.jsx` to execute `openSwapModal(day.dateKey)` and `setExpandedTopicId(day.topic.id)`. Add hover swap affordance on topic card tiles.
- **R5 Implementation Path**: Add `sidebarItemRefs = useRef({})` to `PreviewApprovePage.jsx`, attach `ref={(el) => ...}` to sidebar topic item cards, and add a `useEffect` on `hoveredDateKey` calling `targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.

---

## 5. Verification Method

1. **Inspect Target Files**:
   - `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`
   - `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
2. **Independent Verification Commands**:
   - Run frontend dev server: `cd mint-more-frontend && npm run dev`
   - Navigate to `http://localhost:5173/onboarding/step-12`.
   - Test R4: Click any scheduled tile; confirm swap modal pops up instantly with target date pre-populated.
   - Test R5: Hover over tiles for day 20-28; confirm right sidebar smoothly auto-scrolls to the hovered card.
