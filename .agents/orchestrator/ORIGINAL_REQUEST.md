# Original User Request

## 2026-07-31T10:25:50Z

Restore the robust edge-to-edge calendar UI and interactive sidebar (previously built in the `Onboarding.jsx` monolith) into the newly refactored `PreviewApprovePage.jsx` component, ensuring it integrates perfectly with the new state architecture.

Working directory: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas\mint-more-frontend\src\pages\client\onboarding`
Integrity mode: development

## Requirements

### R1. Calendar UI Restoration
Restore the detailed edge-to-edge calendar grid, including the format pills (Reels, Carousels, Posts). The calendar panel should have no margins or rounded corners isolating it from the left edge or top edge.

### R2. Interactive Sidebar Integration
Re-implement the right-hand sidebar with its dual-mode functionality:
- Default: A scrollable list of scheduled topics (no jumping or auto-opening on hover).
- Hover: Hovering a date in the calendar switches the sidebar to focus on that specific day's topic.
- Click to Expand: Clicking a topic card in the list expands it inline and shows the "Swap Scheduled Topic" button.

### R3. Modularity and State Management
The agent team must review the new architecture and decide the best place to store the calendar state (e.g., `approvedTopics`, `scheduledDays`, `calendarOverrides`). The solution must allow seamless data sharing between the Topic Generation step and the Preview Approve step without breaking the modularity of the new files.

## Acceptance Criteria

### Implementation Quality
- [x] The `PreviewApprovePage.jsx` component successfully renders the edge-to-edge calendar grid and sidebar.
- [x] The sidebar toggles correctly between the default list view and the focused hover view.
- [x] Clicking a sidebar item expands it inline via an accordion effect.

### System Stability
- [x] The frontend compiles successfully without any React hook errors or missing dependencies.
- [x] The state management approach cleanly integrates into the existing `useOnboardingContext.js` or equivalent, preserving the separation of concerns.

## 2026-07-31T11:15:20Z

Refine the calendar swap logic and UI interactions, and restore the AI topic generation (Step 11). Ensure "unused" topics are strictly unused, handle festival opt-outs cleanly, improve sidebar hover focus, and make calendar tiles clickable to open the swap modal.

Working directory: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas`
Integrity mode: development

## Requirements

### R1. Step 11 AI Topic Generation
Hook up the frontend `ContentGenerationPage.jsx` (or equivalent) to the existing backend API endpoint that uses OpenRouter. Generate the ~15 yes/no topic flashcards based on the user's details from previous steps. 
*Note: You must search the `mint-more-backend` directory to find the correct endpoint.*

### R2. Strict Unused Topics Logic
In the "Swap Scheduled Topic" modal (Tab 1), ensure the "Unused Topics" list rigorously filters out any topics that are already scheduled anywhere else on the calendar. A topic must never repeat across the calendar.

### R3. Festival Handling & Opt-outs
Fetch dynamic festival dates from the existing backend API. If a user opts out of a festival in the calendar via the swap modal, automatically swap that slot with a standard brand topic, adjusting the calendar to maintain the user's posting frequency.

### R4. UI/UX: Click-to-Swap
Clicking directly on a calendar tile that has a scheduled post must instantly open the "Swap Scheduled Topic" modal focused on that specific date.

### R5. UI/UX: Sidebar Hover Auto-Scroll
When a user hovers over a calendar tile, the sidebar must expand that day's topic AND automatically scroll the sidebar so that the specific topic is brought into the visible viewport.

## Acceptance Criteria

### Functional Quality
- [ ] The backend API is successfully called to generate the Step 11 flashcards.
- [ ] Topics shown in the "Unused Topics" tab do not exist anywhere on the current calendar.
- [ ] Swapping out a festival seamlessly replaces it with a brand topic without breaking the total post count.
- [ ] Clicking a scheduled tile opens the swap modal.
- [ ] Hovering a scheduled tile scrolls the sidebar to the expanded topic.

### System Stability
- [ ] The frontend and backend compile and run successfully without any errors.
