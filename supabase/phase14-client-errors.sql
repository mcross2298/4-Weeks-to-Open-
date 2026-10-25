-- ===========================================================================
-- MC Training — client error beacon (phase 14)
-- flagship-readiness-roadmap.md phase E, defect D-35: field errors never left
-- the device. Every page's head-boot script (tools/apply-head-contract.py)
-- keeps the last 20 window 'error' / 'unhandledrejection' events in
-- localStorage mc_errors_v1, and nothing ever read them off the phone.
--
-- Owner's decision (2026-10-24): a new table, signed-in athletes only.
-- mc-error-beacon.js sends new entries from Home, at most every 10 minutes.
--
-- Extended in place (phase S5, 2026-10-25) — this file had not been applied
-- (verified against information_schema: no client_errors table), so there is
-- no live table to migrate. Owner's decision that day: ONE table, not a
-- second app_telemetry_logs, and sending is OPT-IN, default off
-- (mc_prefs_v1.telemetry, the "Send error reports" switch in the account
-- sheet). Two additions: a `stack` column, and two more kinds the device now
-- records — 'storage' (a write the browser refused) and 'network' (a sync
-- pull/push that failed), plus 'note' for anything else MC_ERRLOG.rec() is
-- handed.
--
-- Shape of the policy, deliberately narrow:
--   * INSERT only, and only a row whose user_id is the caller's own.
--   * No SELECT, UPDATE or DELETE for an athlete: a sent error is not read
--     back on the device. Admins (the existing public.admins table, the same
--     test pm_publish_log uses) may read.
--   * Length checks on every text column, so a runaway message cannot fill
--     the table; the client also truncates before sending.
--   * One row per (user, fingerprint, occurred_at): a resend of the same
--     event is a no-op (the client upserts with ignoreDuplicates).
--   * ON DELETE CASCADE from auth.users, so account deletion (phase 13)
--     stays complete.
-- ===========================================================================

create table if not exists public.client_errors (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid()
               references auth.users(id) on delete cascade,
  app          text not null default 'training' check (char_length(app) <= 32),
  occurred_at  timestamptz not null,
  received_at  timestamptz not null default now(),
  kind         text not null check (kind in ('error', 'unhandledrejection', 'storage', 'network', 'note')),
  message      text not null check (char_length(message) <= 500),
  stack        text check (char_length(stack) <= 1200),
  source       text check (char_length(source) <= 300),
  line         integer,
  page         text check (char_length(page) <= 120),
  platform     text check (char_length(platform) <= 40),
  fingerprint  text not null check (char_length(fingerprint) <= 64),
  constraint client_errors_once unique (user_id, fingerprint, occurred_at)
);

create index if not exists client_errors_received_idx on public.client_errors (received_at desc);
create index if not exists client_errors_fp_idx on public.client_errors (fingerprint);

alter table public.client_errors enable row level security;

drop policy if exists client_errors_insert_own on public.client_errors;
create policy client_errors_insert_own on public.client_errors
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists client_errors_admin_read on public.client_errors;
create policy client_errors_admin_read on public.client_errors
  for select to authenticated
  using ((select auth.uid()) in (select admins.user_id from public.admins));
