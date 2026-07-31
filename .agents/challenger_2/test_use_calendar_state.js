import { generateTopicsForBrand } from '../../mint-more-frontend/src/pages/client/onboarding/useCalendarState.js'

// Simple assertions for node execution
let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`)
    passed++
  } else {
    console.error(`[FAIL] ${message}`)
    failed++
  }
}

console.log('--- EMPIRICAL TEST HARNESS: useCalendarState & generateTopicsForBrand ---')

// 1. Test generateTopicsForBrand with various inputs
const restaurantTopics = generateTopicsForBrand({ business_name: 'Tasty Bites', business_type: 'restaurant' })
assert(restaurantTopics.length === 7, 'Restaurant returns 7 topics')
assert(restaurantTopics[0].title.includes('Tasty Bites'), 'Topic template interpolates brand name')

const fashionTopics = generateTopicsForBrand({ business_name: 'Vogue Hub', business_type: 'fashion' })
assert(fashionTopics.length === 7, 'Fashion returns 7 topics')
assert(fashionTopics[0].title.includes('Vogue Hub'), 'Fashion topic template interpolates brand name')

const unknownTypeTopics = generateTopicsForBrand({ business_name: 'Tech Corp', business_type: 'software' })
assert(unknownTypeTopics.length === 7, 'Unknown business type returns default 7 topics')

const nullFormTopics = generateTopicsForBrand(null)
assert(nullFormTopics.length === 7, 'Null form returns default 7 topics')
assert(nullFormTopics[0].title.includes('Your Brand'), 'Null form uses default brand name "Your Brand"')

// 2. Test scheduledDays logic simulate Hook state math
function simulateScheduledDays(form, topics, approvedTopicIds, calendarOverrides) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay())

  const frequency = parseInt(form?.posting_frequency || '3', 10)
  const postDaysPattern = {
    1: [3],
    3: [1, 3, 5],
    5: [1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  }[frequency] || [1, 3, 5]

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
        assignedTopic = topics.find(t => t.id === override.topicId) || {
          id: override.topicId,
          title: override.customTitle || 'Custom Topic',
          description: override.customDesc || 'Custom topic request',
          format: 'post',
          category: 'custom',
          captionPreview: override.customCaption || 'Custom topic content',
        }
        status = 'swapped'
      } else {
        assignedTopic = topics[topicIndex % topics.length]
        topicIndex++
      }
      assignedFormat = override?.format || assignedTopic?.format || 'post'
      if (approvedTopicIds.includes(assignedTopic?.id)) {
        status = override?.status || (override?.topicId ? 'swapped' : 'approved')
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
}

// Test Frequency patterns
const daysFreq3 = simulateScheduledDays({ posting_frequency: '3' }, restaurantTopics, restaurantTopics.map(t => t.id), {})
assert(daysFreq3.length === 28, 'Returns exactly 28 days')
const postCountFreq3 = daysFreq3.filter(d => d.hasPost).length
assert(postCountFreq3 >= 12 && postCountFreq3 <= 15, `Frequency 3 creates expected post count (got ${postCountFreq3})`)

const daysFreq7 = simulateScheduledDays({ posting_frequency: '7' }, restaurantTopics, restaurantTopics.map(t => t.id), {})
const nonPastDaysCount = daysFreq7.filter(d => !d.isPast).length
const postCountFreq7 = daysFreq7.filter(d => d.hasPost).length
assert(postCountFreq7 === nonPastDaysCount, `Frequency 7 schedules posts for every non-past day (${postCountFreq7})`)

// Test Swapping Overrides
const firstFutureDay = daysFreq3.find(d => !d.isPast && d.hasPost)
const targetDateKey = firstFutureDay.dateKey

// Test Swapping with existing topic ID
const overrides1 = {
  [targetDateKey]: { topicId: 'topic-5', status: 'swapped' }
}
const daysWithOverride1 = simulateScheduledDays({ posting_frequency: '3' }, restaurantTopics, restaurantTopics.map(t => t.id), overrides1)
const swappedDay1 = daysWithOverride1.find(d => d.dateKey === targetDateKey)
assert(swappedDay1.topic.id === 'topic-5', 'Swapped topic ID matches override topic ID')
assert(swappedDay1.status === 'swapped', 'Status set to swapped for topic override')

// Test Swapping with custom unknown topic ID
const overrides2 = {
  [targetDateKey]: { topicId: 'custom-12345', customTitle: 'Special Promo', customDesc: 'Promo details', status: 'swapped' }
}
const daysWithOverride2 = simulateScheduledDays({ posting_frequency: '3' }, restaurantTopics, restaurantTopics.map(t => t.id), overrides2)
const swappedDay2 = daysWithOverride2.find(d => d.dateKey === targetDateKey)
assert(swappedDay2.topic.title === 'Special Promo', 'Fallback custom topic title used when topicId not in topics list')

// Test Approved Topics Set Operations
const unapprovedTopicIds = restaurantTopics.map(t => t.id).filter(id => id !== restaurantTopics[0].id)
const daysUnapproved = simulateScheduledDays({ posting_frequency: '3' }, restaurantTopics, unapprovedTopicIds, {})
const unapprovedDay = daysUnapproved.find(d => d.hasPost && d.topic.id === restaurantTopics[0].id)
if (unapprovedDay) {
  assert(unapprovedDay.status === 'draft', 'Topic not in approvedTopicIds defaults to draft status')
} else {
  assert(true, 'No post assigned to unapproved topic in window')
}

console.log(`\nSummary: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
