import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { aiEditsApi } from '../../api/aiEdits'
import { useAuthStore } from '../../store/auth'
import Icon from '../../components/ui/Icon'
import { inr } from '../../components/services/serviceUtils'
import HelperEditor from '../../components/services/aiEditor/HelperEditor'
import { openRazorpayCheckout } from '../../utils/razorpay'
import { referenceCover } from '../../components/storefront/referencePhotos'

const press = 'transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]'

/** Before payment, the block the screen exists for. */
function PayStep({ edit, paying, error, onPay }) {
	const many = edit.videos > 1
	return (
		<section className="rounded-2xl bg-white p-5 md:p-7">
			<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<div className="min-w-0">
					<h2 className="text-xl font-medium text-ink-900">Pay once, then the editor makes your reel</h2>
					<p className="mt-1.5 max-w-[52ch] text-[15px] text-ink-600">
						It plans, cuts, captions and renders {many ? `${edit.videos} reels` : 'the reel'} on your computer. One round of changes is included.
					</p>
					<dl className="mt-5 grid max-w-xs gap-1.5 text-[15px]">
						<div className="flex justify-between"><dt className="text-ink-600">{edit.videos} video{many ? 's' : ''}</dt><dd className="tabular-nums text-ink-900">{inr(edit.subtotal)}</dd></div>
						<div className="flex justify-between"><dt className="text-ink-600">GST</dt><dd className="tabular-nums text-ink-900">{inr(edit.gst_amount)}</dd></div>
						<div className="flex justify-between pt-1.5 font-semibold"><dt className="text-ink-900">Total</dt><dd className="tabular-nums text-ink-900">{inr(edit.total)}</dd></div>
					</dl>
				</div>
				<div className="shrink-0 md:text-right">
					<button onClick={onPay} disabled={paying} className={`ai-make-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-ink-950 disabled:opacity-60 md:w-auto ${press}`}>
						{paying ? 'Opening payment…' : `Pay ${inr(edit.total)}`}
					</button>
					{error && <p className="mt-3 text-[15px] text-red-700" role="alert">{error}</p>}
				</div>
			</div>
		</section>
	)
}

/** One AI edit: pay here, then drive the Creatyv helper on this computer from this page. */
export default function AiEdit() {
	const { id } = useParams()
	const user = useAuthStore(s => s.user)
	const queryClient = useQueryClient()
	const [paying, setPaying] = useState(false)
	const [error, setError] = useState('')

	const { data: edit, isLoading, isError } = useQuery({
		queryKey: ['ai-edit', id],
		queryFn: () => aiEditsApi.get(id).then(res => res.data.data),
	})

	if (isLoading) {
		return (
			<div className="mx-auto w-full max-w-[960px] px-4 py-6 font-store md:px-8 md:py-10">
				<div className="h-5 w-28 animate-pulse rounded bg-ink-100" />
				<div className="mt-6 h-9 w-2/3 animate-pulse rounded-lg bg-ink-100" />
				<div className="mt-8 h-56 animate-pulse rounded-2xl bg-ink-100" />
			</div>
		)
	}
	if (isError || !edit) {
		return (
			<div className="mx-auto max-w-xl px-4 py-20 text-center font-store">
				<h1 className="text-2xl font-medium text-ink-900">This AI edit isn't available</h1>
				<p className="mt-2 text-ink-600">It may belong to another account, or the link is incomplete.</p>
				<Link to="/dashboard" className={`mt-5 inline-flex h-11 items-center rounded-full bg-ink-900 px-6 font-medium text-white ${press}`}>Back to home</Link>
			</div>
		)
	}

	const paid = edit.status === 'paid'
	const cover = edit.cover_url || referenceCover(edit.template_slug)
	const many = edit.videos > 1
	const option = edit.option_label && edit.option_label !== 'Standard' ? edit.option_label : null
	const status = paid ? 'Paid' : `Not paid yet · ${inr(edit.total)} with GST`

	const pay = async () => {
		setError('')
		setPaying(true)
		try {
			const res = await aiEditsApi.pay(id)
			const order = res.data.data
			let updated = order.ai_edit
			if (order.checkout_mode === 'order') {
				const payload = await openRazorpayCheckout({
					order,
					description: `AI edit: ${edit.title}`,
					prefill: { name: user?.full_name, email: user?.email, contact: user?.phone },
				})
				updated = (await aiEditsApi.verify(id, payload)).data.data
			}
			queryClient.setQueryData(['ai-edit', id], updated)
			queryClient.invalidateQueries({ queryKey: ['ai-edits'] })
		} catch (err) {
			if (!err?.dismissed) setError(err?.reason || err?.response?.data?.message || 'The payment did not go through. Nothing was charged; try again.')
		}
		setPaying(false)
	}

	return (
		<div className="mx-auto w-full max-w-[960px] px-4 py-6 font-store md:px-8 md:py-10">
			<Link to="/dashboard" className="inline-flex items-center gap-1.5 text-[15px] text-ink-700 underline-offset-4 hover:text-ink-950 hover:underline">
				<Icon name="arrowLeft" size={16} /> Edit with AI
			</Link>

			<header className="mt-5 flex items-center gap-5">
				{cover && <img src={cover} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover md:h-[72px] md:w-[72px]" />}
				<div className="min-w-0">
					<h1 className="text-[26px] font-medium leading-tight tracking-[-0.02em] text-ink-950 md:text-[32px]">{edit.title}</h1>
					<p className="mt-1 text-[15px] text-ink-600">
						{[option, `${edit.videos} video${many ? 's' : ''}`].filter(Boolean).join(' · ')}
						<span className="text-ink-300"> · </span>
						<span className="text-ink-900">{status}</span>
					</p>
				</div>
			</header>

			<div className="mt-8">
				{paid ? <HelperEditor edit={edit} /> : <PayStep edit={edit} paying={paying} error={error} onPay={pay} />}
			</div>

			{!paid && (
				<section className="mt-10">
					<h2 className="text-xl font-medium text-ink-900">How it works</h2>
					<ol className="mt-4 grid gap-6 md:grid-cols-3 md:gap-8">
						<li>
							<h3 className="font-medium text-ink-900">Install the Creatyv helper, once</h3>
							<p className="mt-1 text-[15px] text-ink-600">A small download that runs in the background. It edits and renders on your computer, so your footage is never uploaded.</p>
						</li>
						<li>
							<h3 className="font-medium text-ink-900">Add footage and a brief here</h3>
							<p className="mt-1 text-[15px] text-ink-600">Main footage, B-roll, reference edits, music and brand files, plus what the reel should do. You approve an outline before anything renders.</p>
						</li>
						<li>
							<h3 className="font-medium text-ink-900">Get the reel</h3>
							<p className="mt-1 text-[15px] text-ink-600">Watch it on this page. The finished file is saved on your computer.</p>
						</li>
					</ol>
				</section>
			)}

			{edit.template_slug && (
				<p className="mt-10 text-[15px] text-ink-600">
					Rather have a person edit it?{' '}
					<Link to={`/services/${edit.template_slug}`} className="font-medium text-ink-900 underline underline-offset-4 hover:decoration-2">Hire a freelancer</Link>
				</p>
			)}
		</div>
	)
}
