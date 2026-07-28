const { query } = require('../src/config/database');

async function main() {
  try {
    const featureFlags = {
      chat: false,
      mint_ai: false,
      mintbox: false,
      posting: false,
      wallet_ui: false,
      marketplace: false,
      negotiation: false,
      internal_ops: true,
      custom_requests: false,
      social_insights: false,
      freelancer_portal: false,
      calendar_creatives: true, // Set to true for smoke tests!
      freelancer_matching: false
    };
    
    await query('UPDATE platform_settings SET value = $1 WHERE key = $2', [featureFlags, 'feature_flags']);
    console.log('Successfully updated feature_flags in platform_settings');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
main();
