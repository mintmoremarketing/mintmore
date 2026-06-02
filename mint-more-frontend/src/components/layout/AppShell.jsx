import { Outlet, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { walletApi } from '../../api/wallet'
import { useSSE } from '../../hooks/useSSE'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import { ToastHost } from '../ui/Toast'
import NotifPanel from '../shared/NotifPanel'
import TopUpModal from '../shared/TopUpModal'

export default function AppShell() {
	const { isAuthed, user } = useAuthStore()
	const {
		toasts,
		showTopUp,
		showNotif,
		setShowTopUp,
		setShowNotif,
		unreadCount,
	} = useUIStore()

	useSSE()

	const { data: walletData } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => walletApi.get().then((r) => r.data.data),
		enabled: isAuthed && user?.role !== 'admin',
		refetchInterval: 60000,
	})
	const walletBalance = walletData?.wallet?.balance ?? null

	if (!isAuthed) return <Navigate to="/login" replace />

	const isMobile = window.innerWidth < 768

	return (
		<div className="app">
			{!isMobile && <Sidebar role={user?.role} />}
			<main style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
				<Topbar
					walletBalance={user?.role !== 'admin' ? walletBalance : undefined}
					onWalletClick={() => setShowTopUp(true)}
					onNotifClick={() => setShowNotif(!showNotif)}
					notifUnread={unreadCount > 0}
					unreadCount={unreadCount}
				/>
				<div className="page">
					<Outlet />
				</div>
				{isMobile && <MobileNav role={user?.role} />}
			</main>

			{showNotif && <NotifPanel onClose={() => setShowNotif(false)} />}
			{showTopUp && <TopUpModal onClose={() => setShowTopUp(false)} />}
			<ToastHost toasts={toasts} />
		</div>
	)
}
