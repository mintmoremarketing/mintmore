-- 057: Storefront structure for the fixed-price catalogue.
--   * service_subcategories: sections inside a category page (Reels, YouTube, Thumbnails, ...)
--   * service_templates gains subcategory_id, highlights (About-this-service bullets)
--     and badge (optional admin-set ribbon text, empty by default)
--   * categories used by the storefront, plus a `storefront` settings row that
--     drives the homepage (category tiles + curated rows + FAQs)
-- No DO $$ blocks, so the runner can split statements on semicolons.

CREATE TABLE IF NOT EXISTS service_subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  slug        VARCHAR(120) NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_service_subcategories_category ON service_subcategories (category_id, sort_order);

ALTER TABLE service_templates ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES service_subcategories(id) ON DELETE SET NULL;
ALTER TABLE service_templates ADD COLUMN IF NOT EXISTS highlights JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE service_templates ADD COLUMN IF NOT EXISTS badge VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_service_templates_subcategory ON service_templates (subcategory_id, sort_order);

INSERT INTO categories (name, slug, description, is_active, sort_order) VALUES
  ('Design', 'design', 'Thumbnails, posts, branding, UI, illustration and print design', true, 20),
  ('AI Services', 'ai-service', 'AI-generated videos and avatars', true, 30),
  ('Content Creation', 'content-creation', 'UGC creators who shoot content for your brand', true, 40),
  ('Consultation', 'consultation', 'One-on-one strategy calls with experts', true, 60)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO platform_settings (key, value, description)
VALUES (
  'storefront',
  '{"category_tiles": ["video-editing", "design", "ai-service", "content-creation", "content-writing", "consultation"], "rows": [], "faqs": []}'::jsonb,
  'Homepage layout for the services storefront: category tiles, curated rows and FAQs'
)
ON CONFLICT (key) DO NOTHING
