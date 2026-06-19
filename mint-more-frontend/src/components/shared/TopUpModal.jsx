import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { walletApi } from '../../api/wallet'
import { useUIStore } from '../../store/ui'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import { rupee } from '../../utils/format'

const PRESETS = [500, 1000, 2000, 5000]

export default function TopUpModal({ onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const [amount, setAmount] = useState(1000)
	const [custom, setCustom] = useState('')
	const [step, setStep] = useState('select')

	const finalAmount = custom ? parseInt(custom, 10) : amount

	const { mutate, isPending } = useMutation({
		mutationFn: () => walletApi.createOrder(finalAmount),
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
			name: 'CREATYV',
			description: 'Wallet top-up',
			order_id: order.order_id,
			theme: { color: '#f77f00' },
			handler: async (response) => {
				try {
					await walletApi.verifyPayment({
						razorpay_order_id: response.razorpay_order_id,
						razorpay_payment_id: response.razorpay_payment_id,
						razorpay_signature: response.razorpay_signature,
					})
					setStep('success')
					queryClient.invalidateQueries({ queryKey: ['wallet'] })
					queryClient.invalidateQueries({ queryKey: ['transactions'] })
					pushToast({
						title: `Rs ${finalAmount.toLocaleString('en-IN')} added to wallet`,
						body: 'Your balance has been updated',
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
			title="Top up wallet"
			subtitle="Add funds to use across the platform"
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
							disabled={isPending || !finalAmount || finalAmount < 100}
						>
							{isPending ? (
								'Creating order...'
							) : (
								<>
									Pay {rupee(finalAmount)} <Icon name="arrowRight" />
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
							Choose amount
						</div>
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(4, 1fr)',
								gap: 8,
							}}
						>
							{PRESETS.map((p) => (
								<button
									key={p}
									onClick={() => {
										setAmount(p)
										setCustom('')
									}}
									style={{
										padding: '10px 8px',
										background:
											amount === p && !custom
												? 'var(--ink-950)'
												: 'var(--paper-tint)',
										color:
											amount === p && !custom ? 'white' : 'var(--ink-900)',
										border: `1px solid ${
											amount === p && !custom
												? 'var(--ink-950)'
												: 'var(--hairline)'
										}`,
										borderRadius: 'var(--radius-md)',
										fontWeight: 500,
										fontSize: 14,
										cursor: 'pointer',
										transition: 'all 0.12s',
										fontFamily: 'var(--font-mono)',
									}}
								>
									Rs {p.toLocaleString('en-IN')}
								</button>
							))}
						</div>
					</div>

					<div className="field">
						<label className="field-label">Or enter custom amount</label>
						<div style={{ position: 'relative' }}>
							<span
								style={{
									position: 'absolute',
									left: 12,
									top: '50%',
									transform: 'translateY(-50%)',
									color: 'var(--ink-500)',
									fontSize: 15,
									fontWeight: 500,
								}}
							>
								Rs
							</span>
							<input
								className="input"
								type="number"
								min="100"
								max="500000"
								style={{ paddingLeft: 28 }}
								value={custom}
								onChange={(e) => setCustom(e.target.value)}
								placeholder="Min 100"
							/>
						</div>
					</div>

					<div
						style={{
							padding: '12px 14px',
							background: 'var(--paper-tint)',
							borderRadius: 'var(--radius-md)',
							border: '1px solid var(--hairline)',
						}}
					>
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								fontSize: 13,
							}}
						>
							<span style={{ color: 'var(--ink-600)' }}>You'll add</span>
							<span className="mono" style={{ fontWeight: 600, fontSize: 15 }}>
								{finalAmount >= 100 ? rupee(finalAmount) : '-'}
							</span>
						</div>
						<div
							style={{
								fontSize: 11.5,
								color: 'var(--ink-500)',
								marginTop: 6,
								display: 'flex',
								alignItems: 'center',
								gap: 4,
							}}
						>
							<Icon name="shield" size={11} /> Secured by Razorpay - Instant credit
						</div>
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
						{rupee(finalAmount)} added!
					</div>
					<div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
						Your wallet has been updated
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
