-- Push subscription storage (one per device per user)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  device_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Medication schedules synced from client
CREATE TABLE IF NOT EXISTS medication_schedules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  frequency INT NOT NULL DEFAULT 1,
  interval_hours NUMERIC NOT NULL DEFAULT 24,
  first_dose_time TEXT NOT NULL,
  dose_times TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_window_minutes INT NOT NULL DEFAULT 2,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own schedules"
  ON medication_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Dedup tracker for sent notifications
CREATE TABLE IF NOT EXISTS sent_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id TEXT NOT NULL,
  dose_time TEXT NOT NULL,
  sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, schedule_id, dose_time, sent_date)
);

ALTER TABLE sent_notifications ENABLE ROW LEVEL SECURITY;

-- Index for cron job lookups
CREATE INDEX IF NOT EXISTS idx_schedules_active
  ON medication_schedules(status, notifications_enabled)
  WHERE status = 'active' AND notifications_enabled = true;

-- Cleanup function for old sent_notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM sent_notifications WHERE sent_date < CURRENT_DATE - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
