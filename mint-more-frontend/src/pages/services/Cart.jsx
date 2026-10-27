import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import { cartTotals, GST_RATE, useCartStore } from '../../store/cart'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { openRazorpayCheckout } from '../../utils/razorpay'
import { ServiceCover } from '../../components/services/ServiceCard'
import Icon from '../../components/ui/Icon'
import { deliveryText, inr, variantLabel } from '../../components/services/serviceUtils'

const GSTIN_PATTERN = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/

export default function Cart() {
	const navigate = useNavigate()
	const queryClient = useQueryClient()
	const { items, updateItem, removeItem, clear } = useCartStore()
	const user = useAuthStore(s => s.user)
	const isAuthed = useAuthStore(s => s.isAuthed)
	const pushToast = useUIStore(s => s.pushToast)
	const [wantsGst, setWantsGst] = useState(false)
	const [gstin, setGstin] = useState('')
	const [paying, setPaying] = useState(false)
	const [error, setError] = useState('')
	const idempotencyRef = useRef(null)

	const isClient = isAuthed && user?.role === 'client'
	const { data: pastFreelancers = [] } = useQuery({
		queryKey: ['past-freelancers'],
		queryFn: () => servicesApi.pastFreelancers().then(res => res.data.data),
		enabled: isClient,
	})

	const totals = cartTotals(items)
	const gstinValue = gstin.trim().toUpperCase()
	const gstinInvalid = wantsGst && gstinValue && !GSTIN_PATTERN.test(gstinValue)

	const checkout = async () => {
		if (!isClient) {
			navigate(`/login?next=${encodeURIComponent('/cart')}`)
			return
		}
		if (wantsGst && !GSTIN_PATTERN.test(gstinValue)) {
			setError('Enter a valid 15-character GSTIN or untick the GST invoice option.')
			return
		}
		setError('')
		setPaying(true)
		if (!idempotencyRef.current) idempotencyRef.current = crypto.randomUUID()
		try {
			const res = await servicesApi.checkout({
				items: items.map(item => ({
					variant_id: item.variant_id,
					quantity: item.quantity,
					instructions: item.instructions?.trim() || undefined,
					preferred_freelancer_id: item.preferred_freelancer_id || undefined,
				})),
				gstin: wantsGst ? gstinValue : undefined,
				idempotency_key: idempotencyRef.current,
			})
			const order = res.data.data
			let verifyPayload = {}
			if (order.checkout_mode !== 'mock') {
				verifyPayload = await openRazorpayCheckout({
					order,
					description: items.length > 1 ? `${items.length} services` : items[0].title,
					prefill: { name: user?.full_name, email: user?.email, contact: user?.phone },
				})
			}
			const verified = await servicesApi.verifyCheckout(order.checkout_id, verifyPayload)
			const bookingIds = verified.data.data.booking_ids || []
			clear()
			idempotencyRef.current = null
			queryClient.invalidateQueries({ queryKey: ['service-bookings'] })
			pushToast({
				title: 'Payment successful',
				body: order.checkout_mode === 'mock' ? 'Test checkout: no money was charged.' : 'Your freelancer is being assigned now.',
				icon: 'check',
			})
			navigate(bookingIds.length === 1 ? `/orders/${bookingIds[0]}` : '/orders', { state: { placed: bookingIds.length } })
		} catch (err) {
			if (err?.dismissed) setError('Payment was cancelled. Your cart is saved, so you can try again.')
			else if (err?.failed) setError(err.reason || 'Payment failed. No money was taken, so you can try again.')
			else setError(err?.response?.data?.errors?.join(' ') || err?.response?.data?.message || 'Checkout failed. Please try again.')
		} finally {
			setPaying(false)
		}
	}

	if (items.length === 0) {
		return (
			<div className="mx-auto w-full max-w-5xl px-4 py-10 font-store md:px-8 md:py-12">
				<h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">Your cart</h1>
				<div className="mt-8 rounded-2xl border border-ink-200 bg-white p-12 text-center">
					<h2 className="text-xl font-medium text-ink-900">Your cart is empty</h2>
					<p className="mt-1 text-ink-600">Browse fixed-price services and add what you need.</p>
					<Link to="/services" className="landing-cta mt-6 gap-1.5 !min-h-11 !px-5 !text-[15px]">
						Browse services <Icon name="arrowRight" size={16} />
					</Link>
				</div>
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-4 py-8 font-store md:px-8 md:py-10">
			<h1 className="text-3xl font-medium tracking-tight text-ink-900 md:text-[40px]">Your cart</h1>
			<p className="mt-2 text-ink-600">{items.length} {items.length === 1 ? 'service' : 'services'} · your payment is held until you approve the work.</p>

			<div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
				<div className="space-y-4">
					{items.map(item => (
						<div key={item.variant_id} className="rounded-2xl border border-ink-200 bg-white p-4 md:p-5">
							<div className="flex gap-4">
								<Link to={`/services/${item.slug}`} className="h-[72px] w-[108px] shrink-0 overflow-hidden rounded-xl bg-ink-50">
									<ServiceCover service={item} />
								</Link>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<Link to={`/services/${item.slug}`} className="line-clamp-1 text-[17px] font-medium text-ink-900 hover:underline">{item.title}</Link>
											<div className="mt-0.5 text-sm text-ink-500">{variantLabel(item, item.option_group_label)} · {deliveryText(item.delivery_days)} · {item.revisions} revisions</div>
										</div>
										<button className="icon-btn shrink-0 text-ink-500 hover:text-rose-600" onClick={() => removeItem(item.variant_id)} aria-label={`Remove ${item.title}`}>
											<Icon name="trash" size={16} />
										</button>
									</div>
									<div className="mt-3 flex items-center justify-between">
										<div className="flex items-center rounded-xl border border-ink-200">
											<button className="px-3 py-1.5 text-lg leading-none text-ink-700 disabled:opacity-30" disabled={item.quantity <= 1} onClick={() => updateItem(item.variant_id, { quantity: item.quantity - 1 })} aria-label="Decrease quantity">−</button>
											<span className="w-8 text-center text-[15px] font-medium tabular-nums">{item.quantity}</span>
											<button className="px-3 py-1.5 text-lg leading-none text-ink-700 disabled:opacity-30" disabled={item.quantity >= 20} onClick={() => updateItem(item.variant_id, { quantity: item.quantity + 1 })} aria-label="Increase quantity">+</button>
										</div>
										<div className="text-right">
											<div className="text-[17px] font-semibold tabular-nums text-ink-900">{inr(item.unit_price * item.quantity)}</div>
											{item.mrp > item.unit_price && <div className="text-sm tabular-nums text-ink-500 line-through">{inr(item.mrp * item.quantity)}</div>}
										</div>
									</div>
								</div>
							</div>
							<textarea
								rows={2}
								value={item.instructions || ''}
								onChange={e => updateItem(item.variant_id, { instructions: e.target.value })}
								placeholder="Instructions for the freelancer (optional). You can also share files in chat after payment."
								className="mt-4 w-full resize-none rounded-xl border border-ink-200 px-3.5 py-2.5 text-[15px] text-ink-900 placeholder:text-ink-500 focus:border-ink-400 focus:outline-none"
							/>
							{pastFreelancers.length > 0 && (
								<label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-600">
									Rebook a freelancer you've worked with
									<select
										value={item.preferred_freelancer_id || ''}
										onChange={e => updateItem(item.variant_id, { preferred_freelancer_id: e.target.value || null })}
										className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 focus:border-ink-400 focus:outline-none"
									>
										<option value="">Best available</option>
										{pastFreelancers.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
									</select>
								</label>
							)}
						</div>
					))}

					<Link to="/services" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-ink-900 hover:underline">
						<Icon name="plus" size={16} /> Add another service
					</Link>
				</div>

				<aside className="lg:sticky lg:top-6 lg:self-start">
					<div className="rounded-2xl border border-ink-200 bg-white p-5 md:p-6">
						<h2 className="text-lg font-medium text-ink-900">Price details</h2>
						<dl className="mt-4 space-y-2.5 text-[15px]">
							{totals.savings > 0 && (
								<div className="flex justify-between text-ink-500"><dt>MRP total</dt><dd className="tabular-nums line-through">{inr(totals.mrpTotal)}</dd></div>
							)}
							<div className="flex justify-between"><dt className="text-ink-600">Item total</dt><dd className="font-medium tabular-nums text-ink-900">{inr(totals.itemTotal)}</dd></div>
							<div className="flex justify-between"><dt className="text-ink-600">GST ({GST_RATE}%)</dt><dd className="tabular-nums text-ink-900">{inr(totals.gst)}</dd></div>
							<div className="mt-1 flex items-baseline justify-between border-t border-ink-200 pt-3">
								<dt className="text-[17px] font-medium text-ink-900">Amount to pay</dt>
								<dd className="text-xl font-semibold tabular-nums text-ink-900">{inr(totals.total)}</dd>
							</div>
						</dl>
						{totals.savings > 0 && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">You save {inr(totals.savings)} on this order</div>}

						<label className="mt-5 flex items-center gap-2.5 text-[15px] text-ink-700">
							<input type="checkbox" className="h-4 w-4 accent-ink-900" checked={wantsGst} onChange={e => setWantsGst(e.target.checked)} />
							I need a GST invoice
						</label>
						{wantsGst && (
							<input
								value={gstin}
								onChange={e => setGstin(e.target.value)}
								maxLength={15}
								placeholder="15-character GSTIN"
								className={`mt-2.5 w-full rounded-xl border px-3.5 py-2.5 text-[15px] uppercase placeholder:normal-case placeholder:text-ink-500 focus:outline-none ${gstinInvalid ? 'border-rose-400' : 'border-ink-200 focus:border-ink-400'}`}
							/>
						)}
						{gstinInvalid && <p className="mt-1.5 text-sm text-rose-600">Enter a valid 15-character GSTIN.</p>}

						{error && <div className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{error}</div>}

						<button
							className="landing-cta mt-5 w-full justify-center !min-h-12 !text-base disabled:cursor-not-allowed disabled:opacity-50"
							disabled={paying || (isAuthed && !isClient)}
							onClick={checkout}
						>
							{paying ? 'Processing…' : isClient ? `Pay ${inr(totals.total)}` : 'Sign in to checkout'}
						</button>
						{isAuthed && user?.role !== 'client' && <p className="mt-2 text-sm text-ink-500">Only client accounts can place orders.</p>}
						<p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-ink-500">
							<Icon name="shield" size={14} /> Secure payment via Razorpay
						</p>
					</div>
				</aside>
			</div>
		</div>
	)
}
