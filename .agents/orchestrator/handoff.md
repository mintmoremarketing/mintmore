# Handoff Report — Project Orchestrator (Succession Handoff)

**Date**: 2026-07-31  
**From Generation**: Gen 1 Orchestrator  
**To Generation**: Gen 2 Orchestrator (Successor)  
**Workspace**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\orchestrator`

---

## 1. Milestone State

| Milestone | Status | Notes |
|-----------|--------|-------|
| Phase 1: Calendar UI & Sidebar Restoration | DONE | Successfully implemented, verified, and audited CLEAN |
| Phase 2 M1: Requirements R1-R5 Exploration | DONE | Completed by Explorers 4, 5, 6 |
| Phase 2 M2: R1 Step 11 AI Topic Gen Hookup | READY | Tech spec ready from Explorer 4 |
| Phase 2 M3: R2 Strict Unused & R3 Festival Logic | READY | Tech spec ready from Explorer 5 |
| Phase 2 M4: R4 Click-to-Swap & R5 Hover Scroll | READY | Tech spec ready from Explorer 6 |
| Phase 2 M5: Verification & Review | PLANNED | Reviewers & Challengers |
| Phase 2 M6: Forensic Integrity Audit | PLANNED | Forensic Auditor |

---

## 2. Technical Findings & Implementation Specifications

### Requirement R1: Step 11 AI Topic Generation (OpenRouter Endpoint)
- **Backend Route**: `POST /api/v1/ai/onboarding-topics` (`mint-more-backend/src/modules/ai/ai.routes.js:36`, controller `ai.controller.js:73`, service `ai.service.js:1789`). Queries `creative_events`, calls OpenRouter (`openrouter/free`), returns 15 topics.
- **Frontend Hookup**:
  1. `mint-more-frontend/src/api/ai.js` already exports `aiApi.generateOnboardingTopics(data)`.
  2. `Onboarding.jsx` / `ContentGenerationPage.jsx`: Replace fake 6.2s `setTimeout` timer in Step 11 with actual API call to `aiApi.generateOnboardingTopics`.
  3. Render an interactive 15-topic Yes/No Flashcard Deck UI in `ContentGenerationPage.jsx`.
  4. Update `useCalendarState.js` to accept the 15 AI-generated topics and map them across the 28-day calendar in Step 12 (`PreviewApprovePage.jsx`).

### Requirement R2: Strict Unused Topics Logic
- **Target File**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx` (and `useCalendarState.js`).
- **Fix**: In the Swap modal (Tab 1), calculate `scheduledTopicIds = new Set(scheduledDays.filter(d => d.hasPost && d.topic?.id).map(d => d.topic.id))`. Filter unused topics using `topics.filter(t => !scheduledTopicIds.has(t.id))`. Ensure no topic scheduled anywhere on the calendar appears in the unused topics list. Add empty state if all topics are scheduled.

### Requirement R3: Festival Handling & Opt-outs
- **Backend APIs**: `GET /api/v1/creative/calendar`, `GET /api/v1/creative/events/suggestions`, `POST /api/v1/ai/onboarding-topics`.
- **Fix**: In `useCalendarState.js` and `PreviewApprovePage.jsx`, when a user opts out of a festival slot in the swap modal (or toggles festival mode), automatically swap that slot with an unassigned standard brand topic while maintaining `hasPost: true` on that date. Total posting frequency (e.g. 12 posts) is strictly preserved.

### Requirement R4: UI/UX Click-to-Swap
- **Target File**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`.
- **Fix**: Update the calendar day tile `<div onClick>` and topic card click handlers so that clicking directly on a scheduled calendar tile calls `openSwapModal(day.dateKey)` and sets `expandedTopicId(day.topic.id)`, opening the Swap Topic modal instantly for that date.

### Requirement R5: UI/UX Sidebar Hover Auto-Scroll
- **Target File**: `mint-more-frontend/src/pages/client/onboarding/PreviewApprovePage.jsx`.
- **Fix**: Attach `sidebarItemRefs = useRef({})` to topic card components in the right sidebar. Add a `useEffect` watching `hoveredDateKey`. When `hoveredDateKey` changes, invoke `targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the matching ref to bring off-screen hovered topics into the visible sidebar viewport.

---

## 3. Concrete Next Steps for Successor (Gen 2)

1. Reset spawn count to 0 for Gen 2 generation.
2. Dispatch **Worker 4** (`teamwork_preview_worker`) to implement R1, R2, R3, R4, R5 in `mint-more-frontend` and ensure seamless integration with `mint-more-backend`.
3. Dispatch **Reviewer 4** and **Reviewer 5** (`teamwork_preview_reviewer`) to review the implementation and verify build stability.
4. Dispatch **Challenger 3** (`teamwork_preview_challenger`) to run empirical tests on unused topic filtering, festival opt-outs, tile click-to-swap, and hover auto-scroll.
5. Dispatch **Auditor 3** (`teamwork_preview_auditor`) to perform the mandatory Forensic Integrity Audit.
6. Verify all criteria pass and report victory to parent.

---

## 4. Key Artifact Index
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\orchestrator\ORIGINAL_REQUEST.md`
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\orchestrator\PROJECT.md`
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\orchestrator\BRIEFING.md`
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\orchestrator\progress.md`
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_4\handoff.md`
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_5\handoff.md`
- `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_6\handoff.md`
