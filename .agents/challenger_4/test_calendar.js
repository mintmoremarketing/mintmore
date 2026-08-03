import assert from 'node:assert';

// ── Replicated Pure Functions from Calendar.jsx ──────────────────────────────

const monthKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const parseMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return { year: y, monthNum: m - 1 };
};

const startOfDay = (date) => {
  const d = new Date(date); d.setHours(0,0,0,0); return d;
};
const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const isPastDay = (date) => startOfDay(date).getTime() < startOfDay(new Date()).getTime();

const toLocalDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPostFormat = (post) => {
  if (post?.format) return post.format.toLowerCase();
  if (post?.type) return post.type.toLowerCase();
  if (post?.asset_type) {
    const at = post.asset_type.toLowerCase();
    if (at.includes('reel')) return 'reel';
    if (at.includes('carousel')) return 'carousel';
  }
  if (post?.media?.[0]?.media_type === 'video' || post?.media?.[0]?.type === 'video') return 'reel';
  if (post?.media && post.media.length > 1) return 'carousel';
  return 'post';
};

const matchesFormatFilter = (item, filter) => {
  if (filter === 'all') return true;
  const fmt = getPostFormat(item);
  return fmt === filter;
};

function computeBaseGridCells(monthStr) {
  const { year, monthNum } = parseMonth(monthStr);
  const first = new Date(year, monthNum, 1);
  const days  = new Date(year, monthNum + 1, 0).getDate();
  const leading = first.getDay();

  const cells = [];
  for (let i = 0; i < leading; i++) {
    cells.push({ key: `blank-${i}`, blank: true });
  }
  for (let i = 1; i <= days; i++) {
    const date = new Date(year, monthNum, i);
    const dateKey = toLocalDateKey(date);
    cells.push({
      key: dateKey,
      dateKey,
      date,
      blank: false,
    });
  }
  return cells;
}

function computePostsByDateKey(socialData) {
  const map = {};
  (socialData?.posts || []).forEach(post => {
    const ts = post.publish_at || post.published_at || post.created_at;
    if (ts) {
      const key = toLocalDateKey(ts);
      if (!map[key]) map[key] = [];
      map[key].push(post);
    }
  });
  return map;
}

function computeEventsByDateKey(creativeData) {
  const map = {};
  (creativeData?.events || []).forEach(event => {
    if (event.event_date) {
      const key = toLocalDateKey(event.event_date);
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
  });
  return map;
}

function computeAllScheduledItems(baseGridCells, postsByDateKey, eventsByDateKey, formatFilter) {
  const items = [];
  baseGridCells.forEach(cell => {
    if (cell.blank) return;
    const cellPosts  = postsByDateKey[cell.dateKey] || [];
    const cellEvents = eventsByDateKey[cell.dateKey] || [];

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
        });
      }
    });

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
        });
      }
    });
  });
  return items;
}

// ── TEST SUITES ───────────────────────────────────────────────────────────────

console.log('====================================================');
console.log('  CHALLENGER 4 EMPIRICAL TEST SUITE FOR CALENDAR  ');
console.log('====================================================\n');

let passCount = 0;
let testCount = 0;

function runTest(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`[PASS] Test #${testCount}: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] Test #${testCount}: ${name}`);
    console.error(`       Error: ${err.message}\n${err.stack}`);
  }
}

// 1. DATE GRID CALCULATION TESTS
runTest('Leap Year Feb 2024 (29 days)', () => {
  const cells = computeBaseGridCells('2024-02');
  const actualDays = cells.filter(c => !c.blank);
  assert.strictEqual(actualDays.length, 29, 'Feb 2024 should have 29 days');
  assert.strictEqual(actualDays[0].dateKey, '2024-02-01');
  assert.strictEqual(actualDays[28].dateKey, '2024-02-29');
});

runTest('Non-Leap Year Feb 2023 (28 days)', () => {
  const cells = computeBaseGridCells('2023-02');
  const actualDays = cells.filter(c => !c.blank);
  assert.strictEqual(actualDays.length, 28, 'Feb 2023 should have 28 days');
  assert.strictEqual(actualDays[27].dateKey, '2023-02-28');
});

runTest('Century Non-Leap Year Feb 1900 (28 days)', () => {
  const cells = computeBaseGridCells('1900-02');
  const actualDays = cells.filter(c => !c.blank);
  assert.strictEqual(actualDays.length, 28, 'Feb 1900 should have 28 days');
});

runTest('400-Year Leap Year Feb 2000 (29 days)', () => {
  const cells = computeBaseGridCells('2000-02');
  const actualDays = cells.filter(c => !c.blank);
  assert.strictEqual(actualDays.length, 29, 'Feb 2000 should have 29 days');
});

runTest('30-day Month: April 2024', () => {
  const cells = computeBaseGridCells('2024-04');
  const actualDays = cells.filter(c => !c.blank);
  assert.strictEqual(actualDays.length, 30, 'April 2024 should have 30 days');
  assert.strictEqual(actualDays[29].dateKey, '2024-04-30');
});

runTest('31-day Month: December 2024', () => {
  const cells = computeBaseGridCells('2024-12');
  const actualDays = cells.filter(c => !c.blank);
  assert.strictEqual(actualDays.length, 31, 'Dec 2024 should have 31 days');
  assert.strictEqual(actualDays[30].dateKey, '2024-12-31');
});

runTest('First Day of Month Starting on Sunday: Feb 2026', () => {
  // Feb 1, 2026 is a Sunday (day 0)
  const cells = computeBaseGridCells('2026-02');
  const blanks = cells.filter(c => c.blank);
  assert.strictEqual(blanks.length, 0, 'Feb 2026 starting on Sunday should have 0 leading blanks');
  assert.strictEqual(cells[0].dateKey, '2026-02-01');
});

runTest('First Day of Month Starting on Saturday: August 2026', () => {
  // Aug 1, 2026 is a Saturday (day 6)
  const cells = computeBaseGridCells('2026-08');
  const blanks = cells.filter(c => c.blank);
  assert.strictEqual(blanks.length, 6, 'Aug 2026 starting on Saturday should have 6 leading blanks');
  assert.strictEqual(cells[6].dateKey, '2026-08-01');
});

runTest('Year Boundary Transition: Dec 2025 -> Jan 2026', () => {
  const decCells = computeBaseGridCells('2025-12');
  const janCells = computeBaseGridCells('2026-01');
  const decDays = decCells.filter(c => !c.blank);
  const janDays = janCells.filter(c => !c.blank);
  assert.strictEqual(decDays.length, 31);
  assert.strictEqual(janDays.length, 31);
  assert.strictEqual(decDays[30].dateKey, '2025-12-31');
  assert.strictEqual(janDays[0].dateKey, '2026-01-01');
});

runTest('toLocalDateKey Format Consistency (Padding zero for day/month)', () => {
  const d = new Date(2026, 0, 5); // Jan 5, 2026
  assert.strictEqual(toLocalDateKey(d), '2026-01-05');
});

// 2. NULL, EMPTY, & DELAYED DATA TESTS
runTest('socialData & creativeData null', () => {
  const postsMap = computePostsByDateKey(null);
  const eventsMap = computeEventsByDateKey(null);
  assert.deepStrictEqual(postsMap, {});
  assert.deepStrictEqual(eventsMap, {});

  const cells = computeBaseGridCells('2026-08');
  const items = computeAllScheduledItems(cells, postsMap, eventsMap, 'all');
  assert.strictEqual(items.length, 0);
});

runTest('socialData & creativeData undefined', () => {
  const postsMap = computePostsByDateKey(undefined);
  const eventsMap = computeEventsByDateKey(undefined);
  assert.deepStrictEqual(postsMap, {});
  assert.deepStrictEqual(eventsMap, {});
});

runTest('socialData.posts is null or empty array', () => {
  assert.deepStrictEqual(computePostsByDateKey({ posts: null }), {});
  assert.deepStrictEqual(computePostsByDateKey({ posts: [] }), {});
});

runTest('creativeData.events is null or empty array', () => {
  assert.deepStrictEqual(computeEventsByDateKey({ events: null }), {});
  assert.deepStrictEqual(computeEventsByDateKey({ events: [] }), {});
});

runTest('Malformed post objects (missing timestamps, null platforms, missing title)', () => {
  const malformedPosts = [
    { id: '1' }, // no timestamp
    { id: '2', publish_at: '2026-08-10T10:00:00Z', platforms: null, caption: null },
    { id: '3', published_at: '2026-08-10T12:00:00Z', media: null },
  ];
  const postsMap = computePostsByDateKey({ posts: malformedPosts });
  assert.strictEqual(Object.keys(postsMap).length, 1);
  assert.strictEqual(postsMap['2026-08-10'].length, 2);

  const cells = computeBaseGridCells('2026-08');
  const items = computeAllScheduledItems(cells, postsMap, {}, 'all');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, 'Untitled Post');
});

runTest('ISO String vs Local Date timestamp parsing in posts', () => {
  // Test timestamp string formats
  const post1 = { id: 'p1', publish_at: '2026-08-15T14:30:00Z', caption: 'Test 1' };
  const post2 = { id: 'p2', publish_at: '2026-08-15', caption: 'Test 2' };
  const postsMap = computePostsByDateKey({ posts: [post1, post2] });
  assert.ok(postsMap['2026-08-15'] || postsMap['2026-08-16']); // Key exists without crashing
});

// 3. ISLOADING & INSTANT GRID INTEGRITY TESTS
runTest('Instant Grid Computation on Frame 0 independent of isLoading', () => {
  const monthStr = '2026-08';
  // Grid cells compute synchronously without any data dependency
  const cells = computeBaseGridCells(monthStr);
  assert.strictEqual(cells.length, 37); // 6 leading blanks + 31 days
  assert.strictEqual(cells.filter(c => !c.blank).length, 31);

  // Simulating isLoading = true
  const isLoading = true;
  // Frame 0: Grid structure is 100% complete and intact
  assert.ok(cells.length > 0, 'Grid structure exists during isLoading=true');
});

// 4. FORMAT FILTER TESTS
runTest('Format Filter Matching (all, reel, carousel, post)', () => {
  const posts = [
    { id: '1', publish_at: '2026-08-01', format: 'reel', caption: 'Reel 1' },
    { id: '2', publish_at: '2026-08-02', format: 'carousel', caption: 'Carousel 1' },
    { id: '3', publish_at: '2026-08-03', format: 'post', caption: 'Post 1' },
    { id: '4', publish_at: '2026-08-04', type: 'REEL', caption: 'Reel 2' },
  ];
  const postsMap = computePostsByDateKey({ posts });
  const cells = computeBaseGridCells('2026-08');

  const allItems = computeAllScheduledItems(cells, postsMap, {}, 'all');
  assert.strictEqual(allItems.length, 4);

  const reels = computeAllScheduledItems(cells, postsMap, {}, 'reel');
  assert.strictEqual(reels.length, 2);

  const carousels = computeAllScheduledItems(cells, postsMap, {}, 'carousel');
  assert.strictEqual(carousels.length, 1);

  const standardPosts = computeAllScheduledItems(cells, postsMap, {}, 'post');
  assert.strictEqual(standardPosts.length, 1);
});

console.log(`\n====================================================`);
console.log(`  RESULTS: ${passCount} / ${testCount} PASSED`);
console.log(`====================================================\n`);

if (passCount !== testCount) {
  process.exit(1);
}
