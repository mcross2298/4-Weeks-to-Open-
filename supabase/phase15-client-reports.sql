-- ===========================================================================
-- MC Training — athlete & owner problem reports (phase 15)
-- field-feedback-roadmap.md FB1. client_errors (phase 14) holds what the app
-- itself caught; this table holds what a PERSON reports: "the timer didn't
-- beep", "this button is hard to hit". Written by mc-report.js's
-- "Report a problem" sheet.
--
-- Owner's decisions (2026-10-25): athletes and the owner both report; reports
-- become REDACTED GitHub issues (the repository is public), so `message` never
-- leaves this table except to an admin; a scheduled Claude session fixes; the
-- reporter sees the outcome (status) back in the app.
--
-- Policy shape:
--   * INSERT: only your own row, only as status 'new' with no triage fields.
--   * SELECT: your own rows (so the app can show "Fixed"), plus admins.
--   * UPDATE: admins only. The FB2 Edge Function uses the service role, which
--     bypasses RLS, to record issue numbers and status.
--   * No DELETE for anyone but the service role / account deletion (CASCADE).
--   * One row per (user, client_id): a resend from the device's outbox is a
--     no-op (the client upserts with ignoreDuplicates).
-- Safe to run more than once.
-- ===========================================================================

create table if not exists public.client_reports (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid()
                  references auth.users(id) on delete cascade,
  client_id       text not null check (char_length(client_id) between 8 and 64),
  created_at      timestamptz not null,
  received_at     timestamptz not null default now(),
  app             text not null default 'training' check (char_length(app) <= 32),
  category        text not null check (category in ('bug', 'friction', 'idea')),
  severity        text not null check (severity in ('blocker', 'annoying', 'minor')),
  message         text not null check (char_length(message) between 1 and 2000),
  page            text check (char_length(page) <= 120),
  workout_page    text check (char_length(workout_page) <= 120),
  program         text check (char_length(program) <= 40),
  build           text check (char_length(build) <= 80),
  platform        text check (char_length(platform) <= 40),
  error_fps       text[] check (coalesce(array_length(error_fps, 1), 0) <= 5),
  status          text not null default 'new'
                  check (status in ('new', 'filed', 'fixing', 'fixed', 'wontfix', 'duplicate')),
  issue_number    integer,
  resolved_at     timestamptz,
  resolution_note text check (char_length(resolution_note) <= 300),
  constraint client_reports_once unique (user_id, client_id)
);

create index if not exists client_reports_status_idx on public.client_reports (status, received_at);
create index if not exists client_reports_user_idx on public.client_reports (user_id, created_at desc);

alter table public.client_reports enable row level security;

drop policy if exists client_reports_insert_own on public.client_reports;
create policy client_reports_insert_own on public.client_reports
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'new' and issue_number is null
    and resolved_at is null and resolution_note is null
  );

drop policy if exists client_reports_read_own on public.client_reports;
create policy client_reports_read_own on public.client_reports
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select auth.uid()) in (select admins.user_id from public.admins)
  );

drop policy if exists client_reports_admin_update on public.client_reports;
create policy client_reports_admin_update on public.client_reports
  for update to authenticated
  using ((select auth.uid()) in (select admins.user_id from public.admins))
  with check ((select auth.uid()) in (select admins.user_id from public.admins));
