import { useLayoutEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { servicesApi } from '../../api/services'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import StageBadge from '../../components/services/StageBadge'
import OrderConversation from '../../components/services/OrderConversation'
import OrderDetailsPane from '../../components/services/OrderDetailsPane'
import { variantLabel } from '../../components/services/serviceUtils'


/**
 * Sizes the conversation panel to run from where it starts down to the bottom
 * of the screen (above the mobile tab bar), whatever header the shell has.
 */
function useFillHeight(ref, active) {
	useLayoutEffect(() => {
		const el = ref.current
		if (!el || !active) return
		const fit = () => {
			// The shell's <main> pads its bottom by exactly the mobile tab bar's height.
			const main = el.closest('main')
			const bottomBar = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0
			const gap = window.matchMedia('(min-width: 768px)').matches ? 24 : 0
			const top = el.getBoundingClientRect().top + window.scrollY
			el.style.height = `${Math.max(320,window.innerHeight - top - bottomBar - gap)}px`
		}
		fit()
		window.addEventListener('resize', fit)
		return () => window.removeEventListener('resize', fit)
	}, [ref, active])
}

/** Order workspace for clients (/orders/:id) and freelancers (/work/:id). */
export default function OrderDetail({ audience = 'client' }) {
	const { id } = useParams()
	const isClient = audience === 'client'
	const queryClient = useQueryClient()
	const [tab, setTab] = useState('chat')
	const chatPanel = useRef(null)

	const queryKey = ['service-booking', audience, id]
	const { data: booking, isLoading, isError } = useQuery({
		queryKey,
		queryFn: () => (isClient ? servicesApi.booking(id) : servicesApi.workItem(id)).then(res => res.data.data),
		refetchInterval: 20_000,
	})
	useFillHeight(chatPanel, Boolean(booking) && tab === 'chat')

	if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10"><div className="h-64 animate-pulse rounded-2xl bg-ink-100" /></div>
	if (isError || !booking) {
		return (
			<div className="mx-auto max-w-xl px-4 py-16 text-center">
				<h1 className="text-xl font-bold text-ink-900">Order not found</h1>
				<Link to={isClient ? '/orders' : '/work'} className="btn primary mt-4">Back to {isClient ? 'orders' : 'work'}</Link>
			</div>
		)
	}

	// Orders with a chat live in Messages, where the details sit beside the conversation.
	if (isClient) return <Navigate to={booking.room_id ? `/chat?room=${booking.room_id}` : `/chat?job=${booking.job_id}`} replace />
	if (booking.room_id) return <Navigate to={`/chat?room=${booking.room_id}`} replace />

	const snapshot = booking.snapshot || {}
	const counterpart = isClient
		? { name: booking.freelancer_name, avatar: booking.freelancer_avatar, label: 'Your freelancer' }
		: { name: booking.client_name, avatar: booking.client_avatar, label: 'Client' }
	const refresh = () => {
		queryClient.invalidateQueries({ queryKey })
		queryClient.invalidateQueries({ queryKey: ['service-bookings'] })
	}

	const details = (
		<OrderDetailsPane booking={booking} snapshot={snapshot} isClient={isClient} counterpart={counterpart} onMessage={() => setTab('chat')} />
	)

	const conversationHeader = (
		<div className="relative z-[2] flex items-center gap-2.5 bg-[#f6f6f6] px-2 py-2 shadow-[0_0.5px_0_#a6a6aa] md:px-3">
			<Link to={isClient ? '/orders' : '/work'} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-mint-600 hover:bg-black/5" aria-label={isClient ? 'Back to my orders' : 'Back to my work'}>
				<Icon name="chevronLeft" size={22} />
			</Link>
			{counterpart.name ? <Avatar name={counterpart.name} src={counterpart.avatar} size="md" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-ink-100 text-ink-500"><Icon name="clock" size={14} /></span>}
			<div className="min-w-0 flex-1">
				<div className="truncate text-[16px] font-semibold leading-tight text-black">{counterpart.name || 'Assigning a freelancer…'}</div>
				<div className="truncate text-[12px] text-[#8e8e93]">{booking.booking_number} · {snapshot.title} · {variantLabel(snapshot, snapshot.option_group_label)}{Number(booking.quantity) > 1 ? ` × ${booking.quantity}` : ''}</div>
			</div>
			<StageBadge stage={booking.stage} />
		</div>
	)

	return (
		<div className="mx-auto w-full max-w-6xl px-0 md:px-6 md:py-6">
			{/* Phones show one pane at a time; larger screens keep the details beside the conversation. */}
			<div className="flex gap-1 border-b border-ink-100 bg-white px-3 py-2 md:hidden" role="tablist">
				{[['chat', 'Conversation'], ['details', 'Order details']].map(([value, label]) => (
					<button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
						className={`h-8 flex-1 rounded-full text-sm font-medium transition-colors ${tab === value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'}`}>
						{label}
					</button>
				))}
			</div>
			<div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
				<section ref={chatPanel} className={`${tab === 'chat' ? 'flex' : 'hidden'} flex-col overflow-hidden bg-white md:flex md:rounded-2xl md:border md:border-ink-200`}>
					<OrderConversation
						booking={booking}
						role={audience}
						counterpartName={counterpart.name}
						counterpartAvatar={counterpart.avatar}
						onChanged={refresh}
						header={conversationHeader}
						className="flex-1"
					/>
				</section>
				<aside className={`${tab === 'details' ? 'block' : 'hidden'} md:sticky md:top-[88px] md:block md:self-start`}>{details}</aside>
			</div>
		</div>
	)
}
