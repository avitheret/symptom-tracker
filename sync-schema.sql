-- ============================================================
-- Cross-device sync table for symptom-tracker
-- Run this once in your Supabase project's SQL editor:
-- https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

create table if not exists public.user_app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state_json jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- Row Level Security: each user can only access their own row
alter table public.user_app_state enable row level security;

create policy "Users can manage their own state"
  on public.user_app_state
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
