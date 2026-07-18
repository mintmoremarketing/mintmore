import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { walletApi } from '../../api/wallet'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import { rupee } from '../../utils/format'
import { Skeleton } from '../../components/ui/Skeleton'
import { commerceApi } from '../../api/commerce'

export default function Wallet() {
	const setShowTopUp = useUIStore((s) => s.setShowTopUp)
	const [filter, setFilter] = useState('all')

	const { data: walletData, isLoading } = useQuery({
		queryKey: ['wallet'],
		queryFn: () => walletApi.get().then((r) => r.data.data),
	})

	const { data: txData } = useQuery({
		queryKey: ['transactions', filter],
		queryFn: () => walletApi.transactions(filter !== 'all' ? { type: filter } : {}).then((r) => r.data.data),
	})
	const { data: credits } = useQuery({
		queryKey: ['mint-credits'],
		queryFn: () => commerceApi.credits().then((r) => r.data.data),
	})

	const wallet = walletData?.wallet
	const txns = txData?.transactions || []

	return (
		<div className="stack-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
			<div>
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>Wallet</div>
				<h1 className="h-display h-1" style={{ margin: 0 }}>Balance &amp; transactions</h1>
			</div>

			<div className="card-ink" style={{ position: 'relative', overflow: 'hidden', padding: 26 }}>
				<div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 90% 10%, rgba(247,127,0,0.18), transparent 50%)' }} />
				<div style={{ position: 'relative' }}>
					<div className="row between" style={{ marginBottom: 14 }}>
						<span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.04 }}>Total balance</span>
						<span className="badge mint" style={{ background: 'rgba(247,127,0,0.18)', border: '1px solid rgba(247,127,0,0.3)', color: 'var(--mint-200)' }}>
							<Icon name="shield" size={11} /> &nbsp;Escrow-secured
						</span>
					</div>
					{isLoading ? (
						<Skeleton width={200} height={48} style={{ background: 'rgba(255,255,255,0.1)' }} />
					) : (
						<div style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1 }}>
							{rupee((wallet?.balance || 0) + (wallet?.escrow_balance || 0))}
						</div>
					)}
					<div className="row" style={{ gap: 20, marginTop: 22, fontSize: 12, flexWrap: 'wrap' }}>
						<div>
							<div style={{ color: 'rgba(255,255,255,0.5)' }}>Available</div>
							<div className="mono" style={{ color: 'white', marginTop: 4, fontSize: 16, fontWeight: 500 }}>
								{rupee(wallet?.balance || 0)}
							</div>
						</div>
						<div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.1)' }} />
						<div>
							<div style={{ color: 'rgba(255,255,255,0.5)' }}>Mint Coins</div>
							<div className="mono" style={{ color: 'white', marginTop: 4, fontSize: 16, fontWeight: 500 }}>{rupee(credits?.balance || 0)}</div>
						</div>
						<div style={{ width: 1, height: 26, background: 'rgba(255,255,255,0.1)' }} />
						<div>
							<div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
								<Icon name="lock" size={10} /> Escrowed
							</div>
							<div className="mono" style={{ color: 'white', marginTop: 4, fontSize: 16, fontWeight: 500 }}>
								{rupee(wallet?.escrow_balance || 0)}
							</div>
						</div>
					</div>
					<div className="row" style={{ marginTop: 22, gap: 8 }}>
						<button className="btn mint" onClick={() => setShowTopUp(true)}>
							<Icon name="plus" /> Top up wallet
						</button>
					</div>
				</div>
			</div>

			<div className="stack">
				<div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
					<h2 className="h-display h-3" style={{ margin: 0 }}>Transactions</h2>
					<Tabs value={filter} onChange={setFilter} items={[
						{ value: 'all', label: 'All' },
						{ value: 'topup', label: 'Top-ups' },
						{ value: 'adjustment', label: 'Adjustments' },
					]} />
				</div>

				<div className="card-flat">
					<table style={{ width: '100%', borderCollapse: 'collapse' }}>
						<thead>
							<tr style={{ background: 'var(--paper-tint)', borderBottom: '1px solid var(--hairline)' }}>
								{['Date', 'Type', 'Description', 'Amount', 'Balance after'].map((h, i) => (
									<th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.04, color: 'var(--ink-500)', textAlign: i >= 3 ? 'right' : 'left' }}>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{txns.map((t, i) => (
								<tr key={t.id} style={{ borderBottom: i === txns.length - 1 ? 0 : '1px solid var(--hairline)' }}>
									<td style={{ padding: '12px 14px', fontSize: 13 }}>
										<span className="mono" style={{ color: 'var(--ink-700)' }}>
											{new Date(t.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
										</span>
									</td>
									<td style={{ padding: '12px 14px', fontSize: 13 }}>
										<span className={`badge ${t.type === 'topup' ? 'mint' : t.type === 'escrow_hold' ? 'violet' : 'neutral'}`}>
											<span className="bdot" /> {t.type.replace(/_/g, ' ')}
										</span>
									</td>
									<td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-800)' }}>{t.description}</td>
									<td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'right' }}>
										<span className="mono" style={{ color: t.amount >= 0 ? 'var(--mint-700)' : 'var(--ink-950)', fontWeight: 500 }}>
											{t.amount >= 0 ? '+' : ''}{rupee(t.amount)}
										</span>
									</td>
									<td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'right' }}>
										<span className="mono muted">{rupee(t.balance_after)}</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}
