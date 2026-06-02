import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import StatusChip from '../../components/ui/StatusChip'
import Modal from '../../components/ui/Modal'
import Tabs from '../../components/ui/Tabs'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

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
    onSuccess: () => {
      pushToast({
        title: `Wallet adjusted — ${parseFloat(amount) > 0 ? '+' : ''}${rupee(parseFloat(amount))}`,
        body:  `For ${user.full_name}`,
        icon:  'check',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-user', user.id] })
      onClose()
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  return (
    <Modal
      title="Adjust wallet balance"
      subtitle={`${user.full_name} — ${user.email}`}
      onClose={onClose}
      maxWidth={400}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => mutate()}
            disabled={isPending || !amount || !note.trim()}
          >
            {isPending ? 'Applying…' : 'Apply adjustment'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
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
            Use negative numbers to deduct (e.g. -500)
          </div>
        </div>
        <div className="field">
          <label className="field-label">Note (required)</label>
          <input
            className="input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Promotional credit, Correction"
          />
        </div>
        {amount && (
          <div style={{
            padding: 12, background: parseFloat(amount) >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(225,29,72,0.06)',
            borderRadius: 'var(--radius-md)', border: `1px solid ${parseFloat(amount) >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(225,29,72,0.2)'}`,
            fontSize: 13, fontWeight: 500,
            color: parseFloat(amount) >= 0 ? 'var(--mint-700)' : 'var(--rose)',
          }}>
            {parseFloat(amount) >= 0 ? '+ Adding' : '− Deducting'} {rupee(Math.abs(parseFloat(amount)))} from {user.full_name}'s wallet
          </div>
        )}
      </div>
    </Modal>
  )
}

function UserDetailModal({ userId, onClose }) {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const [showWalletAdjust, setShowWalletAdjust] = useState(false)
  const [kycNote, setKycNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn:  () => api.get(`/admin/users/${userId}`).then(r => r.data.data),
  })

  const user   = data?.user || data
  const wallet = data?.wallet

  const approveMutation = useMutation({
    mutationFn: (action) => api.patch(`/admin/users/${userId}/approval`, { action }),
    onSuccess: (_, action) => {
      pushToast({ title: action === 'approve' ? 'User approved!' : 'User suspended', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const kycMutation = useMutation({
    mutationFn: ({ submissionId, action }) =>
      api.patch(`/kyc/admin/review/${submissionId}`, { action, admin_note: kycNote }),
    onSuccess: () => {
      pushToast({ title: 'KYC reviewed', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
    },
  })

  const setLevelMutation = useMutation({
    mutationFn: (level) => api.patch(`/admin/users/${userId}/level`, { level }),
    onSuccess: () => {
      pushToast({ title: 'Level updated', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
    },
  })

  if (isLoading) return (
    <Modal title="User detail" onClose={onClose}>
      <div style={{ padding: 20 }}><SkeletonCard /></div>
    </Modal>
  )

  if (!user) return null

  return (
    <Modal title={user.full_name} subtitle={`${user.role} · ${user.email}`} onClose={onClose} maxWidth={580}>
      <div className="stack" style={{ gap: 18 }}>
        {/* Status badges */}
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className={`badge ${user.is_approved ? 'mint' : 'amber'}`}>
            <span className="bdot" />
            {user.is_approved ? 'Approved' : 'Pending approval'}
          </span>
          <span className={`badge ${user.kyc_status === 'approved' ? 'mint' : 'neutral'}`}>
            KYC: {user.kyc_status || 'none'}
          </span>
          {user.role === 'freelancer' && user.freelancer_level && (
            <span className="badge violet" style={{ textTransform: 'capitalize' }}>
              {user.freelancer_level}
            </span>
          )}
        </div>

        {/* Wallet */}
        {wallet && (
          <div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <div className="h-eyebrow">Wallet</div>
              <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setShowWalletAdjust(true)}>
                <Icon name="edit" size={12} /> Adjust
              </button>
            </div>
            <div className="row" style={{ gap: 20, fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--ink-500)' }}>Balance</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{rupee(wallet.balance)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--ink-500)' }}>Escrowed</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{rupee(wallet.escrow_balance)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Freelancer level */}
        {user.role === 'freelancer' && (
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>Freelancer level</div>
            <div className="row" style={{ gap: 8 }}>
              {['beginner','intermediate','experienced'].map(level => (
                <button
                  key={level}
                  className={`btn ${user.freelancer_level === level ? 'primary' : 'ghost'}`}
                  style={{ fontSize: 12, textTransform: 'capitalize' }}
                  onClick={() => setLevelMutation.mutate(level)}
                  disabled={setLevelMutation.isPending}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KYC submissions */}
        {data?.kyc_submissions?.length > 0 && (
          <div>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>KYC submissions</div>
            <div className="stack" style={{ gap: 10 }}>
              {data.kyc_submissions.map(k => (
                <div key={k.id} style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
                  <div className="row between" style={{ marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>Level {k.kyc_level} KYC</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{timeAgo(k.created_at)}</div>
                    </div>
                    <span className={`badge ${k.status === 'approved' ? 'mint' : k.status === 'rejected' ? 'rose' : 'amber'}`}>
                      <span className="bdot" />{k.status}
                    </span>
                  </div>
                  {k.status === 'pending' && (
                    <div className="stack" style={{ gap: 8 }}>
                      <input
                        className="input"
                        placeholder="Admin note (optional)"
                        value={kycNote}
                        onChange={e => setKycNote(e.target.value)}
                        style={{ fontSize: 12 }}
                      />
                      <div className="row" style={{ gap: 8 }}>
                        <button
                          className="btn primary"
                          style={{ fontSize: 12 }}
                          onClick={() => kycMutation.mutate({ submissionId: k.id, action: 'approve' })}
                          disabled={kycMutation.isPending}
                        >
                          <Icon name="check" size={12} /> Approve
                        </button>
                        <button
                          className="btn ghost"
                          style={{ fontSize: 12, color: 'var(--rose)' }}
                          onClick={() => kycMutation.mutate({ submissionId: k.id, action: 'reject' })}
                          disabled={kycMutation.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="row" style={{ gap: 10, paddingTop: 4, borderTop: '1px solid var(--hairline)' }}>
          {!user.is_approved ? (
            <button
              className="btn primary"
              onClick={() => approveMutation.mutate('approve')}
              disabled={approveMutation.isPending}
            >
              <Icon name="check" size={13} /> Approve user
            </button>
          ) : (
            <button
              className="btn ghost"
              style={{ color: 'var(--rose)' }}
              onClick={() => approveMutation.mutate('suspend')}
              disabled={approveMutation.isPending}
            >
              Suspend user
            </button>
          )}
        </div>
      </div>

      {showWalletAdjust && (
        <WalletAdjustModal user={user} onClose={() => setShowWalletAdjust(false)} />
      )}
    </Modal>
  )
}

export default function AdminUsers() {
  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState('all')
  const [selectedUser,setSelectedUser]= useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn:  () => api.get('/admin/users', {
      params: {
        search:   search || undefined,
        role:     roleFilter !== 'all' ? roleFilter : undefined,
        limit:    50,
      },
    }).then(r => r.data.data),
  })

  const users = data?.users || []

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Admin</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Users</h1>
      </div>

      {/* Search + filter */}
      <div className="row" style={{ gap: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)', pointerEvents: 'none' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Tabs
          value={roleFilter}
          onChange={setRoleFilter}
          items={[
            { value: 'all',        label: 'All' },
            { value: 'client',     label: 'Clients' },
            { value: 'freelancer', label: 'Freelancers' },
          ]}
        />
      </div>

      {/* Table */}
      <div className="card-flat">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--paper-tint)', borderBottom: '1px solid var(--hairline)' }}>
              {['User','Role','KYC','Approval','Joined',''].map((h, i) => (
                <th key={i} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.04, color: 'var(--ink-500)', textAlign: 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--ink-500)' }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--ink-500)', fontSize: 13 }}>No users found</td></tr>
            ) : (
              users.map((u, i) => (
                <tr
                  key={u.id}
                  style={{ borderBottom: i === users.length - 1 ? 0 : '1px solid var(--hairline)', cursor: 'pointer' }}
                  onClick={() => setSelectedUser(u.id)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--paper-tint)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Avatar name={u.full_name} size="sm" />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-950)' }}>{u.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className="badge neutral" style={{ textTransform: 'capitalize' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 12.5, textTransform: 'capitalize', color: u.kyc_status === 'approved' ? 'var(--mint-700)' : 'var(--ink-500)' }}>
                      {u.kyc_status || 'None'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span className={`badge ${u.is_approved ? 'mint' : 'amber'}`} style={{ fontSize: 11 }}>
                      <span className="bdot" />
                      {u.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--ink-500)' }}>
                    {timeAgo(u.created_at)}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Icon name="chevronRight" size={13} style={{ color: 'var(--ink-400)' }} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  )
}