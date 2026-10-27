import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Tabs from '../../components/ui/Tabs'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import StageBadge from '../../components/services/StageBadge'
import OrderChat from '../../components/services/OrderChat'
import DeliveriesPanel from '../../components/services/DeliveriesPanel'
import { deliveryText, dueText, formatDate, inr, variantLabel } from '../../components/services/serviceUtils'

const PROGRESS = ['finding_freelancer', 'in_progress', 'delivered', 'completed']
const PROGRESS_LABELS = { finding_freelancer: 'Paid', in_progress: 'In progress', delivered: 'Delivered', completed: 'Completed' }
const progressIndex = (stage) => {
	if (stage === 'revision_requested') return 1
	if (stage === 'approved') return 2
	return Math.max(0, PROGRESS.indexOf(stage))
}

/** Order workspace for clients (/orders/:id) and freelancers (/work/:id). */
export default function OrderDetail({ audience = 'client' }) {
	const { id } = useParams()
	const isClient = audience === 'client'
	const queryClient = useQueryClient()
	const [tab, setTab] = useState('deliveries')

	const queryKey = ['service-booking', audience, id]
	const { data: booking, isLoading, isError } = useQuery({
		queryKey,
		queryFn: () => (isClient ? servicesApi.booking(id) : servicesApi.workItem(id)).then(res => res.data.data),
		refetchInterval: 20_000,
	})

	if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="h-64 animate-pulse rounded-2xl bg-ink-100" /></div>
	if (isError || !booking) {
		return (
			<div className="mx-auto max-w-xl px-4 py-16 text-center">
				<h1 className="text-xl font-bold text-ink-900">Order not found</h1>
				<Link to={isClient ? '/orders' : '/work'} className="btn primary mt-4">Back to {isClient ? 'orders' : 'work'}</Link>
			</div>
		)
	}

	const snapshot = booking.snapshot || {}
	const counterpart = isClient
		? { name: booking.freelancer_name, avatar: booking.freelancer_avatar, label: 'Your freelancer' }
		: { name: booking.client_name, avatar: booking.client_avatar, label: 'Client' }
	const current = progressIndex(booking.stage)
	const refresh = () => {
		queryClient.invalidateQueries({ queryKey })
		queryClient.invalidateQueries({ queryKey: ['service-bookings'] })
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
			<Link to={isClient ? '/orders' : '/work'} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink-900">
				<Icon name="arrowLeft" size={14} /> {isClient ? 'My orders' : 'My work'}
			</Link>

			<div className="rounded-2xl border border-ink-200 bg-white p-5">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-xs font-bold tabular-nums text-ink-400">{booking.booking_number}</span>
							<StageBadge stage={booking.stage} />
						</div>
						<h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-900">{snapshot.title}</h1>
						<div className="text-sm text-ink-500">
							{variantLabel(snapshot, snapshot.option_group_label)}{Number(booking.quantity) > 1 ? ` × ${booking.quantity}` : ''}
						</div>
					</div>
					<div className="flex items-center gap-3 rounded-xl bg-ink-50 px-4 py-3">
						{counterpart.name ? (
							<>
								<Avatar name={counterpart.name} src={counterpart.avatar} size="sm" />
								<div>
									<div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{counterpart.label}</div>
									<div className="text-sm font-bold text-ink-900">{counterpart.name}</div>
								</div>
							</>
						) : (
							<div className="text-sm text-ink-600"><Icon name="clock" size={14} /> Assigning a freelancer…</div>
						)}
					</div>
				</div>

				<div className="mt-5 grid grid-cols-4 gap-2">
					{PROGRESS.map((step, index) => (
						<div key={step}>
							<div className={`h-1.5 rounded-full ${index <= current ? 'bg-mint-500' : 'bg-ink-100'}`} />
							<div className={`mt-1.5 text-[11px] font-semibold ${index <= current ? 'text-ink-900' : 'text-ink-400'}`}>{PROGRESS_LABELS[step]}</div>
						</div>
					))}
				</div>

				<div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
					<div><div className="text-[11px] font-semibold uppercase text-ink-500">{booking.stage === 'completed' ? 'Completed' : 'Due'}</div><div className="font-semibold text-ink-900">{booking.stage === 'completed' ? formatDate(booking.completed_at) : booking.due_at ? `${formatDate(booking.due_at)} · ${dueText(booking.due_at)}` : '—'}</div></div>
					<div><div className="text-[11px] font-semibold uppercase text-ink-500">Delivery time</div><div className="font-semibold text-ink-900">{deliveryText(snapshot.delivery_days)}</div></div>
					<div><div className="text-[11px] font-semibold uppercase text-ink-500">Revisions left</div><div className="font-semibold text-ink-900">{booking.revisions_left} of {booking.revisions_included}</div></div>
					<div><div className="text-[11px] font-semibold uppercase text-ink-500">{isClient ? 'Paid' : 'Your payout'}</div><div className="font-semibold tabular-nums text-ink-900">{inr(isClient ? Number(booking.subtotal) + Number(booking.gst_amount) : booking.freelancer_payout)}</div></div>
				</div>
			</div>

			<div className="mt-6">
				<Tabs
					items={[
						{ value: 'deliveries', label: 'Deliveries', count: booking.delivery_count || undefined },
						{ value: 'chat', label: 'Chat' },
						{ value: 'details', label: 'Order details' },
					]}
					value={tab}
					onChange={setTab}
				/>
				<div className="mt-4">
					{tab === 'deliveries' && <DeliveriesPanel booking={booking} role={audience} onChanged={refresh} />}
					{tab === 'chat' && <OrderChat roomId={booking.room_id} role={audience} counterpartName={counterpart.name} />}
					{tab === 'details' && (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-2xl border border-ink-200 bg-white p-5">
								<h2 className="mb-3 text-sm font-bold text-ink-900">Instructions</h2>
								<p className="whitespace-pre-wrap text-sm text-ink-700">{booking.instructions || 'No written instructions. Check the chat for files and notes.'}</p>
								{snapshot.requirements_hint && <p className="mt-3 rounded-lg bg-ink-50 p-3 text-xs text-ink-600">{snapshot.requirements_hint}</p>}
							</div>
							<div className="rounded-2xl border border-ink-200 bg-white p-5">
								<h2 className="mb-3 text-sm font-bold text-ink-900">Scope (as purchased)</h2>
								<ul className="space-y-1.5 text-sm text-ink-700">
									{(snapshot.includes || []).map(item => <li key={item} className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 text-emerald-600" />{item}</li>)}
								</ul>
								{(snapshot.excludes || []).length > 0 && (
									<ul className="mt-3 space-y-1.5 text-sm text-ink-500">
										{snapshot.excludes.map(item => <li key={item} className="flex gap-2"><Icon name="x" size={13} className="mt-0.5 text-rose-500" />{item}</li>)}
									</ul>
								)}
							</div>
							{isClient && (
								<div className="rounded-2xl border border-ink-200 bg-white p-5 md:col-span-2">
									<h2 className="mb-3 text-sm font-bold text-ink-900">Payment</h2>
									<dl className="grid gap-2 text-sm sm:grid-cols-3">
										<div><dt className="text-xs text-ink-500">Service</dt><dd className="font-semibold tabular-nums">{inr(booking.subtotal)}</dd></div>
										<div><dt className="text-xs text-ink-500">GST</dt><dd className="font-semibold tabular-nums">{inr(booking.gst_amount)}</dd></div>
										<div><dt className="text-xs text-ink-500">Paid on</dt><dd className="font-semibold">{formatDate(booking.paid_at)}</dd></div>
									</dl>
									<p className="mt-3 text-xs text-ink-500">Your payment is held by CREATYV and released to the freelancer only when you complete the order.</p>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
