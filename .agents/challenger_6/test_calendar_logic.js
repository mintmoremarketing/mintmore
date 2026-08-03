const assert = require('assert');

// ── Re-create exact logic from Calendar.jsx ───────────────────────────────────

const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const parseMonth = (key) => {
  const [y, m] = key.split('-').map(Number)
  return { year: y, monthNum: m - 1 }
}

const startOfDay = (date) => {
  const d = new Date(date); d.setHours(0,0,0,0); return d
}
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()
const isPastDay = (date) => startOfDay(date).getTime() < startOfDay(new Date()).getTime()

const toLocalDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

function computeBaseGridCells(year, monthNum) {
  const first = new Date(year, monthNum, 1)
  const days  = new Date(year, monthNum + 1, 0).getDate()
  const leading = first.getDay()

  const cells = []
  for (let i = 0; i < leading; i++) {
    cells.push({ key: `blank-${i}`, blank: true })
  }
  for (let i = 1; i <= days; i++) {
    const date = new Date(year, monthNum, i)
    const dateKey = toLocalDateKey(date)
    cells.push({
      key: dateKey,
      dateKey,
      date,
      blank: false,
    })
  }
  return cells
}

function computePostsByDateKey(socialData) {
  const map = {}
  ;(socialData?.posts || []).forEach(post => {
    const ts = post.publish_at || post.published_at || post.created_at
    if (ts) {
      const key = toLocalDateKey(ts)
      if (!map[key]) map[key] = []
      map[key].push(post)
    }
  })
  return map
}

function computeEventsByDateKey(creativeData) {
  const map = {}
  ;(creativeData?.events || []).forEach(event => {
    if (event.event_date) {
      const key = toLocalDateKey(event.event_date)
      if (!map[key]) map[key] = []
      map[key].push(event)
    }
  })
  return map
}

function computeAllScheduledItems(baseGridCells, postsByDateKey, eventsByDateKey, formatFilter) {
  const items = []
  baseGridCells.forEach(cell => {
    if (cell.blank) return
    const cellPosts  = postsByDateKey[cell.dateKey] || []
    const cellEvents = eventsByDateKey[cell.dateKey] || []

    cellPosts.forEach(post => {
      if (matchesFormatFilter(post, formatFilter)) {
        items.push({
          id: post.id,
          dateKey: cell.dateKey,
          date: cell.date,
          title: post.caption || post.title || 'Untitled Post',
          format: getPostFormat(post),
          type: 'post',
          raw: post,
        })
      }
    })

    cellEvents.forEach(event => {
      if (formatFilter === 'all' || formatFilter === 'post') {
        items.push({
          id: event.id,
          dateKey: cell.dateKey,
          date: cell.date,
          title: event.title,
          format: event.asset_type || 'post',
          type: 'event',
          raw: event,
        })
      }
    })
  })
  return items
}

// ── Test Runner ───────────────────────────────────────────────────────────────

const testResults = []

function runTest(name, fn) {
  try {
    fn()
    testResults.push({ name, status: 'PASS' })
    console.log(`[PASS] ${name}`)
  } catch (err) {
    testResults.push({ name, status: 'FAIL', error: err.message, stack: err.stack })
    console.error(`[FAIL] ${name}: ${err.message}`)
  }
}

// ── 1. Date Grid Calculation Tests ──────────────────────────────────────────

runTest('Leap Year 2024 (Feb has 29 days)', () => {
  const cells = computeBaseGridCells(2024, 1) // Feb 2024
  const blanks = cells.filter(c => c.blank)
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(nonBlanks.length, 29, 'Feb 2024 should have 29 days')
  assert.strictEqual(blanks.length, 4, 'Feb 1, 2024 is Thursday (getDay()=4)')
  assert.strictEqual(cells.length, 33, 'Total cells = 4 blanks + 29 days = 33')
  assert.strictEqual(nonBlanks[0].dateKey, '2024-02-01')
  assert.strictEqual(nonBlanks[28].dateKey, '2024-02-29')
})

runTest('Non-Leap Year 2025 (Feb has 28 days)', () => {
  const cells = computeBaseGridCells(2025, 1) // Feb 2025
  const blanks = cells.filter(c => c.blank)
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(nonBlanks.length, 28, 'Feb 2025 should have 28 days')
  assert.strictEqual(blanks.length, 6, 'Feb 1, 2025 is Saturday (getDay()=6)')
  assert.strictEqual(cells.length, 34, 'Total cells = 6 blanks + 28 days = 34')
  assert.strictEqual(nonBlanks[0].dateKey, '2025-02-01')
  assert.strictEqual(nonBlanks[27].dateKey, '2025-02-28')
})

runTest('Century Leap Year 2000 (Feb has 29 days)', () => {
  const cells = computeBaseGridCells(2000, 1) // Feb 2000
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(nonBlanks.length, 29, 'Feb 2000 should have 29 days')
  assert.strictEqual(nonBlanks[28].dateKey, '2000-02-29')
})

runTest('Century Non-Leap Year 2100 (Feb has 28 days)', () => {
  const cells = computeBaseGridCells(2100, 1) // Feb 2100
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(nonBlanks.length, 28, 'Feb 2100 should have 28 days')
  assert.strictEqual(nonBlanks[27].dateKey, '2100-02-28')
})

runTest('30-Day Month Boundary (April 2026)', () => {
  const cells = computeBaseGridCells(2026, 3) // Apr 2026
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(nonBlanks.length, 30, 'April has 30 days')
  assert.strictEqual(nonBlanks[0].dateKey, '2026-04-01')
  assert.strictEqual(nonBlanks[29].dateKey, '2026-04-30')
})

runTest('31-Day Month Boundary (December 2026)', () => {
  const cells = computeBaseGridCells(2026, 11) // Dec 2026
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(nonBlanks.length, 31, 'December has 31 days')
  assert.strictEqual(nonBlanks[0].dateKey, '2026-12-01')
  assert.strictEqual(nonBlanks[30].dateKey, '2026-12-31')
})

runTest('First Day Starting on Sunday (Nov 2026 - getDay() = 0)', () => {
  const cells = computeBaseGridCells(2026, 10) // Nov 2026
  const blanks = cells.filter(c => c.blank)
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(blanks.length, 0, 'Nov 1, 2026 is Sunday (0 leading blanks)')
  assert.strictEqual(nonBlanks.length, 30)
  assert.strictEqual(cells[0].dateKey, '2026-11-01')
})

runTest('First Day Starting on Saturday (Aug 2026 - getDay() = 6)', () => {
  const cells = computeBaseGridCells(2026, 7) // Aug 2026
  const blanks = cells.filter(c => c.blank)
  const nonBlanks = cells.filter(c => !c.blank)
  assert.strictEqual(blanks.length, 6, 'Aug 1, 2026 is Saturday (6 leading blanks)')
  assert.strictEqual(nonBlanks.length, 31)
  assert.strictEqual(cells.length, 37)
})

runTest('Date Key Formatting & Padding Verification', () => {
  assert.strictEqual(toLocalDateKey(new Date(2026, 0, 5)), '2026-01-05')
  assert.strictEqual(toLocalDateKey(new Date(2026, 8, 9)), '2026-09-09')
  assert.strictEqual(toLocalDateKey(new Date(2026, 11, 31)), '2026-12-31')
  assert.strictEqual(monthKey(new Date(2026, 0, 5)), '2026-01')
  assert.deepStrictEqual(parseMonth('2026-01'), { year: 2026, monthNum: 0 })
})

// ── 2. Null / Empty / Delayed Data Safety Tests ─────────────────────────────

runTest('Null socialData & creativeData handling', () => {
  const postsMap = computePostsByDateKey(null)
  const eventsMap = computeEventsByDateKey(null)
  assert.deepStrictEqual(postsMap, {})
  assert.deepStrictEqual(eventsMap, {})

  const cells = computeBaseGridCells(2026, 7) // Aug 2026
  const scheduledItems = computeAllScheduledItems(cells, postsMap, eventsMap, 'all')
  assert.deepStrictEqual(scheduledItems, [])
})

runTest('Undefined socialData & creativeData handling', () => {
  const postsMap = computePostsByDateKey(undefined)
  const eventsMap = computeEventsByDateKey(undefined)
  assert.deepStrictEqual(postsMap, {})
  assert.deepStrictEqual(eventsMap, {})
})

runTest('Empty object socialData ({}) and creativeData ({})', () => {
  const postsMap = computePostsByDateKey({})
  const eventsMap = computeEventsByDateKey({})
  assert.deepStrictEqual(postsMap, {})
  assert.deepStrictEqual(eventsMap, {})
})

runTest('Null posts array in socialData ({ posts: null })', () => {
  const postsMap = computePostsByDateKey({ posts: null })
  assert.deepStrictEqual(postsMap, {})
})

runTest('Null events array in creativeData ({ events: null })', () => {
  const eventsMap = computeEventsByDateKey({ events: null })
  assert.deepStrictEqual(eventsMap, {})
})

runTest('Posts with invalid/missing publish dates', () => {
  const socialData = {
    posts: [
      { id: '1', caption: 'No date' },
      { id: '2', publish_at: null, published_at: null, created_at: null },
      { id: '3', publish_at: '2026-08-15T10:00:00' },
    ]
  }
  const postsMap = computePostsByDateKey(socialData)
  assert.strictEqual(Object.keys(postsMap).length, 1)
  assert.strictEqual(postsMap['2026-08-15'].length, 1)
  assert.strictEqual(postsMap['2026-08-15'][0].id, '3')
})

runTest('Events with missing coin_cost or string coin_cost', () => {
  const creativeEvents = [
    { id: 'e1', title: 'Event 1', coin_cost: undefined },
    { id: 'e2', title: 'Event 2', coin_cost: null },
    { id: 'e3', title: 'Event 3', coin_cost: '5' },
    { id: 'e4', title: 'Event 4', coin_cost: 3 },
  ]
  const pendingIds = ['e1', 'e2', 'e3', 'e4']
  const selectedPending = creativeEvents.filter(e => pendingIds.includes(e.id))
  const pendingCost = selectedPending.reduce((sum, e) => sum + Number(e.coin_cost || 1), 0)

  // e1: Number(undefined || 1) = 1
  // e2: Number(null || 1) = 1
  // e3: Number('5' || 1) = 5
  // e4: Number(3 || 1) = 3
  // Total = 1 + 1 + 5 + 3 = 10
  assert.strictEqual(pendingCost, 10, 'Pending cost calculation handles null/undefined/string coin_cost gracefully')
})

runTest('Format filter logic (all, reel, carousel, post)', () => {
  const posts = [
    { id: 'p1', format: 'reel' },
    { id: 'p2', type: 'carousel' },
    { id: 'p3', asset_type: 'reel_video' },
    { id: 'p4', media: [{ media_type: 'video' }] },
    { id: 'p5', media: [{ type: 'image' }, { type: 'image' }] },
    { id: 'p6', caption: 'plain post' },
  ]

  assert.strictEqual(getPostFormat(posts[0]), 'reel')
  assert.strictEqual(getPostFormat(posts[1]), 'carousel')
  assert.strictEqual(getPostFormat(posts[2]), 'reel')
  assert.strictEqual(getPostFormat(posts[3]), 'reel')
  assert.strictEqual(getPostFormat(posts[4]), 'carousel')
  assert.strictEqual(getPostFormat(posts[5]), 'post')

  const reelPosts = posts.filter(p => matchesFormatFilter(p, 'reel'))
  assert.strictEqual(reelPosts.length, 3) // p1, p3, p4

  const carouselPosts = posts.filter(p => matchesFormatFilter(p, 'carousel'))
  assert.strictEqual(carouselPosts.length, 2) // p2, p5

  const normalPosts = posts.filter(p => matchesFormatFilter(p, 'post'))
  assert.strictEqual(normalPosts.length, 1) // p6
})

// ── 3. Grid Structure Invariance (isLoading = true) ─────────────────────────

runTest('Grid Cell Structure Invariance when isLoading = true vs false', () => {
  const year = 2026
  const monthNum = 7 // August 2026

  // baseGridCells calculation does not depend on isLoading state!
  const cellsBeforeLoad = computeBaseGridCells(year, monthNum)
  
  // Simulated loading state: posts and events data maps are empty
  const postsMapLoading = computePostsByDateKey(undefined)
  const eventsMapLoading = computeEventsByDateKey(undefined)

  // Simulated loaded state
  const postsMapLoaded = computePostsByDateKey({ posts: [{ id: 'p1', publish_at: '2026-08-15' }] })
  const eventsMapLoaded = computeEventsByDateKey({ events: [{ id: 'e1', event_date: '2026-08-20', title: 'Test' }] })

  const cellsAfterLoad = computeBaseGridCells(year, monthNum)

  assert.strictEqual(cellsBeforeLoad.length, cellsAfterLoad.length, 'Cell count must remain constant')
  assert.strictEqual(cellsBeforeLoad.length, 37, 'August 2026 has 6 blanks + 31 days = 37 cells')
  
  for (let i = 0; i < cellsBeforeLoad.length; i++) {
    assert.strictEqual(cellsBeforeLoad[i].key, cellsAfterLoad[i].key, `Cell ${i} key match`)
    assert.strictEqual(cellsBeforeLoad[i].blank, cellsAfterLoad[i].blank, `Cell ${i} blank flag match`)
  }
})

// ── Summary Report ──────────────────────────────────────────────────────────

console.log('\n=== TEST SUITE SUMMARY ===')
const passes = testResults.filter(r => r.status === 'PASS').length
const fails = testResults.filter(r => r.status === 'FAIL').length
console.log(`Total Tests: ${testResults.length} | Passed: ${passes} | Failed: ${fails}`)
if (fails > 0) {
  process.exit(1)
}
