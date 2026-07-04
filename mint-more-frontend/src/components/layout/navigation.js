export const CLIENT_NAV = [
  { route: '/dashboard', icon: 'home', label: 'Dashboard' },
  { route: '/calendar', icon: 'calendar', label: 'Calendar', flag: 'calendar_creatives' },
  { route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true },
  { route: '/jobs', icon: 'briefcase', label: 'Requests', flag: 'custom_requests' },
  { route: '/mintbox', icon: 'layers', label: 'Mintbox', flag: 'mintbox' },
  { route: '/wallet', icon: 'wallet', label: 'Wallet', flag: 'wallet_ui' },
  { route: '/membership', icon: 'shield', label: 'Membership', flag: 'wallet_ui' },
  { route: '/freelancers', icon: 'user', label: 'Marketplace', flag: 'marketplace' },
  { route: '/social', icon: 'layers', label: 'Insights', flag: 'social_insights' },
  { route: '/ai', icon: 'sparkles', label: 'Mint AI', flag: 'mint_ai' },
  { route: '/chat', icon: 'chat', label: 'Messages', flag: 'chat' },
  { route: '/support', icon: 'chat', label: 'Support' },
]

export const FREELANCER_NAV = [
  { route: '/dashboard', icon: 'home', label: 'Workspace' },
  { route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true },
  { route: '/jobs', icon: 'briefcase', label: 'Briefs' },
  { route: '/chat', icon: 'chat', label: 'Messages' },
  { route: '/wallet', icon: 'wallet', label: 'Earnings' },
  { route: '/profile-edit', icon: 'user', label: 'My Profile' },
  { route: '/packages', icon: 'layers', label: 'Packages' },
  { route: '/portfolio', icon: 'image', label: 'Portfolio' },
  { route: '/inquiries', icon: 'chat', label: 'Inquiries' },
  { route: '/disputes', icon: 'shield', label: 'Support' },
]

export const DESIGNER_NAV = [
  { route: '/dashboard', icon: 'home', label: 'My tasks' },
  { route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true },
  { route: '/chat', icon: 'chat', label: 'Messages' },
  { route: '/support', icon: 'shield', label: 'Support' },
  { route: '/settings', icon: 'settings', label: 'Settings' },
]

export const ADMIN_NAV = [
  { route: '/admin', icon: 'home', label: 'Overview' },
  { route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true },
  { route: '/admin/operations', icon: 'calendar', label: 'Operations', permission: 'ops.manage' },
  { route: '/admin/users', icon: 'user', label: 'Users', permission: 'users.manage' },
  { route: '/admin/approvals', icon: 'zap', label: 'Approvals', permission: 'deals.approve' },
  { route: '/chat', icon: 'chat', label: 'Chats', permission: 'support.manage' },
  { route: '/support', icon: 'chat', label: 'Support tickets', permission: 'support.manage' },
  { route: '/disputes', icon: 'shield', label: 'Disputes', permission: 'support.manage' },
  { route: '/admin/pricing', icon: 'rupee', label: 'Pricing', permission: 'pricing.manage' },
  { route: '/admin/commerce', icon: 'settings', label: 'Commercial rules', permission: 'pricing.manage' },
  { route: '/admin/wallet', icon: 'wallet', label: 'Platform wallet', permission: 'payments.manage' },
  { route: '/admin/ai', icon: 'sparkles', label: 'Mint AI', permission: 'pricing.manage' },
  { route: '/admin/audit', icon: 'shield', label: 'Audit records', permission: 'audit.read' },
]

export const DEFAULT_FEATURE_FLAGS = {
  wallet_ui: false,
  marketplace: false,
  freelancer_portal: false,
  freelancer_matching: false,
  negotiation: false,
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

  const flags = { ...DEFAULT_FEATURE_FLAGS, ...(access?.feature_flags || {}) }
  return items.filter(item => !item.flag || flags[item.flag] !== false)
}
