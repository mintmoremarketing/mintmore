const { query } = require('../src/config/database');

async function migrate() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS subscription_tiers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        price NUMERIC NOT NULL DEFAULT 0,
        annual_price NUMERIC DEFAULT 0,
        monthly_credits NUMERIC DEFAULT 0,
        features JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        razorpay_plan_id VARCHAR,
        annual_razorpay_plan_id VARCHAR,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('subscription_tiers table created.');

    const tiers = await query('SELECT * FROM subscription_tiers');
    if (tiers.rows.length === 0) {
      // Create defaults
      await query(`
        INSERT INTO subscription_tiers (name, price, annual_price, monthly_credits, features) VALUES 
        ('FREE', 0, 0, 1000, '["mint_ai", "mintbox_10gb"]'),
        ('SOCIAL', 1999, 20388, 10000, '["mint_ai", "social_insights", "posting", "calendar_creatives", "mintbox_100gb"]'),
        ('MANAGED BY MMM', 9999, 95988, 10000, '["mint_ai", "social_insights", "posting", "calendar_creatives", "custom_requests", "mintbox_250gb"]')
      `);
      console.log('Default tiers inserted.');
    }

    try {
      await query(`ALTER TABLE memberships ADD COLUMN tier_id UUID REFERENCES subscription_tiers(id)`);
      console.log('Added tier_id to memberships.');
    } catch (err) {
      if (err.code !== '42701') { // duplicate_column
        throw err;
      }
      console.log('tier_id column already exists.');
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
