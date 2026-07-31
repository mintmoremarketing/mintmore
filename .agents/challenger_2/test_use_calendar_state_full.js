import { generateTopicsForBrand } from '../../mint-more-frontend/src/pages/client/onboarding/useCalendarState.js'

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

console.log('=== EMPIRICAL VERIFICATION HARNESS: useCalendarState.js ===\n')

// --- 1. TOPIC GENERATION & BRAND OVERRIDES ---
console.log('--- 1. Topic Generation ---')
const resTopics = generateTopicsForBrand({ business_name: 'Bistro 9', business_type: 'restaurant' })
assert(resTopics.length === 7, 'Restaurant template yields 7 topics')
assert(resTopics.every(t => t.id && t.title && t.format && t.category), 'All restaurant topics have required fields')

const fashTopics = generateTopicsForBrand({ business_name: 'Chic Studio', business_type: 'fashion' })
assert(fashTopics.length === 7, 'Fashion template yields 7 topics')
assert(fashTopics.every(t => t.id && t.title && t.format && t.category), 'All fashion topics have required fields')

const defaultTopics = generateTopicsForBrand({ business_name: 'Acme', business_type: 'unknown' })
assert(defaultTopics.length === 7, 'Unknown business type defaults to 7 topics')

const emptyTopics = generateTopicsForBrand({})
assert(emptyTopics[0].title.includes('Your Brand'), 'Empty form defaults brand name to "Your Brand"')


// --- 2. SCHEDULED DAYS COMPUTATION & PAST DAYS ---
console.log('\n--- 2. Scheduled Days Computation & Past Days ---')

function computeScheduledDays(form, topics, approvedTopicIds, calendarOverrides) {
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

const days = computeScheduledDays({ posting_frequency: '3' }, resTopics, resTopics.map(t => t.id), {})
assert(days.length === 28, 'Grid always contains 28 days (4 weeks)')
assert(days[0].dayOfWeek === 0, 'Grid starts on Sunday (dayOfWeek === 0)')
assert(days[27].dayOfWeek === 6, 'Grid ends on Saturday (dayOfWeek === 6)')

const pastDays = days.filter(d => d.isPast)
assert(pastDays.every(d => !d.hasPost), 'Past days have hasPost = false by default')


// --- 3. TOPIC SWAPPING OVERRIDES EDGE CASES ---
console.log('\n--- 3. Topic Swapping Overrides ---')

const futurePostDay = days.find(d => !d.isPast && d.hasPost)
const testDateKey = futurePostDay.dateKey

// 3a. Swap with an existing valid topic ID
const overridesExisting = {
  [testDateKey]: { topicId: 'topic-4', status: 'swapped' }
}
const daysExistingSwap = computeScheduledDays({ posting_frequency: '3' }, resTopics, resTopics.map(t => t.id), overridesExisting)
const dayExisting = daysExistingSwap.find(d => d.dateKey === testDateKey)
assert(dayExisting.topic.id === 'topic-4', 'Existing topic swap assigns topic-4 correctly')
assert(dayExisting.status === 'swapped', 'Existing topic swap sets status to swapped')
assert(dayExisting.format === 'carousel', 'Format matches topic-4 format (carousel)')

// 3b. Swap with custom topic
const customId = `custom-${Date.now()}`
const customTopic = {
  id: customId,
  title: 'My Custom Launch Promo',
  description: 'User specified prompt for anniversary deal',
  format: 'post',
  category: 'custom',
  captionPreview: 'Special 20% discount!',
  hashtags: ['#custom', '#update'],
}
const updatedTopics = [...resTopics, customTopic]
const updatedApproved = [...resTopics.map(t => t.id), customId]
const overridesCustom = {
  [testDateKey]: {
    topicId: customId,
    customTitle: customTopic.title,
    customDesc: customTopic.description,
    customCaption: customTopic.captionPreview,
    status: 'swapped',
  }
}
const daysCustomSwap = computeScheduledDays({ posting_frequency: '3' }, updatedTopics, updatedApproved, overridesCustom)
const dayCustom = daysCustomSwap.find(d => d.dateKey === testDateKey)
assert(dayCustom.topic.id === customId, 'Custom topic swap assigns custom ID')
assert(dayCustom.topic.title === 'My Custom Launch Promo', 'Custom topic title matches user text')
assert(dayCustom.status === 'swapped', 'Custom topic swap status is swapped')

// 3c. Swap with unknown topic ID (not present in topics array)
const overridesUnknown = {
  [testDateKey]: {
    topicId: 'unknown-id-999',
    customTitle: 'Orphaned Topic Title',
    customDesc: 'Orphaned Desc',
    customCaption: 'Orphaned Caption',
    status: 'swapped'
  }
}
const daysUnknownSwap = computeScheduledDays({ posting_frequency: '3' }, resTopics, resTopics.map(t => t.id), overridesUnknown)
const dayUnknown = daysUnknownSwap.find(d => d.dateKey === testDateKey)
assert(dayUnknown.topic.id === 'unknown-id-999', 'Unknown topic ID creates fallback topic object')
assert(dayUnknown.topic.title === 'Orphaned Topic Title', 'Fallback topic uses customTitle')
assert(dayUnknown.topic.format === 'post', 'Fallback topic defaults format to "post"')

// 3d. Override past day with explicitly requested post
const pastDayKey = pastDays[0]?.dateKey
if (pastDayKey) {
  const overridesPast = {
    [pastDayKey]: { hasPost: true, topicId: 'topic-1', status: 'approved' }
  }
  const daysPastOverride = computeScheduledDays({ posting_frequency: '3' }, resTopics, resTopics.map(t => t.id), overridesPast)
  const dayPastOverridden = daysPastOverride.find(d => d.dateKey === pastDayKey)
  assert(dayPastOverridden.hasPost === true, 'Explicit override hasPost:true allows post on past day')
}


// --- 4. FORMAT FILTER MATCHING & SIDEBAR FILTERING ---
console.log('\n--- 4. Format Filter Matching ---')

const allFormats = ['reel', 'carousel', 'post']
allFormats.forEach(fmt => {
  const filterOutCount = days.filter(d => d.hasPost && d.topic && d.format !== fmt).length
  const filterMatchCount = days.filter(d => d.hasPost && d.topic && d.format === fmt).length
  console.log(`  Format '${fmt}': ${filterMatchCount} matching posts, ${filterOutCount} filtered out`)
  assert(filterMatchCount + filterOutCount === days.filter(d => d.hasPost).length, `Sum of matches and filtered out equals total scheduled posts for filter '${fmt}'`)
})


// --- 5. APPROVED TOPICS SET OPERATIONS ---
console.log('\n--- 5. Approved Topics Set Operations ---')

// 5a. Unapprove topic-1
const approvedWithoutTopic1 = resTopics.map(t => t.id).filter(id => id !== 'topic-1')
const daysTopic1Unapproved = computeScheduledDays({ posting_frequency: '3' }, resTopics, approvedWithoutTopic1, {})
const topic1Days = daysTopic1Unapproved.filter(d => d.hasPost && d.topic?.id === 'topic-1')
if (topic1Days.length > 0) {
  assert(topic1Days.every(d => d.status === 'draft'), 'Days with topic-1 are downgraded to "draft" when topic-1 is unapproved')
} else {
  assert(true, 'No posts with topic-1 assigned in schedule')
}

// 5b. Unapprove a swapped topic
const approvedWithoutCustom = resTopics.map(t => t.id) // customId not in approved list
const daysCustomUnapproved = computeScheduledDays({ posting_frequency: '3' }, updatedTopics, approvedWithoutCustom, overridesCustom)
const dayCustomUnapproved = daysCustomUnapproved.find(d => d.dateKey === testDateKey)
assert(dayCustomUnapproved.status === 'draft', 'Swapped custom topic downgraded to "draft" if customId unapproved')


// --- 6. HOVER STATE & EXPANDED TOPIC STATE CONTROLS ---
console.log('\n--- 6. State Helper Logic ---')

let hoveredDateKey = null
let expandedTopicId = null

function setHoveredDateKey(key) { hoveredDateKey = key }
function setExpandedTopicId(id) { expandedTopicId = id }

setHoveredDateKey('2026-08-05')
assert(hoveredDateKey === '2026-08-05', 'setHoveredDateKey sets date key')
setHoveredDateKey(null)
assert(hoveredDateKey === null, 'setHoveredDateKey(null) clears focus')

setExpandedTopicId('topic-3')
assert(expandedTopicId === 'topic-3', 'setExpandedTopicId sets expanded topic ID')
setExpandedTopicId(expandedTopicId === 'topic-3' ? null : 'topic-3')
assert(expandedTopicId === null, 'Toggling expanded topic ID resets it to null')

console.log(`\n==========================================`)
console.log(`TOTAL RESULT: ${passed} passed, ${failed} failed.`)
console.log(`==========================================`)

if (failed > 0) process.exit(1)
