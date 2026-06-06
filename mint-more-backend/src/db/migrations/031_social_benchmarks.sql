INSERT INTO platform_settings (key, value, description)
VALUES (
  'social_benchmarks',
  '{"engagement_rate_percent":3,"summary_days":30}'::JSONB,
  'Plain-language social analytics benchmark controls'
)
ON CONFLICT (key) DO NOTHING;

