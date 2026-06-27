-- ===========================================================================
-- MC Training — user_programs table (phase 8)
-- Stores each user's active program + the date they started it.
-- Run once in the Supabase SQL editor.
-- ===========================================================================

create table if not exists user_programs (
  user_id      uuid primary key references auth.users on delete cascade,
  program_id   text          not null,
  program_name text          not null,
  started_at   timestamptz   not null default now(),
  program_data jsonb,
  updated_at   timestamptz   default now()
);

alter table user_programs enable row level security;

drop policy if exists "user_select_own" on user_programs;
create policy "user_select_own" on user_programs
  for select using (auth.uid() = user_id);

drop policy if exists "user_upsert_own" on user_programs;
create policy "user_upsert_own" on user_programs
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
