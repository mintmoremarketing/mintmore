import {
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
    RiLineChartFill,
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
    trending: RiLineChartFill,
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
