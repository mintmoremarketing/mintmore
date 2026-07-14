import { useState, useEffect } from 'react'
import { Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { walletApi } from '../../api/wallet'
import { notificationsApi } from '../../api/notifications'
import { commerceApi } from '../../api/commerce'
import { useSSE } from '../../hooks/useSSE'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import MobileDrawer from './MobileDrawer'
import { ToastHost } from '../ui/Toast'
import NotifPanel from '../shared/NotifPanel'
import TopUpModal from '../shared/TopUpModal'
import GuestBanner from '../shared/GuestBanner'
import { useEntitlements } from '../../hooks/useEntitlements'

const DEFAULT_FLAGS = { wallet_ui: false, marketplace: false, freelancer_portal: false, freelancer_matching: false, negotiation: false }

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

export default function AppShell() {
  const navigate = useNavigate()
  const { isAuthed, isGuest, user } = useAuthStore()
  const {
    toasts, showTopUp, showNotif,
    setShowTopUp, setShowNotif,
    unreadCount, setUnreadCount,
  } = useUIStore()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const role = isGuest ? 'client' : user?.role
  const { data: access } = useEntitlements()
  const featureFlags = { ...DEFAULT_FLAGS, ...(access?.feature_flags || {}) }
  const showWalletUi = role !== 'client' || featureFlags.wallet_ui !== false

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
  const { data: mintCreditData } = useQuery({
    queryKey: ['mint-credits'],
    queryFn: () => commerceApi.credits().then(r => r.data.data),
    enabled: isAuthed && user?.role === 'client' && !isGuest,
    refetchInterval: 60_000,
  })
  const mintCoinBalance = Number(mintCreditData?.balance ?? 0)

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

  if (!isAuthed && !isGuest) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen bg-mint-50/20 text-ink-900 font-sans">
      {/* Desktop sidebar — hidden on mobile */}
      {!isMobile && (
        <Sidebar
          role={role}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}

      {/* Topbar fixed to viewport */}
      <div className={`fixed top-0 right-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200/50 transition-all duration-200 ease-out ${
        !isMobile ? (sidebarCollapsed ? 'left-16' : 'left-56') : 'left-0'
      }`}>
        <Topbar
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
          walletBalance={showWalletUi && role !== 'admin' && !isGuest ? walletBalance : undefined}
          mintCoinBalance={role === 'client' ? (isGuest ? 999 : mintCoinBalance) : undefined}
          onWalletClick={() => showWalletUi && setShowTopUp(true)}
          onMintCoinClick={() => navigate(isGuest ? '/register' : '/calendar')}
          onNotifClick={() => setShowNotif(!showNotif)}
          notifUnread={unreadCount > 0}
          unreadCount={unreadCount}
        />
      </div>

      {/* Main column */}
      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out pt-[64px] ${
        !isMobile ? (sidebarCollapsed ? 'ml-16' : 'ml-56') : ''
      } ${isMobile ? 'pb-16' : ''}`}>

        <GuestBanner />

        <div className="flex-1 flex flex-col w-full h-full relative">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        {isMobile && <MobileNav role={role} />}
      </main>

      {/* Mobile drawer (hamburger) */}
      {isMobile && drawerOpen && (
        <MobileDrawer role={role} onClose={() => setDrawerOpen(false)} />
      )}

      {showNotif && !isGuest && <NotifPanel onClose={() => setShowNotif(false)} />}
      {showTopUp && showWalletUi && !isGuest && <TopUpModal onClose={() => setShowTopUp(false)} />}

      <ToastHost toasts={toasts} />
    </div>
  )
}
