import { useState, useEffect } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { aiApi } from '../../api/ai'
import { walletApi } from '../../api/wallet'
import { notificationsApi } from '../../api/notifications'
import { useSSE } from '../../hooks/useSSE'
import Sidebar from './Sidebar'
import AdminSidebar from './AdminSidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import MobileDrawer from './MobileDrawer'
import { ToastHost } from '../ui/Toast'
import { chatApi } from '../../api/chat'
import NotifPanel from '../shared/NotifPanel'
import TopUpModal from '../shared/TopUpModal'
import MintcoinModal from '../shared/MintcoinModal'
import GuestBanner from '../shared/GuestBanner'
import ProfileCompletion from '../freelancer/ProfileCompletion.jsx'
import FreelancerTopbar from './FreelancerTopbar'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useEntitlements } from '../../hooks/useEntitlements'
import { LAUNCH_FLAG_OVERRIDES } from '../../config/launch'
import Icon from '../ui/Icon'

const DEFAULT_FLAGS = { wallet_ui: false, marketplace: false, freelancer_portal: false, freelancer_matching: false, negotiation: false }

function AdminImpersonationBanner() {
  const isAdminImpersonating = !!sessionStorage.getItem('mm_admin_auth')
  const stopImpersonating = useAuthStore(s => s.stopImpersonating)
  
  if (!isAdminImpersonating) return null

  return (
    <div className="bg-rose-500 text-white px-4 py-2 flex flex-col md:flex-row items-center justify-between z-[100] relative text-sm font-medium gap-2">
      <div className="flex items-center gap-2 text-center md:text-left">
        <Icon name="user-check" size={16} />
        You are impersonating a user. Social posts will be badged with "Auto published by Mintmore".
      </div>
      <button 
        onClick={() => {
          stopImpersonating()
          window.location.href = '/admin/users'
        }}
        className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors whitespace-nowrap"
      >
        Return to Admin
      </button>
    </div>
  )
}


export default function AppShell() {
  const navigate = useNavigate()
  const { isAuthed, isGuest, user } = useAuthStore()
  const {
    toasts, showTopUp, showNotif,
    setShowTopUp, setShowNotif,
    unreadCount, setUnreadCount,
    aiUsageFocus,
  } = useUIStore()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showMintcoinModal, setShowMintcoinModal] = useState(false)

  useEffect(() => {
    const handleOpenMintcoinModal = () => setShowMintcoinModal(true)
    window.addEventListener('open-mintcoin-modal', handleOpenMintcoinModal)
    return () => window.removeEventListener('open-mintcoin-modal', handleOpenMintcoinModal)
  }, [])
  const isMobile = useIsMobile()
  const role = isGuest ? 'client' : user?.role
  const { data: access } = useEntitlements()
  const featureFlags = { ...DEFAULT_FLAGS, ...(access?.feature_flags || {}) }
  const showWalletUi = role !== 'client' || featureFlags.wallet_ui === true

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const closeOnDesktop = (event) => {
      if (!event.matches) setDrawerOpen(false)
    }
    mq.addEventListener('change', closeOnDesktop)
    return () => mq.removeEventListener('change', closeOnDesktop)
  }, [])

  useSSE()

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get().then(r => r.data.data),
    enabled: showWalletUi && (isAuthed || isGuest) && user?.role !== 'admin' && !isGuest,
    refetchInterval: 60_000,
  })
  const walletBalance = walletData?.wallet?.balance ?? null
  const aiUsageQueryKey = [
    'ai-usage',
    aiUsageFocus?.model_id || 'any',
    aiUsageFocus?.tool_type || 'any',
    aiUsageFocus?.resolution_tier || 'any',
    aiUsageFocus?.duration || 'any',
  ]
  const { data: aiUsageData } = useQuery({
    queryKey: aiUsageQueryKey,
    queryFn: () => aiApi.getUsage(aiUsageFocus || undefined).then(r => r.data.data),
    enabled: LAUNCH_FLAG_OVERRIDES.mint_ai !== false && isAuthed && user?.role === 'client' && !isGuest,
    refetchInterval: 60_000,
  })
  const aiUsageSummary = aiUsageData?.usage || null
  const mintCoinBalance = Number(aiUsageSummary?.mintcoin_balance ?? 0)

  useQuery({
    queryKey: ['notif-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount()
      const count = res.data?.data?.unread_count ?? 0
      setUnreadCount(count)
      return res.data?.data
    },
    enabled: isAuthed && !isGuest,
    refetchInterval: 30_000,
  })

  // Tells the server this app received any waiting chat messages, so the sender sees two grey ticks.
  useQuery({
    queryKey: ['chat-delivered-ping'],
    queryFn: () => chatApi.markDelivered().then(() => Date.now()),
    enabled: isAuthed && !isGuest && ['client', 'freelancer', 'designer'].includes(user?.role),
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  })

  const location = useLocation()
  const isOnboarding = location.pathname.startsWith('/onboarding')

  if (!isAuthed && !isGuest) return <Navigate to="/login" replace />

  if (isOnboarding) {
    return (
      <div className="flex min-h-screen bg-mint-50/20 text-ink-900 font-sans w-full">
        <main className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </main>
        <ToastHost toasts={toasts} />
      </div>
    )
  }

  // Freelancers: the same sidebar as clients on desktop, with their own top bar for the
  // bookings switch, search and posting. Phones keep the top bar and bottom tabs.
  if (role === 'freelancer') {
    return (
      <div className="flex min-h-screen bg-white text-ink-900 font-sans" style={{ '--bottom-nav-h': isMobile ? '64px' : '0px' }}>
        {!isMobile && <Sidebar role={role} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />}
        <div className={`fixed right-0 top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur-md transition-all duration-200 ease-out ${!isMobile ? (sidebarCollapsed ? 'left-16' : 'left-56') : 'left-0'}`}>
          <FreelancerTopbar isMobile={isMobile} unreadCount={unreadCount} withSidebar={!isMobile} />
        </div>
        <main className={`flex min-w-0 flex-1 flex-col pt-16 transition-all duration-200 ease-out ${!isMobile ? (sidebarCollapsed ? 'ml-16' : 'ml-56') : 'pb-16'}`}>
          <AdminImpersonationBanner />
          <GuestBanner />
          <div className="relative flex h-full w-full flex-1 flex-col">
            <Outlet />
          </div>
          <ProfileCompletion />
          {isMobile && <MobileNav role={role} />}
        </main>
        <ToastHost toasts={toasts} />
      </div>
    )
  }

  const isAdmin = role === 'admin'
  const SideNav = isAdmin ? AdminSidebar : Sidebar

  return (
    // --bottom-nav-h lets page-level sticky bars sit above the mobile tab bar.
    <div className={`flex min-h-screen text-ink-900 font-sans ${isAdmin ? 'admin-shell bg-ink-50' : 'bg-mint-50/20'}`} style={{ '--bottom-nav-h': isMobile ? '64px' : '0px' }}>
      {/* Desktop sidebar — hidden on mobile */}
      {!isMobile && (
        <SideNav
          role={role}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}

      {/* Topbar fixed to viewport */}
      <div className={`fixed top-0 right-0 z-30 border-b transition-all duration-200 ease-out ${isAdmin ? 'border-ink-100 bg-white' : 'bg-white/80 backdrop-blur-md border-ink-200/50'} ${
        !isMobile ? (sidebarCollapsed ? 'left-16' : 'left-56') : 'left-0'
      }`}>
        <Topbar
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
          walletBalance={showWalletUi && role !== 'admin' && !isGuest ? walletBalance : undefined}
          mintCoinBalance={undefined}
          usageSummary={undefined}
          onWalletClick={() => showWalletUi && setShowTopUp(true)}
          onMintCoinClick={() => isGuest ? navigate('/register') : setShowMintcoinModal(true)}
          onNotifClick={() => setShowNotif(!showNotif)}
          notifUnread={unreadCount > 0}
          unreadCount={unreadCount}
        />
      </div>

      {/* Main column */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out pt-[64px] ${
        !isMobile ? (sidebarCollapsed ? 'ml-16' : 'ml-56') : ''
      } ${isMobile ? 'pb-16' : ''}`}>

        <AdminImpersonationBanner />
        <GuestBanner />

        <div className="flex-1 flex flex-col w-full h-full relative">
          <Outlet />
        </div>

        <ProfileCompletion />

        {/* Mobile bottom nav */}
        {isMobile && <MobileNav role={role} onMore={() => setDrawerOpen(true)} />}
      </main>

      {/* Mobile drawer (hamburger) */}
      {isMobile && drawerOpen && (
        <MobileDrawer role={role} onClose={() => setDrawerOpen(false)} />
      )}

      {showNotif && !isGuest && <NotifPanel onClose={() => setShowNotif(false)} />}
      {showTopUp && showWalletUi && !isGuest && <TopUpModal onClose={() => setShowTopUp(false)} />}
      {LAUNCH_FLAG_OVERRIDES.mint_ai !== false && showMintcoinModal && !isGuest && <MintcoinModal onClose={() => setShowMintcoinModal(false)} />}

      <ToastHost toasts={toasts} />
    </div>
  )
}
