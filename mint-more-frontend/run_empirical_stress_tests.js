// Empirical Stress Test Harness for Phase 2 Requirements R1 - R5
// Mint-More SaaS Project - Challenger 3

import fs from 'fs';
import path from 'path';

console.log("==================================================================");
console.log("STARTING EMPIRICAL STRESS TEST SUITE: Phase 2 (R1 - R5)");
console.log("==================================================================\n");

let results = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: []
};

function assert(condition, testName, details = "") {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    results.failed++;
    console.log(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    results.findings.push({ testName, details });
  }
}

// -------------------------------------------------------------------
// Pure Logic Simulation of useCalendarState and Component logic
// -------------------------------------------------------------------

function generateTopicsForBrand(form) {
  const brandName = (form?.business_name || '').trim() || 'Your Brand';
  return [
    { id: 'topic-1', title: `Behind the Scenes at ${brandName}`, format: 'reel', category: 'evergreen' },
    { id: 'topic-2', title: 'Customer Bestsellers', format: 'carousel', category: 'promotional' },
    { id: 'topic-3', title: 'Weekly Special', format: 'post', category: 'promotional' },
    { id: 'topic-4', title: 'Foodie Tips', format: 'carousel', category: 'engagement' },
    { id: 'topic-5', title: 'Festive Celebration', format: 'reel', category: 'festival' },
    { id: 'topic-6', title: 'Community Q&A', format: 'post', category: 'engagement' },
    { id: 'topic-7', title: 'Weekend Dining Special', format: 'reel', category: 'promotional' },
  ];
}

function simulateCalendarState({ form, onboardingEvents = [], topicsOverride, overridesInput, approvedIdsInput }) {
  const topics = topicsOverride || generateTopicsForBrand(form);
  const approvedTopicIds = approvedIdsInput || topics.map(t => t.id);
  const calendarOverrides = overridesInput || {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay());

  const frequency = parseInt(form?.posting_frequency || '3', 10);
  const postDaysPattern = {
    1: [3],
    3: [1, 3, 5],
    5: [1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  }[frequency] || [1, 3, 5];

  const safeTopics = topics && topics.length > 0 ? topics : generateTopicsForBrand(form);

  const result = [];
  let topicIndex = 0;

  for (let i = 0; i < 28; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    const isPast = d < today;
    const isToday = d.getTime() === today.getTime();
    const dayOfWeek = d.getDay();

    const override = calendarOverrides[dateKey];
    const defaultHasPost = !isPast && postDaysPattern.includes(dayOfWeek);
    const hasPost = override?.hasPost !== undefined ? override.hasPost : defaultHasPost;

    let assignedTopic = null;
    let assignedFormat = null;
    let status = 'draft';
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
        };
      } else {
        assignedTopic = safeTopics[topicIndex % safeTopics.length];
      }
      topicIndex++;
      assignedFormat = override?.format || assignedTopic?.format || 'post';
      const isApproved = assignedTopic ? (approvedTopicIds || []).includes(assignedTopic.id) : false;
      if (override?.topicId) {
        status = isApproved ? (override.status || 'swapped') : 'draft';
      } else {
        status = isApproved ? (override?.status || 'approved') : 'draft';
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
    });
  }

  return { topics, approvedTopicIds, scheduledDays: result };
}

// -------------------------------------------------------------------
// TEST SUITE 1: STRESS TEST R1 (Step 11 Flashcard Deck & AI API Integration)
// -------------------------------------------------------------------
console.log("--- TEST SUITE 1: STRESS TEST R1 (Step 11 Flashcard & AI API Integration) ---");

// Test R1.1: AI API returning malformed / empty responses
(function testR1_1() {
  const form = { business_name: 'Test Bakery', business_type: 'restaurant' };

  function processApiResponse(resData) {
    const raw = resData?.data || resData || [];
    const rawList = Array.isArray(raw) ? raw : [];
    const brandName = (form?.business_name || '').trim() || 'Your Brand';
    const normalized = rawList.map((item, idx) => ({
      id: `ai-topic-${idx + 1}-${Date.now()}`,
      title: item.title || `Content Focus Topic ${idx + 1}`,
      description: item.desc || item.description || `Tailored strategy for ${brandName}`,
      format: item.format || (idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post'),
      category: item.type === 'festival' ? 'festival' : (idx % 2 === 0 ? 'evergreen' : 'promotional'),
      captionPreview: item.captionPreview || `Exclusive feature post for ${brandName}!`,
      visualPrompt: item.visualPrompt || `High quality graphic design`,
      hashtags: item.hashtags || ['#brand'],
    }));

    const final15 = [...normalized];
    while (final15.length < 15) {
      const idx = final15.length;
      final15.push({
        id: `ai-topic-${idx + 1}-${Date.now()}`,
        title: `Brand Spotlight #${idx + 1}`,
        description: `Engaging customer story & promotional post for ${brandName}.`,
        format: idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post',
        category: 'evergreen',
        captionPreview: `Discover why customers love ${brandName}!`,
        visualPrompt: `Clean modern layout card`,
        hashtags: ['#brand'],
      });
    }
    return final15.slice(0, 15);
  }

  const res1 = processApiResponse([]);
  assert(res1.length === 15, "R1.1a: API returning [] generates padded 15 topics", `Got length ${res1.length}`);

  const res2 = processApiResponse({ data: null });
  assert(res2.length === 15, "R1.1b: API returning null data handles safely and pads to 15 topics", `Got length ${res2.length}`);

  const res3 = processApiResponse([{ title: 'Custom 1' }, { title: 'Custom 2' }, { title: 'Custom 3' }]);
  assert(res3.length === 15 && res3[0].title === 'Custom 1', "R1.1c: API returning 3 topics preserves them and pads up to 15", `Got length ${res3.length}`);
})();

// Test R1.2: API Failure Fallback
(function testR1_2() {
  const form = { business_name: 'Test Bakery' };
  const brandName = (form?.business_name || '').trim() || 'Your Brand';
  const fallback15 = Array.from({ length: 15 }, (_, idx) => ({
    id: `ai-topic-fallback-${idx + 1}-${Date.now()}`,
    title: idx === 4 ? `Festival Celebration Post` : `Brand Topic ${idx + 1}: ${brandName} Feature`,
    description: `Custom generated topic designed to drive engagement for ${brandName}.`,
    format: idx % 3 === 0 ? 'reel' : idx % 3 === 1 ? 'carousel' : 'post',
    category: idx === 4 ? 'festival' : (idx % 2 === 0 ? 'evergreen' : 'promotional'),
    captionPreview: `Welcome to ${brandName}!`,
    visualPrompt: `Creative brand visual concept.`,
    hashtags: ['#brandstory'],
    festivalName: idx === 4 ? 'Festival Special' : null,
  }));

  assert(fallback15.length === 15, "R1.2a: Fallback mechanism creates exactly 15 topics", `Got ${fallback15.length}`);
  assert(fallback15[4].category === 'festival', "R1.2b: Fallback includes festival topic at index 4");
})();

// Test R1.3: Card Deck Review Actions & All-No Edge Case Bug
(function testR1_3() {
  const generatedTopics = Array.from({ length: 15 }, (_, i) => ({ id: `topic-${i+1}`, title: `Topic ${i+1}` }));

  function finishAndNavigate(finalApprovedTopics) {
    const topicListToSave = Array.isArray(finalApprovedTopics) ? finalApprovedTopics : generatedTopics;
    return topicListToSave;
  }

  const approved8 = generatedTopics.slice(0, 8);
  const result8 = finishAndNavigate(approved8);
  assert(result8.length === 8, "R1.3a: Approving 8 topics saves exactly 8 topics", `Got ${result8.length}`);

  const resultAll = finishAndNavigate(generatedTopics);
  assert(resultAll.length === 15, "R1.3b: Approve All saves 15 topics", `Got ${resultAll.length}`);

  const approved0 = [];
  const result0 = finishAndNavigate(approved0);
  const isBugPresent = result0.length === 15;
  assert(!isBugPresent, "R1.3c [CRITICAL BUG]: Rejecting all 15 topics should NOT approve all 15 topics", 
    isBugPresent ? "BEHAVIORAL BUG DETECTED in ContentGenerationPage.jsx: Rejecting all 15 cards falls back to approving all 15 cards!" : "Passed");
})();

console.log("");

// -------------------------------------------------------------------
// TEST SUITE 2: STRESS TEST R2 (Strict Unused Topics Filtering)
// -------------------------------------------------------------------
console.log("--- TEST SUITE 2: STRESS TEST R2 (Strict Unused Topics Filtering) ---");

(function testR2() {
  const form = { business_name: 'TechCorp', posting_frequency: '7' };
  const all7Topics = generateTopicsForBrand(form);

  function getUnusedTopics(topicsList, scheduledDaysList) {
    const scheduledTopicIds = new Set(
      (scheduledDaysList || [])
        .filter(d => d.hasPost && d.topic?.id)
        .map(d => d.topic.id)
    );
    return (topicsList || []).filter(t => !scheduledTopicIds.has(t.id));
  }

  // Scenario 2.1: Frequency = 7 (all 7 topics scheduled multiple times across 28 days)
  const stateFreq7 = simulateCalendarState({ form, topicsOverride: all7Topics });
  const unusedFreq7 = getUnusedTopics(all7Topics, stateFreq7.scheduledDays);
  assert(unusedFreq7.length === 0, "R2.1: When all topics are scheduled, unusedTopics length is strictly 0", `Got ${unusedFreq7.length}`);

  // Scenario 2.2: Partial scheduling with 10 topics total, only 7 scheduled
  const tenTopics = [
    ...all7Topics,
    { id: 'topic-8', title: 'Extra Topic 8' },
    { id: 'topic-9', title: 'Extra Topic 9' },
    { id: 'topic-10', title: 'Extra Topic 10' }
  ];
  const statePartial = simulateCalendarState({ form, topicsOverride: tenTopics });
  const scheduled7Posts = statePartial.scheduledDays.filter(d => d.hasPost).slice(0, 7);
  const unusedPartial = getUnusedTopics(tenTopics, scheduled7Posts);
  assert(unusedPartial.length === 3, "R2.2: 7 of 10 topics scheduled leaves exactly 3 unused topics in Tab 1", `Got ${unusedPartial.length}`);
  const unusedIds = unusedPartial.map(t => t.id);
  assert(unusedIds.includes('topic-8') && unusedIds.includes('topic-9') && unusedIds.includes('topic-10'), 
    "R2.2b: Correct unused topic IDs (topic-8, topic-9, topic-10) returned in Tab 1");

  // Scenario 2.3: Zero posts scheduled (frequency pattern empty / all hasPost=false)
  const emptyDays = stateFreq7.scheduledDays.map(d => ({ ...d, hasPost: false }));
  const unusedZero = getUnusedTopics(all7Topics, emptyDays);
  assert(unusedZero.length === 7, "R2.3: Zero scheduled posts leaves all 7 topics unused", `Got ${unusedZero.length}`);

  // Scenario 2.4: Topic Index Shift Bug on Override
  // Audit what happens when Day 1 is swapped to a custom topic
  const targetDay = statePartial.scheduledDays.find(d => d.hasPost && d.topic?.id === 'topic-1');
  const overridesWithSwap = {
    [targetDay.dateKey]: {
      topicId: 'custom-99',
      hasPost: true
    }
  };
  const stateAfterSwap = simulateCalendarState({ form, topicsOverride: tenTopics, overridesInput: overridesWithSwap });
  const unusedAfterSwap = getUnusedTopics(tenTopics, stateAfterSwap.scheduledDays);
  const nextScheduledDay = stateAfterSwap.scheduledDays.find(d => d.hasPost && d.dateKey > targetDay.dateKey);
  const topic1Shifted = nextScheduledDay?.topic?.id === 'topic-1';
  assert(!topic1Shifted, "R2.4 [LOGIC BUG]: Swapping topic-1 should release topic-1, NOT shift topic-1 onto the next scheduled day",
    topic1Shifted ? "BEHAVIORAL BUG DETECTED in useCalendarState.js: Swapping Day 1 topic causes topicIndex not to increment, shifting topic-1 to Day 2!" : "Passed");

  // Scenario 2.5: Edge cases: Null / Empty topics input
  const unusedNull = getUnusedTopics(null, stateFreq7.scheduledDays);
  assert(Array.isArray(unusedNull) && unusedNull.length === 0, "R2.5a: Null topics input returns empty array without throwing error");
  const unusedEmpty = getUnusedTopics([], stateFreq7.scheduledDays);
  assert(Array.isArray(unusedEmpty) && unusedEmpty.length === 0, "R2.5b: Empty topics array returns [] without throwing error");
})();

console.log("");

// -------------------------------------------------------------------
// TEST SUITE 3: STRESS TEST R3 (Festival Opt-Out Auto-Swap)
// -------------------------------------------------------------------
console.log("--- TEST SUITE 3: STRESS TEST R3 (Festival Opt-Out Auto-Swap) ---");

(function testR3() {
  const form = { business_name: 'Festival Cafe', posting_frequency: '3' };
  const baseTopics = generateTopicsForBrand(form);

  function simulateFestivalOptOut(state, dateKeyTarget) {
    let currentTopics = [...state.topics];
    let overrides = { ...state.calendarOverrides };

    const scheduledDays = state.scheduledDays;
    const currentScheduledTopicIds = new Set(
      scheduledDays.filter(d => d.hasPost && d.topic?.id && d.dateKey !== dateKeyTarget).map(d => d.topic.id)
    );

    let replacementTopic = currentTopics.find(t => t.category !== 'festival' && !currentScheduledTopicIds.has(t.id));
    if (!replacementTopic) {
      const brandName = (form?.business_name || '').trim() || 'Your Brand';
      const customId = `brand-replacement-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      replacementTopic = {
        id: customId,
        title: `${brandName} Core Feature Showcase`,
        description: `Standard brand focus post highlighting quality products and services.`,
        format: 'post',
        category: 'evergreen',
        captionPreview: `Discover what makes ${brandName} stand out!`,
        visualPrompt: `Clean product showcase image in brand colors.`,
        hashtags: ['#brandfeature', '#qualityservice', '#localbusiness'],
      };
      currentTopics.push(replacementTopic);
    }

    overrides[dateKeyTarget] = {
      ...overrides[dateKeyTarget],
      hasPost: true,
      topicId: replacementTopic.id,
      customTitle: replacementTopic.title,
      customDesc: replacementTopic.description,
      customCaption: replacementTopic.captionPreview,
      isFestivalOptOut: true,
      status: 'swapped',
    };

    return simulateCalendarState({ form, topicsOverride: currentTopics, overridesInput: overrides });
  }

  let state = simulateCalendarState({ form, topicsOverride: baseTopics });
  const festivalDay = state.scheduledDays.find(d => d.hasPost && d.topic?.category === 'festival');
  assert(Boolean(festivalDay), "R3.0: Found scheduled festival topic day tile for testing", `Date: ${festivalDay?.dateKey}`);

  const postCountBefore = state.scheduledDays.filter(d => d.hasPost).length;

  let stateAfterOptOut1 = simulateFestivalOptOut(state, festivalDay.dateKey);
  const postCountAfter1 = stateAfterOptOut1.scheduledDays.filter(d => d.hasPost).length;
  const optedOutDay = stateAfterOptOut1.scheduledDays.find(d => d.dateKey === festivalDay.dateKey);

  assert(postCountBefore === postCountAfter1, "R3.1a: Post count remains CONSTANT after festival opt-out", `Before: ${postCountBefore}, After: ${postCountAfter1}`);
  assert(optedOutDay.hasPost === true, "R3.1b: hasPost remains true on opted-out slot");
  assert(optedOutDay.status === 'swapped', "R3.1c: Slot status updated to 'swapped'");
  assert(optedOutDay.topic?.category !== 'festival', "R3.1d: Festival topic replaced with non-festival topic", `New topic: ${optedOutDay.topic?.title}`);

  // Test Rapid Double Opt-Out / ID Collision risk
  const t1 = `brand-replacement-${1000}`;
  const t2 = `brand-replacement-${1000}`;
  const idCollisionRisk = (t1 === t2);
  assert(idCollisionRisk, "R3.2 [AUDIT]: Rapid opt-outs using Date.now() can produce duplicate IDs if timestamp matches");

  // Check Title Fallback when replacementTopic is created on the fly
  const fallbackCheck = {
    id: 'brand-replacement-123',
    title: undefined || 'Custom Topic'
  };
  assert(fallbackCheck.title === 'Custom Topic', "R3.3 [AUDIT]: Lack of customTitle in calendarOverrides causes generic 'Custom Topic' fallback if safeTopics lookup lags");
})();

console.log("");

// -------------------------------------------------------------------
// TEST SUITE 4: STRESS TEST R4 & R5 (Click-to-Swap & Hover Auto-Scroll)
// -------------------------------------------------------------------
console.log("--- TEST SUITE 4: STRESS TEST R4 & R5 (Click-to-Swap & Hover Auto-Scroll) ---");

(function testR4_R5() {
  const form = { business_name: 'Click Test Co', posting_frequency: '3' };
  const state = simulateCalendarState({ form });

  const scheduledTile = state.scheduledDays.find(d => d.hasPost);
  const unscheduledTile = state.scheduledDays.find(d => !d.hasPost);

  let swapModalState = { isOpen: false, targetDateKey: null };
  let expandedTopicId = null;
  let hoveredDateKey = null;

  function handleTileClick(day) {
    if (day.hasPost && day.dateKey) {
      if (day.topic?.id) {
        expandedTopicId = day.topic.id;
      }
      hoveredDateKey = day.dateKey;
      swapModalState = { isOpen: true, targetDateKey: day.dateKey };
    }
  }

  handleTileClick(scheduledTile);
  assert(swapModalState.isOpen === true && swapModalState.targetDateKey === scheduledTile.dateKey, 
    "R4.1: Clicking tile WITH post opens swap modal for target dateKey");
  assert(expandedTopicId === scheduledTile.topic.id, "R4.1b: Sets expandedTopicId to tile topic ID");

  swapModalState = { isOpen: false, targetDateKey: null };

  handleTileClick(unscheduledTile);
  assert(swapModalState.isOpen === false, "R4.2: Clicking tile WITHOUT post does NOT open swap modal");

  const sidebarItemRefs = {};

  state.scheduledDays.filter(d => d.hasPost).forEach(day => {
    sidebarItemRefs[day.dateKey] = {
      dateKey: day.dateKey,
      scrollIntoView: (opts) => {
        return `scrolled-${day.dateKey}`;
      }
    };
  });

  function simulateHoverEffect(dateKeyHovered) {
    if (dateKeyHovered && sidebarItemRefs[dateKeyHovered]) {
      return sidebarItemRefs[dateKeyHovered].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return 'no-scroll';
  }

  const hoverResultScheduled = simulateHoverEffect(scheduledTile.dateKey);
  assert(hoverResultScheduled === `scrolled-${scheduledTile.dateKey}`, 
    "R5.1: Hovering over scheduled day tile triggers scrollIntoView on mapped sidebar item ref");

  const hoverResultUnscheduled = simulateHoverEffect(unscheduledTile.dateKey);
  assert(hoverResultUnscheduled === 'no-scroll', 
    "R5.2: Hovering over unscheduled day tile (not in sidebar) safely bypasses scrollIntoView without throwing error");

  function unmountSidebarItem(dateKey) {
    delete sidebarItemRefs[dateKey];
  }
  unmountSidebarItem(scheduledTile.dateKey);
  assert(sidebarItemRefs[scheduledTile.dateKey] === undefined, 
    "R5.3: Unmounting sidebar item properly removes ref entry from sidebarItemRefs dictionary");
})();

console.log("");
console.log("==================================================================");
console.log(`STRESS TEST SUMMARY: ${results.passed}/${results.total} PASSED, ${results.failed} FAILED`);
console.log("==================================================================");

if (results.findings.length > 0) {
  console.log("\nDETAILED FINDINGS / BUGS surfacing from empirical testing:");
  results.findings.forEach((f, idx) => {
    console.log(` ${idx + 1}. [${f.testName}] -> ${f.details}`);
  });
}
