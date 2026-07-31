import { useState, useMemo, useCallback, useEffect } from 'react'

export function generateTopicsForBrand(form) {
  const brandName = (form?.business_name || '').trim() || 'Your Brand'
  const type = form?.business_type || 'restaurant'

  const topicTemplatesPerType = {
    restaurant: [
      {
        id: 'topic-1',
        title: `Behind the Scenes at ${brandName}`,
        description: 'Showcase daily prep, fresh ingredients, and kitchen passion.',
        format: 'reel',
        category: 'evergreen',
        captionPreview: `Ever wondered how we craft our signature dishes at ${brandName}? Here is an exclusive peek inside our kitchen! ✨ #behindthescenes #freshfood #foodie`,
        visualPrompt: 'Crisp fast-paced video montage showing morning prep and cooking.',
        hashtags: ['#behindthescenes', '#brandstory', '#freshfood'],
      },
      {
        id: 'topic-2',
        title: 'Customer Bestsellers & Top Picks',
        description: 'Highlighting top dishes with customer reviews.',
        format: 'carousel',
        category: 'promotional',
        captionPreview: `Here are the top picks our community loves at ${brandName}! Swipe to see the menu favorites. 👉 #bestsellers #topdish`,
        visualPrompt: 'Multi-slide gallery displaying bestsellers with ratings.',
        hashtags: ['#bestsellers', '#customerfavorite', '#foodies'],
      },
      {
        id: 'topic-3',
        title: 'Weekly Chef Special Showcase',
        description: 'Highlighting weekly offer, seasonal special, or signature drink.',
        format: 'post',
        category: 'promotional',
        captionPreview: `Special announcement from ${brandName}! Taste our limited-edition chef special available this week. 🌟 #chefspecial`,
        visualPrompt: 'Clean product highlight card in brand palette.',
        hashtags: ['#weeklyspecial', '#specialoffer', '#limitedtime'],
      },
      {
        id: 'topic-4',
        title: 'Foodie Tips & Recipe Pairing',
        description: 'Value-add tips on flavor pairings and dining tips.',
        format: 'carousel',
        category: 'engagement',
        captionPreview: `3 quick pairing tips for your next meal at ${brandName}! Save this post for later. 📌 What is your favorite combo?`,
        visualPrompt: 'Educational carousel cards with clean typography.',
        hashtags: ['#foodietips', '#pairings', '#diningtips'],
      },
      {
        id: 'topic-5',
        title: 'Festive Celebration & Warm Greetings',
        description: 'Seasonal greeting post for upcoming festive occasions.',
        format: 'reel',
        category: 'festival',
        captionPreview: `Warmest wishes on this festive occasion from all of us at ${brandName}! May your celebrations be filled with joy and great food. 🎉✨`,
        visualPrompt: 'Festive design layout featuring brand colors and warm lighting.',
        hashtags: ['#festivevibes', '#celebrations', '#festivalspecial'],
      },
      {
        id: 'topic-6',
        title: 'Community Q&A & Guest Spotlight',
        description: 'Answering common guest questions and spotlighting loyal diners.',
        format: 'post',
        category: 'engagement',
        captionPreview: `We love our diners! Here is the top question we get asked at ${brandName}, answered. 💬 Drop your questions below!`,
        visualPrompt: 'Q&A callout visual card with warm background gradient.',
        hashtags: ['#faq', '#communityspotlight', '#askus'],
      },
      {
        id: 'topic-7',
        title: 'Weekend Dining Special',
        description: 'High-energy call to action for weekend visits and takeaway.',
        format: 'reel',
        category: 'promotional',
        captionPreview: `Weekend plans sorted! Bring your family & friends to ${brandName} for an unforgettable dining experience. 🥳`,
        visualPrompt: 'High-energy reel preview with upbeat overlay text.',
        hashtags: ['#weekendvibes', '#weekendplans', '#visitus'],
      },
    ],
    fashion: [
      {
        id: 'topic-1',
        title: `Styling Guide by ${brandName}`,
        description: 'How to style our latest collection for day and night look.',
        format: 'reel',
        category: 'evergreen',
        captionPreview: `1 outfit, 2 styles! Watch how to transition your look effortlessly with pieces from ${brandName}. ✨ #stylingguide #ootd`,
        visualPrompt: 'Fast-paced transition video demonstrating outfit styles.',
        hashtags: ['#stylingguide', '#ootd', '#fashionhacks'],
      },
      {
        id: 'topic-2',
        title: 'New Season Lookbook Highlights',
        description: 'Carousel showcasing top trendy outfits from new arrivals.',
        format: 'carousel',
        category: 'promotional',
        captionPreview: `New collection has dropped at ${brandName}! Swipe to explore the lookbook. Which look is your pick? 👉`,
        visualPrompt: 'High-fashion aesthetic carousel layout featuring products.',
        hashtags: ['#lookbook', '#newarrivals', '#trendingfashion'],
      },
      {
        id: 'topic-3',
        title: 'Fabric & Fit Spotlight',
        description: 'Highlighting premium fabric quality, comfort, and tailoring.',
        format: 'post',
        category: 'promotional',
        captionPreview: `Quality you can feel! At ${brandName}, every piece is designed for maximum comfort and durability. 💫`,
        visualPrompt: 'Close-up fabric texture detail card in brand palette.',
        hashtags: ['#qualityfabric', '#sustainablefashion', '#detailsmatter'],
      },
      {
        id: 'topic-4',
        title: 'Wardrobe Essentials Checklist',
        description: 'Educational carousel on 5 must-have essentials.',
        format: 'carousel',
        category: 'engagement',
        captionPreview: `Build your capsule wardrobe with these timeless essentials from ${brandName}! Save this for your next shopping trip. 📌`,
        visualPrompt: 'Clean minimalist grid listing capsule wardrobe items.',
        hashtags: ['#capsulewardrobe', '#styleessentials', '#fashiontips'],
      },
      {
        id: 'topic-5',
        title: 'Festive Outfit & Glam Showcase',
        description: 'Special festive attire recommendations for upcoming celebrations.',
        format: 'reel',
        category: 'festival',
        captionPreview: `Shine bright this festive season in ${brandName}'s celebratory wear! Sparkle, comfort, and elegance combined. ✨🎉`,
        visualPrompt: 'Cinematic reel displaying festive outfits in movement.',
        hashtags: ['#festivefashion', '#festivewear', '#glamlook'],
      },
      {
        id: 'topic-6',
        title: 'Customer Style & Review Feature',
        description: 'User-generated content spotlight showing real customer photos.',
        format: 'post',
        category: 'engagement',
        captionPreview: `Spotted in ${brandName}! Tag us in your posts for a chance to be featured on our feed! 💖`,
        visualPrompt: 'Social grid collage card featuring happy customers.',
        hashtags: ['#customerstyle', '#realpeople', '#brandfamily'],
      },
      {
        id: 'topic-7',
        title: 'Weekend Shopping Event Announcement',
        description: 'Exclusive weekend deal notification and store visit CTA.',
        format: 'reel',
        category: 'promotional',
        captionPreview: `Weekend shopping spree alert! Visit ${brandName} this weekend to grab special offers. 🛍️`,
        visualPrompt: 'Vibrant promotional video preview with animated badge.',
        hashtags: ['#weekendshopping', '#salealert', '#shopnow'],
      },
    ],
  }

  const defaultTopics = [
    {
      id: 'topic-1',
      title: `Welcome to ${brandName}`,
      description: 'Introduction to brand mission, team, and core offerings.',
      format: 'reel',
      category: 'evergreen',
      captionPreview: `Welcome to ${brandName}! We are dedicated to providing the best experience for our community. Learn more about our story! ✨`,
      visualPrompt: 'Clean brand intro video montage showcasing services.',
      hashtags: ['#brandstory', '#welcome', '#localbusiness'],
    },
    {
      id: 'topic-2',
      title: 'Top Services & Core Offerings',
      description: 'Overview carousel highlighting signature offerings.',
      format: 'carousel',
      category: 'promotional',
      captionPreview: `Explore what makes ${brandName} unique! Swipe through our top services designed for you. 👉`,
      visualPrompt: 'Multi-slide feature comparison layout with brand palette.',
      hashtags: ['#services', '#topquality', '#customerfirst'],
    },
    {
      id: 'topic-3',
      title: 'Customer Spotlight & Testimonials',
      description: 'Highlighting real client feedback and success stories.',
      format: 'post',
      category: 'engagement',
      captionPreview: `Here is what our clients say about their experience with ${brandName}! Thank you for trusting us. 💬`,
      visualPrompt: 'Testimonial review card with 5-star rating graphic.',
      hashtags: ['#customerreviews', '#testimonials', '#clienttrust'],
    },
    {
      id: 'topic-4',
      title: 'Expert Advice & Insider Tips',
      description: 'Educational carousel providing action-oriented tips.',
      format: 'carousel',
      category: 'engagement',
      captionPreview: `3 insider tips from the experts at ${brandName}! Save this post to refer back anytime. 📌`,
      visualPrompt: 'Infographic carousel cards with bold header fonts.',
      hashtags: ['#experttips', '#valueadd', '#knowledge'],
    },
    {
      id: 'topic-5',
      title: 'Festive Season Special Announcement',
      description: 'Holiday greetings and special promotional offers.',
      format: 'reel',
      category: 'festival',
      captionPreview: `Warmest festive greetings from all of us at ${brandName}! Wishing you and your family happiness and prosperity. 🎉✨`,
      visualPrompt: 'Festive graphic layout featuring brand elements.',
      hashtags: ['#festivegreetings', '#celebration', '#holidayvibes'],
    },
    {
      id: 'topic-6',
      title: 'Behind the Scenes & Process',
      description: 'A peek into how team operates and maintains high standards.',
      format: 'post',
      category: 'evergreen',
      captionPreview: `Here is how we bring quality to life at ${brandName}. Dedication in every detail! 🛠️`,
      visualPrompt: 'Photo highlight card showing team at work.',
      hashtags: ['#behindthescenes', '#craftsmanship', '#dedicated'],
    },
    {
      id: 'topic-7',
      title: 'Weekend Offer & Quick Booking',
      description: 'Call-to-action for weekend inquiries and visits.',
      format: 'reel',
      category: 'promotional',
      captionPreview: `Planning your weekend? Connect with ${brandName} today and let us take care of the rest! 🚀`,
      visualPrompt: 'High-energy call to action visual video reel.',
      hashtags: ['#weekendoffer', '#connectwithus', '#booknow'],
    },
  ]

  return topicTemplatesPerType[type] || defaultTopics
}

export function useCalendarState(form, onboardingEvents = []) {
  const [topics, setTopics] = useState(() => generateTopicsForBrand(form))
  const [approvedTopicIds, setApprovedTopicIds] = useState(() => (topics || []).map(t => t.id))
  const [calendarOverrides, setCalendarOverrides] = useState({})
  const [hoveredDateKey, setHoveredDateKey] = useState(null)
  const [expandedTopicId, setExpandedTopicId] = useState(null)
  const [formatFilter, setFormatFilter] = useState('all') // 'all' | 'reel' | 'carousel' | 'post'
  const [swapModalState, setSwapModalState] = useState({ isOpen: false, targetDateKey: null })

  useEffect(() => {
    const generated = generateTopicsForBrand(form)
    setTopics(generated)
    setApprovedTopicIds((generated || []).map(t => t.id))
  }, [form?.business_name, form?.business_type])

  const scheduledDays = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(start.getDate() - start.getDay()) // Align to nearest Sunday

    const frequency = parseInt(form?.posting_frequency || '3', 10)
    const postDaysPattern = {
      1: [3],
      3: [1, 3, 5],
      5: [1, 2, 3, 4, 5],
      7: [0, 1, 2, 3, 4, 5, 6],
    }[frequency] || [1, 3, 5]

    const safeTopics = topics && topics.length > 0 ? topics : generateTopicsForBrand(form)

    const result = []
    let topicIndex = 0

    for (let i = 0; i < 28; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)

      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateKey = `${year}-${month}-${day}`

      const isPast = d < today
      const isToday = d.getTime() === today.getTime()
      const dayOfWeek = d.getDay()

      const override = calendarOverrides[dateKey]
      const defaultHasPost = !isPast && postDaysPattern.includes(dayOfWeek)
      const hasPost = override?.hasPost !== undefined ? override.hasPost : defaultHasPost

      let assignedTopic = null
      let assignedFormat = null
      let status = 'draft'

      if (hasPost) {
        if (override?.topicId) {
          assignedTopic = safeTopics.find(t => t.id === override.topicId) || {
            id: override.topicId,
            title: override.customTitle || 'Custom Topic',
            description: override.customDesc || 'Custom topic request',
            format: override.format || 'post',
            category: 'custom',
            captionPreview: override.customCaption || 'Custom topic content',
            festivalName: override.festivalName || null,
          }
        } else {
          assignedTopic = safeTopics[topicIndex % safeTopics.length]
        }
        topicIndex++
        assignedFormat = override?.format || assignedTopic?.format || 'post'
        const isApproved = assignedTopic ? (approvedTopicIds || []).includes(assignedTopic.id) : false
        if (override?.topicId) {
          status = isApproved ? (override.status || 'swapped') : 'draft'
        } else {
          status = isApproved ? (override?.status || 'approved') : 'draft'
        }
      }

      result.push({
        dateKey,
        date: d,
        dayNum: d.getDate(),
        dayOfWeek,
        isPast,
        isToday,
        hasPost,
        topic: assignedTopic,
        format: assignedFormat,
        status,
      })
    }

    return result
  }, [form?.posting_frequency, form?.business_name, form?.business_type, calendarOverrides, topics, approvedTopicIds])

  const handleSwapTopic = useCallback((dateKey, newTopicId, customData = null) => {
    if (customData) {
      const customId = `custom-${Date.now()}`
      const newTopic = {
        id: customId,
        title: customData.title || customData.text || 'Custom Request',
        description: customData.description || customData.text || 'User defined custom topic request',
        format: customData.format || 'post',
        category: customData.category || 'custom',
        captionPreview: customData.captionPreview || customData.text || '',
        hashtags: customData.hashtags || ['#custom', '#update'],
        festivalName: customData.festivalName || null,
        visualPrompt: customData.visualPrompt || null,
      }
      setTopics(prev => [...(prev || []), newTopic])
      setApprovedTopicIds(prev => [...(prev || []), customId])
      setCalendarOverrides(prev => ({
        ...prev,
        [dateKey]: {
          ...prev[dateKey],
          topicId: customId,
          customTitle: newTopic.title,
          customDesc: newTopic.description,
          customCaption: newTopic.captionPreview,
          festivalName: newTopic.festivalName,
          status: 'swapped',
        },
      }))
    } else {
      setCalendarOverrides(prev => ({
        ...prev,
        [dateKey]: {
          ...prev[dateKey],
          topicId: newTopicId,
          status: 'swapped',
        },
      }))
    }
    setSwapModalState({ isOpen: false, targetDateKey: null })
  }, [])

  const toggleTopicApproval = useCallback((topicId) => {
    setApprovedTopicIds(prev =>
      (prev || []).includes(topicId) ? prev.filter(id => id !== topicId) : [...(prev || []), topicId]
    )
  }, [])

  const openSwapModal = useCallback((dateKey) => {
    setSwapModalState({ isOpen: true, targetDateKey: dateKey })
  }, [])

  const closeSwapModal = useCallback(() => {
    setSwapModalState({ isOpen: false, targetDateKey: null })
  }, [])

  const handleOptOutFestival = useCallback((dateKey) => {
    const currentScheduledTopicIds = new Set(
      scheduledDays.filter(d => d.hasPost && d.topic?.id && d.dateKey !== dateKey).map(d => d.topic.id)
    )
    let replacementTopic = (topics || []).find(t => t.category !== 'festival' && !currentScheduledTopicIds.has(t.id))
    if (!replacementTopic) {
      const brandName = (form?.business_name || '').trim() || 'Your Brand'
      const customId = `brand-replacement-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      replacementTopic = {
        id: customId,
        title: `${brandName} Core Feature Showcase`,
        description: `Standard brand focus post highlighting quality products and services.`,
        format: 'post',
        category: 'evergreen',
        captionPreview: `Discover what makes ${brandName} stand out! Highlighting our core values and top offerings. ✨`,
        visualPrompt: `Clean product showcase image in brand colors.`,
        hashtags: ['#brandfeature', '#qualityservice', '#localbusiness'],
      }
      setTopics(prev => [...(prev || []), replacementTopic])
    }

    setCalendarOverrides(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        hasPost: true,
        topicId: replacementTopic.id,
        customTitle: replacementTopic.title,
        customDesc: replacementTopic.description,
        customCaption: replacementTopic.captionPreview || replacementTopic.caption,
        isFestivalOptOut: true,
        status: 'swapped',
      },
    }))
  }, [scheduledDays, topics, form?.business_name])

  return {
    topics,
    setTopics,
    approvedTopicIds,
    setApprovedTopicIds,
    scheduledDays,
    calendarOverrides,
    hoveredDateKey,
    expandedTopicId,
    formatFilter,
    swapModalState,
    setHoveredDateKey,
    setExpandedTopicId,
    setFormatFilter,
    handleSwapTopic,
    toggleTopicApproval,
    openSwapModal,
    closeSwapModal,
    handleOptOutFestival,
  }
}

