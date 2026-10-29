const { getSetting } = require('../commerce/settings.service');

/**
 * What an AI edit costs the client, and what its AI calls cost us. Admins can tune both through
 * the `ai_edits` platform setting; a variant's own ai_price always wins over the derived price.
 *
 * The token rates are USD per million tokens. Check them against the current Anthropic price list
 * before launch: the proxy charges each video's budget with them.
 */
const DEFAULT_AI_EDIT_SETTINGS = {
  price_ratio: 0.4,
  min_price: 299,
  budget_usd_per_video: 6,
  token_days: 30,
  rates: {
    'claude-opus': { input: 5, output: 25 },
    'claude-sonnet': { input: 3, output: 15 },
    'claude-haiku': { input: 1, output: 5 },
  },
  cache_read_multiplier: 0.1,
  cache_write_multiplier: 1.25,
};

const getAiEditSettings = async () => ({
  ...DEFAULT_AI_EDIT_SETTINGS,
  ...((await getSetting('ai_edits', DEFAULT_AI_EDIT_SETTINGS)) || {}),
});

/** Prices end in 9, like the rest of the catalogue. */
const aiPrice = (variant, settings) => {
  if (variant.ai_price !== null && variant.ai_price !== undefined) return Number(variant.ai_price);
  const derived = Math.ceil((Number(variant.price) * Number(settings.price_ratio)) / 10) * 10 - 1;
  return Math.max(Number(settings.min_price) * Number(variant.pack_size || 1), derived);
};

const ratesFor = (model, settings) => {
  const family = Object.keys(settings.rates).find((prefix) => String(model || '').startsWith(prefix));
  // An unknown model is charged at the most expensive rate, never for free.
  return settings.rates[family] || settings.rates['claude-opus'];
};

const usageCost = (usage, model, settings) => {
  const rate = ratesFor(model, settings);
  const perToken = (n, r) => (Number(n) || 0) * r / 1e6;
  return perToken(usage.input_tokens, rate.input)
    + perToken(usage.output_tokens, rate.output)
    + perToken(usage.cache_read_input_tokens, rate.input * settings.cache_read_multiplier)
    + perToken(usage.cache_creation_input_tokens, rate.input * settings.cache_write_multiplier);
};

module.exports = { DEFAULT_AI_EDIT_SETTINGS, getAiEditSettings, aiPrice, usageCost };
