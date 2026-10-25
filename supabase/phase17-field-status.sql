-- ===========================================================================
-- MC Training — triage status driven by GitHub labels (phase 17)
-- field-feedback-roadmap.md FB5. Adds the one status a report could not hold
-- yet — 'needs_decision', set when the weekly review asks the owner a
-- question — and gives crash types (client_error_issues) the same status
-- column reports already have, so the Field log reads both the same way.
--
-- Written only by the field-reports Edge Function (service role). Safe to run
-- more than once. Run AFTER phase 15 and phase 16.
-- ===========================================================================

alter table public.client_reports drop constraint if exists client_reports_status_check;
alter table public.client_reports add constraint client_reports_status_check
  check (status in ('new', 'filed', 'fixing', 'needs_decision', 'fixed', 'wontfix', 'duplicate'));

alter table public.client_error_issues add column if not exists status text not null default 'filed';
alter table public.client_error_issues drop constraint if exists client_error_issues_status_check;
alter table public.client_error_issues add constraint client_error_issues_status_check
  check (status in ('filed', 'fixing', 'needs_decision', 'fixed', 'wontfix'));

-- Crash types already resolved under phase 16 read as fixed, not filed.
update public.client_error_issues set status = 'fixed'
 where resolved_at is not null and status = 'filed';
