# Comprehensive Technical Investigation Report: Requirements R4 & R5

**Workspace**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas`  
**Target Module**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx` & `useCalendarState.js`  
**Author**: Explorer 6 (Mint-More SaaS Phase 2 Investigation)  
**Date**: 2026-07-31  

---

## Executive Summary

This report provides a read-only architectural and code-level investigation for Requirements **R4 (UI/UX Click-to-Swap)** and **R5 (Sidebar Hover Auto-Scroll)** in the Mint-More SaaS Autopilot Onboarding Flow. 

1. **Requirement R4**: Currently, clicking on a scheduled calendar tile only toggles the inline accordion expansion state of the topic in the right-hand sidebar. To swap a topic, users must manually find the expanded card in the sidebar and click the secondary "Swap Scheduled Topic" button. **Solution**: Update the click handler on calendar tiles to directly trigger `openSwapModal(day.dateKey)` (and sync sidebar selection) so that clicking a scheduled date instantly opens the Swap Topic modal focused on that specific date.
2. **Requirement R5**: Currently, hovering over a calendar tile sets `hoveredDateKey` and applies visual highlight styles (`ring-2 ring-mint-500 bg-mint-50/10`) to the corresponding card in the right-hand sidebar. However, because the sidebar list is scrollable (`overflow-y-auto`), topics scheduled later in the 28-day window are often below the visible fold. Hovering over those dates highlights an off-screen card without bringing it into view. **Solution**: Attach DOM element references (`useRef` map or `data-date-key` attributes) to sidebar topic items and implement a `useEffect` hook listening to `hoveredDateKey` that calls `Element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` to automatically bring hovered topics into view.

---

## Codebase Context & Component Architecture

- **Primary View Component**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`
- **State Provider Hook**: `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
- **Context Consumer**: `useOnboardingContext()` in `PreviewApprovePage.jsx` provides `scheduledDays`, `hoveredDateKey`, `expandedTopicId`, `swapModalState`, `openSwapModal`, `setHoveredDateKey`, `setExpandedTopicId`, and `handleSwapTopic`.

---

## Requirement R4: UI/UX Click-to-Swap Investigation

### 1. Current Implementation Inspection

In `PreviewApprovePage.jsx` (Lines 130–198), the calendar grid cells are rendered in a 7-column layout:

```javascript
// PreviewApprovePage.jsx (Lines 139-144)
<div
  key={day.dateKey}
  onMouseEnter={() => setHoveredDateKey(day.dateKey)}
  onMouseLeave={() => setHoveredDateKey(null)}
  onClick={() => {
    if (day.topic?.id) {
      setExpandedTopicId(expandedTopicId === day.topic.id ? null : day.topic.id)
    }
  }}
  className={`min-h-[110px] p-2 border-b border-r border-hairline flex flex-col transition-all cursor-pointer relative ...`}
>
```

#### Modal Trigger Mechanics
- In `useCalendarState.js` (Lines 374–376):
  ```javascript
  const openSwapModal = useCallback((dateKey) => {
    setSwapModalState({ isOpen: true, targetDateKey: dateKey })
  }, [])
  ```
- In `PreviewApprovePage.jsx` (Lines 317–326):
  Currently, `openSwapModal` is only invoked inside the right-hand sidebar's expanded accordion view:
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

### 2. Gap Analysis
- Clicking directly on a scheduled calendar tile only sets `expandedTopicId`. It requires 2 steps (click tile -> scroll sidebar -> click swap button) to swap a topic.
- Clicking on a scheduled tile should directly provide the primary action: **Instant Click-to-Swap Modal**.

### 3. Technical Solution for R4

Modify the calendar tile click handler in `PreviewApprovePage.jsx`. When a user clicks a calendar tile with a scheduled post:
1. Call `openSwapModal(day.dateKey)` immediately.
2. Automatically expand the topic in the sidebar by calling `setExpandedTopicId(day.topic.id)`.
3. Stop propagation if sub-elements (e.g. badges) are clicked.

#### Code Patch Proposal (R4)
```jsx
// In PreviewApprovePage.jsx (Lines 140-144)
onClick={(e) => {
  if (day.hasPost && day.topic?.id) {
    setExpandedTopicId(day.topic.id)
    openSwapModal(day.dateKey)
  }
}}
```
Optionally, add an inline quick-swap button / tooltip directly on hover of the topic card inside the calendar grid tile:
```jsx
// Inside topic card div (Line 171)
<div
  onClick={(e) => {
    e.stopPropagation()
    openSwapModal(day.dateKey)
  }}
  className="mt-auto p-2 rounded-lg border transition-all text-left bg-paper-tint border-hairline hover:border-mint-400 hover:shadow-xs group relative cursor-pointer"
>
  <div className="flex items-center justify-between gap-1 mb-1">
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ...`}>
      {day.format}
    </span>
    <span className="text-[10px] text-mint-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
      <Icon name="refreshCw" size={10} /> Swap
    </span>
  </div>
  <p className="text-[11px] font-bold text-ink-950 line-clamp-2 leading-tight">
    {day.topic?.title}
  </p>
</div>
```

---

## Requirement R5: Sidebar Hover Auto-Scroll Investigation

### 1. Current Implementation Inspection

In `PreviewApprovePage.jsx`:
- **Calendar Grid Hover Event**:
  ```javascript
  onMouseEnter={() => setHoveredDateKey(day.dateKey)}
  onMouseLeave={() => setHoveredDateKey(null)}
  ```
- **Sidebar Container Structure** (Lines 203–227):
  ```javascript
  <div className="bg-paper-tint flex flex-col border-b lg:border-b-0 border-hairline overflow-hidden shrink-0">
    {/* Header */}
    <div className="p-4 border-b border-hairline bg-paper ...">...</div>

    {/* Scrollable Topics Container */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {scheduledDays?.filter(d => d.hasPost).map((day) => { ... })}
    </div>
  </div>
  ```
- **Sidebar Highlight Behavior** (Lines 237–241):
  ```javascript
  const isHighlighted = hoveredDateKey === day.dateKey
  // Appled CSS: isHighlighted ? 'border-mint-500 ring-2 ring-mint-500/30 shadow-md bg-mint-50/10' : ''
  ```

### 2. Gap Analysis
- When hovering over dates in Week 3 or Week 4 (e.g. Day 20 to 28), the corresponding sidebar item is highlighted in state and DOM, but remains hidden below the fold in the `overflow-y-auto` sidebar container.
- No auto-scrolling logic is attached to `hoveredDateKey` changes.

### 3. Technical Solution for R5

To achieve automatic smooth scrolling when a calendar tile is hovered:
1. Maintain a ref map (`itemRefs = useRef({})`) or container ref (`sidebarContainerRef = useRef(null)`).
2. Attach refs or `data-date-key` attributes to each topic item in the scrollable sidebar list.
3. Add a `useEffect` hook listening to `hoveredDateKey`.
4. Trigger `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the target element when `hoveredDateKey` matches.

#### Code Patch Proposal (R5)

**Approach: React Ref Map (`useRef`)**

In `PreviewApprovePage.jsx`:

1. Add `useRef` import:
   ```javascript
   import React, { useState, useRef, useEffect } from 'react'
   ```
2. Create ref map inside component:
   ```javascript
   const sidebarItemRefs = useRef({})
   ```
3. Attach ref callback to each sidebar item card (Line 236):
   ```jsx
   <div
     key={day.dateKey}
     ref={(el) => {
       if (el) {
         sidebarItemRefs.current[day.dateKey] = el
       } else {
         delete sidebarItemRefs.current[day.dateKey]
       }
     }}
     className={`p-3.5 rounded-xl border transition-all bg-white ${
       isHighlighted
         ? 'border-mint-500 ring-2 ring-mint-500/30 shadow-md bg-mint-50/10'
         : 'border-hairline hover:border-hairline-strong'
     }`}
   >
   ```
4. Add `useEffect` for Auto-Scroll:
   ```javascript
   useEffect(() => {
     if (!hoveredDateKey) return
     const targetEl = sidebarItemRefs.current[hoveredDateKey]
     if (targetEl) {
       targetEl.scrollIntoView({
         behavior: 'smooth',
         block: 'nearest',
         inline: 'nearest',
       })
     }
   }, [hoveredDateKey])
   ```

Why `block: 'nearest'` is optimal:
- If the item is already visible inside the sidebar viewport, `block: 'nearest'` performs zero scroll movement, preventing unnecessary page jitter.
- If the item is above or below the visible container area, it smoothly scrolls the container just enough to bring the item into view.

---

## Architectural & UX Recommendations Summary

| Requirement | Current State | Proposed Enhancement | File / Location |
|---|---|---|---|
| **R4: Click-to-Swap** | Tile click toggles sidebar accordion expansion | Tile click directly executes `openSwapModal(day.dateKey)` & sets `expandedTopicId(day.topic.id)` | `PreviewApprovePage.jsx`:140-144, 171-195 |
| **R5: Sidebar Hover Auto-Scroll** | Hovering highlights card with CSS ring, but off-screen cards remain un-scrolled | `useEffect` on `hoveredDateKey` calling `targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` via Ref Map | `PreviewApprovePage.jsx`:1, 71, 236, new `useEffect` |

---

## Verification & Test Plan

1. **Verification of R4**:
   - Open `/onboarding/step-12` in browser.
   - Click on any scheduled calendar tile (e.g. Day 5 or Day 12).
   - Expected result: The "Swap Scheduled Topic" modal opens instantly with target date pre-focused (`Target date: YYYY-MM-DD`).

2. **Verification of R5**:
   - Scroll the calendar view or hover over day tiles near the bottom of the grid (e.g. Day 22–28).
   - Expected result: The right-hand sidebar automatically and smoothly scrolls to bring the hovered day's topic card into full visibility within the sidebar viewport.

