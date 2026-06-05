const { query } = require('../../config/database');
const { getSetting } = require('./settings.service');

const calculateManagedDeal = async ({ freelancerId, freelancerPayout, pricingMode }, dbClient = null) => {
  const executor = dbClient || { query };
  const [marginConfig, commissionConfig, freelancerResult] = await Promise.all([
    getSetting('managed_margins', {}, dbClient),
    getSetting('freelancer_commission', {}, dbClient),
    executor.query(
      'SELECT freelancer_level, jobs_completed_count FROM users WHERE id = $1',
      [freelancerId]
    ),
  ]);
  const freelancer = freelancerResult.rows[0] || {};
  const payout = Number(freelancerPayout);
  const marginPercent = Number(pricingMode === 'expert' ? marginConfig.pro_percent : marginConfig.budget_percent) || 0;
  const freeJobs = Number(commissionConfig.free_completed_jobs || 10);
  const levelKey = `${freelancer.freelancer_level || 'beginner'}_percent`;
  const commissionPercent = Number(freelancer.jobs_completed_count || 0) < freeJobs
    ? 0
    : Number(commissionConfig[levelKey] ?? commissionConfig.default_percent ?? 5);
  const managedMargin = Math.round(payout * marginPercent) / 100;
  const commission = Math.round(payout * commissionPercent) / 100;
  return {
    freelancer_requested_payout: payout,
    commission_percent: commissionPercent,
    commission,
    freelancer_net_payout: payout - commission,
    margin_percent: marginPercent,
    managed_margin: managedMargin,
    platform_revenue: managedMargin + commission,
    client_total: payout + managedMargin,
  };
};

module.exports = { calculateManagedDeal };
