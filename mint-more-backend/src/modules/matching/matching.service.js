const { query } = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { getCategoryPriceRange, evaluatePricingAlignment } = require('./pricing.service');
const { saveMatchedCandidates } = require('../negotiation/negotiation.service');
const { getSetting } = require('../commerce/settings.service');
const { enqueueOutboxEvent, dispatchOutboxImmediately } = require('../events/outbox.service');

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ACTIVE_JOBS      = 5;
const MAX_JOBS_REFERENCE   = 10;
const NEW_FREELANCER_BOOST = 0.10;
const TOP_N_CANDIDATES     = 10;
const DEFAULT_MATCHING_SETTINGS = {
  max_active_jobs: MAX_ACTIVE_JOBS,
  new_freelancer_boost: NEW_FREELANCER_BOOST,
  top_candidates: TOP_N_CANDIDATES,
};

const WEIGHTS = {
  skill:    0.40,
  level:    0.25,
  rating:   0.20,
  fairness: 0.15,
};

const TIERS = [
  {
    name: 'tier_1_new',
    label: 'New Freelancer',
    notify_delay_minutes: 0,
    condition: (f) => f.jobs_completed_count === 0,
  },
  {
    name: 'tier_2_low',
    label: 'Low Workload',
    notify_delay_minutes: 5,
    condition: (f) => f.jobs_completed_count > 0 && f.jobs_completed_count <= 5,
  },
  {
    name: 'tier_3_experienced',
    label: 'Experienced / Busy',
    notify_delay_minutes: 10,
    condition: (f) => f.jobs_completed_count > 5,
  },
];

const PRICING_SCORE_MAX_CONTRIBUTION = 0.15;

// ── Score Components ──────────────────────────────────────────────────────────

const computeSkillScore = (jobSkills, freelancerSkills) => {
  if (!jobSkills || jobSkills.length === 0) return 1.0;
  if (!freelancerSkills || freelancerSkills.length === 0) return 0.0;
  const jobSet  = new Set(jobSkills.map((s) => s.toLowerCase().trim()));
  const matched = freelancerSkills.filter((s) => jobSet.has(s.toLowerCase().trim())).length;
  return matched / jobSkills.length;
};

const LEVEL_VALUES = { beginner: 0.33, intermediate: 0.66, experienced: 1.0 };

const computeLevelScore = (freelancerLevel) => LEVEL_VALUES[freelancerLevel] || 0;

const computeRatingScore = (averageRating, jobsCompleted) => {
  if (!jobsCompleted || jobsCompleted === 0) return 0.5;
  return Math.min(parseFloat(averageRating) || 0, 5) / 5;
};

const computeFairnessScore = (jobsCompleted) => {
  return Math.max(0, Math.min(1, 1 - (jobsCompleted / MAX_JOBS_REFERENCE)));
};

const computeIdleBonus = (daysSinceLastAssignment) => {
  if (daysSinceLastAssignment === null || daysSinceLastAssignment === undefined) return 0.15;
  if (daysSinceLastAssignment <= 7)  return 0.00;
  if (daysSinceLastAssignment <= 14) return 0.05;
  if (daysSinceLastAssignment <= 30) return 0.10;
  return 0.15;
};

const computeWorkloadMultiplier = (activeJobsCount) =>
  Math.max(0.5, 1 - activeJobsCount * 0.1);

const computeKycBonus = (kycStatus) => (kycStatus === 'verified' ? 0.05 : 0.0);

const computeProfileBonus = (freelancer) => {
  let bonus = 0;
  if (freelancer.bio && freelancer.bio.length > 20)      bonus += 0.0125;
  if (freelancer.skills && freelancer.skills.length > 0) bonus += 0.0125;
  if (freelancer.avatar_url)                             bonus += 0.0125;
  if (freelancer.freelancer_level)                       bonus += 0.0125;
  return bonus;
};

const computeScore = (freelancer, job, priceRange, pricingAlignment, matchingSettings = DEFAULT_MATCHING_SETTINGS) => {
  const skill    = computeSkillScore(job.required_skills, freelancer.skills);
  const level    = computeLevelScore(freelancer.freelancer_level);
  const rating   = computeRatingScore(freelancer.average_rating, freelancer.jobs_completed_count);
  const fairness = computeFairnessScore(freelancer.jobs_completed_count);

  const base =
    skill    * WEIGHTS.skill   +
    level    * WEIGHTS.level   +
    rating   * WEIGHTS.rating  +
    fairness * WEIGHTS.fairness;

  const workloadMultiplier      = computeWorkloadMultiplier(freelancer.active_jobs_count || 0);
  const adjusted                = base * workloadMultiplier;
  const newFreelancerBoost      = freelancer.jobs_completed_count === 0
    ? Number(matchingSettings.new_freelancer_boost ?? NEW_FREELANCER_BOOST)
    : 0;
  const idleBonus               = computeIdleBonus(freelancer.days_since_last_assignment);
  const kycBonus                = computeKycBonus(freelancer.kyc_status);
  const profileBonus            = computeProfileBonus(freelancer);
  const preferredCreatorBoost   = freelancer.is_preferred_creator
    ? Number(matchingSettings.preferred_creator_boost ?? 0.15)
    : 0;
  const rawPricingScore         = pricingAlignment?.pricing_score ?? 0.5;
  const pricingContribution     = parseFloat((rawPricingScore * PRICING_SCORE_MAX_CONTRIBUTION).toFixed(4));
  const competitivePricingBoost = pricingAlignment?.competitive_boost ? 0.05 : 0;

  const total = Math.min(
    1.0,
    adjusted
      + newFreelancerBoost
      + idleBonus
      + kycBonus
      + profileBonus
      + preferredCreatorBoost
      + pricingContribution
      + competitivePricingBoost
  );

  return {
    total: parseFloat(total.toFixed(4)),
    breakdown: {
      skill_component:           parseFloat((skill    * WEIGHTS.skill).toFixed(4)),
      level_component:           parseFloat((level    * WEIGHTS.level).toFixed(4)),
      rating_component:          parseFloat((rating   * WEIGHTS.rating).toFixed(4)),
      fairness_component:        parseFloat((fairness * WEIGHTS.fairness).toFixed(4)),
      base_score:                parseFloat(base.toFixed(4)),
      workload_multiplier:       parseFloat(workloadMultiplier.toFixed(4)),
      adjusted_score:            parseFloat(adjusted.toFixed(4)),
      new_freelancer_boost:      parseFloat(newFreelancerBoost.toFixed(4)),
      idle_bonus:                parseFloat(idleBonus.toFixed(4)),
      kyc_bonus:                 parseFloat(kycBonus.toFixed(4)),
      profile_bonus:             parseFloat(profileBonus.toFixed(4)),
      preferred_creator_boost:   parseFloat(preferredCreatorBoost.toFixed(4)),
      pricing_score:             parseFloat(rawPricingScore.toFixed(4)),
      pricing_contribution:      pricingContribution,
      competitive_pricing_boost: competitivePricingBoost,
    },
    raw: {
      skill_overlap:            parseFloat(skill.toFixed(4)),
      level_value:              parseFloat(level.toFixed(4)),
      rating_value:             parseFloat(rating.toFixed(4)),
      fairness_value:           parseFloat(fairness.toFixed(4)),
      active_jobs:              freelancer.active_jobs_count || 0,
      days_since_last_assigned: freelancer.days_since_last_assignment,
      jobs_completed:           freelancer.jobs_completed_count,
      kyc_status:               freelancer.kyc_status,
      price_min:                freelancer.price_min,
      price_max:                freelancer.price_max,
    },
  };
};

// ── Tier + Eligibility ────────────────────────────────────────────────────────

const assignTier = (freelancer) =>
  TIERS.find((t) => t.condition(freelancer)) || TIERS[2];

const checkEligibility = (freelancer, job, matchingSettings = DEFAULT_MATCHING_SETTINGS) => {
  const reasons = [];
  if (!freelancer.is_available) reasons.push('freelancer is marked unavailable');
  if (!freelancer.is_approved)  reasons.push('freelancer account is not approved');
  if (!freelancer.is_active)    reasons.push('freelancer account is deactivated');

  const activeJobs = freelancer.active_jobs_count || 0;
  const maxActiveJobs = Number(matchingSettings.max_active_jobs ?? MAX_ACTIVE_JOBS);
  if (activeJobs >= maxActiveJobs) {
    reasons.push(`max active jobs reached (${activeJobs}/${maxActiveJobs})`);
  }

  if (job.pricing_mode === 'expert' && freelancer.freelancer_level !== 'experienced') {
    reasons.push(
      `expert mode job requires experienced level — freelancer is ${freelancer.freelancer_level || 'level not set'}`
    );
  }

  return { eligible: reasons.length === 0, reasons };
};

const rankCandidates = (candidates, job, priceRange, matchingSettings = DEFAULT_MATCHING_SETTINGS) => {
  console.log(`[Matching] rankCandidates — input: ${candidates.length}`);

  const eligible   = [];
  const ineligible = [];

  candidates.forEach((freelancer) => {
    const { eligible: isEligible, reasons } = checkEligibility(freelancer, job, matchingSettings);
    const pricingAlignment = evaluatePricingAlignment(freelancer, job, priceRange);

    const allReasons = [...reasons];
    if (!pricingAlignment.include) allReasons.push(pricingAlignment.reason);

    if (!isEligible || !pricingAlignment.include) {
      ineligible.push({
        freelancer_id:        freelancer.id,
        full_name:            freelancer.full_name,
        freelancer_level:     freelancer.freelancer_level,
        is_available:         freelancer.is_available,
        is_approved:          freelancer.is_approved,
        active_jobs_count:    freelancer.active_jobs_count || 0,
        price_min:            freelancer.price_min,
        disqualified_reasons: allReasons,
        pricing: {
          within_range:    pricingAlignment.within_range,
          market_position: pricingAlignment.market_position,
          reason:          pricingAlignment.reason,
        },
      });
      return;
    }

    const score = computeScore(freelancer, job, priceRange, pricingAlignment, matchingSettings);
    const tier  = assignTier(freelancer);

    eligible.push({
      rank:             0, // assigned below after sort
      freelancer_id:    freelancer.id,
      full_name:        freelancer.full_name,
      email:            freelancer.email,
      avatar_url:       freelancer.avatar_url,
      freelancer_level: freelancer.freelancer_level,
      skills:           freelancer.skills,
      average_rating:   parseFloat(freelancer.average_rating) || 0,
      jobs_completed:   freelancer.jobs_completed_count,
      active_jobs:      freelancer.active_jobs_count || 0,
      kyc_status:       freelancer.kyc_status,
      is_available:     freelancer.is_available,
      tier:                 tier.name,
      tier_label:           tier.label,
      notify_delay_minutes: tier.notify_delay_minutes,
      notify_at:            new Date(
        Date.now() + tier.notify_delay_minutes * 60 * 1000
      ).toISOString(),
      pricing: {
        price_min:       freelancer.price_min,
        price_max:       freelancer.price_max,
        within_range:    pricingAlignment.within_range,
        market_position: pricingAlignment.market_position,
      },
      score:           score.total,
      score_breakdown: score.breakdown,
      score_raw:       score.raw,
    });
  });

  // Sort: highest score first; tie-break by lowest notify_delay (more available first)
  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.notify_delay_minutes - b.notify_delay_minutes;
  });

  // Assign ranks after sort
  eligible.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  console.log(`[Matching] eligible: ${eligible.length}, ineligible: ${ineligible.length}`);

  return {
    ranked: eligible.slice(0, Number(matchingSettings.top_candidates ?? TOP_N_CANDIDATES)),
    ineligible,
  };
};

// ── DB Fetch — role = freelancer only ─────────────────────────────────────────

const fetchFreelancerPool = async (jobId, { limit, offset }) => {
  const result = await query(
    `SELECT
       u.id, u.full_name, u.email, u.avatar_url,
       u.freelancer_level, u.skills, u.bio,
       u.average_rating, u.jobs_completed_count, u.active_jobs_count,
       u.is_available, u.is_approved, u.is_active,
       u.kyc_status, u.price_min, u.price_max,
       EXISTS(
         SELECT 1
         FROM preferred_creators pc
         JOIN jobs preferred_job ON preferred_job.client_id = pc.client_id
         WHERE preferred_job.id = $1 AND pc.freelancer_id = u.id
       ) AS is_preferred_creator,
       EXTRACT(DAY FROM NOW() - (
         SELECT MAX(ja.created_at)
         FROM job_assignments ja
         WHERE ja.freelancer_id = u.id
       ))::INTEGER AS days_since_last_assignment,
       EXISTS(
         SELECT 1 FROM proposals p
         WHERE p.job_id = $1 AND p.freelancer_id = u.id
       ) AS has_proposed
     FROM users u
     WHERE u.role = 'freelancer'
     ORDER BY u.created_at ASC
     LIMIT $2 OFFSET $3`,
    [jobId, limit, offset]
  );

  console.log(`[Matching] fetchFreelancerPool — fetched: ${result.rows.length}`);
  if (result.rows.length === 0) {
    logger.warn('[Matching] No freelancers in pool', { jobId });
  }

  return result.rows;
};

// ── Public Service Methods ────────────────────────────────────────────────────

/**
 * Run the full matching engine for a job.
 *
 * Called automatically by job.service after create/publish.
 * Can also be called manually by admin via POST /matching/jobs/:jobId/run.
 *
 * Steps:
 * 1. Fetch all freelancers (role = freelancer only — no SQL filters)
 * 2. Filter eligibility + pricing in JS
 * 3. Score + rank → top 10
 * 4. Persist to job_matched_candidates
 *    - rank 1  → position = 'primary'   → jobs.active_freelancer_id
 *    - rank 2  → position = 'backup'    → jobs.backup_freelancer_id
 *    - rank 3+ → position = 'candidate'
 * 5. Set job status → 'matching'
 */
const runMatchingForJob = async (jobId) => {
  const jobResult = await query(
    `SELECT id, title, status, required_level, required_skills,
            budget_type, budget_amount, category_id, pricing_mode, pro_reviewed_at
     FROM jobs WHERE id = $1`,
    [jobId]
  );

  const job = jobResult.rows[0];
  if (!job) throw new AppError('Job not found', 404);

  if (!['open', 'matching'].includes(job.status)) {
    throw new AppError(
      `Matching only runs on open or matching jobs. Current status: ${job.status}`,
      400
    );
  }

  if (job.pricing_mode === 'expert' && !job.pro_reviewed_at) {
    throw new AppError('Pro matching requires admin approval before it can run', 409);
  }

  console.log(`[Matching] runMatchingForJob — jobId: ${jobId}, mode: ${job.pricing_mode}`);

  const [priceRange, matchingSettings] = await Promise.all([
    getCategoryPriceRange(job.category_id),
    getSetting('matching', DEFAULT_MATCHING_SETTINGS),
  ]);
  const candidates = await fetchFreelancerPool(jobId, { limit: 100, offset: 0 });
  const { ranked, ineligible } = rankCandidates(candidates, job, priceRange, matchingSettings);

  // ── Persist candidates + set primary / backup on job ─────────────────────
  // saveMatchedCandidates handles:
  //   rank 1 → position = 'primary'  → jobs.active_freelancer_id
  //   rank 2 → position = 'backup'   → jobs.backup_freelancer_id
  //   rank 3+ → position = 'candidate'
  // Persist matched candidates
  if (ranked.length > 0) {
    await saveMatchedCandidates(jobId, ranked);

    // Fire notifications — non-blocking, post-commit
    await enqueueOutboxEvent(
      'notification.trigger',
      { trigger: 'notifyMatchedCandidates', args: [job, ranked] },
      { dedupeKey: `matching:${jobId}:matched-candidates` }
    );
    await dispatchOutboxImmediately();
  }

  
  // Transition job → matching
  await query(
    `UPDATE jobs
     SET status       = 'matching',
         matched_at   = NOW(),
         match_method = 'ai'
     WHERE id = $1`,
    [jobId]
  );

  const tierSummary = TIERS.map((t) => ({
    tier:                 t.name,
    label:                t.label,
    notify_delay_minutes: t.notify_delay_minutes,
    count:                ranked.filter((r) => r.tier === t.name).length,
  }));

  logger.info('[Matching] Engine complete', {
    jobId,
    total_fetched:    candidates.length,
    eligible_count:   ranked.length,
    ineligible_count: ineligible.length,
    top_score:        ranked[0]?.score ?? null,
    primary:          ranked[0]?.freelancer_id ?? null,
    backup:           ranked[1]?.freelancer_id ?? null,
  });

  return {
    job: {
      id:              job.id,
      title:           job.title,
      required_level:  job.required_level,
      required_skills: job.required_skills,
      pricing_mode:    job.pricing_mode,
      budget_amount:   job.budget_amount,
      status:          'matching',
    },
    market_range: priceRange
      ? {
          budget: { min: priceRange.beginner_min,    max: priceRange.intermediate_max },
          expert: { min: priceRange.experienced_min, max: priceRange.experienced_max },
        }
      : null,
    summary: {
      total_fetched:    candidates.length,
      eligible_count:   ranked.length,
      ineligible_count: ineligible.length,
      top_n_limit:      Number(matchingSettings.top_candidates ?? TOP_N_CANDIDATES),
      tiers:            tierSummary,
    },
    matches:    ranked,
    ineligible,
    ran_at:     new Date().toISOString(),
  };
};

const previewMatchingForJob = async (jobId) => {
  const jobResult = await query(
    `SELECT id, title, status, required_level, required_skills,
            budget_amount, category_id, pricing_mode
     FROM jobs WHERE id = $1`,
    [jobId]
  );

  const job = jobResult.rows[0];
  if (!job) throw new AppError('Job not found', 404);

  const priceRange             = await getCategoryPriceRange(job.category_id);
  const candidates             = await fetchFreelancerPool(jobId, { limit: 100, offset: 0 });
  const { ranked, ineligible } = rankCandidates(candidates, job, priceRange);

  return {
    job:     { id: job.id, title: job.title, status: job.status, pricing_mode: job.pricing_mode },
    preview: true,
    summary: {
      total_fetched:    candidates.length,
      eligible_count:   ranked.length,
      ineligible_count: ineligible.length,
    },
    matches:    ranked,
    ineligible,
    ran_at:     new Date().toISOString(),
  };
};

const getFreelancerPool = async (jobId, { page = 1, limit = 20 } = {}) => {
  const jobResult = await query(
    `SELECT id, title, required_level, required_skills,
            budget_amount, category_id, pricing_mode, status
     FROM jobs WHERE id = $1`,
    [jobId]
  );

  const job = jobResult.rows[0];
  if (!job) throw new AppError('Job not found', 404);

  const offset      = (page - 1) * limit;
  const priceRange  = await getCategoryPriceRange(job.category_id);
  const freelancers = await fetchFreelancerPool(jobId, { limit, offset });
  const { ranked, ineligible } = rankCandidates(freelancers, job, priceRange);

  return {
    job: {
      id:             job.id,
      title:          job.title,
      required_level: job.required_level,
      pricing_mode:   job.pricing_mode,
    },
    pool_count:  ranked.length,
    freelancers: ranked,
    ineligible,
    summary: {
      total_fetched:    freelancers.length,
      eligible_count:   ranked.length,
      ineligible_count: ineligible.length,
    },
  };
};

module.exports = { runMatchingForJob, previewMatchingForJob, getFreelancerPool };
