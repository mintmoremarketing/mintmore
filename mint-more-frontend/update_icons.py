import re
import os

# Update navigation.js
with open('src/components/layout/navigation.js', 'r', encoding='utf-8') as f:
    nav_content = f.read()

# Update ADMIN_NAV
nav_content = nav_content.replace("{ route: '/admin', icon: 'home', label: 'Overview' }", "{ route: '/admin', icon: 'overview', label: 'Overview' }")
nav_content = nav_content.replace("{ route: '/notifications', icon: 'bell', label: 'Inbox', showCount: true }", "{ route: '/notifications', icon: 'inbox', label: 'Inbox', showCount: true }")
nav_content = nav_content.replace("{ route: '/admin/operations', icon: 'calendar', label: 'Operations', permission: 'ops.manage' }", "{ route: '/admin/operations', icon: 'operations', label: 'Operations', permission: 'ops.manage' }")
nav_content = nav_content.replace("{ route: '/admin/users', icon: 'user', label: 'Users', permission: 'users.manage' }", "{ route: '/admin/users', icon: 'users', label: 'Users', permission: 'users.manage' }")
nav_content = nav_content.replace("{ route: '/admin/approvals', icon: 'zap', label: 'Approvals', permission: 'deals.approve' }", "{ route: '/admin/approvals', icon: 'approvals', label: 'Approvals', permission: 'deals.approve' }")
nav_content = nav_content.replace("{ route: '/chat', icon: 'chat', label: 'Chats', permission: 'support.manage' }", "{ route: '/chat', icon: 'chats', label: 'Chats', permission: 'support.manage' }")
nav_content = nav_content.replace("{ route: '/support', icon: 'chat', label: 'Support tickets', permission: 'support.manage' }", "{ route: '/support', icon: 'support_tickets', label: 'Support tickets', permission: 'support.manage' }")
nav_content = nav_content.replace("{ route: '/disputes', icon: 'shield', label: 'Disputes', permission: 'support.manage' }", "{ route: '/disputes', icon: 'disputes', label: 'Disputes', permission: 'support.manage' }")
nav_content = nav_content.replace("{ route: '/admin/pricing', icon: 'rupee', label: 'Pricing', permission: 'pricing.manage' }", "{ route: '/admin/pricing', icon: 'pricing', label: 'Pricing', permission: 'pricing.manage' }")
nav_content = nav_content.replace("{ route: '/admin/commerce', icon: 'settings', label: 'Commercial rules', permission: 'pricing.manage' }", "{ route: '/admin/commerce', icon: 'commercial_rules', label: 'Commercial rules', permission: 'pricing.manage' }")
nav_content = nav_content.replace("{ route: '/admin/wallet', icon: 'wallet', label: 'Platform wallet', permission: 'payments.manage' }", "{ route: '/admin/wallet', icon: 'platform_wallet', label: 'Platform wallet', permission: 'payments.manage' }")
nav_content = nav_content.replace("{ route: '/admin/ai', icon: 'sparkles', label: 'Mint AI', permission: 'pricing.manage' }", "{ route: '/admin/ai', icon: 'mint_ai', label: 'Mint AI', permission: 'pricing.manage' }")
nav_content = nav_content.replace("{ route: '/admin/audit', icon: 'shield', label: 'Audit records', permission: 'audit.read' }", "{ route: '/admin/audit', icon: 'audit', label: 'Audit records', permission: 'audit.read' }")

# Update CLIENT_NAV
nav_content = nav_content.replace("{ route: '/dashboard', icon: 'home', label: 'Dashboard' }", "{ route: '/dashboard', icon: 'overview', label: 'Dashboard' }")
nav_content = nav_content.replace("{ route: '/calendar', icon: 'calendar', label: 'Calendar', flag: 'calendar_creatives' }", "{ route: '/calendar', icon: 'operations', label: 'Calendar', flag: 'calendar_creatives' }")
nav_content = nav_content.replace("{ route: '/jobs', icon: 'briefcase', label: 'Requests', flag: 'custom_requests' }", "{ route: '/jobs', icon: 'requests', label: 'Requests', flag: 'custom_requests' }")
nav_content = nav_content.replace("{ route: '/mintbox', icon: 'layers', label: 'Mintbox', flag: 'mintbox' }", "{ route: '/mintbox', icon: 'mintbox', label: 'Mintbox', flag: 'mintbox' }")
nav_content = nav_content.replace("{ route: '/freelancers', icon: 'user', label: 'Marketplace', flag: 'marketplace' }", "{ route: '/freelancers', icon: 'marketplace', label: 'Marketplace', flag: 'marketplace' }")
nav_content = nav_content.replace("{ route: '/social', icon: 'layers', label: 'Insights', flag: 'social_insights' }", "{ route: '/social', icon: 'insights', label: 'Insights', flag: 'social_insights' }")
nav_content = nav_content.replace("{ route: '/ai', icon: 'sparkles', label: 'Mint AI', flag: 'mint_ai' }", "{ route: '/ai', icon: 'mint_ai', label: 'Mint AI', flag: 'mint_ai' }")

# Update FREELANCER_NAV
nav_content = nav_content.replace("{ route: '/dashboard', icon: 'home', label: 'Workspace' }", "{ route: '/dashboard', icon: 'overview', label: 'Workspace' }")
nav_content = nav_content.replace("{ route: '/jobs', icon: 'briefcase', label: 'Briefs' }", "{ route: '/jobs', icon: 'requests', label: 'Briefs' }")
nav_content = nav_content.replace("{ route: '/wallet', icon: 'wallet', label: 'Earnings' }", "{ route: '/wallet', icon: 'platform_wallet', label: 'Earnings' }")
nav_content = nav_content.replace("{ route: '/profile-edit', icon: 'user', label: 'My Profile' }", "{ route: '/profile-edit', icon: 'profile', label: 'My Profile' }")
nav_content = nav_content.replace("{ route: '/packages', icon: 'layers', label: 'Packages' }", "{ route: '/packages', icon: 'mintbox', label: 'Packages' }")
nav_content = nav_content.replace("{ route: '/portfolio', icon: 'image', label: 'Portfolio' }", "{ route: '/portfolio', icon: 'portfolio', label: 'Portfolio' }")
nav_content = nav_content.replace("{ route: '/inquiries', icon: 'chat', label: 'Inquiries' }", "{ route: '/inquiries', icon: 'inquiries', label: 'Inquiries' }")

# Update DESIGNER_NAV
nav_content = nav_content.replace("{ route: '/dashboard', icon: 'home', label: 'My tasks' }", "{ route: '/dashboard', icon: 'overview', label: 'My tasks' }")

with open('src/components/layout/navigation.js', 'w', encoding='utf-8') as f:
    f.write(nav_content)

# Update Icon.jsx completely
icon_content = """import {
    RiDashboardFill,
    RiInboxArchiveFill,
    RiCalendarCheckFill,
    RiTeamFill,
    RiCheckDoubleFill,
    RiChat3Fill,
    RiCustomerService2Fill,
    RiScales3Fill,
    RiMoneyRupeeCircleFill,
    RiSettings4Fill,
    RiWallet3Fill,
    RiMagicFill,
    RiFileHistoryFill,
    RiBriefcase4Fill,
    RiBox3Fill,
    RiStore2Fill,
    RiBarChartBoxFill,
    RiImage2Fill,
    RiQuestionAnswerFill,
    RiUserSettingsFill,
    RiNotification3Fill,
    RiUser3Fill,
    RiSearch2Fill,
    RiAddFill,
    RiArrowRightLine,
    RiArrowLeftLine,
    RiArrowRightUpLine,
    RiCheckLine,
    RiCloseLine,
    RiArrowDownSLine,
    RiArrowLeftSLine,
    RiArrowRightSLine,
    RiUploadCloud2Fill,
    RiAttachment2,
    RiSendPlaneFill,
    RiFlashlightFill,
    RiShieldCheckFill,
    RiStarFill,
    RiShoppingBag3Fill,
    RiTrendUpFill,
    RiTimeFill,
    RiEyeFill,
    RiEyeOffFill,
    RiHeart3Fill,
    RiGlobalFill,
    RiThumbUpFill,
    RiDeleteBin7Fill,
    RiPencilFill,
    RiFileCopyFill,
    RiFileTextFill,
    RiRefreshLine,
    RiFilter3Fill,
    RiLayoutGridFill,
    RiListCheck,
    RiEqualizerFill,
    RiBookmarkFill,
    RiFullscreenFill,
    RiCheckboxCircleFill,
    RiSquareFill,
    RiVideoFill,
    RiText,
    RiStackFill,
    RiRadarFill,
    RiLock2Fill,
    RiDownload2Fill,
    RiMoreFill,
    RiMicFill,
    RiCoinsFill,
} from '@remixicon/react'

const ICONS = {
    // Navigation specific
    overview: RiDashboardFill,
    inbox: RiInboxArchiveFill,
    operations: RiCalendarCheckFill,
    users: RiTeamFill,
    approvals: RiCheckDoubleFill,
    chats: RiChat3Fill,
    support_tickets: RiCustomerService2Fill,
    disputes: RiScales3Fill,
    pricing: RiMoneyRupeeCircleFill,
    commercial_rules: RiSettings4Fill,
    platform_wallet: RiWallet3Fill,
    mint_ai: RiMagicFill,
    audit: RiFileHistoryFill,
    requests: RiBriefcase4Fill,
    mintbox: RiBox3Fill,
    marketplace: RiStore2Fill,
    insights: RiBarChartBoxFill,
    portfolio: RiImage2Fill,
    inquiries: RiQuestionAnswerFill,
    profile: RiUserSettingsFill,

    // General
    briefcase: RiBriefcase4Fill,
    wallet: RiWallet3Fill,
    coin: RiCoinsFill,
    sparkles: RiMagicFill,
    chat: RiChat3Fill,
    bell: RiNotification3Fill,
    user: RiUser3Fill,
    search: RiSearch2Fill,
    plus: RiAddFill,
    arrowRight: RiArrowRightLine,
    arrowLeft: RiArrowLeftLine,
    arrowUpRight: RiArrowRightUpLine,
    check: RiCheckLine,
    x: RiCloseLine,
    chevronDown: RiArrowDownSLine,
    chevronLeft: RiArrowLeftSLine,
    chevronRight: RiArrowRightSLine,
    upload: RiUploadCloud2Fill,
    paperclip: RiAttachment2,
    send: RiSendPlaneFill,
    home: RiDashboardFill,
    settings: RiSettings4Fill,
    zap: RiFlashlightFill,
    shield: RiShieldCheckFill,
    star: RiStarFill,
    shoppingBag: RiShoppingBag3Fill,
    trending: RiTrendUpFill,
    clock: RiTimeFill,
    eye: RiEyeFill,
    eyeOff: RiEyeOffFill,
    heart: RiHeart3Fill,
    globe: RiGlobalFill,
    thumbsUp: RiThumbUpFill,
    trash: RiDeleteBin7Fill,
    edit: RiPencilFill,
    rupee: RiMoneyRupeeCircleFill,
    copy: RiFileCopyFill,
    file: RiFileTextFill,
    refresh: RiRefreshLine,
    filter: RiFilter3Fill,
    grid: RiLayoutGridFill,
    list: RiListCheck,
    sliders: RiEqualizerFill,
    bookmark: RiBookmarkFill,
    maximize: RiFullscreenFill,
    checkCircle: RiCheckboxCircleFill,
    square: RiSquareFill,
    calendar: RiCalendarCheckFill,
    image: RiImage2Fill,
    video: RiVideoFill,
    type: RiText,
    layers: RiStackFill,
    radar: RiRadarFill,
    lock: RiLock2Fill,
    download: RiDownload2Fill,
    more: RiMoreFill,
    microphone: RiMicFill,
}

const BRAND_PATHS = {
    facebook: 'M9 5h2V3H9a3 3 0 00-3 3v2H4v2h2v4h2v-4h2.4l.6-2H8V6c0-.6.4-1 1-1z',
    instagram: 'M4 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM12 4v.01',
    youtube: 'M2 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2zM7 6v4l3.5-2z',
    whatsapp: 'M2.5 13.5l1-3a5.5 5.5 0 111.5 1.5zM6 7a1 1 0 001 1l1 1a1 1 0 001 1l1-1c.3-.3.3-.7 0-1l-1-.5c-.3 0-.7 0-.9.2',
}

export default function Icon({ name, className = '', size = 14, style }) {
    const RemixIcon = ICONS[name]
    if (RemixIcon) {
        return (
            <RemixIcon
                className={className}
                size={size}
                style={style}
            />
        )
    }

    const d = BRAND_PATHS[name]
    if (!d) return null
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={style}
        >
            <path d={d} />
        </svg>
    )
}
"""

with open('src/components/ui/Icon.jsx', 'w', encoding='utf-8') as f:
    f.write(icon_content)
print("Updated Icon.jsx and navigation.js")
