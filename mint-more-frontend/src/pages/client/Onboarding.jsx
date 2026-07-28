import { useEffect, useMemo, useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { socialApi } from '../../api/social'
import { creativeApi } from '../../api/creative'
import { useUIStore } from '../../store/ui'
import Icon from '../../components/ui/Icon'

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
  const queryClient = useQueryClient()
  const pushToast = useUIStore(s => s.pushToast)

  const logoInputRef = useRef(null)
  const logoFileInputRef = useRef(null)

  // Current onboarding step (1 to 12)
  const [step, setStep] = useState(1)

  // Multi-step form state
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

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/profile/me').then(res => res.data.data),
  })
  
  const profile = useMemo(() => profileData?.profile || profileData || {}, [profileData])

  // Real connected social accounts query
  const { data: accountsData } = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => socialApi.getAccounts().then(r => r.data.data),
  })
  const connectedAccounts = useMemo(() => accountsData?.accounts || [], [accountsData])

  // Get current and next month keys for events queries
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

  // Creative calendar events queries
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

  const loadedRef = useRef(false)

  // Load existing profile values into local state only once upon initial fetch
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

  // Mutation to persist step state to backend profile
  const saveMutation = useMutation({
    mutationFn: (checklistUpdates = {}) => {
      const brand_assets = {
        ...profile.brand_assets,
        palette: (form.palette || []).map((hex, index) => ({
          hex,
          label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`
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
        }
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
    }
  })

  // Simulated content generator step
  const [generationPhase, setGenerationPhase] = useState(0)
  useEffect(() => {
    if (step === 11) {
      const timers = [
        setTimeout(() => setGenerationPhase(1), 1200),
        setTimeout(() => setGenerationPhase(2), 2400),
        setTimeout(() => setGenerationPhase(3), 3600),
        setTimeout(() => setGenerationPhase(4), 4800),
        setTimeout(() => setStep(12), 6200),
      ]
      return () => timers.forEach(clearTimeout)
    }
  }, [step])

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
    const list = presetPalettes[form.business_type] || presetPalettes.other
    const currentHexes = (form.palette || []).map(hex => hex.toUpperCase())
    // Filter to find palettes that are different from the current one
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
        
        // Patch the brand assets palette immediately to align database values before invalidation
        try {
          await api.patch('/profile/me', {
            brand_assets: {
              ...updatedProfile.brand_assets,
              palette: (variables.palette || form.palette).map((hex, index) => ({
                hex,
                label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`
              }))
            }
          })
        } catch (_) {}
        
        queryClient.invalidateQueries({ queryKey: ['my-profile'] })
      }
      pushToast({ title: `${variables.kind === 'logo' ? 'Logo' : 'Asset'} uploaded successfully!`, icon: 'check' })
    },
    onError: (err) => {
      pushToast({ title: 'Upload failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
    }
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
    pushToast({ title: 'Extracting brand colors from logo...', icon: 'sparkles' })
    const palette = await extractPaletteFromImage(file)
    const currentLen = form.palette.length > 0 ? form.palette.length : 4
    const slicedPalette = palette.slice(0, currentLen)
    updateField('palette', slicedPalette)

    // Instantly patch the database with the extracted colors
    try {
      const dbPalette = slicedPalette.map((hex, index) => ({
        hex,
        label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || `Color ${index + 1}`
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
      // 1. Clean and parse URL/domain name
      let cleanUrl = form.website.trim();
      cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
      const parts = cleanUrl.split('/');
      const domain = parts[0] || '';
      
      // Strip common domain extensions
      const namePart = domain.replace(/\.(com|in|co\.in|net|org|edu|gov|io|biz|info|in|me)$/i, '');
      
      // Split by dots, hyphens or underscores and capitalize words
      const words = namePart.split(/[-_.]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
      let businessName = words.join(' ');
      
      // 2. Classify industry type/vertical by keywords in URL
      const lowerUrl = cleanUrl.toLowerCase();
      let businessType = 'other';
      let typeLabel = 'local business';
      
      if (lowerUrl.includes('hotel') || lowerUrl.includes('resort') || lowerUrl.includes('stay') || lowerUrl.includes('inn') || lowerUrl.includes('lodge') || lowerUrl.includes('retreat')) {
        businessType = 'hotel';
        typeLabel = 'boutique stay';
      } else if (lowerUrl.includes('cafe') || lowerUrl.includes('restaurant') || lowerUrl.includes('dhaba') || lowerUrl.includes('food') || lowerUrl.includes('pizza') || lowerUrl.includes('bakery') || lowerUrl.includes('kitchen') || lowerUrl.includes('bites')) {
        businessType = 'restaurant';
        typeLabel = 'restaurant and cafe';
      } else if (lowerUrl.includes('gym') || lowerUrl.includes('fitness') || lowerUrl.includes('yoga') || lowerUrl.includes('wellness') || lowerUrl.includes('fit') || lowerUrl.includes('studio')) {
        businessType = 'fitness';
        typeLabel = 'fitness and wellness studio';
      } else if (lowerUrl.includes('coaching') || lowerUrl.includes('edu') || lowerUrl.includes('academy') || lowerUrl.includes('learn') || lowerUrl.includes('class') || lowerUrl.includes('institute') || lowerUrl.includes('training')) {
        businessType = 'education';
        typeLabel = 'coaching and training institute';
      } else if (lowerUrl.includes('wedding') || lowerUrl.includes('event') || lowerUrl.includes('planner') || lowerUrl.includes('marriage') || lowerUrl.includes('banquet')) {
        businessType = 'wedding';
        typeLabel = 'wedding planning and venue services';
      } else if (lowerUrl.includes('salon') || lowerUrl.includes('spa') || lowerUrl.includes('parlour') || lowerUrl.includes('grooming') || lowerUrl.includes('hair') || lowerUrl.includes('beauty')) {
        businessType = 'salon';
        typeLabel = 'premium salon and spa';
      } else if (lowerUrl.includes('boutique') || lowerUrl.includes('fashion') || lowerUrl.includes('cloth') || lowerUrl.includes('wear') || lowerUrl.includes('store') || lowerUrl.includes('shop') || lowerUrl.includes('retail')) {
        businessType = 'fashion';
        typeLabel = 'clothing and lifestyle boutique';
      }

      // Add a descriptor suffix if not already present
      if (businessType !== 'other' && !lowerUrl.includes(businessType) && !lowerUrl.includes(typeLabel.split(' ')[0])) {
        const typeSuffix = businessType.charAt(0).toUpperCase() + businessType.slice(1);
        businessName += ` ${typeSuffix}`;
      }

      // 3. Generate dynamic business description
      let description = `Welcome to ${businessName}. We are a premium ${typeLabel} dedicated to offering exceptional services, high-quality standards, and a customer-first experience.`;
      if (businessType === 'hotel') {
        description = `${businessName} is a cozy ${typeLabel} offering beautiful rooms, exceptional hospitality, premium amenities, and a peaceful atmosphere for a perfect getaway.`;
      } else if (businessType === 'restaurant') {
        description = `${businessName} is a popular ${typeLabel} serving delicious dishes, freshly prepared local delicacies, and premium beverages in a warm, welcoming environment.`;
      } else if (businessType === 'fitness') {
        description = `${businessName} is a modern ${typeLabel} offering professional trainers, customized workout regimens, wellness classes, and state-of-the-art equipment.`;
      } else if (businessType === 'education') {
        description = `${businessName} is a leading ${typeLabel} providing high-quality classes, experienced faculty, specialized mentorship, and comprehensive test prep.`;
      } else if (businessType === 'wedding') {
        description = `${businessName} provides premium ${typeLabel} to curate memorable events, beautiful wedding themes, full-service catering, and flawless coordination.`;
      } else if (businessType === 'salon') {
        description = `${businessName} is a premium ${typeLabel} offering expert hair styling, makeup services, relaxing wellness treatments, and complete personal grooming.`;
      } else if (businessType === 'fashion') {
        description = `${businessName} is a trendy ${typeLabel} showcasing curated apparel, custom tailoring, accessories, and the latest modern and ethnic wear collections.`;
      }

      // Apply fields
      updateField('business_name', businessName)
      updateField('business_type', businessType)
      updateField('description', description)
      pushToast({ title: 'Import completed successfully!', icon: 'check' })
    }, 1200)
  }

  const handleNextStep = () => {
    saveMutation.mutate()
    setStep(prev => prev + 1)
  }

  const handleSkipStep = () => {
    setStep(prev => prev + 1)
  }

  const handleFinishOnboarding = async () => {
    try {
      await saveMutation.mutateAsync({
        profile: true,
        language: true,
        social: true,
        kyc: true,
      })

      // Persist manual event selections to the backend calendar
      if (form.festival_mode === 'manual' && form.selected_festivals.length > 0) {
        for (const eventId of form.selected_festivals) {
          try {
            await creativeApi.selectEvent(eventId)
          } catch (_) {
            // Silently skip if event is already selected
          }
        }
      }

      pushToast({ title: 'Onboarding completed!', body: 'Welcome to your Autopilot dashboard.', icon: 'check' })
      navigate('/dashboard')
    } catch {
      // Handled
    }
  }

  const sampleCopyPreview = useMemo(() => {
    const name = form.business_name || 'My Brand'
    const type = form.business_type || 'restaurant'
    
    if (type === 'hotel') {
      if (form.tone === 'friendly') {
        return `Looking for a peaceful getaway? 🌴 Welcome to ${name}! Enjoy spacious rooms, beautiful views, and warm local hospitality with your loved ones. Book your weekend stay with us today! #traveldiaries #vacation`
      }
      if (form.tone === 'bold') {
        return `Pack your bags, adventure is calling! 🎒 Experience ultimate comfort and boutique luxury at ${name}. Premium vibes, stunning surroundings, and unbeatable views. Direct book today! #staycation #wanderlust`
      }
      if (form.tone === 'professional') {
        return `Discover premium comfort and hospitality at ${name}. We offer well-appointed suites, modern amenities, and dedicated service for leisure and business travelers. Inquire about reservations. #hospitality #boutiquehotel`
      }
      return `Ready to unwind? 🌊 Enjoy a relaxing stay at ${name} with cozy rooms and warm local service. Your home away from home. Drop us a message for special regional rates! #localstay #boutiqueresort`
    }
    
    if (type === 'fashion') {
      if (form.tone === 'friendly') {
        return `Add some fresh style to your wardrobe! ✨ Welcome to ${name}. Discover our hand-picked collection of premium, comfortable clothing for every occasion. Drop by today! #fashionwear #boutique`
      }
      if (form.tone === 'bold') {
        return `Turn heads wherever you go! 💥 Get the trendiest designs, vibrant patterns, and premium fits only at ${name}. Upgrade your style game today. Visited us yet? #fashioninspo #shoplocal`
      }
      if (form.tone === 'professional') {
        return `Elevate your style with curated premium apparel from ${name}. We specialize in custom fits, high-quality fabrics, and timeless designs for everyday and formal wear. #fashionboutique #qualitywear`
      }
      return `New arrivals have dropped at ${name}! 🛍️ Beautiful colors, local styles, and comfortable fits at great prices. Come shop with us today! #boutiqueshopping #localboutique`
    }
    
    if (type === 'salon') {
      if (form.tone === 'friendly') {
        return `Treat yourself to some well-deserved pampering! 💇‍♀️ Welcome to ${name}! Enjoy professional hair styling, skincare, and beauty treatments in a relaxing environment. Book your slot today! #saloncare #pamperyourself`
      }
      if (form.tone === 'bold') {
        return `New look, new you! 🔥 Transform your style with expert styling, bold makeovers, and premium grooming at ${name}. You deserve to shine. Book now! #makeover #styletransform`
      }
      if (form.tone === 'professional') {
        return `Experience premium grooming and aesthetic care at ${name}. Our certified professionals deliver tailored hair, skin, and spa services using high-quality products. #salonservices #professionalgrooming`
      }
      return `Time for a refresh? 🌟 Book a haircut or relaxing spa treatment at ${name}. Local care, expert hands, and friendly service. See you soon! #localsalon #spaday`
    }
    
    if (type === 'fitness') {
      if (form.tone === 'friendly') {
        return `Start your fitness journey with us! 💪 Welcome to ${name}. Join a supportive community, expert trainers, and reach your wellness goals in a positive environment. Stop by for a trial today! #fitnessgoals #gymlife`
      }
      if (form.tone === 'bold') {
        return `NO EXCUSES! ⚡ Push your limits and crush your health goals at ${name}. State-of-the-art weights, high-energy workouts, and results that speak. Let's get fit! #noexcuses #beastmode`
      }
      if (form.tone === 'professional') {
        return `Commit to long-term health and strength at ${name}. We provide structured training regimens, certified physical trainers, and premium fitness equipment. #fitnessstudio #strengthtraining`
      }
      return `Get active, stay healthy! 🏃‍♂️ Join our local community classes at ${name}. Friendly coaches, personalized workouts, and clean facilities. Drop in today! #localgym #wellnessstudio`
    }
    
    if (type === 'education') {
      if (form.tone === 'friendly') {
        return `Unlock your full potential! 📚 Welcome to ${name}. We provide supportive mentors, comprehensive study materials, and interactive classes to help students succeed. Join us today! #coachingclasses #learnmore`
      }
      if (form.tone === 'bold') {
        return `Crack your exams with confidence! 🚀 Get top-tier mentorship, result-focused preparation, and shortcut methods only at ${name}. Enroll now to secure your future! #examprep #success`
      }
      if (form.tone === 'professional') {
        return `Achieve academic excellence at ${name}. We offer structured tutoring programs, experienced subject faculty, and personalized progress assessments for all students. #educationcentre #academicsuccess`
      }
      return `Empowering local students to achieve their dreams! 🎓 Admissions are open at ${name}. Quality teaching, personalized attention, and proven results. Inquire today! #localcoaching #tuitioncenter`
    }
    
    if (type === 'wedding') {
      if (form.tone === 'friendly') {
        return `Let us make your special day absolutely perfect! 💍 Welcome to ${name}. We design beautiful themes, coordinate details, and handle arrangements so you can enjoy every moment. Contact us today! #weddingplanner #dreamwedding`
      }
      if (form.tone === 'bold') {
        return `Celebrate your love in style! ✨ Make your wedding a breathtaking, high-energy, and unforgettable event at ${name}. Stunning themes, premium decor, and perfect planning. Let's design it! #weddingplanner #granddecor`
      }
      if (form.tone === 'professional') {
        return `Curate a flawless wedding event with ${name}. We deliver complete venue coordination, professional catering management, and sophisticated decor curation tailored to your theme. #weddingvenue #eventplanning`
      }
      return `Celebrate your family moments beautifully! 🌸 Custom event decor and venue management by ${name}. Beautiful settings, local coordinators, and perfect coordination. Book your date today! #localvenue #marriagehall`
    }
    
    // Default restaurant/cafe copy
    if (form.tone === 'friendly') {
      return `Welcome to ${name}! 😊 Craving some hot delicious food? Come on in and enjoy our local specialties with your friends and family. We serve hot, fresh meals cooked with love. #supportlocal #foodie`
    }
    if (form.tone === 'bold') {
      return `BOOM! 🔥 Your tastebuds aren't ready for this! Get the most delicious local dishes only at ${name}. Dynamic spices, vibrant vibe, and unforgettable taste. Visited us yet? #flavorbomb #food`
    }
    if (form.tone === 'professional') {
      return `Experience the highest standards of culinary quality and service at ${name}. Prepared daily with fresh ingredients, our menu delivers consistently excellent flavor. Book your table now. #professionaldining #hospitality`
    }
    return `Kemon acho! 🦀 Hot piping local specialties are ready here at ${name}. Fresh ingredients, great taste, and a friendly seating environment. Drop by today! #localflavour #seafood`
  }, [form.business_name, form.tone, form.business_type])

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div style={{ textAlign: 'center' }}>
        <Icon name="clock" size={32} style={{ color: 'var(--mint-500)', animation: 'spin 2s linear infinite' }} />
        <div style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-400)' }}>Loading setup...</div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--paper)]">
      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />
      
      {/* Immersive Left Sidebar — Step Indicators (Hidden on mobile/tablet) */}
      <div className="hidden lg:flex flex-col w-80 shrink-0 bg-[var(--ink-950)] text-white p-8 border-r border-[var(--ink-800)]">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <img src="/logo-dark.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <span style={{ fontSize: 18, fontWeight: 700, tracking: '0.05em' }}>CREAT<span className="text-mint-500">YV</span></span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {[
            { 
              step: 1, 
              label: 'Brand & Workspace',
              subSteps: [
                { step: 1, label: 'Workspace Details' },
                { step: 2, label: 'Business Basics' },
                { step: 3, label: 'Brand Voice' }
              ]
            },
            { 
              step: 4, 
              label: 'Visual Palette & Logos',
              subSteps: [
                { step: 4, label: 'Visual Palette' },
                { step: 5, label: 'Brand Assets' }
              ]
            },
            { 
              step: 6, 
              label: 'Content & Occasions',
              subSteps: [
                { step: 6, label: 'Content Cadence' },
                { step: 7, label: 'Festivals & Occasions' }
              ]
            },
            { 
              step: 8, 
              label: 'Connected Channels',
              subSteps: [
                { step: 8, label: 'Connect Channels' },
                { step: 9, label: 'WhatsApp & Reminders' },
                { step: 10, label: 'Approval Rules' }
              ]
            },
            { 
              step: 11, 
              label: 'First Content Plan',
              subSteps: [
                { step: 11, label: 'Content Generation' },
                { step: 12, label: 'Preview & Approve' }
              ]
            },
          ].map((item, idx, arr) => {
            const nextStep = arr[idx + 1] ? arr[idx + 1].step : 13;
            const isCompleted = step >= nextStep;
            const isActive = step >= item.step && step < nextStep;
            
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div 
                  onClick={() => setStep(item.step)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: isCompleted ? 'var(--mint-500)' : isActive ? 'var(--paper)' : 'rgba(255,255,255,0.05)',
                    color: isCompleted ? 'white' : isActive ? 'var(--ink-950)' : 'var(--ink-500)',
                    display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700
                  }}>
                    {isCompleted ? <Icon name="check" size={12} /> : idx + 1}
                  </div>
                  <span style={{
                    fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'white' : isCompleted ? 'var(--ink-300)' : 'var(--ink-500)'
                  }}>
                    {item.label}
                  </span>
                </div>

                {isActive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 38, marginTop: -2 }}>
                    {item.subSteps.map(sub => {
                      const isSubActive = step === sub.step;
                      const isSubCompleted = step > sub.step;
                      return (
                        <div 
                          key={sub.step}
                          onClick={() => setStep(sub.step)}
                          style={{
                            fontSize: 12,
                            cursor: 'pointer',
                            color: isSubActive ? 'white' : isSubCompleted ? 'var(--ink-300)' : 'var(--ink-500)',
                            fontWeight: isSubActive ? 600 : 400,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: isSubActive ? 'white' : isSubCompleted ? 'var(--ink-500)' : 'transparent',
                            border: isSubActive || isSubCompleted ? 'none' : '1px solid var(--ink-600)'
                          }} />
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
          Step {step} of 12 · CREATYV Social Autopilot
        </div>
      </div>

      {/* Mobile/Tablet Header & Progress Bar (Visible on mobile/tablet) */}
      <div className="flex lg:hidden flex-col bg-[var(--ink-950)] text-white px-6 py-4 border-b border-[var(--ink-800)] shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-dark.png" alt="" className="w-6 h-6 object-contain" />
            <span className="text-sm font-bold tracking-wider">CREAT<span className="text-mint-500">YV</span></span>
          </div>
          <div className="text-xs text-[var(--ink-400)] font-medium">
            Step {step} of 12
          </div>
        </div>
        
        {/* Simple Progress Bar */}
        <div className="w-full bg-[var(--ink-800)] h-1 rounded-full mt-3 overflow-hidden">
          <div 
            className="bg-mint-500 h-full transition-all duration-500 ease-out" 
            style={{ width: `${(step / 12) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Form Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--paper)]">
        
        {/* Navigation Topbar */}
        <div className="px-6 pt-6 sm:px-10 sm:pt-8 md:px-16 md:pt-10 flex justify-between items-center shrink-0">
          <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--mint-500)', textTransform: 'uppercase', tracking: '0.1em' }}>
            Autopilot Configuration
          </div>
        </div>

        {/* Step-by-step Form Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 md:px-16 md:py-10">
          <div className="w-full max-w-[640px] mx-auto lg:mx-0">
          
          {/* STEP 1: Brand & Workspace */}
          {step === 1 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Let's create your workspace</h1>
                <p className="muted" style={{ marginTop: 8 }}>Provide your basic business info to lock down your brand details.</p>
              </div>

              <div className="field">
                <label className="field-label">Website URL (Optional)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    className="input"
                    value={form.website}
                    onChange={e => updateField('website', e.target.value)}
                    placeholder="https://mybusiness.com"
                    style={{ flex: 1 }}
                  />
                  <button className="btn ghost shrink-0" type="button" onClick={handleImportFromWebsite}>
                    <Icon name="sparkles" size={13} /> Import info
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="field">
                  <label className="field-label">Business Name</label>
                  <input
                    className="input"
                    value={form.business_name}
                    onChange={e => updateField('business_name', e.target.value)}
                    placeholder="e.g. Bhouter Bari Hotel"
                  />
                </div>

                <div className="field">
                  <label className="field-label">Industry Category</label>
                  <select
                    className="input"
                    value={form.business_type}
                    onChange={e => updateField('business_type', e.target.value)}
                  >
                    {industries.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="field">
                  <label className="field-label">Primary Language</label>
                  <select
                    className="input"
                    value={form.preferred_language}
                    onChange={e => updateField('preferred_language', e.target.value)}
                  >
                    {languages.map(([val, name]) => <option key={val} value={val}>{name}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label className="field-label">Location (City)</label>
                  <input
                    className="input"
                    value={form.address_city}
                    onChange={e => updateField('address_city', e.target.value)}
                    placeholder="e.g. Mandarmoni"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Business Basics */}
          {step === 2 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Tell us about your business</h1>
                <p className="muted" style={{ marginTop: 8 }}>Describe your products so the AI doesn't invent incorrect claims.</p>
              </div>

              <div className="field">
                <label className="field-label">Business Description</label>
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.description}
                  onChange={e => updateField('description', e.target.value)}
                  placeholder="Describe your business, offerings, and unique value proposition..."
                />
              </div>

              <div className="field">
                <label className="field-label">Key Products / Services</label>
                <input
                  className="input"
                  value={form.products_services}
                  onChange={e => updateField('products_services', e.target.value)}
                  placeholder="e.g. Tandoori Chicken, Ocean View Rooms, Spa Treatment"
                />
              </div>

            </div>
          )}

          {/* STEP 3: Brand Voice & Audience */}
          {step === 3 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Establish your brand voice</h1>
                <p className="muted" style={{ marginTop: 8 }}>Tone dictates all future AI-generated post copy.</p>
              </div>

              <div className="field">
                <label className="field-label">Select Tone of Voice</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tones.map(t => (
                    <label key={t.id} style={{
                      display: 'flex', gap: 12, padding: 14, border: '1px solid var(--hairline)',
                      borderRadius: 12, cursor: 'pointer', background: form.tone === t.id ? 'var(--mint-50)' : 'transparent',
                      borderColor: form.tone === t.id ? 'var(--mint-400)' : 'var(--hairline-strong)', transition: '.1s'
                    }}>
                      <input
                        type="radio"
                        name="tone"
                        checked={form.tone === t.id}
                        onChange={() => updateField('tone', t.id)}
                        style={{ marginTop: 3 }}
                      />
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)' }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>{t.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">Target Audience Segment</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ageSegments.map(seg => {
                    const active = form.target_ages.includes(seg.id)
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => toggleTargetAge(seg.id)}
                        className={`btn ${active ? 'primary' : 'ghost'}`}
                        style={{ borderRadius: 20, padding: '6px 14px', fontSize: 12.5 }}
                      >
                        {seg.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="card" style={{ padding: 16, background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--ink-500)', textTransform: 'uppercase', marginBottom: 8 }}>
                  <Icon name="sparkles" size={12} style={{ color: 'var(--mint-600)' }} /> Live Tone Preview
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-800)', lineHeight: 1.6 }}>
                  "{sampleCopyPreview}"
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Brand Colors */}
          {step === 4 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Establish your visual palette</h1>
                <p className="muted" style={{ marginTop: 8 }}>These colors will be used as coordinates for brand templates.</p>
              </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)' }}>Brand Color Palette</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-550)', marginRight: 2 }}>Colors:</span>
                    {[2, 3, 4].map(num => {
                      const active = form.palette.length === num
                      return (
                        <button
                          key={num}
                          type="button"
                          className={`btn ${active ? 'primary' : 'ghost'}`}
                          style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11 }}
                          onClick={() => {
                            let nextPalette = [...form.palette]
                            if (nextPalette.length > num) {
                              nextPalette = nextPalette.slice(0, num)
                            } else if (nextPalette.length < num) {
                              const suggestion = presetPalettes[form.business_type || 'restaurant']?.[0] || presetPalettes.other[0]
                              while (nextPalette.length < num) {
                                nextPalette.push(suggestion[nextPalette.length] || '#111111')
                              }
                            }
                            updateField('palette', nextPalette)
                          }}
                        >
                          {num}
                        </button>
                      )
                    })}
                  </div>
                  <button className="btn ghost" type="button" onClick={handleSuggestPalette} style={{ padding: '4px 10px', fontSize: 11.5 }}>
                    <Icon name="sparkles" size={13} /> Suggest palette
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                {form.palette.map((color, idx) => (
                  <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{
                      aspectRatio: '1', borderRadius: 12, background: color, border: '2px solid var(--hairline-strong)',
                      marginBottom: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }} />
                    <code style={{ fontSize: 11.5, color: 'var(--ink-600)' }}>{color}</code>
                  </div>
                ))}
              </div>

              <div className="field">
                <label className="field-label">Custom Palette Colors</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {form.palette.map((color, idx) => (
                    <input
                      key={idx}
                      type="color"
                      value={color}
                      onChange={e => {
                        const newPalette = [...form.palette]
                        newPalette[idx] = e.target.value
                        updateField('palette', newPalette)
                      }}
                      style={{ width: 48, height: 48, border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}
                    />
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding: 16, background: 'var(--paper-tint)', border: '1px dashed var(--hairline-strong)', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 10, background: 'var(--paper)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="image" size={20} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink-950)' }}>Extract colors from your logo</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>Upload your logo and we will automatically find your matching brand colors.</div>
                  </div>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    style={{ fontSize: 12, padding: '6px 12px' }}
                  >
                    Upload logo
                  </button>
                </div>
                <input
                  type="file"
                  ref={logoFileInputRef}
                  onChange={handleLogoColorExtraction}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          )}

          {/* STEP 5: Brand Assets (Logos & Files) */}
          {step === 5 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Add your brand assets</h1>
                <p className="muted" style={{ marginTop: 8 }}>Upload logos and product reference photos to attach to posts.</p>
              </div>

              <div
                onClick={() => logoInputRef.current?.click()}
                style={{
                  height: 160, border: '2px dashed var(--hairline-strong)', borderRadius: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                  cursor: 'pointer', background: 'var(--paper-tint)'
                }}
              >
                <Icon name="upload" size={32} style={{ color: 'var(--ink-400)' }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-700)', marginTop: 10 }}>
                  {uploadAssetMutation.isPending ? 'Uploading logo...' : 'Upload logo files & photos'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-400)', marginTop: 4 }}>Drag and drop PNG, JPG or WebP (max 10MB)</div>
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoColorExtraction}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {form.logos.length === 0 ? (
                  <>
                    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--hairline-strong)', display: 'grid', placeItems: 'center', background: 'var(--ink-50)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-500)' }}>Logo Light</span>
                    </div>
                    <div style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--hairline-strong)', display: 'grid', placeItems: 'center', background: 'var(--ink-950)', color: 'white' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-300)' }}>Logo Dark</span>
                    </div>
                  </>
                ) : (
                  form.logos.map((logo, index) => (
                    <div key={logo.id || index} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--hairline-strong)' }} className="group">
                      <img
                        src={logo.preview_url || logo.url}
                        alt={logo.label || logo.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeOnboardingLogo(logo.id)
                        }}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                          border: 'none', borderRadius: '50%',
                          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontSize: 11, fontWeight: 'bold', zIndex: 10
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Content Cadence */}
          {step === 6 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Set content frequency</h1>
                <p className="muted" style={{ marginTop: 8 }}>Determine how often Autopilot schedules and drafts content.</p>
              </div>

              <div className="field">
                <label className="field-label">Posting Frequency</label>
                <select
                  className="input"
                  value={form.posting_frequency}
                  onChange={e => updateField('posting_frequency', e.target.value)}
                >
                  <option value="1">1 Post per week</option>
                  <option value="3">3 Posts per week (Recommended)</option>
                  <option value="5">5 Posts per week</option>
                  <option value="7">Daily posts</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">Content Mix (Campaigns vs Evergreen)</label>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 650, color: 'var(--ink-500)', marginBottom: 8 }}>
                  <span>Evergreen ({form.evergreen_ratio}%)</span>
                  <span>Promotional ({100 - parseInt(form.evergreen_ratio || '50', 10)}%)</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="10"
                  value={form.evergreen_ratio}
                  onChange={e => updateField('evergreen_ratio', e.target.value)}
                  className="premium-slider"
                  style={{ width: '100%', cursor: 'pointer', outline: 'none' }}
                />
                <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  Evergreen content focuses on education and brand value, while promotional content targets active offers.
                </p>
              </div>
            </div>
          )}

          {/* STEP 7: Festivals & Occasions */}
          {step === 7 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Festival & occasion strategy</h1>
                <p className="muted" style={{ marginTop: 8 }}>Tell us how to handle festivals and special occasions. We cover everything from Diwali to Father's Day to Jagannath Puja — automatically, every month.</p>
              </div>

              {/* Autopilot / Manual toggle */}
              <div className="field">
                <label className="field-label">How should we plan your festival content?</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                  {[
                    {
                      value: 'autopilot',
                      icon: 'zap',
                      title: 'Smart Autopilot',
                      badge: 'RECOMMENDED',
                      desc: 'We automatically design & schedule posts for every cultural event and special day. Zero effort needed from you.',
                    },
                    {
                      value: 'manual',
                      icon: 'sliders',
                      title: "I'll pick manually",
                      badge: null,
                      desc: 'Hand-pick the specific festivals you want us to cover from our list.',
                    },
                  ].map(opt => {
                    const selected = form.festival_mode === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateField('festival_mode', opt.value)}
                        style={{
                          textAlign: 'left',
                          padding: '20px',
                          border: `2px solid ${selected ? 'var(--ink-950)' : 'var(--hairline-strong)'}`,
                          borderRadius: 16,
                          background: selected ? 'var(--paper-tint)' : 'var(--paper)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: selected ? '0 4px 14px rgba(11, 15, 20, 0.06)' : 'none'
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: selected ? 'var(--ink-950)' : 'var(--paper-tint)',
                          color: selected ? '#fff' : 'var(--ink-450)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12
                        }}>
                          <Icon name={opt.icon} size={18} style={{ color: selected ? '#fff' : 'var(--ink-600)' }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: selected ? 'var(--ink-950)' : 'var(--ink-800)', marginBottom: 4 }}>
                          {opt.title}
                          {opt.badge && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, letterSpacing: 1, border: '1px solid var(--mint-300)', background: 'var(--mint-50)', color: 'var(--mint-700)', borderRadius: 6, padding: '3px 8px' }}>{opt.badge}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-500)', lineHeight: 1.5 }}>{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Autopilot confirmation */}
              {form.festival_mode === 'autopilot' && (
                <div style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <Icon name="checkCircle" size={20} style={{ color: 'var(--mint-500)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink-900)', marginBottom: 4 }}>Autopilot active</div>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-650)', lineHeight: 1.6 }}>
                      Mintbox will automatically design and schedule posts for <strong>every cultural festival, national holiday, and special occasion</strong> — from Diwali to Jagannath Puja, Father's Day to Yoga Day, every single month.
                    </div>
                  </div>
                </div>
              )}

              {/* Manual festival checklist */}
              {form.festival_mode === 'manual' && (
                <div className="field animate-in fade-in duration-300">
                  <label className="field-label">Select the occasions to cover</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {(onboardingEvents && onboardingEvents.length > 0 ? onboardingEvents : [
                      { id: 'diwali', title: 'Diwali', date: '2026-11-01', region: 'National' },
                      { id: 'holi', title: 'Holi', date: '2026-03-25', region: 'National' },
                      { id: 'eid', title: 'Eid', date: '2026-04-10', region: 'National' },
                      { id: 'durga_puja', title: 'Durga Puja', date: '2026-10-20', region: 'East & West' },
                      { id: 'christmas', title: 'Christmas', date: '2026-12-25', region: 'Global' },
                      { id: 'ganesh_chaturthi', title: 'Ganesh Chaturthi', date: '2026-09-15', region: 'West & National' },
                      { id: 'independence_day', title: 'Independence Day', date: '2026-08-15', region: 'National' },
                      { id: 'republic_day', title: 'Republic Day', date: '2026-01-26', region: 'National' },
                    ]).map(fest => {
                      const active = form.selected_festivals.includes(fest.id)
                      const dateStr = fest.date 
                        ? new Date(fest.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : fest.region || 'National'
                      return (
                        <div
                          key={fest.id}
                          onClick={() => toggleFestival(fest.id)}
                          style={{
                            padding: 14,
                            border: `1.5px solid ${active ? 'var(--ink-950)' : 'var(--hairline-strong)'}`,
                            borderRadius: 14,
                            cursor: 'pointer',
                            background: active ? 'var(--paper-tint)' : 'var(--paper)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            transition: 'all 0.15s'
                          }}
                        >
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: active ? 'var(--ink-950)' : 'var(--paper-tint)',
                            color: active ? '#fff' : 'var(--ink-300)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <Icon name={active ? 'check' : 'plus'} size={12} style={{ color: active ? '#fff' : 'var(--ink-500)' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-950)' }}>{fest.title || fest.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-550)', marginTop: 2 }}>{dateStr}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Lead time */}
              <div className="field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>Design lead time</label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-700)', background: 'var(--paper-tint)', border: '1px solid var(--hairline-strong)', padding: '3px 10px', borderRadius: 8 }}>{form.festival_lead_days} days before</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="14"
                  step="1"
                  value={form.festival_lead_days}
                  onChange={e => updateField('festival_lead_days', e.target.value)}
                  className="w-full h-1.5 bg-ink-200 rounded-lg appearance-none cursor-pointer accent-mint-500"
                  style={{ outline: 'none' }}
                />
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>How many days before each festival Mintbox begins designing the post and sends you a preview.</p>
              </div>
            </div>
          )}

          {/* STEP 8: Connect Channels */}
          {step === 8 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Connect your target channels</h1>
                <p className="muted" style={{ marginTop: 8 }}>Integrate your accounts to publish direct from CREATYV.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'facebook', name: 'Facebook Pages', icon: 'facebook', color: '#1877F2' },
                  { id: 'instagram', name: 'Instagram Business', icon: 'instagram', color: '#E1306C' },
                  { id: 'youtube', name: 'YouTube Channels', icon: 'youtube', color: '#FF0000' },
                  { id: 'google_business_profile', name: 'Google Business Profile', icon: 'globe', color: '#4285F4' },
                ].map(plat => {
                  const account = connectedAccounts.find(a => a.platform === plat.id)
                  const isGbMock = plat.id === 'google_business_profile' && form.connected_platforms.includes(plat.id)
                  const connected = Boolean(account || isGbMock)
                  
                  return (
                    <div key={plat.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: 16, border: '1px solid var(--hairline-strong)', borderRadius: 14, background: 'var(--paper-tint)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', background: 'white',
                          display: 'grid', placeItems: 'center', border: '1px solid var(--hairline)'
                        }}>
                          <Icon name={plat.icon} size={16} style={{ color: plat.color }} />
                        </div>
                        <div>
                          <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)', display: 'block' }}>{plat.name}</span>
                          {connected && (
                            <span style={{ fontSize: 11, color: 'var(--mint-600)', fontWeight: 700, display: 'block', marginTop: 2 }}>
                              ✓ Connected {account?.page_name ? `(${account.page_name})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn ${connected ? 'ghost' : 'primary'}`}
                        onClick={async () => {
                          if (connected) {
                            if (plat.id === 'google_business_profile') {
                              updateField('connected_platforms', form.connected_platforms.filter(p => p !== plat.id))
                              pushToast({ title: 'Channel disconnected', icon: 'check' })
                            } else if (account) {
                              try {
                                await socialApi.disconnect(account.id)
                                queryClient.invalidateQueries({ queryKey: ['social-accounts'] })
                                pushToast({ title: 'Channel disconnected successfully!', icon: 'check' })
                              } catch (err) {
                                pushToast({ title: 'Disconnect failed', body: err.response?.data?.message, tone: 'amber', icon: 'x' })
                              }
                            }
                          } else {
                            if (plat.id === 'google_business_profile') {
                              updateField('connected_platforms', [...form.connected_platforms, plat.id])
                              pushToast({ title: 'Google Business Profile connected successfully!', icon: 'check' })
                            } else {
                              const accessToken = localStorage.getItem('access_token')
                              if (plat.id === 'facebook') return socialApi.connectFacebook(accessToken)
                              if (plat.id === 'instagram') return socialApi.connectInstagram(accessToken)
                              if (plat.id === 'youtube') return socialApi.connectYouTube(accessToken)
                            }
                          }
                        }}
                      >
                        {connected ? 'Disconnect' : 'Connect'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 9: WhatsApp & Reminders */}
          {step === 9 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Opt-in for WhatsApp approvals</h1>
                <p className="muted" style={{ marginTop: 8 }}>Receive instant notifications to preview and approve scheduled drafts.</p>
              </div>

              <div className="field">
                <label className="field-label">WhatsApp Phone Number</label>
                <input
                  className="input"
                  value={form.whatsapp_number}
                  onChange={e => updateField('whatsapp_number', e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>

              <label style={{ display: 'flex', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.whatsapp_consent}
                  onChange={e => updateField('whatsapp_consent', e.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span style={{ fontSize: 13, color: 'var(--ink-700)', lineHeight: 1.5 }}>
                  Yes, I consent to receive automated notifications and interactive buttons to approve my draft posts.
                </span>
              </label>

              <div className="field">
                <label className="field-label">Quiet Hours (Do Not Disturb)</label>
                <input
                  className="input"
                  value={form.quiet_hours}
                  onChange={e => updateField('quiet_hours', e.target.value)}
                  placeholder="e.g. 22:00-08:00"
                />
              </div>
            </div>
          )}

          {/* STEP 10: Approval Rules */}
          {step === 10 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Configure approval policy</h1>
                <p className="muted" style={{ marginTop: 8 }}>Define the balance of control vs autonomy for Social Autopilot.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'every_post', name: 'Approve Every Post', desc: 'No post goes live without your explicit approval via WhatsApp or Dashboard.' },
                  { id: 'autopilot', name: 'Full Autopilot', desc: 'General educational posts publish automatically. Festival greetings and promo offers demand approvals.' },
                  { id: 'weekly_batch', name: 'Weekly Batch Review', desc: 'Recieve one notification on Mondays to review and approve all posts for the week.' },
                ].map(policy => (
                  <label key={policy.id} style={{
                    display: 'flex', gap: 12, padding: 16, border: '1px solid var(--hairline)',
                    borderRadius: 14, cursor: 'pointer', background: form.approval_policy === policy.id ? 'var(--mint-50)' : 'transparent',
                    borderColor: form.approval_policy === policy.id ? 'var(--mint-400)' : 'var(--hairline-strong)', transition: '.12s'
                  }}>
                    <input
                      type="radio"
                      name="approval_policy"
                      checked={form.approval_policy === policy.id}
                      onChange={() => updateField('approval_policy', policy.id)}
                      style={{ marginTop: 4 }}
                    />
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink-950)' }}>{policy.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-500)', marginTop: 2 }}>{policy.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 11: Content Plan Generation */}
          {step === 11 && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center w-full relative">
              {/* CSS Animations injected for the liquid morphing container */}
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes stepBreath {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.2); opacity: 0.65; }
                }
              `}} />

              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-ink-950 mb-3">Generating your first calendar</h2>
              <p className="text-ink-500 text-sm md:text-base max-w-md mx-auto mb-12 leading-relaxed">
                Our AI is currently crafting a tailored content strategy, applying your visual palette and configuring your festival preferences.
              </p>
              
              {/* Steps container */}
              <div className="flex flex-col gap-8 w-full max-w-sm mx-auto text-left relative">
                
                {/* Connecting line progress track */}
                <div className="absolute left-[15px] top-[16px] bottom-[16px] w-[2px] bg-ink-100 rounded-full overflow-hidden">
                  <div 
                    className="w-full bg-mint-500 transition-all duration-1000 ease-out" 
                    style={{ height: `${Math.min(generationPhase * 33.3, 100)}%` }}
                  />
                </div>

                {[
                  { title: 'Analyzing brand voice context', subtitle: 'Learning your unique tone' },
                  { title: 'Injecting regional occasion rules', subtitle: 'Setting up festival posts' },
                  { title: 'Structuring 7-day starter plan', subtitle: 'Drafting initial content' },
                  { title: 'Applying design templates', subtitle: 'Mapping colors & logos' },
                ].map((item, index) => {
                  const done = generationPhase > index
                  const active = generationPhase === index
                  const pending = generationPhase < index

                  return (
                    <div key={index} className="flex items-start gap-5 relative z-10">
                      {/* Step Icon Indicator */}
                      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 transition-all duration-500 ${done ? 'bg-mint-500 text-white shadow-md shadow-mint-500/20 scale-100' : active ? 'bg-white border-2 border-mint-500 text-mint-500 shadow-lg shadow-mint-500/30 scale-110' : 'bg-white border border-ink-200 text-ink-300 scale-100'}`}>
                        {done ? (
                          <Icon name="check" size={14} />
                        ) : active ? (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--mint-500)', animation: 'stepBreath 1.5s ease-in-out infinite' }} />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-ink-200" />
                        )}
                      </div>

                      {/* Step Text */}
                      <div className="flex flex-col">
                        <span className={`text-[15px] transition-colors duration-300 ${done ? 'text-ink-950 font-bold' : active ? 'text-mint-700 font-bold' : 'text-ink-400 font-medium'}`}>
                          {item.title}
                        </span>
                        {(done || active) && (
                          <span className={`text-xs mt-0.5 transition-all duration-300 ${done ? 'text-ink-500' : 'text-mint-600/80'}`}>
                            {done ? 'Complete' : item.subtitle + '...'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 12: First post preview approval */}
          {step === 12 && (
            <div className="stack" style={{ gap: 24 }}>
              <div>
                <h1 className="h-display h-1" style={{ margin: 0 }}>Review your first post</h1>
                <p className="muted" style={{ marginTop: 8 }}>Here is a draft generated specifically for your brand. Approve it to kickstart your calendar!</p>
              </div>

              <div className="card" style={{ padding: 0, border: '1px solid var(--hairline-strong)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid var(--hairline)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mint-500)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>
                    {form.business_name.charAt(0) || 'C'}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--ink-950)' }}>{form.business_name || 'My Brand'}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>Facebook Page · Scheduled</div>
                  </div>
                </div>
                
                <div style={{ padding: 14 }}>
                  <p style={{ margin: '0 0 14px 0', fontSize: 13, color: 'var(--ink-850)', lineHeight: 1.5 }}>
                    {sampleCopyPreview}
                  </p>
                  <div style={{ aspectRatio: '1.91', borderRadius: 8, background: form.palette[0] || 'var(--ink-950)', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 650, fontSize: 18, border: '1px solid var(--hairline)' }}>
                    {form.business_name || 'CREATYV Design'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn ghost" onClick={handleFinishOnboarding}>Skip post & Finish</button>
                <button className="btn primary" onClick={handleFinishOnboarding}>
                  <Icon name="check" size={13} /> Approve and schedule post
                </button>
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Stable Sticky Bottom Action Bar */}
        {step < 11 && (
          <div className="bg-[var(--paper-tint)] border-t border-[var(--hairline-strong)] py-4 px-6 sm:px-10 md:px-16 flex items-center justify-between shrink-0">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                className="btn ghost"
              >
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
              <button
                type="button"
                onClick={handleNextStep}
                className="btn primary"
              >
                Next <Icon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
