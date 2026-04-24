-- Migration 005: fix push_subscriptions so save-push-subscription can insert rows.
--
-- The original table (migration 001) had p256dh TEXT NOT NULL and auth TEXT NOT NULL
-- with no defaults. The Netlify save-push-subscription function only inserts
-- (user_id, endpoint, subscription, utc_offset_minutes), causing a NOT NULL
-- violation that silently blocks all subscriptions from being saved.
--
-- Fix: make those columns nullable — the data lives in subscription JSONB anyway.
-- Also idempotently ensure the new columns and push_sent_log table exist.

-- 1. Drop NOT NULL from legacy key columns (safe if already nullable)
ALTER TABLE push_subscriptions
  ALTER COLUMN p256dh DROP NOT NULL,
  ALTER COLUMN auth   DROP NOT NULL;

-- 2. Ensure new columns exist (idempotent — migration 003 may have already added them)
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS subscription       JSONB,
  ADD COLUMN IF NOT EXISTS utc_offset_minutes INT NOT NULL DEFAULT 0;

-- 3. Ensure push_sent_log exists for notification dedup
CREATE TABLE IF NOT EXISTS push_sent_log (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dedup_key  TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, dedup_key)
);

ALTER TABLE push_sent_log ENABLE ROW LEVEL SECURITY;
