# Handoff Report — Explorer 3: Calendar UI, Format Pills & Interactive Sidebar Analysis

## 1. Observation

### 1.1 Styling & Build Configuration (`mint-more-frontend`)
- **`package.json`**:
  - Dependencies: React 19 (`react: ^19.2.6`, `react-dom: ^19.2.6`), React Router DOM (`react-router-dom: ^6.30.3`), Zustand (`zustand: ^5.0.13`), `@tanstack/react-query` (`^5.100.14`), `@remixicon/react` (`^4.9.0`).
  - DevDependencies: `tailwindcss` (`^3.4.19`), `@tailwindcss/postcss` (`^4.3.2`), `autoprefixer` (`^10.5.2`), `postcss` (`^8.5.19`), `vite` (`^8.0.12`).
  - Scripts:
    - `"dev"`: `"vite"`
    - `"build"`: `"vite build"`
    - `"lint"`: `"eslint ."`
    - `"preview"`: `"vite preview"`
  - *Note*: No `"test"` script exists in `package.json`. Primary build verification command is `npm run build`.

- **Tailwind & CSS Configuration**:
  - `tailwind.config.js`:
    - Content glob: `"./index.html"`, `"./src/**/*.{js,ts,jsx,tsx}"`.
    - Custom palette extensions: `mint` (`50: #fff7ed` to `900: #7c3500`), `ink` (`50: #f4f4f1` to `950: #0b0f14`).
    - Custom font families: `sans` (`"Creatyv Public Sans"`), `serif` (`"Creatyv Baskvill"`), `display` (`"Creatyv Hero"`).
  - `postcss.config.js`: Uses `tailwindcss` and `autoprefixer`.
  - `src/styles/main.css`:
    - Tailwind entry directives `@tailwind base; @tailwind components; @tailwind utilities;`.
    - CSS variable tokens (`--mint-*`, `--ink-*`, `--paper`, `--hairline`, etc.).
    - Preserved styling definitions for custom calendar components: `.cal-shell`, `.cal-grid-wrap`, `.cal-month-grid`, `.cal-day-cell`, `.cal-event-chip`, `.cal-day-panel`, `.cal-post-chip`, etc.

### 1.2 Current Layout Structure & Deficiencies in `PreviewApprovePage.jsx` & `Onboarding.jsx`
- In `mint-more-frontend/src/pages/client/Onboarding.jsx`:
  - Line 887 wraps child step outlets in a narrow container: `<div className="w-full max-w-[640px] mx-auto lg:mx-0">`.
  - Step 12 (`PreviewApprovePage.jsx`) currently suffers from width restriction and isolated padding (`px-6 py-6 sm:px-10`).
- In `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`:
  - Lines 67–98: Grid is rendered inside `<div className="grid grid-cols-7 gap-px bg-ink-200 border border-ink-200 rounded-xl overflow-hidden shrink-0">`.
  - **Deficiencies Identified**:
    1. Grid is wrapped in `rounded-xl` with surrounding margins, breaking the edge-to-edge layout requirement.
    2. Format pills (`Reels`, `Carousels`, `Posts`) and filter toggles are absent from calendar header and grid cell items.
    3. Right-hand sidebar dual-mode logic (scrollable topic list, hover date focus, accordion inline expansion, "Swap Scheduled Topic" button) is missing.

---

## 2. Logic Chain

1. **Observation 1.1**: The project uses Vite, React 19, Tailwind CSS v3, and custom CSS classes in `main.css`. `npm run build` is the sole build validation script.
2. **Observation 1.2 (Container Restraint)**: In `Onboarding.jsx`, steps 1–10 fit within a 640px form width (`max-w-[640px]`). Step 12 requires a full-width 2-column view (calendar grid + right-hand interactive sidebar). Therefore, `Onboarding.jsx` must conditionally allow step 12 to expand to full width (`max-w-none w-full`) without restricting padding.
3. **Observation 1.2 (Edge-to-Edge Grid)**: Requirement R1 mandates that the calendar panel has no rounded corners or margins isolating it from top or left edges. Removing outer `rounded-xl` and setting border alignments (`border-t-0 border-l-0`) against the container boundaries will achieve edge-to-edge presentation.
4. **Observation 1.2 (Format Pills & Dual-Mode Sidebar)**:
   - Format pills (`All`, `Reels` 📹, `Carousels` 🖼️, `Posts` 📝) provide fast visual filtering and status badges on calendar cards.
   - The right-hand sidebar must support three states:
     - **Default Mode**: Scrollable list of scheduled topics across 28 days.
     - **Hover Date Focus Mode**: Hovering a date cell in the calendar grid updates `hoveredDateKey`, highlighting and focusing that date's topic in the sidebar.
     - **Accordion Inline Expand Mode**: Clicking a topic card expands it inline (`expandedTopicId === topic.id`), revealing full details and rendering the **"Swap Scheduled Topic"** button.

---

## 3. Caveats

- **Responsive Viewports**: On mobile screens (`< 1024px`), the right-hand sidebar should stack below the calendar grid or collapse into a tabbed layout to prevent grid squeeze.
- **State Synchronization**: `PreviewApprovePage` relies on `useOnboardingContext()` providing state from `useCalendarState.js` (including `scheduledDays`, `hoveredDateKey`, `expandedTopicId`, `formatFilter`, `handleSwapTopic`).

---

## 4. Conclusion & UI Layout Blueprint

### 4.1 Edge-to-Edge Calendar Grid Blueprint

```jsx
{/* Calendar Header with Format Pills */}
<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
  <div>
    <h1 className="text-xl font-bold text-ink-950">Review Your Content Schedule</h1>
    <p className="text-xs text-ink-500">28-day automated distribution tailored for your brand.</p>
  </div>

  {/* Format Pills */}
  <div className="flex items-center gap-1.5 bg-paper-tint p-1 rounded-lg border border-hairline">
    {[
      { id: 'all', label: 'All Formats', icon: 'grid' },
      { id: 'reel', label: 'Reels', icon: 'video' },
      { id: 'carousel', label: 'Carousels', icon: 'image' },
      { id: 'post', label: 'Posts', icon: 'file-text' },
    ].map(pill => (
      <button
        key={pill.id}
        type="button"
        onClick={() => setFormatFilter(pill.id)}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
          formatFilter === pill.id
            ? 'bg-ink-950 text-white shadow-sm'
            : 'text-ink-600 hover:text-ink-900 hover:bg-paper'
        }`}
      >
        <Icon name={pill.icon} size={12} />
        {pill.label}
      </button>
    ))}
  </div>
</div>

{/* Edge-to-Edge Grid + Right Sidebar Container */}
<div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] border-t border-l border-hairline bg-paper w-full min-h-[600px]">
  {/* Left: 7-Column Calendar Grid */}
  <div className="grid grid-cols-7 border-r border-hairline">
    {WEEKDAYS.map(day => (
      <div key={day} className="py-2.5 px-2 text-center text-[10px] font-bold text-ink-400 uppercase border-b border-r border-hairline bg-paper-tint">
        {day}
      </div>
    ))}

    {scheduledDays.map((day, idx) => {
      const isHovered = hoveredDateKey === day.dateKey
      const isFilteredOut = formatFilter !== 'all' && day.format !== formatFilter

      return (
        <div
          key={day.dateKey}
          onMouseEnter={() => setHoveredDateKey(day.dateKey)}
          onMouseLeave={() => setHoveredDateKey(null)}
          className={`min-h-[100px] p-2 border-b border-r border-hairline flex flex-col transition-all cursor-pointer relative ${
            day.isPast ? 'bg-ink-50/50 opacity-40' : 'bg-white'
          } ${day.isToday ? 'bg-mint-50/20' : ''} ${
            isHovered ? 'ring-2 ring-mint-500 ring-inset z-10 bg-mint-50/10' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-bold ${
              day.isToday ? 'bg-mint-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px]' : 'text-ink-600'
            }`}>
              {day.dayNum}
            </span>
          </div>

          {day.hasPost && day.topic && !isFilteredOut && (
            <div className={`mt-auto p-2 rounded-lg border transition-all text-left ${
              day.status === 'swapped'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-paper-tint border-hairline hover:border-mint-400'
            }`}>
              <div className="flex items-center gap-1 mb-1">
                <span className={`badge ${
                  day.format === 'reel' ? 'mint' : day.format === 'carousel' ? 'sky' : 'neutral'
                }`}>
                  {day.format}
                </span>
              </div>
              <p className="text-[11px] font-bold text-ink-900 truncate">{day.topic.title}</p>
            </div>
          )}
        </div>
      )
    })}
  </div>

  {/* Right: Interactive Sidebar (Dual Mode) */}
  <div className="bg-paper-tint p-4 border-b lg:border-b-0 border-hairline overflow-y-auto max-h-[700px]">
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-hairline">
      <h3 className="text-sm font-bold text-ink-950">
        {hoveredDateKey ? `Focused: ${hoveredDateKey}` : 'Scheduled Topics'}
      </h3>
      <span className="text-xs font-medium text-ink-500">{scheduledDays.filter(d => d.hasPost).length} Topics</span>
    </div>

    <div className="space-y-2.5">
      {scheduledDays.filter(d => d.hasPost).map(day => {
        const isExpanded = expandedTopicId === day.topic?.id
        const isHighlighted = hoveredDateKey === day.dateKey

        return (
          <div
            key={day.dateKey}
            className={`p-3 rounded-xl border transition-all bg-white ${
              isHighlighted ? 'border-mint-500 ring-2 ring-mint-500/20 shadow-md' : 'border-hairline hover:border-hairline-strong'
            }`}
          >
            <div
              className="cursor-pointer flex items-start justify-between gap-2"
              onClick={() => setExpandedTopicId(isExpanded ? null : day.topic?.id)}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-ink-400">
                    {day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="badge mint">{day.format}</span>
                </div>
                <h4 className="text-xs font-bold text-ink-950">{day.topic?.title}</h4>
              </div>
              <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} className="text-ink-400 shrink-0 mt-1" />
            </div>

            {/* Accordion Expanded Content */}
            {isExpanded && day.topic && (
              <div className="mt-3 pt-3 border-t border-hairline space-y-2.5 text-xs text-ink-700">
                <p className="leading-relaxed">{day.topic.description}</p>
                {day.topic.captionPreview && (
                  <div className="p-2.5 rounded-lg bg-paper-tint border border-hairline font-sans text-[11px] text-ink-800">
                    <div className="font-bold text-[10px] uppercase text-ink-400 mb-1">Draft Caption</div>
                    {day.topic.captionPreview}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openSwapModal(day.dateKey)}
                  className="btn mint sm block w-full mt-2"
                >
                  <Icon name="refresh-cw" size={12} /> Swap Scheduled Topic
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  </div>
</div>
```

---

## 5. Verification Method

1. **Build Validation**:
   - Run `npm run build` in `mint-more-frontend` directory.
   - Confirm zero JSX, CSS, or Tailwind compilation errors.
2. **UI & Interaction Check**:
   - Confirm calendar grid fills container width with no isolated margin/border-radius on top-left edges.
   - Confirm format pills toggle filtering between All, Reels, Carousels, and Posts.
   - Confirm sidebar date hover highlights the corresponding topic.
   - Confirm topic card click expands accordion inline and shows "Swap Scheduled Topic" button.
