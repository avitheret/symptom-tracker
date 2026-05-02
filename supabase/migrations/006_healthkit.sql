-- Migration 006: HealthKit bridge tables
--
-- healthkit_tokens : per-user API token used by iOS Shortcuts to authenticate
-- health_metrics   : daily metrics received via the log-healthkit Netlify function

-- ── healthkit_tokens ──────────────────────────────────────────────────────────
-- One row per user.  The token is a random 48-char hex string generated in the app.
-- Shortcuts sends it as a Bearer token so the Netlify function can find the user.

CREATE TABLE IF NOT EXISTS healthkit_tokens (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id),   -- one active token per user
  UNIQUE (token)      -- tokens must be globally unique
);

ALTER TABLE healthkit_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can manage their own token only
CREATE POLICY "own healthkit token" ON healthkit_tokens
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── health_metrics ────────────────────────────────────────────────────────────
-- One row per (user, date, metric type).  ON CONFLICT resolves via UPSERT in
-- the Netlify function (service-role key, bypasses RLS on write).

CREATE TABLE IF NOT EXISTS health_metrics (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  type       TEXT        NOT NULL, -- sleep_hours | resting_hr | steps | hrv | systolic_bp | diastolic_bp
  value      FLOAT       NOT NULL,
  unit       TEXT        NOT NULL  DEFAULT '',
  source     TEXT        NOT NULL  DEFAULT 'ios_shortcuts',
  created_at TIMESTAMPTZ           DEFAULT now(),
  UNIQUE (user_id, date, type)
);

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own metrics
CREATE POLICY "own health metrics select" ON health_metrics
  FOR SELECT
  USING (user_id = auth.uid());
