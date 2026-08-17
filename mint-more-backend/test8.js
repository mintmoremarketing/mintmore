const socialService = require('./src/modules/social/social.service');
const { dbClient } = require('./src/db');
const { validateCreatePost } = require('./src/modules/social/social.validator');

async function test() {
  try {
    const userId = '6ea800be-df70-4fb7-b4d1-1af447efb854';
    
    const payload = {
      title: 'Test Onboarding Post',
      caption: 'Draft post about Product Updates',
      status: 'draft',
      content_type: 'image',
      publish_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      target_platforms: ['facebook']
    };
    
    validateCreatePost(payload);
    console.log("Validation passed!");
    
    const res = await socialService.createPost(userId, payload);
    console.log("Created post:", res);
  } catch (err) {
    console.error("Failed!", err);
  } finally {
    process.exit(0);
  }
}
test();
