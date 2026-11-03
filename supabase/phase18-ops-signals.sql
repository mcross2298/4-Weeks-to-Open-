-- ===========================================================================
-- MC Training — ops signals, phase 1 (phase 18)
-- ops-signals-roadmap.md. Issue #421 named this file phase16; phase16 and
-- phase17 were already taken, so it is phase 18.
--
-- Three tables and one producer, so cross-app loops can react to what just
-- happened rather than only to a schedule:
--   * ops_events        an append-mostly event log.
--   * ops_state         one value per key, one writing app per key.
--   * metric_baselines  a per-athlete median and spread (empty until phase 2).
--
-- Access, deliberately narrow:
--   * An admin (public.admins, the test client_errors uses) may read.
--   * Nobody writes from a client. The grants are revoked as well as RLS being
--     on, so a later permissive policy would not open them by accident. The
--     workout_logs trigger and the service role are the only writers.
--
-- The producer can never cost an athlete a set. A failure inside the trigger
-- is turned into a warning, so the insert into workout_logs still succeeds.
-- The event is lost in that case, which is the right way round.
--
-- Events carry ids and set position only, no weights, reps or exercise names.
--
-- user_id is a column on ops_events (the issue listed it only on
-- metric_baselines) so that phase 13's account deletion stays complete: inside
-- a payload it would survive the account. Nullable, for an event that belongs
-- to no athlete.
--
-- Run ONCE, after phase 17, in the Supabase SQL editor. Agents do not apply
-- migrations. Safe to re-run. To undo, run the block at the foot of this file.
-- ===========================================================================

create table if not exists public.ops_events (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  source_app       text not null check (char_length(source_app) between 1 and 32),
  type             text not null check (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and char_length(type) <= 64),
  payload          jsonb not null default '{}'::jsonb,
  correlation_id   text check (char_length(correlation_id) <= 128),
  idempotency_key  text not null check (char_length(idempotency_key) between 1 and 128),
  status           text not null default 'new' check (status in ('new', 'handled', 'dead')),
  user_id          uuid references auth.users(id) on delete cascade,
  constraint ops_events_once unique (idempotency_key)
);

create index if not exists ops_events_pending_idx on public.ops_events (occurred_at) where status = 'new';
create index if not exists ops_events_user_idx on public.ops_events (user_id);

create table if not exists public.ops_state (
  key         text primary key check (char_length(key) between 1 and 128),
  value       jsonb not null default '{}'::jsonb,
  owner_app   text not null check (char_length(owner_app) between 1 and 32),
  version     bigint not null default 1,
  updated_at  timestamptz not null default now()
);

create table if not exists public.metric_baselines (
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric       text not null check (char_length(metric) between 1 and 64),
  window_days  integer not null check (window_days > 0),
  center       numeric not null,      -- median
  spread       numeric not null check (spread >= 0),      -- median absolute deviation
  n            integer not null check (n >= 0),
  updated_at   timestamptz not null default now(),
  primary key (user_id, metric, window_days)
);

alter table public.ops_events       enable row level security;
alter table public.ops_state        enable row level security;
alter table public.metric_baselines enable row level security;

revoke all on public.ops_events, public.ops_state, public.metric_baselines from anon, authenticated;
grant select on public.ops_events, public.ops_state, public.metric_baselines to authenticated;

drop policy if exists ops_events_admin_read on public.ops_events;
create policy ops_events_admin_read on public.ops_events
  for select to authenticated
  using ((select auth.uid()) in (select admins.user_id from public.admins));

drop policy if exists ops_state_admin_read on public.ops_state;
create policy ops_state_admin_read on public.ops_state
  for select to authenticated
  using ((select auth.uid()) in (select admins.user_id from public.admins));

drop policy if exists metric_baselines_admin_read on public.metric_baselines;
create policy metric_baselines_admin_read on public.metric_baselines
  for select to authenticated
  using ((select auth.uid()) in (select admins.user_id from public.admins));

-- ops_state is single-writer: a key's owning app cannot change, and every
-- write moves version and updated_at, so a reader can tell a value moved.
create or replace function public.ops_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_app is distinct from old.owner_app then
    raise exception 'ops_state key % is owned by %', old.key, old.owner_app;
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ops_state_guard on public.ops_state;
create trigger ops_state_guard
  before update on public.ops_state
  for each row execute function public.ops_state_guard();

-- The producer. AFTER INSERT fires only for a row really inserted, so the
-- client's upsert on workout_logs_set_uniq re-checking a set is not an event.
-- SECURITY DEFINER because the caller is an athlete with no write access to
-- ops_events. search_path is empty, so every name is written in full.
create or replace function public.ops_workout_logged()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    insert into public.ops_events
      (occurred_at, source_app, type, payload, correlation_id, idempotency_key, user_id)
    values (
      new.logged_at, 'training', 'workout.logged',
      jsonb_build_object(
        'log_id', new.id,
        'session_id', new.session_id,
        'set_number', new.set_number,
        'program_id', new.program_id
      ),
      new.session_id, 'workout_logs:' || new.id::text, new.user_id
    )
    on conflict (idempotency_key) do nothing;
  exception when others then
    raise warning 'ops_workout_logged: event not written (%)', sqlstate;
  end;
  return null;
end;
$$;

-- A trigger function needs no EXECUTE grant to fire, and this one must not be
-- reachable as an RPC.
revoke all on function public.ops_workout_logged() from public, anon, authenticated;
revoke all on function public.ops_state_guard() from public, anon, authenticated;

drop trigger if exists ops_workout_logged on public.workout_logs;
create trigger ops_workout_logged
  after insert on public.workout_logs
  for each row execute function public.ops_workout_logged();

-- ROLLBACK (removes the producer first, so logging is untouched):
--   drop trigger if exists ops_workout_logged on public.workout_logs;
--   drop function if exists public.ops_workout_logged();
--   drop table if exists public.ops_events, public.ops_state, public.metric_baselines;
--   drop function if exists public.ops_state_guard();
