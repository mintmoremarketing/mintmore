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
		<div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
			<div className="flex flex-col gap-1">
				<div className="text-sm font-semibold text-ink-500 tracking-wide uppercase">Earnings</div>
				<h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0">Wallet and withdrawals</h1>
			</div>

			<div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
				<div className="flex-1 lg:w-2/3 bg-gradient-to-br from-ink-900 via-ink-950 to-black rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden text-white min-h-[320px] border border-white/10">
					{/* Decorative card shine and chip */}
					<div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
					<div className="absolute top-10 right-10 w-16 h-16 bg-white/5 rounded-full blur-2xl" />
					<div className="absolute -bottom-10 -right-10 w-40 h-40 bg-mint-500/20 rounded-full blur-3xl" />
					
					<div className="relative z-10 flex flex-col h-full justify-between gap-8">
						<div className="flex justify-between items-start">
							<div>
								<div className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/50 mb-4">
									Total Balance
								</div>
								{isLoading ? (
									<Skeleton width={200} height={48} style={{ background: 'rgba(255,255,255,0.1)' }} />
								) : (
									<div className="text-5xl md:text-7xl font-display font-bold leading-none tracking-tight">
										{rupee((wallet?.balance || 0) + (wallet?.escrow_balance || 0))}
									</div>
								)}
							</div>
							<div className="hidden sm:flex w-12 h-8 rounded border border-white/20 bg-white/5 items-center justify-center">
								<div className="w-8 h-4 rounded-sm border border-white/20 bg-white/10" />
							</div>
						</div>

						<div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mt-4">
							<div className="flex items-center gap-8 md:gap-12 text-sm">
								<div className="flex flex-col gap-1">
									<div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">Available</div>
									<div className="font-mono text-xl text-white">
										{rupee(wallet?.balance || 0)}
									</div>
								</div>
								<div className="flex flex-col gap-1">
									<div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold flex items-center gap-1">
										<Icon name="lock" size={12} /> Escrow
									</div>
									<div className="font-mono text-xl text-white">
										{rupee(wallet?.escrow_balance || 0)}
									</div>
								</div>
							</div>

							<button 
								className="whitespace-nowrap px-8 py-3.5 bg-white hover:bg-ink-50 text-ink-950 font-bold rounded-full transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:-translate-y-1"
								onClick={() => setShowWD(true)} 
								disabled={!wallet || parseFloat(wallet.balance) < 100}
							>
								<Icon name="arrowUpRight" size={18} /> Withdraw
							</button>
						</div>
					</div>
				</div>

				<div className="w-full lg:w-1/3 bg-white/80 backdrop-blur-md border border-ink-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[32px] p-8 flex flex-col justify-between min-h-[320px] relative overflow-hidden group">
					<div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-colors duration-500" />
					<div className="relative z-10">
						<div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/50 flex items-center justify-center text-orange-600 mb-8 border border-orange-200/50 shadow-sm">
							<Icon name="zap" size={24} className="drop-shadow-sm" />
						</div>
						<h3 className="text-2xl font-display font-bold text-ink-950 mb-3">Fast payouts</h3>
						<p className="text-sm text-ink-600 leading-relaxed font-medium">
							Choose between our free weekly scheduled payouts, or get your funds instantly for a small flat fee.
						</p>
					</div>
					<div className="mt-8 pt-6 border-t border-ink-100/80 flex items-center gap-3 text-sm text-ink-500 font-semibold relative z-10">
						<div className="w-8 h-8 rounded-full bg-mint-50 flex items-center justify-center">
							<Icon name="shieldCheck" size={14} className="text-mint-600" />
						</div>
						Secured by Escrow
					</div>
				</div>
			</div>
			<div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h2 className="text-xl md:text-2xl font-display font-bold text-ink-950 m-0">Transactions</h2>
					<Tabs value={filter} onChange={setFilter} items={[
						{ value: 'all', label: 'All' },
						{ value: 'escrow_release', label: 'Earnings' },
						{ value: 'withdrawal', label: 'Withdrawals' },
					]} />
				</div>

				<div className="bg-white/60 backdrop-blur-sm border border-ink-200/60 rounded-3xl overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse min-w-[700px]">
							<thead>
								<tr>
									{['Date', 'Type', 'Description', 'Amount', 'Balance after'].map((h, i) => (
										<th
											key={h}
											className={`py-4 px-6 text-[11px] font-bold tracking-[0.15em] uppercase text-ink-400 border-b border-ink-100/80 ${i >= 3 ? 'text-right' : 'text-left'}`}
										>
											{h}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-ink-100/50">
								{txns.length === 0 ? (
									<tr>
										<td colSpan={5} className="py-16 text-center text-ink-400 font-medium text-sm">
											No transactions yet
										</td>
									</tr>
								) : (
									txns.map((t) => (
										<tr key={t.id} className="hover:bg-ink-50/50 transition-colors group">
											<td className="py-4 px-6 text-sm font-mono text-ink-500 whitespace-nowrap">
												{new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
											</td>
											<td className="py-4 px-6 whitespace-nowrap">
												<span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
													t.type === 'escrow_release' ? 'bg-mint-50/80 text-mint-700 border border-mint-200/50' :
													t.type === 'withdrawal' ? 'bg-violet-50/80 text-violet-700 border border-violet-200/50' : 'bg-ink-50/80 text-ink-700 border border-ink-200/50'
												}`}>
													<div className={`w-1.5 h-1.5 rounded-full ${
														t.type === 'escrow_release' ? 'bg-mint-500 shadow-[0_0_8px_rgba(247,127,0,0.5)]' :
														t.type === 'withdrawal' ? 'bg-violet-500 shadow-[0_0_8px_rgba(109,40,217,0.5)]' : 'bg-ink-400'
													}`} />
													{t.type.replace(/_/g, ' ')}
												</span>
											</td>
											<td className="py-4 px-6 text-sm text-ink-800 font-medium">
												{t.description}
											</td>
											<td className="py-4 px-6 text-sm text-right whitespace-nowrap">
												<span className={`font-mono font-bold text-base ${t.amount >= 0 ? 'text-mint-600' : 'text-ink-950'}`}>
													{t.amount >= 0 ? '+' : ''}{rupee(t.amount)}
												</span>
											</td>
											<td className="py-4 px-6 text-sm font-mono text-ink-400 font-medium text-right whitespace-nowrap">
												{rupee(t.balance_after)}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{showWD && <WithdrawModal wallet={wallet} payoutRules={walletData?.payout_rules} onClose={() => setShowWD(false)} />}
		</div>
	)
}
