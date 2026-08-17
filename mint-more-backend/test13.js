const { getCalendarPosts } = require('./src/modules/social/social.service');

async function test() {
  try {
    const res = await getCalendarPosts('6ea800be-df70-4fb7-b4d1-1af447efb854', { month: '2026-08' });
    console.log("Calendar posts:", res.length);
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    process.exit(0);
  }
}
test();
