import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { walletApi } from '../../api/wallet'
import { useSSE } from '../../hooks/useSSE'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import MobileDrawer from './MobileDrawer'
import { ToastHost } from '../ui/Toast'
import NotifPanel from '../shared/NotifPanel'
import TopUpModal from '../shared/TopUpModal'
import GuestBanner from '../shared/GuestBanner'

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
  const { isAuthed, isGuest, user } = useAuthStore()
  const {
    toasts, showTopUp, showNotif,
    setShowTopUp, setShowNotif,
    unreadCount,
  } = useUIStore()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  useSSE()

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletApi.get().then(r => r.data.data),
    enabled: (isAuthed || isGuest) && user?.role !== 'admin' && !isGuest,
    refetchInterval: 60_000,
  })
  const walletBalance = walletData?.wallet?.balance ?? null

  if (!isAuthed && !isGuest) return <Navigate to="/login" replace />

  const role = isGuest ? 'client' : user?.role

  return (
    <div className={`app${isMobile ? ' mobile' : ''}`}>
      {/* Desktop sidebar — hidden on mobile */}
      {!isMobile && <Sidebar role={role} />}

      {/* Main column */}
      <main>
        <Topbar
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
          walletBalance={role !== 'admin' && !isGuest ? walletBalance : undefined}
          onWalletClick={() => setShowTopUp(true)}
          onNotifClick={() => setShowNotif(!showNotif)}
          notifUnread={unreadCount > 0}
          unreadCount={unreadCount}
        />

        <GuestBanner />

        <div className="page">
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
      {showTopUp && !isGuest && <TopUpModal onClose={() => setShowTopUp(false)} />}

      <ToastHost toasts={toasts} />
    </div>
  )
}