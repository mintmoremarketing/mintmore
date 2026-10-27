// Ask-anything copy for the storefront (the landing page keeps its own in pages/public/landing/landingContent.js).

export const STORE_ASK_INTRO = 'Ask me about our services, prices, delivery times, revisions, or how to reach the team.'

export const storeQuickQuestions = [
	'How does booking work?',
	'How fast is delivery?',
	'Can I ask for revisions?',
	'Contact the team',
]

export const storeLocalAnswer = question => {
	const text = String(question || '').toLowerCase()
	if (['contact', 'team', 'call', 'phone', 'email', 'support'].some(key => text.includes(key))) return 'You can contact the Mint More team at agency@mintmoremarketing.com or call 8092282114.'
	if (text.includes('revision') || text.includes('change')) return 'Every service includes a fixed number of revisions, shown on its page. You approve the work only when you are happy with it.'
	if (text.includes('deliver') || text.includes('fast') || text.includes('time')) return 'Each service shows its delivery time before you book. Many are delivered in one or two days.'
	if (text.includes('price') || text.includes('cost') || text.includes('pay')) return 'Every service has a fixed price shown upfront, plus 18% GST at checkout. Your payment is held until you approve the delivery.'
	if (text.includes('freelancer') || text.includes('who')) return 'A vetted freelancer is assigned to your order as soon as you pay, and a chat opens so you can share files.'
	return 'Pick a service, choose the option you need and pay. A vetted freelancer is assigned instantly, and you approve the work before payment is released.'
}
