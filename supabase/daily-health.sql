-- ==========================================================================
-- daily-health.sql — the daily_health table, written down
-- (engine-repair roadmap Phase 3.3; audit P2-06)
-- --------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
--
-- daily_health is real, live and RLS-protected, and TWO files in this
-- directory already ALTER its policies (rls-perf-hardening.sql,
-- phase12-launch-hardening.sql) — but nothing here has ever DEFINED it. The
-- table exists only in the database. That is the actual gap: a table whose
-- security is version-controlled while its shape is not, so nobody reading
-- this repository can see what the policies are protecting.
--
-- This file is the definition, transcribed from the live table rather than
-- from memory (columns, the unique constraint, the ON DELETE CASCADE and all
-- four policies were read out of pg_catalog on 2026-09-10). It is written
-- idempotently so applying it to the existing database is a no-op.
--
-- WHAT THE AUDIT GOT WRONG, recorded so it is not re-derived
--
-- P2-06 reads: "The daily_health table, its unique constraint and a correct
-- upsert function are all in place and unused while the app keeps THE SAME
-- DATA in a browser store. Point the client at it or retire it — do not leave
-- two homes for one signal."
--
-- Three corrections, all measured against the live database:
--
--   1. There is NO upsert function. No health-related function exists in
--      `public` at all. The unique constraint IS real.
--
--   2. It is not the same signal. Every column here is DEVICE-measured —
--      steps, resting heart rate, HRV, sleep hours, active calories — while
--      mc_vitals_v1 is a MANUAL self-report: { restingHr, sleepHrs,
--      readiness, source:'manual' }. Two of five fields overlap; `readiness`
--      is subjective and has no device equivalent, and steps / hrv_ms /
--      active_calories have no manual equivalent. The store's own
--      source:'manual' field is the design anticipating a second source.
--
--   3. So this is not a duplicate home. It is the table for the WEARABLE
--      ingest that flagship-immersive-roadmap.md's H3 explicitly deferred:
--      "a Shortcuts-bridge/Web Bluetooth path for HR/HRV/sleep is explicitly
--      flagged as needing a platform-support spike before being scoped as
--      committed, not assumed". The table was created ahead of that client.
--
-- DECISION (owner, 2026-09-10): keep it and write it down. Retiring it was
-- offered and declined; wiring the manual store into it was rejected because
-- it would put self-reported values into device-shaped columns, leave three
-- of them permanently null, and contradict H3's locked decision. Zero rows
-- today, and no writer anywhere — not in the app, not in an Edge Function.
--
-- Apply: paste into the Supabase SQL editor. Safe to re-run.
-- ==========================================================================

create table if not exists public.daily_health (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade,
  date                date not null,
  steps               integer,
  resting_heart_rate  integer,
  hrv_ms              numeric,
  sleep_hours         numeric,
  active_calories     integer,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- One row per user per day. This is what an upsert would conflict on, if and
-- when a wearable client is built to do the upserting.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.daily_health'::regclass
      and conname = 'daily_health_user_id_date_key'
  ) then
    alter table public.daily_health
      add constraint daily_health_user_id_date_key unique (user_id, date);
  end if;
end $$;

alter table public.daily_health enable row level security;

-- Four policies, one per verb. DELETE was added by phase12-launch-hardening.sql
-- (audit P2-05) — without it a user could not erase their own health data,
-- which is a deletion-rights problem, not a convenience one. The
-- `(select auth.uid())` form is deliberate: rls-perf-hardening.sql rewrote
-- every policy this way so the function is evaluated once per statement
-- instead of once per row.
drop policy if exists "Users can read own health data"   on public.daily_health;
create policy "Users can read own health data"   on public.daily_health
  for select using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own health data" on public.daily_health;
create policy "Users can insert own health data" on public.daily_health
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own health data" on public.daily_health;
create policy "Users can update own health data" on public.daily_health
  for update using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own health data" on public.daily_health;
create policy "Users can delete own health data" on public.daily_health
  for delete using ((select auth.uid()) = user_id);

-- Verify (expect 10 columns, 3 constraints, 4 policies):
--   select column_name from information_schema.columns
--     where table_name = 'daily_health' order by ordinal_position;
--   select conname from pg_constraint where conrelid = 'public.daily_health'::regclass;
--   select polname, polcmd from pg_policy p join pg_class c on c.oid = p.polrelid
--     where c.relname = 'daily_health';
