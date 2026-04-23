-- Migration 003: add reminder push notification columns + dedup log
-- Extends push_subscriptions to hold the full PushSubscriptionJSON blob
-- and the user's UTC offset (needed by the push-reminders scheduled function).

-- ── 1. Extend push_subscriptions ─────────────────────────────────────────────

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS subscription      JSONB,
  ADD COLUMN IF NOT EXISTS utc_offset_minutes INT NOT NULL DEFAULT 0;

-- ── 2. Dedup log (prevents duplicate pushes within the same minute) ───────────

CREATE TABLE IF NOT EXISTS push_sent_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dedup_key  TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, dedup_key)
);

ALTER TABLE push_sent_log ENABLE ROW LEVEL SECURITY;

-- Service-role key bypasses RLS, so no user-facing policy is needed.
-- Add a permissive service-role policy just in case:
CREATE POLICY "Service role full access"
  ON push_sent_log FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-clean entries older than 2 days (keeps the table tiny)
CREATE INDEX IF NOT EXISTS idx_push_sent_log_created
  ON push_sent_log (created_at);
