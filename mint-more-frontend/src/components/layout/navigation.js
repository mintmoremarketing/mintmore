export const CLIENT_NAV = [
  { route: '/dashboard', icon: 'home', label: 'Dashboard' },
  { route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true },
  { route: '/jobs', icon: 'briefcase', label: 'Jobs' },
  { route: '/mintbox', icon: 'layers', label: 'Mintbox' },
  { route: '/wallet', icon: 'wallet', label: 'Wallet' },
  { route: '/membership', icon: 'shield', label: 'Membership' },
  { route: '/onboarding', icon: 'check', label: 'Setup' },
  { route: '/freelancers', icon: 'user', label: 'Marketplace' },
  { route: '/social', icon: 'layers', label: 'Social' },
  { route: '/ai', icon: 'sparkles', label: 'Mint AI' },
  { route: '/chat', icon: 'chat', label: 'Messages' },
  { route: '/disputes', icon: 'shield', label: 'Support' },
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

export const ADMIN_NAV = [
  { route: '/admin', icon: 'home', label: 'Overview' },
  { route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true },
  { route: '/admin/users', icon: 'user', label: 'Users', permission: 'users.manage' },
  { route: '/admin/approvals', icon: 'zap', label: 'Approvals', permission: 'deals.approve' },
  { route: '/chat', icon: 'chat', label: 'Chats', permission: 'support.manage' },
  { route: '/disputes', icon: 'shield', label: 'Disputes', permission: 'support.manage' },
  { route: '/admin/pricing', icon: 'rupee', label: 'Pricing', permission: 'pricing.manage' },
  { route: '/admin/commerce', icon: 'settings', label: 'Commercial rules', permission: 'pricing.manage' },
  { route: '/admin/wallet', icon: 'wallet', label: 'Platform wallet', permission: 'payments.manage' },
  { route: '/admin/ai', icon: 'sparkles', label: 'Mint AI', permission: 'pricing.manage' },
  { route: '/admin/audit', icon: 'shield', label: 'Audit records', permission: 'audit.read' },
]

