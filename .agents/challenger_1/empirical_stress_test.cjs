const fs = require('fs');
const path = require('path');

console.log("=========================================");
console.log("  CHALLENGER 1 EMPIRICAL STRESS TEST     ");
console.log("=========================================");

// 1. Load and execute generateTopicsForBrand logic
function generateTopicsForBrand(form) {
  const brandName = form?.business_name || 'Your Brand';
  const type = form?.business_type || 'restaurant';

  const topicTemplatesPerType = {
    restaurant: [
      { id: 'topic-1', title: `Behind the Scenes at ${brandName}`, format: 'reel', category: 'evergreen' },
      { id: 'topic-2', title: 'Customer Bestsellers & Top Picks', format: 'carousel', category: 'promotional' },
      { id: 'topic-3', title: 'Weekly Chef Special Showcase', format: 'post', category: 'promotional' },
      { id: 'topic-4', title: 'Foodie Tips & Recipe Pairing', format: 'carousel', category: 'engagement' },
      { id: 'topic-5', title: 'Festive Celebration & Warm Greetings', format: 'reel', category: 'festival' },
      { id: 'topic-6', title: 'Community Q&A & Guest Spotlight', format: 'post', category: 'engagement' },
      { id: 'topic-7', title: 'Weekend Dining Special', format: 'reel', category: 'promotional' },
    ],
    fashion: [
      { id: 'topic-1', title: `Styling Guide by ${brandName}`, format: 'reel', category: 'evergreen' },
      { id: 'topic-2', title: 'New Season Lookbook Highlights', format: 'carousel', category: 'promotional' },
      { id: 'topic-3', title: 'Fabric & Fit Spotlight', format: 'post', category: 'promotional' },
      { id: 'topic-4', title: 'Wardrobe Essentials Checklist', format: 'carousel', category: 'engagement' },
      { id: 'topic-5', title: 'Festive Outfit & Glam Showcase', format: 'reel', category: 'festival' },
      { id: 'topic-6', title: 'Customer Style & Review Feature', format: 'post', category: 'engagement' },
      { id: 'topic-7', title: 'Weekend Shopping Event Announcement', format: 'reel', category: 'promotional' },
    ],
  };

  const defaultTopics = [
    { id: 'topic-1', title: `Welcome to ${brandName}`, format: 'reel', category: 'evergreen' },
    { id: 'topic-2', title: 'Top Services & Core Offerings', format: 'carousel', category: 'promotional' },
    { id: 'topic-3', title: 'Customer Spotlight & Testimonials', format: 'post', category: 'engagement' },
    { id: 'topic-4', title: 'Expert Advice & Insider Tips', format: 'carousel', category: 'engagement' },
    { id: 'topic-5', title: 'Festive Season Special Announcement', format: 'reel', category: 'festival' },
    { id: 'topic-6', title: 'Behind the Scenes & Process', format: 'post', category: 'evergreen' },
    { id: 'topic-7', title: 'Weekend Offer & Quick Booking', format: 'reel', category: 'promotional' },
  ];

  return topicTemplatesPerType[type] || defaultTopics;
}

// 2. Full simulation of scheduledDays logic from useCalendarState.js
function getScheduledDays(form, topics, calendarOverrides = {}, approvedTopicIds = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay()); // Align to nearest Sunday

  const frequency = parseInt(form?.posting_frequency || '3', 10);
  const postDaysPattern = {
    1: [3],
    3: [1, 3, 5],
    5: [1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6],
  }[frequency] || [1, 3, 5];

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
        assignedTopic = topics.find(t => t.id === override.topicId) || {
          id: override.topicId,
          title: override.customTitle || 'Custom Topic',
          description: override.customDesc || 'Custom topic request',
          format: 'post',
          category: 'custom',
          captionPreview: override.customCaption || 'Custom topic content',
        };
        status = 'swapped';
      } else {
        assignedTopic = topics[topicIndex % topics.length];
        topicIndex++;
      }
      assignedFormat = override?.format || assignedTopic?.format || 'post';
      if (approvedTopicIds.includes(assignedTopic?.id)) {
        status = override?.status || (override?.topicId ? 'swapped' : 'approved');
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

  return result;
}

// TEST 1: Boundary Test for Brand Names & Types
console.log("\n[TEST 1] Brand Name & Type Handling:");
const brandTestCases = [
  { business_name: 'Mint More', business_type: 'restaurant' },
  { business_name: '', business_type: 'fashion' },
  { business_name: '   ', business_type: 'unknown_type' },
  { business_name: null, business_type: null },
  undefined,
];

brandTestCases.forEach((tc, idx) => {
  const topics = generateTopicsForBrand(tc);
  console.log(`  Case ${idx + 1} (${JSON.stringify(tc)}): Generated ${topics.length} topics. First topic title: "${topics[0]?.title}"`);
});

// TEST 2: Boundary Test for Frequency Values (1, 3, 5, 7)
console.log("\n[TEST 2] Posting Frequency Boundary Conditions (1, 3, 5, 7):");
[1, 3, 5, 7, '1', '3', '5', '7', 0, 10, -1, NaN, undefined].forEach(freq => {
  const form = { posting_frequency: freq };
  const topics = generateTopicsForBrand(form);
  const days = getScheduledDays(form, topics, {}, topics.map(t => t.id));
  const postDays = days.filter(d => d.hasPost);
  console.log(`  Freq: ${String(freq).padStart(9)} => Total Days: 28, Scheduled Post Days: ${postDays.length}`);
});

// TEST 3: Edge Case Test for Empty Topics Array
console.log("\n[TEST 3] Edge Case: Empty Topics Array:");
try {
  const form = { posting_frequency: '3' };
  const days = getScheduledDays(form, [], {}, []);
  const postDays = days.filter(d => d.hasPost);
  console.log(`  Scheduled post days count: ${postDays.length}`);
  console.log(`  First post day assigned topic:`, postDays[0]?.topic);
  if (postDays.length > 0 && postDays[0].topic === undefined) {
    console.log("  ⚠️ VULNERABILITY CONFIRMED: empty topics array results in assignedTopic === undefined. Components rendering day.topic.title without optional chaining will throw uncaught TypeError.");
  }
} catch (err) {
  console.log("  Caught exception:", err.message);
}

// TEST 4: Format Filter Logic Test
console.log("\n[TEST 4] Format Filter Toggling Simulation:");
const sampleForm = { business_name: 'Test Brand', posting_frequency: '5' };
const sampleTopics = generateTopicsForBrand(sampleForm);
const sampleDays = getScheduledDays(sampleForm, sampleTopics, {}, sampleTopics.map(t => t.id));

['all', 'reel', 'carousel', 'post'].forEach(filter => {
  const visible = sampleDays.filter(d => d.hasPost && (filter === 'all' || d.format === filter));
  console.log(`  Filter: "${filter}" => Visible post cards: ${visible.length} / ${sampleDays.filter(d => d.hasPost).length}`);
});

// TEST 5: Swap Modal Logic & Override Test
console.log("\n[TEST 5] Topic Swap Action Simulation:");
const targetDateKey = sampleDays.find(d => d.hasPost)?.dateKey;
console.log(`  Target Date for Swap: ${targetDateKey}`);

// Scenario A: Swap with existing topic
const swapOverrideExisting = {
  [targetDateKey]: { topicId: 'topic-7', status: 'swapped' }
};
const daysAfterSwapA = getScheduledDays(sampleForm, sampleTopics, swapOverrideExisting, sampleTopics.map(t => t.id));
const swappedDayA = daysAfterSwapA.find(d => d.dateKey === targetDateKey);
console.log(`  Swap A (Existing Topic topic-7): Title="${swappedDayA.topic?.title}", Status="${swappedDayA.status}"`);

// Scenario B: Swap with Custom Topic Data
const customId = `custom-123456789`;
const customTopic = { id: customId, title: '20% OFF Anniversary Sale', format: 'post' };
const updatedTopics = [...sampleTopics, customTopic];
const swapOverrideCustom = {
  [targetDateKey]: { topicId: customId, customTitle: customTopic.title, status: 'swapped' }
};
const daysAfterSwapB = getScheduledDays(sampleForm, updatedTopics, swapOverrideCustom, [...sampleTopics.map(t => t.id), customId]);
const swappedDayB = daysAfterSwapB.find(d => d.dateKey === targetDateKey);
console.log(`  Swap B (Custom Topic): Title="${swappedDayB.topic?.title}", Status="${swappedDayB.status}"`);

console.log("\n=========================================");
console.log("  ALL EMPIRICAL TESTS COMPLETED          ");
console.log("=========================================");
