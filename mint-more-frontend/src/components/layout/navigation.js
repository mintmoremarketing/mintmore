import { withLaunchFlags } from '../../config/launch'

export const CLIENT_NAV = [
  { route: '/dashboard', icon: 'overview', label: 'Home' },
  { route: '/services', icon: 'marketplace', label: 'Services' },
  { route: '/orders', icon: 'requests', label: 'My Orders' },
  { route: '/chat', icon: 'chats', label: 'Messages', flag: 'chat' },
  { route: '/mintbox', icon: 'mintbox', label: 'Files', flag: 'mintbox' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/support', icon: 'support_tickets', label: 'Support' },
]

export const FREELANCER_NAV = [
  { route: '/home', icon: 'overview', label: 'Dashboard' },
  { route: '/dashboard', icon: 'marketplace', label: 'Explore' },
  { route: '/upskill', icon: 'sparkles', label: 'Upskill' },
  { route: '/assessments', icon: 'checkCircle', label: 'Assessments' },
  { route: '/work', icon: 'requests', label: 'My Work' },
  { route: '/my-services', icon: 'layers', label: 'My Services' },
  { route: '/chat', icon: 'chats', label: 'Messages' },
  { route: '/settings/freelancer', icon: 'platform_wallet', label: 'Earnings' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/profile', icon: 'profile', label: 'Profile' },
  { route: '/disputes', icon: 'support_tickets', label: 'Support' },
]

export const DESIGNER_NAV = [
  { route: '/dashboard', icon: 'overview', label: 'My tasks' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/chat', icon: 'chats', label: 'Messages' },
  { route: '/support', icon: 'support_tickets', label: 'Support' },
  { route: '/settings', icon: 'settings', label: 'Settings' },
]

// Admin nav is grouped in the sidebar. Items marked `hidden` keep their routes but are
// LAUNCH-HIDDEN: they belong to the social-agency product, not the services launch.
export const ADMIN_NAV_GROUPS = ['Work', 'People', 'Money', 'Support', 'System']

export const ADMIN_NAV = [
  { route: '/admin', icon: 'overview', label: 'Overview' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/admin/service-orders', icon: 'requests', label: 'Orders', group: 'Work', permission: 'ops.manage' },
  { route: '/admin/services', icon: 'layers', label: 'Service catalogue', group: 'Work', permission: 'ops.manage' },
  { route: '/admin/operations', icon: 'video', label: 'First drafts', group: 'Work', permission: 'ops.manage' },
  { route: '/admin/users', icon: 'users', label: 'Users & KYC', group: 'People', permission: 'users.manage' },
  { route: '/admin/assessments', icon: 'checkCircle', label: 'Assessments', group: 'People', permission: 'ops.manage' },
  { route: '/admin/wallet', icon: 'platform_wallet', label: 'Payouts & escrow', group: 'Money', permission: 'payments.manage' },
  { route: '/chat', icon: 'chats', label: 'Chats', group: 'Support', permission: 'support.manage' },
  { route: '/support', icon: 'support_tickets', label: 'Support tickets', group: 'Support', permission: 'support.manage' },
  { route: '/disputes', icon: 'disputes', label: 'Disputes', group: 'Support', permission: 'support.manage' },
  { route: '/admin/commerce', icon: 'settings', label: 'Platform settings', group: 'System', permission: 'pricing.manage' },
  { route: '/admin/audit', icon: 'audit', label: 'Audit records', group: 'System', permission: 'audit.read' },
  // LAUNCH-HIDDEN: social-agency and negotiation tools. Routes still work by URL.
  { route: '/admin/brands', icon: 'layers', label: 'Brands', permission: 'users.manage', hidden: true },
  { route: '/admin/approvals', icon: 'approvals', label: 'Approvals', permission: 'deals.approve', hidden: true },
  { route: '/admin/pricing', icon: 'pricing', label: 'Freelancer models', permission: 'pricing.manage', hidden: true },
  { route: '/admin/tiers', icon: 'layer', label: 'Subscription Tiers', permission: 'pricing.manage', hidden: true },
]

export const DEFAULT_FEATURE_FLAGS = {
  wallet_ui: false,
  marketplace: false,
  freelancer_portal: false,
  freelancer_matching: false,
  negotiation: false,
  mint_ai: false,
  chat: false,
  social_insights: false,
  posting: false,
  custom_requests: false,
  calendar_creatives: false,
  mintbox: false,
}

export function navForRole(role) {
  if (role === 'admin') return ADMIN_NAV
  if (role === 'designer') return DESIGNER_NAV
  if (role === 'freelancer') return FREELANCER_NAV
  return CLIENT_NAV
}

export function filterNavItems({ role, isGuest, access, items = navForRole(role) }) {
  if (isGuest) return items.filter(item => item.route === '/dashboard')

  if (role === 'admin') {
    const permissions = access?.admin_permissions || []
    const adminAccessLoaded = Boolean(access)

    return items.filter(item => !item.hidden && (
      !item.permission ||
      !adminAccessLoaded ||
      access?.is_super_admin ||
      permissions.includes('*') ||
      permissions.includes(item.permission)
    ))
  }

  const flags = withLaunchFlags({ ...DEFAULT_FEATURE_FLAGS, ...(access?.feature_flags || {}) })
  return items.filter(item => !item.flag || flags[item.flag] !== false)
}
