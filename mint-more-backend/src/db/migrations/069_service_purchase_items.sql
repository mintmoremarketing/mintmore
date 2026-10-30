-- ── Migration: 069_service_purchase_items.sql ────────────────────────────────
-- Multi-item purchases: a cart line worth more than one item (a pack, or a
-- quantity above 1) becomes a purchase group with one row per item. Each item
-- gets its own brief, and only becomes a booking + job (and starts matching)
-- once its brief is submitted. Single-item lines keep the existing flow.
-- Additive only: new tables, new nullable columns.
-- No DO $$ blocks: the runner splits this file on semicolons.

-- 1. Purchase groups: one per multi-item cart line. Holds the purchase-time
-- service details and the paid amounts for every item in it.
CREATE TABLE IF NOT EXISTS service_purchase_groups (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id              UUID NOT NULL REFERENCES service_checkouts(id) ON DELETE CASCADE,
  client_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id              UUID NOT NULL REFERENCES service_templates(id),
  variant_id               UUID NOT NULL REFERENCES service_variants(id),
  quantity                 INTEGER NOT NULL CHECK (quantity >= 1),
  item_count               INTEGER NOT NULL CHECK (item_count >= 2 AND item_count <= 10),
  snapshot                 JSONB NOT NULL DEFAULT '{}',
  instructions             TEXT,
  preferred_freelancer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  subtotal                 NUMERIC(12,2) NOT NULL,
  gst_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  freelancer_payout        NUMERIC(12,2) NOT NULL,
  platform_fee             NUMERIC(12,2) NOT NULL,
  paid_at                  TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_purchase_groups_client
  ON service_purchase_groups(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_purchase_groups_checkout
  ON service_purchase_groups(checkout_id);

DROP TRIGGER IF EXISTS service_purchase_groups_updated_at ON service_purchase_groups;
CREATE TRIGGER service_purchase_groups_updated_at
  BEFORE UPDATE ON service_purchase_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Purchase items: each item's share of the group's amounts, allocated in
-- paise so the items add up exactly to the group. An item's money stays here,
-- outside the client's wallet, until a freelancer is assigned to its booking.
CREATE TABLE IF NOT EXISTS service_purchase_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES service_purchase_groups(id) ON DELETE CASCADE,
  client_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_index         INTEGER NOT NULL CHECK (item_index >= 1),
  subtotal           NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  gst_amount         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  freelancer_payout  NUMERIC(12,2) NOT NULL CHECK (freelancer_payout >= 0),
  platform_fee       NUMERIC(12,2) NOT NULL CHECK (platform_fee >= 0),
  status             VARCHAR(20) NOT NULL DEFAULT 'pending_payment'
                       CHECK (status IN ('pending_payment', 'ready', 'submitted', 'refunding', 'refunded')),
  brief              JSONB NOT NULL DEFAULT '[]',
  instructions       TEXT,
  booking_id         UUID UNIQUE,
  submitted_at       TIMESTAMPTZ,
  refunded_at        TIMESTAMPTZ,
  refunded_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  refund_reference   VARCHAR(100),
  refund_note        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_purchase_items_index_unique UNIQUE (group_id, item_index)
);

CREATE INDEX IF NOT EXISTS idx_service_purchase_items_client
  ON service_purchase_items(client_id, status);
CREATE INDEX IF NOT EXISTS idx_service_purchase_items_status
  ON service_purchase_items(status);

DROP TRIGGER IF EXISTS service_purchase_items_updated_at ON service_purchase_items;
CREATE TRIGGER service_purchase_items_updated_at
  BEFORE UPDATE ON service_purchase_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Bookings created from a purchase item. matching_held_at is set while the
-- client's brief files are still uploading; matching skips the booking until it
-- is cleared (or the hold goes stale).
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS purchase_item_id UUID UNIQUE REFERENCES service_purchase_items(id) ON DELETE SET NULL;
ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS matching_held_at TIMESTAMPTZ;

ALTER TABLE service_purchase_items DROP CONSTRAINT IF EXISTS service_purchase_items_booking_fk;
ALTER TABLE service_purchase_items ADD CONSTRAINT service_purchase_items_booking_fk
  FOREIGN KEY (booking_id) REFERENCES service_bookings(id) ON DELETE SET NULL;
