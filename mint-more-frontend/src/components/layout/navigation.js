export const CLIENT_NAV = [
  { route: '/dashboard', icon: 'overview', label: 'Dashboard' },
  { route: '/calendar', icon: 'operations', label: 'Calendar', flag: 'calendar_creatives' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/jobs', icon: 'requests', label: 'Requests', flag: 'custom_requests' },
  { route: '/mintbox', icon: 'mintbox', label: 'Mintbox', flag: 'mintbox' },
  { route: '/wallet', icon: 'wallet', label: 'Wallet', flag: 'wallet_ui' },
  { route: '/membership', icon: 'shield', label: 'Membership', flag: 'wallet_ui' },
  { route: '/freelancers', icon: 'marketplace', label: 'Marketplace', flag: 'marketplace' },
  { route: '/social', icon: 'insights', label: 'Insights', flag: 'social_insights' },
  { route: '/ai', icon: 'mint_ai', label: 'Mint AI', flag: 'mint_ai' },
  { route: '/chat', icon: 'chats', label: 'Messages', flag: 'chat' },
  { route: '/support', icon: 'support_tickets', label: 'Support' },
]

export const FREELANCER_NAV = [
  { route: '/dashboard', icon: 'overview', label: 'Workspace' },
  { route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true },
  { route: '/jobs', icon: 'requests', label: 'Briefs' },
  { route: '/chat', icon: 'chats', label: 'Messages' },
  { route: '/wallet', icon: 'platform_wallet', label: 'Earnings' },
  { route: '/profile-edit', icon: 'profile', label: 'My Profile' },
  { route: '/packages', icon: 'mintbox', label: 'Packages' },
  { route: '/portfolio', icon: 'portfolio', label: 'Portfolio' },
  { route: '/inquiries', icon: 'inquiries', label: 'Inquiries' },
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
  { route: '/admin/operations', icon: 'operations', label: 'Operations', permission: 'ops.manage' },
  { route: '/admin/users', icon: 'users', label: 'Users', permission: 'users.manage' },
  { route: '/admin/approvals', icon: 'approvals', label: 'Approvals', permission: 'deals.approve' },
  { route: '/chat', icon: 'chats', label: 'Chats', permission: 'support.manage' },
  { route: '/support', icon: 'support_tickets', label: 'Support tickets', permission: 'support.manage' },
  { route: '/disputes', icon: 'disputes', label: 'Disputes', permission: 'support.manage' },
  { route: '/admin/pricing', icon: 'pricing', label: 'Pricing', permission: 'pricing.manage' },
  { route: '/admin/commerce', icon: 'commercial_rules', label: 'Commercial rules', permission: 'pricing.manage' },
  { route: '/admin/wallet', icon: 'platform_wallet', label: 'Platform wallet', permission: 'payments.manage' },
  { route: '/admin/ai', icon: 'mint_ai', label: 'Mint AI', permission: 'pricing.manage' },
  { route: '/admin/audit', icon: 'audit', label: 'Audit records', permission: 'audit.read' },
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
