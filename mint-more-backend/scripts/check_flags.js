const { query } = require('../src/config/database');

async function run() {
  try {
    const res = await query(`SELECT value FROM platform_settings WHERE key = 'feature_flags'`);
    console.log(res.rows[0]);
    
    // reset to empty or false to enforce tiers
    if (res.rows[0]) {
      const flags = res.rows[0].value;
      flags.calendar_creatives = false;
      flags.custom_requests = false;
      flags.mintbox = false;
      flags.chat = false;
      flags.social_insights = false;
      flags.mint_ai = false;
      flags.posting = false;
      await query(`UPDATE platform_settings SET value = $1 WHERE key = 'feature_flags'`, [flags]);
      console.log('updated DB feature_flags to false');
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
