-- =============================================================================
-- MC Training — pm_clients table (phase 11)
-- Roadmap 4.5: Client roster in PM Mode. Run once in the Supabase SQL editor.
-- -----------------------------------------------------------------------------
-- A PM (admin) assigns a program + macro goals to an existing app user
-- ("existing Supabase identity" — the client must have signed in at least
-- once; pm-lookup-client resolves their email to a user_id before a row can
-- be created here). This table is a SUGGESTION, not a remote-control: the PM
-- can never write into a client's own user_programs/user_sync rows directly
-- (that would need RLS grants letting an admin write into ANY user's private
-- data — a materially bigger permission than anything else in this app,
-- where every existing admin-write policy only ever touches shared/public
-- data). The client reads their own row (read-only) and, if they want it,
-- applies the assignment themselves — an ordinary same-user write into their
-- own data, exactly like every other write in this app.
-- =============================================================================

create table if not exists pm_clients (
  id                    bigint generated always as identity primary key,
  pm_user_id            uuid not null references auth.users(id) on delete cascade,
  client_user_id        uuid not null references auth.users(id) on delete cascade,
  client_email          text not null,
  client_label          text,
  assigned_program_id   text,
  assigned_program_name text,
  assigned_macro_goals  jsonb,          -- { kcal, p, f, c } or null
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (pm_user_id, client_user_id)
);

alter table pm_clients enable row level security;

-- The PM manages their own roster only — mirrors every other admin-write
-- policy in this project (auth.uid() in admins), plus pm_user_id = auth.uid()
-- so one admin can never see or edit another admin's roster.
drop policy if exists pm_clients_admin_all on pm_clients;
create policy pm_clients_admin_all on pm_clients
  for all
  using      ( auth.uid() in (select user_id from admins) and pm_user_id = auth.uid() )
  with check ( auth.uid() in (select user_id from admins) and pm_user_id = auth.uid() );

-- A client may READ ONLY the row(s) where they are the assigned client — lets
-- their own device show "your coach assigned you X" without ever exposing or
-- allowing edits to anyone else's roster entry.
drop policy if exists pm_clients_client_read on pm_clients;
create policy pm_clients_client_read on pm_clients
  for select
  using ( client_user_id = auth.uid() );

create index if not exists pm_clients_pm_idx on pm_clients (pm_user_id);
create index if not exists pm_clients_client_idx on pm_clients (client_user_id);
