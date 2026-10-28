-- 063: Order offers and booking auto-off.
-- users.last_active_at: last authenticated request. Freelancers idle for 24 hours have
-- booking switched off. service_bookings.offered_*: auto-assign offers an order to one
-- freelancer for 30 minutes, and it passes to the next one if they decline or do not answer.
-- Additive only. No DO $$ blocks and no semicolons inside text, because the
-- runner splits statements on them.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS offered_freelancer_id UUID REFERENCES users(id);

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS offered_at TIMESTAMPTZ;

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_service_bookings_open_offers
  ON service_bookings (offer_expires_at)
  WHERE offered_freelancer_id IS NOT NULL AND assignment_status = 'unassigned';

CREATE INDEX IF NOT EXISTS idx_users_available_freelancers
  ON users (last_active_at)
  WHERE role = 'freelancer' AND is_available = true
