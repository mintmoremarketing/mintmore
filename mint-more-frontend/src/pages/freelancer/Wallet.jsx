import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { walletApi } from '../../api/wallet'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import Modal from '../../components/ui/Modal'
import { rupee } from '../../utils/format'
import { Skeleton } from '../../components/ui/Skeleton'

function WithdrawModal({ wallet, payoutRules, onClose }) {
	const queryClient = useQueryClient()
	const pushToast = useUIStore((s) => s.pushToast)
	const [amount, setAmount] = useState('')
	const [accountName, setAccountName] = useState('')
	const [accountNumber, setAccountNumber] = useState('')
	const [ifsc, setIfsc] = useState('')
	const [upiId, setUpiId] = useState('')
	const [method, setMethod] = useState('bank')
	const [payoutMode, setPayoutMode] = useState('scheduled')

	const { mutate, isPending } = useMutation({
		mutationFn: () =>
			api_withdraw({
				amount: parseFloat(amount),
				account_name: accountName,
				account_number: method === 'bank' ? accountNumber : undefined,
				ifsc_code: method === 'bank' ? ifsc : undefined,
				upi_id: method === 'upi' ? upiId : undefined,
				payout_mode: payoutMode,
			}),
		onSuccess: () => {
			pushToast({
				title: 'Withdrawal requested!',
				body: payoutMode === 'instant' ? 'Your instant payout is queued for processing.' : 'Your free weekly payout is queued.',
				icon: 'check',
			})
			queryClient.invalidateQueries({ queryKey: ['wallet'] })
			queryClient.invalidateQueries({ queryKey: ['transactions'] })
			onClose()
		},
		onError: (err) => {
			pushToast({ title: 'Failed', body: err.response?.data?.message || 'Try again', tone: 'amber', icon: 'x' })
		},
	})

	async function api_withdraw(data) {
		const { api } = await import('../../api/client')
		return api.post('/wallet/withdraw', data)
	}

	const available = parseFloat(wallet?.balance || 0)
	const fee = Number(payoutMode === 'instant' ? payoutRules?.instant_fee || 0 : payoutRules?.scheduled_fee || 0)
	const netAmount = Math.max(Number(amount || 0) - fee, 0)
	const canSubmit =
		parseFloat(amount) >= 100 &&
		parseFloat(amount) <= available &&
		netAmount > 0 &&
		accountName.trim().length >= 2 &&
		(method === 'upi'
			? upiId.trim().length > 0
			: accountNumber.trim().length >= 9 && ifsc.trim().length === 11)

	return (
		<Modal
			title="Request withdrawal"
			subtitle="Funds transferred within 2 business days"
			onClose={onClose}
			maxWidth={440}
			footer={
				<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
					<button className="btn ghost" onClick={onClose} disabled={isPending}>
						Cancel
					</button>
					<button className="btn primary" onClick={() => mutate()} disabled={isPending || !canSubmit}>
						{isPending ? 'Submitting...' : 'Request withdrawal'}
					</button>
				</div>
			}
		>
			<div className="stack" style={{ gap: 14 }}>
				<div className="field">
					<label className="field-label" style={{ marginBottom: 8, display: 'block' }}>Payout speed</label>
					<div className="grid-2" style={{ gap: 8 }}>
						{[
							['scheduled', payoutRules?.scheduled_label || 'Weekly payout', payoutRules?.scheduled_fee || 0],
							['instant', payoutRules?.instant_label || 'Instant payout', payoutRules?.instant_fee || 0],
						].map(([value, label, optionFee]) => (
							<button
								key={value}
								type="button"
								onClick={() => setPayoutMode(value)}
								className={`btn ${payoutMode === value ? 'primary' : 'ghost'}`}
								style={{ justifyContent: 'flex-start' }}
							>
								{label} · {Number(optionFee) > 0 ? `${rupee(optionFee)} fee` : 'Free'}
							</button>
						))}
					</div>
				</div>

				<div className="field">
					<div className="row between">
						<label className="field-label">Amount</label>
						<span style={{ fontSize: 12, color: 'var(--ink-500)' }}>
							Available: <span className="mono">{rupee(available)}</span>
						</span>
					</div>
					<div style={{ position: 'relative' }}>
						<span
							style={{
								position: 'absolute',
								left: 12,
								top: '50%',
								transform: 'translateY(-50%)',
								color: 'var(--ink-500)',
								fontWeight: 500,
							}}
						>
							Rs
						</span>
						<input
							className="input"
							type="number"
							style={{ paddingLeft: 26 }}
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							max={available}
							placeholder="Min Rs100"
						/>
					</div>
				</div>

				{Number(amount || 0) > 0 && (
					<div className="card-flat" style={{ padding: 12 }}>
						<div className="row between" style={{ fontSize: 12.5 }}>
							<span className="muted">Payout fee</span>
							<strong className="mono">{rupee(fee)}</strong>
						</div>
						<div className="row between" style={{ fontSize: 13.5, marginTop: 7 }}>
							<span>You receive</span>
							<strong className="mono">{rupee(netAmount)}</strong>
						</div>
					</div>
				)}

				<div className="field">
					<label className="field-label">Account holder name</label>
					<input className="input" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="As per bank records" />
				</div>

				<div>
					<label className="field-label" style={{ marginBottom: 8, display: 'block' }}>
						Withdrawal method
					</label>
					<div className="grid-2" style={{ gap: 8 }}>
						{['bank', 'upi'].map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setMethod(m)}
								style={{
									padding: '10px 14px',
									border: `1.5px solid ${method === m ? 'var(--ink-950)' : 'var(--hairline)'}`,
									borderRadius: 'var(--radius-md)',
									background: method === m ? 'var(--ink-950)' : 'var(--paper)',
									color: method === m ? 'white' : 'var(--ink-700)',
									fontWeight: 500,
									fontSize: 13,
									cursor: 'pointer',
									textTransform: 'uppercase',
									letterSpacing: 0.04,
								}}
							>
								{m === 'bank' ? 'Bank transfer' : 'UPI'}
							</button>
						))}
					</div>
				</div>

				{method === 'bank' && (
					<div className="stack" style={{ gap: 10 }}>
						<div className="field">
							<label className="field-label">Account number</label>
							<input className="input" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="9-18 digit number" />
						</div>
						<div className="field">
							<label className="field-label">IFSC code</label>
							<input className="input" value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="e.g. SBIN0001234" maxLength={11} />
						</div>
					</div>
				)}

				{method === 'upi' && (
					<div className="field">
						<label className="field-label">UPI ID</label>
						<input className="input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@upi" />
					</div>
				)}

				<div style={{ fontSize: 12, color: 'var(--ink-400)', display: 'flex', gap: 5, alignItems: 'center' }}>
					<Icon name="clock" size={11} />
					Processing time: 1-2 business days after admin approval
				</div>
			</div>
		</Modal>
	)
}

export default function FreelancerWallet() {
	const [filter, setFilter] = useState('all')
	const [showWD, setShowWD] = useState(false)

	const { data: walletData, isLoading } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => walletApi.get().then((r) => r.data.data),
	})

	const { data: txData } = useQuery({
		queryKey: ['transactions', filter],
		queryFn: () =>
			walletApi.transactions(filter !== 'all' ? { type: filter } : {}).then((r) => r.data.data),
	})

	const wallet = walletData?.wallet
	const txns = txData?.transactions || []

	return (
		<div className="stack-6">
			<div>
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>Earnings</div>
				<h1 className="h-display h-1" style={{ margin: 0 }}>Wallet and withdrawals</h1>
			</div>

			<div className="card-ink" style={{ padding: 26, position: 'relative', overflow: 'hidden' }}>
				<div
					style={{
						position: 'absolute',
						inset: 0,
						background: 'radial-gradient(circle at 90% 10%, rgba(16,185,129,0.18), transparent 50%)',
					}}
				/>
				<div style={{ position: 'relative' }}>
					<div className="row between" style={{ marginBottom: 14 }}>
						<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.04 }}>
							Total earnings wallet
						</span>
					</div>
					{isLoading ? (
						<Skeleton width={180} height={44} style={{ background: 'rgba(255,255,255,0.1)' }} />
					) : (
						<div style={{ fontFamily: 'var(--font-display)', fontSize: 46, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
							{rupee((wallet?.balance || 0) + (wallet?.escrow_balance || 0))}
						</div>
					)}
					<div className="row" style={{ gap: 24, marginTop: 18, fontSize: 12 }}>
						<div>
							<div style={{ color: 'rgba(255,255,255,0.5)' }}>Available</div>
							<div className="mono" style={{ color: 'white', marginTop: 4, fontSize: 16, fontWeight: 500 }}>
								{rupee(wallet?.balance || 0)}
							</div>
						</div>
						<div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
						<div>
							<div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
								<Icon name="lock" size={10} /> In escrow
							</div>
							<div className="mono" style={{ color: 'white', marginTop: 4, fontSize: 16, fontWeight: 500 }}>
								{rupee(wallet?.escrow_balance || 0)}
							</div>
						</div>
					</div>
					<div className="row" style={{ marginTop: 22, gap: 10 }}>
						<button className="btn mint" onClick={() => setShowWD(true)} disabled={!wallet || parseFloat(wallet.balance) < 100}>
							<Icon name="download" /> Withdraw funds
						</button>
						{wallet && parseFloat(wallet.balance) < 100 && (
							<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Min. withdrawal: Rs100</span>
						)}
					</div>
				</div>
			</div>

			<div className="stack">
				<div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
					<h2 className="h-display h-3" style={{ margin: 0 }}>Transactions</h2>
					<Tabs value={filter} onChange={setFilter} items={[
						{ value: 'all', label: 'All' },
						{ value: 'escrow_release', label: 'Earnings' },
						{ value: 'withdrawal', label: 'Withdrawals' },
					]} />
				</div>

				<div className="card-flat">
					<table style={{ width: '100%', borderCollapse: 'collapse' }}>
						<thead>
							<tr style={{ background: 'var(--paper-tint)', borderBottom: '1px solid var(--hairline)' }}>
								{['Date', 'Type', 'Description', 'Amount', 'Balance after'].map((h, i) => (
									<th
										key={h}
										style={{
											padding: '10px 14px',
											fontSize: 11,
											fontWeight: 500,
											textTransform: 'uppercase',
											letterSpacing: 0.04,
											color: 'var(--ink-500)',
											textAlign: i >= 3 ? 'right' : 'left',
										}}
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{txns.length === 0 ? (
								<tr>
									<td colSpan={5} style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>
										No transactions yet
									</td>
								</tr>
							) : (
								txns.map((t, i) => (
									<tr key={t.id} style={{ borderBottom: i === txns.length - 1 ? 0 : '1px solid var(--hairline)' }}>
										<td style={{ padding: '12px 14px', fontSize: 13 }}>
											<span className="mono" style={{ color: 'var(--ink-700)' }}>
												{new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
											</span>
										</td>
										<td style={{ padding: '12px 14px', fontSize: 13 }}>
											<span
												className={`badge ${
													t.type === 'escrow_release'
														? 'mint'
														: t.type === 'withdrawal'
															? 'violet'
															: 'neutral'
												}`}
											>
												<span className="bdot" /> {t.type.replace(/_/g, ' ')}
											</span>
										</td>
										<td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-800)' }}>
											{t.description}
										</td>
										<td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'right' }}>
											<span
												className="mono"
												style={{ color: t.amount >= 0 ? 'var(--mint-700)' : 'var(--ink-950)', fontWeight: 500 }}
											>
												{t.amount >= 0 ? '+' : ''}{rupee(t.amount)}
											</span>
										</td>
										<td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'right' }}>
											<span className="mono" style={{ color: 'var(--ink-500)' }}>{rupee(t.balance_after)}</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{showWD && <WithdrawModal wallet={wallet} payoutRules={walletData?.payout_rules} onClose={() => setShowWD(false)} />}
		</div>
	)
}
