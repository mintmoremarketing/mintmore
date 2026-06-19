import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Tabs from '../../components/ui/Tabs'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

// ── Wallet Adjust Modal ────────────────────────────────────────────────────────

function WalletAdjustModal({ user, onClose }) {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const [amount, setAmount] = useState('')
  const [note,   setNote]   = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post(`/wallet/admin/users/${user.id}/adjust`, {
      amount: parseFloat(amount),
      note,
    }),
    onSuccess: (res) => {
      const result = res.data.data
      pushToast({
        title: `${parseFloat(amount) > 0 ? '+' : ''}${rupee(parseFloat(amount))} applied`,
        body:  `${user.full_name} new balance: ${rupee(result.new_balance)}`,
        icon:  'check',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-stats'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user-wallet', user.id] })
      onClose()
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const isDebit  = parseFloat(amount) < 0
  const absAmt   = Math.abs(parseFloat(amount) || 0)

  return (
    <Modal
      title="Adjust wallet balance"
      subtitle={`${user.full_name} · ${user.email}`}
      onClose={onClose}
      maxWidth={420}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => mutate()}
            disabled={isPending || !amount || !note.trim() || parseFloat(amount) === 0}
          >
            {isPending ? 'Applying…' : 'Apply adjustment'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div className="field">
          <label className="field-label">Amount (₹)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-500)', fontWeight: 500 }}>₹</span>
            <input
              className="input"
              type="number"
              style={{ paddingLeft: 26 }}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Positive to add, negative to deduct"
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
            e.g. 5000 to add ₹5,000 · -500 to deduct ₹500
          </div>
        </div>

        <div className="field">
          <label className="field-label">Note (required)</label>
          <input
            className="input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Promotional credit, Correction, Test"
          />
        </div>

        {amount && parseFloat(amount) !== 0 && (
          <div style={{
            padding: 12, borderRadius: 'var(--radius-md)',
            background: isDebit ? 'rgba(225,29,72,0.06)' : 'rgba(247,127,0,0.08)',
            border: `1px solid ${isDebit ? 'rgba(225,29,72,0.2)' : 'rgba(247,127,0,0.25)'}`,
            fontSize: 13, fontWeight: 500,
            color: isDebit ? 'var(--rose)' : 'var(--mint-700)',
          }}>
            {isDebit ? '− Deducting' : '+ Adding'} {rupee(absAmt)} {isDebit ? 'from' : 'to'} {user.full_name}'s wallet
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--ink-400)', display: 'flex', gap: 5, alignItems: 'center' }}>
          <Icon name="shield" size={11} />
          Recorded as transaction type "adjustment" with your note attached.
        </div>
      </div>
    </Modal>
  )
}

// ── User Wallet Search ─────────────────────────────────────────────────────────

function UserWalletSearch() {
  const [search,       setSearch]       = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showAdjust,   setShowAdjust]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users-search', search],
    queryFn: () => api.get('/admin/users', {
      params: { search: search || undefined, limit: 10 },
    }).then(r => r.data.data),
    enabled: search.length >= 2,
  })

  // Fetch wallet for selected user
  const { data: walletData } = useQuery({
    queryKey: ['admin-user-wallet', selectedUser?.id],
    queryFn: async () => {
      // Get user detail which includes wallet
      const res = await api.get(`/admin/users/${selectedUser.id}`)
      return res.data.data
    },
    enabled: !!selectedUser,
  })

  const users = data?.users || []

  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="h-eyebrow" style={{ marginBottom: 14 }}>Adjust user wallet balance</div>
      <p style={{ fontSize: 13, color: 'var(--ink-600)', marginBottom: 16 }}>
        Add or deduct funds from any client or freelancer wallet.
        All adjustments are recorded in the transaction ledger.
      </p>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }} />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          placeholder="Search user by name or email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedUser(null) }}
        />
      </div>

      {/* Search results */}
      {search.length >= 2 && (
        <div style={{ marginBottom: 16 }}>
          {isLoading ? (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '8px 0' }}>Searching…</div>
          ) : users.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--ink-500)', padding: '8px 0' }}>No users found</div>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => { setSelectedUser(u); setSearch('') }}
                  style={{
                    display: 'flex', gap: 10, alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--paper-tint)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.1s',
                    width: '100%',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ink-300)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--hairline)'}
                >
                  <Avatar name={u.full_name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{u.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.email} · <span style={{ textTransform: 'capitalize' }}>{u.role}</span></div>
                  </div>
                  <Icon name="arrowRight" size={13} style={{ color: 'var(--ink-400)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected user wallet card */}
      {selectedUser && (
        <div style={{
          padding: 18,
          background: 'var(--paper-tint)',
          border: '1.5px solid var(--ink-200)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name={selectedUser.full_name} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedUser.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-500)', textTransform: 'capitalize' }}>
                  {selectedUser.role} · {selectedUser.email}
                </div>
              </div>
            </div>
            <button
              className="btn ghost"
              style={{ fontSize: 12 }}
              onClick={() => setSelectedUser(null)}
            >
              <Icon name="x" size={12} /> Clear
            </button>
          </div>

          {/* Wallet balances */}
          {walletData?.wallet && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Available',  value: walletData.wallet.balance,         color: 'var(--mint-700)' },
                { label: 'Escrowed',   value: walletData.wallet.escrow_balance,  color: 'var(--amber)' },
                { label: 'Total',      value: (walletData.wallet.balance || 0) + (walletData.wallet.escrow_balance || 0), color: 'var(--ink-950)' },
              ].map(item => (
                <div key={item.label} style={{ padding: '10px 12px', background: 'var(--paper)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: item.color }}>
                    {rupee(item.value || 0)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn primary"
              onClick={() => setShowAdjust(true)}
            >
              <Icon name="edit" size={13} /> Adjust balance
            </button>
          </div>
        </div>
      )}

      {/* Shortcut: quick credit presets */}
      {selectedUser && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 8 }}>Quick adjustments:</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '+₹500 test',   amount: 500,    note: 'Test credit' },
              { label: '+₹2,000',      amount: 2000,   note: 'Manual top-up' },
              { label: '+₹10,000',     amount: 10000,  note: 'Manual top-up' },
              { label: '−₹500',        amount: -500,   note: 'Balance correction' },
            ].map(preset => (
              <button
                key={preset.label}
                className="btn ghost"
                style={{ fontSize: 12, color: preset.amount < 0 ? 'var(--rose)' : undefined }}
                onClick={async () => {
                  if (!window.confirm(`Apply ${preset.label} to ${selectedUser.full_name}?`)) return
                  try {
                    await api.post(`/wallet/admin/users/${selectedUser.id}/adjust`, {
                      amount: preset.amount,
                      note: preset.note,
                    })
                    useUIStore.getState().pushToast({ title: `${preset.label} applied`, icon: 'check' })
                  } catch (err) {
                    useUIStore.getState().pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
                  }
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdjust && selectedUser && (
        <WalletAdjustModal
          user={selectedUser}
          onClose={() => setShowAdjust(false)}
        />
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function AdminWallet() {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const [tab,   setTab]   = useState('pending')
  const [notes, setNotes] = useState({})

  const { data: statsData } = useQuery({
    queryKey: ['admin-wallet-stats'],
    queryFn: async () => {
      const res = await api.get('/wallet/admin/stats')
      const d   = res.data
      return d?.data?.stats || d?.data || {}
    },
  })

  const { data: wdData, isLoading } = useQuery({
    queryKey: ['admin-withdrawals', tab],
    queryFn: () => api.get(`/wallet/admin/withdrawals?status=${tab}`).then(r => r.data.data),
  })

  const processMutation = useMutation({
    mutationFn: ({ id, action }) =>
      api.patch(`/wallet/admin/withdrawals/${id}`, { action, admin_note: notes[id] || '' }),
    onSuccess: (_, vars) => {
      pushToast({
        title: vars.action === 'approve' ? 'Withdrawal approved!' : 'Withdrawal rejected',
        icon:  vars.action === 'approve' ? 'check' : 'x',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] })
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-stats'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  const stats = statsData || {}
  const funds = stats.platform_funds || stats
  const pendingWd = stats.pending_withdrawals || {}
  const withdrawals = wdData?.withdrawals || []

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Platform wallet</h1>
      </div>

      {/* Platform stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="reveal">
        {[
          { label: 'Total in platform',   value: funds.total_platform_funds != null ? rupee(funds.total_platform_funds) : funds.total_balance != null ? rupee(funds.total_balance) : '—' },
          { label: 'Total escrowed',      value: funds.total_escrowed != null ? rupee(funds.total_escrowed) : funds.total_escrow != null ? rupee(funds.total_escrow) : '—' },
          { label: 'Pending withdrawals', value: pendingWd.total != null ? rupee(pendingWd.total) : pendingWd.count != null ? `${pendingWd.count} requests` : '—' },
        ].map(s => (
          <div key={s.label} style={{ padding: 20, background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11.5, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: 0.04, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* User wallet adjustment section */}
      <div className="reveal">
        <UserWalletSearch />
      </div>

      {/* Withdrawals */}
      <div className="stack">
        <div className="row between">
          <h2 className="h-display h-3" style={{ margin: 0 }}>Withdrawal requests</h2>
          <Tabs value={tab} onChange={setTab} items={[
            { value: 'pending',  label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]} />
        </div>

        {isLoading ? <SkeletonCard /> : withdrawals.length === 0 ? (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ color: 'var(--ink-400)', fontSize: 13 }}>No {tab} withdrawal requests</div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {withdrawals.map(w => (
              <div key={w.id} style={{ background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
                <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <Avatar name={w.user?.full_name || 'F'} size="sm" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{w.user?.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                        {w.user?.email} · {timeAgo(w.created_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{rupee(w.net_amount ?? w.amount)}</div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                      {w.payout_mode === 'instant' ? 'Instant payout' : 'Scheduled payout'}
                      {Number(w.fee_amount || 0) > 0 ? ` · ${rupee(w.fee_amount)} fee` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ padding: 12, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', marginBottom: 14 }}>
                  <div className="row" style={{ gap: 20, fontSize: 13, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Account name</div>
                      <div style={{ fontWeight: 500 }}>{w.account_name}</div>
                    </div>
                    {w.account_number && (
                      <div>
                        <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>Account no.</div>
                        <div className="mono">{w.account_number}</div>
                      </div>
                    )}
                    {w.ifsc_code && (
                      <div>
                        <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>IFSC</div>
                        <div className="mono">{w.ifsc_code}</div>
                      </div>
                    )}
                    {w.upi_id && (
                      <div>
                        <div style={{ color: 'var(--ink-500)', marginBottom: 2 }}>UPI ID</div>
                        <div className="mono">{w.upi_id}</div>
                      </div>
                    )}
                  </div>
                </div>

                {tab === 'pending' && (
                  <div className="stack" style={{ gap: 10 }}>
                    <input className="input" placeholder="Admin note (optional)" value={notes[w.id] || ''}
                      onChange={e => setNotes(n => ({ ...n, [w.id]: e.target.value }))} style={{ fontSize: 12 }} />
                    <div className="row" style={{ gap: 8 }}>
                      <button className="btn primary"
                        onClick={() => processMutation.mutate({ id: w.id, action: 'approve' })}
                        disabled={processMutation.isPending}>
                        <Icon name="check" size={13} /> Approve & mark paid
                      </button>
                      <button className="btn ghost" style={{ color: 'var(--rose)' }}
                        onClick={() => processMutation.mutate({ id: w.id, action: 'reject' })}
                        disabled={processMutation.isPending}>
                        Reject
                      </button>
                    </div>
                  </div>
                )}

                {w.admin_note && tab !== 'pending' && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-600)', marginTop: 8 }}>Note: {w.admin_note}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
