-- ===========================================================================
-- MC Training — Phase 3: globally published custom programs
-- Run once in the Supabase SQL editor.
-- ===========================================================================

-- One row per published program. `program` holds the full program JSON in the
-- same shape mc-program-store.js uses ({ id, name, icon, color, weeks, days }),
-- so the client can render and run it with no translation. Same trust model
-- as program_overrides: everyone reads, only admins write.
create table if not exists published_programs (
  id         text primary key,
  program    jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users
);

alter table published_programs enable row level security;

-- Everyone (including logged-out visitors) can READ published programs.
drop policy if exists read_all on published_programs;
create policy read_all on published_programs
  for select using (true);

-- Only admins can INSERT / UPDATE / DELETE.
drop policy if exists admin_write on published_programs;
create policy admin_write on published_programs
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );
