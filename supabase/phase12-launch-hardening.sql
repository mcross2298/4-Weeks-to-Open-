-- ===========================================================================
-- MC Training — launch hardening (phase 12)
-- engine-repair-roadmap.md Phase 0.4. Closes audit L-08, P2-04, P2-05, EN-6.
-- Run once in the Supabase SQL editor.
--
-- Measured against the live database before this was written, not assumed:
--   workout_logs   125 rows, 4 duplicate groups, 5 surplus rows
--   user_sync      FOREIGN KEY (user_id) REFERENCES auth.users(id)
--                  -- the only one of the five without ON DELETE CASCADE
--   daily_health   3 policies: INSERT, SELECT, UPDATE. No DELETE.
--
-- Step 1 deletes rows. Read it before running it.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Make set inserts idempotent (audit EN-6).
--
-- Unchecking a set removes the tick but deletes neither the local entry nor
-- the cloud row, and re-checking inserts a SECOND row. The table has no
-- uniqueness constraint, so a mistyped weight is permanent and permanently
-- wins the all-time maximum used for personal records and cross-device
-- prefill. Deduplicate FIRST: adding the constraint to live data that already
-- contains duplicates fails.
--
-- Keeps the highest id in each group, i.e. the most recently written value,
-- which is the one the athlete last confirmed.
-- ---------------------------------------------------------------------------
delete from public.workout_logs a
 using public.workout_logs b
 where a.id > b.id
   and a.user_id = b.user_id
   and a.session_id = b.session_id
   and a.exercise = b.exercise
   and a.set_number = b.set_number;

alter table public.workout_logs
  add constraint workout_logs_set_uniq
  unique (user_id, session_id, exercise, set_number);

-- ---------------------------------------------------------------------------
-- 2. Unblock account deletion (audit P2-04).
--
-- Deleting a user with sync rows raises a foreign-key violation, so the
-- account cannot be removed at all. Every other table already cascades.
-- ---------------------------------------------------------------------------
alter table public.user_sync drop constraint user_sync_user_id_fkey;
alter table public.user_sync
  add constraint user_sync_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 3. Let a user delete their own health rows (audit P2-05).
--
-- The table has insert, select and update policies and no delete policy, so a
-- mistaken or unwanted health row can be written and read forever but never
-- removed.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can delete own health data" on public.daily_health;
create policy "Users can delete own health data" on public.daily_health
  for delete using ((select auth.uid()) = user_id);

commit;

-- ---------------------------------------------------------------------------
-- Verification — expect: 0 duplicate groups, a CASCADE on user_sync, and four
-- policies on daily_health.
-- ---------------------------------------------------------------------------
-- select count(*) from (
--   select user_id, session_id, exercise, set_number
--   from public.workout_logs group by 1,2,3,4 having count(*) > 1) d;
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'user_sync_user_id_fkey';
-- select cmd, policyname from pg_policies
--  where schemaname='public' and tablename='daily_health' order by cmd;

-- ---------------------------------------------------------------------------
-- NOT in this migration, deliberately.
--
-- Leaked-password protection (audit EN-13) is an Auth project SETTING, not
-- SQL. It is turned on in the dashboard under Authentication -> Policies, and
-- is listed in the roadmap's Phase 1 step 6 rather than pretended to be
-- covered here.
--
-- The empty muscle and program_id columns (audit EN-2, all 125 live rows) are
-- roadmap Phase 1 step 4. Backfilling them needs the classifier reconciliation
-- from Phase 2, so filling them now would bake in the taxonomy the audit
-- found unreliable.
-- ---------------------------------------------------------------------------
