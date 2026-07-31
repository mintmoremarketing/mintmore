# Handoff Report — Requirement R1 (Step 11 AI Topic Generation)

**Agent**: Explorer 4  
**Workspace**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_4`  
**Date**: 2026-07-31  

---

## 1. Observation

### Backend Findings
- **Endpoint Route**: `POST /api/v1/ai/onboarding-topics` defined in `mint-more-backend/src/modules/ai/ai.routes.js:36`. Protected by `authenticate` middleware (`ai.routes.js:9`).
- **Controller Implementation**: `generateOnboardingTopics` in `mint-more-backend/src/modules/ai/ai.controller.js:73-83`. Passes `req.body` to `aiService.generateOnboardingTopics`.
- **Service & OpenRouter Logic**: `generateOnboardingTopics` in `mint-more-backend/src/modules/ai/ai.service.js:1789-1868`.
  - Queries active upcoming events from PostgreSQL table `creative_events` for the next 35 days:
    `WHERE event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + interval '35 days' AND status = 'active'`
  - Calls `generateText('openrouter/free', prompt, { max_tokens: 2000, temperature: 0.7 }, systemPrompt)`.
  - Generates 15 content topics (up to 5 festival topics with `festival_id` and `date`, plus brand topics).
  - Robust JSON extraction with regex fallback to 15 hardcoded default topics if OpenRouter output formatting fails.

### Frontend Findings
- **API Client Function**: `aiApi.generateOnboardingTopics(data)` defined in `mint-more-frontend/src/api/ai.js:23-24` calling `api.post('/ai/onboarding-topics', data)`.
- **Step 11 Component**: `mint-more-frontend/src/pages/client/onboarding/ContentGenerationPage.jsx` currently displays only a static 4-step loading checklist without any API integration or flashcards UI.
- **Onboarding Master Control**: `mint-more-frontend/src/pages/client/Onboarding.jsx:296-308` currently runs a fake 6.2-second `setTimeout` timer sequence that cycles `generationPhase` and hard-navigates to `/onboarding/step-12` without calling the backend endpoint.
- **Calendar Topics Hook**: `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js:230-399` generates 7 static template topics per industry via `generateTopicsForBrand(form)` rather than consuming AI-generated topics from Step 11.

---

## 2. Logic Chain

1. **Backend Readiness**:
   - Observation: Backend has route `POST /api/v1/ai/onboarding-topics` connected to `aiService.generateOnboardingTopics` which calls OpenRouter (`openrouter/free`) and returns 15 topics.
   - Inference: The backend API layer is 100% complete and ready for frontend consumption without requiring backend architectural changes.

2. **Frontend Disconnect**:
   - Observation: Frontend has `aiApi.generateOnboardingTopics` in `src/api/ai.js`, but `Onboarding.jsx:296` uses a dummy `setTimeout` timer to auto-navigate from Step 11 to Step 12. `ContentGenerationPage.jsx` lacks an interactive flashcard component.
   - Inference: The current Step 11 implementation is a placeholder UI and needs to be wired to the backend API and augmented with a Yes/No flashcard approval deck.

3. **Calendar Integration**:
   - Observation: `useCalendarState.js` initializes `topics` state with 7 hardcoded template topics from `generateTopicsForBrand(form)`.
   - Inference: `useCalendarState.js` must be updated to accept the 15 approved OpenRouter topics generated in Step 11 so that Step 12 (`PreviewApprovePage.jsx`) renders real AI content.

---

## 3. Caveats

- **OpenRouter API Key Requirement**: OpenRouter API calls require `OPENROUTER_API_KEY` in `mint-more-backend/.env`. If missing or invalid, `aiService.generateOnboardingTopics` will trigger its internal fallback and return 15 default structured brand topics.
- **Database Seed Data**: The endpoint queries `creative_events` table for upcoming active festivals in the next 35 days. If no active events exist in the database for the next 35 days, the prompt will state "None" for festivals and generate 15 brand topics instead.

---

## 4. Conclusion

Requirement R1 is fully investigated and feasible. Connecting `ContentGenerationPage.jsx` to the OpenRouter endpoint requires:
1. Wiring `aiApi.generateOnboardingTopics(payload)` inside `Onboarding.jsx` / `ContentGenerationPage.jsx` on Step 11 mount.
2. Replacing the fake 6.2s navigation timer with an interactive 15-topic Yes/No Flashcard Deck UI in `ContentGenerationPage.jsx`.
3. Updating `useCalendarState.js` to accept the approved AI topics and map them onto the 28-day calendar schedule in Step 12.

Detailed technical specifications and design plans are documented in `analysis.md`.

---

## 5. Verification Method

To verify this investigation and the upcoming implementation:
1. **Backend Verification**:
   - Inspect backend files:
     - `mint-more-backend/src/modules/ai/ai.routes.js` (line 36)
     - `mint-more-backend/src/modules/ai/ai.controller.js` (line 73)
     - `mint-more-backend/src/modules/ai/ai.service.js` (line 1789)
2. **Frontend Inspection**:
   - View `mint-more-frontend/src/api/ai.js` (line 23)
   - View `mint-more-frontend/src/pages/client/Onboarding.jsx` (lines 296–308)
   - View `mint-more-frontend/src/pages/client/onboarding/ContentGenerationPage.jsx`
   - View `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
3. **Execution Verification (when implementer applies changes)**:
   - Run backend server and trigger `POST /api/v1/ai/onboarding-topics` via REST client or browser onboarding flow.
   - Confirm 15 topics are generated, rendered on flashcards in Step 11, and reflected on the 28-day calendar grid in Step 12.
