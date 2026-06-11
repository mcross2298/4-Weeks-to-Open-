-- ===========================================================================
-- MC Training — Phase 2: cross-device sync of a user's training data
-- Run once in the Supabase SQL editor.
-- ===========================================================================

-- One row per (user, store). `data` holds the whole localStorage blob for that
-- store; mc-sync.js merges per type. RLS keys everything to the signed-in user,
-- so this is multi-user ready: the owner syncs today, and any future user
-- account syncs their own rows with no further changes.
create table if not exists user_sync (
  user_id    uuid not null references auth.users,
  store_key  text not null,
  data       jsonb not null,
  updated_at timestamptz default now(),
  device_id  text,
  primary key (user_id, store_key)
);

alter table user_sync enable row level security;

-- A user can only ever see and write their OWN rows.
drop policy if exists own_rows on user_sync;
create policy own_rows on user_sync
  for all
  using      ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );
