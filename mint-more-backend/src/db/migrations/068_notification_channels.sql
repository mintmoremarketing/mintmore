CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  push BOOLEAN NOT NULL DEFAULT true,
  email BOOLEAN NOT NULL DEFAULT true,
  whatsapp BOOLEAN NOT NULL DEFAULT false,
  whatsapp_phone VARCHAR(20),
  whatsapp_opt_in_at TIMESTAMPTZ,
  quiet_start SMALLINT CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end SMALLINT CHECK (quiet_end BETWEEN 0 AND 23),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((quiet_start IS NULL) = (quiet_end IS NULL)),
  CHECK (quiet_start IS NULL OR quiet_start <> quiet_end)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_dispatch_jobs (
  notification_id UUID PRIMARY KEY REFERENCES notifications(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS notification_dispatch_pending ON notification_dispatch_jobs(created_at) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'whatsapp')),
  target_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','sent','delivered','read','failed','skipped')),
  provider_id TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE(notification_id, channel, target_key)
);
CREATE INDEX IF NOT EXISTS notification_deliveries_pending ON notification_deliveries(available_at) WHERE status IN ('queued','failed','processing');
CREATE INDEX IF NOT EXISTS notification_deliveries_provider ON notification_deliveries(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_deliveries_user ON notification_deliveries(user_id, created_at DESC);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_dispatch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION enqueue_notification_dispatch() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_dispatch_jobs(notification_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notifications_enqueue_external') THEN
    CREATE TRIGGER notifications_enqueue_external AFTER INSERT ON notifications
    FOR EACH ROW EXECUTE FUNCTION enqueue_notification_dispatch();
  END IF;
END $$;
