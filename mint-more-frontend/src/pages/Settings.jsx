import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'
import Icon from '../components/ui/Icon'
import { SkeletonCard } from '../components/ui/Skeleton'
import { useSearchParams } from 'react-router-dom'
import VerificationPanel from '../components/settings/VerificationPanel'
import { socialApi } from '../api/social'

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') || 'profile'
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const { user, setAuth, refreshToken, accessToken } = useAuthStore()

  // Profile fields
  const [fullName,  setFullName]  = useState(user?.full_name || '')
  const [phone,     setPhone]     = useState('')
  const [bio,       setBio]       = useState('')
  const [waNumber,  setWaNumber]  = useState('')
  const [city,      setCity]      = useState('')
  const [state,     setState]     = useState('')
  const [avatarFile,setAvatarFile]= useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const avatarInputRef = useRef(null)

  // Password fields
  const [currentPw, setCurrentPw] = useState('')
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError,   setPwError]   = useState('')

  // Load profile
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then(r => r.data.data),
  })
  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(r => r.data.data),
    enabled: user?.role === 'client',
  })

  const profile = useMemo(() => profileData?.profile || profileData?.user || profileData || {}, [profileData])
  const socialAccounts = useMemo(() => accountsData?.accounts || [], [accountsData?.accounts])
  const connectedSocialAccounts = socialAccounts.filter(account => account.is_active)

  useEffect(() => {
    if (profile.full_name)      setFullName(profile.full_name)
    if (profile.phone)          setPhone(profile.phone || '')
    if (profile.bio)            setBio(profile.bio || '')
    if (profile.whatsapp_number) setWaNumber(profile.whatsapp_number || '')
    if (profile.address_city)   setCity(profile.address_city || '')
    if (profile.address_state)  setState(profile.address_state || '')
    if (profile.avatar_url)     setAvatarPreview(profile.avatar_url)
  }, [
    profile.id,
    profile.full_name,
    profile.phone,
    profile.bio,
    profile.whatsapp_number,
    profile.address_city,
    profile.address_state,
    profile.avatar_url,
  ])

  // Save profile
  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: () => api.patch('/profile/me', {
      full_name:        fullName,
      phone:            phone || undefined,
      bio:              bio || undefined,
      whatsapp_number:  waNumber || undefined,
      address_city:     city || undefined,
      address_state:    state || undefined,
    }),
    onSuccess: (res) => {
      const updatedUser = res.data.data?.profile || res.data.data?.user || res.data.data
      if (updatedUser) {
        setAuth({ ...user, ...updatedUser }, accessToken, refreshToken)
      }
      pushToast({ title: 'Profile updated!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  // Upload avatar
  const { mutate: uploadAvatar, isPending: uploadingAvatar } = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('avatar', avatarFile)
      return api.patch('/profile/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res) => {
      const updatedProfile = res.data.data?.profile || res.data.data
      const url = updatedProfile?.avatar_url || res.data.data?.avatar_url
      if (url) setAvatarPreview(url)
      if (updatedProfile) setAuth({ ...user, ...updatedProfile }, accessToken, refreshToken)
      pushToast({ title: 'Avatar updated!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      setAvatarFile(null)
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  // Change password
  const { mutate: changePassword, isPending: changingPw } = useMutation({
    mutationFn: () => api.patch('/profile/me', {
      current_password: currentPw,
      new_password:     newPw,
    }),
    onSuccess: () => {
      pushToast({ title: 'Password changed!', icon: 'check' })
      setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError('')
    },
    onError: err => {
      const msg = err.response?.data?.message || 'Failed to change password'
      setPwError(msg)
      pushToast({ title: 'Failed', body: msg, tone: 'amber', icon: 'x' })
    },
  })

  function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  function handlePasswordSubmit() {
    setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters'); return }
    changePassword()
  }

  // KYC status
  const { data: kycData } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: () => api.get('/kyc/status').then(r => r.data.data),
  })
  const kyc = kycData || {}

  if (isLoading) return (
    <div className="flex flex-col gap-6 p-4 md:p-8 w-full max-w-[1600px] mx-auto pb-16"><SkeletonCard /><SkeletonCard /></div>
  )

  const sections = [
    ['profile', 'user', 'Profile'],
    ['account', 'settings', 'Account info'],
    ...(user?.role === 'client' ? [['setup', 'check', 'Setup']] : []),
    ['security', 'lock', 'Password & security'],
    ...(!['admin', 'designer'].includes(user?.role) ? [['verification', 'shield', 'Verification']] : []),
  ]

  return (
    <div className="flex flex-col md:flex-row gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto pb-16">
      <aside className="w-full md:w-64 shrink-0 flex flex-col gap-1 md:sticky md:top-24 self-start">
        <div className="text-[11px] font-bold tracking-wider uppercase text-mint-500 mb-2 px-3">Settings</div>
        {sections.map(([id, icon, label]) => (
          <button key={id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${section === id ? 'bg-white shadow-sm border border-ink-200 text-ink-900' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'}`} onClick={() => setSearchParams({ section: id })}>
            <Icon name={icon} size={16} /> {label}
          </button>
        ))}
      </aside>
      <div className="flex-1 flex flex-col gap-6 min-w-0">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-[11px] font-bold tracking-wider uppercase text-mint-500 mb-2">Settings</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-900 tracking-tight m-0 pb-1">{sections.find(([id]) => id === section)?.[2] || 'Account settings'}</h1>
      </div>

      {/* Avatar */}
      {section === 'profile' && <div className="card reveal" style={{ padding: 24 }}>
        <div className="h-eyebrow" style={{ marginBottom: 16 }}>Profile photo</div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="" style={{
                width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid var(--hairline)',
              }} />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--ink-950)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500,
              }}>
                {(profile.full_name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('')}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 4 }}>{profile.full_name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-500)', textTransform: 'capitalize', marginBottom: 12 }}>
              {profile.role} - {profile.email}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 12 }}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Icon name="image" size={12} /> Choose photo
              </button>
              {avatarFile && (
                <button
                  className="btn primary"
                  style={{ fontSize: 12 }}
                  onClick={() => uploadAvatar()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'Uploading...' : 'Save photo'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>}

      {/* Personal info */}
      {section === 'profile' && <div className="card reveal" style={{ padding: 24 }}>
        <div className="h-eyebrow" style={{ marginBottom: 16 }}>Personal information</div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">Full name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Phone number</label>
              <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </div>
          </div>

          {user?.role !== 'admin' && (
            <div className="field">
              <label className="field-label">Bio</label>
              <textarea className="textarea" rows={3} value={bio} onChange={e => setBio(e.target.value)}
                placeholder="Tell others about yourself..." />
            </div>
          )}

          <div className="grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">City</label>
              <input className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai" />
            </div>
            <div className="field">
              <label className="field-label">State</label>
              <input className="input" value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Maharashtra" />
            </div>
          </div>

          {user?.role !== 'admin' && (
            <div className="field">
              <label className="field-label">WhatsApp number</label>
              <input className="input" value={waNumber} onChange={e => setWaNumber(e.target.value)}
                placeholder="+91 XXXXX XXXXX (for WhatsApp chat integration)" />
              <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
                Used to bridge your WhatsApp with the platform chat
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: 20 }}>
          <button className="btn primary" onClick={() => saveProfile()} disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>}

      {/* KYC status (clients + freelancers only) */}
      {section === 'verification' && !['admin', 'designer'].includes(user?.role) && <VerificationPanel profile={profile} kyc={kyc} />}

      {/* Change password */}
      {section === 'security' && <div className="card reveal" style={{ padding: 24 }}>
        <div className="h-eyebrow" style={{ marginBottom: 16 }}>Change password</div>
        <div className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label">Current password</label>
            <input className="input" type="password" autoComplete="current-password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">New password</label>
              <input className="input" type="password" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Confirm new password</label>
              <input className="input" type="password" autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </div>
          </div>
          {pwError && (
            <div style={{ fontSize: 13, color: 'var(--rose)', padding: '8px 12px', background: 'rgba(225,29,72,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(225,29,72,0.2)' }}>
              {pwError}
            </div>
          )}
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            className="btn primary"
            onClick={handlePasswordSubmit}
            disabled={changingPw || !currentPw || !newPw || !confirmPw}
          >
            {changingPw ? 'Changing...' : 'Change password'}
          </button>
        </div>
      </div>}

      {/* Account info (read-only) */}
      {section === 'account' && <div className="card reveal" style={{ padding: 24 }}>
        <div className="h-eyebrow" style={{ marginBottom: 16 }}>Account information</div>
        <div className="stack" style={{ gap: 10, fontSize: 13 }}>
          <div className="row between">
            <span style={{ color: 'var(--ink-500)' }}>Email</span>
            <span className="mono">{profile.email}</span>
          </div>
          <div style={{ height: 1, background: 'var(--hairline)' }} />
          <div className="row between">
            <span style={{ color: 'var(--ink-500)' }}>Role</span>
            <span style={{ textTransform: 'capitalize' }}>{profile.role}</span>
          </div>
          <div style={{ height: 1, background: 'var(--hairline)' }} />
          <div className="row between">
            <span style={{ color: 'var(--ink-500)' }}>Account status</span>
            <span className={`badge ${profile.is_active !== false ? 'mint' : 'rose'}`}>
              <span className="bdot" /> {profile.is_active !== false ? 'Active' : 'Deactivated'}
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--hairline)' }} />
          <div className="row between">
            <span style={{ color: 'var(--ink-500)' }}>Member since</span>
            <span>{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
          </div>
          <div style={{ height: 1, background: 'var(--hairline)' }} />
          <div className="row between">
            <span style={{ color: 'var(--ink-500)' }}>Verification</span>
            <span className={`badge ${profile.kyc_status === 'verified' ? 'mint' : 'neutral'}`}>
              {profile.kyc_status || 'not started'}
            </span>
          </div>
          {profile.role === 'client' && (
            <>
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <div className="row between">
                <span style={{ color: 'var(--ink-500)' }}>Business</span>
                <span>{profile.business_name || profile.business_type || 'Not added yet'}</span>
              </div>
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <div className="row between">
                <span style={{ color: 'var(--ink-500)' }}>Connected social accounts</span>
                <span>{connectedSocialAccounts.length}</span>
              </div>
              {connectedSocialAccounts.length > 0 && (
                <div className="row wrap" style={{ gap: 6, justifyContent: 'flex-end' }}>
                  {connectedSocialAccounts.map(account => (
                    <span key={account.id} className="badge neutral" style={{ textTransform: 'capitalize' }}>
                      {account.platform}: {account.page_name || account.platform_name || account.platform_username}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          {profile.role === 'freelancer' && (
            <>
              <div style={{ height: 1, background: 'var(--hairline)' }} />
              <div className="row between">
                <span style={{ color: 'var(--ink-500)' }}>Freelancer level</span>
                <span style={{ textTransform: 'capitalize' }}>{profile.freelancer_level || 'Not set'}</span>
              </div>
            </>
          )}
        </div>
      </div>}
      {section === 'setup' && user?.role === 'client' && <div className="stack" style={{ gap: 14 }}>
        <div className="card reveal" style={{ padding: 24 }}>
          <div className="h-eyebrow" style={{ marginBottom: 8 }}>Business setup</div>
          <h2 style={{ margin: 0 }}>Finish the pieces that improve your calendar and insights</h2>
          <p className="muted" style={{ margin: '8px 0 0' }}>Each step improves recommendations, reporting, and production handoff.</p>
        </div>
        {[
          {
            title: 'Business profile',
            body: profile.business_name ? `${profile.business_name} is saved.` : 'Add business name, type, city, and customer profile.',
            done: Boolean(profile.business_name || profile.business_type),
            action: () => setSearchParams({ section: 'profile' }),
          },
          {
            title: 'Social accounts',
            body: connectedSocialAccounts.length ? `${connectedSocialAccounts.length} account${connectedSocialAccounts.length === 1 ? '' : 's'} connected.` : 'Connect Facebook, Instagram, or YouTube for analytics.',
            done: connectedSocialAccounts.length > 0,
            action: () => window.location.assign('/social'),
          },
          {
            title: 'Verification',
            body: profile.kyc_status === 'verified' ? 'Your account is verified.' : 'Complete verification before paid work expands.',
            done: profile.kyc_status === 'verified',
            action: () => setSearchParams({ section: 'verification' }),
          },
        ].map((item, index) => (
          <button
            key={item.title}
            className="card"
            onClick={item.action}
            style={{ padding: 18, textAlign: 'left', display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 14, alignItems: 'center', cursor: 'pointer' }}
          >
            <span style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: item.done ? 'var(--mint-50)' : 'var(--paper-tint)',
              color: item.done ? 'var(--mint-700)' : 'var(--ink-500)',
              fontWeight: 700,
            }}>{item.done ? <Icon name="check" /> : index + 1}</span>
            <span>
              <strong style={{ display: 'block' }}>{item.title}</strong>
              <span className="muted" style={{ display: 'block', marginTop: 3 }}>{item.body}</span>
            </span>
            <Icon name="chevronRight" />
          </button>
        ))}
      </div>}
      </div>
    </div>
  )
}
