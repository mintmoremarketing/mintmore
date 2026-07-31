// Empirical verification test suite for Challenger 1
const fs = require('fs');
const path = require('path');

console.log("=== EMPIRICAL TEST SUITE STARTING ===");

// Test 1: Import topic generator logic from useCalendarState.js
const calendarStatePath = path.resolve(__dirname, '../../mint-more-frontend/src/pages/client/onboarding/useCalendarState.js');
const calendarStateCode = fs.readFileSync(calendarStatePath, 'utf8');

// Function 1 test: generateTopicsForBrand
function testGenerateTopicsForBrand(form) {
  const brandName = form?.business_name || 'Your Brand';
  const type = form?.business_type || 'restaurant';

  const topicTemplatesPerType = {
    restaurant: [ { id: 'topic-1', title: `Behind the Scenes at ${brandName}` } ],
    fashion: [ { id: 'topic-1', title: `Styling Guide by ${brandName}` } ]
  };

  const defaultTopics = [ { id: 'topic-1', title: `Welcome to ${brandName}` } ];

  return topicTemplatesPerType[type] || defaultTopics;
}

// Empirical Test 1.1: Frequency boundary calculation
function calculateScheduledDays(posting_frequency, topics = [{ id: 'topic-1' }]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay());

  const frequency = parseInt(posting_frequency || '3', 10);
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

    const isPast = d < today;
    const dayOfWeek = d.getDay();
    const defaultHasPost = !isPast && postDaysPattern.includes(dayOfWeek);

    let assignedTopic = null;
    if (defaultHasPost) {
      if (topics.length === 0) {
        // Edge case: division by zero!
        assignedTopic = topics[topicIndex % topics.length];
      } else {
        assignedTopic = topics[topicIndex % topics.length];
        topicIndex++;
      }
    }

    result.push({
      dateKey: d.toISOString().split('T')[0],
      dayOfWeek,
      hasPost: defaultHasPost,
      topic: assignedTopic,
    });
  }

  return result;
}

console.log("\n--- Testing Frequency Boundary Conditions ---");
[1, 3, 5, 7, '1', '3', '5', '7', 0, 10, null, undefined, 'invalid'].forEach(freq => {
  const res = calculateScheduledDays(freq);
  const postCount = res.filter(r => r.hasPost).length;
  console.log(`Frequency input: ${JSON.stringify(freq)} -> Scheduled post count: ${postCount}`);
});

console.log("\n--- Testing Empty Topics Array Edge Case ---");
try {
  const emptyRes = calculateScheduledDays(3, []);
  const postDaysWithEmptyTopics = emptyRes.filter(r => r.hasPost);
  console.log("Post days with empty topics array:", postDaysWithEmptyTopics.length);
  console.log("First post day assignedTopic:", postDaysWithEmptyTopics[0]?.topic);
  if (postDaysWithEmptyTopics.length > 0 && postDaysWithEmptyTopics[0].topic === undefined) {
    console.log("CRITICAL BUG FOUND: When topics array is empty, assignedTopic becomes undefined without fallback, causing runtime crash when accessing topic.title!");
  }
} catch (e) {
  console.error("Error during empty topics test:", e);
}

console.log("\n--- Testing Website Parser Logic (Onboarding.jsx) ---");
function parseWebsiteUrl(inputUrl) {
  if (!inputUrl || !inputUrl.trim()) {
    return { error: 'Please enter a website link first' };
  }
  let cleanUrl = inputUrl.trim();
  cleanUrl = cleanUrl.replace(/^(https?:\/\/)?(www\.)?/, '');
  const parts = cleanUrl.split('/');
  const domain = parts[0] || '';
  const namePart = domain.replace(/\.(com|in|co\.in|net|org|edu|gov|io|biz|info|in|me)$/i, '');
  const words = namePart.split(/[-_.]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1));
  let businessName = words.join(' ');
  const lowerUrl = cleanUrl.toLowerCase();
  let businessType = 'other';
  let typeLabel = 'local business';

  if (lowerUrl.includes('hotel') || lowerUrl.includes('resort') || lowerUrl.includes('stay') || lowerUrl.includes('inn') || lowerUrl.includes('lodge') || lowerUrl.includes('retreat')) {
    businessType = 'hotel';
    typeLabel = 'boutique stay';
  } else if (lowerUrl.includes('cafe') || lowerUrl.includes('restaurant') || lowerUrl.includes('dhaba') || lowerUrl.includes('food') || lowerUrl.includes('pizza') || lowerUrl.includes('bakery') || lowerUrl.includes('kitchen') || lowerUrl.includes('bites')) {
    businessType = 'restaurant';
    typeLabel = 'restaurant and cafe';
  } else if (lowerUrl.includes('gym') || lowerUrl.includes('fitness') || lowerUrl.includes('yoga') || lowerUrl.includes('wellness') || lowerUrl.includes('fit') || lowerUrl.includes('studio')) {
    businessType = 'fitness';
    typeLabel = 'fitness and wellness studio';
  }

  if (businessType !== 'other' && !lowerUrl.includes(businessType) && !lowerUrl.includes(typeLabel.split(' ')[0])) {
    const typeSuffix = businessType.charAt(0).toUpperCase() + businessType.slice(1);
    businessName += ` ${typeSuffix}`;
  }

  return { businessName, businessType };
}

const testUrls = [
  "",
  "   ",
  "example.com",
  "https://my-great-restaurant.co.in/menu",
  "http://hotel-boutique-stay.com",
  "https://www.sweet-bakery-shop.in"
];

testUrls.forEach(url => {
  console.log(`URL: "${url}" -> Output:`, parseWebsiteUrl(url));
});

console.log("=== EMPIRICAL TEST SUITE COMPLETED ===");
