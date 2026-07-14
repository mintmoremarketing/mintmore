import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
	negotiation_rejected: 'x',
	deal_rejected_by_admin: 'x',
	deal_pending_admin: 'shield',
	assignment_accepted: 'check',
	revision_requested: 'refresh',
	revision_delivered: 'upload',
	work_delivered: 'upload',
	mintbox_seen: 'eye',
	assignment_declined: 'x',
	kyc_approved: 'shield',
	kyc_rejected: 'shield',
	admin_broadcast: 'bell',
	system: 'bell',
}

const NOTIF_COLORS = {
	job_matched: 'var(--orange-500)',
	deal_approved: 'var(--orange-600)',
	assignment_created: 'var(--violet)',
	negotiation_accepted: 'var(--orange-500)',
	negotiation_countered: 'var(--amber)',
	negotiation_rejected: 'var(--rose)',
	deal_rejected_by_admin: 'var(--rose)',
	deal_pending_admin: 'var(--amber)',
	assignment_accepted: 'var(--orange-500)',
	revision_requested: 'var(--amber)',
	revision_delivered: 'var(--orange-600)',
	work_delivered: 'var(--orange-600)',
	mintbox_seen: 'var(--ink-500)',
	assignment_declined: 'var(--rose)',
	kyc_approved: 'var(--orange-600)',
	kyc_rejected: 'var(--rose)',
	admin_broadcast: 'var(--ink-600)',
	system: 'var(--ink-500)',
}

function cleanNotifTitle(title = '') {
	return title
		.replace(/^[^\w"']+\s*/u, '')
		.replace('New Job Match', 'New brief matched')
		.replace('Deal Rejected by Admin', 'Deal not approved')
		.replace('Negotiation Ended', 'Negotiation ended')
		.replace('Deal Agreed — Awaiting Admin Approval', 'Deal awaiting review')
		.replace('Deal Agreed - Awaiting Admin Approval', 'Deal awaiting review')
		.trim()
}

function cleanNotifBody(body = '') {
	return body
		.replace(/\s*You are ranked #\d+\./gi, '')
		.replace(/\s*The next candidate has been notified\./gi, '')
		.replace(/\s*Check your dashboard to respond\./gi, ' Open your dashboard to respond.')
		.replace(/\s+/g, ' ')
		.trim()
}

export default function NotifPanel({ onClose }) {
	const navigate = useNavigate()
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

	const markReadMutation = useMutation({
		mutationFn: (id) => notificationsApi.markRead(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
			queryClient.invalidateQueries({ queryKey: ['notif-count'] })
		},
	})

	const notifs = data?.notifications || []
	const unread = countData?.unread_count ?? notifs.filter((n) => !n.is_read).length
	const getTarget = (n) => {
		const meta = n.data || {}
		if (n.entity_type === 'dispute' || meta.dispute_id) return `/disputes?id=${n.entity_id || meta.dispute_id}`
		const jobId = n.entity_type === 'job' ? n.entity_id : meta.job_id || meta.jobId || meta.job?.id
		if (jobId) return `/jobs/${jobId}`
		if (n.entity_type === 'wallet' || n.type === 'wallet') return '/wallet'
		return null
	}
	const openNotification = (n) => {
		if (!n.is_read) markReadMutation.mutate(n.id)
		const target = getTarget(n)
		onClose()
		if (target) navigate(target)
	}

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
					<div>
						<div style={{ fontWeight: 600, fontSize: 14 }}>Notifications</div>
						<div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>
							Live · {unread} unread
						</div>
					</div>
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
						notifs.slice(0, 5).map((n) => (
							<button
								key={n.id}
								onClick={() => openNotification(n)}
								style={{
									display: 'flex',
									gap: 12,
									padding: '12px 16px',
									width: '100%',
									textAlign: 'left',
									borderBottom: '1px solid var(--hairline)',
									borderTop: 0,
									borderLeft: 0,
									borderRight: 0,
									background: n.is_read
										? 'transparent'
										: 'rgba(247,127,0,0.04)',
									cursor: getTarget(n) ? 'pointer' : 'default',
									transition: 'background 0.1s',
									fontFamily: 'inherit',
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
										{cleanNotifTitle(n.title)}
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
											{cleanNotifBody(n.body)}
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
											background: 'var(--orange-500)',
											flexShrink: 0,
											marginTop: 4,
										}}
									/>
								)}
							</button>
						))
					)}
				</div>
				{notifs.length > 0 && (
					<div style={{ padding: '10px 16px', borderTop: '1px solid var(--hairline)' }}>
						<button
							className="btn link sm"
							style={{ fontSize: 12, padding: 0 }}
							onClick={() => {
								onClose()
								navigate('/notifications')
							}}
						>
							See all notifications <Icon name="arrowRight" size={12} />
						</button>
					</div>
				)}
			</div>
		</>
	)
}
