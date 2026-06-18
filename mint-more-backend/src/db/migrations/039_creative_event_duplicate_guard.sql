-- Prevent duplicate monthly creative opportunities when admins publish batches.
-- A duplicate is the same normalized title for the same month and asset type.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        month_key,
        asset_type,
        LOWER(REGEXP_REPLACE(TRIM(title), '\s+', ' ', 'g'))
      ORDER BY
        CASE WHEN status = 'published' THEN 0 ELSE 1 END,
        event_date DESC,
        created_at DESC
    ) AS rn
  FROM creative_events
)
UPDATE creative_events event
SET
  status = 'archived',
  metadata = COALESCE(event.metadata, '{}'::jsonb) || '{"archived_reason":"duplicate_monthly_calendar_event"}'::jsonb
FROM ranked
WHERE event.id = ranked.id
  AND ranked.rn > 1
  AND event.status <> 'archived';

CREATE UNIQUE INDEX IF NOT EXISTS idx_creative_events_unique_month_title_asset
  ON creative_events (
    month_key,
    asset_type,
    LOWER(REGEXP_REPLACE(TRIM(title), '\s+', ' ', 'g'))
  )
  WHERE status <> 'archived';
