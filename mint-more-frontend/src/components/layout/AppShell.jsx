import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import { ToastHost } from '../ui/Toast'

export default function AppShell() {
	const { isAuthed, user } = useAuthStore()
	const { toasts, setShowNotif } = useUIStore()

	if (!isAuthed) return <Navigate to="/login" replace />

	const isMobile = window.innerWidth < 768

	return (
		<div className="app">
			{!isMobile && <Sidebar role={user?.role} />}
			<main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
				<Topbar
					walletBalance={0}
					onWalletClick={() => {}}
					onNotifClick={() => setShowNotif(true)}
					notifUnread={true}
				/>
				<div className="page">
					<Outlet />
				</div>
				{isMobile && <MobileNav role={user?.role} />}
			</main>
			<ToastHost toasts={toasts} />
		</div>
	)
}
