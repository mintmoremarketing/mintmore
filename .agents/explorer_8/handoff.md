# Handoff Report: Action Button & Dropdown Feature Integration (R2) for `Calendar.jsx`

## 1. Observation

### Existing Dropdown in `Calendar.jsx`
In `mint-more-frontend/src/pages/client/Calendar.jsx` (lines 696–728):
```jsx
{/* + menu */}
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
```
* Key observations:
  * Dropdown visibility is controlled by state `openDayMenuKey`.
  * It currently contains only **2 options**: "Schedule post" and "Custom request".
  * Option 3 ("Swap topic") is currently **missing**.

### Side Drawer Quick Actions in `Calendar.jsx`
In `Calendar.jsx` (lines 248–257):
```jsx
{!isPastDay(date) && (
  <div className="flex items-center gap-3 mb-8">
    <button className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors" onClick={() => onNavigateToCompose(date)}>
      <Icon name="send" size={14} /> Schedule Post
    </button>
    <button className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors" onClick={() => onNavigateToRequest(date)}>
      <Icon name="sparkles" size={14} className="text-orange-400" /> Custom Request
    </button>
  </div>
)}
```

### Topic Swap Reference Implementation (`PreviewApprovePage.jsx` & `useCalendarState.js`)
* **State Hook (`useCalendarState.js`, lines 237, 361–400, 408–415)**:
  * State: `swapModalState = { isOpen: false, targetDateKey: null }`.
  * Open function: `openSwapModal(dateKey)` sets `isOpen: true` and `targetDateKey: dateKey`.
  * Close function: `closeSwapModal()` resets `swapModalState`.
  * Swap handler: `handleSwapTopic(dateKey, newTopicId, customData)` records topic replacement in `calendarOverrides[dateKey]`.
* **Modal Component (`PreviewApprovePage.jsx`, lines 401–580)**:
  * Renders modal overlay when `swapModalState?.isOpen` is true.
  * Displays target date & target item header.
  * Contains 3 navigation tabs:
    1. **Unused Topics** (`unused`): Lists topics not currently scheduled.
    2. **Other Festivals** (`festivals`): Lists festival greeting options.
    3. **Custom Request** (`custom`): Textarea for user custom topic input.
  * Action footer with "Cancel" and "Confirm & Swap Topic" buttons.

* **Icon Registry (`Icon.jsx`, line 142)**:
  * `refresh` icon is available via `RiRefreshLine` (`<Icon name="refresh" size={13} />`).

---

## 2. Logic Chain

1. **Dropdown Expansion**:
   * To implement Requirement R2, the `+` action dropdown in `Calendar.jsx` must be expanded from 2 options to 3:
     1. "Schedule post" -> Calls `openCompose(cell.date)`
     2. "Custom request" -> Calls `openRequest(cell.date)`
     3. "Swap topic" -> Calls `openSwapModal(cell.dateKey, cell.date)`
2. **State Wiring**:
   * `Calendar.jsx` requires state management for the Topic Swap Modal:
     * `swapModalState`: `{ isOpen: false, targetDateKey: null, targetDate: null }`
     * `activeSwapTab`: `'unused' | 'festivals' | 'custom'`
     * `selectedSwapTopicId`: Selected topic ID for Tab 1
     * `selectedSwapFestival`: Selected festival object for Tab 2
     * `customSwapText`: Input text for Tab 3
3. **Modal Actions**:
   * Clicking "Swap topic" on day cell `YYYY-MM-DD` closes the day menu popover and opens the `SwapTopicModal`.
   * On modal confirm:
     * For **Custom Request**: Creates a custom request via `creativeApi.createRequest` or navigates to `/jobs/new?deadline=${dateKey}&prompt=${encodeURIComponent(customSwapText)}`.
     * For **Unused / Festival Topic**: Updates calendar selection/override state or calls creative event select mutation `select.mutate(...)`.
     * Refreshes query data (`queryClient.invalidateQueries({ queryKey: ['creative-calendar'] })` & `['social-calendar']`).

---

## 3. Caveats

* `Calendar.jsx` operates on real backend data (`creativeApi.calendar` & `socialApi.getCalendarPosts`), whereas `PreviewApprovePage.jsx` uses local mock state (`useCalendarState`). The modal implementation in `Calendar.jsx` should adapt the tab content to query available topics/events from `creativeData` or backend API endpoints.
* If a day cell does not have an existing topic/event scheduled, selecting "Swap topic" can act as a topic replacement or topic request for that target date.

---

## 4. Conclusion

The existing `+` action button dropdown in `Calendar.jsx` can be smoothly upgraded to support all three actions ("Schedule Post", "Custom Request", and "Swap Topic").

### Step-by-Step Wiring Instructions for Implementer

#### Step 1: Add State Variables in `Calendar.jsx`
```javascript
// Swap Topic Modal State
const [swapModalState, setSwapModalState] = useState({ isOpen: false, targetDateKey: null, targetDate: null })
const [activeSwapTab, setActiveSwapTab] = useState('unused') // 'unused' | 'festivals' | 'custom'
const [selectedSwapTopicId, setSelectedSwapTopicId] = useState(null)
const [selectedSwapFestival, setSelectedSwapFestival] = useState(null)
const [customSwapText, setCustomSwapText] = useState('')

const openSwapModal = useCallback((dateKey, date) => {
  if (isPastDay(date)) {
    pushToast({ title: 'Choose today or later', body: 'Topic swap can only be performed for today or future dates.', tone: 'amber' })
    return
  }
  setSwapModalState({ isOpen: true, targetDateKey: dateKey, targetDate: date })
  setActiveSwapTab('unused')
  setSelectedSwapTopicId(null)
  setSelectedSwapFestival(null)
  setCustomSwapText('')
}, [pushToast])

const closeSwapModal = useCallback(() => {
  setSwapModalState({ isOpen: false, targetDateKey: null, targetDate: null })
}, [])
```

#### Step 2: Expand the Dropdown Menu in `Calendar.jsx`
In `Calendar.jsx` around line 707, update `.cal-day-menu`:
```jsx
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
    <button
      type="button"
      className="cal-day-menu-item"
      onClick={() => { setOpenDayMenuKey(''); openSwapModal(cell.dateKey, cell.date) }}
    >
      <Icon name="refresh" size={13} />
      <span>Swap topic</span>
    </button>
  </div>
)}
```

#### Step 3: Render Swap Topic Modal Component in `Calendar.jsx`
Add the Swap Topic Modal at the bottom of `Calendar.jsx` (before the closing root `</div>`):
```jsx
{/* ── Swap Topic Modal ────────────────────────────────────────────── */}
{swapModalState.isOpen && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    onClick={closeSwapModal}
  >
    <div
      className="bg-ink-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col text-white"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-base text-white">Swap Scheduled Topic</h3>
          <p className="text-xs text-ink-400 mt-0.5">
            Target date: <strong className="text-white">{swapModalState.targetDateKey}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={closeSwapModal}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-ink-400 hover:text-white transition-colors"
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 px-4 bg-white/5">
        {[
          { id: 'unused', label: 'Unused Topics' },
          { id: 'festivals', label: 'Other Festivals' },
          { id: 'custom', label: 'Custom Request' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSwapTab(tab.id)}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeSwapTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-ink-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 overflow-y-auto max-h-[320px]">
        {activeSwapTab === 'unused' && (
          <div className="space-y-2 text-xs text-ink-300">
            <p>Select an alternative topic from your content library to swap into this slot.</p>
            {/* List available events / topics */}
          </div>
        )}
        {activeSwapTab === 'festivals' && (
          <div className="space-y-2 text-xs text-ink-300">
            <p>Choose a festival greeting to replace the topic on this date.</p>
          </div>
        )}
        {activeSwapTab === 'custom' && (
          <div className="space-y-3">
            <label className="text-xs font-bold text-white block">
              What topic or prompt do you want to schedule instead?
            </label>
            <textarea
              value={customSwapText}
              onChange={e => setCustomSwapText(e.target.value)}
              placeholder="E.g., Special promo for weekend event..."
              className="w-full p-3 rounded-xl min-h-[100px] text-xs border border-white/10 bg-white/5 focus:border-orange-500 outline-none text-white placeholder:text-ink-500 resize-none"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 flex items-center justify-end gap-3">
        <button type="button" className="px-4 py-2 rounded-xl text-xs font-bold text-ink-400 hover:text-white" onClick={closeSwapModal}>
          Cancel
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors"
          onClick={() => {
            if (activeSwapTab === 'custom' && customSwapText.trim()) {
              openRequest(swapModalState.targetDate)
            }
            closeSwapModal()
          }}
        >
          Confirm & Swap Topic
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 5. Verification Method

1. **Code Inspection**:
   * Inspect `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\Calendar.jsx` to verify:
     * `.cal-day-menu` has 3 items: "Schedule post", "Custom request", and "Swap topic".
     * `<Icon name="refresh" size={13} />` is used for "Swap topic".
     * Modal component renders when `swapModalState.isOpen` is true.
2. **Manual Test Walkthrough**:
   * Navigate to `/calendar` in the web application.
   * Hover/click the `+` button on any future day cell.
   * Verify all 3 options appear in the dropdown menu.
   * Click "Swap topic" and confirm the Swap Topic modal opens targeting that specific date.
   * Switch between the 3 modal tabs ("Unused Topics", "Other Festivals", "Custom Request").
