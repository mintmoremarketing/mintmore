# Handoff Report — Explorer 7: Calendar Page UI Structure & Porting Analysis (R1 & R4)

## 1. Observation

Direct observations from source code inspection:

### Target Files Analyzed
1. `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx` (599 lines)
2. `mint-more-frontend/src/pages/client/Calendar.jsx` (839 lines)
3. `mint-more-frontend/src/styles/main.css` (lines 8008–8396, `.cal-page` / `.cal-shell` definitions)

### Source UI Structure (`PreviewApprovePage.jsx`)
- **Full-Bleed Edge-to-Edge Container** (lines 138–140):
  ```jsx
  <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] border-t border-l border-hairline w-full min-h-0 overflow-hidden">
  ```
  *Key visual characteristic*: Zero isolating outer margins or rounded cards (`rounded-16px` eliminated). Uses clean hairline borders (`border-t border-l border-hairline`).
- **Format Filter Bar** (lines 114–135):
  Pill-style format selector supporting `all`, `reel`, `carousel`, and `post` options with corresponding icons (`grid`, `video`, `image`, `file`). Active state styled with `bg-ink-950 text-white shadow-sm`.
- **Dense Calendar Grid** (lines 142–237):
  - Sticky weekday header (`grid grid-cols-7 border-b border-hairline bg-paper-tint sticky top-0 z-10`).
  - 35/42 day cell items with `min-h-[110px] p-2 border-b border-r border-hairline`.
  - State highlights: Hovered tile triggers inset ring highlight (`ring-2 ring-mint-500 ring-inset z-10 bg-mint-50/10`).
  - Format badges on cards: Reel (`bg-pink-500 text-white`), Carousel (`bg-blue-500 text-white`), Post (`bg-mint-600 text-white`).
- **Interactive Dual-Mode Sidebar** (lines 239–397):
  - Header: Shows `"Focused: [dateKey]"` or `"Scheduled Topics"` with post counter and "Clear Focus" button.
  - Auto-Scroll Ref Mapping: Uses `sidebarItemRefs.current[dateKey]` and `useEffect` with `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
  - Row Grid Template: 4-column layout `grid grid-cols-[70px_1fr_auto_20px]` (Date, Title, Format Badge, Chevron).
  - Accordion Expansion: Click expands accordion displaying festival tags, description, draft caption box, visual prompt box, hashtags, and quick action buttons ("Opt-Out Festival", "Swap Scheduled Topic").

### Existing Target UI Structure (`Calendar.jsx`)
- Outer container wrapped in `.cal-page` with padding `24px 32px 60px` and `max-width: 1440px`.
- Dark floating toolbar `.cal-toolbar` with `border-radius: 16px` and background `var(--ink-950)`.
- Main grid wrapped in `.cal-grid-wrap` with `border-radius: 16px`, `padding: 20px`, `background: #fff`.
- Slide-out dark drawer `DayPanel` (lines 198–401) only rendered when `panelOpen && activeCell` is true.

---

## 2. Logic Chain

### Architectural Transition (Legacy -> Sleek Edge-to-Edge Layout)
1. **Layout Paradigm Shift**: Legacy `Calendar.jsx` uses boxed container styling (`.cal-page`, `.cal-grid-wrap`) with a hidden/drawer sidebar (`DayPanel`). The desired `PreviewApprovePage.jsx` layout uses a full-bleed, edge-to-edge split grid with a **permanent interactive sidebar** on `lg` viewports.
2. **State Synchronization**:
   - `hoveredDateKey`: Syncs tile hover on left grid with row highlight and smooth auto-scroll on right sidebar.
   - `expandedTopicId`: Controls accordion expansion in sidebar when tile or sidebar item is clicked.
   - `formatFilter`: Filters both calendar grid cards and sidebar topic list simultaneously.
3. **Data Adaptation**:
   - `PreviewApprovePage.jsx` consumes static mock onboarding topics (`scheduledDays`).
   - `Calendar.jsx` consumes real backend queries (`socialData.posts` & `creativeData.events`).
   - Mapping strategy: Format live `socialData.posts` into the cell format expected by the sleek UI while preserving backend attributes (`id`, `publish_at`, `status`, `caption`, `platforms`, `media`).
4. **Non-Destructive Refactoring (R4 Strategy)**:
   - To adhere to R4 requirements, existing legacy JSX sections in `Calendar.jsx` must be wrapped in commented blocks (`{/* R4 LEGACY: ... */}`) rather than removed.
   - Legacy logic (e.g. `deleteMutation`, `select` mutation, creative moments handling) remains fully functional, re-wired into the new edge-to-edge UI and sidebar accordion.

---

## 3. Caveats

1. **Data Source Differences**: `PreviewApprovePage.jsx` relies on `useOnboardingContext()`, whereas `Calendar.jsx` uses `useQuery` hooks (`socialApi` and `creativeApi`). The Worker must adapt state setters (`setFormatFilter`, `setHoveredDateKey`, `setExpandedTopicId`) to operate on live calendar post objects.
2. **Creative Moments Integration**: `Calendar.jsx` handles creative moments selection (`creativeEvents` / `pendingIds` / `coin_cost`). These items should be included in the day cell view and sidebar topic list (or given a dedicated badge e.g. "Creative Moment") so coin selection workflows remain operational.
3. **Viewport Responsiveness**: The split grid (`lg:grid-cols-[1fr_360px]`) switches to single-column on mobile/tablet (`grid-cols-1`). On smaller screens, the sidebar stacks below the grid.

---

## 4. Conclusion & Action Plan for Worker

### Step-by-step Action Plan for Worker

#### A. Component State & Ref Additions (`Calendar.jsx`)
Add the following state and ref variables inside `Calendar()`:
```javascript
const [formatFilter, setFormatFilter] = useState('all') // 'all' | 'reel' | 'carousel' | 'post'
const [hoveredDateKey, setHoveredDateKey] = useState(null)
const [expandedTopicId, setExpandedTopicId] = useState(null)
const [swapModalState, setSwapModalState] = useState({ isOpen: false, targetDateKey: null })

// R5: Auto-scroll Ref mapping
const sidebarItemRefs = useRef({})

useEffect(() => {
  if (hoveredDateKey && sidebarItemRefs.current[hoveredDateKey]) {
    sidebarItemRefs.current[hoveredDateKey].scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }
}, [hoveredDateKey])
```

#### B. Header Refactoring & Format Filter Bar Integration
Replace legacy `.cal-header` and `.cal-toolbar` (lines 581–646) with sleek header:
- Wrap legacy header/toolbar in `{/* R4 LEGACY: Old Calendar Header & Toolbar ... */}`.
- Insert sleek header with:
  - Title & Eyebrow ("Content Schedule" / "Plan & manage monthly content").
  - Month Navigator (`<` `Month Year` `>`).
  - Credit Balance pill & Post counter.
  - **Format Filter Bar** (`All`, `Reels`, `Carousels`, `Posts`).

#### C. Grid & Shell Refactoring
Replace legacy `.cal-shell` and `.cal-grid-wrap` (lines 648–785):
- Wrap legacy shell in `{/* R4 LEGACY: Old Boxed Grid Shell ... */}`.
- Insert full-bleed edge-to-edge container:
  ```jsx
  <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] border-t border-l border-hairline w-full min-h-0 overflow-hidden">
  ```
- Insert sticky weekday header (`grid grid-cols-7 border-b border-hairline bg-paper-tint sticky top-0 z-10`).
- Render 7-column grid cells:
  - Handle `hoveredDateKey` state & ring highlight (`ring-2 ring-mint-500 ring-inset z-10 bg-mint-50/10`).
  - Apply `formatFilter` check to show matching posts inside day cell.
  - Display post chips with format badges (`Reel`, `Carousel`, `Post`).

#### D. Interactive Dual-Mode Sidebar Integration
Replace legacy `<DayPanel ... />` call (lines 787–802):
- Wrap legacy call in `{/* R4 LEGACY: Old DayPanel Drawer ... */}`.
- Port the right sidebar container from `PreviewApprovePage.jsx` (lines 239–397):
  - Dynamic Title ("Scheduled Topics" vs "Focused: [dateKey]").
  - List of scheduled posts/moments filtered by `formatFilter`.
  - DOM Ref assignment (`ref={(el) => ...}`).
  - 4-column summary row (Date, Title, Format badge, Chevron).
  - Expanded accordion view displaying caption, platforms, status, edit/delete buttons, and schedule options.

#### E. Code Block Modification Reference Table

| Target Block in `Calendar.jsx` | Line Numbers | R4 Action | Replacement Strategy |
|---|---|---|---|
| Imports & Top Helpers | 1–196 | Keep intact | Add any missing icons/helpers |
| Legacy `DayPanel` definition | 198–401 | Comment out (`/* R4 LEGACY: DayPanel */`) | Superseded by interactive sidebar, or kept as detail subcomponent |
| Legacy `.cal-header` & `.cal-toolbar` | 581–646 | Comment out (`{/* R4 LEGACY */}`) | Replace with sleek header & format filter bar |
| Legacy `.cal-shell` & `.cal-grid-wrap` | 648–785 | Comment out (`{/* R4 LEGACY */}`) | Replace with full-bleed grid (`grid-cols-[1fr_360px]`) |
| Legacy `<DayPanel>` invocation | 787–802 | Comment out (`{/* R4 LEGACY */}`) | Replace with permanent interactive sidebar |
| Selection Summary Strip | 805–836 | Retain & integrate | Integrate into bottom fixed bar |

---

## 5. Verification Method

To independently verify the implementation after Worker completes code edits:

1. **File Inspection**:
   Run `view_file` on `mint-more-frontend/src/pages/client/Calendar.jsx` to verify:
   - Presence of R4 non-destructive legacy comment wrappers (`{/* R4 LEGACY: ... */}`).
   - Presence of `formatFilter` state and filter pills button bar.
   - Full-bleed CSS grid layout (`grid-cols-[1fr_360px] border-t border-l border-hairline`).
   - Presence of `sidebarItemRefs` mapping and smooth scroll `useEffect`.
2. **Build Verification**:
   Execute frontend build check (e.g. `npm run build` or Vite compile) in `mint-more-frontend` directory to confirm zero syntax or JSX parsing errors.
3. **Interactive UI Verification**:
   - Verify clicking format filter pills (`Reels`, `Carousels`, `Posts`, `All`) filters both cell items and right sidebar rows.
   - Verify hovering over a calendar cell highlights the corresponding sidebar row with a mint accent border and scrolls it into view.
   - Verify clicking a sidebar row expands the accordion details.
