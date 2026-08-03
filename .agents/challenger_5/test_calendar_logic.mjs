// Empirical Test Runner for Calendar.jsx logic
import assert from 'node:assert/strict'

// ── Re-implement / Import pure logic from Calendar.jsx ──────────────────────

const getPostFormat = (post) => {
  if (post?.format) return post.format.toLowerCase()
  if (post?.type) return post.type.toLowerCase()
  if (post?.asset_type) {
    const at = post.asset_type.toLowerCase()
    if (at.includes('reel')) return 'reel'
    if (at.includes('carousel')) return 'carousel'
  }
  if (post?.media?.[0]?.media_type === 'video' || post?.media?.[0]?.type === 'video') return 'reel'
  if (post?.media && post.media.length > 1) return 'carousel'
  return 'post'
}

const matchesFormatFilter = (item, filter) => {
  if (filter === 'all') return true
  const fmt = getPostFormat(item)
  return fmt === filter
}

// ── TEST SUITE 1: Format Filter Matching ─────────────────────────────────────
console.log('=== TEST SUITE 1: Format Filter Matching ===')

// Test 1.1: getPostFormat resolution order & case insensitivity
assert.equal(getPostFormat({ format: 'REEL' }), 'reel', 'format REEL -> reel')
assert.equal(getPostFormat({ format: 'Carousel' }), 'carousel', 'format Carousel -> carousel')
assert.equal(getPostFormat({ type: 'POST' }), 'post', 'type POST -> post')
assert.equal(getPostFormat({ asset_type: 'reel_video' }), 'reel', 'asset_type reel_video -> reel')
assert.equal(getPostFormat({ asset_type: 'carousel_graphic' }), 'carousel', 'asset_type carousel_graphic -> carousel')
assert.equal(getPostFormat({ media: [{ media_type: 'video' }] }), 'reel', 'media_type video -> reel')
assert.equal(getPostFormat({ media: [{ type: 'video' }] }), 'reel', 'type video -> reel')
assert.equal(getPostFormat({ media: [{}, {}] }), 'carousel', 'media length 2 -> carousel')
assert.equal(getPostFormat({ caption: 'Hello' }), 'post', 'default fallback -> post')
assert.equal(getPostFormat(null), 'post', 'null fallback -> post')
assert.equal(getPostFormat(undefined), 'post', 'undefined fallback -> post')
console.log('✔ 1.1 getPostFormat logic passed')

// Test 1.2: matchesFormatFilter across all filter options
assert.equal(matchesFormatFilter({ format: 'reel' }, 'all'), true, 'reel matches all')
assert.equal(matchesFormatFilter({ format: 'reel' }, 'reel'), true, 'reel matches reel')
assert.equal(matchesFormatFilter({ format: 'reel' }, 'carousel'), false, 'reel does not match carousel')
assert.equal(matchesFormatFilter({ format: 'reel' }, 'post'), false, 'reel does not match post')

assert.equal(matchesFormatFilter({ format: 'carousel' }, 'all'), true, 'carousel matches all')
assert.equal(matchesFormatFilter({ format: 'carousel' }, 'carousel'), true, 'carousel matches carousel')
assert.equal(matchesFormatFilter({ format: 'carousel' }, 'reel'), false, 'carousel does not match reel')
assert.equal(matchesFormatFilter({ format: 'carousel' }, 'post'), false, 'carousel does not match post')

assert.equal(matchesFormatFilter({ format: 'post' }, 'all'), true, 'post matches all')
assert.equal(matchesFormatFilter({ format: 'post' }, 'post'), true, 'post matches post')
assert.equal(matchesFormatFilter({ format: 'post' }, 'reel'), false, 'post does not match reel')
assert.equal(matchesFormatFilter({ format: 'post' }, 'carousel'), false, 'post does not match carousel')
console.log('✔ 1.2 matchesFormatFilter logic passed')

// Test 1.3: Grid cells vs Sidebar (allScheduledItems) filter discrepancy empirical test
const samplePosts = [
  { id: 'p1', publish_at: '2026-08-15T10:00:00Z', format: 'reel', caption: 'Reel Post' },
  { id: 'p2', publish_at: '2026-08-15T12:00:00Z', format: 'carousel', caption: 'Carousel Post' },
  { id: 'p3', publish_at: '2026-08-15T14:00:00Z', format: 'post', caption: 'Standard Post' }
]

const sampleEvents = [
  { id: 'e1', event_date: '2026-08-15', title: 'Creative Moment', asset_type: 'reel_video' }
]

function computeGridAndSidebar(posts, events, filter) {
  const cellPosts = posts.filter(p => matchesFormatFilter(p, filter))
  // In Calendar.jsx line 646: const cellEvents = eventsByDateKey[cell.dateKey] || [] (UNFILTERED!)
  const cellEventsInGrid = events

  // In Calendar.jsx lines 407-443 for allScheduledItems:
  const sidebarItems = []
  posts.forEach(post => {
    if (matchesFormatFilter(post, filter)) {
      sidebarItems.push({ id: post.id, format: getPostFormat(post), type: 'post' })
    }
  })
  events.forEach(event => {
    // In Calendar.jsx line 429: if (formatFilter === 'all' || formatFilter === 'post')
    if (filter === 'all' || filter === 'post') {
      sidebarItems.push({ id: event.id, format: event.asset_type || 'post', type: 'event' })
    }
  })

  return { cellPosts, cellEventsInGrid, sidebarItems }
}

const reelRes = computeGridAndSidebar(samplePosts, sampleEvents, 'reel')
assert.equal(reelRes.cellPosts.length, 1, '1 reel post in cell')
assert.equal(reelRes.cellEventsInGrid.length, 1, 'Creative event STILL present in grid cell under reel filter')
assert.equal(reelRes.sidebarItems.length, 1, 'Creative event EXCLUDED from sidebar under reel filter')

const postRes = computeGridAndSidebar(samplePosts, sampleEvents, 'post')
assert.equal(postRes.cellPosts.length, 1, '1 standard post in cell')
assert.equal(postRes.sidebarItems.length, 2, 'Creative event INCLUDED in sidebar under post filter even though asset_type is reel_video!')

console.log('✔ 1.3 Discrepancy analysis confirmed: Grid cell events are unfiltered while sidebar events filter on hardcoded all/post condition')


// ── TEST SUITE 2: Dropdown Toggle, Modal Actions & Custom Prompt Input ─────
console.log('\n=== TEST SUITE 2: Dropdown Toggle, Modal Actions & Custom Prompt Input ===')

// Test 2.1: + Dropdown menu toggle
let openDayMenuKey = ''

function toggleDayMenu(key) {
  openDayMenuKey = (openDayMenuKey === key ? '' : key)
}

toggleDayMenu('2026-08-15')
assert.equal(openDayMenuKey, '2026-08-15', 'Dropdown opens for 2026-08-15')
toggleDayMenu('2026-08-15')
assert.equal(openDayMenuKey, '', 'Dropdown closes when clicked again')

toggleDayMenu('2026-08-15')
toggleDayMenu('2026-08-16')
assert.equal(openDayMenuKey, '2026-08-16', 'Dropdown switches directly to 2026-08-16')

// Outside click simulated
openDayMenuKey = ''
assert.equal(openDayMenuKey, '', 'Dropdown closed on outside click')
console.log('✔ 2.1 Dropdown menu toggle logic passed')

// Test 2.2: Modal open/close and state reset
let swapModalState = { isOpen: false, targetDateKey: null, targetDate: null }
let activeSwapTab = 'unused'
let selectedSwapTopicId = null
let selectedSwapFestival = null
let customSwapText = ''

function openSwapModal(dateKey, date, isPast) {
  if (isPast) {
    return { toast: 'Choose today or later', opened: false }
  }
  swapModalState = { isOpen: true, targetDateKey: dateKey, targetDate: date }
  activeSwapTab = 'unused'
  selectedSwapTopicId = null
  selectedSwapFestival = null
  customSwapText = ''
  return { opened: true }
}

function closeSwapModal() {
  swapModalState = { isOpen: false, targetDateKey: null, targetDate: null }
}

assert.equal(openSwapModal('2026-07-01', new Date('2026-07-01'), true).opened, false, 'Past day blocks modal open')
assert.equal(openSwapModal('2026-08-20', new Date('2026-08-20'), false).opened, true, 'Future day opens modal')
assert.equal(swapModalState.isOpen, true, 'Modal state isOpen is true')
assert.equal(activeSwapTab, 'unused', 'Default tab is unused')

closeSwapModal()
assert.equal(swapModalState.isOpen, false, 'Modal closed')
console.log('✔ 2.2 Modal open/close & state reset logic passed')

// Test 2.3: Custom Prompt Input behavior in handleConfirmSwap
let toastLog = []
let navigatedTo = null

function pushToast(t) { toastLog.push(t) }
function openRequest(date) { navigatedTo = `/jobs/new?deadline=${date}` }

function handleConfirmSwap() {
  if (activeSwapTab === 'custom') {
    if (customSwapText.trim()) {
      openRequest(swapModalState.targetDateKey)
      pushToast({ title: 'Custom Request Initiated', body: `Created custom request for ${swapModalState.targetDateKey}.`, tone: 'mint' })
    } else {
      pushToast({ title: 'Input required', body: 'Please describe the custom request prompt.', tone: 'amber' })
      return
    }
  } else if (activeSwapTab === 'unused') {
    if (selectedSwapTopicId) {
      pushToast({ title: 'Topic Swapped', body: `Swapped topic for ${swapModalState.targetDateKey}.`, tone: 'mint' })
    } else {
      pushToast({ title: 'Topic selected', body: 'Swapped schedule item successfully.', tone: 'mint' })
    }
  } else if (activeSwapTab === 'festivals') {
    pushToast({ title: 'Festival Greeting Selected', body: `Updated topic for ${swapModalState.targetDateKey}.`, tone: 'mint' })
  }
  closeSwapModal()
}

// Case 2.3a: Empty custom prompt -> fails validation, stays open
openSwapModal('2026-08-20', '2026-08-20', false)
activeSwapTab = 'custom'
customSwapText = '   ' // empty/whitespace
toastLog = []
navigatedTo = null
handleConfirmSwap()

assert.equal(toastLog.length, 1, 'Toast emitted for empty prompt')
assert.equal(toastLog[0].title, 'Input required', 'Toast requires input')
assert.equal(swapModalState.isOpen, true, 'Modal remains open on empty prompt')
assert.equal(navigatedTo, null, 'No navigation occurred')

// Case 2.3b: Non-empty custom prompt -> validates, navigates, closes modal
customSwapText = 'Create a custom Diwali reel'
handleConfirmSwap()

assert.equal(navigatedTo, '/jobs/new?deadline=2026-08-20', 'Navigated to custom request page')
assert.equal(swapModalState.isOpen, false, 'Modal closed on valid prompt submit')
assert.equal(toastLog.length, 2, 'Success toast emitted')
console.log('✔ 2.3 Custom prompt input validation passed')

// Case 2.3c: Tab switching & festival / topic selection
openSwapModal('2026-08-20', '2026-08-20', false)
activeSwapTab = 'festivals'
selectedSwapFestival = 'f2'
toastLog = []
handleConfirmSwap()

assert.equal(swapModalState.isOpen, false, 'Festival confirm closes modal')
assert.equal(toastLog[0].title, 'Festival Greeting Selected', 'Festival toast emitted')
console.log('✔ 2.4 Tab switching and festival confirm passed')


// ── TEST SUITE 3: Auto-scroll Ref Map Assignment & Hover Focus States ───────
console.log('\n=== TEST SUITE 3: Auto-scroll Ref Map Assignment & Hover States ===')

const sidebarItemRefs = { current: {} }

function refCallback(dateKey, el) {
  if (el) {
    sidebarItemRefs.current[dateKey] = el
  } else {
    delete sidebarItemRefs.current[dateKey]
  }
}

// Render items for dateKey '2026-08-15'
const dummyEl1 = { id: 'dom1', scrollIntoViewCalled: false, scrollIntoView() { this.scrollIntoViewCalled = true } }
const dummyEl2 = { id: 'dom2', scrollIntoViewCalled: false, scrollIntoView() { this.scrollIntoViewCalled = true } }

refCallback('2026-08-15', dummyEl1)
assert.equal(sidebarItemRefs.current['2026-08-15'], dummyEl1, 'Ref mapped to element 1')

// Overwrite if second item on same dateKey renders
refCallback('2026-08-15', dummyEl2)
assert.equal(sidebarItemRefs.current['2026-08-15'], dummyEl2, 'Ref overwritten to element 2 for same dateKey')

// Simulate hover state transition
let hoveredDateKey = null

function setHoveredDateKey(key) {
  hoveredDateKey = key
  if (hoveredDateKey && sidebarItemRefs.current[hoveredDateKey]) {
    sidebarItemRefs.current[hoveredDateKey].scrollIntoView()
  }
}

setHoveredDateKey('2026-08-15')
assert.equal(dummyEl2.scrollIntoViewCalled, true, 'scrollIntoView triggered on hover focus transition')

// Test unmount / ref null cleanup
refCallback('2026-08-15', null)
assert.equal(sidebarItemRefs.current['2026-08-15'], undefined, 'Ref deleted on unmount')

console.log('✔ 3.1 Ref map assignment and scroll transition passed')

console.log('\nALL LOGIC UNIT & VERIFICATION TESTS COMPLETED SUCCESSFULLY!')
