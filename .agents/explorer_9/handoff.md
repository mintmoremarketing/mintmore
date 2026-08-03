# Architectural Analysis & Handoff Report: Instant Grid Rendering & Async Data Population (R3)

## 1. Observation

### Key Codebase Elements & Findings

#### A. In `Calendar.jsx` (`mint-more-frontend/src/pages/client/Calendar.jsx`)
1. **Coupled Grid & Data Generation** (Lines 496–530):
   ```javascript
   const calendarCells = useMemo(() => {
     const creativeEvents = creativeData?.events || []
     const postsList = socialData?.posts || []
     // ...
   }, [creativeData, socialData, year, monthNum])
   ```
   The calculation of date cells (`key`, `dateKey`, `date`, leading blank cells, days of month) is currently coupled with `creativeData` and `socialData` inside a single `useMemo` hook.

2. **Whole-Grid Skeleton Blockade** (Lines 659–665):
   ```javascript
   {isLoading ? (
     <div className="cal-month-grid">
       {Array.from({ length: 35 }).map((_, i) => (
         <div key={i} className="cal-skeleton-cell" style={{ animationDelay: `${i * 18}ms` }} />
       ))}
     </div>
   ) : (
     <div className="cal-month-grid">
       {calendarCells.map(cell => ( ... ))}
     </div>
   )}
   ```
   When `isLoading` (`isCreativeLoading || isSocialLoading`) is `true`, the entire grid content is destroyed and replaced with 35 blank pulsing skeleton blocks. Date numbers (1..31), weekday alignment, "Today" badges, and action buttons (`+` menu) are hidden until network requests complete.

3. **Layout Shift & UI Flicker** (Lines 588–594 & 630–634):
   - Balance pill in header (`{!isLoading && (...) }`) and monthly post count in toolbar (`{!isLoading && (...) }`) pop into existence asynchronously, altering header/toolbar layout dimensions after mount.

#### B. In `PreviewApprovePage.jsx` (`mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`)
1. **Synchronous Grid Layout Structure** (Lines 143–237):
   - Renders fixed weekday headers (`Sun` through `Sat`).
   - Renders 42 deterministic cells (`scheduledDays.map(...)`) with fixed min-height (`min-h-[110px]`) and visible date numbers (`{day.dayNum}`) on initial mount.
   - Topics render inside `{day.hasPost && day.topic && !isFilteredOut && (...)}` without altering cell container structure or causing layout recalculations.

#### C. In `useCalendarState.js` (`mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`)
1. **Deterministic Synchronous Date Grid Generation** (Lines 245–359):
   - Computes calendar dates, past day status, today status, and date key strings deterministically using pure JS `Date` math, operating synchronously on frame 0.

---

## 2. Logic Chain

1. **Root Cause Identification**:
   - In `Calendar.jsx`, grid structural generation is gated behind API data promise resolution (`isCreativeLoading || isSocialLoading`).
   - Rendering 35 generic `<div className="cal-skeleton-cell">` boxes instead of true calendar cells removes date context for the user and forces a complete DOM re-render/reflow when API responses arrive.

2. **Decoupling Strategy**:
   - **Step A: Synchronous Structure Layer**: Compute `baseGridCells` based strictly on `year` and `monthNum`. This produces the exact sequence of leading blanks, active month date numbers (1..31), and trailing blanks instantly (0ms execution time).
   - **Step B: Asynchronous Data Layer**: Maintain indexed lookup maps (`postsByDateKey`, `eventsByDateKey`) populated reactively as `@tanstack/react-query` promises resolve.
   - **Step C: Cell-Level Inline Shimmer Hydration**: Render the static day cell frame (date number, `+` button, today highlight) immediately. When `isLoading` is true, render an inline shimmer placeholder (`<div className="cal-chip-skeleton" />`) *inside* the cell body content area instead of replacing the cell.

3. **Layout Stability & Jump Prevention**:
   - Cell outer container styling (`cal-day-cell`) remains identical whether data is loading or loaded.
   - Preserving consistent grid layout (`grid-template-columns: repeat(7, 1fr)`) and minimum cell heights ensures zero layout layout reflows or scroll jumps during state transitions.

---

## 3. Architecture Proposal & Proposed Code Changes

### Proposed `Calendar.jsx` Refactoring Plan

#### 1. Pure Synchronous Grid Calculation
Separate date grid calculation from data lookup:

```javascript
// 1. Synchronous Base Grid (Frame 0 render, 0ms execution)
const baseGridCells = useMemo(() => {
  const first = new Date(year, monthNum, 1)
  const days = new Date(year, monthNum + 1, 0).getDate()
  const leading = first.getDay()

  const cells = []
  for (let i = 0; i < leading; i++) {
    cells.push({ key: `blank-${i}`, blank: true })
  }
  for (let i = 1; i <= days; i++) {
    const date = new Date(year, monthNum, i)
    const dateKey = toLocalDateKey(date)
    cells.push({
      key: dateKey,
      dateKey,
      date,
      blank: false,
    })
  }
  return cells
}, [year, monthNum])

// 2. Asynchronous Data Indexing Maps
const postsByDate = useMemo(() => {
  const map = {}
  ;(socialData?.posts || []).forEach(post => {
    const ts = post.publish_at || post.published_at || post.created_at
    if (ts) {
      const key = toLocalDateKey(ts)
      if (!map[key]) map[key] = []
      map[key].push(post)
    }
  })
  return map
}, [socialData])

const eventsByDate = useMemo(() => {
  const map = {}
  ;(creativeData?.events || []).forEach(event => {
    if (event.event_date) {
      const key = toLocalDateKey(event.event_date)
      if (!map[key]) map[key] = []
      map[key].push(event)
    }
  })
  return map
}, [creativeData])
```

#### 2. Cell Rendering with Inline Skeleton Hydration

Replace whole-grid conditional rendering with inline cell content loading:

```jsx
{/* Calendar grid wrapper */}
<div className="cal-grid-wrap">
  <div className="cal-weekdays">
    {WEEKDAYS.map(d => <div key={d} className="cal-weekday-label">{d}</div>)}
  </div>

  <div className="cal-month-grid">
    {baseGridCells.map(cell => {
      if (cell.blank) {
        return <div key={cell.key} className="cal-day-cell blank" />
      }

      const isToday  = sameDay(cell.date, new Date())
      const isActive = cell.dateKey === activeCell?.dateKey
      const isPast   = isPastDay(cell.date)
      const dayPosts  = postsByDate[cell.dateKey] || []
      const dayEvents = eventsByDate[cell.dateKey] || []
      const hasPosts  = dayPosts.length > 0

      return (
        <div
          key={cell.key}
          role="button"
          tabIndex={0}
          className={[
            'cal-day-cell',
            isToday  && 'today',
            isActive && 'active',
            isPast   && 'past',
            hasPosts && 'has-posts',
          ].filter(Boolean).join(' ')}
          onClick={() => openCell({ ...cell, posts: dayPosts, events: dayEvents })}
        >
          {/* Day header row - ALWAYS RENDERED SYNCHRONOUSLY */}
          <div className="cal-day-header">
            <span className={`cal-day-num${isToday ? ' today' : ''}`}>
              {cell.date.getDate()}
            </span>
            {!isPast && (
              <div className="cal-day-add-wrap">
                <button type="button" className="cal-day-add" onClick={...}>
                  <Icon name="plus" size={11} />
                </button>
              </div>
            )}
          </div>

          {/* ASYNC CONTENT HYDRATION SLOT */}
          {isLoading ? (
            /* Inline Cell Skeleton Loader (preserves date header & cell size) */
            <div className="cal-cell-skeleton-wrap">
              <div className="cal-inline-skeleton-bar" style={{ width: '80%', height: '14px', borderRadius: '4px', marginTop: '6px' }} />
              <div className="cal-inline-skeleton-bar" style={{ width: '60%', height: '14px', borderRadius: '4px', marginTop: '4px' }} />
            </div>
          ) : (
            <>
              {/* Creative moments */}
              {dayEvents.length > 0 && ( ... )}

              {/* Platform summary bar */}
              {hasPosts && <PlatformBar posts={dayPosts} />}

              {/* Post chips */}
              {hasPosts && (
                <div className="cal-event-stack">
                  {dayPosts.slice(0, 3).map(post => (
                    <PostChip key={post.id} post={post} onClick={...} />
                  ))}
                  {dayPosts.length > 3 && (
                    <span className="cal-overflow-badge">+{dayPosts.length - 3} more</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )
    })}
  </div>
</div>
```

---

## 4. Caveats

1. **Month Navigation Transitions**: When switching months via `navigateMonth(+1 / -1)`, `@tanstack/react-query` will fetch data for the new month key (`YYYY-MM`). During refetching, React Query background fetching state (`isFetching`) can be used to keep existing month dates intact while showing subtle cell shimmers or keeping existing data until refetch completes.
2. **Css Shimmer Animation**: CSS rules for `.cal-inline-skeleton-bar` must be added to `Calendar.css` (or equivalent stylesheet) with keyframe pulse animation matching the existing theme palette (`var(--paper-deep)` / `var(--hairline)`).
3. **No Structural Code Modifications Undertaken**: Explorer 9 is operating in read-only analysis mode. Implementer agents should apply the proposed code structures.

---

## 5. Conclusion

Decoupling date grid generation from API payload resolution resolves the core UX flaw in `Calendar.jsx`. 
By generating `baseGridCells` synchronously on frame 0 and populating cell contents asynchronously with inline skeleton loaders, `Calendar.jsx` will achieve:
- **Instant Grid Mounting**: Date grid numbers, day of week labels, and day action controls render instantly.
- **Zero Layout Shift**: Structural geometry stays fixed before and after network request completion.
- **Enhanced Visual Feedback**: Shimmer placeholders operate cleanly inside cell boundaries.

---

## 6. Verification Method

### How to Verify Implementation

1. **Build & Lint Verification**:
   ```powershell
   cd "c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend"
   npm run build
   ```
2. **Network Throttling Simulation (Manual UI Test)**:
   - Open browser developer tools -> Network Tab -> select **Slow 3G**.
   - Navigate to `/calendar`.
   - **Expected behavior**: The calendar month grid (e.g. August 2026), weekday headers (`Sun`..`Sat`), date numbers (1..31), and today highlights MUST render immediately on frame 0.
   - **Expected behavior**: Inline shimmer placeholders display inside day cells without collapsing or removing date numbers. Once network requests complete, post chips and event badges populate smoothly into place.
