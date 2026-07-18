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
import AccountManager from '../components/social/AccountManager'

const GOOGLE_PLACES_SCRIPT_ID = 'creatyv-google-places-script'
let googlePlacesPromise = null

const loadGooglePlacesScript = (apiKey) => {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.google?.maps?.places) return Promise.resolve(true)
  if (!apiKey) return Promise.resolve(false)
  if (googlePlacesPromise) return googlePlacesPromise

  googlePlacesPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_PLACES_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true), { once: true })
      existingScript.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = GOOGLE_PLACES_SCRIPT_ID
    script.async = true
    script.defer = true
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places`
    script.onload = () => resolve(true)
    script.onerror = () => reject(new Error('Failed to load Google Places script'))
    document.head.appendChild(script)
  })

  return googlePlacesPromise
}

const DEFAULT_BRAND_ASSETS = {
  palette: [],
  logos: [],
  references: [],
  photos: [],
  files: [],
}

const DEFAULT_GOOGLE_BUSINESS = {
  listing_name: '',
  place_id: '',
  formatted_address: '',
  phone: '',
  website: '',
  maps_url: '',
}

const DEFAULT_POSTING_PREFERENCES = {
  festival_mode: 'manual',
  content_mode: 'admin_first',
  approval_mode: 'app_or_whatsapp',
  publish_mode: 'managed',
  cadence: 'monthly',
}

const normalizeObject = (value, fallback) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback
  return {
    ...fallback,
    ...value,
  }
}

const normalizeBrandAssets = (value) => {
  const assets = normalizeObject(value, DEFAULT_BRAND_ASSETS)
  return {
    ...DEFAULT_BRAND_ASSETS,
    ...assets,
    palette: Array.isArray(assets.palette) ? assets.palette : [],
    logos: Array.isArray(assets.logos) ? assets.logos : [],
    references: Array.isArray(assets.references) ? assets.references : [],
    photos: Array.isArray(assets.photos) ? assets.photos : [],
    files: Array.isArray(assets.files) ? assets.files : [],
  }
}

const normalizeGoogleBusiness = (value) => normalizeObject(value, DEFAULT_GOOGLE_BUSINESS)

const normalizePostingPreferences = (value) => normalizeObject(value, DEFAULT_POSTING_PREFERENCES)

const createPaletteColor = (hex = '#111111', label = 'Primary') => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  hex,
  label,
})

const suggestPaletteForBusiness = (name = '', type = '') => {
  const haystack = `${name} ${type}`.toLowerCase()
  if (/(food|restaurant|cafe|bakery|tea|coffee)/.test(haystack)) {
    return ['#5F3B24', '#E28B33', '#F7C97F', '#F5EEE6']
  }
  if (/(fashion|clothing|apparel|boutique|beauty|salon)/.test(haystack)) {
    return ['#1F2937', '#7C3AED', '#F9A8D4', '#FDF2F8']
  }
  if (/(fitness|gym|studio|coach|wellness|clinic)/.test(haystack)) {
    return ['#0F172A', '#14B8A6', '#99F6E4', '#E0F2FE']
  }
  if (/(retail|store|market|shop|electronics)/.test(haystack)) {
    return ['#111827', '#2563EB', '#93C5FD', '#F8FAFC']
  }
  return ['#111827', '#F97316', '#FDBA74', '#FDF4E8']
}

const normalizeHex = (value) => {
  const hex = String(value || '').trim()
  if (!hex) return '#111111'
  if (/^#?[0-9a-fA-F]{3}$/.test(hex)) {
    const normalized = hex.replace('#', '').split('').map((char) => char + char).join('')
    return `#${normalized.toUpperCase()}`
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.replace('#', '').toUpperCase()}`
  }
  return '#111111'
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams()
  const section = searchParams.get('section') || 'profile'
  const queryClient = useQueryClient()
  const pushToast   = useUIStore(s => s.pushToast)
  const { user, setAuth, refreshToken, accessToken, logout } = useAuthStore()

  // Profile fields
  const [fullName,  setFullName]  = useState(user?.full_name || '')
  const [phone,     setPhone]     = useState('')
  const [bio,       setBio]       = useState('')
  const [waNumber,  setWaNumber]  = useState('')
  const [businessName, setBusinessName] = useState('')
  const [city,      setCity]      = useState('')
  const [state,     setState]     = useState('')
  const [country,   setCountry]   = useState('')
  const [address,   setAddress]   = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [brandAssets, setBrandAssets] = useState(DEFAULT_BRAND_ASSETS)
  const [googleBusiness, setGoogleBusiness] = useState(DEFAULT_GOOGLE_BUSINESS)
  const [postingPreferences, setPostingPreferences] = useState(DEFAULT_POSTING_PREFERENCES)
  const [placesReady, setPlacesReady] = useState(Boolean(window.google?.maps?.places))
  const [businessSuggestions, setBusinessSuggestions] = useState([])
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const addressRef = useRef(null)
  const businessRef = useRef(null)
  const placesModuleRef = useRef(null)
  const businessSessionTokenRef = useRef(null)
  const addressSessionTokenRef = useRef(null)
  const businessPredictionTimerRef = useRef(null)
  const addressPredictionTimerRef = useRef(null)
  const brandAssetInputRef = useRef(null)
  const brandAssetKindRef = useRef('reference')
  
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
  const brandAssetsPalette = useMemo(() => Array.isArray(brandAssets?.palette) ? brandAssets.palette : [], [brandAssets])
  const brandAssetFiles = useMemo(() => Array.isArray(brandAssets?.files) ? brandAssets.files : [], [brandAssets])

  useEffect(() => {
    if (profile.full_name)      setFullName(profile.full_name)
    if (profile.phone)          setPhone(profile.phone || '')
    if (profile.bio)            setBio(profile.bio || '')
    if (profile.whatsapp_number) setWaNumber(profile.whatsapp_number || '')
    if (profile.business_name)   setBusinessName(profile.business_name || '')
    if (profile.address_line1)   setAddressLine1(profile.address_line1 || '')
    if (profile.address_city)   setCity(profile.address_city || '')
    if (profile.address_state)  setState(profile.address_state || '')
    if (profile.country)        setCountry(profile.country || '')
    if (profile.avatar_url)     setAvatarPreview(profile.avatar_url)
    setBrandAssets(normalizeBrandAssets(profile.brand_assets))
    setGoogleBusiness(normalizeGoogleBusiness(profile.google_business))
    setPostingPreferences(normalizePostingPreferences(profile.posting_preferences))
  }, [
    profile.id,
    profile.full_name,
    profile.phone,
    profile.bio,
    profile.whatsapp_number,
    profile.business_name,
    profile.address_line1,
    profile.address_city,
    profile.address_state,
    profile.country,
    profile.avatar_url,
    profile.brand_assets,
    profile.google_business,
    profile.posting_preferences,
  ])

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY?.trim()
    if (!apiKey) return
    loadGooglePlacesScript(apiKey)
      .then(() => setPlacesReady(true))
      .catch(() => setPlacesReady(false))
  }, [])

  useEffect(() => {
    if (!placesReady || !window.google?.maps?.importLibrary) return
    let cancelled = false

    ;(async () => {
      try {
        const places = await window.google.maps.importLibrary('places')
        if (!cancelled) {
          placesModuleRef.current = places
        }
      } catch (error) {
        if (!cancelled) setPlacesReady(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [placesReady])

  const extractPlaceDetails = (place) => {
    const components = place?.addressComponents || place?.address_components || []
    const find = (type) => components.find((component) => component.types?.includes(type))?.long_name || ''
    return {
      businessName: place?.displayName || place?.name || '',
      addressLine1: place?.formattedAddress || place?.formatted_address || '',
      city: find('locality') || find('sublocality') || find('administrative_area_level_2'),
      state: find('administrative_area_level_1'),
      country: find('country'),
    }
  }

  const applyPlaceSelection = (place) => {
    const details = extractPlaceDetails(place)
    if (details.businessName) setBusinessName(details.businessName)
    if (details.addressLine1) {
      setAddressLine1(details.addressLine1)
      setAddress(details.addressLine1)
    }
    if (details.city) setCity(details.city)
    if (details.state) setState(details.state)
    if (details.country) setCountry(details.country)
  }

  const applyPredictionSelection = async (suggestion, source = 'business') => {
    if (!suggestion?.placePrediction) return

    const description = suggestion.placePrediction?.mainText?.text
      || suggestion.placePrediction?.text?.text
      || suggestion.placePrediction?.text
      || ''

    const place = suggestion.placePrediction.toPlace()
    setBusinessSuggestions([])
    setAddressSuggestions([])

    try {
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'addressComponents'],
      })
      applyPlaceSelection(place)
      businessSessionTokenRef.current = null
      addressSessionTokenRef.current = null
    } catch (error) {
      if (source === 'business' && description) setBusinessName(description)
      if (source === 'address' && description) {
        setAddress(description)
        setAddressLine1(description)
      }
    }
  }

  useEffect(() => {
    if (businessPredictionTimerRef.current) clearTimeout(businessPredictionTimerRef.current)
    if (!placesReady || !placesModuleRef.current?.AutocompleteSuggestion) {
      setBusinessSuggestions([])
      return undefined
    }

    const value = businessName.trim()
    if (value.length < 2) {
      setBusinessSuggestions([])
      businessSessionTokenRef.current = null
      return undefined
    }

    businessPredictionTimerRef.current = setTimeout(() => {
      if (!businessSessionTokenRef.current) {
        businessSessionTokenRef.current = new placesModuleRef.current.AutocompleteSessionToken()
      }

      placesModuleRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions(
        {
          input: value,
          includedRegionCodes: ['in'],
          includedPrimaryTypes: ['establishment'],
          sessionToken: businessSessionTokenRef.current,
        }
      ).then(({ suggestions }) => {
        setBusinessSuggestions((suggestions || []).slice(0, 6))
      }).catch(() => setBusinessSuggestions([]))
    }, 220)

    return () => {
      if (businessPredictionTimerRef.current) clearTimeout(businessPredictionTimerRef.current)
    }
  }, [businessName, placesReady])

  useEffect(() => {
    if (addressPredictionTimerRef.current) clearTimeout(addressPredictionTimerRef.current)
    if (!placesReady || !placesModuleRef.current?.AutocompleteSuggestion) {
      setAddressSuggestions([])
      return undefined
    }

    const value = address.trim()
    if (value.length < 2) {
      setAddressSuggestions([])
      addressSessionTokenRef.current = null
      return undefined
    }

    addressPredictionTimerRef.current = setTimeout(() => {
      if (!addressSessionTokenRef.current) {
        addressSessionTokenRef.current = new placesModuleRef.current.AutocompleteSessionToken()
      }

      placesModuleRef.current.AutocompleteSuggestion.fetchAutocompleteSuggestions(
        {
          input: value,
          includedRegionCodes: ['in'],
          sessionToken: addressSessionTokenRef.current,
        }
      ).then(({ suggestions }) => {
        setAddressSuggestions((suggestions || []).slice(0, 6))
      }).catch(() => setAddressSuggestions([]))
    }, 220)

    return () => {
      if (addressPredictionTimerRef.current) clearTimeout(addressPredictionTimerRef.current)
    }
  }, [address, placesReady])

  useEffect(() => () => {
    if (businessPredictionTimerRef.current) clearTimeout(businessPredictionTimerRef.current)
    if (addressPredictionTimerRef.current) clearTimeout(addressPredictionTimerRef.current)
  }, [])

  // Save profile
  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: () => api.patch('/profile/me', {
      full_name:        fullName,
      phone:            phone || undefined,
      bio:              bio || undefined,
      business_name:    businessName || undefined,
      whatsapp_number:  waNumber || undefined,
      address_line1:    addressLine1 || address || undefined,
      address_city:     city || undefined,
      address_state:    state || undefined,
      country:          country || undefined,
      brand_assets: brandAssets,
      google_business: googleBusiness,
      posting_preferences: postingPreferences,
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

  const { mutate: uploadBrandAsset, isPending: uploadingBrandAsset } = useMutation({
    mutationFn: ({ file, kind, label, tempId }) => {
      const fd = new FormData()
      fd.append('asset', file)
      fd.append('kind', kind)
      fd.append('label', label || '')
      return api.post('/profile/me/brand-assets/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res, variables) => {
      const updatedProfile = res.data.data?.profile || res.data.data
      if (updatedProfile) {
        setBrandAssets(normalizeBrandAssets(updatedProfile.brand_assets))
        setGoogleBusiness(normalizeGoogleBusiness(updatedProfile.google_business))
        setPostingPreferences(normalizePostingPreferences(updatedProfile.posting_preferences))
        setAuth({ ...user, ...updatedProfile }, accessToken, refreshToken)
      }
      if (variables?.previewUrl) {
        URL.revokeObjectURL(variables.previewUrl)
      }
      pushToast({ title: 'Brand asset uploaded!', icon: 'check' })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] })
      queryClient.invalidateQueries({ queryKey: ['admin-brand'] })
    },
    onError: (err, variables) => {
      if (variables?.tempId) {
        setBrandAssets((current) => {
          const next = normalizeBrandAssets(current)
          return {
            ...next,
            logos: next.logos.filter((item) => item?.id !== variables.tempId),
            references: next.references.filter((item) => item?.id !== variables.tempId),
            photos: next.photos.filter((item) => item?.id !== variables.tempId),
            files: next.files.filter((item) => item?.id !== variables.tempId),
          }
        })
      }
      if (variables?.previewUrl) {
        URL.revokeObjectURL(variables.previewUrl)
      }
      pushToast({ title: 'Failed', body: err.response?.data?.message || 'Upload failed', tone: 'amber', icon: 'x' })
    },
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

  function handleBrandAssetInputChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const kind = brandAssetKindRef.current || 'reference'
    const previewUrl = URL.createObjectURL(file)
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const optimisticAsset = {
      id: tempId,
      kind,
      label: file.name.replace(/\.[^.]+$/, ''),
      name: file.name,
      url: previewUrl,
      preview_url: previewUrl,
      status: 'uploading',
      mime_type: file.type,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    }
    setBrandAssets((current) => {
      const next = normalizeBrandAssets(current)
      const inject = (list) => [optimisticAsset, ...list.filter((item) => item?.id !== tempId)]
      return {
        ...next,
        files: inject(next.files),
        logos: kind === 'logo' ? inject(next.logos) : next.logos,
        photos: kind === 'photo' ? inject(next.photos) : next.photos,
        references: kind === 'reference' ? inject(next.references) : next.references,
      }
    })
    uploadBrandAsset({
      file,
      kind,
      label: file.name.replace(/\.[^.]+$/, ''),
      tempId,
      previewUrl,
    })
    e.target.value = ''
  }

  const addPaletteColor = () => {
    setBrandAssets((current) => ({
      ...normalizeBrandAssets(current),
      palette: [...normalizeBrandAssets(current).palette, createPaletteColor()],
    }))
  }

  const updatePaletteColor = (index, patch) => {
    setBrandAssets((current) => {
      const next = normalizeBrandAssets(current)
      const palette = [...next.palette]
      palette[index] = {
        ...(palette[index] || createPaletteColor()),
        ...patch,
      }
      return { ...next, palette }
    })
  }

  const removePaletteColor = (index) => {
    setBrandAssets((current) => {
      const next = normalizeBrandAssets(current)
      return { ...next, palette: next.palette.filter((_, i) => i !== index) }
    })
  }

  const removeBrandAssetItem = (group, id) => {
    setBrandAssets((current) => {
      const next = normalizeBrandAssets(current)
      const cleanList = (list) => list.filter((item) => item?.id !== id)
      const updated = {
        ...next,
        [group]: cleanList(next[group] || []),
        files: cleanList(next.files),
      }
      return updated
    })
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
    ['profile', 'user', user?.role === 'client' ? 'Business profile' : 'Profile'],
    ...(user?.role === 'client' ? [['brand-assets', 'image', 'Brand assets']] : []),
    ...(user?.role === 'client' ? [['social', 'layers', 'Social accounts']] : []),
    ...(user?.role === 'client' ? [['google-business', 'globe', 'Google Business']] : []),
    ...(user?.role === 'client' ? [['posting-preferences', 'calendar', 'Posting preferences']] : []),
    ...(!['admin', 'designer'].includes(user?.role) ? [['verification', 'shield', 'Verification']] : []),
    ['security', 'lock', 'Password & security'],
    ['account', 'settings', 'Account info'],
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
        <hr className="my-2 border-ink-200" />
        <button 
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-red-600 hover:bg-red-50" 
          onClick={logout}
        >
          <Icon name="arrowRight" size={16} /> Sign out
        </button>
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
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ flex: 1 }} />
                {profile.phone_verified && (
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--mint-600)', gap: 4, padding: '0 8px' }}>
                        <Icon name="checkCircle" size={16} /> Verified
                    </div>
                )}
              </div>
            </div>
          </div>

          {user?.role !== 'admin' && (
            <div className="field">
              <label className="field-label">Bio</label>
              <textarea className="textarea" rows={3} value={bio} onChange={e => setBio(e.target.value)}
                placeholder="Tell others about yourself..." />
            </div>
          )}

          <div className="field" style={{ position: 'relative' }}>
            <label className="field-label">Business name / place</label>
            <input
              className="input"
              ref={businessRef}
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Start typing your business name..."
              autoComplete="off"
            />
            <div style={{ fontSize: 12, color: 'var(--ink-400)', marginTop: 4 }}>
              Select a place to auto-fill the full address, city, state, and country.
            </div>
            {!placesReady && (
              <div style={{ fontSize: 12, color: 'var(--rose)', marginTop: 6 }}>
                Google Places is not ready yet. Add <span className="mono">VITE_GOOGLE_PLACES_API_KEY</span> to enable suggestions.
              </div>
            )}
            {businessSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 'calc(100% + 6px)',
                  zIndex: 40,
                  background: 'white',
                  border: '1px solid var(--hairline)',
                  borderRadius: 14,
                  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)',
                  overflow: 'hidden',
                }}
              >
                {businessSuggestions.map((prediction) => (
                  <button
                    key={prediction.place_id}
                    type="button"
                    className="row between"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      gap: 12,
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyPredictionSelection(prediction, 'business')}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>
                        {prediction.structured_formatting?.main_text || prediction.description}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prediction.structured_formatting?.secondary_text || prediction.description}
                      </div>
                    </div>
                    <Icon name="arrowRight" size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="field" style={{ position: 'relative' }}>
             <label className="field-label">Address (Google Auto-fill)</label>
             <input
               className="input"
               ref={addressRef}
               value={address}
               onChange={e => {
                 setAddress(e.target.value)
                 setAddressLine1(e.target.value)
               }}
               placeholder="Start typing your address..."
               autoComplete="off"
             />
             {addressSuggestions.length > 0 && (
               <div
                 style={{
                   position: 'absolute',
                   left: 0,
                   right: 0,
                   top: 'calc(100% + 6px)',
                   zIndex: 40,
                   background: 'white',
                   border: '1px solid var(--hairline)',
                   borderRadius: 14,
                   boxShadow: '0 20px 45px rgba(15, 23, 42, 0.14)',
                   overflow: 'hidden',
                 }}
               >
                 {addressSuggestions.map((prediction) => (
                   <button
                     key={prediction.place_id}
                     type="button"
                     className="row between"
                     style={{
                       width: '100%',
                       padding: '12px 14px',
                       border: 'none',
                       background: 'transparent',
                       textAlign: 'left',
                       cursor: 'pointer',
                       gap: 12,
                     }}
                     onMouseDown={(e) => e.preventDefault()}
                     onClick={() => applyPredictionSelection(prediction, 'address')}
                   >
                     <div style={{ minWidth: 0 }}>
                       <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-900)' }}>
                         {prediction.structured_formatting?.main_text || prediction.description}
                       </div>
                       <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                         {prediction.structured_formatting?.secondary_text || prediction.description}
                       </div>
                     </div>
                     <Icon name="arrowRight" size={14} />
                   </button>
                 ))}
               </div>
             )}
          </div>

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

          <div className="field">
            <label className="field-label">Country</label>
            <input className="input" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. India" />
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

      {/* Brand assets */}
      {section === 'brand-assets' && user?.role === 'client' && (
        <div className="stack" style={{ gap: 16 }}>
          <div className="card reveal" style={{ padding: 24 }}>
            <div className="h-eyebrow" style={{ marginBottom: 10 }}>Brand assets</div>
            <h2 style={{ margin: 0 }}>Keep the brand identity optional, rich, and easy to grow</h2>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Add colors, logos, product photos, and reference images here. Mintbox will surface them later as a shared working library.
            </p>
          </div>

          <div className="grid-2" style={{ gap: 16 }}>
            <div className="card reveal" style={{ padding: 24 }}>
              <div className="row between" style={{ gap: 12, marginBottom: 16 }}>
                <div>
                  <div className="h-eyebrow">Palette builder</div>
                  <p className="muted" style={{ margin: '4px 0 0' }}>Use hex values or visual swatches. Add as many colors as you want.</p>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn ghost" type="button" onClick={() => setBrandAssets((current) => ({
                    ...normalizeBrandAssets(current),
                    palette: suggestPaletteForBusiness(profile.business_name, profile.business_type).map((hex, index) => createPaletteColor(hex, ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`)),
                  }))}>
                    <Icon name="sparkles" size={14} /> Suggest palette
                  </button>
                  <button className="btn ghost" type="button" onClick={addPaletteColor}>
                    <Icon name="plus" size={14} /> Add color
                  </button>
                </div>
              </div>

              <div className="stack" style={{ gap: 10 }}>
                {brandAssetsPalette.length === 0 ? (
                  <div className="muted">No colors added yet. Start with a primary brand color.</div>
                ) : brandAssetsPalette.map((color, index) => (
                  <div key={color.id || index} className="card" style={{ padding: 14 }}>
                    <div className="row between" style={{ gap: 12, alignItems: 'center' }}>
                      <div className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
                        <input
                          type="color"
                          value={normalizeHex(color.hex)}
                          onChange={(e) => updatePaletteColor(index, { hex: normalizeHex(e.target.value) })}
                          style={{ width: 44, height: 44, border: 'none', background: 'transparent', padding: 0 }}
                        />
                        <div className="stack" style={{ gap: 6, flex: 1, minWidth: 0 }}>
                          <input
                            className="input"
                            value={color.label || ''}
                            onChange={(e) => updatePaletteColor(index, { label: e.target.value })}
                            placeholder={`Color ${index + 1} label`}
                          />
                          <input
                            className="input mono"
                            value={normalizeHex(color.hex)}
                            onChange={(e) => updatePaletteColor(index, { hex: normalizeHex(e.target.value) })}
                            placeholder="#111111"
                          />
                        </div>
                      </div>
                      <button className="btn ghost" type="button" onClick={() => removePaletteColor(index)}>
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card reveal" style={{ padding: 24 }}>
              <div className="h-eyebrow" style={{ marginBottom: 10 }}>Upload brand assets</div>
              <p className="muted" style={{ margin: '4px 0 16px' }}>
                Upload a logo, reference image, or product photo. Files stay optional and can be refined later.
              </p>

              <input
                ref={brandAssetInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleBrandAssetInputChange}
              />

              <div className="grid-2" style={{ gap: 12 }}>
                {[
                  ['logo', 'Logo', 'image'],
                  ['reference', 'Reference image', 'layers'],
                  ['photo', 'Product photo', 'image'],
                ].map(([kind, label, icon]) => (
                  <button
                    key={kind}
                    type="button"
                    className="card"
                    style={{ padding: 16, textAlign: 'left' }}
                    onClick={() => {
                      brandAssetKindRef.current = kind
                      brandAssetInputRef.current?.click()
                    }}
                    disabled={uploadingBrandAsset}
                  >
                    <div className="row between" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div className="h-eyebrow">{label}</div>
                        <div className="muted" style={{ marginTop: 6 }}>Choose an image to add to the brand library.</div>
                      </div>
                      <Icon name={icon} size={16} />
                    </div>
                  </button>
                ))}
              </div>

              <div className="stack" style={{ gap: 12, marginTop: 18 }}>
                <div className="row between">
                  <div className="h-eyebrow">Saved assets</div>
                  <button className="btn ghost" type="button" onClick={saveProfile} disabled={savingProfile}>
                    {savingProfile ? 'Saving...' : 'Save brand setup'}
                  </button>
                </div>

                {brandAssetFiles.length === 0 ? (
                  <div className="muted">No assets uploaded yet.</div>
                ) : (
                  <div className="grid-2" style={{ gap: 10 }}>
                    {brandAssetFiles.slice(0, 12).map((asset) => (
                      <div key={asset.id} className="card" style={{ padding: 12 }}>
                        <img
                          src={asset.preview_url || (typeof asset.url === 'string' ? asset.url : '')}
                          alt={asset.label || asset.name}
                          style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }}
                        />
                        <div className="row between" style={{ gap: 8, marginTop: 10, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {asset.label || asset.name}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                              {asset.kind || 'reference'}
                            </div>
                            {asset.status === 'uploading' && <div className="badge neutral" style={{ marginTop: 6 }}>Uploading...</div>}
                          </div>
                          <button className="btn ghost" type="button" onClick={() => removeBrandAssetItem(asset.kind === 'logo' ? 'logos' : asset.kind === 'photo' ? 'photos' : 'references', asset.id)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Business */}
      {section === 'google-business' && user?.role === 'client' && (
        <div className="card reveal" style={{ padding: 24 }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Google Business</div>
          <h2 style={{ margin: 0 }}>Connect the business listing separately</h2>
          <p className="muted" style={{ margin: '8px 0 18px' }}>
            This keeps your business presence distinct from social publishing accounts.
          </p>

          <div className="grid-2" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">Listing name</label>
              <input className="input" value={googleBusiness.listing_name || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, listing_name: e.target.value }))} placeholder="Business name on Google" />
            </div>
            <div className="field">
              <label className="field-label">Place ID</label>
              <input className="input mono" value={googleBusiness.place_id || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, place_id: e.target.value }))} placeholder="Google Place ID" />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="field-label">Formatted address</label>
            <textarea className="textarea" rows={3} value={googleBusiness.formatted_address || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, formatted_address: e.target.value }))} placeholder="Complete address from Google" />
          </div>

          <div className="grid-2" style={{ gap: 14, marginTop: 14 }}>
            <div className="field">
              <label className="field-label">Phone</label>
              <input className="input" value={googleBusiness.phone || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, phone: e.target.value }))} placeholder="+91 ..." />
            </div>
            <div className="field">
              <label className="field-label">Website</label>
              <input className="input" value={googleBusiness.website || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, website: e.target.value }))} placeholder="https://..." />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label className="field-label">Maps URL</label>
            <input className="input" value={googleBusiness.maps_url || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, maps_url: e.target.value }))} placeholder="Google Maps link" />
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save Google Business'}
            </button>
          </div>
        </div>
      )}

      {/* Posting preferences */}
      {section === 'posting-preferences' && user?.role === 'client' && (
        <div className="card reveal" style={{ padding: 24 }}>
          <div className="h-eyebrow" style={{ marginBottom: 10 }}>Posting preferences</div>
          <h2 style={{ margin: 0 }}>Choose how much we manage for you</h2>
          <p className="muted" style={{ margin: '8px 0 18px' }}>
            These preferences keep the workflow flexible: manual when you want it, managed when you want us to keep things moving.
          </p>

          <div className="stack" style={{ gap: 14 }}>
            {[
              ['festival_mode', 'Festival handling', [
                ['manual', 'Manual'],
                ['managed', 'Managed'],
              ]],
              ['content_mode', 'Content planning', [
                ['admin_first', 'Admin first'],
                ['client_review', 'Client review'],
              ]],
              ['approval_mode', 'Approval flow', [
                ['app_or_whatsapp', 'App or WhatsApp'],
                ['app_only', 'App only'],
                ['whatsapp_only', 'WhatsApp only'],
              ]],
              ['publish_mode', 'Publishing mode', [
                ['managed', 'Managed'],
                ['manual', 'Manual'],
              ]],
              ['cadence', 'Cadence', [
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly'],
                ['campaign_based', 'Campaign based'],
              ]],
            ].map(([key, label, options]) => (
              <div key={key} className="field">
                <label className="field-label">{label}</label>
                <div className="row wrap" style={{ gap: 8 }}>
                  {options.map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      className={`btn ${postingPreferences[key] === value ? 'primary' : 'ghost'}`}
                      onClick={() => setPostingPreferences((current) => ({ ...current, [key]: value }))}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save posting preferences'}
            </button>
          </div>
        </div>
      )}

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

      {/* Social Accounts */}
      {section === 'social' && user?.role === 'client' && <AccountManager />}
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
            title: 'Brand assets',
            body: brandAssetsPalette.length || brandAssetFiles.length ? 'Palette and brand assets are ready.' : 'Add optional logos, reference images, and colors.',
            done: brandAssetsPalette.length > 0 || brandAssetFiles.length > 0,
            action: () => setSearchParams({ section: 'brand-assets' }),
          },
          {
            title: 'Social accounts',
            body: connectedSocialAccounts.length ? `${connectedSocialAccounts.length} account${connectedSocialAccounts.length === 1 ? '' : 's'} connected.` : 'Connect Facebook, Instagram, or YouTube for analytics.',
            done: connectedSocialAccounts.length > 0,
            action: () => window.location.assign('/social'),
          },
          {
            title: 'Google Business',
            body: googleBusiness.listing_name ? `Linked to ${googleBusiness.listing_name}.` : 'Add your Google listing, phone, and maps details.',
            done: Boolean(googleBusiness.listing_name || googleBusiness.formatted_address),
            action: () => setSearchParams({ section: 'google-business' }),
          },
          {
            title: 'Posting preferences',
            body: postingPreferences.publish_mode ? `Publishing mode: ${postingPreferences.publish_mode}.` : 'Choose manual or managed preferences.',
            done: Boolean(postingPreferences.publish_mode),
            action: () => setSearchParams({ section: 'posting-preferences' }),
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
