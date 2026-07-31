## 2026-07-31T10:37:00Z

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
- [ ] The `PreviewApprovePage.jsx` component successfully renders the edge-to-edge calendar grid and sidebar.
- [ ] The sidebar toggles correctly between the default list view and the focused hover view.
- [ ] Clicking a sidebar item expands it inline via an accordion effect.

### System Stability
- [ ] The frontend compiles successfully without any React hook errors or missing dependencies.
- [ ] The state management approach cleanly integrates into the existing `useOnboardingContext.js` or equivalent, preserving the separation of concerns.
