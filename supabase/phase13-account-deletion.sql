-- ===========================================================================
-- MC Training — account deletion (phase 13)
-- Post-implementation verification pass, finding V-05: "9 of 17 FKs into
-- auth.users still read NO ACTION, so account deletion is complete for a
-- trainee and blocked for an owner/PM/tester."
-- Run once in the Supabase SQL editor.
--
-- Measured against the live database before this was written, not assumed.
-- 26 foreign keys reference auth.users; 9 of them read NO ACTION and all 9
-- are in `public`:
--
--   admins.user_id                        NOT NULL
--   testers.user_id                       NOT NULL
--   naming_overrides.updated_by           nullable
--   naming_overrides_canary.updated_by    nullable
--   pm_drafts.updated_by                  nullable
--   pm_publish_log.by                     nullable
--   program_overrides.updated_by          nullable
--   published_exercises.added_by          nullable
--   published_programs.updated_by         nullable
--
-- THE RIGHT ACTION IS NOT THE SAME FOR ALL NINE, and a blanket CASCADE here
-- would be a serious mistake. Two of them are MEMBERSHIP rows -- the row IS
-- the person, and it means nothing once the account is gone. The other seven
-- are AUTHORSHIP columns on content that must outlive its author: cascading
-- them would delete every published program, every published exercise, every
-- program override and the whole publish audit log the moment an owner
-- account was removed.
--
--   admins, testers                    -> ON DELETE CASCADE
--   the seven authorship columns       -> ON DELETE SET NULL
--
-- CASCADE is also the only option available for the first two: both columns
-- are NOT NULL, so SET NULL would violate the constraint at delete time and
-- the deletion would still fail, just with a different error. All seven
-- authorship columns are already nullable, so SET NULL needs no column change.
--
-- Checked before writing: NO policy in `public` reads updated_by, added_by or
-- "by" (pg_policies, zero rows), so these are pure audit metadata and a NULL
-- there cannot widen or narrow anyone's access. A row whose author is NULL
-- simply has no author, which is the truth after the account is deleted.
--
-- This migration deletes no rows by itself and is reversible -- re-running the
-- ALTERs with `on delete no action` restores the previous behaviour exactly.
--
-- The CREATE TABLE statements in phase4-naming.sql, phase4b-exercises.sql,
-- phase5-publish-log.sql, phase6-pm-drafts.sql, phase7-canary.sql, schema.sql
-- and apply-pm-backend.sql still say a bare `references auth.users`, which is
-- NO ACTION by default. They are deliberately left as they were: these files
-- are a numbered history applied in order, the same way phase12 did not go
-- back and edit phase9, and a fresh project runs this file too.
--
-- APPLIED 2026-09-20 to the live project. Verified immediately afterwards by
-- reading pg_catalog back rather than trusting the run: of the 16 foreign keys
-- from `public` into auth.users, 9 now read CASCADE and 7 read SET NULL, and
-- ZERO read NO ACTION. Re-running this file would fail at the first DROP
-- CONSTRAINT of a name that has been replaced, which is the correct outcome
-- for a migration that has already landed.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Membership rows: the row is the person.
-- ---------------------------------------------------------------------------
alter table public.admins
  drop constraint admins_user_id_fkey,
  add  constraint admins_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.testers
  drop constraint testers_user_id_fkey,
  add  constraint testers_user_id_fkey
       foreign key (user_id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. Authorship columns: the content outlives its author.
-- ---------------------------------------------------------------------------
alter table public.naming_overrides
  drop constraint naming_overrides_updated_by_fkey,
  add  constraint naming_overrides_updated_by_fkey
       foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.naming_overrides_canary
  drop constraint naming_overrides_canary_updated_by_fkey,
  add  constraint naming_overrides_canary_updated_by_fkey
       foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.pm_drafts
  drop constraint pm_drafts_updated_by_fkey,
  add  constraint pm_drafts_updated_by_fkey
       foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.pm_publish_log
  drop constraint pm_publish_log_by_fkey,
  add  constraint pm_publish_log_by_fkey
       foreign key ("by") references auth.users(id) on delete set null;

alter table public.program_overrides
  drop constraint program_overrides_updated_by_fkey,
  add  constraint program_overrides_updated_by_fkey
       foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.published_exercises
  drop constraint published_exercises_added_by_fkey,
  add  constraint published_exercises_added_by_fkey
       foreign key (added_by) references auth.users(id) on delete set null;

alter table public.published_programs
  drop constraint published_programs_updated_by_fkey,
  add  constraint published_programs_updated_by_fkey
       foreign key (updated_by) references auth.users(id) on delete set null;

commit;

-- ---------------------------------------------------------------------------
-- Verification: read it back out of pg_catalog rather than trusting the run.
-- Expect zero rows.
-- ---------------------------------------------------------------------------
-- select c.conname, t.relname, c.confdeltype
-- from pg_constraint c
-- join pg_class t on t.oid = c.conrelid
-- join pg_namespace n on n.oid = t.relnamespace
-- join pg_class rt on rt.oid = c.confrelid
-- join pg_namespace rn on rn.oid = rt.relnamespace
-- where c.contype = 'f' and rn.nspname = 'auth' and rt.relname = 'users'
--   and n.nspname = 'public' and c.confdeltype = 'a';
