import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import { rupee } from '../../utils/format'
import { CREATIVE_SKILLS } from '../../data/creativeOptions'

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
  const [skills,        setSkills]        = useState([])
  const [visible,       setVisible]       = useState(false)
  const [langInput,     setLangInput]     = useState('')

  // Populate form from fetched profile
  useEffect(() => {
    if (profile.tagline)              setTagline(profile.tagline || '')
    if (profile.bio)                  setBio(profile.bio || '')
    if (profile.hourly_rate)          setHourlyRate(profile.hourly_rate || '')
    if (profile.response_time_hours)  setResponseTime(profile.response_time_hours || 24)
    if (profile.languages)            setLanguages(profile.languages || [])
    if (profile.skills)               setSkills(profile.skills || [])
    if (typeof profile.marketplace_visible === 'boolean') setVisible(profile.marketplace_visible)
  }, [profile.id])

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      await api.patch('/freelancers/me/marketplace', {
        tagline: tagline || undefined,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        response_time_hours: responseTime,
        languages,
        marketplace_visible: visible,
      })
      await api.patch('/profile/me', { bio, skills })
    },
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
    <div className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-ink-500 tracking-wide uppercase">Marketplace</div>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-ink-950 tracking-tight m-0">Your public profile</h1>
        <p className="text-ink-600 mt-2 text-sm md:text-base">
          This is what clients see when they browse the marketplace.
        </p>
      </div>

      {/* Visibility toggle */}
      <div className={`rounded-2xl p-6 transition-colors duration-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 ${
        visible ? 'bg-orange-50/50 border-[1.5px] border-orange-500/40 shadow-sm' : 'bg-white border border-ink-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              visible ? 'bg-mint-100 text-mint-700' : 'bg-ink-50 text-ink-500'
            }`}>
              <Icon name={visible ? 'eye' : 'eyeOff'} size={20} />
            </div>
            <div>
              <div className="font-bold text-base md:text-lg text-ink-950">
                {visible ? 'Visible in marketplace' : 'Hidden from marketplace'}
              </div>
              <div className="text-sm text-ink-600 mt-1">
                {visible
                  ? 'Clients with browse access can find and contact you directly.'
                  : 'You are invisible to browsing clients. Enable to get direct inquiries.'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setVisible(!visible)}
            className={`w-14 h-8 rounded-full shrink-0 relative transition-colors duration-300 ${
              visible ? 'bg-mint-500' : 'bg-ink-200'
            }`}
          >
            <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-300 ${
              visible ? 'left-7' : 'left-1'
            }`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        {/* Form */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white border border-ink-200 rounded-3xl p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-display font-bold text-ink-950 mb-6">Profile details</h2>

            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-ink-900">Tagline</label>
                <input
                  className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. Brand filmmaker · 5+ years · Mumbai"
                />
                <div className="text-xs text-ink-400 text-right">
                  {tagline.length}/100
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-ink-900">Bio</label>
                <textarea
                  className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all resize-y"
                  rows={5}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell clients about your background, specialisation, and what makes your work stand out…"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-ink-900">Hourly rate (₹)</label>
                  <input
                    className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all"
                    type="number"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-ink-900">Response time</label>
                  <select
                    className="w-full bg-ink-50 border border-ink-200 focus:border-mint-500 focus:ring-4 focus:ring-mint-500/10 rounded-xl px-4 py-3 text-sm transition-all"
                    value={responseTime}
                    onChange={e => setResponseTime(parseInt(e.target.value, 10))}
                  >
                    {RESPONSE_TIME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-ink-900">Languages</label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[52px] bg-ink-50 border border-ink-200 rounded-xl items-center focus-within:border-mint-500 focus-within:ring-4 focus-within:ring-mint-500/10 transition-all">
                  {languages.map(lang => (
                    <span key={lang} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink-200 rounded-lg text-sm text-ink-800 shadow-sm">
                      {lang}
                      <button
                        type="button"
                        onClick={() => removeLanguage(lang)}
                        className="text-ink-400 hover:text-ink-600 focus:outline-none"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </span>
                  ))}
                  <input
                    className="flex-1 min-w-[120px] bg-transparent border-none focus:outline-none text-sm px-2"
                    value={langInput}
                    onChange={e => setLangInput(e.target.value)}
                    onKeyDown={addLanguage}
                    placeholder={languages.length === 0 ? 'Type language + Enter…' : '+ Add'}
                  />
                </div>
                <div className="text-xs text-ink-400 mt-1">
                  Press Enter or comma to add each language
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-ink-900">Creative skills</label>
                <div className="flex flex-wrap gap-2">
                  {CREATIVE_SKILLS.map(skill => {
                    const active = skills.includes(skill)
                    return (
                      <button 
                        type="button" 
                        key={skill} 
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                          active ? 'bg-mint-100 text-mint-800 border-mint-200 shadow-sm' : 'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'
                        } border`}
                        onClick={() => setSkills(active ? skills.filter(item => item !== skill) : [...skills, skill])}
                      >
                        {active && <Icon name="check" size={14} />} {skill}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <button
              className="px-8 py-3.5 bg-ink-950 hover:bg-ink-900 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => { mutate(); if (bio !== profile.bio) saveBio() }}
              disabled={isPending || savingBio}
            >
              {isPending ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-1 sticky top-8">
          <div className="text-sm font-semibold text-ink-500 mb-3 tracking-wide uppercase">Preview</div>
          <div className="bg-white border border-ink-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {/* Mini card preview header */}
            <div className="h-24 bg-gradient-to-br from-ink-100 to-ink-50 flex items-center justify-center text-ink-300 relative">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')] opacity-50" />
              <Icon name="image" size={32} className="relative z-10" />
            </div>
            <div className="p-5 md:p-6">
              <div className="flex gap-4 items-start">
                <Avatar name={user?.full_name || 'You'} />
                <div className="flex-1">
                  <div className="text-base font-bold text-ink-950 flex items-center gap-2">
                    {user?.full_name || 'Your name'}
                    {visible && <div className="w-2 h-2 rounded-full bg-mint-500 shrink-0" title="Visible" />}
                  </div>
                  <div className="text-sm text-ink-600 mt-1 leading-snug">
                    {tagline || 'Your tagline appears here'}
                  </div>
                </div>
              </div>
              {bio && (
                <p className="text-sm text-ink-700 mt-4 leading-relaxed line-clamp-4">
                  {bio}
                </p>
              )}
              <div className="flex flex-wrap mt-5 gap-3 text-sm text-ink-600 bg-ink-50/50 p-3 rounded-xl">
                {hourlyRate && (
                  <span className="font-mono font-medium flex items-center gap-1 text-ink-900">
                    <Icon name="rupee" size={14} className="text-ink-400" />
                    {parseFloat(hourlyRate)}/hr
                  </span>
                )}
                {responseTime && (
                  <span className="flex items-center gap-1.5 text-ink-500">
                    <Icon name="clock" size={14} />
                    Responds {RESPONSE_TIME_OPTIONS.find(o => o.value === responseTime)?.label}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs font-medium text-ink-500 text-center flex items-center justify-center gap-1.5">
            {visible ? (
              <><Icon name="check" size={14} className="text-mint-500" /> Visible to browsing clients</>
            ) : (
              <><Icon name="eyeOff" size={14} /> Hidden from browse</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
