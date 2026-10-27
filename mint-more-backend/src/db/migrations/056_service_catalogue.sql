-- ── Migration: 056_service_catalogue.sql ─────────────────────────────────────
-- Fixed-price service catalogue (Unjob-style): admin-defined templates with
-- variants/packs, freelancer opt-ins, cart checkouts and per-item bookings.
-- Each paid booking is backed by a jobs row so escrow, chat, Mintbox delivery,
-- revisions and reviews are reused unchanged.
-- No DO $$ blocks: the runner splits this file on semicolons.

-- 1. Notification types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_booked';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_unassigned';

-- 2. Categories used by the launch catalogue (reuses the marketplace table)
INSERT INTO categories (name, slug, description, sort_order)
VALUES ('UGC Creation', 'ugc-creation', 'Creator-shot UGC videos', 12)
ON CONFLICT (slug) DO NOTHING;

-- 3. Service templates
CREATE TABLE IF NOT EXISTS service_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                VARCHAR(120) NOT NULL UNIQUE,
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  title               VARCHAR(200) NOT NULL,
  summary             VARCHAR(300),
  description         TEXT,
  unit_label          VARCHAR(60) NOT NULL DEFAULT 'Deliverable',
  option_group_label  VARCHAR(80),
  revisions           INTEGER NOT NULL DEFAULT 3 CHECK (revisions >= 0),
  includes            JSONB NOT NULL DEFAULT '[]',
  excludes            JSONB NOT NULL DEFAULT '[]',
  tools               TEXT[] NOT NULL DEFAULT '{}',
  faqs                JSONB NOT NULL DEFAULT '[]',
  requirements_hint   TEXT,
  cover_url           TEXT,
  gallery             JSONB NOT NULL DEFAULT '[]',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_templates_category
  ON service_templates(category_id, is_active, sort_order);

DROP TRIGGER IF EXISTS service_templates_updated_at ON service_templates;
CREATE TRIGGER service_templates_updated_at
  BEFORE UPDATE ON service_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Variants: one row per option x pack size, each with its own price
CREATE TABLE IF NOT EXISTS service_variants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        UUID NOT NULL REFERENCES service_templates(id) ON DELETE CASCADE,
  option_label       VARCHAR(80) NOT NULL DEFAULT 'Standard',
  pack_size          INTEGER NOT NULL DEFAULT 1 CHECK (pack_size >= 1),
  price              NUMERIC(12,2) NOT NULL CHECK (price > 0),
  mrp                NUMERIC(12,2) CHECK (mrp IS NULL OR mrp >= price),
  freelancer_payout  NUMERIC(12,2) NOT NULL CHECK (freelancer_payout >= 0),
  delivery_days      INTEGER NOT NULL DEFAULT 1 CHECK (delivery_days >= 1),
  is_default         BOOLEAN NOT NULL DEFAULT false,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_variants_payout_le_price CHECK (freelancer_payout <= price),
  CONSTRAINT service_variants_unique UNIQUE (template_id, option_label, pack_size)
);

CREATE INDEX IF NOT EXISTS idx_service_variants_template
  ON service_variants(template_id, is_active);

DROP TRIGGER IF EXISTS service_variants_updated_at ON service_variants;
CREATE TRIGGER service_variants_updated_at
  BEFORE UPDATE ON service_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Freelancer opt-ins: who may be auto-assigned to a template
CREATE TABLE IF NOT EXISTS freelancer_service_optins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id    UUID NOT NULL REFERENCES service_templates(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT freelancer_service_optins_unique UNIQUE (freelancer_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_freelancer_service_optins_template
  ON freelancer_service_optins(template_id, is_active);

DROP TRIGGER IF EXISTS freelancer_service_optins_updated_at ON freelancer_service_optins;
CREATE TRIGGER freelancer_service_optins_updated_at
  BEFORE UPDATE ON freelancer_service_optins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. Checkouts: one payment covering a whole cart
CREATE TABLE IF NOT EXISTS service_checkouts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subtotal             NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  gst_rate             NUMERIC(5,2) NOT NULL DEFAULT 18,
  gst_amount           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  total                NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  gstin                VARCHAR(15),
  status               VARCHAR(20) NOT NULL DEFAULT 'created'
                         CHECK (status IN ('created', 'paid', 'failed', 'cancelled')),
  payment_mode         VARCHAR(20) NOT NULL DEFAULT 'razorpay'
                         CHECK (payment_mode IN ('razorpay', 'mock')),
  razorpay_order_id    VARCHAR(100) UNIQUE,
  razorpay_payment_id  VARCHAR(100) UNIQUE,
  idempotency_key      VARCHAR(160) UNIQUE,
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_checkouts_client
  ON service_checkouts(client_id, created_at DESC);

DROP TRIGGER IF EXISTS service_checkouts_updated_at ON service_checkouts;
CREATE TRIGGER service_checkouts_updated_at
  BEFORE UPDATE ON service_checkouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Bookings: one per cart line. Progress after assignment is derived from the
-- backing job + Mintbox state, so only payment/assignment state lives here.
CREATE SEQUENCE IF NOT EXISTS service_booking_number_seq START 10001;

CREATE TABLE IF NOT EXISTS service_bookings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number           VARCHAR(20) NOT NULL UNIQUE
                             DEFAULT ('CRV-' || nextval('service_booking_number_seq')),
  checkout_id              UUID NOT NULL REFERENCES service_checkouts(id) ON DELETE CASCADE,
  client_id                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id              UUID NOT NULL REFERENCES service_templates(id),
  variant_id               UUID NOT NULL REFERENCES service_variants(id),
  quantity                 INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 20),
  snapshot                 JSONB NOT NULL DEFAULT '{}',
  instructions             TEXT,
  preferred_freelancer_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  unit_price               NUMERIC(12,2) NOT NULL,
  subtotal                 NUMERIC(12,2) NOT NULL,
  gst_amount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  freelancer_payout        NUMERIC(12,2) NOT NULL,
  platform_fee             NUMERIC(12,2) NOT NULL,
  job_id                   UUID UNIQUE REFERENCES jobs(id) ON DELETE SET NULL,
  freelancer_id            UUID REFERENCES users(id) ON DELETE SET NULL,
  assignment_status        VARCHAR(20) NOT NULL DEFAULT 'pending_payment'
                             CHECK (assignment_status IN ('pending_payment', 'unassigned', 'assigned', 'cancelled')),
  paid_at                  TIMESTAMPTZ,
  assigned_at              TIMESTAMPTZ,
  due_at                   TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_bookings_client
  ON service_bookings(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_bookings_freelancer
  ON service_bookings(freelancer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_bookings_assignment
  ON service_bookings(assignment_status);
CREATE INDEX IF NOT EXISTS idx_service_bookings_checkout
  ON service_bookings(checkout_id);

DROP TRIGGER IF EXISTS service_bookings_updated_at ON service_bookings;
CREATE TRIGGER service_bookings_updated_at
  BEFORE UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 8. Platform settings for the services flow
INSERT INTO platform_settings (key, value)
VALUES ('services', '{"gst_rate": 18, "max_quantity": 20}')
ON CONFLICT (key) DO NOTHING;
