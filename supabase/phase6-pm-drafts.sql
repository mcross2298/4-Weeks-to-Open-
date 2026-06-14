-- =============================================================================
-- phase6-pm-drafts.sql  —  pm_drafts (Staged rollout R1: draft → live)
-- -----------------------------------------------------------------------------
-- Server-side, owner-only draft snapshots of the PM working copy. Lets the
-- owner save work-in-progress to the cloud (synced across their devices) and
-- promote it to live later, instead of going straight from a single device's
-- localStorage to a Publish.
--
-- `doc` is a full v2 overrides document (the MC_PO working copy):
--   { pages, exercises, programs, splits, badges }  (+ optional version/updated)
--
-- Deliberately a SEPARATE table from naming_overrides / program_overrides so
-- the live read-path that serves every user is untouched: drafts are
-- admin-only (no public read), so a draft can never reach a normal user.
-- Promotion happens client-side: load a draft into the working copy, then the
-- normal Publish writes it to the live tables.
-- =============================================================================

create table if not exists pm_drafts (
  id          bigint generated always as identity primary key,
  name        text        not null,
  doc         jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references auth.users(id)
);

create index if not exists pm_drafts_updated_idx on pm_drafts (updated_at desc);

alter table pm_drafts enable row level security;

create policy "pm_drafts_admin_read" on pm_drafts
  for select using (
    auth.uid() in (select user_id from admins)
  );

create policy "pm_drafts_admin_write" on pm_drafts
  for all using (
    auth.uid() in (select user_id from admins)
  );
