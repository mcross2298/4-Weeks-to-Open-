-- ===========================================================================
-- MC Training — Program Manager backend schema (phase 1)
-- Run once in the Supabase SQL editor.
-- ===========================================================================

-- Owner allowlist: a uid here may publish overrides. After your first
-- magic-link login, find your id in Authentication → Users and run:
--   insert into admins (user_id) values ('<your-user-uuid>');
create table if not exists admins (
  user_id uuid primary key references auth.users
);

-- One row per overridden exercise, keyed by page filename + original name.
-- patch holds any of: { name, sets, rest, note, tempo }.
create table if not exists program_overrides (
  page_id    text not null,
  orig_name  text not null,
  patch      jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users,
  primary key (page_id, orig_name)
);

alter table program_overrides enable row level security;

-- Everyone (including logged-out visitors) can READ overrides.
drop policy if exists read_all on program_overrides;
create policy read_all on program_overrides
  for select using (true);

-- Only admins can INSERT / UPDATE / DELETE.
drop policy if exists admin_write on program_overrides;
create policy admin_write on program_overrides
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );
