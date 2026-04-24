-- Migration 004: enable Supabase Realtime on user_app_state
-- Allows the client to receive live postgres_changes events when another
-- device updates the row, triggering an automatic pull without needing a
-- focus/visibility event.

ALTER PUBLICATION supabase_realtime ADD TABLE user_app_state;
