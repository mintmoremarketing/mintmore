const { query } = require('../src/config/database');

async function migrate() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS subscription_tiers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR NOT NULL,
        price NUMERIC NOT NULL DEFAULT 0,
        features JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('subscription_tiers table created.');

    const tiers = await query('SELECT * FROM subscription_tiers');
    if (tiers.rows.length === 0) {
      // Create defaults
      await query(`
        INSERT INTO subscription_tiers (name, price, features) VALUES 
        ('Basic', 0, '["mint_ai"]'),
        ('Middle', 999, '["mint_ai", "social_insights", "posting", "calendar_creatives"]'),
        ('Top', 4999, '["mint_ai", "social_insights", "posting", "custom_requests", "calendar_creatives"]')
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
