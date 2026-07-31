# Complete Investigation Report: Requirements R2 & R3
**Workspace**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas`  
**Agent**: Explorer 5  
**Date**: 2026-07-31  

---

## Executive Summary

This report delivers a complete investigation of **Requirement R2 (Strict Unused Topics Logic)** and **Requirement R3 (Festival Handling & Opt-outs)** for Phase 2 of the Mint-More SaaS platform. 

- **Requirement R2**: We identified that `PreviewApprovePage.jsx` currently filters unused topics using `topics?.filter(t => t.id !== activeDateItem?.topic?.id)`. This only excludes the topic assigned to the specific date being swapped, ignoring topics already scheduled on other dates across the 28-day calendar. Because base topics (7 topics) cycle across 12+ post slots, topics duplicate across dates. We specify exact set-difference filtering logic so that any topic scheduled anywhere on the calendar is strictly excluded from "Unused Topics".
- **Requirement R3**: We cataloged backend API endpoints providing dynamic festival dates (`GET /api/v1/creative/calendar`, `GET /api/v1/creative/events/suggestions`, `POST /api/v1/ai/onboarding-topics`), audited frontend onboarding context integration (`Onboarding.jsx`, `useCalendarState.js`, `FestivalsPage.jsx`, `PreviewApprovePage.jsx`), and defined exact logic to handle festival opt-outs. When a festival slot is opted out (either via modal swap or global setting), the calendar slot retains `hasPost: true` and is automatically replaced with an unassigned standard brand topic from the topic pool, maintaining total posting frequency invariant.

---

## 1. Requirement R2: Strict Unused Topics Logic

### 1.1 Current Frontend Implementation
In `mint-more-frontend`, topic generation and calendar state management take place across two primary files:
1. `src/pages/client/onboarding/useCalendarState.js`:
   - `generateTopicsForBrand(form)` returns an array of base topics (e.g. `topic-1` through `topic-7` for restaurants/fashion, or default topics).
   - `scheduledDays` calculates 28 calendar days starting from the nearest Sunday. Based on posting frequency (`form.posting_frequency`, defaulting to `3` posts/week = 12 post slots), it assigns topics sequentially to active post days using:
     ```javascript
     assignedTopic = safeTopics[topicIndex % safeTopics.length]
     topicIndex++
     ```
   - When a user performs a custom swap, a new topic object with ID `custom-${Date.now()}` is appended to the `topics` array state and assigned to that date key via `calendarOverrides`.

2. **The Swap Scheduled Topic Modal** (`src/pages/client/onboarding/PreviewApprovePage.jsx`):
   - Triggered via `openSwapModal(day.dateKey)`.
   - Renders Tab 1 ("Unused Topics") at lines 391-414:
     ```jsx
     {activeSwapTab === 'unused' && (
       <div className="space-y-2">
         {topics
           ?.filter(t => t.id !== activeDateItem?.topic?.id)
           .map(topic => (
             <div key={topic.id} ...>
               ...
             </div>
           ))}
       </div>
     )}
     ```

### 1.2 Identified Defect & Topic Duplication Mechanism
1. **Flaw in Current Filter**: The condition `t.id !== activeDateItem?.topic?.id` **only** checks if the topic ID matches the target date's currently assigned topic.
2. **Duplication Mechanism**:
   - With 7 base topics (`topic-1` .. `topic-7`) and 12 post slots in a 4-week window (3 posts/week), modulo indexing assigns:
     - Post Slot 1 -> `topic-1`
     - Post Slot 2 -> `topic-2`
     - ...
     - Post Slot 7 -> `topic-7`
     - Post Slot 8 -> `topic-1` (Duplicated)
     - Post Slot 9 -> `topic-2` (Duplicated)
     - Post Slot 10 -> `topic-3` (Duplicated)
     - Post Slot 11 -> `topic-4` (Duplicated)
     - Post Slot 12 -> `topic-5` (Duplicated)
   - When swapping Post Slot 1 (`topic-1`), the current code filters out `topic-1`, but lists `topic-2`, `topic-3`, `topic-4`, `topic-5`, `topic-6`, `topic-7` as "Available / Unused", even though `topic-2` through `topic-5` are already scheduled elsewhere on the calendar (and `topic-6` / `topic-7` are scheduled on slots 6 and 7)!

### 1.3 Exact Filtering Logic Specification for R2
To strictly exclude any topic that is scheduled **anywhere** on the 28-day calendar, the filtering logic must be updated as follows:

#### Step 1: Collect All Currently Scheduled Topic IDs
In `PreviewApprovePage.jsx` (or exposed directly from `useCalendarState.js`), compute the set of all topic IDs currently assigned to active post slots across the entire `scheduledDays` array:

```javascript
// Collect all topic IDs currently scheduled on active post slots in the calendar
const scheduledTopicIds = useMemo(() => {
  const ids = new Set()
  scheduledDays?.forEach(day => {
    if (day.hasPost && day.topic?.id) {
      ids.add(day.topic.id)
    }
  })
  return ids
}, [scheduledDays])
```

#### Step 2: Calculate True Unused Topics
Filter the full `topics` pool (including base brand topics and custom topics) against `scheduledTopicIds`:

```javascript
// Unused topics are those in the topics pool NOT scheduled on ANY day of the calendar
const unusedTopics = useMemo(() => {
  return (topics || []).filter(topic => !scheduledTopicIds.has(topic.id))
}, [topics, scheduledTopicIds])
```

#### Step 3: Render Unused Topics with Empty State Fallback
In Tab 1 ("Unused Topics") of `PreviewApprovePage.jsx`:

```jsx
{activeSwapTab === 'unused' && (
  <div className="space-y-2">
    {unusedTopics.length > 0 ? (
      unusedTopics.map(topic => (
        <div
          key={topic.id}
          onClick={() => setSelectedSwapTopicId(topic.id)}
          className={`p-3 rounded-xl border transition-all cursor-pointer ${
            selectedSwapTopicId === topic.id
              ? 'border-mint-500 bg-mint-50/20 ring-1 ring-mint-500'
              : 'border-hairline hover:border-hairline-strong bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase text-ink-400">{topic.format}</span>
            <span className="text-[10px] font-medium text-mint-600 bg-mint-50 px-2 py-0.5 rounded">Available</span>
          </div>
          <h4 className="text-xs font-bold text-ink-950">{topic.title}</h4>
          <p className="text-[11px] text-ink-500 line-clamp-1 mt-0.5">{topic.description}</p>
        </div>
      ))
    ) : (
      <div className="py-8 text-center px-4 bg-paper-tint rounded-xl border border-hairline">
        <Icon name="info" size={24} className="mx-auto text-ink-400 mb-2" />
        <p className="text-xs font-bold text-ink-800">No Unused Topics Available</p>
        <p className="text-[11px] text-ink-500 mt-1">
          All generated brand topics are currently scheduled on your calendar. Use <strong>Custom Request</strong> tab to create a custom topic.
        </p>
      </div>
    )}
  </div>
)}
```

---

## 2. Requirement R3: Festival Handling & Opt-outs

### 2.1 Backend API Endpoints for Dynamic Festival Dates
`mint-more-backend` provides three existing API endpoints that supply dynamic festival dates and creative events:

1. **`GET /api/v1/creative/calendar?month=YYYY-MM`**
   - **Route**: `src/modules/creative/creative.routes.js` line 9
   - **Controller**: `calendar` in `creative.controller.js`
   - **Service**: `listCalendar` in `creative.service.js` (lines 436-469)
   - **Database Query**:
     ```sql
     SELECT event.*, category.name AS category_name
     FROM creative_events event
     LEFT JOIN categories category ON category.id = event.category_id
     WHERE event.month_key = $1 AND event.status = 'published'
     ORDER BY event.event_date ASC, event.created_at ASC
     ```
   - **Response Structure**:
     ```json
     {
       "status": "success",
       "data": {
         "month": "2026-11",
         "balance": 100,
         "events": [
           {
             "id": "uuid",
             "title": "Diwali Special",
             "description": "Diwali festive campaign",
             "event_date": "2026-11-12T00:00:00.000Z",
             "category_name": "Festivals",
             "asset_type": "social_post"
           }
         ]
       }
     }
     ```

2. **`GET /api/v1/creative/events/suggestions?month=YYYY-MM`**
   - **Route**: `src/modules/creative/creative.routes.js` line 51
   - **Controller**: `suggestCalendarEvents` in `creative.service.js` (lines 1389-1415)
   - **Data Source**: iCal feed from Google Indian Holiday Calendar (`https://calendar.google.com/calendar/ical/en.indian%23holiday%40group.v.calendar.google.com/public/basic.ics`) combined with fallback occasions, deduplicated against `creative_events`.
   - **Response Structure**: `{ month: "2026-11", suggestions: [...] }`.

3. **`POST /api/v1/ai/onboarding-topics`**
   - **Route**: `src/modules/ai/ai.routes.js` line 36
   - **Controller**: `generateOnboardingTopics` in `ai.controller.js`
   - **Service**: `generateOnboardingTopics` in `ai.service.js` (lines 1789-1835)
   - **Database Query**:
     ```sql
     SELECT id, title, description, event_date 
     FROM creative_events 
     WHERE event_date >= CURRENT_DATE 
       AND event_date <= CURRENT_DATE + interval '35 days'
       AND status = 'active'
     ORDER BY event_date ASC
     ```
   - **Function**: Fetches active dynamic festivals within the next 35 days and passes them to AI, which curates up to 5 relevant festival topics marked with `"type": "festival"`, `"festival_id"`, and `"date"`.

### 2.2 Frontend Onboarding Context & Festival Fetching
1. **`src/pages/client/Onboarding.jsx`**:
   - Queries `creativeApi.calendar({ month: currentMonth })` and `creativeApi.calendar({ month: nextMonth })` using `@tanstack/react-query` (lines 198-212).
   - Combines results into `onboardingEvents`.
   - Passes `onboardingEvents` into `useCalendarState(form, onboardingEvents)`.
   - Maintains `form.festival_mode` (`'autopilot'` vs `'manual'`) and `form.selected_festivals`.
   - Currently includes hardcoded `sampleFestivals` static array (Diwali, Holi, Durga Puja, Eid, Independence Day, Christmas) as fallback.

2. **`src/pages/client/onboarding/FestivalsPage.jsx`**:
   - Allows client to select `festival_mode` (`autopilot` vs `manual`) and `festival_lead_days` (`3`, `7`, `11`).

3. **`src/pages/client/onboarding/useCalendarState.js`**:
   - Generates default base topics where `topic-5` is categorized as `festival`.
   - Accepts `onboardingEvents`, but currently relies on static template topics without merging dynamic backend festival dates directly into `scheduledDays`.

### 2.3 Festival Slot Rendering on Calendar Grid
In `src/pages/client/onboarding/PreviewApprovePage.jsx`:
- Days with festival topics display a 🎉 festive icon badge, festival title, and festive tag styling.
- Clicking on a festival day opens the "Swap Scheduled Topic" modal.

### 2.4 Opting Out of a Festival & Exact Replacement Logic

#### Opt-Out Scenarios
1. **Scenario A (Modal-Level Swap / Opt-Out)**: User opens the swap modal on a scheduled festival date slot and selects a standard brand topic from Tab 1 ("Unused Topics") or Tab 3 ("Custom Request").
2. **Scenario B (Global Festival Mode Opt-Out)**: User changes `festival_mode` from `autopilot` to `manual`, or unchecks/opts out of festival post coverage altogether.

#### Exact Logic for Automatic Replacement & Frequency Maintenance
To ensure the total posting frequency (e.g. 12 posts per 4-week window for 3 posts/week) is strictly preserved without creating blank days or dropping post count:

1. **Invariant Rule**: **Total active post count MUST remain constant**.
   - `scheduledDays.filter(d => d.hasPost).length` must equal `(posting_frequency / 7) * 28` post days (e.g. 12 for frequency 3, 20 for frequency 5, 28 for frequency 7).

2. **Modal Swap Replacement Logic (Scenario A)**:
   - When a user swaps out a festival slot on `targetDateKey`:
     - `calendarOverrides[targetDateKey]` is set to `{ topicId: newTopicId, status: 'swapped' }`.
     - `hasPost` for `targetDateKey` remains `true`.
     - The festival topic is removed from that slot and replaced with the selected `newTopicId` (from Tab 1) or a newly generated custom topic ID (from Tab 3).
     - Posting frequency is preserved (12/12 slots filled).

3. **Global Opt-Out / Festival Removal Replacement Logic (Scenario B)**:
   - When a user sets `festival_mode` to `'manual'` or opts out of festival topics:
     - Any date slot that previously hosted a festival post retains `hasPost: true`.
     - `useCalendarState.js` filters out festival-category topics from the automatic assignment pool (`brandTopics = safeTopics.filter(t => t.category !== 'festival')`).
     - It sequentially re-assigns standard brand topics from `brandTopics` across all active post slots (`hasPost: true`).
     - Formula for slot assignment when festival mode is disabled:
       ```javascript
       const brandTopics = safeTopics.filter(t => t.category !== 'festival')
       assignedTopic = brandTopics[brandTopicIndex % brandTopics.length]
       brandTopicIndex++
       ```
     - Result: The calendar slot previously occupied by the festival is automatically replaced by the next available standard brand topic, keeping total scheduled posts exactly equal to the configured posting frequency.

---

## 3. Implementation Verification Checklist

| Requirement | Target File(s) | Verification Step | Expected Result |
|---|---|---|---|
| **R2** | `PreviewApprovePage.jsx` | Open Swap Modal on any scheduled date | Tab 1 shows ONLY topics not scheduled on ANY day of 28-day calendar. |
| **R2** | `PreviewApprovePage.jsx` | Check empty state when all topics scheduled | Displays helpful info box suggesting Custom Request. |
| **R3** | `Onboarding.jsx`, `useCalendarState.js` | Fetch backend festivals via `creativeApi.calendar` | Dynamic festival dates are passed into calendar generator. |
| **R3** | `PreviewApprovePage.jsx`, `useCalendarState.js` | Swap festival slot to brand topic or disable festival mode | Date retains `hasPost: true`, replaced with brand topic, total posts (e.g. 12) stays constant. |

---
