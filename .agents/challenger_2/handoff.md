# Empirical Verification & Adversarial Challenge Report

**Agent**: Challenger 2 (Empirical Challenger)  
**Target Module**: Onboarding Step 12 (`Onboarding.jsx`, `PreviewApprovePage.jsx`, `useCalendarState.js`)  
**Verdict**: **FAIL (Defect Discovered in Hook State Logic & Swap Modal Interaction)**

---

## 1. Observation

### 1.1 Source Inspection & Test Execution Findings

#### A. State Flow Defect in `useCalendarState.js` (Unapproved Swapped Topics)
- **File**: `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
- **Lines**: 285–303
```javascript
285:      if (hasPost) {
286:        if (override?.topicId) {
287:          assignedTopic = topics.find(t => t.id === override.topicId) || {
288:            id: override.topicId,
289:            title: override.customTitle || 'Custom Topic',
290:            description: override.customDesc || 'Custom topic request',
291:            format: 'post',
292:            category: 'custom',
293:            captionPreview: override.customCaption || 'Custom topic content',
294:          }
295:          status = 'swapped'
296:        } else {
297:          assignedTopic = topics[topicIndex % topics.length]
298:          topicIndex++
299:        }
300:        assignedFormat = override?.format || assignedTopic?.format || 'post'
301:        if (approvedTopicIds.includes(assignedTopic?.id)) {
302:          status = override?.status || (override?.topicId ? 'swapped' : 'approved')
303:        }
304:      }
```
- **Direct Observation**: Line 295 sets `status = 'swapped'`. Line 301 checks `if (approvedTopicIds.includes(assignedTopic?.id))`. If `approvedTopicIds` does **not** include `assignedTopic.id` (i.e. the topic is unapproved), line 301 evaluates to `false` and line 302 does **not** run. Consequently, `status` remains `'swapped'` rather than being downgraded to `'draft'`.
- **Empirical Harness Result**: Executed `node test_use_calendar_state_full.js`:
  ```
  [FAIL] Swapped custom topic downgraded to "draft" if customId unapproved
  ```

#### B. Past Days Schedule Suppression in `useCalendarState.js`
- **File**: `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
- **Line**: 277
```javascript
277:      const defaultHasPost = !isPast && postDaysPattern.includes(dayOfWeek)
```
- **Direct Observation**: Past days in the 28-day window (days between the nearest Sunday and `today`) have `isPast = true`. Line 277 sets `defaultHasPost` to `false` for all past days.
- **Empirical Harness Result**: When initializing a schedule with `posting_frequency: '3'`, if the current day is Friday, the initial week's Sunday through Thursday (5 days) have `isPast = true`. The 28-day grid generates only 10 scheduled posts instead of the expected 12 posts.

#### C. Swap Modal Festival Selection Behavior in `PreviewApprovePage.jsx`
- **File**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`
- **Lines**: 377–381
```javascript
377:                      onClick={() => {
378:                        const festTopic = topics?.find(t => t.category === 'festival') || topics?.[0]
379:                        if (festTopic) {
380:                          setSelectedSwapTopicId(festTopic.id)
381:                        }
382:                      }}
```
- **Direct Observation**: Clicking any festival option in the `Other Festivals` tab in the Swap Modal selects the first topic in `topics` with `category === 'festival'` (or `topics[0]`). It does not pass festival-specific metadata (e.g. `fest.name`), nor does the UI render a selection highlight ring on the clicked festival card (unlike the `Unused Topics` tab on line 356).

### 1.2 Layout & Edge-to-Edge Styling Verification
- **File**: `mint-more-frontend/src/pages/client/Onboarding.jsx`
- **Lines 893–894**:
```jsx
<div className={currentStep.number === 12 ? "flex-1 overflow-y-auto flex flex-col min-h-0 p-0" : "flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 md:px-16 md:py-10"}>
  <div className={currentStep.number === 12 ? "w-full h-full flex flex-col flex-1 min-h-0" : "w-full max-w-[640px] mx-auto lg:mx-0"}>
    <Outlet context={onboardingContext} />
  </div>
</div>
```
- **Observation**: Container padding is zeroed (`p-0`), allowing `PreviewApprovePage` to expand to full width (`w-full flex-1 h-full`).
- **Floating Bar Offset**: In `PreviewApprovePage.jsx` line 435:
```jsx
<div className="fixed bottom-0 left-0 lg:left-80 right-0 p-4 bg-white border-t border-hairline-strong shadow-lg z-40 flex justify-between items-center">
```
`lg:left-80` (`320px`) aligns with `Onboarding.jsx` sidebar width (`w-80`), preventing overlapping with the left sidebar on desktop viewports. `pb-20` on `PreviewApprovePage` root prevents element clipping at the bottom of the scroll container.

### 1.3 Production Build Output
- **Command**: `npm run build` in `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend`
- **Result**: Command succeeded with 0 compilation errors.
```
✓ 308 modules transformed.
rendering chunks...
dist/index.html                     1.09 kB │ gzip:   0.53 kB
dist/assets/index-BQ8EBy1M.css    234.51 kB │ gzip:  43.42 kB
dist/assets/index-CUWC_VvU.js   1,610.89 kB │ gzip: 403.65 kB
✓ built in 12.30s
```

---

## 2. Logic Chain

1. **State Flow Defect**:
   - `useCalendarState.js` initializes topic status for swapped items to `'swapped'` at line 295.
   - When checking approval status via `approvedTopicIds.includes(assignedTopic?.id)` at line 301, if the topic is unapproved, the code inside the `if` block (line 302) is skipped.
   - Because `status` was initialized to `'swapped'` instead of `'draft'`, skipping line 302 leaves `status` set to `'swapped'`.
   - Therefore, unapproving a swapped topic fails to transition its status to `'draft'`, violating expected state consistency.

2. **Past Days Calculation**:
   - Line 277 calculates `defaultHasPost = !isPast && postDaysPattern.includes(dayOfWeek)`.
   - The 28-day window aligns `start` to the preceding Sunday.
   - Any days between `start` and `today` have `isPast = true`, suppressing automatic topic scheduling for those past dates.

3. **Swap Modal UX**:
   - Clicking festival cards sets `selectedSwapTopicId` to `festTopic.id`, but does not apply `border-mint-500` or `ring-1` CSS classes to indicate selection.

4. **Container Layout**:
   - Step 12 CSS rules in `Onboarding.jsx` (`p-0`, `w-full h-full min-h-0 flex-1`) correctly clear default container padding and max-width constraints (`max-w-[640px]`), permitting edge-to-edge calendar display.

---

## 3. Caveats

- **Mocked Browser APIs**: Empirical test harness ran under Node.js environment simulating React Hook state math and date calculations.
- **Festival Customization**: The festival swap tab reuses existing festival category topics rather than dynamically constructing new festival-specific custom prompt payloads.

---

## 4. Conclusion

- **Overall Verdict**: **FAIL**
- **Summary**:
  1. Container styles in `Onboarding.jsx` properly allow Step 12 full-width and full-height edge-to-edge layout without CSS overflow clips.
  2. Production build (`npm run build`) passes cleanly in 12.3 seconds.
  3. **Defect Found in `useCalendarState.js`**: Unapproved swapped topics retain `'swapped'` status instead of being downgraded to `'draft'`.
  4. **UI Discrepancy in `PreviewApprovePage.jsx`**: Festival swap tab lacks card selection highlighting and customized topic payload generation.

---

## 5. Verification Method

To independently verify these findings:

1. **Run full empirical test harness**:
   ```powershell
   node "c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\challenger_2\test_use_calendar_state_full.js"
   ```
   *Expected output*: `Summary: 28 passed, 1 failed.` (Test 5b fails due to unapproved swapped topic status retention).

2. **Run production build**:
   ```powershell
   cd "c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend"
   npm run build
   ```
   *Expected output*: `✓ built in ~12s` with 0 errors.

3. **Inspect source lines**:
   - `useCalendarState.js` lines 295 & 301–302 (status assignment logic for unapproved swapped topics).
   - `PreviewApprovePage.jsx` lines 377–385 (festival swap modal selection logic).
   - `Onboarding.jsx` lines 893–894 (Step 12 container layout styling).
