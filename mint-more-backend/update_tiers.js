const { query } = require('./src/config/database');

async function updateTiers() {
  try {
    // Basic -> FREE
    await query(
      `UPDATE subscription_tiers SET name = $1, price = $2, features = $3 WHERE name = 'Basic'`,
      ['FREE', 0, JSON.stringify(['mint_ai', 'mintbox_10gb'])]
    );
    
    // Advanced -> SOCIAL
    await query(
      `UPDATE subscription_tiers SET name = $1, price = $2, features = $3 WHERE name = 'Advanced'`,
      ['SOCIAL', 1999, JSON.stringify(['mint_ai', 'social_insights', 'posting', 'calendar_creatives', 'mintbox_100gb'])]
    );
    
    // Premium -> MANAGED BY MMM
    await query(
      `UPDATE subscription_tiers SET name = $1, price = $2, features = $3 WHERE name = 'Premium'`,
      ['MANAGED BY MMM', 9999, JSON.stringify(['mint_ai', 'social_insights', 'posting', 'calendar_creatives', 'custom_requests', 'mintbox_250gb'])]
    );
    
    console.log("Tiers updated successfully!");
  } catch (err) {
    console.error("Error updating tiers:", err);
  }
}

updateTiers();
