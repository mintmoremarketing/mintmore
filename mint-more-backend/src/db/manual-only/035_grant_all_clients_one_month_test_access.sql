-- MANUAL-ONLY TESTING GRANT.
--
-- Do not place this file in src/db/migrations.
-- It grants every existing client account 30 days of active access and is
-- intended only for controlled testing resets.
--
-- To run intentionally, execute this file manually after setting:
--   SET app.confirm_test_access_grant = 'I_UNDERSTAND_THIS_GRANTS_TEST_ACCESS';
--
DO $$
BEGIN
  IF current_setting('app.confirm_test_access_grant', true) IS DISTINCT FROM
     'I_UNDERSTAND_THIS_GRANTS_TEST_ACCESS' THEN
    RAISE EXCEPTION
      'Refusing to run manual test-access grant. Set app.confirm_test_access_grant explicitly to continue.';
  END IF;
END $$;

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
