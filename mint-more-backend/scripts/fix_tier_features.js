const { query } = require('../src/config/database');

async function fixTierFeatures() {
  try {
    console.log('Fetching tiers...');
    const result = await query('SELECT id, name, price, features FROM subscription_tiers WHERE price >= 999');
    
    for (const row of result.rows) {
      const features = row.features || [];
      if (!features.includes('calendar_creatives')) {
        features.push('calendar_creatives');
        await query(
          'UPDATE subscription_tiers SET features = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(features), row.id]
        );
        console.log(`Added calendar_creatives to tier ${row.name} (${row.price})`);
      } else {
        console.log(`Tier ${row.name} already has calendar_creatives.`);
      }
    }
    console.log('Done.');
  } catch (err) {
    console.error('Error fixing tiers:', err);
  } finally {
    process.exit(0);
  }
}

fixTierFeatures();
