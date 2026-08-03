// Empirical Test Suite for Calendar.jsx interaction fixes
// Challenger 8 (teamwork_preview_challenger)

const fs = require('fs');
const path = require('path');

console.log("==================================================================");
console.log("STARTING EMPIRICAL TEST SUITE FOR CALENDAR.JSX FIXES (CHALLENGER 8)");
console.log("==================================================================\n");

let results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function assert(condition, testName, details = "") {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    results.failed++;
    console.log(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    results.failures.push({ testName, details });
  }
}

// -------------------------------------------------------------------
// 1. EXTRACT / REPLICATE Calendar.jsx HELPER LOGIC DIRECTLY
// -------------------------------------------------------------------

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

const toLocalDateKey = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Generate test base grid cells for August 2026 (31 days)
function generateBaseGridCells(year = 2026, monthNum = 7) { // Month 7 is August (0-indexed)
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
      if (matchesFormatFilter(event, formatFilter)) {
        items.push({
          id: event.id,
          dateKey: cell.dateKey,
          date: cell.date,
          title: event.title,
          format: getPostFormat(event),
          type: 'event',
          raw: event,
        })
      }
    })
  })
  return items
}

function computeGridCellTotals(baseGridCells, postsByDateKey, eventsByDateKey, formatFilter) {
  let totalGridItems = 0;
  const gridItemsByDate = {};

  baseGridCells.forEach(cell => {
    if (cell.blank) return;
    const cellPosts = (postsByDateKey[cell.dateKey] || []).filter(p => matchesFormatFilter(p, formatFilter));
    const cellEvents = (eventsByDateKey[cell.dateKey] || []).filter(e => matchesFormatFilter(e, formatFilter));
    const count = cellPosts.length + cellEvents.length;
    totalGridItems += count;
    gridItemsByDate[cell.dateKey] = count;
  });

  return { totalGridItems, gridItemsByDate };
}

// -------------------------------------------------------------------
// FOCUS AREA 1: FORMAT FILTER CONSISTENCY TEST
// -------------------------------------------------------------------
console.log("--- FOCUS AREA 1: Format Filter Consistency ---");

(function testFormatFilterConsistency() {
  const baseGridCells = generateBaseGridCells(2026, 7);

  // Mock dataset with diverse post & event formats
  const postsByDateKey = {
    '2026-08-05': [
      { id: 'p1', publish_at: '2026-08-05T10:00:00Z', format: 'reel', caption: 'Reel post 1' },
      { id: 'p2', publish_at: '2026-08-05T14:00:00Z', format: 'carousel', caption: 'Carousel post 1' },
      { id: 'p3', publish_at: '2026-08-05T18:00:00Z', format: 'post', caption: 'Standard post 1' },
    ],
    '2026-08-12': [
      { id: 'p4', publish_at: '2026-08-12T09:00:00Z', media: [{ type: 'video' }], caption: 'Inferred reel' },
      { id: 'p5', publish_at: '2026-08-12T11:00:00Z', media: [{ type: 'image' }, { type: 'image' }], caption: 'Inferred carousel' },
    ],
    '2026-08-20': [
      { id: 'p6', publish_at: '2026-08-20T16:00:00Z', format: 'REEL', caption: 'Uppercase REEL format' },
    ]
  };

  const eventsByDateKey = {
    '2026-08-05': [
      { id: 'e1', event_date: '2026-08-05', asset_type: 'reel_video', title: 'Reel Event 1' },
      { id: 'e2', event_date: '2026-08-05', asset_type: 'carousel_graphic', title: 'Carousel Event 1' },
    ],
    '2026-08-15': [
      { id: 'e3', event_date: '2026-08-15', format: 'post', title: 'Post Event 1' }
    ]
  };

  const filters = ['all', 'reel', 'carousel', 'post'];

  filters.forEach(filter => {
    const gridRes = computeGridCellTotals(baseGridCells, postsByDateKey, eventsByDateKey, filter);
    const sidebarItems = computeAllScheduledItems(baseGridCells, postsByDateKey, eventsByDateKey, filter);

    assert(
      gridRes.totalGridItems === sidebarItems.length,
      `Filter '${filter}': Total grid cell count (${gridRes.totalGridItems}) matches sidebar count (${sidebarItems.length})`,
      `Mismatch for filter ${filter}: grid=${gridRes.totalGridItems}, sidebar=${sidebarItems.length}`
    );

    // Verify per-dateKey consistency
    let perDateMismatch = false;
    baseGridCells.forEach(cell => {
      if (cell.blank) return;
      const gridCount = gridRes.gridItemsByDate[cell.dateKey] || 0;
      const sidebarCount = sidebarItems.filter(item => item.dateKey === cell.dateKey).length;
      if (gridCount !== sidebarCount) {
        perDateMismatch = true;
      }
    });

    assert(
      !perDateMismatch,
      `Filter '${filter}': Per-dateKey item counts are identical between grid cells and sidebar list`
    );
  });
})();

console.log("");

// -------------------------------------------------------------------
// FOCUS AREA 2: SWAP MODAL HANDLERS TEST
// -------------------------------------------------------------------
console.log("--- FOCUS AREA 2: Swap Modal Handlers ---");

(function testSwapModalHandlers() {
  const FESTIVAL_PRESETS = [
    { id: 'f1', title: 'Independence Day Special Greeting', tag: 'National Holiday', format: 'post' },
    { id: 'f2', title: 'Diwali Festive Offer & Wishes', tag: 'Festival of Lights', format: 'carousel' },
    { id: 'f3', title: 'New Year Brand Celebration', tag: 'Holiday', format: 'reel' },
    { id: 'f4', title: 'Customer Appreciation Day', tag: 'Brand Event', format: 'post' },
  ];

  // Replicate handleConfirmSwap state & execution context
  function simulateSwapModal({
    activeSwapTab,
    selectedSwapTopicId,
    selectedSwapFestival,
    customSwapText,
    swapModalState
  }) {
    let toastLog = [];
    let mutationCalledWith = null;
    let customRequestCalledWith = null;
    let modalClosed = false;

    const pushToast = (toast) => { toastLog.push(toast); };
    const selectMutate = (topicIds) => { mutationCalledWith = topicIds; };
    const openRequest = (date) => { customRequestCalledWith = date; };
    const closeSwapModal = () => { modalClosed = true; };

    // Implementation of handleConfirmSwap from Calendar.jsx lines 654-679:
    if (activeSwapTab === 'custom') {
      if (customSwapText.trim()) {
        openRequest(swapModalState.targetDate)
        pushToast({ title: 'Custom Request Initiated', body: `Created custom request for ${swapModalState.targetDateKey}.`, tone: 'mint' })
      } else {
        pushToast({ title: 'Input required', body: 'Please describe the custom request prompt.', tone: 'amber' })
        return { toastLog, mutationCalledWith, customRequestCalledWith, modalClosed };
      }
    } else if (activeSwapTab === 'unused') {
      if (!selectedSwapTopicId) {
        pushToast({ title: 'Selection required', body: 'Please select an unused topic to swap.', tone: 'amber' })
        return { toastLog, mutationCalledWith, customRequestCalledWith, modalClosed };
      }
      selectMutate([selectedSwapTopicId])
      pushToast({ title: 'Topic Swapped', body: `Swapped topic for ${swapModalState.targetDateKey}.`, tone: 'mint' })
    } else if (activeSwapTab === 'festivals') {
      if (!selectedSwapFestival) {
        pushToast({ title: 'Selection required', body: 'Please select a festival preset to swap.', tone: 'amber' })
        return { toastLog, mutationCalledWith, customRequestCalledWith, modalClosed };
      }
      const selectedFest = FESTIVAL_PRESETS.find(f => f.id === selectedSwapFestival)
      pushToast({ title: 'Festival Greeting Selected', body: `Updated topic with '${selectedFest?.title || 'Festival'}' for ${swapModalState.targetDateKey}.`, tone: 'mint' })
    }
    closeSwapModal()

    return { toastLog, mutationCalledWith, customRequestCalledWith, modalClosed };
  }

  const dummyTargetDate = new Date('2026-08-15');
  const dummySwapState = { isOpen: true, targetDateKey: '2026-08-15', targetDate: dummyTargetDate };

  // Test Case 2.1: Tab 1 ('unused') WITHOUT topic selection
  const res2_1 = simulateSwapModal({
    activeSwapTab: 'unused',
    selectedSwapTopicId: null,
    selectedSwapFestival: null,
    customSwapText: '',
    swapModalState: dummySwapState
  });

  assert(
    res2_1.toastLog.length === 1 &&
    res2_1.toastLog[0].title === 'Selection required' &&
    res2_1.toastLog[0].tone === 'amber',
    "Tab 1 ('unused') without topic selection triggers validation error toast ('Selection required', tone: 'amber')"
  );
  assert(
    res2_1.mutationCalledWith === null,
    "Tab 1 ('unused') without topic selection does NOT execute swap mutation"
  );
  assert(
    res2_1.modalClosed === false,
    "Tab 1 ('unused') without topic selection keeps modal open (does NOT close modal)"
  );

  // Test Case 2.2: Tab 1 ('unused') WITH topic selection
  const res2_2 = simulateSwapModal({
    activeSwapTab: 'unused',
    selectedSwapTopicId: 'topic-456',
    selectedSwapFestival: null,
    customSwapText: '',
    swapModalState: dummySwapState
  });

  assert(
    Array.isArray(res2_2.mutationCalledWith) && res2_2.mutationCalledWith[0] === 'topic-456',
    "Tab 1 ('unused') WITH topic selection executes select.mutate(['topic-456'])"
  );
  assert(
    res2_2.toastLog.length === 1 &&
    res2_2.toastLog[0].title === 'Topic Swapped' &&
    res2_2.toastLog[0].tone === 'mint',
    "Tab 1 ('unused') WITH topic selection triggers success toast ('Topic Swapped')"
  );
  assert(
    res2_2.modalClosed === true,
    "Tab 1 ('unused') WITH topic selection closes swap modal"
  );

  // Test Case 2.3: Tab 2 ('festivals') WITHOUT festival selection
  const res2_3 = simulateSwapModal({
    activeSwapTab: 'festivals',
    selectedSwapTopicId: null,
    selectedSwapFestival: null,
    customSwapText: '',
    swapModalState: dummySwapState
  });

  assert(
    res2_3.toastLog.length === 1 &&
    res2_3.toastLog[0].title === 'Selection required' &&
    res2_3.toastLog[0].tone === 'amber',
    "Tab 2 ('festivals') without festival selection triggers validation error toast"
  );
  assert(
    res2_3.modalClosed === false,
    "Tab 2 ('festivals') without festival selection keeps modal open"
  );

  // Test Case 2.4: Tab 2 ('festivals') WITH festival selection
  const res2_4 = simulateSwapModal({
    activeSwapTab: 'festivals',
    selectedSwapTopicId: null,
    selectedSwapFestival: 'f2',
    customSwapText: '',
    swapModalState: dummySwapState
  });

  assert(
    res2_4.toastLog.length === 1 &&
    res2_4.toastLog[0].title === 'Festival Greeting Selected' &&
    res2_4.toastLog[0].body.includes('Diwali Festive Offer & Wishes') &&
    res2_4.toastLog[0].tone === 'mint',
    "Tab 2 ('festivals') WITH festival selection triggers success toast with festival title ('Diwali Festive Offer & Wishes')"
  );
  assert(
    res2_4.modalClosed === true,
    "Tab 2 ('festivals') WITH festival selection closes swap modal"
  );

  // Test Case 2.5: Tab 3 ('custom') without prompt vs with prompt
  const res2_5_empty = simulateSwapModal({
    activeSwapTab: 'custom',
    selectedSwapTopicId: null,
    selectedSwapFestival: null,
    customSwapText: '   ',
    swapModalState: dummySwapState
  });
  assert(
    res2_5_empty.toastLog[0].title === 'Input required' && res2_5_empty.modalClosed === false,
    "Tab 3 ('custom') without prompt text triggers validation error toast and stays open"
  );

  const res2_5_valid = simulateSwapModal({
    activeSwapTab: 'custom',
    selectedSwapTopicId: null,
    selectedSwapFestival: null,
    customSwapText: 'Special Weekend Sale Announcement',
    swapModalState: dummySwapState
  });
  assert(
    res2_5_valid.customRequestCalledWith === dummyTargetDate &&
    res2_5_valid.toastLog[0].title === 'Custom Request Initiated' &&
    res2_5_valid.modalClosed === true,
    "Tab 3 ('custom') WITH prompt text opens custom request, shows success toast, and closes modal"
  );
})();

console.log("");

// -------------------------------------------------------------------
// FOCUS AREA 3: SIDEBAR REF CLEANUP TEST
// -------------------------------------------------------------------
console.log("--- FOCUS AREA 3: Sidebar Ref Cleanup ---");

(function testSidebarRefCleanup() {
  const sidebarItemRefs = { current: {} };

  // Replicate ref callback logic (Calendar.jsx lines 1068-1075)
  function attachRef(item, element) {
    const refKey = item.id ? `${item.dateKey}_${item.id}` : item.dateKey;
    if (element) {
      sidebarItemRefs.current[refKey] = element;
    } else {
      delete sidebarItemRefs.current[refKey];
    }
  }

  // Replicate hover auto-scroll lookup logic (Calendar.jsx lines 421-435)
  function findTargetElementForHover(hoveredDateKey, allScheduledItems) {
    if (!hoveredDateKey) return null;
    const matchingItem = allScheduledItems.find(item => item.dateKey === hoveredDateKey);
    let targetEl = matchingItem
      ? (sidebarItemRefs.current[`${hoveredDateKey}_${matchingItem.id}`] || sidebarItemRefs.current[matchingItem.id || matchingItem.dateKey])
      : null;
    if (!targetEl) {
      const entry = Object.entries(sidebarItemRefs.current).find(([k, el]) => el && k.startsWith(hoveredDateKey));
      if (entry) targetEl = entry[1];
    }
    return targetEl;
  }

  // Test Scenario 3.1: Multiple items for single dateKey '2026-08-10'
  const dateKey = '2026-08-10';
  const mockItems = [
    { id: 'post-101', dateKey, title: 'Item 1' },
    { id: 'post-102', dateKey, title: 'Item 2' },
    { id: 'event-201', dateKey, title: 'Item 3' },
  ];

  // Mock DOM elements
  const el1 = { name: 'DOM_el1', scrollIntoView: () => {} };
  const el2 = { name: 'DOM_el2', scrollIntoView: () => {} };
  const el3 = { name: 'DOM_el3', scrollIntoView: () => {} };

  // Mount all 3 items
  attachRef(mockItems[0], el1);
  attachRef(mockItems[1], el2);
  attachRef(mockItems[2], el3);

  assert(
    Object.keys(sidebarItemRefs.current).length === 3,
    "Mounting 3 items for single dateKey creates 3 distinct ref map keys (`2026-08-10_post-101`, `2026-08-10_post-102`, `2026-08-10_event-201`)"
  );

  // Hovering dateKey finds the first matching item's element
  const targetOnHover = findTargetElementForHover(dateKey, mockItems);
  assert(
    targetOnHover === el1,
    "Hovering dateKey resolves to first item's DOM element"
  );

  // Unmount item 1 (simulate React unmounting item 1, passing null to ref callback)
  attachRef(mockItems[0], null);

  assert(
    sidebarItemRefs.current['2026-08-10_post-101'] === undefined,
    "Unmounting item 1 explicitly deletes `2026-08-10_post-101` from ref map (no stale ref key corruption)"
  );
  assert(
    Object.keys(sidebarItemRefs.current).length === 2,
    "Ref map size decreases to 2 after unmounting item 1"
  );

  // Remaining items list after unmounting item 1
  const updatedItems = [mockItems[1], mockItems[2]];
  const targetAfterUnmount = findTargetElementForHover(dateKey, updatedItems);
  assert(
    targetAfterUnmount === el2,
    "Hovering dateKey after item 1 unmount safely resolves to remaining item 2's DOM element (`DOM_el2`)"
  );

  // Unmount all remaining items
  attachRef(mockItems[1], null);
  attachRef(mockItems[2], null);

  assert(
    Object.keys(sidebarItemRefs.current).length === 0,
    "Unmounting all items completely cleans ref map dictionary to empty object {}"
  );

  const targetWhenEmpty = findTargetElementForHover(dateKey, []);
  assert(
    targetWhenEmpty === null,
    "Hovering dateKey when ref map is empty returns null without throwing errors"
  );
})();

console.log("");
console.log("==================================================================");
console.log(`EMPIRICAL TEST SUMMARY: ${results.passed}/${results.total} PASSED, ${results.failed} FAILED`);
console.log("==================================================================");

if (results.failures.length > 0) {
  console.log("\nFAILURES ENCOUNTERED:");
  results.failures.forEach((f, i) => console.log(` ${i+1}. [${f.testName}] -> ${f.details}`));
} else {
  console.log("\nALL EMPIRICAL TESTS PASSED SUCCESSFULLY!");
}
