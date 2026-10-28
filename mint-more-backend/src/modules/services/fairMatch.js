/**
 * Fair scoring for storefront auto-assignment.
 *
 * Ported from the custom-request matching engine (matching/matching.service.js), minus the
 * parts that don't apply to fixed-price services: every freelancer works at the same level
 * and at the admin-set payout, so skill, level and pricing are equal for everyone who opted
 * in. What's left decides the order, and it is built so new and idle freelancers with a
 * complete profile get work instead of the top-rated few taking every order.
 */

// Opted in to the service = full skill marks; one level for everyone = full level marks.
// Both are constant across candidates, but they stay in the base so the workload penalty
// bites the same way it did in the original engine.
const WEIGHTS = { skill: 0.40, level: 0.25, rating: 0.20, fairness: 0.15 };
const MAX_JOBS_REFERENCE = 10;
const DEFAULT_NEW_FREELANCER_BOOST = 0.10;

// Rating out of 5; freelancers with no finished order start at a neutral 0.5 instead of 0.
const ratingScore = (averageRating, jobsCompleted) => {
  if (!jobsCompleted) return 0.5;
  return Math.min(Number(averageRating) || 0, 5) / 5;
};

// Fewer finished orders = higher score, reaching zero at MAX_JOBS_REFERENCE.
const fairnessScore = (jobsCompleted) =>
  Math.max(0, Math.min(1, 1 - (Number(jobsCompleted) || 0) / MAX_JOBS_REFERENCE));

// Each active job takes 10% off the base, down to half.
const workloadMultiplier = (activeJobs) => Math.max(0.5, 1 - (Number(activeJobs) || 0) * 0.1);

const idleBonus = (daysSinceLastAssignment) => {
  if (daysSinceLastAssignment === null || daysSinceLastAssignment === undefined) return 0.15;
  if (daysSinceLastAssignment <= 7) return 0;
  if (daysSinceLastAssignment <= 14) return 0.05;
  if (daysSinceLastAssignment <= 30) return 0.10;
  return 0.15;
};

const profileBonus = (f) => {
  let bonus = 0;
  if (f.bio && f.bio.length > 20) bonus += 0.0125;
  if (Array.isArray(f.skills) && f.skills.length > 0) bonus += 0.0125;
  if (f.avatar_url) bonus += 0.0125;
  if (f.has_portfolio) bonus += 0.0125;
  return bonus;
};

const round = (n) => Number(n.toFixed(4));

const scoreFreelancer = (f, settings = {}) => {
  const jobsCompleted = Number(f.jobs_completed_count) || 0;
  const rating = ratingScore(f.average_rating, jobsCompleted);
  const fairness = fairnessScore(jobsCompleted);
  const base = WEIGHTS.skill + WEIGHTS.level + rating * WEIGHTS.rating + fairness * WEIGHTS.fairness;
  const multiplier = workloadMultiplier(f.active_jobs_count);
  const newBoost = jobsCompleted === 0 ? Number(settings.new_freelancer_boost ?? DEFAULT_NEW_FREELANCER_BOOST) : 0;
  const idle = idleBonus(f.days_since_last_assignment);
  const profile = profileBonus(f);
  // Not capped at 1 like the original: a cap made new and idle freelancers tie at 1.0,
  // which hid the profile bonus.
  const total = base * multiplier + newBoost + idle + profile;

  return {
    total: round(total),
    breakdown: {
      rating: round(rating * WEIGHTS.rating),
      fairness: round(fairness * WEIGHTS.fairness),
      workload_multiplier: round(multiplier),
      new_freelancer_boost: round(newBoost),
      idle_bonus: round(idle),
      profile_bonus: round(profile),
    },
  };
};

const lastAssignedMs = (f) => (f.last_assigned_at ? new Date(f.last_assigned_at).getTime() : 0);

/**
 * Highest score first. Ties go to the lighter workload, then to whoever has waited longest.
 * A client's rebook choice is an explicit request, so it goes first when eligible.
 */
const rankFreelancers = (candidates, { preferredId = null, settings = {} } = {}) =>
  candidates
    .map((f) => ({ ...f, match: scoreFreelancer(f, settings) }))
    .sort((a, b) =>
      (b.id === preferredId) - (a.id === preferredId)
      || b.match.total - a.match.total
      || (Number(a.active_jobs_count) || 0) - (Number(b.active_jobs_count) || 0)
      || lastAssignedMs(a) - lastAssignedMs(b));

module.exports = { scoreFreelancer, rankFreelancers };
