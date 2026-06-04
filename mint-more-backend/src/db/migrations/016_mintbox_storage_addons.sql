ALTER TYPE addon_feature ADD VALUE IF NOT EXISTS 'mintbox_storage';

ALTER TABLE addon_plans
  ADD COLUMN IF NOT EXISTS storage_gb INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_addon_plans_storage
  ON addon_plans(storage_gb)
  WHERE storage_gb > 0;

INSERT INTO addon_plans
  (name, description, price, duration_days, features, storage_gb, is_featured, sort_order)
VALUES
  (
    'Mintbox +10 GB',
    'Adds 10 GB of project storage to your Mintbox.',
    199, 30,
    ARRAY['mintbox_storage']::addon_feature[],
    10,
    false, 20
  ),
  (
    'Mintbox +50 GB',
    'Adds 50 GB of project storage for larger deliverables and active campaigns.',
    699, 30,
    ARRAY['mintbox_storage']::addon_feature[],
    50,
    true, 21
  )
ON CONFLICT DO NOTHING;
