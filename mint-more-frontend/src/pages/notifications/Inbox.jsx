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
	negotiation_rejected: 'var(--rose)',
	deal_rejected_by_admin: 'var(--rose)',
	deal_pending_admin: 'var(--amber)',
	assignment_accepted: 'var(--mint-500)',
	revision_requested: 'var(--amber)',
	revision_delivered: 'var(--mint-600)',
	work_delivered: 'var(--mint-600)',
	mintbox_seen: 'var(--ink-500)',
	assignment_declined: 'var(--rose)',
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
	'revision_requested',
	'revision_delivered',
	'work_delivered',
	'mintbox_seen',
])

const SYSTEM_TYPES = new Set(['system', 'admin_broadcast', 'kyc_approved', 'kyc_rejected'])

function notifTone(type) {
	return NOTIF_COLORS[type] || 'var(--ink-500)'
}

function notifIcon(type) {
	return NOTIF_ICONS[type] || 'bell'
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

function getTarget(notification) {
	const data = notification.data || {}
	if (notification.entity_type === 'dispute' || data.dispute_id) {
		return `/disputes?id=${notification.entity_id || data.dispute_id}`
	}
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

	const notifications = useMemo(() => data?.notifications || [], [data?.notifications])

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
			<div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto pb-16">
				<SkeletonCard />
				<SkeletonCard />
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto pb-16">
			<div className="flex flex-col md:flex-row md:items-start justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
				<div>
					<div className="text-[11px] font-bold tracking-wider uppercase text-mint-500 mb-2">Inbox</div>
					<h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900 tracking-tight m-0 pb-1">Notifications</h1>
					<p className="text-ink-500 text-sm md:text-base mt-2">
						{counts.unread > 0 ? (
							<>You have <strong className="text-ink-900 font-bold">{counts.unread} unread</strong> · live sync via CREATYV</>
						) : (
							<>You're all caught up · live sync via CREATYV</>
						)}
					</p>
				</div>
				<button 
					className="bg-white text-ink-900 border border-ink-200 shadow-sm px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
					onClick={() => markAllRead.mutate()} 
					disabled={counts.unread === 0 || markAllRead.isPending}
				>
					<Icon name="check" size={14} />
					{markAllRead.isPending ? 'Marking...' : 'Mark all read'}
				</button>
			</div>

			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
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
				<div className="flex items-center gap-2 text-xs font-mono text-ink-500">
					<span className="w-1.5 h-1.5 bg-mint-500 rounded-full animate-pulse" />
					<span>Live</span>
				</div>
			</div>

			<div className="bg-white rounded-2xl border border-ink-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 md:p-24 text-center">
						<div className="w-12 h-12 rounded-full bg-ink-50 flex items-center justify-center text-ink-400 mb-4">
							<Icon name="bell" size={20} />
						</div>
						<h3 className="text-lg font-bold text-ink-900 mb-1">No notifications</h3>
						<p className="text-ink-500 text-sm">Nothing in this filter right now.</p>
					</div>
				) : (
					filtered.map((n, i) => {
						const target = getTarget(n)
						const color = notifTone(n.type)
						return (
							<button
								key={n.id}
								onClick={() => openNotification(n)}
								className={`
									w-full flex items-start gap-4 p-4 md:p-5 text-left transition-colors relative
									${n.is_read ? 'bg-transparent hover:bg-ink-50/50' : 'bg-mint-50/30 hover:bg-mint-50/70'}
									${i === 0 ? '' : 'border-t border-ink-100'}
									${target ? 'cursor-pointer' : 'cursor-default'}
								`}
							>
								{!n.is_read && (
									<span className="absolute left-1.5 md:left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-mint-500" />
								)}
								<div 
									className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" 
									style={{ background: `${color}18`, color }}
								>
									<Icon name={notifIcon(n.type)} size={16} />
								</div>
								<div className="flex-1 min-w-0">
									<div className={`text-sm ${n.is_read ? 'font-medium' : 'font-semibold'} text-ink-950`}>
										{cleanNotifTitle(n.title)}
									</div>
									{n.body && (
										<div className="text-[13px] text-ink-600 mt-0.5 leading-relaxed">
											{cleanNotifBody(n.body)}
										</div>
									)}
									<div className="text-[11px] text-ink-400 mt-1.5 font-mono">
										{timeAgo(n.created_at)}
									</div>
								</div>
								{target && (
									<span className="text-ink-300 self-center hidden md:block">
										<Icon name="arrowRight" size={14} />
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
