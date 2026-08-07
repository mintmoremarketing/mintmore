import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { commerceApi } from '../../api/commerce'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import Modal from '../../components/ui/Modal'
import Tabs from '../../components/ui/Tabs'
import { rupee, timeAgo } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useEntitlements } from '../../hooks/useEntitlements'
import { useAuthStore } from '../../store/auth'

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
            padding: 12, background: parseFloat(amount) >= 0 ? 'rgba(247,127,0,0.08)' : 'rgba(225,29,72,0.06)',
            borderRadius: 'var(--radius-md)', border: `1px solid ${parseFloat(amount) >= 0 ? 'rgba(247,127,0,0.25)' : 'rgba(225,29,72,0.2)'}`,
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

function MintCoinAdjustModal({ user, onClose }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [expiryDays, setExpiryDays] = useState('60')
  const idempotencyKey = useRef(crypto.randomUUID())

  const adjust = useMutation({
    mutationFn: () => api.post(`/commerce/admin/credits/${user.id}/adjust`, {
      amount: Number(amount),
      note,
      expiry_days: Number(amount) > 0 && expiryDays ? Number(expiryDays) : null,
    }, {
      headers: { 'Idempotency-Key': idempotencyKey.current },
    }),
    onSuccess: () => {
      pushToast({
        title: 'MintCoins adjusted',
        body: `${Number(amount) > 0 ? '+' : ''}${Number(amount).toLocaleString('en-IN')} for ${user.full_name}`,
        icon: 'check',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-user', user.id] })
      onClose()
    },
    onError: err => pushToast({
      title: 'Could not adjust MintCoins',
      body: err.response?.data?.message || 'Try again',
      tone: 'amber',
      icon: 'x',
    }),
  })

  const parsedAmount = Number(amount)
  return (
    <Modal
      title="Adjust MintCoins"
      subtitle={`${user.full_name} - promotional platform balance`}
      onClose={onClose}
      maxWidth={420}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => adjust.mutate()}
            disabled={adjust.isPending || !Number.isFinite(parsedAmount) || parsedAmount === 0 || !note.trim()}
          >
            {adjust.isPending ? 'Applying...' : 'Apply adjustment'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label className="field-label">MintCoins</label>
          <input
            className="input"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Positive to grant, negative to deduct"
          />
        </div>
        {parsedAmount > 0 && (
          <div className="field">
            <label className="field-label">Expires after</label>
            <select className="input" value={expiryDays} onChange={e => setExpiryDays(e.target.value)}>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="">Never expires</option>
            </select>
          </div>
        )}
        <div className="field">
          <label className="field-label">Reason</label>
          <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Required audit note" />
        </div>
        <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
          MintCoins can pay only for CREATYV platform services. They cannot fund freelancer earnings or be withdrawn.
        </div>
      </div>
    </Modal>
  )
}

function CreateAdminModal({ onClose }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', permissions: [] })
  const permissionOptions = [
    ['users.manage', 'Users and KYC'],
    ['matching.manage', 'Matching and creators'],
    ['deals.approve', 'Deal approvals'],
    ['payments.manage', 'Payments and payouts'],
    ['support.manage', 'Support and disputes'],
    ['pricing.manage', 'AI and pricing'],
    ['audit.read', 'Audit records'],
    ['operations.manage', 'Background operations'],
  ]

  const createAdmin = useMutation({
    mutationFn: () => api.post('/admin/users/admin', form),
    onSuccess: () => {
      pushToast({ title: 'Admin created', body: `${form.full_name} can now sign in`, icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onClose()
    },
    onError: err => pushToast({
      title: 'Failed',
      body: err.response?.data?.message || 'Could not create admin',
      tone: 'amber',
      icon: 'x',
    }),
  })

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const canSubmit = form.full_name.trim() && form.email.trim() && form.password.length >= 8

  return (
    <Modal
      title="Create admin"
      subtitle="Add a new platform admin account"
      onClose={onClose}
      maxWidth={420}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose} disabled={createAdmin.isPending}>Cancel</button>
          <button
            className="btn primary"
            onClick={() => createAdmin.mutate()}
            disabled={!canSubmit || createAdmin.isPending}
          >
            <Icon name="plus" size={13} />
            {createAdmin.isPending ? 'Creating...' : 'Create admin'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div className="field">
          <label className="field-label">Full name</label>
          <input
            className="input"
            value={form.full_name}
            onChange={e => updateField('full_name', e.target.value)}
            placeholder="e.g. Priya Admin"
          />
        </div>
        <div className="field">
          <label className="field-label">Permissions</label>
          <div className="grid-2" style={{ gap: 8 }}>
            {permissionOptions.map(([value, label]) => (
              <label key={value} className="row" style={{ gap: 7, padding: 9, border: '1px solid var(--hairline)' }}>
                <input
                  type="checkbox"
                  checked={form.permissions.includes(value)}
                  onChange={e => updateField('permissions', e.target.checked
                    ? [...form.permissions, value]
                    : form.permissions.filter(permission => permission !== value))}
                />
                <span style={{ fontSize: 12 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
            placeholder="admin@mintmore.in"
          />
        </div>
        <div className="field">
          <label className="field-label">Temporary password</label>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={e => updateField('password', e.target.value)}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
          />
        </div>
      </div>
    </Modal>
  )
}

function DeleteUserModal({ user, onClose, onDeleted }) {
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [confirmEmail, setConfirmEmail] = useState('')

  const deleteUser = useMutation({
    mutationFn: () => api.delete(`/admin/users/${user.id}`, {
      data: { confirm_email: confirmEmail },
    }),
    onSuccess: (res) => {
      const touched = res.data?.data?.touched || []
      pushToast({
        title: 'User deleted',
        body: `${user.email} and related data were removed from ${touched.length} areas.`,
        icon: 'check',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      onDeleted()
    },
    onError: err => pushToast({
      title: 'Could not delete user',
      body: err.response?.data?.message || 'Try again',
      tone: 'amber',
      icon: 'x',
    }),
  })

  return (
    <Modal
      title="Delete user data"
      subtitle={user.email}
      onClose={onClose}
      maxWidth={460}
      footer={
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={onClose} disabled={deleteUser.isPending}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--rose)', color: 'white' }}
            onClick={() => deleteUser.mutate()}
            disabled={deleteUser.isPending || confirmEmail !== user.email}
          >
            <Icon name="trash" size={13} />
            {deleteUser.isPending ? 'Deleting...' : 'Delete user and data'}
          </button>
        </div>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <div style={{ padding: 14, border: '1px solid rgba(225,29,72,.25)', background: 'rgba(225,29,72,.06)', borderRadius: 12 }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>This permanently deletes the account.</strong>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Related user-owned rows such as social posts, media, wallet records, notifications, jobs, requests, and uploads will be removed or detached where the database allows.
          </div>
        </div>
        <div className="field">
          <label className="field-label">Type the user email to confirm</label>
          <input
            className="input"
            value={confirmEmail}
            onChange={event => setConfirmEmail(event.target.value)}
            placeholder={user.email}
          />
        </div>
      </div>
    </Modal>
  )
}

function UserDetailModal({ userId, onClose }) {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const [showWalletAdjust, setShowWalletAdjust] = useState(false)
  const [showMintCoinAdjust, setShowMintCoinAdjust] = useState(false)
  const [showDeleteUser, setShowDeleteUser] = useState(false)
  const [kycNote, setKycNote] = useState('')
  const { data: adminAccess } = useEntitlements()
  const adminPermissions = adminAccess?.admin_permissions || []
  const canAdjustMintCoins = adminAccess?.is_super_admin || adminPermissions.includes('*') || adminPermissions.includes('pricing.manage')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn:  () => api.get(`/admin/users/${userId}`).then(r => r.data.data),
  })

  const user   = data?.user || data
  const wallet = data?.wallet
  const mintCreditAccount = data?.mint_credit_account

  const approveMutation = useMutation({
  mutationFn: (action) => api.patch(`/admin/users/${userId}/approval`, {
    // Changed 'status' to 'is_approved' and evaluated action to a boolean
    is_approved: action === 'approve', 
  }),
  onSuccess: (_, action) => {
    pushToast({
      title: action === 'approve' ? 'User approved!' : 'User suspended',
      icon: 'check',
    })
    queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
  },
  onError: (err) => {
    // Log the exact validation error to see what field the backend wants
    console.error('Approval error:', err.response?.data)
    pushToast({
      title: 'Failed',
      body: err.response?.data?.message || err.response?.data?.errors?.join(', ') || 'Try again',
      tone: 'amber',
      icon: 'x',
    })
  },
})

  const kycMutation = useMutation({
    mutationFn: ({ submissionId, status }) =>
      api.patch(`/kyc/admin/review/${submissionId}`, { status, admin_note: kycNote }),
    onSuccess: () => {
      pushToast({ title: 'KYC reviewed', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
    },
  })

  const impersonateStore = useAuthStore(s => s.impersonate)

  const impersonateMutation = useMutation({
    mutationFn: () => api.post(`/admin/users/${userId}/impersonate`),
    onSuccess: (res) => {
      const { user, accessToken, refreshToken } = res.data.data
      pushToast({ title: `Impersonating ${user.full_name}`, icon: 'user-check' })
      impersonateStore(user, accessToken, refreshToken)
      onClose()
      window.location.href = '/' // redirect to home as the impersonated user
    },
    onError: (err) => pushToast({
      title: 'Failed to impersonate',
      body: err.response?.data?.message || 'Try again',
      tone: 'amber',
      icon: 'x',
    }),
  })

  const setLevelMutation = useMutation({
    mutationFn: (level) => api.patch(`/admin/users/${userId}/level`, { level }),
    onSuccess: () => {
      pushToast({ title: 'Level updated', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
    },
  })

  const openKycDocument = async (submissionId, field) => {
    try {
      const response = await api.get(`/kyc/admin/submissions/${submissionId}/documents/${field}`)
      const signedUrl = response.data?.data?.document?.signed_url
      if (!signedUrl) throw new Error('No signed document URL returned')
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      pushToast({
        title: 'Document unavailable',
        body: err.response?.data?.message || err.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    }
  }

  const { data: tiers } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: () => commerceApi.getTiers().then(res => res.data.data),
    enabled: user?.role === 'client'
  })

  const setTierMutation = useMutation({
    mutationFn: (tierId) => api.patch(`/admin/users/${userId}/tier`, { tier_id: tierId }),
    onSuccess: () => {
      pushToast({ title: 'Membership tier updated', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['admin-user', userId] })
    },
    onError: (err) => pushToast({ title: 'Failed to update tier', body: err.response?.data?.message || err.message, tone: 'amber', icon: 'x' })
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

        {user.role === 'client' && (
          <div style={{ padding: 14, background: 'rgba(247,127,0,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(247,127,0,0.2)' }}>
            <div className="row between" style={{ marginBottom: 8 }}>
              <div className="h-eyebrow">MintCoins</div>
              {canAdjustMintCoins && (
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => setShowMintCoinAdjust(true)}>
                  <Icon name="coin" size={12} /> Adjust
                </button>
              )}
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center' }}>
              <span className="mintcoin-mark"><Icon name="coin" size={13} /></span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
                {Number(mintCreditAccount?.balance || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}

        {user.role === 'client' && (
          <div style={{ padding: 14, background: 'var(--paper-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)' }}>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div className="h-eyebrow">Membership Plan</div>
              {data?.membership?.status === 'active' && (
                <span className="badge mint">Active</span>
              )}
            </div>
            <div className="field">
              <select 
                className="input" 
                value={data?.membership?.tier_id || ''}
                onChange={e => setTierMutation.mutate(e.target.value || null)}
                disabled={setTierMutation.isPending}
              >
                <option value="">No membership plan</option>
                {tiers?.map(tier => (
                  <option key={tier.id} value={tier.id}>{tier.name} — {rupee(tier.price)}/mo</option>
                ))}
              </select>
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
                      <div style={{ fontSize: 13.5, fontWeight: 500, textTransform: 'capitalize' }}>{k.level} verification</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{timeAgo(k.created_at)}</div>
                    </div>
                    <span className={`badge ${k.status === 'approved' ? 'mint' : k.status === 'rejected' ? 'rose' : 'amber'}`}>
                      <span className="bdot" />{k.status}
                    </span>
                  </div>
                  <div className="row" style={{ gap: 7, flexWrap: 'wrap', marginBottom: 9 }}>
                    {k.document_front_url && <button type="button" className="btn ghost sm" onClick={() => openKycDocument(k.id, 'document_front_url')}><Icon name="file" /> Document front</button>}
                    {k.document_back_url && <button type="button" className="btn ghost sm" onClick={() => openKycDocument(k.id, 'document_back_url')}><Icon name="file" /> Document back</button>}
                    {k.selfie_url && <button type="button" className="btn ghost sm" onClick={() => openKycDocument(k.id, 'selfie_url')}><Icon name="image" /> Selfie</button>}
                    {k.address_proof_url && <button type="button" className="btn ghost sm" onClick={() => openKycDocument(k.id, 'address_proof_url')}><Icon name="file" /> Address proof</button>}
                  </div>
                  {k.status === 'pending' && k.level === 'address' && (
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
                          onClick={() => kycMutation.mutate({ submissionId: k.id, status: 'approved' })}
                          disabled={kycMutation.isPending}
                        >
                          <Icon name="check" size={12} /> Approve
                        </button>
                        <button
                          className="btn ghost"
                          style={{ fontSize: 12, color: 'var(--rose)' }}
                          onClick={() => kycMutation.mutate({ submissionId: k.id, status: 'rejected' })}
                          disabled={kycMutation.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                  {k.status === 'pending' && k.level !== 'address' && (
                    <div className="muted" style={{ fontSize: 11.5 }}>Included in the complete verification application.</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {user.role === 'freelancer' && (
          <div>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="h-eyebrow">Creative work review</div>
              <span className={`badge ${(data?.portfolio_items?.length || 0) >= 3 ? 'mint' : 'amber'}`}>
                {data?.portfolio_items?.length || 0} / 3 samples
              </span>
            </div>
            {(data?.portfolio_items?.length || 0) === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>No work samples submitted yet.</div>
            ) : (
              <div className="admin-portfolio-grid">
                {data.portfolio_items.map(item => (
                  <a key={item.id} href={item.cover_image_url} target="_blank" rel="noreferrer" className="admin-portfolio-item">
                    <img src={item.cover_image_url} alt="" />
                    <span>{item.title}</span>
                  </a>
                ))}
              </div>
            )}
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

          {user.role !== 'admin' && user.is_active && (
            <button
              className="btn secondary"
              style={{ marginLeft: 'auto' }}
              onClick={() => impersonateMutation.mutate()}
              disabled={impersonateMutation.isPending}
            >
              <Icon name="user-check" size={13} /> 
              {impersonateMutation.isPending ? 'Switching...' : 'Impersonate'}
            </button>
          )}

          <button
            className="btn ghost"
            style={{ color: 'var(--rose)', marginLeft: user.role !== 'admin' && user.is_active ? 0 : 'auto' }}
            onClick={() => setShowDeleteUser(true)}
          >
            <Icon name="trash" size={13} /> Delete user data
          </button>
        </div>
      </div>

      {showWalletAdjust && (
        <WalletAdjustModal user={user} onClose={() => setShowWalletAdjust(false)} />
      )}
      {showMintCoinAdjust && (
        <MintCoinAdjustModal user={user} onClose={() => setShowMintCoinAdjust(false)} />
      )}
      {showDeleteUser && (
        <DeleteUserModal
          user={user}
          onClose={() => setShowDeleteUser(false)}
          onDeleted={() => {
            setShowDeleteUser(false)
            onClose()
          }}
        />
      )}
    </Modal>
  )
}

export default function AdminUsers() {
  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState('all')
  const [selectedUser,setSelectedUser]= useState(null)
  const [showCreateAdmin, setShowCreateAdmin] = useState(false)

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
    <div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-ink-500 tracking-[0.2em] uppercase">Admin</div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-ink-950 tracking-tight m-0">Users</h1>
        </div>
        <button className="px-6 py-2.5 bg-ink-950 hover:bg-ink-900 text-white font-bold rounded-full transition-all flex items-center gap-2 shadow-sm" onClick={() => setShowCreateAdmin(true)}>
          <Icon name="plus" size={16} />
          Create admin
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            className="w-full pl-11 pr-4 py-3 bg-white border border-ink-200/60 rounded-2xl text-ink-900 focus:outline-none focus:border-ink-400 focus:ring-1 focus:ring-ink-400 shadow-sm transition-all"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full md:w-auto">
          <Tabs
            value={roleFilter}
            onChange={setRoleFilter}
            items={[
              { value: 'all',        label: 'All' },
              { value: 'client',     label: 'Clients' },
              { value: 'freelancer', label: 'Freelancers' },
              { value: 'admin',      label: 'Admins' },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-ink-200/60 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ink-50/50 border-b border-ink-200/60">
                {['User','Role','KYC','Approval','Joined',''].map((h, i) => (
                  <th key={i} className="px-6 py-4 text-xs font-bold tracking-[0.15em] uppercase text-ink-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-ink-500 font-medium">Loading…</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-ink-500 font-medium bg-ink-50/30">No users found</td></tr>
              ) : (
                users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`group cursor-pointer hover:bg-ink-50/50 transition-colors ${i === users.length - 1 ? '' : 'border-b border-ink-200/50'}`}
                    onClick={() => setSelectedUser(u.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.full_name} size="md" />
                        <div>
                          <div className="text-sm font-bold text-ink-950">{u.full_name}</div>
                          <div className="text-xs text-ink-500 font-medium mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-ink-100 text-ink-700 text-xs font-bold uppercase tracking-wider rounded-md">{u.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold uppercase tracking-wider ${u.kyc_status === 'approved' ? 'text-mint-600' : 'text-ink-400'}`}>
                        {u.kyc_status || 'None'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${u.is_approved ? 'bg-mint-50 text-mint-700' : 'bg-amber-50 text-amber-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_approved ? 'bg-mint-500' : 'bg-amber-500 animate-pulse'}`} />
                        {u.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-ink-500">
                      {timeAgo(u.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Icon name="chevronRight" size={16} className="text-ink-300 group-hover:text-ink-600 transition-colors inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUser && (
        <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      {showCreateAdmin && (
        <CreateAdminModal onClose={() => setShowCreateAdmin(false)} />
      )}
    </div>
  )
}
