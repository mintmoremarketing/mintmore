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
  { route: '/dashboard', icon: 'overview', label: 'Explore' },
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

export const ADMIN_NAV = [
  { route: '/admin', icon: 'overview', label: 'Overview' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/admin/service-orders', icon: 'requests', label: 'Service orders', permission: 'ops.manage' },
  { route: '/admin/services', icon: 'layers', label: 'Service catalogue', permission: 'ops.manage' },
  { route: '/admin/operations', icon: 'operations', label: 'Operations', permission: 'ops.manage' },
  { route: '/admin/brands', icon: 'layers', label: 'Brands', permission: 'users.manage' },
  { route: '/admin/users', icon: 'users', label: 'Users', permission: 'users.manage' },
  { route: '/admin/approvals', icon: 'approvals', label: 'Approvals', permission: 'deals.approve' },
  { route: '/chat', icon: 'chats', label: 'Chats', permission: 'support.manage' },
  { route: '/support', icon: 'support_tickets', label: 'Support tickets', permission: 'support.manage' },
  { route: '/disputes', icon: 'disputes', label: 'Disputes', permission: 'support.manage' },
  { route: '/admin/pricing', icon: 'pricing', label: 'Freelancer models', permission: 'pricing.manage' },
  { route: '/admin/tiers', icon: 'layer', label: 'Subscription Tiers', permission: 'pricing.manage' },
  { route: '/admin/commerce', icon: 'settings', label: 'Platform settings', permission: 'pricing.manage' },
  { route: '/admin/audit', icon: 'audit', label: 'Audit records', permission: 'audit.read' },
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

    return items.filter(item => (
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
