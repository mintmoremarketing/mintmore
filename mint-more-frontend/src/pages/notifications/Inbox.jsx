import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../../api/notifications'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import { timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

const NOTIF_ICONS = {
	job_matched: 'radar',
	deal_approved: 'check',
	assignment_created: 'zap',
	negotiation_accepted: 'check',
	negotiation_countered: 'refresh',
	kyc_approved: 'shield',
	kyc_rejected: 'shield',
	wallet: 'wallet',
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
	wallet: 'var(--amber)',
	admin_broadcast: 'var(--ink-600)',
	system: 'var(--ink-500)',
}

const JOB_TYPES = new Set([
	'job_matched',
	'deal_approved',
	'assignment_created',
	'negotiation_accepted',
	'negotiation_countered',
])

const SYSTEM_TYPES = new Set(['system', 'admin_broadcast', 'kyc_approved', 'kyc_rejected'])

function notifTone(type) {
	return NOTIF_COLORS[type] || 'var(--ink-500)'
}

function notifIcon(type) {
	return NOTIF_ICONS[type] || 'bell'
}

function getTarget(notification) {
	const data = notification.data || {}
	const jobId =
		notification.entity_type === 'job'
			? notification.entity_id
			: data.job_id || data.jobId || data.job?.id

	if (jobId) return `/jobs/${jobId}`
	if (notification.entity_type === 'wallet' || notification.type === 'wallet') return '/wallet'
	return null
}

function Tabs({ value, onChange, items }) {
	return (
		<div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
			{items.map((item) => (
				<button
					key={item.value}
					className={`btn ${value === item.value ? 'primary' : 'ghost'} sm`}
					onClick={() => onChange(item.value)}
					style={{ fontSize: 12 }}
				>
					{item.label}
					<span className="mono" style={{ opacity: 0.75 }}>{item.count}</span>
				</button>
			))}
		</div>
	)
}

export default function NotificationsInbox() {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const setUnreadCount = useUIStore((s) => s.setUnreadCount)
	const markAllNotifsRead = useUIStore((s) => s.markAllNotifsRead)
	const [filter, setFilter] = useState('all')

	const { data, isLoading } = useQuery({
		queryKey: ['notifications', 'inbox'],
		queryFn: () => notificationsApi.list({ limit: 100 }).then((r) => r.data.data),
	})

	const notifications = data?.notifications || []

	const counts = useMemo(() => ({
		all: notifications.length,
		unread: notifications.filter((n) => !n.is_read).length,
		jobs: notifications.filter((n) => JOB_TYPES.has(n.type) || n.entity_type === 'job').length,
		wallet: notifications.filter((n) => n.type === 'wallet' || n.entity_type === 'wallet').length,
		system: notifications.filter((n) => SYSTEM_TYPES.has(n.type)).length,
	}), [notifications])

	const filtered = notifications.filter((n) => {
		if (filter === 'all') return true
		if (filter === 'unread') return !n.is_read
		if (filter === 'jobs') return JOB_TYPES.has(n.type) || n.entity_type === 'job'
		if (filter === 'wallet') return n.type === 'wallet' || n.entity_type === 'wallet'
		if (filter === 'system') return SYSTEM_TYPES.has(n.type)
		return true
	})

	const markRead = useMutation({
		mutationFn: (id) => notificationsApi.markRead(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
			queryClient.invalidateQueries({ queryKey: ['notifications', 'inbox'] })
			queryClient.invalidateQueries({ queryKey: ['notif-count'] })
		},
	})

	const markAllRead = useMutation({
		mutationFn: () => notificationsApi.markAllRead(),
		onSuccess: () => {
			markAllNotifsRead()
			setUnreadCount(0)
			queryClient.invalidateQueries({ queryKey: ['notifications'] })
			queryClient.invalidateQueries({ queryKey: ['notifications', 'inbox'] })
			queryClient.invalidateQueries({ queryKey: ['notif-count'] })
			pushToast({ title: 'All caught up', body: 'Marked everything as read.', icon: 'check' })
		},
		onError: (err) => pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const openNotification = (notification) => {
		if (!notification.is_read) markRead.mutate(notification.id)
		const target = getTarget(notification)
		if (target) navigate(target)
	}

	if (isLoading) {
		return (
			<div className="stack-6">
				<SkeletonCard />
				<SkeletonCard />
			</div>
		)
	}

	return (
		<div className="stack-6">
			<div className="row between reveal" style={{ gap: 16, alignItems: 'flex-start' }}>
				<div>
					<div className="h-eyebrow" style={{ marginBottom: 4 }}>Inbox</div>
					<h1 className="h-display h-1" style={{ margin: 0 }}>Notifications</h1>
					<p className="muted" style={{ marginTop: 6 }}>
						{counts.unread > 0 ? (
							<>You have <strong style={{ color: 'var(--ink-900)' }}>{counts.unread} unread</strong> · live sync via Mintmore</>
						) : (
							<>You're all caught up · live sync via Mintmore</>
						)}
					</p>
				</div>
				<button className="btn ghost" onClick={() => markAllRead.mutate()} disabled={counts.unread === 0 || markAllRead.isPending}>
					<Icon name="check" size={13} />
					{markAllRead.isPending ? 'Marking...' : 'Mark all read'}
				</button>
			</div>

			<div className="row between reveal" style={{ flexWrap: 'wrap', gap: 8 }}>
				<Tabs
					value={filter}
					onChange={setFilter}
					items={[
						{ value: 'all', label: 'All', count: counts.all },
						{ value: 'unread', label: 'Unread', count: counts.unread },
						{ value: 'jobs', label: 'Jobs', count: counts.jobs },
						{ value: 'wallet', label: 'Wallet', count: counts.wallet },
						{ value: 'system', label: 'System', count: counts.system },
					]}
				/>
				<div className="row" style={{ gap: 8, fontSize: 12, color: 'var(--ink-500)' }}>
					<span className="pulse-dot" style={{ width: 6, height: 6 }} />
					<span className="mono">Live</span>
				</div>
			</div>

			<div className="card reveal" style={{ padding: 0, overflow: 'hidden' }}>
				{filtered.length === 0 ? (
					<div className="empty" style={{ border: 0, padding: 48 }}>
						<div className="empty-glyph"><Icon name="bell" /></div>
						<h3>No notifications</h3>
						<p>Nothing in this filter right now.</p>
					</div>
				) : (
					filtered.map((n, i) => {
						const target = getTarget(n)
						const color = notifTone(n.type)
						return (
							<button
								key={n.id}
								onClick={() => openNotification(n)}
								style={{
									display: 'flex',
									gap: 14,
									alignItems: 'flex-start',
									padding: '14px 18px',
									width: '100%',
									textAlign: 'left',
									background: n.is_read ? 'transparent' : 'var(--mint-50)',
									border: 0,
									borderTop: i === 0 ? 0 : '1px solid var(--hairline)',
									cursor: target ? 'pointer' : 'default',
									transition: 'background 0.12s ease',
									position: 'relative',
									fontFamily: 'inherit',
								}}
							>
								{!n.is_read && (
									<span style={{ position: 'absolute', left: 8, top: '50%', width: 4, height: 4, borderRadius: '50%', background: 'var(--mint-600)', transform: 'translateY(-50%)' }} />
								)}
								<div style={{ width: 34, height: 34, borderRadius: '50%', background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
									<Icon name={notifIcon(n.type)} size={14} />
								</div>
								<div style={{ flex: 1, minWidth: 0 }}>
									<div style={{ fontSize: 13.5, fontWeight: n.is_read ? 500 : 600, color: 'var(--ink-950)' }}>{n.title}</div>
									{n.body && <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 2, lineHeight: 1.45 }}>{n.body}</div>}
									<div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{timeAgo(n.created_at)}</div>
								</div>
								{target && (
									<span style={{ fontSize: 11, color: 'var(--ink-500)', alignSelf: 'center' }}>
										<Icon name="arrowRight" size={12} />
									</span>
								)}
							</button>
						)
					})
				)}
			</div>
		</div>
	)
}
