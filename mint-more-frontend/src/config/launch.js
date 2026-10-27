// Services launch: the fixed-price catalogue is the product. Social-agency
// features (calendar, social posting/insights, Mint AI, onboarding, MintCoins)
// stay in the codebase but are forced off here regardless of server flags.
export const LAUNCH_FLAG_OVERRIDES = {
  calendar_creatives: false,
  social_insights: false,
  posting: false,
  mint_ai: false,
  custom_requests: false,
  marketplace: false,
  negotiation: false,
  chat: true,
  mintbox: true,
}

export const withLaunchFlags = (flags = {}) => ({ ...flags, ...LAUNCH_FLAG_OVERRIDES })
