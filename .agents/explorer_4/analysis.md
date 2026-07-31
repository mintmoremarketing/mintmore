# Comprehensive Analysis Report: Requirement R1 (Step 11 AI Topic Generation)

**Agent**: Explorer 4  
**Workspace**: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\.agents\explorer_4`  
**Date**: 2026-07-31  

---

## Executive Summary

Requirement R1 specifies connecting Step 11 of the onboarding flow (`ContentGenerationPage.jsx`) to the existing backend API endpoint that uses OpenRouter to generate ~15 AI topic flashcards (with Yes/No approvals) based on user details submitted during onboarding steps 1-10.

Our investigation confirms:
1. **Backend OpenRouter Endpoint**: The backend already has a fully functional API endpoint `POST /api/v1/ai/onboarding-topics` implemented in `ai.routes.js`, `ai.controller.js`, and `ai.service.js`. It fetches upcoming active festivals from the database, constructs a structured prompt for OpenRouter (`openrouter/free`), and returns 15 topic objects (brand & festival topics) with robust fallback handling.
2. **Frontend State & Gap**: The frontend API client `src/api/ai.js` already exports `aiApi.generateOnboardingTopics(data)`. However, `ContentGenerationPage.jsx` currently displays a fake 6.2-second CSS animation timer that cycles through 4 static progress phases before hard-navigating to Step 12. No real API call is made, no flashcard interface is rendered, and Step 12 (`PreviewApprovePage.jsx`) relies on 7 hardcoded static template topics per industry via `useCalendarState.js`.
3. **Fix Plan**: We have formulated a complete technical specification to connect `ContentGenerationPage.jsx` and `useCalendarState.js` to the backend OpenRouter endpoint, introduce an interactive 15-topic Flashcard Approval Deck UI in Step 11, and seamlessly pass approved AI topics into the 28-day calendar grid in Step 12.

---

## 1. Backend Investigation Findings (`mint-more-backend`)

### 1.1 Route & Endpoint Details
- **File**: `mint-more-backend/src/modules/ai/ai.routes.js` (Line 36)
- **HTTP Method & Path**: `POST /api/v1/ai/onboarding-topics`
- **Middleware**: `router.use(authenticate)` (requires JWT Bearer Token in `Authorization` header).

### 1.2 Controller Implementation
- **File**: `mint-more-backend/src/modules/ai/ai.controller.js` (Lines 73–83)
- **Function**: `generateOnboardingTopics(req, res, next)`
- **Behavior**: Receives `req.body` payload, delegates execution to `aiService.generateOnboardingTopics(req.body)`, logs request and topic count, and returns JSON response wrapped in `sendSuccess(res, { data: topics })`.

### 1.3 Service & OpenRouter Integration
- **File**: `mint-more-backend/src/modules/ai/ai.service.js` (Lines 1789–1868)
- **Function**: `generateOnboardingTopics(payload)`
- **Expected Request Payload**:
  | Parameter | Type | Default | Purpose |
  |---|---|---|---|
  | `business_name` | String | `'My Business'` | Name of the workspace/brand |
  | `business_type` | String | `'Retail'` | Industry category (e.g., restaurant, fashion, fitness, etc.) |
  | `description` | String | `'General audience'` | Customer profile / target audience description |
  | `preferred_language` | String | `'English'` | Target content language (e.g., English, Hindi, Hinglish) |
  | `address_state` | String | `'India'` | Regional/state context for localized festivals |
  | `festival_mode` | String | `'autopilot'` | `'autopilot'` or `'manual'` festival scheduling preference |

- **Database Query**: Fetches active upcoming festivals occurring within the next 35 days from PostgreSQL:
  ```sql
  SELECT id, title, description, event_date 
  FROM creative_events 
  WHERE event_date >= CURRENT_DATE 
    AND event_date <= CURRENT_DATE + interval '35 days'
    AND status = 'active'
  ORDER BY event_date ASC
  ```
- **OpenRouter Call**: Calls `generateText('openrouter/free', prompt, { max_tokens: 2000, temperature: 0.7 }, systemPrompt)` where `systemPrompt` demands strictly valid JSON.
- **AI Prompt Specification**:
  - Selects up to 5 most relevant festivals based on region and industry.
  - Generates brand-specific topics for remaining slots to complete exactly 15 topics.
  - Returns raw JSON array of objects with fields:
    - `title`: String
    - `desc`: String (1-2 sentences)
    - `type`: `'festival'` | `'brand'`
    - `festival_id`: String (UUID) (present if type is `'festival'`)
    - `date`: String (`YYYY-MM-DD`) (present if type is `'festival'`)
- **Parsing & Fallback**:
  - Strips markdown code blocks (```json ... ```) and extracts array via regex `/\[[\s\S]*\]/`.
  - If JSON parsing fails or OpenRouter errors out, catches error and returns an array of 15 default fallback brand topics tailored to `business_name` and `business_type`.

---

## 2. Frontend Investigation Findings (`mint-more-frontend`)

### 2.1 Existing API Client
- **File**: `mint-more-frontend/src/api/ai.js` (Line 23–24)
- **Method**: `generateOnboardingTopics: (data) => api.post('/ai/onboarding-topics', data)`
- Status: Fully declared and ready to use via `aiApi`.

### 2.2 Current Step 11 Implementation (`ContentGenerationPage.jsx`)
- **File**: `mint-more-frontend/src/pages/client/onboarding/ContentGenerationPage.jsx`
- Current behavior:
  - Displays progress UI with 4 static items (Analyzing brand voice context, Injecting regional occasion rules, Structuring 7-day starter plan, Applying design templates).
  - Uses `generationPhase` prop from context.
  - Does NOT contain any user controls, flashcards, or API call triggers.

### 2.3 Onboarding Parent State (`Onboarding.jsx`)
- **File**: `mint-more-frontend/src/pages/client/Onboarding.jsx` (Lines 296–308)
- Current mock implementation:
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
- **Limitation**: This static timer bypasses real topic generation completely.

### 2.4 Calendar & Topics State Hook (`useCalendarState.js`)
- **File**: `mint-more-frontend/src/pages/client/onboarding/useCalendarState.js`
- Current behavior:
  - Contains `generateTopicsForBrand(form)` which returns 7 static template topics for restaurant/fashion or default.
  - Populates 28-day calendar by looping through these 7 static topics (`safeTopics[topicIndex % safeTopics.length]`).

---

## 3. Technical Specification & Implementation Plan for R1

To achieve full connection between the frontend onboarding flow and the backend OpenRouter endpoint with an interactive ~15 Yes/No topic flashcard deck:

### 3.1 Data Flow Architecture

```
[Onboarding Form State] (Steps 1–10)
        │
        ▼
[ContentGenerationPage.jsx] (Step 11 Mounts)
        │
        ├─► 1. Trigger `aiApi.generateOnboardingTopics(payload)`
        │     Payload: { business_name, business_type, description, preferred_language, address_state, festival_mode }
        │
        ├─► 2. Show Animated Loading Phase while API request is pending
        │
        ├─► 3. On Success: Load 15 Topics into Flashcard Approval Deck UI
        │     - User reviews each of the 15 flashcards
        │     - Can click "👍 Approve / Yes" or "👎 Reject / No" on cards
        │     - Shows "X of 15 Approved" count & progress
        │
        └─► 4. On User Click "Continue to Calendar Schedule":
              - Pass approved topics to `useCalendarState` / Onboarding context
              - Navigate to Step 12 (`PreviewApprovePage.jsx`)
                    │
                    ▼
              [Step 12 Calendar Plan]
              - Populates 28-day schedule with user-approved OpenRouter topics
```

### 3.2 Detailed Technical Changes Required

#### Change 1: Update `Onboarding.jsx`
- Replace dummy 6.2s navigation timer in `Onboarding.jsx` with real state management for AI topic generation:
  - Add state `aiTopics` (array) and `isGeneratingTopics` (boolean) and `generationError` (string/null).
  - Add a handler `fetchOnboardingTopics()` that executes `aiApi.generateOnboardingTopics(payload)`.
  - Provide `aiTopics`, `setAiTopics`, `isGeneratingTopics`, `fetchOnboardingTopics` inside `onboardingContext`.

#### Change 2: Redesign `ContentGenerationPage.jsx` into Two-State Component
- **State A: Loading / Generation Animation**:
  - Shown while `isGeneratingTopics` is true or during initial loading.
  - Automatically advances progress steps (1 to 4) dynamically as API completes.
- **State B: Interactive Flashcard Approval Deck**:
  - Displays a modern, stackable flashcard UI showing 1-of-15 generated topics.
  - Flashcard Details:
    - **Header**: Topic index badge (e.g. `Topic 3 of 15`), Category Pill (`Festival` vs `Brand`), Format Badge (`Reel`, `Carousel`, `Post`).
    - **Body**: Title (bold), Description / Concept, Festival Date (if applicable), Draft Hashtags.
    - **Action Controls**:
      - ❌ / 👎 **Reject / Skip (No)** button.
      - ✅ / 👍 **Approve / Keep (Yes)** button.
      - ⚡ **"Approve All 15"** shortcut button.
      - 🔄 **"Regenerate Topics with AI"** button.
  - **Footer Action**: "Proceed to 28-Day Calendar Schedule" button (enabled when at least 1 topic is approved).

#### Change 3: Update `useCalendarState.js`
- Modify `useCalendarState(form, onboardingEvents, customTopics)` to accept `aiTopics` from onboarding context.
- When `aiTopics` are provided (from OpenRouter backend response), normalize topics and use them to fill the 28-day schedule instead of the 7 static mock fallback topics:
  ```javascript
  const safeTopics = customTopics && customTopics.length > 0 
    ? customTopics 
    : generateTopicsForBrand(form);
  ```

---

## 4. Verification & Testing Protocol

To verify Requirement R1 after implementation:
1. **Backend Verification**:
   - Send `POST /api/v1/ai/onboarding-topics` with authorization header and sample payload.
   - Confirm response status 200 and return data containing array of 15 topic objects.
2. **Frontend Component Verification**:
   - Navigate to `/onboarding/step-11` in browser / React dev environment.
   - Verify API call is fired with correct payload.
   - Verify flashcard deck loads 15 topics.
   - Test Yes/No interactions, Approve All, and navigation to step 12.
3. **Integration Verification**:
   - Verify step 12 calendar displays the approved OpenRouter topics across the 28 days.

---

## 5. Conclusion & Actionable Recommendation

Requirement R1 has a complete, working backend endpoint ready in `mint-more-backend`. The frontend implementation requires replacing the mock timer in `Onboarding.jsx` and enhancing `ContentGenerationPage.jsx` with an interactive flashcard component connected to `aiApi.generateOnboardingTopics`.
