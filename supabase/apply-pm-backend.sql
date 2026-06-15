-- =============================================================================
-- apply-pm-backend.sql  —  one-shot setup for the Program Manager backend
-- -----------------------------------------------------------------------------
-- Paste this whole file into the Supabase SQL editor (Dashboard → SQL → New
-- query → Run). It creates EVERY table the app talks to, in dependency order,
-- and is fully idempotent ("create ... if not exists" + "drop policy if
-- exists"), so it is safe to run again.
--
-- It exists because the PM "Publish" and "Save draft" actions were failing with
--   "Could not find the table 'public.naming_overrides' in the schema cache"
--   "Could not find the table 'public.pm_drafts'      in the schema cache"
-- which means the phase 4–7 migrations had never been applied to this project.
--
-- This is a faithful consolidation of:
--   schema.sql, phase2.sql, phase3.sql, phase4-naming.sql,
--   phase4b-exercises.sql, phase5-publish-log.sql, phase6-pm-drafts.sql,
--   phase7-canary.sql
--
-- AFTER running this, make your account an admin (see the very bottom).
-- =============================================================================


-- ── admins — owner allow-list; every write policy below keys off this ───────
create table if not exists admins (
  user_id uuid primary key references auth.users
);


-- ── program_overrides — page-level exercise patches (read-all, admin-write) ─
create table if not exists program_overrides (
  page_id    text not null,
  orig_name  text not null,
  patch      jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users,
  primary key (page_id, orig_name)
);
alter table program_overrides enable row level security;
drop policy if exists read_all on program_overrides;
create policy read_all on program_overrides
  for select using (true);
drop policy if exists admin_write on program_overrides;
create policy admin_write on program_overrides
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );


-- ── user_sync — per-user cross-device localStorage sync (owner of row only) ─
create table if not exists user_sync (
  user_id    uuid not null references auth.users,
  store_key  text not null,
  data       jsonb not null,
  updated_at timestamptz default now(),
  device_id  text,
  primary key (user_id, store_key)
);
alter table user_sync enable row level security;
drop policy if exists own_rows on user_sync;
create policy own_rows on user_sync
  for all
  using      ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );


-- ── published_programs — globally published custom programs (read-all) ──────
create table if not exists published_programs (
  id         text primary key,
  program    jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users
);
alter table published_programs enable row level security;
drop policy if exists read_all on published_programs;
create policy read_all on published_programs
  for select using (true);
drop policy if exists admin_write on published_programs;
create policy admin_write on published_programs
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );


-- ── published_exercises — PM-pushed exercises for all users (read-all) ──────
create table if not exists published_exercises (
  name        text primary key,
  muscle      text not null,
  master      text,
  programs    text[] default '{}',
  added_by    uuid references auth.users,
  created_at  timestamptz default now()
);
alter table published_exercises enable row level security;
drop policy if exists read_all on published_exercises;
create policy read_all on published_exercises
  for select using (true);
drop policy if exists admin_write on published_exercises;
create policy admin_write on published_exercises
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );


-- ── naming_overrides — v2 rename layer (read-all, admin-write) ──────────────
-- This is the table the failing "Publish" writes to.
create table if not exists naming_overrides (
  scope      text        not null,
  scope_id   text        not null,
  patch      jsonb       not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id),
  primary key (scope, scope_id)
);
alter table naming_overrides enable row level security;
drop policy if exists "naming_overrides_read_all" on naming_overrides;
create policy "naming_overrides_read_all" on naming_overrides
  for select using (true);
drop policy if exists "naming_overrides_admin_write" on naming_overrides;
create policy "naming_overrides_admin_write" on naming_overrides
  for all using (
    auth.uid() in (select user_id from admins)
  );


-- ── pm_publish_log — append-only audit/changelog of every publish (admins) ──
create table if not exists pm_publish_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  by        uuid        references auth.users(id),
  section   text        not null,
  scope_id  text        not null,
  action    text        not null,
  patch     jsonb,
  prev      jsonb
);
create index if not exists pm_publish_log_at_idx on pm_publish_log (at desc);
alter table pm_publish_log enable row level security;
drop policy if exists "pm_publish_log_admin_read" on pm_publish_log;
create policy "pm_publish_log_admin_read" on pm_publish_log
  for select using (
    auth.uid() in (select user_id from admins)
  );
drop policy if exists "pm_publish_log_admin_write" on pm_publish_log;
create policy "pm_publish_log_admin_write" on pm_publish_log
  for all using (
    auth.uid() in (select user_id from admins)
  );


-- ── pm_drafts — owner-only cloud draft snapshots (admins only) ──────────────
-- This is the table the failing "Save draft" writes to.
create table if not exists pm_drafts (
  id          bigint generated always as identity primary key,
  name        text        not null,
  doc         jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users(id)
);
create index if not exists pm_drafts_updated_idx on pm_drafts (updated_at desc);
alter table pm_drafts enable row level security;
drop policy if exists "pm_drafts_admin_read" on pm_drafts;
create policy "pm_drafts_admin_read" on pm_drafts
  for select using (
    auth.uid() in (select user_id from admins)
  );
drop policy if exists "pm_drafts_admin_write" on pm_drafts;
create policy "pm_drafts_admin_write" on pm_drafts
  for all using (
    auth.uid() in (select user_id from admins)
  );


-- ── testers — canary recipient allow-list (self-read + admin-manage) ────────
create table if not exists testers (
  user_id  uuid primary key references auth.users(id),
  added_at timestamptz not null default now()
);
alter table testers enable row level security;
drop policy if exists "testers_self_read" on testers;
create policy "testers_self_read" on testers
  for select using (auth.uid() = user_id);
drop policy if exists "testers_admin_all" on testers;
create policy "testers_admin_all" on testers
  for all using (auth.uid() in (select user_id from admins));


-- ── naming_overrides_canary — testers-only naming overlay (never public) ────
create table if not exists naming_overrides_canary (
  scope      text        not null,
  scope_id   text        not null,
  patch      jsonb       not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id),
  primary key (scope, scope_id)
);
alter table naming_overrides_canary enable row level security;
drop policy if exists "canary_read_testers" on naming_overrides_canary;
create policy "canary_read_testers" on naming_overrides_canary
  for select using (
    auth.uid() in (select user_id from testers)
    or auth.uid() in (select user_id from admins)
  );
drop policy if exists "canary_admin_write" on naming_overrides_canary;
create policy "canary_admin_write" on naming_overrides_canary
  for all using (
    auth.uid() in (select user_id from admins)
  );


-- =============================================================================
-- FINAL STEP — make your account an admin (required for Publish / Save draft).
-- 1. Authentication → Users → copy your user UID (you must have logged in once).
-- 2. Uncomment and run, with your UID:
--
--   insert into admins (user_id) values ('00000000-0000-0000-0000-000000000000')
--   on conflict do nothing;
--
-- 3. In the app, fully close & reopen (or pull-to-refresh) so PostgREST reloads
--    its schema cache, then try Publish / Save draft again.
-- =============================================================================
