-- ===========================================================================
-- MC Training — push_subscriptions table (phase 10)
-- Stores Web Push subscriptions per user for milestone notifications.
-- Run once in the Supabase SQL editor.
-- ===========================================================================

create table if not exists push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid         not null references auth.users on delete cascade,
  endpoint    text         not null unique,
  p256dh      text         not null,
  auth        text         not null,
  created_at  timestamptz  not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "user_rls" on push_subscriptions;
create policy "user_rls" on push_subscriptions
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast user subscription lookup
create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);
