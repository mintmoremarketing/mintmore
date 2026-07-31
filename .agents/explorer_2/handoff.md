# Handoff Report — Explorer 2: Onboarding State Architecture & Calendar State Integration Design

## 1. Observation

### 1.1 Existing Context Architecture (`useOnboardingContext.js` & `Onboarding.jsx`)
- File `mint-more-frontend/src/pages/client/onboarding/useOnboardingContext.js`:
  ```javascript
  1: import { useOutletContext } from 'react-router-dom'
  2: 
  3: export function useOnboardingContext() {
  4:   return useOutletContext()
  5: }
  ```
  `useOnboardingContext` is a wrapper around React Router's `useOutletContext()`.
- File `mint-more-frontend/src/pages/client/Onboarding.jsx` (lines 888):
  ```javascript
  888: <Outlet context={onboardingContext} />
  ```
  `Onboarding.jsx` acts as the root onboarding layout and state container. It manages form state (`form`), profile data, posting preferences, palette customization, and generation timer.

### 1.2 Current State Schema in `Onboarding.jsx` (lines 135–161)
- `form` contains form fields:
  - `business_name`, `business_type`, `address_city`, `address_state`, `preferred_language`, `website`, `description`
  - `tone`, `avoided_words`, `mandatory_words`, `palette`, `logos`
  - `posting_frequency` ('1' | '3' | '5' | '7'), `evergreen_ratio`, `festival_mode` ('autopilot' | 'manual'), `selected_festivals`, `festival_lead_days`
  - `connected_platforms`, `whatsapp_number`, `whatsapp_consent`, `quiet_hours`, `approval_policy`

### 1.3 Step Transitions and Topic Generation (Step 11 -> Step 12)
- Step 11 (`ContentGenerationPage.jsx`, `slug: 'step-11'`):
  - Managed by `Onboarding.jsx` (lines 293–305):
    ```javascript
    useEffect(() => {
      if (currentStep.number !== 11) return
      const timers = [
        setTimeout(() => setGenerationPhase(1), 1200),
        setTimeout(() => setGenerationPhase(2), 2400),
        setTimeout(() => setGenerationPhase(3), 3600),
        setTimeout(() => setGenerationPhase(4), 4800),
        setTimeout(() => navigate(`/onboarding/${getOnboardingStepByNumber(12).slug}`), 6200),
      ]
      return () => timers.forEach(clearTimeout)
    }, [currentStep.number, navigate])
    ```
  - During Step 11, `generationPhase` transitions from 0 to 4 across 6.2s.
  - Currently, **no actual topic data or calendar schedule is written to state** during Step 11.

### 1.4 Current Preview & Approval Implementation (`PreviewApprovePage.jsx`)
- In `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx` (lines 11–56):
  - `PreviewApprovePage` currently constructs a 28-day grid locally inside a `useMemo` based strictly on `form.posting_frequency`:
    ```javascript
    const days = useMemo(() => {
      // Calculates posts per week based on frequency (1, 3, 5, 7)
      // Generates 28 days with boolean hasPost
    }, [form.posting_frequency])
    ```
  - **Deficiencies Identified**:
    1. Calendar state (`approvedTopics`, `scheduledDays`, `calendarOverrides`) is completely absent.
    2. Data generated in Step 11 is not passed to Step 12.
    3. Grid lacks format pills (`Reels`, `Carousels`, `Posts`).
    4. Sidebar is missing: no topic list, no hover date focusing, no inline accordion expand, no Swap Topic button.
    5. User interactions (swapping topics, overriding dates, approving topics) cannot persist because there is no backing state container in `useOnboardingContext`.

---

## 2. Logic Chain

1. **Observation 1.1 & 1.2**: `Onboarding.jsx` provides `onboardingContext` via `<Outlet context={onboardingContext} />`. `useOnboardingContext()` provides child step pages access to this context object.
2. **Observation 1.3**: Step 11 (`ContentGenerationPage.jsx`) handles the visual progress of content generation, but currently does not populate any structured topic or schedule data before navigating to Step 12 (`PreviewApprovePage.jsx`).
3. **Observation 1.4**: `PreviewApprovePage.jsx` calculates a dummy boolean `hasPost` locally on each render. Because state is isolated within `PreviewApprovePage` and limited to `form.posting_frequency`, topic swapping, calendar overrides, format pill filtering, and sidebar hover/click states cannot be shared or persisted across steps or subcomponents.
4. **Logical Deduction**:
   - To cleanly integrate calendar state without breaking modularity or altering existing steps (Steps 1–10):
     - We must encapsulate calendar state, topic generation, scheduling, and override actions inside a dedicated custom hook: `useCalendarState.js`.
     - `Onboarding.jsx` should invoke `useCalendarState(form, onboardingEvents)` and spread its returned properties and action handlers into `onboardingContext`.
     - Step 11 (`ContentGenerationPage.jsx` / `Onboarding.jsx`) will trigger `generateCalendarSchedule()` during phase transitions.
     - Step 12 (`PreviewApprovePage.jsx`) will consume `scheduledDays`, `approvedTopics`, `calendarOverrides`, `hoveredDateKey`, `expandedTopicId`, `formatFilter`, and action handlers directly from `useOnboardingContext()`.

---

## 3. Caveats

- **API Persistence vs Client-side Preview**: Onboarding preview is primarily client-side interactive state before the final `handleFinishOnboarding` call. On approval, the final schedule state (`scheduledDays`, `calendarOverrides`, `approvedTopics`) should be posted to the backend API (`/profile/me` or `/creative/calendar/init`).
- **Date Range Scope**: The onboarding calendar preview models a 4-week (28-day) starter plan starting from the nearest Sunday.

---

## 4. Conclusion & Recommended Architecture

### 4.1 Recommended State Schema

```typescript
// Topic Data Schema
interface OnboardingTopic {
  id: string;                      // Unique ID (e.g. 'topic-1')
  title: string;                   // Topic headline / title
  description: string;             // Short content summary
  format: 'reel' | 'carousel' | 'post'; // Content format pill
  category: 'evergreen' | 'festival' | 'promotional' | 'engagement';
  festivalName?: string;           // Optional associated festival name
  captionPreview: string;          // Draft copy
  visualPrompt: string;            // Visual description / image concept
  hashtags: string[];              // Relevant hashtags
}

// Scheduled Day Grid Item Schema
interface ScheduledDayItem {
  dateKey: string;                 // Format 'YYYY-MM-DD'
  date: Date;                      // Date object
  dayNum: number;                  // Day of month
  dayOfWeek: number;               // 0-6 (Sun-Sat)
  isPast: boolean;                 // Is date in the past
  isToday: boolean;                // Is date today
  hasPost: boolean;                // True if post scheduled on this date
  topic: OnboardingTopic | null;   // Active assigned topic
  format: 'reel' | 'carousel' | 'post' | null; // Effective format
  status: 'draft' | 'approved' | 'swapped';   // Status
}

// Calendar Overrides Schema
type CalendarOverrides = Record<string, { // Keyed by dateKey ('YYYY-MM-DD')
  topicId?: string;
  format?: 'reel' | 'carousel' | 'post';
  status?: 'draft' | 'approved' | 'swapped';
  customCaption?: string;
}>;
```

### 4.2 Modular Hook Architecture (`src/pages/client/onboarding/useCalendarState.js`)

Create `useCalendarState.js` with the following state properties and actions:

```javascript
import { useState, useMemo, useCallback, useEffect } from 'react'

// Topic generator helper based on business context
export function generateTopicsForBrand(form) {
  const brandName = form.business_name || 'Your Brand'
  const type = form.business_type || 'restaurant'
  
  // Topic templates tailored per industry & format
  const baseTopics = [
    {
      id: 'topic-1',
      title: `Behind the Scenes at ${brandName}`,
      description: 'Showcase daily preparation, quality ingredients, and team passion.',
      format: 'reel',
      category: 'evergreen',
      captionPreview: `Ever wondered what goes on behind the doors of ${brandName}? Here's an exclusive peak at our process! ✨ #behindthescenes #${type}`,
      visualPrompt: 'A crisp, fast-paced video montage showing morning prep and craftsmanship.',
      hashtags: ['#behindthescenes', '#brandstory', '#qualitycraft'],
    },
    {
      id: 'topic-2',
      title: 'Customer Favorites & Top Picks',
      description: 'Highlighting top products/services with customer testimonials.',
      format: 'carousel',
      category: 'promotional',
      captionPreview: `Here are top 3 picks our community loves at ${brandName}! Swipe to see why. 👉 #topfavorites #customerchoice`,
      visualPrompt: 'Multi-slide gallery displaying bestsellers with rating badges.',
      hashtags: ['#bestsellers', '#customerfavorite', '#topservice'],
    },
    {
      id: 'topic-3',
      title: 'Weekly Special Showcase',
      description: 'Highlighting weekly offer, seasonal deal, or featured item.',
      format: 'post',
      category: 'promotional',
      captionPreview: `Special announcement from ${brandName}! Don't miss out on our featured experience this week. 🌟`,
      visualPrompt: 'Clean product highlight card in brand palette.',
      hashtags: ['#weeklyspecial', '#specialoffer', '#limitedtime'],
    },
    {
      id: 'topic-4',
      title: 'Expert Tips & Community Care',
      description: 'Value-add tips and engaging question for audience interaction.',
      format: 'carousel',
      category: 'engagement',
      captionPreview: `3 quick tips for our community! Save this post for later. 📌 What's your favorite tip? Comment below!`,
      visualPrompt: 'Educational carousel cards with clean typography and icons.',
      hashtags: ['#tiptuesday', '#communitycare', '#valuepost'],
    },
    {
      id: 'topic-5',
      title: 'Festival Celebration & Warm Greetings',
      description: 'Seasonal greeting post aligned with selected regional occasions.',
      format: 'reel',
      category: 'festival',
      captionPreview: `Warmest wishes on this festive occasion from all of us at ${brandName}! May your celebrations be filled with joy and prosperity. 🎉✨`,
      visualPrompt: 'Festive design layout featuring brand colors and traditional decorative accents.',
      hashtags: ['#festivevibes', '#celebrations', '#festivalspecial'],
    },
    {
      id: 'topic-6',
      title: 'Community Q&A & Spotlight',
      description: 'Answering common customer questions and celebrating loyal clients.',
      format: 'post',
      category: 'engagement',
      captionPreview: `We love hearing from you! Here is the top question we get asked at ${brandName}, answered. 💬`,
      visualPrompt: 'Q&A callout visual card with warm background gradient.',
      hashtags: ['#faq', '#communityspotlight', '#askus'],
    },
    {
      id: 'topic-7',
      title: 'Weekend Special Announcement',
      description: 'High-energy call to action for weekend visits/orders.',
      format: 'reel',
      category: 'promotional',
      captionPreview: `Weekend plans? We've got you covered at ${brandName}! Drop by with friends & family. 🥳`,
      visualPrompt: 'High-energy reel preview with upbeat overlay text.',
      hashtags: ['#weekendvibes', '#weekendplans', '#visitus'],
    },
  ]
  return baseTopics
}

export function useCalendarState(form, onboardingEvents = []) {
  const [topics, setTopics] = useState(() => generateTopicsForBrand(form))
  const [approvedTopicIds, setApprovedTopicIds] = useState(() => topics.map(t => t.id))
  const [calendarOverrides, setCalendarOverrides] = useState({})
  const [hoveredDateKey, setHoveredDateKey] = useState(null)
  const [expandedTopicId, setExpandedTopicId] = useState(null)
  const [formatFilter, setFormatFilter] = useState('all') // 'all' | 'reel' | 'carousel' | 'post'
  const [swapModalState, setSwapModalState] = useState({ isOpen: false, targetDateKey: null })

  // Re-generate topic pool when brand profile changes materially
  useEffect(() => {
    const generated = generateTopicsForBrand(form)
    setTopics(generated)
    setApprovedTopicIds(generated.map(t => t.id))
  }, [form.business_name, form.business_type])

  // Compute 28-day grid schedule with overrides applied
  const scheduledDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(start.getDate() - start.getDay()) // Align to nearest Sunday

    const frequency = parseInt(form.posting_frequency || '3', 10)
    const postDaysPattern = {
      1: [3],
      3: [1, 3, 5],
      5: [1, 2, 3, 4, 5],
      7: [0, 1, 2, 3, 4, 5, 6],
    }[frequency] || [1, 3, 5]

    const result = []
    let topicIndex = 0

    for (let i = 0; i < 28; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)

      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`

      const isPast = d < today
      const isToday = d.getTime() === today.getTime()
      const dayOfWeek = d.getDay()

      const override = calendarOverrides[dateKey]
      const defaultHasPost = !isPast && postDaysPattern.includes(dayOfWeek)
      const hasPost = override?.hasPost !== undefined ? override.hasPost : defaultHasPost

      let assignedTopic = null
      let assignedFormat = null
      let status = 'draft'

      if (hasPost) {
        if (override?.topicId) {
          assignedTopic = topics.find(t => t.id === override.topicId) || topics[0]
          status = 'swapped'
        } else {
          assignedTopic = topics[topicIndex % topics.length]
          topicIndex++
        }
        assignedFormat = override?.format || assignedTopic?.format || 'post'
        if (approvedTopicIds.includes(assignedTopic?.id)) {
          status = override?.status || 'approved'
        }
      }

      result.push({
        dateKey,
        date: d,
        dayNum: d.getDate(),
        dayOfWeek,
        isPast,
        isToday,
        hasPost,
        topic: assignedTopic,
        format: assignedFormat,
        status,
      })
    }

    return result
  }, [form.posting_frequency, calendarOverrides, topics, approvedTopicIds])

  // Action handlers
  const handleSwapTopic = useCallback((dateKey, newTopicId) => {
    setCalendarOverrides(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        topicId: newTopicId,
        status: 'swapped',
      },
    }))
    setSwapModalState({ isOpen: false, targetDateKey: null })
  }, [])

  const toggleTopicApproval = useCallback((topicId) => {
    setApprovedTopicIds(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    )
  }, [])

  const openSwapModal = useCallback((dateKey) => {
    setSwapModalState({ isOpen: true, targetDateKey: dateKey })
  }, [])

  const closeSwapModal = useCallback(() => {
    setSwapModalState({ isOpen: false, targetDateKey: null })
  }, [])

  return {
    topics,
    approvedTopicIds,
    scheduledDays,
    calendarOverrides,
    hoveredDateKey,
    expandedTopicId,
    formatFilter,
    swapModalState,
    setHoveredDateKey,
    setExpandedTopicId,
    setFormatFilter,
    handleSwapTopic,
    toggleTopicApproval,
    openSwapModal,
    closeSwapModal,
  }
}
```

### 4.3 Integration into `Onboarding.jsx`

In `mint-more-frontend/src/pages/client/Onboarding.jsx`:
1. Import `useCalendarState`:
   ```javascript
   import { useCalendarState } from './useCalendarState'
   ```
2. Call `useCalendarState` inside `Onboarding()` component:
   ```javascript
   const calendarState = useCalendarState(form, onboardingEvents)
   ```
3. Pass `calendarState` inside `onboardingContext`:
   ```javascript
   const onboardingContext = useMemo(() => ({
     // ... existing onboarding properties ...
     ...calendarState,
   }), [
     // ... existing deps ...
     calendarState,
   ])
   ```

### 4.4 Data Flow Summary between Steps

| Step | Trigger / Component | Data Action / State Flow |
|------|---------------------|--------------------------|
| **Step 6** | `ContentCadencePage.jsx` | Updates `form.posting_frequency` (1, 3, 5, or 7 posts/week). `useCalendarState` recalculates `postDaysPattern`. |
| **Step 7** | `FestivalsPage.jsx` | Updates `form.festival_mode` & `form.selected_festivals`. Includes festival topics in pool. |
| **Step 11** | `ContentGenerationPage.jsx` | Progresses `generationPhase` (0 -> 4). Pre-warms `topics` & `approvedTopicIds` in `calendarState`. |
| **Step 12** | `PreviewApprovePage.jsx` | Reads `scheduledDays`, `hoveredDateKey`, `expandedTopicId`, `formatFilter`, and `calendarOverrides`. Renders edge-to-edge calendar grid + dual-mode interactive sidebar. Supports hover date focus, accordion topic expansion, format pill filtering, and topic swapping. |

---

## 5. Verification Method

1. **Static Analysis & React Context Validation**:
   - Inspect `useOnboardingContext.js` and `Onboarding.jsx` to verify `<Outlet context={onboardingContext} />` exposes `scheduledDays`, `hoveredDateKey`, `expandedTopicId`, `handleSwapTopic`, etc.
   - Verify zero breaking changes to existing steps (Steps 1–10 continue invoking `useOnboardingContext()` without errors).
2. **Frontend Build Verification**:
   - Execute frontend build check via terminal command in `mint-more-frontend`:
     ```powershell
     npm run build
     ```
   - Confirm build succeeds with no TypeScript or JSX compilation errors.
3. **Functional Verification in PreviewApprovePage**:
   - Verify hover state: Hovering over a calendar cell updates `hoveredDateKey`, highlighting the topic in the sidebar.
   - Verify accordion click: Clicking a sidebar card expands it and reveals the "Swap Topic" button.
   - Verify topic swap: Swapping a topic updates `calendarOverrides[dateKey]`, immediately updating the corresponding date cell on the calendar grid.
