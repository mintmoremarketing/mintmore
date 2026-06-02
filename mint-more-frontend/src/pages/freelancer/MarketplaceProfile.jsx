import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import { rupee } from '../../utils/format'

const RESPONSE_TIME_OPTIONS = [
  { value: 1,  label: '< 1 hour' },
  { value: 3,  label: '1-3 hours' },
  { value: 8,  label: 'A few hours' },
  { value: 24, label: '1 day' },
  { value: 48, label: '1-2 days' },
]

export default function MarketplaceProfile() {
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const { user }    = useAuthStore()

  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then(r => r.data.data),
  })

  const profile = profileData?.user || profileData || {}

  const [tagline,       setTagline]       = useState('')
  const [bio,           setBio]           = useState('')
  const [hourlyRate,    setHourlyRate]    = useState('')
  const [responseTime,  setResponseTime]  = useState(24)
  const [languages,     setLanguages]     = useState([])
  const [visible,       setVisible]       = useState(false)
  const [langInput,     setLangInput]     = useState('')

  // Populate form from fetched profile
  useEffect(() => {
    if (profile.tagline)              setTagline(profile.tagline || '')
    if (profile.bio)                  setBio(profile.bio || '')
    if (profile.hourly_rate)          setHourlyRate(profile.hourly_rate || '')
    if (profile.response_time_hours)  setResponseTime(profile.response_time_hours || 24)
    if (profile.languages)            setLanguages(profile.languages || [])
    if (typeof profile.marketplace_visible === 'boolean') setVisible(profile.marketplace_visible)
  }, [profile.id])

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.patch('/freelancers/me/marketplace', {
      tagline:            tagline || undefined,
      hourly_rate:        hourlyRate ? parseFloat(hourlyRate) : undefined,
      response_time_hours: responseTime,
      languages,
      marketplace_visible: visible,
    }),
    onSuccess: () => {
      pushToast({ title: 'Profile updated!', body: visible ? 'You are now visible in the marketplace' : 'Profile saved', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    onError: err => pushToast({ title: 'Failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' }),
  })

  // Also save bio to main profile
  const { mutate: saveBio, isPending: savingBio } = useMutation({
    mutationFn: () => api.patch('/profile/me', { bio }),
    onSuccess: () => {
      pushToast({ title: 'Bio updated', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
  })

  function addLanguage(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const lang = langInput.trim()
      if (lang && !languages.includes(lang)) {
        setLanguages([...languages, lang])
      }
      setLangInput('')
    }
  }

  function removeLanguage(lang) {
    setLanguages(languages.filter(l => l !== lang))
  }

  return (
    <div className="stack-6">
      <div className="reveal">
        <div className="h-eyebrow" style={{ marginBottom: 4 }}>Marketplace</div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Your public profile</h1>
        <p className="muted" style={{ marginTop: 6, fontSize: 13.5 }}>
          This is what clients see when they browse the marketplace.
        </p>
      </div>

      {/* Visibility toggle — most important */}
      <div className="card reveal" style={{
        padding: 20,
        border: visible ? '1.5px solid rgba(16,185,129,0.4)' : '1px solid var(--hairline)',
        background: visible ? 'rgba(16,185,129,0.04)' : 'var(--paper)',
      }}>
        <div className="row between">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: visible ? 'var(--mint-100)' : 'var(--paper-tint)',
              color: visible ? 'var(--mint-700)' : 'var(--ink-500)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon name={visible ? 'eye' : 'eyeOff'} size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink-950)' }}>
                {visible ? 'Visible in marketplace' : 'Hidden from marketplace'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-600)', marginTop: 3 }}>
                {visible
                  ? 'Clients with browse access can find and contact you directly.'
                  : 'You are invisible to browsing clients. Enable to get direct inquiries.'}
              </div>
            </div>
          </div>
          {/* Toggle */}
          <button
            onClick={() => setVisible(!visible)}
            style={{
              width: 48, height: 26, borderRadius: 13, flexShrink: 0,
              background: visible ? 'var(--mint-500)' : 'var(--hairline-strong)',
              border: 'none', cursor: 'pointer', position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 3,
              left: visible ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%', background: 'white',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>

        {/* Form */}
        <div className="stack" style={{ gap: 18 }}>
          <div className="card reveal" style={{ padding: 22 }}>
            <div className="h-eyebrow" style={{ marginBottom: 16 }}>Profile details</div>

            <div className="stack" style={{ gap: 16 }}>
              <div className="field">
                <label className="field-label">Tagline</label>
                <input
                  className="input"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Brand filmmaker · 5+ years · Mumbai"
                />
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4, textAlign: 'right' }}>
                  {tagline.length}/100
                </div>
              </div>

              <div className="field">
                <label className="field-label">Bio</label>
                <textarea
                  className="textarea"
                  rows={5}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell clients about your background, specialisation, and what makes your work stand out…"
                />
              </div>

              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label className="field-label">Hourly rate (₹)</label>
                  <input
                    className="input"
                    type="number"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Response time</label>
                  <select
                    className="select"
                    value={responseTime}
                    onChange={e => setResponseTime(parseInt(e.target.value, 10))}
                  >
                    {RESPONSE_TIME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Languages</label>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  padding: '8px 10px', border: '1px solid var(--hairline)',
                  borderRadius: 'var(--radius-md)', background: 'var(--paper)',
                  minHeight: 42,
                }}>
                  {languages.map(lang => (
                    <span key={lang} style={{
                      display: 'inline-flex', gap: 5, alignItems: 'center',
                      padding: '3px 8px', background: 'var(--paper-tint)',
                      border: '1px solid var(--hairline)', borderRadius: 20,
                      fontSize: 12.5, color: 'var(--ink-800)',
                    }}>
                      {lang}
                      <button
                        type="button"
                        onClick={() => removeLanguage(lang)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--ink-400)', lineHeight: 1 }}
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </span>
                  ))}
                  <input
                    style={{ border: 'none', outline: 'none', fontSize: 13, background: 'transparent', minWidth: 120, flex: 1 }}
                    value={langInput}
                    onChange={e => setLangInput(e.target.value)}
                    onKeyDown={addLanguage}
                    placeholder={languages.length === 0 ? 'Type language + Enter…' : '+Add'}
                  />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-400)', marginTop: 4 }}>
                  Press Enter or comma to add each language
                </div>
              </div>
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button
              className="btn primary"
              onClick={() => { mutate(); if (bio !== profile.bio) saveBio() }}
              disabled={isPending || savingBio}
            >
              {isPending ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Preview</div>
          <div style={{
            background: 'var(--paper)', border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          }}>
            {/* Mini card preview */}
            <div style={{ height: 80, background: 'linear-gradient(135deg, var(--paper-tint), var(--paper-deep))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)' }}>
              <Icon name="image" size={28} />
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Avatar name={user?.full_name || 'You'} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-950)' }}>
                    {user?.full_name || 'Your name'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-600)', marginTop: 2 }}>
                    {tagline || 'Your tagline appears here'}
                  </div>
                </div>
                {visible && (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint-500)', marginTop: 5, flexShrink: 0 }} />
                )}
              </div>
              {bio && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-700)', marginTop: 10, lineHeight: 1.55 }}>
                  {bio.slice(0, 120)}{bio.length > 120 ? '…' : ''}
                </p>
              )}
              <div className="row" style={{ marginTop: 10, gap: 12, fontSize: 12, color: 'var(--ink-500)' }}>
                {hourlyRate && <span className="mono">{rupee(parseFloat(hourlyRate))}/hr</span>}
                {responseTime && <span>Responds in {RESPONSE_TIME_OPTIONS.find(o => o.value === responseTime)?.label}</span>}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-500)', textAlign: 'center' }}>
            {visible ? '✓ Visible to clients with browse access' : '○ Hidden from browse'}
          </div>
        </div>
      </div>
    </div>
  )
}