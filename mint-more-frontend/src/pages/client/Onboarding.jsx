import { useEffect, useMemo, useState, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { socialApi } from '../../api/social'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'
import {
  ONBOARDING_SECTION_GROUPS,
  ONBOARDING_STEPS,
  getOnboardingStepByNumber,
  getOnboardingStepBySlug,
} from './onboarding/config'
import { useCalendarState } from './onboarding/useCalendarState'

const languages = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['bn', 'Bengali'],
  ['hinglish', 'Hinglish'],
]

const industries = [
  ['restaurant', 'Restaurant / Cafe / Dhaba'],
  ['fashion', 'Clothing / Retail / Boutique'],
  ['fitness', 'Gym / Yoga / Wellness Studio'],
  ['education', 'Coaching / Training Institute'],
  ['wedding', 'Wedding Venue / Planner'],
  ['salon', 'Salon / Spa / Grooming'],
  ['hotel', 'Hotel / Resort / Boutique Homestay'],
  ['other', 'Other Local Business'],
]

const tones = [
  { id: 'friendly', name: 'Friendly & Welcoming', description: 'Warm, neighborly tone that makes customers feel at home.' },
  { id: 'bold', name: 'Bold & Creative', description: 'Energetic, modern style designed to stand out in feeds.' },
  { id: 'professional', name: 'Professional & Trustworthy', description: 'Clean, clear formatting focusing on value and quality.' },
  { id: 'local', name: 'Authentic Local', description: 'Casual, relatable local language focused on community.' },
]

const ageSegments = [
  { id: 'babies', name: 'Babies & Toddlers (0-2)', label: 'Babies' },
  { id: 'preschoolers', name: 'Preschoolers (3-5)', label: 'Preschoolers' },
  { id: 'children', name: 'Young Children (6-12)', label: 'Children' },
  { id: 'teenagers', name: 'Teenagers (13-19)', label: 'Teenagers' },
  { id: 'young_adults', name: 'Young Adults (20-29)', label: 'Young Adults' },
  { id: 'middle_aged', name: 'Middle-aged Adults (30-50)', label: 'Middle-aged' },
  { id: 'mature_adults', name: 'Mature Adults (51-65)', label: 'Mature Adults' },
  { id: 'seniors', name: 'Seniors & Elder Gen (66+)', label: 'Seniors' },
]

const sampleFestivals = [
  { id: 'diwali', name: 'Diwali (Festival of Lights)', region: 'National' },
  { id: 'holi', name: 'Holi (Festival of Colors)', region: 'National' },
  { id: 'durgapuja', name: 'Durga Puja / Navratri', region: 'East & West' },
  { id: 'eid', name: 'Eid al-Fitr', region: 'National' },
  { id: 'independence', name: 'Independence Day', region: 'National' },
  { id: 'christmas', name: 'Christmas', region: 'National' },
]

const presetPalettes = {
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

export default function Onboarding() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)
  const [paletteCustomized, setPaletteCustomized] = useState(false)
  const [generationPhase, setGenerationPhase] = useState(0)
  const [form, setForm] = useState({
    business_name: '',
    business_type: 'restaurant',
    address_city: '',
    address_state: '',
    preferred_language: 'en',
    website: '',
    description: '',
    products_services: '',
    customer_profile: '',
    target_ages: [],
    tone: 'friendly',
    avoided_words: '',
    mandatory_words: '',
    palette: [],
    logos: [],
    posting_frequency: '3',
    evergreen_ratio: '50',
    festival_mode: 'autopilot',
    selected_festivals: ['diwali', 'holi'],
    festival_lead_days: '5',
    connected_platforms: [],
    whatsapp_number: '',
    whatsapp_consent: false,
    quiet_hours: '22:00-08:00',
    approval_policy: 'every_post',
  })

  const currentStep = useMemo(() => {
    const slug = location.pathname.split('/').filter(Boolean).at(-1)
    return getOnboardingStepBySlug(slug) || ONBOARDING_STEPS[0]
  }, [location.pathname])

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then(res => res.data.data),
  })

  const profile = useMemo(() => profileData?.profile || profileData || {}, [profileData])

  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(r => r.data.data),
  })

  const connectedAccounts = useMemo(() => accountsData?.accounts || [], [accountsData])

  const currentMonth = useMemo(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [])

  const nextMonth = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }, [])

  const { data: currCalendar } = useQuery({
    queryKey: ['creative-calendar-onboarding', currentMonth],
    queryFn: () => creativeApi.calendar({ month: currentMonth }).then(r => r.data.data),
  })

  const { data: nextCalendar } = useQuery({
    queryKey: ['creative-calendar-onboarding', nextMonth],
    queryFn: () => creativeApi.calendar({ month: nextMonth }).then(r => r.data.data),
  })

  const onboardingEvents = useMemo(() => {
    const curr = currCalendar?.events || []
    const next = nextCalendar?.events || []
    return [...curr, ...next]
  }, [currCalendar, nextCalendar])

  const calendarState = useCalendarState(form, onboardingEvents)

  const loadedRef = useRef(false)

  useEffect(() => {
    if (!profile.id || loadedRef.current) return
    loadedRef.current = true
    const brandAssets = profile.brand_assets || {}
    const postingPref = profile.posting_preferences || {}
    setForm(current => ({
      ...current,
      business_name: profile.business_name || '',
      business_type: profile.business_type || 'restaurant',
      address_city: profile.address_city || '',
      address_state: profile.address_state || '',
      preferred_language: profile.preferred_language || 'en',
      description: profile.customer_profile || '',
      palette: Array.isArray(brandAssets.palette) && brandAssets.palette.length > 0
        ? brandAssets.palette.map(c => typeof c === 'string' ? c : (c.hex || '#111111'))
        : (presetPalettes[profile.business_type || 'restaurant']?.[0] || presetPalettes.other[0]),
      logos: Array.isArray(brandAssets.logos) ? brandAssets.logos : [],
      festival_mode: postingPref.festival_mode === 'managed' ? 'autopilot' : (postingPref.festival_mode || 'autopilot'),
      selected_festivals: Array.isArray(postingPref.festivals) ? postingPref.festivals : ['diwali', 'holi'],
      whatsapp_number: profile.whatsapp_number || '',
      approval_policy: postingPref.approval_mode === 'app_or_whatsapp' ? 'every_post' : 'every_post',
    }))
  }, [profile])

  const saveMutation = useMutation({
    mutationFn: (checklistUpdates = {}) => {
      const brand_assets = {
        ...profile.brand_assets,
        palette: (form.palette || []).map((hex, index) => ({
          hex,
          label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`,
        })),
        logos: form.logos,
      }

      const posting_preferences = {
        ...profile.posting_preferences,
        festival_mode: form.festival_mode === 'autopilot' ? 'managed' : 'manual',
        festivals: form.selected_festivals,
        festival_lead_days: parseInt(form.festival_lead_days || '5', 10),
        cadence: 'weekly',
        evergreen_ratio: parseInt(form.evergreen_ratio || '50', 10),
        approval_mode: 'app_or_whatsapp',
      }

      const payload = {
        business_name: form.business_name,
        business_type: form.business_type,
        address_city: form.address_city,
        address_state: form.address_state,
        preferred_language: form.preferred_language,
        customer_profile: form.description,
        whatsapp_number: form.whatsapp_number,
        brand_assets,
        posting_preferences,
        onboarding_checklist: {
          profile: true,
          language: true,
          social: form.connected_platforms.length > 0,
          kyc: profile.kyc_status === 'verified',
          ...checklistUpdates,
        },
      }
      return api.patch('/profile/me', payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    onError: err => {
      pushToast({
        title: 'Error saving progress',
        body: err.response?.data?.message || 'Try again',
        tone: 'amber',
        icon: 'x',
      })
    },
  })

  // Step 11 AI topic generation & flashcard interaction managed inside ContentGenerationPage.jsx


  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const toggleTargetAge = (ageId) => {
    setForm(prev => {
      const ages = prev.target_ages.includes(ageId)
        ? prev.target_ages.filter(a => a !== ageId)
        : [...prev.target_ages, ageId]
      return { ...prev, target_ages: ages }
    })
  }

  const toggleFestival = (festId) => {
    setForm(prev => {
      const fests = prev.selected_festivals.includes(festId)
        ? prev.selected_festivals.filter(f => f !== festId)
        : [...prev.selected_festivals, festId]
      return { ...prev, selected_festivals: fests }
    })
  }

  const handleSuggestPalette = () => {
    setPaletteCustomized(true)
    const list = presetPalettes[form.business_type] || presetPalettes.other
    const currentHexes = (form.palette || []).map(hex => hex.toUpperCase())
    const candidatePalettes = list.filter(p => {
      const matchCount = p.filter(hex => currentHexes.includes(hex.toUpperCase())).length
      return matchCount < 4
    })
    const paletteToUse = candidatePalettes.length > 0
      ? candidatePalettes[Math.floor(Math.random() * candidatePalettes.length)]
      : list[Math.floor(Math.random() * list.length)]

    const currentLen = form.palette.length > 0 ? form.palette.length : 4
    updateField('palette', paletteToUse.slice(0, currentLen))
    pushToast({ title: 'Suggested brand colors applied!', icon: 'sparkles' })
  }

  const extractPaletteFromImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          canvas.width = 100
          canvas.height = 100
          ctx.drawImage(img, 0, 0, 100, 100)
          const data = ctx.getImageData(0, 0, 100, 100).data

          const colorCounts = {}
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const a = data[i + 3]
            if (a < 128) continue

            const qr = Math.round(r / 16) * 16
            const qg = Math.round(g / 16) * 16
            const qb = Math.round(b / 16) * 16
            const rgb = `${qr},${qg},${qb}`

            const brightness = (qr + qg + qb) / 3
            if (brightness > 240 || brightness < 15) continue

            colorCounts[rgb] = (colorCounts[rgb] || 0) + 1
          }

          const sortedColors = Object.keys(colorCounts)
            .sort((a, b) => colorCounts[b] - colorCounts[a])
            .map(rgb => {
              const [r, g, b] = rgb.split(',').map(Number)
              const toHex = c => c.toString(16).padStart(2, '0')
              return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
            })

          const uniqueHexes = []
          for (const hex of sortedColors) {
            if (uniqueHexes.length >= 4) break
            const isTooSimilar = uniqueHexes.some(existing => {
              const r1 = parseInt(existing.slice(1, 3), 16)
              const g1 = parseInt(existing.slice(3, 5), 16)
              const b1 = parseInt(existing.slice(5, 7), 16)
              const r2 = parseInt(hex.slice(1, 3), 16)
              const g2 = parseInt(hex.slice(3, 5), 16)
              const b2 = parseInt(hex.slice(5, 7), 16)
              const dist = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
              return dist < 45
            })
            if (!isTooSimilar) {
              uniqueHexes.push(hex)
            }
          }

          const defaults = ['#0F172A', '#0284C7', '#F59E0B', '#10B981']
          while (uniqueHexes.length < 4) {
            const nextFallback = defaults.find(d => !uniqueHexes.includes(d))
            if (nextFallback) {
              uniqueHexes.push(nextFallback)
            } else {
              uniqueHexes.push('#64748B')
            }
          }
          resolve(uniqueHexes)
        }
        img.onerror = () => resolve(['#0F172A', '#0284C7', '#F59E0B', '#10B981'])
        img.src = e.target.result
      }
      reader.onerror = () => resolve(['#0F172A', '#0284C7', '#F59E0B', '#10B981'])
      reader.readAsDataURL(file)
    })
  }

  const uploadAssetMutation = useMutation({
    mutationFn: ({ file, kind }) => {
      const fd = new FormData()
      fd.append('asset', file)
      fd.append('kind', kind)
      fd.append('label', file.name.replace(/\.[^.]+$/, ''))
      return api.post('/profile/me/brand-assets/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: async (res, variables) => {
      const updatedProfile = res.data.data?.profile || res.data.data
      if (updatedProfile?.brand_assets) {
        setForm(curr => ({
          ...curr,
          logos: Array.isArray(updatedProfile.brand_assets.logos) ? updatedProfile.brand_assets.logos : [],
        }))

        try {
          await api.patch('/profile/me', {
            brand_assets: {
              ...updatedProfile.brand_assets,
              palette: (variables.palette || form.palette).map((hex, index) => ({
                hex,
                label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`,
              })),
            },
          })
        } catch (_) {}

        queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      }
      pushToast({ title: `${variables.kind === 'logo' ? 'Logo' : 'Asset'} uploaded successfully!`, icon: 'check' })
    },
    onError: (err) => {
      pushToast({ title: 'Upload failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
    },
  })

  const removeOnboardingLogo = async (logoId) => {
    const nextLogos = form.logos.filter(l => l.id !== logoId)
    setForm(curr => ({ ...curr, logos: nextLogos }))
    try {
      await api.patch('/profile/me', { brand_assets: { ...profile.brand_assets, logos: nextLogos } })
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      pushToast({ title: 'Logo removed successfully', icon: 'check' })
    } catch (err) {
      pushToast({ title: 'Remove failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
    }
  }

  const handleLogoColorExtraction = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (paletteCustomized) {
      uploadAssetMutation.mutate({ file, kind: 'logo' })
      return
    }
    pushToast({ title: 'Extracting brand colors from logo...', icon: 'sparkles' })
    const palette = await extractPaletteFromImage(file)
    const currentLen = form.palette.length > 0 ? form.palette.length : 4
    const slicedPalette = palette.slice(0, currentLen)
    updateField('palette', slicedPalette)

    try {
      const dbPalette = slicedPalette.map((hex, index) => ({
        hex,
        label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`,
      }))
      await api.patch('/profile/me', { brand_assets: { ...profile.brand_assets, palette: dbPalette } })
    } catch (_) {}

    uploadAssetMutation.mutate({ file, kind: 'logo', palette: slicedPalette })
  }

  const handleImportFromWebsite = () => {
    if (!form.website.trim()) {
      pushToast({ title: 'Please enter a website link first', tone: 'amber' })
      return
    }
    pushToast({ title: 'Importing website details...', icon: 'sparkles' })

    setTimeout(() => {
      let cleanUrl = form.website.trim()
      cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '')
      const parts = cleanUrl.split('/')
      const domain = parts[0] || ''
      const namePart = domain.replace(/\.(com|in|co\.in|net|org|edu|gov|io|biz|info|in|me)$/i, '')
      const words = namePart.split(/[-_.]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1))
      let businessName = words.join(' ')
      const lowerUrl = cleanUrl.toLowerCase()
      let businessType = 'other'
      let typeLabel = 'local business'

      if (lowerUrl.includes('hotel') || lowerUrl.includes('resort') || lowerUrl.includes('stay') || lowerUrl.includes('inn') || lowerUrl.includes('lodge') || lowerUrl.includes('retreat')) {
        businessType = 'hotel'
        typeLabel = 'boutique stay'
      } else if (lowerUrl.includes('cafe') || lowerUrl.includes('restaurant') || lowerUrl.includes('dhaba') || lowerUrl.includes('food') || lowerUrl.includes('pizza') || lowerUrl.includes('bakery') || lowerUrl.includes('kitchen') || lowerUrl.includes('bites')) {
        businessType = 'restaurant'
        typeLabel = 'restaurant and cafe'
      } else if (lowerUrl.includes('gym') || lowerUrl.includes('fitness') || lowerUrl.includes('yoga') || lowerUrl.includes('wellness') || lowerUrl.includes('fit') || lowerUrl.includes('studio')) {
        businessType = 'fitness'
        typeLabel = 'fitness and wellness studio'
      } else if (lowerUrl.includes('coaching') || lowerUrl.includes('edu') || lowerUrl.includes('academy') || lowerUrl.includes('learn') || lowerUrl.includes('class') || lowerUrl.includes('institute') || lowerUrl.includes('training')) {
        businessType = 'education'
        typeLabel = 'coaching and training institute'
      } else if (lowerUrl.includes('wedding') || lowerUrl.includes('event') || lowerUrl.includes('planner') || lowerUrl.includes('marriage') || lowerUrl.includes('banquet')) {
        businessType = 'wedding'
        typeLabel = 'wedding planning and venue services'
      } else if (lowerUrl.includes('salon') || lowerUrl.includes('spa') || lowerUrl.includes('parlour') || lowerUrl.includes('grooming') || lowerUrl.includes('hair') || lowerUrl.includes('beauty')) {
        businessType = 'salon'
        typeLabel = 'premium salon and spa'
      } else if (lowerUrl.includes('boutique') || lowerUrl.includes('fashion') || lowerUrl.includes('cloth') || lowerUrl.includes('wear') || lowerUrl.includes('store') || lowerUrl.includes('shop') || lowerUrl.includes('retail')) {
        businessType = 'fashion'
        typeLabel = 'clothing and lifestyle boutique'
      }

      if (businessType !== 'other' && !lowerUrl.includes(businessType) && !lowerUrl.includes(typeLabel.split(' ')[0])) {
        const typeSuffix = businessType.charAt(0).toUpperCase() + businessType.slice(1)
        businessName += ` ${typeSuffix}`
      }

      let description = `Welcome to ${businessName}. We are a premium ${typeLabel} dedicated to offering exceptional services, high-quality standards, and a customer-first experience.`
      if (businessType === 'hotel') {
        description = `${businessName} is a cozy ${typeLabel} offering beautiful rooms, exceptional hospitality, premium amenities, and a peaceful atmosphere for a perfect getaway.`
      } else if (businessType === 'restaurant') {
        description = `${businessName} is a popular ${typeLabel} serving delicious dishes, freshly prepared local delicacies, and premium beverages in a warm, welcoming environment.`
      } else if (businessType === 'fitness') {
        description = `${businessName} is a modern ${typeLabel} offering professional trainers, customized workout regimens, wellness classes, and state-of-the-art equipment.`
      } else if (businessType === 'education') {
        description = `${businessName} is a leading ${typeLabel} providing high-quality classes, experienced faculty, specialized mentorship, and comprehensive test prep.`
      } else if (businessType === 'wedding') {
        description = `${businessName} provides premium ${typeLabel} to curate memorable events, beautiful wedding themes, full-service catering, and flawless coordination.`
      } else if (businessType === 'salon') {
        description = `${businessName} is a premium ${typeLabel} offering expert hair styling, makeup services, relaxing wellness treatments, and complete personal grooming.`
      } else if (businessType === 'fashion') {
        description = `${businessName} is a trendy ${typeLabel} showcasing curated apparel, custom tailoring, accessories, and the latest modern and ethnic wear collections.`
      }

      updateField('business_name', businessName)
      updateField('business_type', businessType)
      updateField('description', description)
      pushToast({ title: 'Import completed successfully!', icon: 'check' })
    }, 1200)
  }

  const goToStep = (stepNumber) => {
    const stepMeta = getOnboardingStepByNumber(stepNumber)
    if (stepMeta) {
      navigate(`/onboarding/${stepMeta.slug}`)
    }
  }

  const handleNextStep = () => {
    saveMutation.mutate()
    if (currentStep.number < ONBOARDING_STEPS.length) {
      goToStep(currentStep.number + 1)
    }
  }

  const handleSkipStep = () => {
    if (currentStep.number < ONBOARDING_STEPS.length) {
      goToStep(currentStep.number + 1)
    }
  }

  const handleBackStep = () => {
    if (currentStep.number > 1) {
      goToStep(currentStep.number - 1)
    }
  }

  const handleFinishOnboarding = async () => {
    try {
      await saveMutation.mutateAsync({
        profile: true,
        language: true,
        social: true,
        kyc: true,
      })

      if (form.festival_mode === 'manual' && form.selected_festivals.length > 0) {
        for (const eventId of form.selected_festivals) {
          try {
            await creativeApi.selectEvent(eventId)
          } catch (_) {}
        }
      }

      pushToast({ title: 'Onboarding completed!', body: 'Welcome to your Autopilot dashboard.', icon: 'check' })
      navigate('/dashboard')
    } catch {
      // Handled in mutation callbacks.
    }
  }

  const sampleCopyPreview = useMemo(() => {
    const name = form.business_name || 'My Brand'
    const type = form.business_type || 'restaurant'

    if (type === 'hotel') {
      if (form.tone === 'friendly') return `Looking for a peaceful getaway? ðŸŒ´ Welcome to ${name}! Enjoy spacious rooms, beautiful views, and warm local hospitality with your loved ones. Book your weekend stay with us today! #traveldiaries #vacation`
      if (form.tone === 'bold') return `Pack your bags, adventure is calling! ðŸŽ’ Experience ultimate comfort and boutique luxury at ${name}. Premium vibes, stunning surroundings, and unbeatable views. Direct book today! #staycation #wanderlust`
      if (form.tone === 'professional') return `Discover premium comfort and hospitality at ${name}. We offer well-appointed suites, modern amenities, and dedicated service for leisure and business travelers. Inquire about reservations. #hospitality #boutiquehotel`
      return `Ready to unwind? ðŸŒŠ Enjoy a relaxing stay at ${name} with cozy rooms and warm local service. Your home away from home. Drop us a message for special regional rates! #localstay #boutiqueresort`
    }

    if (type === 'fashion') {
      if (form.tone === 'friendly') return `Add some fresh style to your wardrobe! âœ¨ Welcome to ${name}. Discover our hand-picked collection of premium, comfortable clothing for every occasion. Drop by today! #fashionwear #boutique`
      if (form.tone === 'bold') return `Turn heads wherever you go! ðŸ’¥ Get the trendiest designs, vibrant patterns, and premium fits only at ${name}. Upgrade your style game today. Visited us yet? #fashioninspo #shoplocal`
      if (form.tone === 'professional') return `Elevate your style with curated premium apparel from ${name}. We specialize in custom fits, high-quality fabrics, and timeless designs for everyday and formal wear. #fashionboutique #qualitywear`
      return `New arrivals have dropped at ${name}! ðŸ›ï¸ Beautiful colors, local styles, and comfortable fits at great prices. Come shop with us today! #boutiqueshopping #localboutique`
    }

    if (type === 'salon') {
      if (form.tone === 'friendly') return `Treat yourself to some well-deserved pampering! ðŸ’‡â€â™€ï¸ Welcome to ${name}! Enjoy professional hair styling, skincare, and beauty treatments in a relaxing environment. Book your slot today! #saloncare #pamperyourself`
      if (form.tone === 'bold') return `New look, new you! ðŸ”¥ Transform your style with expert styling, bold makeovers, and premium grooming at ${name}. You deserve to shine. Book now! #makeover #styletransform`
      if (form.tone === 'professional') return `Experience premium grooming and aesthetic care at ${name}. Our certified professionals deliver tailored hair, skin, and spa services using high-quality products. #salonservices #professionalgrooming`
      return `Time for a refresh? ðŸŒŸ Book a haircut or relaxing spa treatment at ${name}. Local care, expert hands, and friendly service. See you soon! #localsalon #spaday`
    }

    if (type === 'fitness') {
      if (form.tone === 'friendly') return `Start your fitness journey with us! ðŸ’ª Welcome to ${name}. Join a supportive community, expert trainers, and reach your wellness goals in a positive environment. Stop by for a trial today! #fitnessgoals #gymlife`
      if (form.tone === 'bold') return `NO EXCUSES! âš¡ Push your limits and crush your health goals at ${name}. State-of-the-art weights, high-energy workouts, and results that speak. Let's get fit! #noexcuses #beastmode`
      if (form.tone === 'professional') return `Commit to long-term health and strength at ${name}. We provide structured training regimens, certified physical trainers, and premium fitness equipment. #fitnessstudio #strengthtraining`
      return `Get active, stay healthy! ðŸƒâ€â™‚ï¸ Join our local community classes at ${name}. Friendly coaches, personalized workouts, and clean facilities. Drop in today! #localgym #wellnessstudio`
    }

    if (type === 'education') {
      if (form.tone === 'friendly') return `Unlock your full potential! ðŸ“š Welcome to ${name}. We provide supportive mentors, comprehensive study materials, and interactive classes to help students succeed. Join us today! #coachingclasses #learnmore`
      if (form.tone === 'bold') return `Crack your exams with confidence! ðŸš€ Get top-tier mentorship, result-focused preparation, and shortcut methods only at ${name}. Enroll now to secure your future! #examprep #success`
      if (form.tone === 'professional') return `Achieve academic excellence at ${name}. We offer structured tutoring programs, experienced subject faculty, and personalized progress assessments for all students. #educationcentre #academicsuccess`
      return `Empowering local students to achieve their dreams! ðŸŽ“ Admissions are open at ${name}. Quality teaching, personalized attention, and proven results. Inquire today! #localcoaching #tuitioncenter`
    }

    if (type === 'wedding') {
      if (form.tone === 'friendly') return `Let us make your special day absolutely perfect! ðŸ’ Welcome to ${name}. We design beautiful themes, coordinate details, and handle arrangements so you can enjoy every moment. Contact us today! #weddingplanner #dreamwedding`
      if (form.tone === 'bold') return `Celebrate your love in style! âœ¨ Make your wedding a breathtaking, high-energy, and unforgettable event at ${name}. Stunning themes, premium decor, and perfect planning. Let's design it! #weddingplanner #granddecor`
      if (form.tone === 'professional') return `Curate a flawless wedding event with ${name}. We deliver complete venue coordination, professional catering management, and sophisticated decor curation tailored to your theme. #weddingvenue #eventplanning`
      return `Celebrate your family moments beautifully! ðŸŒ¸ Custom event decor and venue management by ${name}. Beautiful settings, local coordinators, and perfect coordination. Book your date today! #localvenue #marriagehall`
    }

    if (form.tone === 'friendly') return `Welcome to ${name}! ðŸ˜Š Craving some hot delicious food? Come on in and enjoy our local specialties with your friends and family. We serve hot, fresh meals cooked with love. #supportlocal #foodie`
    if (form.tone === 'bold') return `BOOM! ðŸ”¥ Your tastebuds aren't ready for this! Get the most delicious local dishes only at ${name}. Dynamic spices, vibrant vibe, and unforgettable taste. Visited us yet? #flavorbomb #food`
    if (form.tone === 'professional') return `Experience the highest standards of culinary quality and service at ${name}. Prepared daily with fresh ingredients, our menu delivers consistently excellent flavor. Book your table now. #professionaldining #hospitality`
    return `Kemon acho! ðŸ¦€ Hot piping local specialties are ready here at ${name}. Fresh ingredients, great taste, and a friendly seating environment. Drop by today! #localflavour #seafood`
  }, [form.business_name, form.business_type, form.tone])

  const onboardingContext = useMemo(() => ({
    ageSegments,
    connectedAccounts,
    form,
    generationPhase,
    handleFinishOnboarding,
    handleImportFromWebsite,
    handleLogoColorExtraction,
    handleSuggestPalette,
    industries,
    languages,
    onboardingEvents,
    presetPalettes,
    profile,
    pushToast,
    queryClient,
    removeOnboardingLogo,
    sampleCopyPreview,
    sampleFestivals,
    saveMutation,
    setPaletteCustomized,
    socialApi,
    tones,
    toggleFestival,
    toggleTargetAge,
    updateField,
    uploadAssetMutation,
    ...calendarState,
  }), [
    connectedAccounts,
    form,
    generationPhase,
    handleFinishOnboarding,
    onboardingEvents,
    profile,
    pushToast,
    queryClient,
    sampleCopyPreview,
    saveMutation,
    uploadAssetMutation,
    calendarState,
  ])

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <div style={{ textAlign: 'center' }}>
          <Icon name="clock" size={32} style={{ color: 'var(--mint-500)', animation: 'spin 2s linear infinite' }} />
          <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-400)' }}>Loading setup...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--paper)]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        input[type="range"].premium-slider {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          background: var(--ink-200);
          border-radius: 9999px;
          outline: none;
          margin: 12px 0;
        }
        input[type="range"].premium-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--ink-950);
          cursor: pointer;
          border: 3px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transition: transform 0.1s ease, background-color 0.1s ease;
        }
        input[type="range"].premium-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          background: var(--ink-900);
        }
        input[type="range"].premium-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--ink-950);
          cursor: pointer;
          border: 3px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
          transition: transform 0.1s ease;
        }
        input[type="range"].premium-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
          background: var(--ink-900);
        }
      `,
        }}
      />

      <div className="hidden lg:flex flex-col w-80 shrink-0 bg-[var(--ink-950)] text-white p-8 border-r border-[var(--ink-800)]">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <img src="/logo-dark.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={{ fontSize: 18, fontWeight: 700, tracking: '0.05em' }}>CREAT<span className="text-mint-500">YV</span></span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {ONBOARDING_SECTION_GROUPS.map((item, idx, arr) => {
            const nextStep = arr[idx + 1] ? arr[idx + 1].step : ONBOARDING_STEPS.length + 1
            const isCompleted = currentStep.number >= nextStep
            const isActive = currentStep.number >= item.step && currentStep.number < nextStep

            return (
              <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  onClick={() => goToStep(item.step)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isCompleted ? 'var(--mint-500)' : isActive ? 'var(--paper)' : 'rgba(255,255,255,0.05)',
                      color: isCompleted ? 'white' : isActive ? 'var(--ink-950)' : 'var(--ink-500)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {isCompleted ? <Icon name="check" size={12} /> : idx + 1}
                  </div>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? 'white' : isCompleted ? 'var(--ink-300)' : 'var(--ink-500)',
                    }}
                  >
                    {item.label}
                  </span>
                </div>

                {isActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 38, marginTop: -2 }}>
                    {item.subSteps.map(sub => {
                      const isSubActive = currentStep.number === sub.step
                      const isSubCompleted = currentStep.number > sub.step
                      return (
                        <div
                          key={sub.step}
                          onClick={() => goToStep(sub.step)}
                          style={{
                            fontSize: 12,
                            cursor: 'pointer',
                            color: isSubActive ? 'white' : isSubCompleted ? 'var(--ink-300)' : 'var(--ink-500)',
                            fontWeight: isSubActive ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isSubActive ? 'white' : isSubCompleted ? 'var(--ink-500)' : 'transparent',
                              border: isSubActive || isSubCompleted ? 'none' : '1px solid var(--ink-600)',
                            }}
                          />
                          {sub.label}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-500)' }}>
          Step {currentStep.number} of 12 · CREATYV Social Autopilot
        </div>
      </div>

      <div className="flex lg:hidden flex-col bg-[var(--ink-950)] text-white px-6 py-4 border-b border-[var(--ink-800)] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-dark.png" alt="" className="w-6 h-6 object-contain" />
            <span className="text-sm font-bold tracking-wider">CREAT<span className="text-mint-500">YV</span></span>
          </div>
          <div className="text-xs text-[var(--ink-400)] font-medium">
            Step {currentStep.number} of 12
          </div>
        </div>

        <div className="w-full bg-[var(--ink-800)] h-1 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-mint-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${(currentStep.number / ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--paper)]">
        {currentStep.number !== 12 && (
          <div className="px-6 pt-6 sm:px-10 sm:pt-8 md:px-16 md:pt-10 flex justify-between items-center shrink-0">
            <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--mint-500)', textTransform: 'uppercase', tracking: '0.1em' }}>
              Autopilot Configuration
            </div>
          </div>
        )}

        <div className={currentStep.number === 12 ? "flex-1 overflow-y-auto flex flex-col min-h-0 p-0" : "flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 md:px-16 md:py-10"}>
          <div className={currentStep.number === 12 ? "w-full h-full flex flex-col flex-1 min-h-0" : "w-full max-w-[640px] mx-auto lg:mx-0"}>
            <Outlet context={onboardingContext} />
          </div>
        </div>

        {currentStep.number < 11 && (
          <div className="bg-[var(--paper-tint)] border-t border-[var(--hairline-strong)] py-4 px-6 sm:px-10 md:px-16 flex items-center justify-between shrink-0">
            {currentStep.number > 1 ? (
              <button type="button" onClick={handleBackStep} className="btn ghost">
                <Icon name="arrowLeft" size={13} /> Back
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSkipStep}
                className="btn ghost text-ink-500 hover:text-ink-900"
                style={{ fontSize: 13.5, fontWeight: 600 }}
              >
                Skip step
              </button>
              <button type="button" onClick={handleNextStep} className="btn primary">
                Next <Icon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
