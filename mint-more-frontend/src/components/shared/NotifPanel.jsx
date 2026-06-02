import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '../../store/ui'
import { notificationsApi } from '../../api/notifications'
import Icon from '../ui/Icon'
import { timeAgo } from '../../utils/format'

const NOTIF_ICONS = {
	job_matched: 'radar',
	deal_approved: 'check',
	assignment_created: 'zap',
	negotiation_accepted: 'check',
	negotiation_countered: 'refresh',
	kyc_approved: 'shield',
	kyc_rejected: 'shield',
	admin_broadcast: 'bell',
	system: 'bell',
}

const NOTIF_COLORS = {
	job_matched: 'var(--mint-500)',
	deal_approved: 'var(--mint-600)',
	assignment_created: 'var(--violet)',
	negotiation_accepted: 'var(--mint-500)',
	negotiation_countered: 'var(--amber)',
	kyc_approved: 'var(--mint-600)',
	kyc_rejected: 'var(--rose)',
	admin_broadcast: 'var(--ink-600)',
	system: 'var(--ink-500)',
}

export default function NotifPanel({ onClose }) {
	const queryClient = useQueryClient()
	const { setNotifs, setUnreadCount, markAllNotifsRead } = useUIStore()

	const { data, isLoading } = useQuery({
		queryKey: ['notifications'],
		queryFn: () =>
			notificationsApi.list({ limit: 30 }).then((r) => r.data.data),
	})

	const { data: countData } = useQuery({
		queryKey: ['notif-count'],
		queryFn: () => notificationsApi.unreadCount().then((r) => r.data.data),
		refetchInterval: 30000,
	})

	useEffect(() => {
		if (countData?.unread_count !== undefined) {
			setUnreadCount(countData.unread_count)
		}
	}, [countData, setUnreadCount])

	useEffect(() => {
		if (data?.notifications) {
			setNotifs(data.notifications)
		}
	}, [data, setNotifs])

	const markAllMutation = useMutation({
		mutationFn: () => notificationsApi.markAllRead(),
		onSuccess: () => {
			markAllNotifsRead()
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
			queryClient.invalidateQueries({ queryKey: ['notif-count'] })
		},
	})

	const notifs = data?.notifications || []

	return (
		<>
			<div
				style={{ position: 'fixed', inset: 0, zIndex: 49 }}
				onClick={onClose}
			/>

			<div
				style={{
					position: 'fixed',
					top: 56,
					right: 16,
					zIndex: 50,
					width: 360,
					maxHeight: 520,
					background: 'var(--paper)',
					border: '1px solid var(--hairline)',
					borderRadius: 'var(--radius-lg)',
					boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden',
				}}
			>
				<div
					style={{
						padding: '14px 16px',
						borderBottom: '1px solid var(--hairline)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
					}}
				>
					<div style={{ fontWeight: 600, fontSize: 14 }}>Notifications</div>
					<div style={{ display: 'flex', gap: 8 }}>
						{notifs.some((n) => !n.is_read) && (
							<button
								className="btn link sm"
								style={{ fontSize: 12, padding: '2px 6px' }}
								onClick={() => markAllMutation.mutate()}
								disabled={markAllMutation.isPending}
							>
								Mark all read
							</button>
						)}
						<button className="icon-btn" onClick={onClose}>
							<Icon name="x" size={13} />
						</button>
					</div>
				</div>

				<div style={{ overflow: 'auto', flex: 1 }}>
					{isLoading ? (
						<div
							style={{
								padding: 24,
								textAlign: 'center',
								color: 'var(--ink-500)',
								fontSize: 13,
							}}
						>
							Loading...
						</div>
					) : notifs.length === 0 ? (
						<div style={{ padding: 32, textAlign: 'center' }}>
							<div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
								No notifications yet
							</div>
						</div>
					) : (
						notifs.map((n) => (
							<div
								key={n.id}
								style={{
									display: 'flex',
									gap: 12,
									padding: '12px 16px',
									borderBottom: '1px solid var(--hairline)',
									background: n.is_read
										? 'transparent'
										: 'rgba(16,185,129,0.04)',
									cursor: 'default',
									transition: 'background 0.1s',
								}}
							>
								<div
									style={{
										width: 32,
										height: 32,
										borderRadius: '50%',
										flexShrink: 0,
										background: `${
											NOTIF_COLORS[n.type] || 'var(--ink-500)'
										}18`,
										color: NOTIF_COLORS[n.type] || 'var(--ink-500)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<Icon name={NOTIF_ICONS[n.type] || 'bell'} size={14} />
								</div>

								<div style={{ flex: 1, minWidth: 0 }}>
									<div
										style={{
											fontSize: 13,
											fontWeight: n.is_read ? 400 : 500,
											color: 'var(--ink-950)',
											lineHeight: 1.4,
										}}
									>
										{n.title}
									</div>
									{n.body && (
										<div
											style={{
												fontSize: 12,
												color: 'var(--ink-600)',
												marginTop: 2,
												lineHeight: 1.45,
											}}
										>
											{n.body}
										</div>
									)}
									<div
										style={{
											fontSize: 11,
											color: 'var(--ink-400)',
											marginTop: 4,
										}}
									>
										{timeAgo(n.created_at)}
									</div>
								</div>

								{!n.is_read && (
									<div
										style={{
											width: 7,
											height: 7,
											borderRadius: '50%',
											background: 'var(--mint-500)',
											flexShrink: 0,
											marginTop: 4,
										}}
									/>
								)}
							</div>
						))
					)}
				</div>
			</div>
		</>
	)
}
