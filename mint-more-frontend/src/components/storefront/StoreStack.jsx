import { Link } from 'react-router-dom'
import ScrollStack, { ScrollStackItem } from '../landing/ScrollStack'

// The landing page's scroll-stacked cards, retold as the storefront's three steps plus a closing CTA.
const CARDS = [
	{ title: 'Pick a service', body: 'Reels, thumbnails, designs and scripts at a fixed price. The scope, revisions and delivery time are shown before you pay.', tone: 'orange' },
	{ title: 'Get a freelancer instantly', body: 'A vetted freelancer is assigned the moment you book, and a chat opens for your files and instructions.', tone: 'purple' },
	{ title: 'Approve, then they get paid', body: 'Ask for revisions until it is right. Your payment is held and released only when you approve.', tone: 'sand' },
	{ title: 'Your next reel is a tap away', body: 'Book creative work the way you order everything else: pick, pay, done.', tone: 'cta' },
]

export default function StoreStack() {
	return (
		<section id="how-it-works" className="store-stack" aria-label="How CREATYV works">
			<div className="store-stack-intro">
				<p>How it works</p>
				<h2>From booking to delivery, in three steps.</h2>
			</div>
			<ScrollStack
				itemDistance={28}
				itemScale={0}
				itemStackDistance={14}
				stackPosition="116px"
				scaleEndPosition="116px"
				baseScale={1}
				useWindowScroll
			>
				{CARDS.map((card, index) => (
					<ScrollStackItem key={card.title} itemClassName={`store-stack-card ${card.tone}`}>
						<span className="store-stack-index">{String(index + 1).padStart(2, '0')}</span>
						<h3>{card.title}</h3>
						<p>{card.body}</p>
						{card.tone === 'cta' && (
							<div className="store-stack-actions">
								<Link to="/categories/video-editing">Explore services</Link>
								<a href="mailto:agency@mintmoremarketing.com">Contact us</a>
							</div>
						)}
					</ScrollStackItem>
				))}
			</ScrollStack>
		</section>
	)
}
