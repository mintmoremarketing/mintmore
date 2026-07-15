import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { walletApi } from '../../api/wallet'
import { useUIStore } from '../../store/ui'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { rupee } from '../../utils/format'

const PACKAGES = [
  { id: 'starter', coins: 1000, price: 149, label: 'Starter' },
  { id: 'popular', coins: 10000, price: 999, label: 'Popular' },
  { id: 'pro', coins: 25000, price: 1999, label: 'Pro' }
]

export default function MintcoinModal({ onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const [selectedPkg, setSelectedPkg] = useState(PACKAGES[1]) // Default popular
	const [step, setStep] = useState('select')

	const { mutate, isPending } = useMutation({
		mutationFn: () => walletApi.createMintcoinOrder(selectedPkg.price, selectedPkg.coins),
		onSuccess: ({ data }) => {
			const order = data.data
			openRazorpay(order)
		},
		onError: (err) => {
			setStep('error')
			pushToast({
				title: 'Order creation failed',
				body: err.response?.data?.message || 'Try again',
				tone: 'amber',
				icon: 'x',
			})
		},
	})

	function openRazorpay(order) {
		if (!window.Razorpay) {
			const script = document.createElement('script')
			script.src = 'https://checkout.razorpay.com/v1/checkout.js'
			script.onload = () => launchCheckout(order)
			document.body.appendChild(script)
			return
		}
		launchCheckout(order)
	}

	function launchCheckout(order) {
		setStep('processing')
		const rzp = new window.Razorpay({
			key: order.key_id,
			amount: order.amount_paise,
			currency: 'INR',
			name: 'CREATYV AI',
			description: 'Mintcoin Recharge',
			order_id: order.order_id,
			theme: { color: '#8b5cf6' }, // Purple tone for AI
			handler: async (response) => {
				try {
					await walletApi.verifyPayment({
						razorpay_order_id: response.razorpay_order_id,
						razorpay_payment_id: response.razorpay_payment_id,
						razorpay_signature: response.razorpay_signature,
					})
					setStep('success')
					queryClient.invalidateQueries({ queryKey: ['wallet'] })
					queryClient.invalidateQueries({ queryKey: ['ai-usage'] })
					pushToast({
						title: `${selectedPkg.coins.toLocaleString('en-IN')} Mintcoins added!`,
						body: 'You can now generate more AI content',
						icon: 'check',
					})
					setTimeout(onClose, 1800)
				} catch {
					setStep('error')
					pushToast({
						title: 'Payment verification failed',
						body: 'Contact support if your money was deducted',
						tone: 'amber',
						icon: 'x',
					})
				}
			},
			modal: {
				ondismiss: () => {
					setStep('select')
				},
			},
		})
		rzp.open()
	}

	return (
		<Modal
			title="Recharge Mintcoins"
			subtitle="Tokens for AI image and video generation"
			onClose={onClose}
			maxWidth={420}
			footer={
				step === 'select' ? (
					<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
						<button className="btn ghost" onClick={onClose}>
							Cancel
						</button>
						<button
							className="btn primary"
							onClick={() => mutate()}
							disabled={isPending || !selectedPkg}
						>
							{isPending ? (
								'Creating order...'
							) : (
								<>
									Pay {rupee(selectedPkg?.price)} <Icon name="arrowRight" />
								</>
							)}
						</button>
					</div>
				) : null
			}
		>
			{step === 'select' && (
				<div className="stack" style={{ gap: 18 }}>
					<div>
						<div className="field-label" style={{ marginBottom: 8 }}>
							Choose a package
						</div>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(1, 1fr)',
								gap: 12,
							}}
						>
							{PACKAGES.map((p) => (
								<button
									key={p.id}
									onClick={() => setSelectedPkg(p)}
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										padding: '16px',
										background: selectedPkg?.id === p.id ? 'var(--ink-950)' : 'var(--paper-tint)',
										color: selectedPkg?.id === p.id ? 'white' : 'var(--ink-900)',
										border: `1.5px solid ${
											selectedPkg?.id === p.id ? 'var(--ink-950)' : 'var(--hairline)'
										}`,
										borderRadius: 'var(--radius-md)',
										cursor: 'pointer',
										transition: 'all 0.12s',
										textAlign: 'left'
									}}
								>
									<div>
										<div style={{ fontSize: 13, opacity: 0.8, marginBottom: 2, fontWeight: 500 }}>
											{p.label}
										</div>
										<div style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
											<Icon name="coin" size={16} /> {p.coins.toLocaleString('en-IN')}
										</div>
									</div>
									<div style={{ fontSize: 16, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
										{rupee(p.price)}
									</div>
								</button>
							))}
						</div>
					</div>

					<div
						style={{
							fontSize: 11.5,
							color: 'var(--ink-500)',
							display: 'flex',
							alignItems: 'center',
							gap: 4,
							justifyContent: 'center',
							marginTop: 8
						}}
					>
						<Icon name="shield" size={11} /> Secured by Razorpay - Instant access
					</div>
				</div>
			)}

			{step === 'processing' && (
				<div style={{ textAlign: 'center', padding: '32px 0' }}>
					<div
						className="typing-dots"
						style={{ justifyContent: 'center', marginBottom: 16 }}
					>
						<span />
						<span />
						<span />
					</div>
					<div style={{ fontSize: 15, fontWeight: 500 }}>
						Completing payment...
					</div>
					<div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 6 }}>
						Please complete the checkout
					</div>
				</div>
			)}

			{step === 'success' && (
				<div style={{ textAlign: 'center', padding: '32px 0' }}>
					<div
						style={{
							width: 52,
							height: 52,
							borderRadius: '50%',
							background: 'var(--mint-100)',
							color: 'var(--mint-700)',
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							marginBottom: 16,
						}}
					>
						<Icon name="check" size={22} strokeWidth={2.5} />
					</div>
					<div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
						{selectedPkg.coins.toLocaleString('en-IN')} Mintcoins added!
					</div>
					<div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
						Enjoy generating more AI content
					</div>
				</div>
			)}

			{step === 'error' && (
				<div style={{ textAlign: 'center', padding: '32px 0' }}>
					<div
						style={{
							fontSize: 15,
							fontWeight: 500,
							color: 'var(--rose)',
							marginBottom: 8,
						}}
					>
						Something went wrong
					</div>
					<div style={{ fontSize: 13, color: 'var(--ink-500)', marginBottom: 16 }}>
						If your money was deducted, please contact support.
					</div>
					<button className="btn ghost" onClick={() => setStep('select')}>
						Try again
					</button>
				</div>
			)}
		</Modal>
	)
}
