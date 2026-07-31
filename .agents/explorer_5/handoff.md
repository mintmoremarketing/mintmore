# Handoff Report: Explorer 5 (Requirements R2 & R3 Investigation)

**Agent ID**: explorer_5  
**Working Directory**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_5`  
**Target Project**: Mint-More SaaS (`mint-more-frontend` & `mint-more-backend`)  
**Date**: 2026-07-31  

---

## 1. Observation

### Observation 1.1: Frontend Unused Topics Filtering Logic (Requirement R2)
In `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx` (lines 391-414):
```jsx
391: {activeSwapTab === 'unused' && (
392:   <div className="space-y-2">
393:     {topics
394:       ?.filter(t => t.id !== activeDateItem?.topic?.id)
395:       .map(topic => (
396:         <div
397:           key={topic.id}
...
```
- Line 394 performs filtering via `topics?.filter(t => t.id !== activeDateItem?.topic?.id)`.
- This filter ONLY excludes the topic assigned to `activeDateItem` (the target date being swapped). It does NOT check whether `t.id` is scheduled on any other date in `scheduledDays`.

### Observation 1.2: Calendar Topic Assignment and Duplication (Requirement R2)
In `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js` (lines 245-308):
```javascript
253: const frequency = parseInt(form?.posting_frequency || '3', 10)
254: const postDaysPattern = {
255:   1: [3],
256:   3: [1, 3, 5],
257:   5: [1, 2, 3, 4, 5],
258:   7: [0, 1, 2, 3, 4, 5, 6],
259: }[frequency] || [1, 3, 5]
260: const safeTopics = topics && topics.length > 0 ? topics : generateTopicsForBrand(form)
...
297: } else {
298:   assignedTopic = safeTopics[topicIndex % safeTopics.length]
299:   topicIndex++
300: }
```
- `generateTopicsForBrand(form)` returns 7 topics (`topic-1` through `topic-7`).
- For 3 posts/week over 28 days (12 posts), `topicIndex` increments from 0 to 11.
- `safeTopics[topicIndex % safeTopics.length]` re-uses `topic-1` through `topic-5` for slots 8 through 12, causing topics to be scheduled multiple times on the calendar.

### Observation 1.3: Backend Endpoints for Dynamic Festival Dates (Requirement R3)
In `mint-more-backend`:
1. `mint-more-backend/src/modules/creative/creative.routes.js` (line 9) & `creative.service.js` (lines 436-469):
   - Endpoint `GET /api/v1/creative/calendar?month=YYYY-MM` queries `creative_events` table for published events (`WHERE event.month_key = $1 AND event.status = 'published'`).
2. `mint-more-backend/src/modules/creative/creative.routes.js` (line 51) & `creative.service.js` (lines 1389-1415):
   - Endpoint `GET /api/v1/creative/events/suggestions?month=YYYY-MM` fetches Indian holiday calendar iCal feed from Google Calendar and returns suggestions.
3. `mint-more-backend/src/modules/ai/ai.routes.js` (line 36) & `ai.service.js` (lines 1789-1835):
   - Endpoint `POST /api/v1/ai/onboarding-topics` executes SQL:
     ```sql
     SELECT id, title, description, event_date 
     FROM creative_events 
     WHERE event_date >= CURRENT_DATE 
       AND event_date <= CURRENT_DATE + interval '35 days'
       AND status = 'active'
     ORDER BY event_date ASC
     ```
     Passes upcoming festivals to AI to pick up to 5 relevant festival topics.

### Observation 1.4: Frontend Onboarding Festival Context & Swap Handling (Requirement R3)
In `mint-more-frontend/src/pages/client/Onboarding.jsx` (lines 198-214):
- React Query fetches `creativeApi.calendar({ month: currentMonth })` and `creativeApi.calendar({ month: nextMonth })`, combined into `onboardingEvents`.
- In `PreviewApprovePage.jsx` (lines 40-69):
  - When user swaps a topic (including festival topics), `handleConfirmSwap()` executes `handleSwapTopic(targetDateKey, selectedSwapTopicId)`.
  - `handleSwapTopic` in `useCalendarState.js` updates `calendarOverrides[dateKey]` with the new topic ID, setting `status: 'swapped'`.
  - The calendar slot retains `hasPost: true`.

---

## 2. Logic Chain

1. **R2 Reasoning**:
   - *Observation 1.1* shows `PreviewApprovePage.jsx` only filters out `t.id !== activeDateItem?.topic?.id`.
   - *Observation 1.2* shows that because there are 7 base topics and 12 post slots in 4 weeks, modulo indexing repeats `topic-1` through `topic-5` across multiple dates.
   - Therefore, when opening the swap modal, topics assigned to other days on the calendar still pass the filter `t.id !== activeDateItem?.topic?.id` and appear as "Unused Topics", violating the requirement that unused topics must be strictly unassigned.
   - *Conclusion for R2*: The filter must compute `scheduledTopicIds = Set(scheduledDays.filter(d => d.hasPost && d.topic?.id).map(d => d.topic.id))` and filter `topics` via `!scheduledTopicIds.has(topic.id)`.

2. **R3 Reasoning**:
   - *Observation 1.3* identifies the three existing backend endpoints providing dynamic festival data (`GET /creative/calendar`, `GET /creative/events/suggestions`, `POST /ai/onboarding-topics`).
   - *Observation 1.4* shows how `Onboarding.jsx` fetches `onboardingEvents` and how `useCalendarState.js` manages calendar overrides when swapping.
   - When a user opts out of a festival (or swaps away a festival topic), setting `calendarOverrides[targetDateKey]` to a standard brand topic keeps `hasPost: true` on that date.
   - For global festival opt-out (`festival_mode: 'manual'`), `useCalendarState.js` filters out festival-category topics and sequentially assigns standard brand topics (`safeTopics.filter(t => t.category !== 'festival')`) to all active post days.
   - *Conclusion for R3*: Total posting frequency (12 posts) is preserved invariant because `hasPost: true` is maintained on the slot and filled with a standard brand topic.

---

## 3. Caveats

- **No caveats**. Investigation covers exact line numbers, SQL queries, frontend rendering paths, and mathematical frequency calculations.

---

## 4. Conclusion

1. **R2 Solution**: Update `PreviewApprovePage.jsx` to filter `topics` by checking `!scheduledTopicIds.has(topic.id)` where `scheduledTopicIds` is a set of all topic IDs currently present on any active post slot (`hasPost: true`) across `scheduledDays`. Add an empty-state UI when all topics are scheduled.
2. **R3 Solution**: 
   - Backend APIs (`GET /api/v1/creative/calendar`, `GET /api/v1/creative/events/suggestions`, `POST /api/v1/ai/onboarding-topics`) provide dynamic festival data.
   - When a festival slot is opted out (via modal swap or global festival mode toggle), the calendar slot retains `hasPost: true` and is automatically populated with an unassigned standard brand topic from the topic pool, maintaining total posting frequency.

---

## 5. Verification Method

To independently verify the investigation findings and proposed implementation:

1. **Files to Inspect**:
   - `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx` (lines 391-414 for unused topic filtering, lines 40-69 for swap handler).
   - `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js` (lines 245-325 for scheduledDays modulo indexing, lines 327-366 for `handleSwapTopic`).
   - `mint-more-backend/src/modules/creative/creative.service.js` (lines 436-469 for `listCalendar`, lines 1389-1415 for `suggestCalendarEvents`).
   - `mint-more-backend/src/modules/ai/ai.service.js` (lines 1789-1835 for `generateOnboardingTopics`).

2. **Manual Invalidation Test**:
   - Set posting frequency to 3 posts/week (12 posts total across 4 weeks).
   - Check `scheduledDays`: topics `topic-1` through `topic-5` repeat on slots 8..12.
   - Open swap modal on Slot 1 (`topic-1`). Verify that under current code, `topic-2` through `topic-5` erroneously appear in "Unused Topics".
   - Apply set-based filter `!scheduledTopicIds.has(topic.id)`. Verify "Unused Topics" strictly excludes all scheduled topics (`topic-1` through `topic-7`).
   - Swap a festival slot to a standard brand topic. Verify `scheduledDays.filter(d => d.hasPost).length` remains 12.
