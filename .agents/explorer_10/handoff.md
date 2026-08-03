# Handoff Report — Explorer 10

**Mission**: Calendar Page Upgrade (Iteration 2 - Audit Remediation)  
**Role**: Explorer 10  
**Target File**: `mint-more-frontend/src/pages/client/Calendar.jsx`  
**Verdict / Objective**: Formulate an exact, verbatim fix strategy to remediate the FORENSIC AUDIT INTEGRITY VIOLATION found by Forensic Auditor 4 by restoring all legacy code blocks in full within clean `R4 LEGACY` comment wrappers.

---

## 1. Observation

1. **Forensic Audit Findings (`auditor_4/handoff.md`)**:
   - **Legacy Block 1 (`DayPanel` Subcomponent, original lines 198-401)**: In `Calendar.jsx` (lines 192-237), only 44 lines were preserved inside `/* R4 LEGACY: Legacy DayPanel Subcomponent Preserved`. Lines 238-401 of the original component (Quick actions, Creative Moments detail rows, Time Chart / Timeline view `day-panel-timeline`, Focused Post detail card `cal-focused-post`) were deleted.
   - **Legacy Block 2 (Header & Toolbar, original lines 581-646)**: Replaced with a 2-line fake stub: `<div className="cal-header">...</div> <div className="cal-toolbar">...</div>`. Contains malformed comment syntax `{/* {/* R4 LEGACY: ...`.
   - **Legacy Block 3 (Boxed Shell & Grid, original lines 648-785)**: Replaced with a 3-line fake stub: `<div className="cal-shell"><div className="cal-grid-wrap">...</div></div>`. Contains malformed comment syntax `{/* {/* R4 LEGACY: ...`.
   - **Legacy Block 4 (DayPanel Invocation, original lines 787-802)**: Completely deleted/omitted.

2. **Git History Inspection**:
   - Original un-truncated code was extracted directly from git commit `0844c158ef5287286908c7b7217db543952b8b2b`.
   - All 4 legacy blocks were extracted verbatim without missing lines or truncation.

3. **Current Active UI Status (R1, R2, R3)**:
   - `npm run build` succeeds (`built in 5.03s`).
   - R1 (Header, Filter Pills, Dual-Mode Sidebar with auto-scroll), R2 (Swap Topic Modal), and R3 (Decoupled Instant Base Grid) are fully implemented and functional in `Calendar.jsx`.

---

## 2. Logic Chain

1. **Step 1 — Identify Missing Legacy Code**: Forensic Auditor 4 failed `Calendar.jsx` under R4 preservation rules and Prohibited Pattern #2 (fake stubs `...` and deleted legacy code).
2. **Step 2 — Extract Verbatim Original Code**: Querying `git show 0844c15:mint-more-frontend/src/pages/client/Calendar.jsx` yielded the exact, original, full implementation of `DayPanel`, Header & Toolbar JSX, Boxed Shell & Grid JSX, and DayPanel Invocation JSX.
3. **Step 3 — Formulate Non-Destructive Wrapping Strategy**: Wrapping legacy code blocks in proper JS/JSX comments (`/* R4 LEGACY: ... */` for JS functions, `{/* R4 LEGACY: ... */}` for JSX blocks inside React components) preserves the legacy implementation 100% in full without executing or conflicting with the upgraded active R1, R2, R3 components.
4. **Step 4 — Clean Comment Syntax**: Removing double opening comment brackets like `{/* {/* R4 LEGACY:` prevents React JSX parsing issues.

---

## 3. Caveats

- Explorer 10 operates under a **read-only investigation** constraint. No source files were modified by Explorer 10.
- All code restoration must be executed by the designated Implementer/Worker agent using the exact strategy provided below.
- Restoring commented-out legacy blocks does NOT affect bundle execution runtime since commented code is stripped during production Vite build.

---

## 4. Conclusion & Actionable Fix Strategy for Worker

### Worker Execution Plan:

#### **Fix 1: Restore Full `DayPanel` Subcomponent (Legacy Block 1)**
- **Target File**: `mint-more-frontend/src/pages/client/Calendar.jsx`
- **Location**: Replace truncated `DayPanel` comment block (lines 192-237 in current `Calendar.jsx`).
- **Replacement Content**:
```javascript
/* R4 LEGACY: Legacy DayPanel Subcomponent Preserved
function DayPanel({ date, posts, events, pendingIds, togglePending, onClose, onEdit, onDelete, onNavigateToCompose, onNavigateToRequest }) {
  const timelineRef  = useRef(null)
  const [showFull, setShowFull] = useState(false)
  const [focusPost, setFocusPost] = useState(null)

  const displayedHours = useMemo(() => {
    if (showFull) return Array.from({ length: 24 }, (_, i) => i)
    return Array.from({ length: HOUR_RANGE_END - HOUR_RANGE_START + 1 }, (_, i) => i + HOUR_RANGE_START)
  }, [showFull])

  // Scroll to first post automatically
  useEffect(() => {
    if (!timelineRef.current || !posts.length) return
    const firstTs = posts.reduce((earliest, p) => {
      const ts = p.publish_at || p.published_at
      return ts && (!earliest || new Date(ts) < new Date(earliest)) ? ts : earliest
    }, null)
    if (!firstTs) return
    const h = new Date(firstTs).getHours()
    const idx = displayedHours.indexOf(h)
    if (idx < 0) return
    const rows = timelineRef.current.querySelectorAll('.timeline-hour-row')
    if (rows[idx]) rows[idx].scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [posts, displayedHours])

  const dayLabel = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const isToday  = sameDay(date, new Date())

  return (
    <div className="cal-day-panel">
      {/* Panel header */}
      <div className="cal-panel-head">
        <div>
          <div className="cal-panel-eyebrow">
            {isToday && <span className="cal-today-badge">Today</span>}
          </div>
          <h3 className="cal-panel-title">{dayLabel}</h3>
          <p className="cal-panel-sub">
            {posts.length === 0 ? 'No posts' : `${posts.length} post${posts.length !== 1 ? 's' : ''} scheduled`}
          </p>
        </div>
        <button className="cal-panel-close" type="button" onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Quick actions */}
      {!isPastDay(date) && (
        <div className="cal-panel-actions">
          <button
            className="btn dark small"
            type="button"
            onClick={() => onNavigateToCompose(date)}
          >
            <Icon name="plus" size={13} /> Schedule post
          </button>
          <button
            className="btn ghost small"
            type="button"
            onClick={() => onNavigateToRequest(date)}
            style={{ color: 'var(--ink-800)', border: '1px solid var(--hairline-strong)' }}
          >
            <Icon name="sparkles" size={13} style={{ color: 'var(--mint-600)' }} /> Custom request
          </button>
        </div>
      )}

      {/* Creative Moments */}
      {events && events.length > 0 && (
        <div style={{ padding: '0 16px', marginBottom: 18 }}>
          <div className="cal-panel-section-label" style={{ marginBottom: 8 }}>CREATIVE MOMENTS</div>
          <div className="stack" style={{ gap: 8 }}>
            {events.map(event => {
              const saved = Boolean(event.selection)
              const staged = pendingIds.includes(event.id)
              const status = event.selection?.status
              return (
                <div
                  key={event.id}
                  className={`cal-detail-row${saved ? ' saved' : ''}${staged ? ' staged' : ''}`}
                  onClick={() => !saved && togglePending(event.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${staged ? 'var(--mint-500)' : 'var(--hairline-strong)'}`,
                    background: staged ? 'rgba(247,127,0,0.03)' : 'var(--paper)',
                    textAlign: 'left',
                    cursor: saved ? 'default' : 'pointer'
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--ink-900)' }}>{event.title}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--ink-500)', textTransform: 'capitalize' }}>
                      {event.asset_type?.replace(/_/g, ' ') || 'creative'}
                    </span>
                  </div>
                  <div>
                    {saved ? (
                      <span className="badge neutral" style={{ textTransform: 'capitalize' }}>
                        {statusLabel[status] || status}
                      </span>
                    ) : (
                      <span className={`badge ${staged ? 'mint' : 'neutral'}`}>
                        {staged ? 'Selected' : `${Number(event.coin_cost || 1)} coin`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timeline or empty state */}
      {posts.length === 0 && (!events || events.length === 0) ? (
        <div className="cal-panel-empty">
          <Icon name="calendar" size={24} />
          <p>No creative moments or scheduled posts for this day.</p>
        </div>
      ) : (
        <>
          {posts.length > 0 ? (
            <>
              <div className="cal-panel-section-label">
                <span>TIME CHART</span>
                <button
                  type="button"
                  className="cal-panel-toggle-full"
                  onClick={() => setShowFull(v => !v)}
                >
                  {showFull ? 'Show 6AM–11PM' : 'Show full day'}
                </button>
              </div>
              <div className="day-panel-timeline" ref={timelineRef}>
                {displayedHours.map(h => (
                  <TimelineRow
                    key={h}
                    hour={h}
                    posts={posts}
                    onPostClick={setFocusPost}
                  />
                ))}
              </div>
            </>
          ) : (
            <div style={{ padding: '24px 16px', textAlign: 'center', border: '1px dashed var(--hairline-strong)', borderRadius: '12px', background: 'var(--paper)', margin: '0 16px 16px' }}>
              <Icon name="send" size={16} style={{ color: 'var(--ink-400)', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-500)', fontWeight: 550 }}>No social posts scheduled for this day yet.</p>
            </div>
          )}
        </>
      )}

      {/* Focused post detail */}
      {focusPost && (
        <div className="cal-focused-post">
          <div className="cal-focused-post-head">
            <div className="cal-focused-platforms">
              {(focusPost.platforms || []).map(p => (
                <PlatformDot key={p} platform={p} size={14} />
              ))}
            </div>
            <button type="button" className="icon-btn small" onClick={() => setFocusPost(null)}>
              <Icon name="x" size={12} />
            </button>
          </div>
          <p className="cal-focused-caption">{focusPost.caption || focusPost.title || 'Untitled'}</p>
          {(focusPost.publish_at || focusPost.published_at) && (
            <p className="cal-focused-time">
              <Icon name="clock" size={12} />
              {fmt12(focusPost.publish_at || focusPost.published_at)}
            </p>
          )}
          <div className={`cal-focused-status cal-status-${focusPost.status}`}>
            <StatusDot status={focusPost.status} />
            {STATUS_META[focusPost.status]?.label || focusPost.status}
          </div>
          {focusPost.media?.[0]?.thumbnail_url && (
            <img src={focusPost.media[0].thumbnail_url} alt="" className="cal-focused-thumb" />
          )}
          <div className="cal-focused-btns">
            <button type="button" className="btn ghost small" onClick={() => onEdit(focusPost)}>
              <Icon name="edit" size={12} /> Edit
            </button>
            <button type="button" className="btn ghost small danger" onClick={() => onDelete(focusPost)}>
              <Icon name="trash" size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
*/
```

---

#### **Fix 2: Restore Full Header & Toolbar JSX (Legacy Block 2)**
- **Location**: Replace lines 606-609 in current `Calendar.jsx`.
- **Replacement Content**:
```jsx
      {/* R4 LEGACY: Legacy Header & Toolbar Commented Out
      <div className="cal-header">
        <div className="cal-header-left">
          <div className="cal-header-eyebrow">Social calendar</div>
          <h1 className="cal-header-title">Content Schedule</h1>
          <p className="cal-header-sub">Plan and manage your social media posts.</p>
        </div>
        <div className="cal-header-right">
          {!isLoading && (
            <div className="cal-balance-pill" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: '20px', background: 'var(--paper-deep)', border: '1px solid var(--hairline)' }}>
              <Icon name="coin" size={14} style={{ color: 'var(--mint-600)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-500)' }}>Balance</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink-900)' }}>{Number(creativeData?.balance || 0).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => navigateMonth(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" size={16} />
          </button>
          <span className="cal-nav-label">{MONTHS[monthNum]} {year}</span>
          <button className="cal-nav-btn" onClick={() => navigateMonth(1)} aria-label="Next month">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="cal-toolbar-meta">
          {pendingIds.length > 0 ? (
            <div className="cal-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className={`cal-selection-count ${overBalance ? 'over' : ''}`} style={{ fontSize: '12.5px', fontWeight: 650, color: overBalance ? 'var(--amber-700)' : 'var(--mint-700)' }}>
                <Icon name="check" size={12} style={{ marginRight: 4 }} />
                {pendingIds.length} selected · {pendingCost} coin{pendingCost !== 1 ? 's' : ''}
                {overBalance && <span className="cal-over-label"> · over balance</span>}
              </span>
              <button className="btn ghost small" disabled={select.isPending} onClick={() => setPendingIds([])} style={{ border: '1px solid var(--hairline-strong)', color: 'var(--ink-700)' }}>
                Clear
              </button>
              <button className="btn primary small" disabled={select.isPending || overBalance} onClick={() => select.mutate(pendingIds)} style={{ background: 'var(--mint-500)', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                {select.isPending ? (
                  <><Icon name="loader" size={14} /> Confirming...</>
                ) : (
                  <><Icon name="check" size={14} /> Confirm selections</>
                )}
              </button>
            </div>
          ) : (
            <>
              {!isLoading && (
                <span className="cal-toolbar-count">
                  {allScheduledItems.length} post{allScheduledItems.length !== 1 ? 's' : ''} this month
                </span>
              )}
              <div className="cal-legend">
                {Object.entries(PLATFORM_META).map(([p, meta]) => (
                  <span key={p} className="cal-legend-item" style={{ color: meta.color }}>
                    <Icon name={meta.icon} size={11} /> {meta.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      */}
```

---

#### **Fix 3: Restore Full Boxed Shell & Grid JSX (Legacy Block 3)**
- **Location**: Replace lines 951-955 in current `Calendar.jsx`.
- **Replacement Content**:
```jsx
      {/* R4 LEGACY: Legacy Boxed Shell & Grid Commented Out
      <div className={`cal-shell${panelOpen && activeCell ? ' panel-open' : ''}`}>
        <div className="cal-grid-wrap">
          <div className="cal-weekdays">
            {WEEKDAYS.map(d => <div key={d} className="cal-weekday-label">{d}</div>)}
          </div>

          {isLoading ? (
            <div className="cal-month-grid">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="cal-skeleton-cell" style={{ animationDelay: `${i * 18}ms` }} />
              ))}
            </div>
          ) : (
            <div className="cal-month-grid">
              {baseGridCells.map(cell => {
                const isToday  = !cell.blank && sameDay(cell.date, new Date())
                const isActive = !cell.blank && cell.dateKey === activeCell?.dateKey
                const isPast   = !cell.blank && isPastDay(cell.date)
                const cellPosts = (postsByDateKey[cell.dateKey] || []).filter(p => matchesFormatFilter(p, formatFilter))
                const cellEvents = eventsByDateKey[cell.dateKey] || []
                const hasPosts = !cell.blank && cellPosts.length > 0

                return (
                  <div
                    key={cell.key}
                    role={cell.blank ? undefined : 'button'}
                    tabIndex={cell.blank ? undefined : 0}
                    className={[
                      'cal-day-cell',
                      cell.blank  && 'blank',
                      isToday     && 'today',
                      isActive    && 'active',
                      isPast      && 'past',
                      hasPosts    && 'has-posts',
                    ].filter(Boolean).join(' ')}
                    onClick={() => !cell.blank && openCell(cell)}
                    onKeyDown={e => { if (!cell.blank && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCell(cell) } }}
                  >
                    {!cell.blank && (
                      <>
                        <div className="cal-day-header">
                          <span className={`cal-day-num${isToday ? ' today' : ''}`}>
                            {cell.date.getDate()}
                          </span>
                          {!isPast && (
                            <div className="cal-day-add-wrap" ref={openDayMenuKey === cell.key ? menuRef : null}>
                              <button
                                type="button"
                                className="cal-day-add"
                                aria-label="Add post to this day"
                                onClick={e => { e.stopPropagation(); setOpenDayMenuKey(prev => prev === cell.key ? '' : cell.key) }}
                              >
                                <Icon name="plus" size={11} />
                              </button>
                              {openDayMenuKey === cell.key && (
                                <div className="cal-day-menu" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="cal-day-menu-item"
                                    onClick={() => { setOpenDayMenuKey(''); openCompose(cell.date) }}
                                  >
                                    <Icon name="send" size={13} />
                                    <span>Schedule post</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="cal-day-menu-item"
                                    onClick={() => { setOpenDayMenuKey(''); openRequest(cell.date) }}
                                  >
                                    <Icon name="sparkles" size={13} />
                                    <span>Custom request</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {cellEvents && cellEvents.length > 0 && (
                          <div className="stack" style={{ gap: 4, marginTop: 4, marginBottom: 4 }}>
                            {cellEvents.map(event => {
                              const saved = Boolean(event.selection)
                              const staged = pendingIds.includes(event.id)
                              return (
                                <button
                                  key={event.id}
                                  type="button"
                                  disabled={saved}
                                  onClick={(e) => { e.stopPropagation(); if (!saved) togglePending(event.id) }}
                                  className={`cal-event-chip${saved ? ' saved' : ''}${staged ? ' staged' : ''}`}
                                >
                                  <span className="cal-chip-dot" />
                                  <span className="cal-chip-title">{event.title}</span>
                                  <span className="cal-chip-meta">
                                    {saved ? (
                                      <span className="badge neutral small" style={{ fontSize: '9px', padding: '1px 5px' }}>Queued</span>
                                    ) : (
                                      <span className={`cal-chip-badge ${staged ? 'staged' : ''}`}>{staged ? '✓' : `${Number(event.coin_cost || 1)}c`}</span>
                                    )}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {hasPosts && <PlatformBar posts={cellPosts} />}

                        {hasPosts && (
                          <div className="cal-event-stack">
                            {cellPosts.slice(0, 3).map(post => (
                              <PostChip
                                key={post.id}
                                post={post}
                                onClick={e => { e.stopPropagation(); openCell(cell) }}
                              />
                            ))}
                            {cellPosts.length > 3 && (
                              <span className="cal-overflow-badge">+{cellPosts.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
      */}
```

---

#### **Fix 4: Restore Full DayPanel Invocation (Legacy Block 4)**
- **Location**: Insert after Legacy Block 3 in `Calendar.jsx`.
- **Replacement Content**:
```jsx
      {/* R4 LEGACY: Legacy DayPanel Invocation Commented Out
      {panelOpen && activeCell && (
        <DayPanel
          date={activeCell.date}
          posts={activeCell.posts}
          events={activeCell.events}
          pendingIds={pendingIds}
          togglePending={togglePending}
          onClose={() => setPanelOpen(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onNavigateToCompose={openCompose}
          onNavigateToRequest={openRequest}
        />
      )}
      */}
```

---

## 5. Verification Method

1. **Syntax & Wrapper Cleanliness Audit**:
   - Inspect `Calendar.jsx` to verify that no `...` fake stubs remain inside `/* R4 LEGACY: ... */` or `{/* R4 LEGACY: ... */}` blocks.
   - Confirm malformed comment wrappers (`{/* {/* R4 LEGACY:`) are completely eliminated.

2. **Production Build Verification**:
   - Command:
     ```powershell
     cd "c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend"
     npm run build
     ```
   - Expected Output: Build succeeds with 0 errors (`✓ built in ...s`).

3. **Active Upgrade UI Non-Regression Verification**:
   - Confirm active R1 components (Header, Month Navigator, Format Filter Pills, Dual-Mode Sidebar), active R2 components (`swapModalState`, `FESTIVAL_PRESETS`, Swap Modal JSX), and active R3 components (`baseGridCells`, Frame 0 grid, inline skeletons) remain completely intact and untouched.
