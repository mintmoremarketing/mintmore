import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'
import { useCartStore } from '../../store/cart'
import Icon from '../ui/Icon'
import AppShell from './AppShell'
import AskAnythingWidget from '../../pages/public/landing/AskAnythingWidget'
import { STORE_ASK_INTRO, storeLocalAnswer, storeQuickQuestions } from '../storefront/storeAsk'

const TICKER = 'Creatyv is live. Book reels, thumbnails and designs at fixed prices, with a freelancer assigned instantly.'

const STORE_NAV = [
	{ to: '/categories/video-editing', label: 'Video Editing' },
	{ to: '/categories/design', label: 'Design' },
	{ to: '/categories/ai-service', label: 'AI Services' },
	{ to: '/categories/content-writing', label: 'Writing' },
]

function StoreTicker() {
	return (
		<div className="landing-announcement" role="status" aria-label={TICKER}>
			<div className="landing-announcement-track">
				<div className="landing-announcement-group">
					<span>{TICKER}</span>
					<span aria-hidden="true">{TICKER}</span>
				</div>
				<div className="landing-announcement-group" aria-hidden="true">
					<span>{TICKER}</span>
					<span>{TICKER}</span>
				</div>
			</div>
		</div>
	)
}

// The Ask bar floats in once the visitor scrolls, and steps aside for the footer.
function useAskVisible(footerRef) {
	const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 120)
	const [footerVisible, setFooterVisible] = useState(false)
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > Math.min(window.innerHeight * 0.14, 120))
		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	}, [])
	useEffect(() => {
		if (!footerRef.current) return undefined
		const observer = new IntersectionObserver(([entry]) => setFooterVisible(Boolean(entry?.isIntersecting)), { rootMargin: '0px 0px 180px 0px', threshold: 0.01 })
		observer.observe(footerRef.current)
		return () => observer.disconnect()
	}, [footerRef])
	return scrolled && !footerVisible
}

export function StoreSearch({ className = '' }) {
	const navigate = useNavigate()
	const [params] = useSearchParams()
	const [q, setQ] = useState(params.get('q') || '')
	return (
		<form
			role="search"
			className={`flex items-center rounded-2xl border border-ink-200 bg-white px-5 font-store ${className}`}
			onSubmit={(event) => { event.preventDefault(); navigate(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : '/search') }}
		>
			<input
				value={q}
				onChange={event => setQ(event.target.value)}
				placeholder="Search by service, category…"
				aria-label="Search services"
				className="h-12 min-w-0 flex-1 bg-transparent text-[17px] text-ink-900 placeholder:text-ink-500 focus:outline-none"
			/>
			<button type="submit" aria-label="Search" className="text-ink-500"><Icon name="search" size={20} /></button>
		</form>
	)
}

/** Catalogue and cart are browsable logged out; signed-in users get the normal shell. */
export default function PublicOrShell() {
	const isAuthed = useAuthStore(s => s.isAuthed)
	const cartCount = useCartStore(s => s.items.reduce((sum, item) => sum + item.quantity, 0))
	const location = useLocation()
	const footerRef = useRef(null)
	const askVisible = useAskVisible(footerRef)
	if (isAuthed) return <AppShell />

	const next = encodeURIComponent(location.pathname + location.search)
	// Service pages and the cart have their own bottom bars, so the Ask bar stays off there.
	const showAsk = !/^\/(services\/[^/]+|cart)/.test(location.pathname)
	return (
		<div className="store-public min-h-screen bg-white">
			<StoreTicker />
			<nav className="landing-nav" aria-label="Main">
				<Link to="/" className="landing-logo">CREATYV <span>by Mint More Marketing</span></Link>
				<div className="landing-links">
					{STORE_NAV.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}
				</div>
				<div className="landing-nav-actions">
					<Link to="/cart" className="store-nav-cart" aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}>
						<Icon name="shoppingBag" size={20} />
						{cartCount > 0 && <span key={cartCount} className="notif-badge cart-badge">{cartCount > 9 ? '9+' : cartCount}</span>}
					</Link>
					<Link to={`/login?next=${next}`} className="landing-login">Log In</Link>
					<Link to={`/register?next=${next}`} className="landing-cta">Start for Free</Link>
				</div>
			</nav>
			<div className="store-nav-spacer" aria-hidden="true" />
			<div className="mx-auto max-w-[1400px] px-4 md:px-8"><StoreSearch className="mx-auto max-w-2xl" /></div>
			<main><Outlet /></main>
			<footer ref={footerRef} className="mt-16 border-t border-ink-200 bg-ink-50 font-store">
				<div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-12 md:grid-cols-4 md:px-8">
					<div>
						<div className="text-2xl font-semibold text-ink-900">creatyv</div>
						<p className="mt-2 text-ink-600">Creative work, booked in seconds.</p>
					</div>
					<div>
						<h3 className="mb-3 font-medium text-ink-900">Services</h3>
						<ul className="space-y-2 text-ink-600">
							<li><Link to="/categories/video-editing">Video Editing</Link></li>
							<li><Link to="/categories/design">Design</Link></li>
							<li><Link to="/categories/ai-service">AI Services</Link></li>
							<li><Link to="/categories/content-writing">Content Writing</Link></li>
						</ul>
					</div>
					<div>
						<h3 className="mb-3 font-medium text-ink-900">Support</h3>
						<ul className="space-y-2 text-ink-600">
							<li><Link to="/contact-support-policy">Contact Us</Link></li>
							<li><Link to="/privacy">Privacy Policy</Link></li>
							<li><Link to="/terms">Terms &amp; Conditions</Link></li>
							<li><Link to="/refund-cancellation-policy">Refund Policy</Link></li>
						</ul>
					</div>
					<div>
						<h3 className="mb-3 font-medium text-ink-900">Freelancers</h3>
						<ul className="space-y-2 text-ink-600">
							<li><Link to={`/register?next=${encodeURIComponent('/my-services')}`}>Join as a freelancer</Link></li>
						</ul>
					</div>
				</div>
			</footer>
			{showAsk && <AskAnythingWidget visible={askVisible} intro={STORE_ASK_INTRO} questions={storeQuickQuestions} fallback={storeLocalAnswer} audience="store" />}
		</div>
	)
}
