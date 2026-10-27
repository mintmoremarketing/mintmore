const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

function loadCheckoutScript() {
	if (window.Razorpay) return Promise.resolve()
	return new Promise((resolve, reject) => {
		const script = document.createElement('script')
		script.src = CHECKOUT_SRC
		script.onload = resolve
		script.onerror = () => reject(new Error('Could not load Razorpay checkout'))
		document.body.appendChild(script)
	})
}

/**
 * Opens Razorpay checkout for a backend-created order.
 * Resolves with the Razorpay response, rejects with { dismissed: true } if closed.
 */
export async function openRazorpayCheckout({ order, description, prefill }) {
	await loadCheckoutScript()
	return new Promise((resolve, reject) => {
		const rzp = new window.Razorpay({
			key: order.key_id,
			order_id: order.order_id,
			amount: order.amount_paise,
			currency: order.currency || 'INR',
			name: 'CREATYV',
			description,
			image: window.location.origin + '/logo-light.png',
			prefill,
			theme: { color: '#e83b03' },
			handler: resolve,
			modal: { ondismiss: () => reject({ dismissed: true }) },
		})
		rzp.on('payment.failed', (response) => reject({ failed: true, reason: response?.error?.description }))
		rzp.open()
	})
}
