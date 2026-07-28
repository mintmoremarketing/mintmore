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
  tone: 'friendly',
  target_ages: [],
  avoided_words: '',
  mandatory_words: '',
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
  festival_mode: 'autopilot',
  content_mode: 'admin_first',
  approval_mode: 'app_or_whatsapp',
  publish_mode: 'managed',
  cadence: 'monthly',
  festivals: ['diwali', 'holi'],
  festival_lead_days: 5,
  evergreen_ratio: 50,
  custom_requests: [],
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
    tone: assets.tone || 'friendly',
    target_ages: Array.isArray(assets.target_ages) ? assets.target_ages : [],
    avoided_words: assets.avoided_words || '',
    mandatory_words: assets.mandatory_words || '',
  }
}

const normalizeGoogleBusiness = (value) => normalizeObject(value, DEFAULT_GOOGLE_BUSINESS)

const normalizePostingPreferences = (value) => {
  const prefs = normalizeObject(value, DEFAULT_POSTING_PREFERENCES)
  return {
    ...DEFAULT_POSTING_PREFERENCES,
    ...prefs,
    festival_mode: prefs.festival_mode || 'autopilot',
    festivals: Array.isArray(prefs.festivals) ? prefs.festivals : ['diwali', 'holi'],
    festival_lead_days: typeof prefs.festival_lead_days === 'number' ? prefs.festival_lead_days : 5,
    evergreen_ratio: typeof prefs.evergreen_ratio === 'number' ? prefs.evergreen_ratio : 50,
    custom_requests: Array.isArray(prefs.custom_requests) ? prefs.custom_requests : [],
  }
}

const createPaletteColor = (hex = '#111111', label = 'Primary') => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  hex,
  label,
})

const CURATED_PALETTES = {
  restaurant: [
    ['#5F3B24', '#E28B33', '#F7C97F', '#F5EEE6'],
    ['#3E5A44', '#D4A373', '#E9D8A6', '#FEFAE0'],
    ['#A22223', '#E6953C', '#F4E9CD', '#362224'],
    ['#1B3B2B', '#E5A93B', '#FDF5E6', '#F3D299'],
    ['#6B2D5C', '#E26D5C', '#FFEAD2', '#4A154B'],
    ['#264653', '#2A9D8F', '#E9C46A', '#F4A261'],
  ],
  fashion: [
    ['#1F2937', '#7C3AED', '#F9A8D4', '#FDF2F8'],
    ['#2B2B2A', '#D9C5B2', '#F3EFE0', '#7E7F83'],
    ['#1E2022', '#C9A0DC', '#F0EBCC', '#3D3D3D'],
    ['#800020', '#C5A059', '#F9F6F0', '#1C1C1C'],
    ['#1A2530', '#8D99AE', '#EDF2F4', '#D90429'],
    ['#2A363B', '#99B898', '#E84A5F', '#FECEA8'],
  ],
  fitness: [
    ['#0F172A', '#14B8A6', '#99F6E4', '#E0F2FE'],
    ['#111827', '#EF4444', '#FCA5A5', '#FFF5F5'],
    ['#1E1E24', '#F4D35E', '#EE964B', '#F95738'],
    ['#0A1128', '#0070F3', '#79FFE1', '#F4F5F6'],
    ['#22252A', '#4E9F3D', '#D8B4F8', '#191A1F'],
    ['#03071E', '#370617', '#E85D04', '#FFBA08'],
  ],
  education: [
    ['#111827', '#2563EB', '#93C5FD', '#F8FAFC'],
    ['#0D1B2A', '#415A77', '#A3B18A', '#E0E1DD'],
    ['#1A3A3A', '#2D7F7F', '#E2F0F0', '#F7FCFC'],
    ['#1D3557', '#457B9D', '#A8DADC', '#F1FAEE'],
    ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C'],
    ['#191919', '#1E56A0', '#F6F6F6', '#D6E4F0'],
  ],
  wedding: [
    ['#4E0E2E', '#C29F68', '#E6C594', '#FDFBF7'],
    ['#5C3D46', '#D6AD60', '#F4EBD0', '#FFFDF9'],
    ['#3D0C11', '#D4AF37', '#FFF3CD', '#1C0A00'],
    ['#4C1C24', '#C98CA7', '#FFF0F5', '#EAD5C3'],
    ['#311E26', '#E0A96D', '#FFF6EB', '#201A1E'],
    ['#2B1B17', '#B38B6D', '#FDF6F0', '#ECE3D4'],
  ],
  salon: [
    ['#2C1A1D', '#D4AF37', '#F5E6E8', '#FFF8F9'],
    ['#1A120B', '#3C2A21', '#D5CEA3', '#E5E5CB'],
    ['#202020', '#CBB893', '#F2EFE9', '#DCD3C4'],
    ['#3A3042', '#DB9D47', '#FFEBEE', '#4E4158'],
    ['#212121', '#C5A880', '#EAE3D2', '#F9F6F0'],
    ['#3B2244', '#C3989F', '#F0E5D8', '#FAF6F0'],
  ],
  hotel: [
    ['#0B2545', '#134074', '#8DA9C4', '#EEF4F8'],
    ['#1D2A44', '#85586F', '#DFD3C3', '#F7F5F2'],
    ['#112233', '#A370F7', '#D1C4E9', '#F3E5F5'],
    ['#2C3639', '#A27B5C', '#DCD7C9', '#3F4E4F'],
    ['#1F3A52', '#00A699', '#E0F2FE', '#0D1E2D'],
    ['#1A1C1E', '#D4AF37', '#F7F7F7', '#EAEAEA'],
  ],
  other: [
    ['#111827', '#F97316', '#FDBA74', '#FDF4E8'],
    ['#000000', '#4F46E5', '#C7D2FE', '#F5F7FF'],
    ['#1E293B', '#10B981', '#A7F3D0', '#F0FDF4'],
    ['#0F172A', '#6366F1', '#818CF8', '#EEF2FF'],
    ['#1C1D21', '#E76F51', '#F4A261', '#E9C46A'],
    ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C'],
  ],
}

const suggestPaletteForBusiness = (name = '', type = '', currentPalette = []) => {
  const haystack = `${name} ${type}`.toLowerCase()
  let list = CURATED_PALETTES.other
  if (/(food|restaurant|cafe|bakery|tea|coffee)/.test(haystack)) {
    list = CURATED_PALETTES.restaurant
  } else if (/(fashion|clothing|apparel|boutique|beauty|salon)/.test(haystack)) {
    list = CURATED_PALETTES.fashion
  } else if (/(fitness|gym|studio|coach|wellness|clinic)/.test(haystack)) {
    list = CURATED_PALETTES.fitness
  } else if (/(retail|store|market|shop|electronics)/.test(haystack)) {
    list = CURATED_PALETTES.other
  } else if (/(school|college|coaching|education|institute|training)/.test(haystack)) {
    list = CURATED_PALETTES.education
  } else if (/(wedding|event|planner|marriage|mandap)/.test(haystack)) {
    list = CURATED_PALETTES.wedding
  } else if (/(salon|spa|beauty|parlour|grooming)/.test(haystack)) {
    list = CURATED_PALETTES.salon
  } else if (/(hotel|resort|stay|homestay|villa)/.test(haystack)) {
    list = CURATED_PALETTES.hotel
  }

  const currentHexes = (currentPalette || []).map(c => (c.hex || '').toUpperCase())
  const candidatePalettes = list.filter(p => {
    const matchCount = p.filter(hex => currentHexes.includes(hex.toUpperCase())).length
    return matchCount < 4
  })

  return candidatePalettes.length > 0
    ? candidatePalettes[Math.floor(Math.random() * candidatePalettes.length)]
    : list[Math.floor(Math.random() * list.length)]
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
  const [businessType, setBusinessType] = useState('')
  const [city,      setCity]      = useState('')
  const [state,     setState]     = useState('')
  const [country,   setCountry]   = useState('')
  const [address,   setAddress]   = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [brandAssets, setBrandAssets] = useState(DEFAULT_BRAND_ASSETS)
  const [googleBusiness, setGoogleBusiness] = useState(DEFAULT_GOOGLE_BUSINESS)
  const [postingPreferences, setPostingPreferences] = useState(DEFAULT_POSTING_PREFERENCES)
  const [customRequestText, setCustomRequestText] = useState('')
  const [submittingRequest, setSubmittingRequest] = useState(false)
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
  const logoSettingsFileInputRef = useRef(null)
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
    if (profile.business_type)   setBusinessType(profile.business_type || '')
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
    profile.business_type,
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
      business_type:    businessType || undefined,
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

    if (kind === 'logo') {
      extractPaletteFromImage(file).then(hexes => {
        const newPalette = hexes.map((hex, index) => createPaletteColor(hex, ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`))
        setBrandAssets((current) => ({
          ...normalizeBrandAssets(current),
          palette: newPalette,
        }))
        pushToast({ title: 'Extracted brand colors from uploaded logo!', icon: 'check' })
      })
    }

    e.target.value = ''
  }

  const extractPaletteFromImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 100;
          canvas.height = 100;
          ctx.drawImage(img, 0, 0, 100, 100);
          const data = ctx.getImageData(0, 0, 100, 100).data;
          
          const colorCounts = {};
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const a = data[i+3];
            if (a < 128) continue;
            
            const qr = Math.round(r / 16) * 16;
            const qg = Math.round(g / 16) * 16;
            const qb = Math.round(b / 16) * 16;
            const rgb = `${qr},${qg},${qb}`;
            
            const brightness = (qr + qg + qb) / 3;
            if (brightness > 240 || brightness < 15) continue;
            
            colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;
          }
          
          const sortedColors = Object.keys(colorCounts)
            .sort((a, b) => colorCounts[b] - colorCounts[a])
            .map(rgb => {
              const [r, g, b] = rgb.split(',').map(Number);
              const toHex = (c) => c.toString(16).padStart(2, '0');
              return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
            });
            
          const uniqueHexes = [];
          for (const hex of sortedColors) {
            if (uniqueHexes.length >= 4) break;
            const isTooSimilar = uniqueHexes.some(existing => {
              const r1 = parseInt(existing.slice(1, 3), 16);
              const g1 = parseInt(existing.slice(3, 5), 16);
              const b1 = parseInt(existing.slice(5, 7), 16);
              const r2 = parseInt(hex.slice(1, 3), 16);
              const g2 = parseInt(hex.slice(3, 5), 16);
              const b2 = parseInt(hex.slice(5, 7), 16);
              const dist = Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
              return dist < 45;
            });
            if (!isTooSimilar) {
              uniqueHexes.push(hex);
            }
          }
          
          const defaults = ['#0F172A', '#0284C7', '#F59E0B', '#10B981'];
          while (uniqueHexes.length < 4) {
            const nextFallback = defaults.find(d => !uniqueHexes.includes(d));
            if (nextFallback) {
              uniqueHexes.push(nextFallback);
            } else {
              uniqueHexes.push('#64748B');
            }
          }
          resolve(uniqueHexes);
        };
        img.onerror = () => resolve(['#0F172A', '#0284C7', '#F59E0B', '#10B981']);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(['#0F172A', '#0284C7', '#F59E0B', '#10B981']);
      reader.readAsDataURL(file);
    });
  };

  const handleLogoSettingsColorExtraction = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    pushToast({ title: 'Extracting brand colors from logo...', icon: 'sparkles' })
    const hexes = await extractPaletteFromImage(file)
    const currentLen = brandAssetsPalette.length > 0 ? brandAssetsPalette.length : 4
    const newPalette = hexes.slice(0, currentLen).map((hex, index) => createPaletteColor(hex, ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`))
    setBrandAssets((current) => ({
      ...normalizeBrandAssets(current),
      palette: newPalette,
    }))
    pushToast({ title: 'Extracted brand colors applied to palette!', icon: 'check' })
  }

  const addPaletteColor = () => {
    setBrandAssets((current) => ({
      ...normalizeBrandAssets(current),
      palette: [...normalizeBrandAssets(current).palette, createPaletteColor()],
    }))
  }

  const handleSetColorCount = (count) => {
    setBrandAssets((current) => {
      const next = normalizeBrandAssets(current)
      let palette = [...next.palette]
      if (palette.length > count) {
        palette = palette.slice(0, count)
      } else if (palette.length < count) {
        const suggestion = suggestPaletteForBusiness(profile.business_name, profile.business_type, palette)
        while (palette.length < count) {
          const index = palette.length
          const hex = suggestion[index] || '#111111'
          palette.push(createPaletteColor(hex, ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`))
        }
      }
      return { ...next, palette }
    })
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

  const removeBrandAssetItem = async (group, id) => {
    // Build the updated state first
    const next = normalizeBrandAssets(brandAssets)
    const cleanList = (list) => list.filter((item) => item?.id !== id)
    const updated = {
      ...next,
      [group]: cleanList(next[group] || []),
      files: cleanList(next.files),
    }

    // Update local state immediately so the UI responds
    setBrandAssets(updated)

    // Persist to backend so it survives logout/login
    try {
      await api.patch('/profile/me', { brand_assets: updated })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      pushToast({ title: 'Asset deleted', icon: 'check' })
    } catch (err) {
      pushToast({ title: 'Delete failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
    }
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
    ...(user?.role === 'client' ? [['posting-preferences', 'calendar', 'Posting cadence']] : []),
    ...(user?.role === 'client' ? [['smart-festival-plan', 'sparkles', 'Smart Festival Plan']] : []),
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
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 mb-6">
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-ink-950 to-ink-600 m-0 pb-1">
          {sections.find(([id]) => id === section)?.[2] || 'Account settings'}
        </h1>
        <p className="text-ink-500 text-lg md:text-xl font-medium max-w-2xl mt-2 mb-0">
          Manage your personal and business details, connected accounts, and system preferences.
        </p>
      </div>

      {/* Profile & Account */}
      {section === 'profile' && (
        <div className="flex flex-col gap-6">
          {/* Avatar */}
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            <h2 className="text-lg font-bold text-ink-950 mb-6 tracking-tight">Profile photo</h2>
            <div className="flex flex-col md:flex-row gap-6 md:items-center">
              <div className="relative shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-4 border-white shadow-md" />
                ) : (
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-ink-100 to-ink-200 text-ink-500 flex items-center justify-center font-display text-3xl font-medium border-4 border-white shadow-md">
                    {(profile.full_name || 'U').split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-start">
                <div className="text-xl font-bold text-ink-950 mb-1">{profile.full_name}</div>
                <div className="text-sm font-medium text-ink-500 capitalize mb-4">
                  {profile.role} • {profile.email}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-ink-50 text-ink-700 hover:bg-ink-100 transition-colors border border-ink-200"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Icon name="image" size={16} /> Choose photo
                  </button>
                  {avatarFile && (
                    <button
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-mint-500 text-white hover:bg-mint-600 transition-colors shadow-sm"
                      onClick={() => uploadAvatar()}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? 'Uploading...' : 'Save photo'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal info */}
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-mint-50 text-mint-600 flex items-center justify-center">
                <Icon name="briefcase" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Personal & Business Info</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Update your contact details and business location</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Full name</label>
                  <input className="input w-full bg-ink-50" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Phone number</label>
                  <div className="flex gap-2">
                    <input className="input w-full bg-ink-50" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                    {profile.phone_verified && (
                      <div className="flex items-center text-emerald-600 gap-1 px-3 bg-emerald-50 rounded-xl text-sm font-bold border border-emerald-100">
                        <Icon name="checkCircle" size={16} /> Verified
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {user?.role !== 'admin' && (
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Bio</label>
                  <textarea className="textarea w-full bg-ink-50" rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell others about yourself..." />
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Business name / place</label>
                <input
                  className="input w-full bg-ink-50"
                  ref={businessRef}
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="Start typing your business name..."
                  autoComplete="off"
                />
                <div className="text-xs font-medium text-ink-500 mt-2 flex items-center gap-1.5">
                  <Icon name="search" size={14} /> Select a place to auto-fill the full address, city, state, and country.
                </div>
                {!placesReady && (
                  <div className="text-xs font-medium text-rose-500 mt-2">
                    Google Places is not ready yet. Add <span className="font-mono bg-rose-50 px-1 py-0.5 rounded text-[10px]">VITE_GOOGLE_PLACES_API_KEY</span> to enable suggestions.
                  </div>
                )}
                {businessSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 bg-white border border-ink-200 rounded-xl shadow-xl overflow-hidden divide-y divide-ink-100">
                    {businessSuggestions.map((prediction) => (
                      <button
                        key={prediction.place_id}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-ink-50 transition-colors flex items-center justify-between group"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyPredictionSelection(prediction, 'business')}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="text-sm font-bold text-ink-950 truncate">
                            {prediction.structured_formatting?.main_text || prediction.description}
                          </div>
                          <div className="text-xs font-medium text-ink-500 mt-0.5 truncate">
                            {prediction.structured_formatting?.secondary_text || prediction.description}
                          </div>
                        </div>
                        <Icon name="arrowRight" size={16} className="text-ink-300 group-hover:text-ink-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Address (Google Auto-fill)</label>
                <input
                  className="input w-full bg-ink-50"
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
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 bg-white border border-ink-200 rounded-xl shadow-xl overflow-hidden divide-y divide-ink-100">
                    {addressSuggestions.map((prediction) => (
                      <button
                        key={prediction.place_id}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-ink-50 transition-colors flex items-center justify-between group"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyPredictionSelection(prediction, 'address')}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="text-sm font-bold text-ink-950 truncate">
                            {prediction.structured_formatting?.main_text || prediction.description}
                          </div>
                          <div className="text-xs font-medium text-ink-500 mt-0.5 truncate">
                            {prediction.structured_formatting?.secondary_text || prediction.description}
                          </div>
                        </div>
                        <Icon name="arrowRight" size={16} className="text-ink-300 group-hover:text-ink-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">City</label>
                  <input className="input w-full bg-ink-50" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai" />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">State</label>
                  <input className="input w-full bg-ink-50" value={state} onChange={e => setState(e.target.value)} placeholder="e.g. Maharashtra" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Country</label>
                <input className="input w-full bg-ink-50" value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. India" />
              </div>

              {user?.role !== 'admin' && (
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">WhatsApp number</label>
                  <input className="input w-full bg-ink-50" value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  <div className="text-xs font-medium text-ink-500 mt-2 flex items-center gap-1.5">
                    <Icon name="whatsapp" size={14} /> Used to bridge your WhatsApp with the platform chat
                  </div>
                </div>
              )}

              {user?.role === 'client' && (
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Business Type / Vertical</label>
                  <select
                    className="input w-full bg-ink-50 cursor-pointer"
                    value={businessType}
                    onChange={e => setBusinessType(e.target.value)}
                  >
                    <option value="restaurant">Restaurant / Cafe / Dhaba</option>
                    <option value="fashion">Clothing / Retail / Boutique</option>
                    <option value="fitness">Gym / Yoga / Wellness Studio</option>
                    <option value="education">Coaching / Training Institute</option>
                    <option value="wedding">Wedding Venue / Planner</option>
                    <option value="salon">Salon / Spa / Grooming</option>
                    <option value="hotel">Hotel / Resort / Boutique Homestay</option>
                    <option value="other">Other Local Business</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-ink-100 flex justify-end">
              <button 
                onClick={() => saveProfile()} 
                disabled={savingProfile} 
                className="bg-ink-950 hover:bg-black text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
              >
                {savingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand assets */}
      {section === 'brand-assets' && user?.role === 'client' && (
        <div className="flex flex-col gap-6">

          {/* ── Brand Voice & Audience ── */}
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Icon name="mic" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Brand Voice & Audience</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Define how your brand sounds and who it speaks to</p>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              {/* Tone of voice — visual cards */}
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-3">Tone of Voice</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: 'friendly', label: 'Friendly & Welcoming', icon: 'heart', desc: 'Warm, approachable, human' },
                    { value: 'bold', label: 'Bold & Creative', icon: 'zap', desc: 'Energetic, daring, expressive' },
                    { value: 'professional', label: 'Professional & Trustworthy', icon: 'shield', desc: 'Reliable, credible, polished' },
                    { value: 'local', label: 'Authentic Local', icon: 'home', desc: 'Rooted, genuine, community-first' },
                  ].map(opt => {
                    const active = (brandAssets.tone || 'friendly') === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setBrandAssets(curr => ({ ...curr, tone: opt.value }))}
                        className={`text-left p-4 rounded-xl transition-all border ${active ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-ink-200 bg-white hover:bg-ink-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name={opt.icon} size={16} className={active ? 'text-indigo-600' : 'text-ink-500'} />
                          <span className={`text-sm font-bold ${active ? 'text-indigo-700' : 'text-ink-900'}`}>{opt.label}</span>
                        </div>
                        <div className="text-xs text-ink-500 pl-6">{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Age segment chips */}
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-3">Target Audience Age Segment</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'babies', name: 'Babies & Toddlers', range: '0-2' },
                    { id: 'preschoolers', name: 'Preschoolers', range: '3-5' },
                    { id: 'children', name: 'Young Children', range: '6-12' },
                    { id: 'teenagers', name: 'Teenagers', range: '13-19' },
                    { id: 'young_adults', name: 'Young Adults', range: '20-29' },
                    { id: 'middle_aged', name: 'Middle-aged', range: '30-50' },
                    { id: 'mature_adults', name: 'Mature Adults', range: '51-65' },
                    { id: 'seniors', name: 'Seniors', range: '66+' },
                  ].map(seg => {
                    const active = Array.isArray(brandAssets.target_ages) && brandAssets.target_ages.includes(seg.id)
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => {
                          const currentAges = Array.isArray(brandAssets.target_ages) ? brandAssets.target_ages : []
                          const nextAges = currentAges.includes(seg.id)
                            ? currentAges.filter(id => id !== seg.id)
                            : [...currentAges, seg.id]
                          setBrandAssets(curr => ({ ...curr, target_ages: nextAges }))
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-ink-50 text-ink-700 border-ink-200 hover:bg-ink-100'}`}
                      >
                        {seg.name} <span className={`text-xs ml-1 ${active ? 'text-white/80' : 'text-ink-400'}`}>({seg.range})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Words */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Avoided Words</label>
                  <input
                    className="input w-full bg-ink-50"
                    value={brandAssets.avoided_words || ''}
                    onChange={e => setBrandAssets(curr => ({ ...curr, avoided_words: e.target.value }))}
                    placeholder="e.g. cheap, discount, low-quality"
                  />
                  <div className="text-xs font-medium text-ink-500 mt-2">Comma separated</div>
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Mandatory Words</label>
                  <input
                    className="input w-full bg-ink-50"
                    value={brandAssets.mandatory_words || ''}
                    onChange={e => setBrandAssets(curr => ({ ...curr, mandatory_words: e.target.value }))}
                    placeholder="e.g. authentic, premium, handmade"
                  />
                  <div className="text-xs font-medium text-ink-500 mt-2">Comma separated</div>
                </div>
              </div>

              <div className="pt-6 border-t border-ink-100 flex justify-end">
                <button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
                  onClick={() => saveProfile()}
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Saving...' : 'Save brand voice'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Palette + Upload grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Palette builder */}
            <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Icon name="palette" size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-950 m-0">Colour Palette</h2>
                  <p className="text-sm text-ink-500 m-0 mt-0.5">Your brand's colour system</p>
                </div>
              </div>

              <div>
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-ink-50 text-ink-700 hover:bg-ink-100 transition-colors border border-ink-200" type="button" onClick={() => setBrandAssets((current) => {
                    const next = normalizeBrandAssets(current)
                    const count = next.palette.length > 0 ? next.palette.length : 4
                    const hexes = suggestPaletteForBusiness(profile.business_name, profile.business_type, next.palette)
                    return { ...next, palette: hexes.slice(0, count).map((hex, index) => createPaletteColor(hex, ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`)) }
                  })}>
                    <Icon name="sparkles" size={14} /> Suggest
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-ink-50 text-ink-700 hover:bg-ink-100 transition-colors border border-ink-200" type="button" onClick={() => logoSettingsFileInputRef.current?.click()}>
                    <Icon name="image" size={14} /> From logo
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-ink-50 text-ink-700 hover:bg-ink-100 transition-colors border border-ink-200" type="button" onClick={addPaletteColor}>
                    <Icon name="plus" size={14} /> Add colour
                  </button>
                  <input type="file" ref={logoSettingsFileInputRef} onChange={handleLogoSettingsColorExtraction} accept="image/*" className="hidden" />
                </div>

                {/* Count picker */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-ink-100">
                  <span className="text-xs font-bold uppercase tracking-widest text-ink-500">Colours:</span>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(num => {
                      const active = brandAssetsPalette.length === num
                      return (
                        <button
                          key={num} type="button"
                          onClick={() => handleSetColorCount(num)}
                          className={`w-8 h-8 rounded-lg text-sm font-bold transition-all border flex items-center justify-center ${active ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-ink-50 text-ink-600 border-ink-200 hover:bg-ink-100'}`}
                        >{num}</button>
                      )
                    })}
                  </div>
                </div>

                {/* Colour rows */}
                <div className="flex flex-col gap-3">
                  {brandAssetsPalette.length === 0 ? (
                    <div className="text-center py-8 text-ink-400 text-sm font-medium border-2 border-dashed border-ink-200 rounded-xl">
                      <Icon name="palette" size={24} className="opacity-30 mx-auto mb-2" />
                      No colours yet — start with your primary brand colour
                    </div>
                  ) : brandAssetsPalette.map((color, index) => (
                    <div key={color.id || index} className="flex items-center gap-3 p-3 rounded-xl bg-ink-50 border border-ink-200">
                      <div className="relative shrink-0">
                        <input
                          type="color"
                          value={normalizeHex(color.hex)}
                          onChange={(e) => updatePaletteColor(index, { hex: normalizeHex(e.target.value) })}
                          className="w-10 h-10 border-0 bg-transparent p-0 rounded-lg cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-2 min-w-0">
                        <input
                          className="input w-full bg-white text-xs px-3 py-1.5"
                          value={color.label || ''}
                          onChange={(e) => updatePaletteColor(index, { label: e.target.value })}
                          placeholder={`Colour ${index + 1} label`}
                        />
                        <input
                          className="input w-full bg-white text-xs px-3 py-1.5 font-mono"
                          value={normalizeHex(color.hex)}
                          onChange={(e) => updatePaletteColor(index, { hex: normalizeHex(e.target.value) })}
                          placeholder="#111111"
                        />
                      </div>
                      <button
                        className="p-2 text-ink-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        type="button"
                        onClick={() => removePaletteColor(index)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {brandAssetsPalette.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-ink-100">
                    <button 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
                      type="button" 
                      onClick={() => saveProfile()} 
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'Saving...' : 'Save palette'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Upload brand assets */}
            <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Icon name="upload" size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink-950 m-0">Brand Files</h2>
                  <p className="text-sm text-ink-500 m-0 mt-0.5">Logos, references & product photos</p>
                </div>
              </div>

              <div>
                <input
                  ref={brandAssetInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleBrandAssetInputChange}
                />

                {/* Upload type buttons */}
                <div className="flex flex-col gap-3 mb-6">
                  {[
                    { kind: 'logo', label: 'Logo', desc: 'Your primary brand mark', icon: 'star', colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50', hoverBorder: 'hover:border-indigo-500' },
                    { kind: 'reference', label: 'Reference image', desc: 'Mood boards, style guides', icon: 'layers', colorClass: 'text-amber-600', bgClass: 'bg-amber-50', hoverBorder: 'hover:border-amber-500' },
                    { kind: 'photo', label: 'Product photo', desc: 'Hero shots, product images', icon: 'image', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-50', hoverBorder: 'hover:border-emerald-500' },
                  ].map(({ kind, label, desc, icon, colorClass, bgClass, hoverBorder }) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        brandAssetKindRef.current = kind
                        brandAssetInputRef.current?.click()
                      }}
                      disabled={uploadingBrandAsset}
                      className={`flex items-center gap-3 p-3 rounded-xl text-left cursor-pointer border border-ink-200 bg-ink-50 transition-all ${hoverBorder}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
                        <Icon name={icon} size={18} />
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-ink-900">{label}</div>
                        <div className="text-xs font-medium text-ink-500 mt-0.5">{desc}</div>
                      </div>
                      <Icon name="upload" size={16} className="text-ink-400 shrink-0 mx-2" />
                    </button>
                  ))}
                </div>

                {/* Saved assets */}
                <div className="pt-6 border-t border-ink-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold tracking-widest uppercase text-ink-500">
                      Saved assets {brandAssetFiles.length > 0 && `(${brandAssetFiles.length})`}
                    </span>
                  </div>

                  {brandAssetFiles.length === 0 ? (
                    <div className="text-center py-8 text-ink-400 text-sm font-medium border-2 border-dashed border-ink-200 rounded-xl">
                      <Icon name="image" size={24} className="opacity-30 mx-auto mb-2" />
                      No assets uploaded yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {brandAssetFiles.slice(0, 12).map((asset) => (
                        <div key={asset.id} className="rounded-xl overflow-hidden border border-ink-200 bg-white">
                          <img
                            src={asset.preview_url || (typeof asset.url === 'string' ? asset.url : '')}
                            alt={asset.label || asset.name}
                            className="w-full h-24 object-cover block"
                          />
                          <div className="p-2 flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-xs truncate text-ink-900">
                                {asset.label || asset.name}
                              </div>
                              <div className="text-[10px] font-medium text-ink-400 capitalize truncate mt-0.5">
                                {asset.kind || 'reference'}
                              </div>
                            </div>
                            <button 
                              className="p-1.5 text-ink-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors shrink-0" 
                              type="button"
                              onClick={() => removeBrandAssetItem(asset.kind === 'logo' ? 'logos' : asset.kind === 'photo' ? 'photos' : 'references', asset.id)}
                            >
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
        </div>
      )}

      {/* Google Business */}
      {section === 'google-business' && user?.role === 'client' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Icon name="globe" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Google Business</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Connect and manage your local search presence</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Listing name</label>
                  <input className="input w-full bg-ink-50" value={googleBusiness.listing_name || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, listing_name: e.target.value }))} placeholder="Business name on Google" />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Place ID</label>
                  <input className="input w-full bg-ink-50 font-mono" value={googleBusiness.place_id || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, place_id: e.target.value }))} placeholder="Google Place ID" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Formatted address</label>
                <textarea className="textarea w-full bg-ink-50" rows={3} value={googleBusiness.formatted_address || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, formatted_address: e.target.value }))} placeholder="Complete address from Google" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Phone</label>
                  <input className="input w-full bg-ink-50" value={googleBusiness.phone || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, phone: e.target.value }))} placeholder="+91 ..." />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Website</label>
                  <input className="input w-full bg-ink-50" value={googleBusiness.website || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, website: e.target.value }))} placeholder="https://..." />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Maps URL</label>
                <input className="input w-full bg-ink-50" value={googleBusiness.maps_url || ''} onChange={(e) => setGoogleBusiness((current) => ({ ...current, maps_url: e.target.value }))} placeholder="Google Maps link" />
              </div>

              <div className="pt-6 border-t border-ink-100 flex justify-end">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
                  onClick={saveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Saving...' : 'Save Google Business'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posting cadence */}
      {section === 'posting-preferences' && user?.role === 'client' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Icon name="calendar" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Posting Cadence</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Control how content gets created, approved, and published</p>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              {/* 1. Who creates the content? */}
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-3">Who creates the content first?</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: 'admin_first', label: 'Mintmore creates it', icon: 'zap', tip: 'Our team designs the post and sends it to you for quick approval.' },
                    { value: 'client_review', label: 'I suggest, you refine', icon: 'user', tip: 'You share a brief first, then our team turns it into a polished post.' },
                  ].map(opt => {
                    const active = postingPreferences.content_mode === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPostingPreferences(curr => ({ ...curr, content_mode: opt.value }))}
                        className={`text-left p-4 rounded-xl transition-all border ${active ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-ink-200 bg-white hover:bg-ink-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name={opt.icon} size={16} className={active ? 'text-purple-600' : 'text-ink-500'} />
                          <span className={`text-sm font-bold ${active ? 'text-purple-700' : 'text-ink-900'}`}>{opt.label}</span>
                        </div>
                        <div className="text-xs text-ink-500 pl-6">{opt.tip}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. How do you approve? */}
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-3">How do you want to approve posts?</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'app_or_whatsapp', label: 'App or WhatsApp', icon: 'check', tip: 'Approve from the app or via WhatsApp — whichever works.' },
                    { value: 'app_only', label: 'Only in the app', icon: 'eye', tip: 'Approvals only happen inside the app. No WhatsApp.' },
                    { value: 'whatsapp_only', label: 'Only on WhatsApp', icon: 'whatsapp', tip: "We'll send you a WhatsApp message with the preview." },
                  ].map(opt => {
                    const active = postingPreferences.approval_mode === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPostingPreferences(curr => ({ ...curr, approval_mode: opt.value }))}
                        className={`text-left p-4 rounded-xl transition-all border ${active ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-ink-200 bg-white hover:bg-ink-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name={opt.icon} size={16} className={active ? 'text-purple-600' : 'text-ink-500'} />
                          <span className={`text-sm font-bold ${active ? 'text-purple-700' : 'text-ink-900'}`}>{opt.label}</span>
                        </div>
                        <div className="text-xs text-ink-500 pl-6">{opt.tip}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3. Who actually posts? */}
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-3">Who actually posts it?</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: 'managed', label: 'Mintmore posts it', icon: 'send', tip: 'Our system publishes automatically at the right time.' },
                    { value: 'manual', label: "I'll post it myself", icon: 'download', tip: 'You download or copy the content and post it yourself.' },
                  ].map(opt => {
                    const active = postingPreferences.publish_mode === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPostingPreferences(curr => ({ ...curr, publish_mode: opt.value }))}
                        className={`text-left p-4 rounded-xl transition-all border ${active ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-ink-200 bg-white hover:bg-ink-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name={opt.icon} size={16} className={active ? 'text-purple-600' : 'text-ink-500'} />
                          <span className={`text-sm font-bold ${active ? 'text-purple-700' : 'text-ink-900'}`}>{opt.label}</span>
                        </div>
                        <div className="text-xs text-ink-500 pl-6">{opt.tip}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 4. How often? */}
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-3">How often should we post?</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { value: 'weekly', label: 'Every week', icon: 'calendar', tip: 'We plan and schedule new content each week.' },
                    { value: 'monthly', label: 'Once a month', icon: 'layers', tip: 'We create a batch of posts and spread them out.' },
                    { value: 'campaign_based', label: 'Campaigns only', icon: 'star', tip: "We only post during specific campaigns or sales." },
                  ].map(opt => {
                    const active = postingPreferences.cadence === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPostingPreferences(curr => ({ ...curr, cadence: opt.value }))}
                        className={`text-left p-4 rounded-xl transition-all border ${active ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-ink-200 bg-white hover:bg-ink-50'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon name={opt.icon} size={16} className={active ? 'text-purple-600' : 'text-ink-500'} />
                          <span className={`text-sm font-bold ${active ? 'text-purple-700' : 'text-ink-900'}`}>{opt.label}</span>
                        </div>
                        <div className="text-xs text-ink-500 pl-6">{opt.tip}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Content mix slider */}
              <div className="pt-6 border-t border-ink-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="block text-xs font-bold tracking-widest uppercase text-ink-500">Post type mix</label>
                    <p className="text-xs text-ink-500 mt-1">
                      Balance between brand building vs. promotional offers.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold border border-purple-100">
                    {postingPreferences.evergreen_ratio || 50}% brand / {100 - (postingPreferences.evergreen_ratio || 50)}% offers
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={postingPreferences.evergreen_ratio || 50}
                  onChange={e => setPostingPreferences(curr => ({ ...curr, evergreen_ratio: parseInt(e.target.value, 10) }))}
                  className="w-full h-1.5 bg-ink-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between mt-2 text-xs font-bold text-ink-400">
                  <span>← All brand building</span>
                  <span>All offers & sales →</span>
                </div>
              </div>

              <div className="pt-6 border-t border-ink-100 flex justify-end">
                <button
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
                  onClick={saveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? 'Saving...' : 'Save Posting Cadence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Festival Plan */}
      {section === 'smart-festival-plan' && user?.role === 'client' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <Icon name="star" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Festival & Occasions</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Manage how cultural festivals and holidays are handled</p>
              </div>
            </div>

            <div className="flex flex-col gap-8">
              <div>
                <h3 className="text-base font-bold text-ink-900 mb-2">Who manages your festival content?</h3>
                <p className="text-sm text-ink-500 mb-6">
                  Every month has something — Holi, Father's Day, Independence Day, Diwali… Choose whether Mintmore handles all of it for you automatically, or if you prefer to take the wheel.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      value: 'autopilot',
                      icon: 'zap',
                      title: 'Mintmore handles it',
                      badge: 'RECOMMENDED',
                      desc: 'We research, design, and schedule posts for every cultural festival and holiday automatically.',
                    },
                    {
                      value: 'manual',
                      icon: 'sliders',
                      title: "I'll manage it myself",
                      badge: null,
                      desc: "Mintmore won't auto-create content for events unless you explicitly request it.",
                    },
                  ].map(opt => {
                    const selected = (postingPreferences.festival_mode || 'autopilot') === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPostingPreferences(curr => ({ ...curr, festival_mode: opt.value }))}
                        className={`relative text-left p-6 rounded-2xl transition-all border ${selected ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-ink-200 bg-white hover:bg-ink-50'}`}
                      >
                        {opt.badge && (
                          <span className="absolute top-4 right-4 text-[10px] font-bold tracking-wider bg-orange-500 text-white rounded-md px-2 py-1">
                            {opt.badge}
                          </span>
                        )}
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${selected ? 'bg-orange-500 text-white' : 'bg-ink-100 text-ink-500'}`}>
                           <Icon name={opt.icon} size={24} />
                        </div>
                        <div className={`text-base font-bold mb-2 ${selected ? 'text-orange-600' : 'text-ink-900'}`}>
                          {opt.title}
                        </div>
                        <div className="text-sm text-ink-500 leading-relaxed">
                          {opt.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-6">
                  {(postingPreferences.festival_mode || 'autopilot') === 'autopilot' ? (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <Icon name="checkCircle" size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-emerald-700 mb-1">Autopilot is on</div>
                        <div className="text-xs text-emerald-600 leading-relaxed">
                          Mintmore will automatically design and schedule content for every upcoming cultural festival and national holiday.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-ink-50 border border-ink-200">
                      <Icon name="sliders" size={20} className="text-ink-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-ink-800 mb-1">You're in control</div>
                        <div className="text-xs text-ink-500 leading-relaxed">
                          Festival content won't be auto-created. You can still request specific designs any time through the custom requests tab.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-6 border-t border-ink-100 flex justify-end">
                  <button
                    className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70"
                    onClick={saveProfile}
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Saving...' : 'Save Festival Plan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KYC status (clients + freelancers only) */}
      {section === 'verification' && !['admin', 'designer'].includes(user?.role) && <VerificationPanel profile={profile} kyc={kyc} />}

      {/* Change password */}
      {section === 'security' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Icon name="lock" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Password & Security</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Keep your account credentials safe</p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Current password</label>
                <input className="input w-full bg-ink-50" type="password" autoComplete="current-password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">New password</label>
                  <input className="input w-full bg-ink-50" type="password" autoComplete="new-password" value={newPw} onChange={e => setNewPw(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-bold tracking-widest uppercase text-ink-500 mb-2">Confirm new password</label>
                  <input className="input w-full bg-ink-50" type="password" autoComplete="new-password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
                </div>
              </div>

              {pwError && (
                <div className="text-sm text-rose-600 px-4 py-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2">
                  <Icon name="error" size={16} className="text-rose-600" />
                  {pwError}
                </div>
              )}

              <div className="pt-6 border-t border-ink-100 flex justify-end">
                <button
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm disabled:opacity-70 disabled:pointer-events-none"
                  onClick={handlePasswordSubmit}
                  disabled={changingPw || !currentPw || !newPw || !confirmPw}
                >
                  {changingPw ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account info (read-only) */}
      {section === 'account' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Icon name="settings" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Account Information</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">System and membership details</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm">
              <div className="flex justify-between items-center py-2">
                <span className="text-ink-500 font-medium">Email</span>
                <span className="font-mono text-ink-900">{profile.email}</span>
              </div>
              <div className="h-px bg-ink-100" />
              <div className="flex justify-between items-center py-2">
                <span className="text-ink-500 font-medium">Role</span>
                <span className="capitalize font-bold text-ink-900">{profile.role}</span>
              </div>
              <div className="h-px bg-ink-100" />
              <div className="flex justify-between items-center py-2">
                <span className="text-ink-500 font-medium">Account status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${profile.is_active !== false ? 'bg-mint-50 text-mint-700 border border-mint-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${profile.is_active !== false ? 'bg-mint-500' : 'bg-rose-500'}`} />
                  {profile.is_active !== false ? 'Active' : 'Deactivated'}
                </span>
              </div>
              <div className="h-px bg-ink-100" />
              <div className="flex justify-between items-center py-2">
                <span className="text-ink-500 font-medium">Member since</span>
                <span className="text-ink-900">{profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
              </div>
              <div className="h-px bg-ink-100" />
              <div className="flex justify-between items-center py-2">
                <span className="text-ink-500 font-medium">Verification</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${profile.kyc_status === 'verified' ? 'bg-mint-50 text-mint-700 border border-mint-200' : 'bg-ink-100 text-ink-600 border border-ink-200'}`}>
                  {profile.kyc_status || 'not started'}
                </span>
              </div>
              {profile.role === 'client' && (
                <>
                  <div className="h-px bg-ink-100" />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-ink-500 font-medium">Business</span>
                    <span className="text-ink-900 font-medium">{profile.business_name || profile.business_type || 'Not added yet'}</span>
                  </div>
                  <div className="h-px bg-ink-100" />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-ink-500 font-medium">Connected social accounts</span>
                    <span className="text-ink-900 font-medium">{connectedSocialAccounts.length}</span>
                  </div>
                  {connectedSocialAccounts.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-end -mt-2">
                      {connectedSocialAccounts.map(account => (
                        <span key={account.id} className="px-2.5 py-1 rounded-full text-xs font-bold capitalize bg-ink-100 text-ink-600 border border-ink-200">
                          {account.platform}: {account.page_name || account.platform_name || account.platform_username}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              {profile.role === 'freelancer' && (
                <>
                  <div className="h-px bg-ink-100" />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-ink-500 font-medium">Freelancer level</span>
                    <span className="capitalize text-ink-900 font-medium">{profile.freelancer_level || 'Not set'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Social Accounts */}
      {section === 'social' && user?.role === 'client' && <AccountManager />}
      {section === 'setup' && user?.role === 'client' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-ink-200 shadow-sm rounded-2xl p-6 md:p-8">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-ink-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Icon name="check" size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink-950 m-0">Business Setup</h2>
                <p className="text-sm text-ink-500 m-0 mt-0.5">Finish the pieces that improve your calendar and insights</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {[
                {
                  title: 'Business profile',
                  body: profile.business_name ? `${profile.business_name} is saved.` : 'Add business name, type, city, and customer profile.',
                  done: Boolean(profile.business_name || profile.business_type),
                  action: () => setSearchParams({ section: 'profile' }),
                  icon: 'user'
                },
                {
                  title: 'Brand assets',
                  body: brandAssetsPalette.length || brandAssetFiles.length ? 'Palette and brand assets are ready.' : 'Add optional logos, reference images, and colors.',
                  done: brandAssetsPalette.length > 0 || brandAssetFiles.length > 0,
                  action: () => setSearchParams({ section: 'brand-assets' }),
                  icon: 'image'
                },
                {
                  title: 'Social accounts',
                  body: connectedSocialAccounts.length ? `${connectedSocialAccounts.length} account${connectedSocialAccounts.length === 1 ? '' : 's'} connected.` : 'Connect Facebook, Instagram, or YouTube for analytics.',
                  done: connectedSocialAccounts.length > 0,
                  action: () => window.location.assign('/social'),
                  icon: 'layers'
                },
                {
                  title: 'Google Business',
                  body: googleBusiness.listing_name ? `Linked to ${googleBusiness.listing_name}.` : 'Add your Google listing, phone, and maps details.',
                  done: Boolean(googleBusiness.listing_name || googleBusiness.formatted_address),
                  action: () => setSearchParams({ section: 'google-business' }),
                  icon: 'globe'
                },
                {
                  title: 'Posting preferences',
                  body: postingPreferences.publish_mode ? `Publishing mode: ${postingPreferences.publish_mode}.` : 'Choose manual or managed preferences.',
                  done: Boolean(postingPreferences.publish_mode),
                  action: () => setSearchParams({ section: 'posting-preferences' }),
                  icon: 'calendar'
                },
                {
                  title: 'Verification',
                  body: profile.kyc_status === 'verified' ? 'Your account is verified.' : 'Complete verification before paid work expands.',
                  done: profile.kyc_status === 'verified',
                  action: () => setSearchParams({ section: 'verification' }),
                  icon: 'shield'
                },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={item.action}
                  className={`text-left p-5 rounded-2xl border transition-all flex items-center gap-4 group ${item.done ? 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-300' : 'bg-white border-ink-200 hover:border-ink-300 hover:bg-ink-50'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${item.done ? 'bg-emerald-100 text-emerald-600' : 'bg-ink-100 text-ink-500 group-hover:bg-ink-200 group-hover:text-ink-600'}`}>
                    <Icon name={item.done ? 'check' : item.icon} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-[15px] font-bold text-ink-900 truncate">{item.title}</strong>
                    <span className="block mt-1 text-[13px] text-ink-500 truncate leading-relaxed">{item.body}</span>
                  </div>
                  <Icon name="chevronRight" className={`shrink-0 ${item.done ? 'text-emerald-300' : 'text-ink-400'}`} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
