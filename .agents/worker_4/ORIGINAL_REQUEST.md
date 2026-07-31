## 2026-07-31T11:18:43Z
You are Worker 4 (teamwork_preview_worker) assigned to implement Phase 2 Requirements R1 through R5 for the Mint-More SaaS project.

Working Directory for your metadata/handoff: c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\worker_4
Project Root: c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas

Detailed Tasks:

1. Requirement R1 (Step 11 AI Topic Generation Hookup & Flashcard Deck UI):
   - Hook up ContentGenerationPage.jsx (and/or Onboarding.jsx Step 11) to backend OpenRouter API POST /api/v1/ai/onboarding-topics using aiApi.generateOnboardingTopics(data) in mint-more-frontend/src/api/ai.js.
   - Replace any dummy timer/mock data in Step 11 with the real API call.
   - Implement an interactive 15-topic Yes/No Flashcard Deck UI in Step 11 where users swipe/click Yes/No on generated topics.
   - Pass approved topics to useCalendarState.js / useOnboardingContext.js so they populate the 28-day calendar in Step 12 (PreviewApprovePage.jsx).

2. Requirement R2 (Strict Unused Topics Logic):
   - In mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx (and useCalendarState.js), update the Swap Topic modal (Tab 1: Unused Topics).
   - Implement strict set-based filtering:
     const scheduledTopicIds = new Set(scheduledDays.filter(d => d.hasPost && d.topic?.id).map(d => d.topic.id));
     const unusedTopics = topics.filter(t => !scheduledTopicIds.has(t.id));
   - Ensure NO topic currently scheduled on ANY day of the calendar appears in Tab 1 ("Unused Topics"). Include clean empty state handling if all topics are scheduled.

3. Requirement R3 (Festival Handling & Opt-outs):
   - In useCalendarState.js and PreviewApprovePage.jsx, fetch dynamic festival dates from backend API (/api/v1/creative/calendar or /api/v1/creative/events/suggestions or /api/v1/ai/onboarding-topics).
   - When a user opts out of a festival slot in the swap modal (or toggles festival mode off for a slot), automatically replace that festival slot with an unassigned standard brand topic while keeping hasPost: true on that date.
   - Strictly preserve total posting frequency (e.g. 12 scheduled posts stay 12 scheduled posts).

4. Requirement R4 (Click-to-Swap Tile Modal Opening):
   - In PreviewApprovePage.jsx, update calendar day tile click handlers.
   - Clicking directly on a scheduled calendar day tile must invoke openSwapModal(day.dateKey) (and expand that topic in the sidebar), instantly opening the "Swap Scheduled Topic" modal focused on that specific date.

5. Requirement R5 (Sidebar Hover Auto-Scroll):
   - In PreviewApprovePage.jsx, implement sidebar hover auto-scroll using React refs.
   - Create sidebarItemRefs = useRef({}) mapping dateKey to DOM elements for topic cards in the right sidebar.
   - Add a useEffect watching hoveredDateKey (or active hovered day state). When hoveredDateKey is set, locate sidebarItemRefs.current[hoveredDateKey] and invoke scrollIntoView({ behavior: 'smooth', block: 'nearest' }) so off-screen hovered topics smoothly scroll into view.
