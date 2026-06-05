import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuthStore } from '../store/auth'
import { useUIStore } from '../store/ui'
import Icon from '../components/ui/Icon'
import { SkeletonCard } from '../components/ui/Skeleton'

export default function Settings() {
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

  const profile = profileData?.profile || profileData?.user || profileData || {}

  useEffect(() => {
    if (profile.full_name)      setFullName(profile.full_name)
    if (profile.phone)          setPhone(profile.phone || '')
    if (profile.bio)            setBio(profile.bio || '')
    if (profile.whatsapp_number) setWaNumber(profile.whatsapp_number || '')
    if (profile.address_city)   setCity(profile.address_city || '')
    if (profile.address_state)  setState(profile.address_state || '')
    if (profile.avatar_url)     setAvatarPreview(profile.avatar_url)
  }, [profile.id])

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
      const url = res.data.data?.profile?.avatar_url || res.data.data?.avatar_url
      if (url) setAvatarPreview(url)
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
    <div className="stack-6"><SkeletonCard /><SkeletonCard /></div>
  )

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Settings</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Account settings</h1>
      </div>

      {/* Avatar */}
      <div className="card reveal" style={{ padding: 24 }}>
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
              {profile.role} · {profile.email}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label style={{ cursor: 'pointer' }}>
                <button className="btn ghost" style={{ fontSize: 12, pointerEvents: 'none' }}>
                  <Icon name="image" size={12} /> Choose photo
                </button>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </label>
              {avatarFile && (
                <button
                  className="btn primary"
                  style={{ fontSize: 12 }}
                  onClick={() => uploadAvatar()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'Uploading…' : 'Save photo'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div className="card reveal" style={{ padding: 24 }}>
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
                placeholder="Tell others about yourself…" />
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
            {savingProfile ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* KYC status (clients + freelancers only) */}
      {user?.role !== 'admin' && (
        <div className="card reveal" style={{ padding: 24 }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div className="h-eyebrow">KYC verification</div>
            <span className={`badge ${
              profile.kyc_status === 'approved' ? 'mint' :
              profile.kyc_status === 'rejected' ? 'rose' :
              profile.kyc_status === 'pending'  ? 'amber' : 'neutral'
            }`}>
              <span className="bdot" />
              {profile.kyc_status || 'Not started'}
            </span>
          </div>

          {/* Level progress */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { level: 1, label: 'Basic',    desc: 'Name + date of birth' },
              { level: 2, label: 'Identity', desc: 'Aadhaar / PAN / Passport' },
              { level: 3, label: 'Address',  desc: 'Address proof' },
            ].map(({ level, label, desc }) => {
              const done = (profile.kyc_level || 0) >= level
              const pending = kyc.kyc_submissions?.some(s => s.kyc_level === level && s.status === 'pending')
              return (
                <div key={level} style={{
                  padding: '12px 14px',
                  background: done ? 'rgba(16,185,129,0.06)' : 'var(--paper-tint)',
                  border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : 'var(--hairline)'}`,
                  borderRadius: 'var(--radius-md)',
                }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: done ? 'var(--mint-500)' : 'var(--paper-deep)',
                      color: done ? 'white' : 'var(--ink-500)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {done ? <Icon name="check" size={10} strokeWidth={3} /> : level}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: done ? 'var(--mint-800)' : 'var(--ink-900)' }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{desc}</div>
                  {pending && <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 4 }}>Under review</div>}
                </div>
              )
            })}
          </div>

          {profile.kyc_level < 3 && (
            <div style={{ fontSize: 13, color: 'var(--ink-600)' }}>
              Complete all 3 levels to get the verified badge and improve your matching score.
            </div>
          )}
        </div>
      )}

      {/* Change password */}
      <div className="card reveal" style={{ padding: 24 }}>
        <div className="h-eyebrow" style={{ marginBottom: 16 }}>Change password</div>
        <div className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label">Current password</label>
            <input className="input" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </div>
          <div className="grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">New password</label>
              <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label">Confirm new password</label>
              <input className="input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
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
            {changingPw ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>

      {/* Account info (read-only) */}
      <div className="card reveal" style={{ padding: 24 }}>
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
            <span className={`badge ${profile.is_approved ? 'mint' : 'amber'}`}>
              <span className="bdot" /> {profile.is_approved ? 'Approved' : 'Pending approval'}
            </span>
          </div>
          <div style={{ height: 1, background: 'var(--hairline)' }} />
          <div className="row between">
            <span style={{ color: 'var(--ink-500)' }}>Member since</span>
            <span>{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
          </div>
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
      </div>
    </div>
  )
}
