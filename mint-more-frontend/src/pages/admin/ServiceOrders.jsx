import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Modal from '../../components/ui/Modal'
import Tabs from '../../components/ui/Tabs'
import Icon from '../../components/ui/Icon'
import StageBadge from '../../components/services/StageBadge'
import { AdminPage, EmptyState, PageHeader, Panel, SkeletonRows } from '../../components/admin/AdminUI'
import { dueText, formatDate, inr, variantLabel } from '../../components/services/serviceUtils'

function AssignModal({ booking, onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const [selected, setSelected] = useState('')
	const { data: freelancers = [], isLoading } = useQuery({
		queryKey: ['admin-eligible-freelancers', booking.id],
		queryFn: () => servicesApi.adminEligibleFreelancers(booking.id).then(res => res.data.data),
	})
	const assign = useMutation({
		mutationFn: () => servicesApi.adminAssign(booking.id, selected ? { freelancer_id: selected } : {}),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ['admin-service-bookings'] })
			const result = res.data.data
			pushToast({ title: result?.assigned ? 'Freelancer assigned' : 'No eligible freelancer found', icon: result?.assigned ? 'check' : 'x', tone: result?.assigned ? undefined : 'amber' })
			onClose()
		},
		onError: err => pushToast({ title: 'Could not assign', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
	})

	return (
		<Modal
			title={`Assign ${booking.booking_number}`}
			subtitle={booking.snapshot?.title}
			onClose={onClose}
			maxWidth={560}
			footer={<>
				<button className="btn ghost" onClick={onClose}>Cancel</button>
				<button className="btn primary" disabled={assign.isPending} onClick={() => assign.mutate()}>{selected ? 'Assign selected' : 'Auto-assign best match'}</button>
			</>}
		>
			<p className="mb-3 text-sm text-ink-600">Only active, available, KYC-verified freelancers under their job limit are listed. Opted-in freelancers come first.</p>
			{isLoading ? <div className="h-24 animate-pulse rounded-xl bg-ink-100" /> : freelancers.length === 0 ? (
				<div className="rounded-xl bg-ink-50 p-3 text-sm text-ink-700">No eligible freelancers right now. Approve a KYC or ask a freelancer to opt in to this service.</div>
			) : (
				<div className="max-h-80 space-y-1.5 overflow-y-auto">
					{freelancers.map(f => (
						<label key={f.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 text-sm transition-colors ${selected === f.id ? 'border-mint-400 bg-mint-50' : 'border-ink-200 hover:border-ink-300'}`}>
							<input type="radio" name="freelancer" className="accent-mint-500" checked={selected === f.id} onChange={() => setSelected(f.id)} />
							<div className="min-w-0 flex-1">
								<div className="font-semibold text-ink-900">{f.full_name}</div>
								<div className="truncate text-xs text-ink-500">{f.email}</div>
							</div>
							<div className="text-right text-xs text-ink-500">
								{f.opted_in ? <span className="font-semibold text-emerald-700">Offers this</span> : 'Not opted in'}
								<div className="tabular-nums">{Number(f.average_rating || 0).toFixed(1)}★ · {f.active_jobs_count} active</div>
							</div>
						</label>
					))}
				</div>
			)}
		</Modal>
	)
}

const VIEWS = {
	unassigned: { label: 'Needs a freelancer', match: row => row.stage === 'finding_freelancer' },
	open: { label: 'Open', match: row => ['in_progress', 'revision_requested', 'delivered', 'approved'].includes(row.stage) },
	completed: { label: 'Closed', match: row => row.stage === 'completed' || row.stage === 'cancelled' },
	all: { label: 'All', match: () => true },
}

const isOverdue = row => row.due_at && ['in_progress', 'revision_requested'].includes(row.stage) && new Date(row.due_at).getTime() < Date.now()

function DueCell({ row }) {
	if (row.stage === 'completed') return <span className="text-ink-400">Done {formatDate(row.completed_at)}</span>
	if (!row.due_at || row.stage === 'cancelled') return <span className="text-ink-400">—</span>
	return <span className={isOverdue(row) ? 'font-semibold text-mint-600' : 'text-ink-600'}>{dueText(row.due_at)}</span>
}

export default function AdminServiceOrders() {
	const [params, setParams] = useSearchParams()
	const view = VIEWS[params.get('view')] ? params.get('view') : 'unassigned'
	const [search, setSearch] = useState('')
	const [assigning, setAssigning] = useState(null)
	// One fetch of everything; the views are client-side filters over at most 200 rows.
	const { data: rows = [], isLoading } = useQuery({
		queryKey: ['admin-service-bookings', 'all'],
		queryFn: () => servicesApi.adminBookings({}).then(res => res.data.data || []),
		refetchInterval: 30_000,
	})

	const counts = useMemo(() => Object.fromEntries(Object.entries(VIEWS).map(([key, v]) => [key, rows.filter(v.match).length])), [rows])
	const visible = useMemo(() => {
		const q = search.trim().toLowerCase()
		return rows.filter(VIEWS[view].match).filter(row => !q || [row.booking_number, row.snapshot?.title, row.client_name, row.freelancer_name]
			.some(text => String(text || '').toLowerCase().includes(q)))
	}, [rows, view, search])

	const setView = next => setParams(prev => { const p = new URLSearchParams(prev); p.set('view', next); return p }, { replace: true })

	return (
		<AdminPage wide>
			<PageHeader
				title="Orders"
				description="Paid orders are auto-assigned to an opted-in, KYC-approved freelancer. Anything nobody could take waits in Needs a freelancer."
			/>

			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
					<Tabs items={Object.entries(VIEWS).map(([value, v]) => ({ value, label: v.label, count: counts[value] }))} value={view} onChange={setView} />
				</div>
				<label className="relative block md:w-72">
					<span className="sr-only">Search orders</span>
					<Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
					<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Order number, service or person" className="h-9 w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-mint-400 focus:outline-none" />
				</label>
			</div>

			<Panel>
				{isLoading ? <SkeletonRows rows={5} /> : visible.length === 0 ? (
					<EmptyState
						title={search ? 'No orders match that search' : view === 'unassigned' ? 'Every paid order has a freelancer' : 'No orders here yet'}
						body={search ? 'Try the order number, like CRV-10006.' : view === 'unassigned' ? 'If auto-assign finds nobody eligible, the order lands here for you to assign by hand.' : 'Orders appear once a client pays at checkout.'}
					/>
				) : (
					<>
						{/* Phones: one row per order */}
						<div className="divide-y divide-ink-100 md:hidden">
							{visible.map(row => (
								<div key={row.id} className="flex items-start gap-3 px-4 py-3">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 text-xs text-ink-500"><span className="font-semibold tabular-nums text-ink-700">{row.booking_number}</span><StageBadge stage={row.stage} /></div>
										<div className="mt-1 truncate text-sm font-semibold text-ink-900">{row.snapshot?.title}</div>
										<div className="truncate text-xs text-ink-500">{row.client_name} → {row.freelancer_name || 'unassigned'}</div>
										<div className="mt-1 text-xs"><DueCell row={row} /></div>
									</div>
									<div className="flex shrink-0 flex-col items-end gap-2">
										<span className="text-sm font-semibold tabular-nums text-ink-900">{inr(row.subtotal)}</span>
										{row.assignment_status === 'unassigned' && <button type="button" className="btn primary sm" onClick={() => setAssigning(row)}>Assign</button>}
									</div>
								</div>
							))}
						</div>

						<div className="hidden overflow-x-auto md:block">
							<table className="w-full min-w-[880px] text-sm">
								<thead>
									<tr className="border-b border-ink-100 text-left text-xs text-ink-500">
										<th className="px-5 py-2.5 font-medium">Order</th>
										<th className="py-2.5 font-medium">Service</th>
										<th className="py-2.5 font-medium">Client</th>
										<th className="py-2.5 font-medium">Freelancer</th>
										<th className="py-2.5 font-medium">Stage</th>
										<th className="py-2.5 font-medium">Due</th>
										<th className="py-2.5 text-right font-medium">Amount</th>
										<th className="w-28 py-2.5 pr-5" />
									</tr>
								</thead>
								<tbody className="divide-y divide-ink-100">
									{visible.map(row => (
										<tr key={row.id} className="transition-colors hover:bg-ink-50/70">
											<td className="px-5 py-3 font-semibold tabular-nums text-ink-700">{row.booking_number}<div className="text-xs font-normal text-ink-400">{formatDate(row.paid_at)}</div></td>
											<td className="py-3 pr-4"><div className="max-w-[260px] truncate font-semibold text-ink-900">{row.snapshot?.title}</div><div className="text-xs text-ink-500">{variantLabel(row.snapshot || {}, row.snapshot?.option_group_label)}{Number(row.quantity) > 1 ? ` × ${row.quantity}` : ''}</div></td>
											<td className="py-3 pr-4 text-ink-700">{row.client_name}</td>
											<td className="py-3 pr-4">{row.freelancer_name ? <span className="text-ink-700">{row.freelancer_name}</span> : <span className="text-ink-400">Not assigned</span>}</td>
											<td className="py-3 pr-4"><StageBadge stage={row.stage} /></td>
											<td className="py-3 pr-4 text-xs"><DueCell row={row} /></td>
											<td className="py-3 text-right tabular-nums"><div className="font-semibold text-ink-900">{inr(row.subtotal)}</div><div className="text-xs text-ink-400">payout {inr(row.freelancer_payout)}</div></td>
											<td className="py-3 pr-5 text-right">{row.assignment_status === 'unassigned' && <button type="button" className="btn primary sm" onClick={() => setAssigning(row)}>Assign</button>}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
			</Panel>
			{assigning && <AssignModal booking={assigning} onClose={() => setAssigning(null)} />}
		</AdminPage>
	)
}
