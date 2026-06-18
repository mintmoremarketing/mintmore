const { query } = require('../../config/database');

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPETITIVE_TOLERANCE = 0.15;

/**
 * Hard deprioritisation threshold.
 * price_min > experienced_max × 1.5 → very low pricing score.
 * Not a hard block — scoring-based.
 */
const HARD_EXCLUSION_MULTIPLIER = 1.5;

// ── Market Range Fetch ────────────────────────────────────────────────────────

/**
 * Fetch price range row for a category.
 * Returns null if none configured — callers must handle null.
 */
const getCategoryPriceRange = async (categoryId) => {
  if (!categoryId) return null;

  const result = await query(
    `SELECT * FROM category_price_ranges WHERE category_id = $1`,
    [categoryId]
  );

  return result.rows[0] || null;
};

/**
 * Get market range formatted for frontend job creation flow.
 * Used to show "Typical range: ₹X – ₹Y" to clients.
 */
const getMarketRangeForClient = async (categoryId, pricingMode) => {
  const range = await getCategoryPriceRange(categoryId);
  if (!range) return null;

  if (pricingMode === 'budget') {
    return {
      min:       range.beginner_min,
      max:       range.intermediate_max,
      currency:  range.currency,
      label:     'Typical budget range',
      breakdown: {
        beginner:     { min: range.beginner_min,     max: range.beginner_max },
        intermediate: { min: range.intermediate_min, max: range.intermediate_max },
      },
    };
  }

  return {
    min:       range.experienced_min,
    max:       range.experienced_max,
    currency:  range.currency,
    label:     'Typical expert range',
    breakdown: {
      experienced: { min: range.experienced_min, max: range.experienced_max },
    },
  };
};

/**
 * Get pricing guidance for the freelancer's profile page.
 * Returns market position hint + human-readable warning/encouragement.
 */
const getFreelancerPricingGuidance = async (
  categoryId,
  freelancerLevel,
  priceMin,
  priceMax
) => {
  const range = await getCategoryPriceRange(categoryId);

  if (!range) {
    return {
      has_range:       false,
      message:         'No market data available for this category yet.',
      market_position: 'unknown',
    };
  }

  const bandMin = range[`${freelancerLevel}_min`];
  const bandMax = range[`${freelancerLevel}_max`];

  if (!priceMin || !priceMax) {
    return {
      has_range:       true,
      market_min:      bandMin,
      market_max:      bandMax,
      currency:        range.currency,
      market_position: 'unknown',
      message:         `Most freelancers at ${freelancerLevel} level charge ₹${Number(bandMin).toLocaleString('en-IN')} – ₹${Number(bandMax).toLocaleString('en-IN')}. Set your pricing to improve visibility.`,
    };
  }

  const position = classifyFreelancerPosition(
    priceMin,
    bandMin,
    bandMax,
    range.intermediate_max
  );

  const messages = {
    competitive: `✅ Your pricing is competitive. You are well within the ₹${Number(bandMin).toLocaleString('en-IN')} – ₹${Number(bandMax).toLocaleString('en-IN')} market range and may receive more job opportunities.`,
    average:     `📊 Your pricing is within market range (₹${Number(bandMin).toLocaleString('en-IN')} – ₹${Number(bandMax).toLocaleString('en-IN')}). You are well-positioned.`,
    expensive:   `⚠️ Your price (₹${Number(priceMin).toLocaleString('en-IN')}) is above the typical ${freelancerLevel} range (max ₹${Number(bandMax).toLocaleString('en-IN')}). You may receive fewer job opportunities.`,
    overpriced:  `🚨 Your pricing is significantly above market rates. The typical max for ${freelancerLevel} is ₹${Number(bandMax).toLocaleString('en-IN')}. At this price you will rarely appear in matches.`,
    unknown:     `Set your pricing to see market guidance.`,
  };

  return {
    has_range:       true,
    market_min:      bandMin,
    market_max:      bandMax,
    currency:        range.currency,
    your_price_min:  priceMin,
    your_price_max:  priceMax,
    market_position: position,
    message:         messages[position] || messages.unknown,
  };
};

// ── Pricing Alignment for Matching ───────────────────────────────────────────

/**
 * Evaluate whether a freelancer should be included in a job's notification
 * pool based on pricing_mode and their price profile.
 *
 * Returns: { include, reason, pricing_score, market_position, within_range }
 *
 * IMPORTANT: This is the ONLY place where pricing can EXCLUDE a freelancer.
 * Level is used for scoring elsewhere — NOT exclusion (except expert mode,
 * which is handled in checkEligibility in matching.service.js).
 *
 * Case A — budget mode:
 *   beginner/intermediate → always include
 *   experienced           → excluded; budget briefs are beginner/intermediate only
 *
 * Case B — expert mode:
 *   experienced → include (within hard exclusion limit)
 *   others      → already excluded by checkEligibility — not reached here
 *
 * No price set (price_min = null) → neutral inclusion always.
 */
const evaluatePricingAlignment = (freelancer, job, priceRange) => {
  const { pricing_mode } = job;
  const { freelancer_level, price_min } = freelancer;

  // No range data — neutral, include with mid score
  if (!priceRange) {
    return {
      include:         true,
      pricing_score:   0.5,
      market_position: 'unknown',
      within_range:    null,
      reason:          'No market price range configured for this category',
    };
  }

  const intermediateMax = parseFloat(priceRange.intermediate_max);
  const experiencedMin  = parseFloat(priceRange.experienced_min);
  const experiencedMax  = parseFloat(priceRange.experienced_max);
  const bandMin         = parseFloat(priceRange[`${freelancer_level}_min`] || 0);
  const bandMax         = parseFloat(priceRange[`${freelancer_level}_max`] || Infinity);

  // No price set → neutral, include
  if (!price_min) {
    return {
      include:         true,
      pricing_score:   0.5,
      market_position: 'unknown',
      within_range:    null,
      reason:          'Freelancer has not set pricing — neutral inclusion',
    };
  }

  const pMin = parseFloat(price_min);

  // ── BUDGET MODE ───────────────────────────────────────────────────────────
  if (pricing_mode === 'budget') {
    if (freelancer_level === 'beginner' || freelancer_level === 'intermediate') {
      const score    = computePricingScore(pMin, bandMin, bandMax);
      const position = classifyFreelancerPosition(pMin, bandMin, bandMax, intermediateMax);
      return {
        include:         true,
        pricing_score:   score,
        market_position: position,
        within_range:    pMin <= bandMax,
        reason:          'Within budget mode target level range',
      };
    }

    if (freelancer_level === 'experienced') {
      return {
        include:         false,
        pricing_score:   0,
        market_position: 'expert_only',
        within_range:    false,
        reason:          'Budget briefs are reserved for beginner and intermediate freelancers',
      };
    }
  }

  // ── EXPERT MODE ───────────────────────────────────────────────────────────
  if (pricing_mode === 'expert') {
    // beginner/intermediate already excluded by checkEligibility (expert mode gate)
    // Only experienced reaches here
    const hardExclusionThreshold = experiencedMax * HARD_EXCLUSION_MULTIPLIER;

    if (pMin > hardExclusionThreshold) {
      return {
        include:         true, // not hard-blocked — just very low score
        pricing_score:   0.05,
        market_position: 'overpriced',
        within_range:    false,
        reason:          `Price (₹${pMin.toLocaleString('en-IN')}) is ${((pMin / experiencedMax - 1) * 100).toFixed(0)}% above experienced max — deprioritised`,
      };
    }

    const score    = computePricingScore(pMin, experiencedMin, experiencedMax);
    const position = classifyFreelancerPosition(pMin, experiencedMin, experiencedMax, experiencedMax);

    return {
      include:         true,
      pricing_score:   score,
      market_position: position,
      within_range:    pMin <= experiencedMax,
      reason:          'Experienced freelancer within expert mode range',
    };
  }

  // Fallback
  return {
    include:         true,
    pricing_score:   0.5,
    market_position: 'unknown',
    within_range:    null,
    reason:          'No pricing rule matched — neutral inclusion',
  };
};

// ── Score / Classification Helpers ───────────────────────────────────────────

/**
 * Pricing score (0 → 1).
 * Below band min  → 0.9  (great deal)
 * Within band     → 1.0 → 0.7 linear (lower = better for client)
 * Up to 15% over  → 0.5
 * 15–50% over     → 0.2
 * 50%+ over       → 0.05
 */
const computePricingScore = (priceMin, bandMin, bandMax) => {
  if (!priceMin) return 0.5;
  const pMin = parseFloat(priceMin);
  const bMin = parseFloat(bandMin);
  const bMax = parseFloat(bandMax);

  if (pMin < bMin)  return 0.9;
  if (pMin <= bMax) {
    const t = (pMin - bMin) / (bMax - bMin);
    return parseFloat((1.0 - t * 0.3).toFixed(4));
  }

  const overRatio = pMin / bMax;
  if (overRatio <= 1.15) return 0.5;
  if (overRatio <= 1.50) return 0.2;
  return 0.05;
};

/**
 * Classify market position label.
 * competitive = 20%+ below band max
 * average     = within band
 * expensive   = up to COMPETITIVE_TOLERANCE above band max
 * overpriced  = beyond that
 */
const classifyFreelancerPosition = (priceMin, bandMin, bandMax, intermediateMax) => {
  if (!priceMin) return 'unknown';
  const pMin = parseFloat(priceMin);
  const bMax = parseFloat(bandMax);
  const iMax = parseFloat(intermediateMax);

  if (pMin <= bMax * 0.8)                                return 'competitive';
  if (pMin <= bMax)                                      return 'average';
  if (pMin <= iMax * (1 + COMPETITIVE_TOLERANCE))        return 'expensive';
  return 'overpriced';
};

module.exports = {
  getCategoryPriceRange,
  getMarketRangeForClient,
  getFreelancerPricingGuidance,
  evaluatePricingAlignment,
  computePricingScore,
  classifyFreelancerPosition,
};
