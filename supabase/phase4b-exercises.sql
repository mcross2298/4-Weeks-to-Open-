-- ===========================================================================
-- MC Training — published custom exercises table
-- Run once in the Supabase SQL editor (after schema.sql).
-- Allows PM/admin to push new exercises to all users without a redeploy.
-- ===========================================================================

create table if not exists published_exercises (
  name        text primary key,
  muscle      text not null,
  master      text,
  programs    text[] default '{}',
  added_by    uuid references auth.users,
  created_at  timestamptz default now()
);

alter table published_exercises enable row level security;

-- Everyone (including logged-out visitors) can READ published exercises.
drop policy if exists read_all on published_exercises;
create policy read_all on published_exercises
  for select using (true);

-- Only admins can INSERT / UPDATE / DELETE.
drop policy if exists admin_write on published_exercises;
create policy admin_write on published_exercises
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );
