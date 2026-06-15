const { query } = require('../../config/database');
const env = require('../../config/env');
const { getSetting } = require('./settings.service');
const { expireCreditsForUser } = require('./credits.service');

const getEntitlements = async (userId) => {
  const userResult = await query(
    `SELECT id, role, kyc_status, is_approved, is_active, admin_permissions, is_super_admin, admin_overrides
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return null;

  if (user.role !== 'client') {
    return {
      role: user.role,
      access_state: user.is_active && user.is_approved ? 'active' : 'restricted',
      can_create_job: false,
      can_use_ai: true,
      can_use_social: user.is_approved,
      can_access_mintbox: user.is_approved,
      admin_permissions: user.admin_permissions || [],
      is_super_admin: user.is_super_admin,
      overrides: user.admin_overrides || {},
    };
  }

  await Promise.all([
    query(
      `UPDATE memberships
       SET status = 'expired'
       WHERE user_id = $1
         AND status IN ('trial','active','paused')
         AND current_period_end <= NOW()`,
      [userId]
    ),
    query(
      `UPDATE access_passes
       SET status = 'expired'
       WHERE user_id = $1 AND status = 'active' AND ends_at <= NOW()`,
      [userId]
    ),
    expireCreditsForUser(userId),
  ]);

  const [membershipResult, passResult, activeOrders, creditsResult, membershipConfig] = await Promise.all([
    query('SELECT * FROM memberships WHERE user_id = $1', [userId]),
    query(
      `SELECT * FROM access_passes
       WHERE user_id = $1 AND status = 'active' AND ends_at > NOW()
       ORDER BY ends_at DESC LIMIT 1`,
      [userId]
    ),
    query(
      `SELECT COUNT(*)::int AS count FROM jobs
       WHERE client_id = $1 AND status IN ('locked','pending_admin_approval','assigned','in_progress')`,
      [userId]
    ),
    query('SELECT balance FROM mint_credit_accounts WHERE user_id = $1', [userId]),
    getSetting('membership.monthly', {}),
  ]);

  const membership = membershipResult.rows[0] || null;
  const accessPass = passResult.rows[0] || null;
  const membershipValid = Boolean(
    membership &&
    ['trial', 'active', 'paused'].includes(membership.status) &&
    membership.current_period_end &&
    new Date(membership.current_period_end) > new Date()
  );
  const trialAccess = membershipValid && membership.status === 'trial';
  const paidMembershipAccess = membershipValid && ['active', 'paused'].includes(membership.status);
  const fullAccess = paidMembershipAccess || Boolean(accessPass);
  const kycVerified = user.kyc_status === 'verified';
  const hasActiveOrders = activeOrders.rows[0].count > 0;

  return {
    role: user.role,
    access_state: fullAccess
      ? (paidMembershipAccess ? membership.status : 'access_pass')
      : trialAccess ? 'trial' : 'expired',
    membership,
    access_pass: accessPass,
    mint_credits: Number(creditsResult.rows[0]?.balance || 0),
    payment_checkout_mode: env.payments.mockCheckout ? 'mock' : 'razorpay',
    can_create_job: fullAccess && kycVerified && user.is_approved,
    // Drafts are workspace data, not a paid feature. Active clients must be
    // able to save work before verification or membership checkout.
    can_draft_job: user.is_active,
    can_use_ai: fullAccess || trialAccess,
    can_use_social: fullAccess,
    // Every active client receives their base Mintbox allocation. Project-level
    // routes still enforce participant access before exposing files.
    can_access_mintbox: user.is_active,
    can_finish_active_orders: hasActiveOrders,
    needs_kyc_for_paid_order: !kycVerified,
    base_storage_gb: Number(membershipConfig.mintbox_gb || 10),
    overrides: user.admin_overrides || {},
  };
};

module.exports = { getEntitlements };
