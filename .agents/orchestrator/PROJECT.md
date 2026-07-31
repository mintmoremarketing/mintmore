# Project: Mint-More SaaS Phase 2 Requirements (R1 - R5)

## Architecture
- Root directory: `c:\Users\devde\OneDrive\Desktop\Demo projects\Mint-more\saas`
- Frontend: `mint-more-frontend` (`ContentGenerationPage.jsx`, `PreviewApprovePage.jsx`, `useOnboardingContext.js`, Swap modal component)
- Backend: `mint-more-backend` (OpenRouter API endpoints, dynamic festival dates API endpoints)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Architecture | Explore backend API endpoints (OpenRouter & Festivals), frontend components, and state | None | IN_PROGRESS |
| 2 | R1: Step 11 AI Topic Gen | Hook up `ContentGenerationPage.jsx` to OpenRouter backend endpoint for 15 flashcards | M1 | PLANNED |
| 3 | R2 & R3: Swap Logic & Festival Opt-out | Strict unused topics filter in Swap modal; dynamic festival fetch & opt-out swap to brand topic | M1, M2 | PLANNED |
| 4 | R4 & R5: Click-to-Swap & Sidebar Auto-Scroll | Click calendar tile -> open swap modal; Hover calendar tile -> scroll sidebar item to viewport | M1 | PLANNED |
| 5 | Verification & Testing | Build/run checks, functional verification by Reviewers and Challengers | M2, M3, M4 | PLANNED |
| 6 | Forensic Integrity Audit | Integrity verification by Forensic Auditor | M5 | PLANNED |

## Code Layout
`mint-more-frontend/src/`
- `pages/client/onboarding/ContentGenerationPage.jsx` (or equivalent)
- `pages/client/onboarding/PreviewApprovePage.jsx`
- `pages/client/onboarding/useOnboardingContext.js`
`mint-more-backend/`
- API routes & controllers for OpenRouter AI generation & festival dates
