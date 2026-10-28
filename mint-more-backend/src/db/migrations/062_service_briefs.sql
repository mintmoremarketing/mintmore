-- 062: Per-service client briefs.
-- service_templates.brief_fields holds the questions a client answers before paying
-- (NULL = use the category default from briefFields.js). service_bookings.brief keeps
-- the answers, which become the first message in the order chat.
-- Additive only. No DO $$ blocks and no semicolons inside text, because the
-- runner splits statements on them.

ALTER TABLE service_templates ADD COLUMN IF NOT EXISTS brief_fields JSONB;

ALTER TABLE service_bookings ADD COLUMN IF NOT EXISTS brief JSONB NOT NULL DEFAULT '[]'
