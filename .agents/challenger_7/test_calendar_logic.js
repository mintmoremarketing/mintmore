// Empirical verification script for Calendar.jsx logic
const assert = require('assert');

console.log('=== STARTING EMPIRICAL TEST SUITE FOR CALENDAR.JSX ===\n');

// 1. Re-implement Calendar.jsx helper logic exactly as written in Calendar.jsx
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

// Simulated data structures
const samplePosts = [
  { id: 'p1', publish_at: '2026-08-15T10:00:00Z', format: 'reel', caption: 'Reel Post 1', platforms: ['instagram'] },
  { id: 'p2', publish_at: '2026-08-15T14:00:00Z', format: 'carousel', caption: 'Carousel Post 2', platforms: ['instagram', 'facebook'] },
  { id: 'p3', publish_at: '2026-08-16T09:00:00Z', format: 'post', caption: 'Standard Post 3', platforms: ['facebook'] },
  { id: 'p4', publish_at: '2026-08-17T11:00:00Z', media: [{ media_type: 'video' }], caption: 'Inferred Reel Post 4' },
  { id: 'p5', publish_at: '2026-08-17T15:00:00Z', media: [{}, {}], caption: 'Inferred Carousel Post 5' }
];

const sampleEvents = [
  { id: 'e1', event_date: '2026-08-15', title: 'Independence Day', asset_type: 'reel' },
  { id: 'e2', event_date: '2026-08-16', title: 'Festival Greeting', asset_type: 'carousel' },
  { id: 'e3', event_date: '2026-08-17', title: 'Standard Event', asset_type: 'post' }
];

// TEST 1: Helper function getPostFormat
console.log('--- TEST 1: Format Resolution (getPostFormat) ---');
console.log('p1 (format: reel):', getPostFormat(samplePosts[0]));
console.log('p2 (format: carousel):', getPostFormat(samplePosts[1]));
console.log('p3 (format: post):', getPostFormat(samplePosts[2]));
console.log('p4 (video media):', getPostFormat(samplePosts[3]));
console.log('p5 (multiple media):', getPostFormat(samplePosts[4]));
console.log('e1 (asset_type: reel):', getPostFormat(sampleEvents[0]));

assert.strictEqual(getPostFormat(samplePosts[0]), 'reel');
assert.strictEqual(getPostFormat(samplePosts[1]), 'carousel');
assert.strictEqual(getPostFormat(samplePosts[2]), 'post');
assert.strictEqual(getPostFormat(samplePosts[3]), 'reel');
assert.strictEqual(getPostFormat(samplePosts[4]), 'carousel');
assert.strictEqual(getPostFormat(sampleEvents[0]), 'reel');
console.log('✅ Test 1 Passed: getPostFormat resolves correctly.\n');

// TEST 2: Format Filter Matching Across Grid vs Sidebar
console.log('--- TEST 2: Format Filter Matching (Grid Cells vs Sidebar) ---');

function computeGridCellContent(dateKey, posts, events, formatFilter) {
  const cellPosts = posts.filter(p => matchesFormatFilter(p, formatFilter));
  // In Calendar.jsx line 862: const cellEvents = eventsByDateKey[cell.dateKey] || []
  // NOTE: cellEvents is NOT filtered by formatFilter!
  const cellEvents = events; 
  return { cellPosts, cellEvents };
}

function computeSidebarItems(dateKey, posts, events, formatFilter) {
  const items = [];
  posts.forEach(post => {
    if (matchesFormatFilter(post, formatFilter)) {
      items.push({ id: post.id, type: 'post', format: getPostFormat(post), title: post.caption });
    }
  });
  // In Calendar.jsx line 583:
  // cellEvents.forEach(event => {
  //   if (formatFilter === 'all' || formatFilter === 'post') { ... }
  // })
  events.forEach(event => {
    if (formatFilter === 'all' || formatFilter === 'post') {
      items.push({ id: event.id, type: 'event', format: event.asset_type || 'post', title: event.title });
    }
  });
  return items;
}

const date15 = '2026-08-15';
const posts15 = samplePosts.filter(p => p.publish_at.startsWith(date15));
const events15 = sampleEvents.filter(e => e.event_date === date15); // e1 has asset_type: 'reel'

['all', 'reel', 'carousel', 'post'].forEach(filter => {
  const grid = computeGridCellContent(date15, posts15, events15, filter);
  const sidebar = computeSidebarItems(date15, posts15, events15, filter);
  
  console.log(`\nFilter '${filter}':`);
  console.log(`  Grid Cell Posts count: ${grid.cellPosts.length}, Events count: ${grid.cellEvents.length} (Total in Grid: ${grid.cellPosts.length + grid.cellEvents.length})`);
  console.log(`  Sidebar Items count: ${sidebar.length}`);
  console.log(`  Grid Cell items: Posts=[${grid.cellPosts.map(p=>p.id).join(',')}], Events=[${grid.cellEvents.map(e=>e.id).join(',')}]`);
  console.log(`  Sidebar items:   Items=[${sidebar.map(i=>i.id).join(',')}]`);

  // Discrepancy checks:
  if (filter === 'reel') {
    // e1 has asset_type 'reel'. Grid shows e1 (in cellEvents). Sidebar EXCLUDES e1!
    const gridHasE1 = grid.cellEvents.some(e => e.id === 'e1');
    const sidebarHasE1 = sidebar.some(i => i.id === 'e1');
    console.log(`  -> DISCREPANCY DETECTED for filter 'reel': Event e1 (asset_type: 'reel') is in Grid Cell? ${gridHasE1} | in Sidebar? ${sidebarHasE1}`);
  }

  if (filter === 'post') {
    // e1 has asset_type 'reel'. Grid shows e1. Sidebar ALSO shows e1 (because formatFilter === 'post'), even though e1 format is 'reel'!
    const sidebarHasE1 = sidebar.some(i => i.id === 'e1');
    console.log(`  -> DISCREPANCY DETECTED for filter 'post': Event e1 (asset_type: 'reel') is included in Sidebar under 'post' filter? ${sidebarHasE1}`);
  }
});

// TEST 3: Ref Map Assignment Collision with Multiple Items per Date
console.log('\n--- TEST 3: Sidebar Item Auto-scroll Ref Map Collision ---');

let sidebarItemRefs = {};

function mountSidebarItem(itemKey, dateKey, mockDomElement) {
  // Line 1056 in Calendar.jsx:
  // ref={(el) => { if (el) { sidebarItemRefs.current[item.dateKey] = el } else { delete sidebarItemRefs.current[item.dateKey] } }}
  sidebarItemRefs[dateKey] = mockDomElement;
}

function unmountSidebarItem(itemKey, dateKey) {
  delete sidebarItemRefs[dateKey];
}

// Simulate rendering 2 items for date '2026-08-15'
const elemItem1 = { id: 'dom-p1' };
const elemItem2 = { id: 'dom-p2' };

mountSidebarItem('p1-2026-08-15', '2026-08-15', elemItem1);
console.log('After mounting item 1, ref for 2026-08-15:', sidebarItemRefs['2026-08-15']?.id);

mountSidebarItem('p2-2026-08-15', '2026-08-15', elemItem2);
console.log('After mounting item 2, ref for 2026-08-15:', sidebarItemRefs['2026-08-15']?.id);

// When hover happens:
console.log('When date 2026-08-15 is hovered, element scrolled to is:', sidebarItemRefs['2026-08-15']?.id);
assert.strictEqual(sidebarItemRefs['2026-08-15'], elemItem2, 'Ref map only stores the LAST item, overwriting previous items');

// If item 1 unmounts:
unmountSidebarItem('p1-2026-08-15', '2026-08-15');
console.log('After item 1 unmounts (calls ref with null), ref for 2026-08-15 is:', sidebarItemRefs['2026-08-15']);
assert.strictEqual(sidebarItemRefs['2026-08-15'], undefined, 'Unmounting one item deletes the ref key for that date completely, breaking auto-scroll for remaining items!');

console.log('✅ Test 3 Complete: Identified Ref Map Key Collision and premature deletion flaw.\n');

// TEST 4: Modal Tab & Confirm Action Behavior
console.log('--- TEST 4: Modal State & Confirm Swap Handler Logic ---');

function testSwapConfirm(tab, selectedTopicId, selectedFestivalId, customText) {
  let actionsTaken = [];
  
  if (tab === 'custom') {
    if (customText.trim()) {
      actionsTaken.push(`Opened custom request for date`);
      actionsTaken.push(`Pushed mint toast: Custom Request Initiated`);
    } else {
      actionsTaken.push(`Pushed amber toast: Input required`);
      return { closed: false, actionsTaken };
    }
  } else if (tab === 'unused') {
    if (selectedTopicId) {
      actionsTaken.push(`Mutated select for topic: ${selectedTopicId}`);
      actionsTaken.push(`Pushed mint toast: Topic Swapped`);
    } else {
      actionsTaken.push(`Pushed mint toast: Topic selected`);
    }
  } else if (tab === 'festivals') {
    actionsTaken.push(`Pushed mint toast: Festival Greeting Selected`);
    // Note: selectedFestivalId is NOT used!
  }
  
  return { closed: true, actionsTaken };
}

console.log('Submitting Tab "unused" WITHOUT selecting a topic:');
console.log(testSwapConfirm('unused', null, null, ''));

console.log('\nSubmitting Tab "festivals" with selectedFestivalId "f2":');
console.log(testSwapConfirm('festivals', null, 'f2', ''));
console.log('  -> Note: selectedFestivalId "f2" is ignored; no backend mutation or state update occurs!');

console.log('\nSubmitting Tab "custom" with empty text:');
console.log(testSwapConfirm('custom', null, null, '   '));

console.log('\nSubmitting Tab "custom" with valid prompt text:');
console.log(testSwapConfirm('custom', null, null, 'Diwali Promo Banner'));

console.log('\n=== EMPIRICAL TEST SUITE COMPLETED ===');
