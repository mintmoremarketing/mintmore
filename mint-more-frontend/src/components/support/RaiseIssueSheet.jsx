import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { disputesApi } from '../../api/disputes'
import { servicesApi } from '../../api/services'
import { useUIStore } from '../../store/ui'
import Icon from '../ui/Icon'

const REASONS = {
	client: ['Late delivery', 'Not what I asked for', 'Freelancer not responding', 'Quality issue', 'Something else'],
	freelancer: ['Client not responding', 'Scope changed after booking', 'Missing files or brief', 'Unfair revision requests', 'Something else'],
}

// Escrow can only be held while the order is still open.
const canDispute = (order) => order?.job_id && order.job_status === 'in_progress'

/**
 * Opens a dispute on an order. Support gets the order, its brief and the whole order chat
 * with the case, so the person only has to say what went wrong.
 * Pass `order` from a chat; leave it out to pick one of your open orders first.
 */
export default function RaiseIssueSheet({ order: given, jobId, role, onClose }) {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const pushToast = useUIStore(s => s.pushToast)
	const audience = role === 'client' ? 'client' : 'freelancer'
	const [picked, setPicked] = useState(null)
	const [reason, setReason] = useState('')
	const [details, setDetails] = useState('')
	const [touched, setTouched] = useState(false)
	const [cleared, setCleared] = useState(false)

	const { data: orders = [], isLoading } = useQuery({
		queryKey: ['service-bookings', audience],
		queryFn: () => (audience === 'client' ? servicesApi.bookings() : servicesApi.work()).then(res => res.data.data),
		enabled: !given,
	})
	const open = orders.filter(canDispute)
	// A link with ?jobId= starts on that order; Back still lets the person pick another.
	const order = given || picked || (!cleared && jobId ? orders.find(row => row.job_id === jobId) : null)

	useEffect(() => {
		const onKey = (e) => { if (e.key === 'Escape') onClose() }
		document.addEventListener('keydown', onKey)
		const overflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
	}, [onClose])

	const submit = useMutation({
		mutationFn: () => disputesApi.open(order.job_id, { reason, description: details.trim() }),
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ['disputes'] })
			pushToast({ title: 'Issue raised', body: 'Support has the order and chat. Payment stays on hold while they review.', icon: 'shield' })
			onClose()
			navigate(`/disputes?id=${res.data.data.dispute.id}`)
		},
		onError: err => pushToast({ title: 'Could not raise the issue', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' }),
	})

	const detailsShort = details.trim().length < 10
	const ready = order && reason && !detailsShort
	const onSubmit = (e) => {
		e.preventDefault()
		setTouched(true)
		if (ready && !submit.isPending) submit.mutate()
	}
	const title = order?.snapshot?.title || order?.template_title

	return (
		<div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 font-store md:items-stretch md:justify-end" onClick={onClose}>
			<form onSubmit={onSubmit} onClick={e => e.stopPropagation()} noValidate role="dialog" aria-modal="true" aria-labelledby="raise-issue-title" className="brief-sheet flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white md:max-h-none md:max-w-[520px] md:rounded-none">
				<div className="flex items-start gap-3 border-b border-ink-100 px-5 pb-4 pt-5">
					<div className="min-w-0 flex-1">
						<h2 id="raise-issue-title" className="text-xl font-medium tracking-tight text-ink-900">Raise an issue</h2>
						<p className="mt-0.5 truncate text-sm text-ink-500">{order ? `${order.booking_number} · ${title}` : 'Choose the order this is about'}</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900">
						<Icon name="x" size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-5 py-5">
					{order && !canDispute(order) ? (
						<div className="rounded-2xl bg-ink-50 p-5">
							<h3 className="text-[17px] font-medium text-ink-900">This order is already closed</h3>
							<p className="mt-1 text-[15px] text-ink-600">Payment for it has been settled, so it can't go into a dispute. Ask support instead and they'll look into it.</p>
							<button type="button" onClick={() => { onClose(); navigate('/support') }} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-900 px-4 text-[15px] font-medium text-white transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-700 active:scale-[0.97]">
								Ask support <Icon name="arrowRight" size={14} />
							</button>
						</div>
					) : !order ? (
						isLoading ? (
							<div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-ink-100" />)}</div>
						) : open.length === 0 ? (
							<div className="rounded-2xl bg-ink-50 p-5">
								<h3 className="text-[17px] font-medium text-ink-900">No open orders</h3>
								<p className="mt-1 text-[15px] text-ink-600">Issues can be raised on orders that are still in progress. For anything else, ask support.</p>
								<button type="button" onClick={() => { onClose(); navigate('/support') }} className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-900 px-4 text-[15px] font-medium text-white hover:bg-ink-700">Ask support <Icon name="arrowRight" size={14} /></button>
							</div>
						) : (
							<ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200">
								{open.map(row => (
									<li key={row.id}>
										<button type="button" onClick={() => setPicked(row)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink-50">
											<span className="min-w-0 flex-1">
												<span className="block truncate text-[16px] font-medium text-ink-900">{row.snapshot?.title}</span>
												<span className="block truncate text-sm text-ink-500">{row.booking_number} · {audience === 'client' ? row.freelancer_name || 'Your freelancer' : row.client_name}</span>
											</span>
											<Icon name="chevronRight" size={16} className="shrink-0 text-ink-400" />
										</button>
									</li>
								))}
							</ul>
						)
					) : (
						<>
							<fieldset>
								<legend className="text-[15px] font-medium text-ink-900">What went wrong?</legend>
								<div className="mt-2.5 flex flex-wrap gap-2">
									{REASONS[audience].map(item => (
										<button
											key={item}
											type="button"
											aria-pressed={reason === item}
											onClick={() => setReason(item)}
											className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] ${reason === item ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 text-ink-700 hover:border-ink-400'}`}
										>
											{item}
										</button>
									))}
								</div>
								{touched && !reason && <p className="mt-2 text-sm text-rose-600">Pick the closest reason.</p>}
							</fieldset>

							<label className="mt-6 block">
								<span className="text-[15px] font-medium text-ink-900">Tell support what happened</span>
								<textarea
									rows={5}
									value={details}
									onChange={e => setDetails(e.target.value)}
									placeholder="What you expected, what happened instead, and what would put it right."
									className={`mt-2 w-full resize-y rounded-xl border px-3.5 py-3 text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none ${touched && detailsShort ? 'border-rose-400' : 'border-ink-200 focus:border-ink-500'}`}
								/>
								{touched && detailsShort && <span className="mt-1 block text-sm text-rose-600">A sentence or two, at least 10 characters.</span>}
							</label>

							<div className="mt-6 rounded-2xl bg-ink-50 p-4">
								<h3 className="flex items-center gap-2 text-[15px] font-medium text-ink-900"><Icon name="shield" size={16} /> Support will see</h3>
								<ul className="mt-2 space-y-1.5 text-[15px] text-ink-700">
									<li>The order: scope, price, due date and the client's brief</li>
									<li>The full order chat, with every file and delivery</li>
									<li>What you write above</li>
								</ul>
								<p className="mt-3 text-sm text-ink-500">Payment stays on hold until support decides. Both of you are notified and can add to the case.</p>
							</div>
						</>
					)}
				</div>

				{order && canDispute(order) && (
					<div className="flex gap-2 border-t border-ink-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
						{!given && <button type="button" onClick={() => { setPicked(null); setCleared(true) }} className="h-11 rounded-xl border border-ink-200 px-4 text-[15px] font-medium text-ink-700 hover:bg-ink-50">Back</button>}
						<button type="submit" disabled={submit.isPending} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-900 px-5 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-ink-700 active:scale-[0.97] disabled:opacity-60">
							{submit.isPending ? 'Sending to support…' : 'Send to support'}
						</button>
					</div>
				)}
			</form>
		</div>
	)
}
