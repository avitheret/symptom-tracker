-- Supplement schedules synced from client (mirrors medication_schedules pattern)
CREATE TABLE IF NOT EXISTS supplement_schedules (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT,
  time_window TEXT,                -- 'morning' | 'breakfast' | 'lunch' | 'dinner' | 'bed'
  reminder_time TEXT,              -- 'HH:MM' explicit time (used when no timeWindow)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_window_minutes INT NOT NULL DEFAULT 2,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplement_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own supplement schedules"
  ON supplement_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_supplement_schedules_active
  ON supplement_schedules(status, notifications_enabled)
  WHERE status = 'active' AND notifications_enabled = true;

-- pg_cron: call Edge Function every minute
-- NOTE: Run these manually in Supabase SQL editor after enabling pg_cron + pg_net extensions
-- SELECT cron.schedule(
--   'push-med-reminders',
--   '* * * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.edge_function_url') || '/send-push-notifications',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := '{}'::jsonb
--   ) AS request_id;
--   $$
-- );
