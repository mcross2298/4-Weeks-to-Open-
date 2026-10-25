-- ===========================================================================
-- MC Training — field triage bookkeeping (phase 16)
-- field-feedback-roadmap.md FB2. The `field-reports` Edge Function files one
-- GitHub issue per crash TYPE (client_errors.fingerprint); this table is how
-- it remembers which fingerprints already have an issue and how many
-- occurrences that issue has been told about, so the hourly run comments on
-- the existing issue instead of opening a duplicate.
--
-- Reports (client_reports, phase 15) track their own issue_number, so they
-- need nothing here.
--
-- Written only by the Edge Function, which uses the service role (bypasses
-- RLS). Admins may read it; nobody else can see it at all.
-- Safe to run more than once. Run AFTER phase 14 and phase 15.
-- ===========================================================================

create table if not exists public.client_error_issues (
  fingerprint    text primary key check (char_length(fingerprint) <= 64),
  issue_number   integer not null,
  reported_count integer not null default 0,
  last_seen      timestamptz,
  filed_at       timestamptz not null default now(),
  resolved_at    timestamptz
);

alter table public.client_error_issues enable row level security;

drop policy if exists client_error_issues_admin_read on public.client_error_issues;
create policy client_error_issues_admin_read on public.client_error_issues
  for select to authenticated
  using ((select auth.uid()) in (select admins.user_id from public.admins));
