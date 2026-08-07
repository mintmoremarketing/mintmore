export const ONBOARDING_STEPS = [
  { number: 1, slug: 'step-1', label: 'Workspace Details' },
  { number: 2, slug: 'step-2', label: 'Business Basics' },
  { number: 3, slug: 'step-3', label: 'Account Verification' },
  { number: 4, slug: 'step-4', label: 'Brand Voice' },
  { number: 5, slug: 'step-5', label: 'Brand Assets' },
  { number: 6, slug: 'step-6', label: 'Visual Palette' },
  { number: 7, slug: 'step-7', label: 'Content Cadence' },
  { number: 8, slug: 'step-8', label: 'Festivals & Occasions' },
  { number: 9, slug: 'step-9', label: 'Approval Rules' },
  { number: 10, slug: 'step-10', label: 'Connect Channels' },
  { number: 11, slug: 'step-11', label: 'WhatsApp & Reminders' },
  { number: 12, slug: 'step-12', label: 'Content Generation' },
  { number: 13, slug: 'step-13', label: 'Calendar Plan' },
]

export const ONBOARDING_SECTION_GROUPS = [
  {
    step: 1,
    label: 'Brand & Workspace',
    subSteps: [
      { step: 1, label: 'Workspace Details' },
      { step: 2, label: 'Business Basics' },
      { step: 3, label: 'Account Verification' },
      { step: 4, label: 'Brand Voice' },
    ],
  },
  {
    step: 5,
    label: 'Visual Palette & Logos',
    subSteps: [
      { step: 5, label: 'Brand Assets' },
      { step: 6, label: 'Visual Palette' },
    ],
  },
  {
    step: 7,
    label: 'Content & Occasions',
    subSteps: [
      { step: 7, label: 'Content Cadence' },
      { step: 8, label: 'Festivals & Occasions' },
      { step: 9, label: 'Approval Rules' },
    ],
  },
  {
    step: 10,
    label: 'Connected Channels',
    subSteps: [
      { step: 10, label: 'Connect Channels' },
      { step: 11, label: 'WhatsApp & Reminders' },
    ],
  },
  {
    step: 12,
    label: 'First Content Plan',
    subSteps: [
      { step: 12, label: 'Content Generation' },
      { step: 13, label: 'Calendar Plan' },
    ],
  },
]

export function getOnboardingStepByNumber(number) {
  return ONBOARDING_STEPS.find(step => step.number === number)
}

export function getOnboardingStepBySlug(slug) {
  return ONBOARDING_STEPS.find(step => step.slug === slug)
}
