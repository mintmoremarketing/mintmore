-- One-time testing grant for every client account that exists when this runs.
-- Idempotent: the metadata marker prevents repeated runs from extending access.
INSERT INTO memberships (
  user_id,
  status,
  current_period_start,
  current_period_end,
  auto_renew,
  metadata
)
SELECT
  id,
  'active',
  NOW(),
  NOW() + INTERVAL '30 days',
  false,
  jsonb_build_object(
    'testing_access_grant_2026_06', true,
    'testing_access_granted_at', NOW()
  )
FROM users
WHERE role = 'client'
ON CONFLICT (user_id) DO UPDATE
SET
  status = 'active',
  current_period_start = NOW(),
  current_period_end = GREATEST(
    COALESCE(memberships.current_period_end, NOW()),
    NOW() + INTERVAL '30 days'
  ),
  paused_at = NULL,
  cancelled_at = NULL,
  auto_renew = false,
  metadata = memberships.metadata || jsonb_build_object(
    'testing_access_grant_2026_06', true,
    'testing_access_granted_at', NOW()
  )
WHERE NOT (memberships.metadata ? 'testing_access_grant_2026_06');
