-- =============================================================================
-- MC Training — RLS performance hardening + pg_trgm schema move
-- Applied directly to the live project (dhlxmoyjfxohbeiexwnr) via the
-- Supabase MCP tools; this file is the durable record, not the execution
-- mechanism. Kept for history alongside the other supabase/*.sql files.
-- -----------------------------------------------------------------------------
-- Closes out the repository audit's Complex Work Supabase findings for
-- 4-Weeks-to-Open- / MC-Training-Rolodex:
--   - 23 auth_rls_initplan WARNs (auth.uid() re-evaluated per row instead of
--     once per query)
--   - 50 multiple_permissive_policies WARNs, reduced to 10 (the only ones
--     left — pm_clients and testers — are genuinely necessary: two real,
--     non-redundant access paths per table, not simplifiable)
--   - 7 unindexed_foreign_keys WARNs
--   - 1 extension_in_public security WARN (pg_trgm)
--
-- Every policy rewrite below was checked against the real pg_policies /
-- pg_constraint definitions first, not written from assumption. Two
-- redundancy patterns showed up repeatedly and are called out per-table:
--   (a) an admin-only ALL policy whose SELECT contribution was already
--       fully covered by a separate, broader (or equal) SELECT policy —
--       narrowed to INSERT/UPDATE/DELETE only, since Postgres's CREATE
--       POLICY doesn't accept a comma-separated FOR list, so this becomes
--       three single-command policies per table, not one;
--   (b) a SELECT-only policy whose condition was byte-identical to an ALL
--       policy already on the same table — fully redundant, dropped.
-- =============================================================================

-- ---- (a) narrow admin ALL policies whose SELECT half is already covered
-- naming_overrides: read_all's qual is `true`, so admin_write contributed
-- nothing extra on SELECT.
drop policy "naming_overrides_admin_write" on public.naming_overrides;
create policy "naming_overrides_admin_write_ins" on public.naming_overrides
  for insert
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "naming_overrides_admin_write_upd" on public.naming_overrides
  for update
  using ((select auth.uid()) in (select admins.user_id from admins))
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "naming_overrides_admin_write_del" on public.naming_overrides
  for delete
  using ((select auth.uid()) in (select admins.user_id from admins));

-- naming_overrides_canary: canary_read_testers's OR already includes the
-- admin condition.
drop policy "canary_admin_write" on public.naming_overrides_canary;
create policy "canary_admin_write_ins" on public.naming_overrides_canary
  for insert
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "canary_admin_write_upd" on public.naming_overrides_canary
  for update
  using ((select auth.uid()) in (select admins.user_id from admins));
create policy "canary_admin_write_del" on public.naming_overrides_canary
  for delete
  using ((select auth.uid()) in (select admins.user_id from admins));
alter policy "canary_read_testers" on public.naming_overrides_canary
  using (
    ((select auth.uid()) in (select testers.user_id from testers))
    or ((select auth.uid()) in (select admins.user_id from admins))
  );

-- program_overrides / published_exercises / published_programs: identical
-- admin-ALL-vs-read_all(true) pattern as naming_overrides.
drop policy "admin_write" on public.program_overrides;
create policy "admin_write_ins" on public.program_overrides
  for insert
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "admin_write_upd" on public.program_overrides
  for update
  using ((select auth.uid()) in (select admins.user_id from admins))
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "admin_write_del" on public.program_overrides
  for delete
  using ((select auth.uid()) in (select admins.user_id from admins));

drop policy "admin_write" on public.published_exercises;
create policy "admin_write_ins" on public.published_exercises
  for insert
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "admin_write_upd" on public.published_exercises
  for update
  using ((select auth.uid()) in (select admins.user_id from admins))
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "admin_write_del" on public.published_exercises
  for delete
  using ((select auth.uid()) in (select admins.user_id from admins));

drop policy "admin_write" on public.published_programs;
create policy "admin_write_ins" on public.published_programs
  for insert
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "admin_write_upd" on public.published_programs
  for update
  using ((select auth.uid()) in (select admins.user_id from admins))
  with check ((select auth.uid()) in (select admins.user_id from admins));
create policy "admin_write_del" on public.published_programs
  for delete
  using ((select auth.uid()) in (select admins.user_id from admins));

-- ---- (b) drop SELECT policies fully redundant with an ALL policy on the
--      same table (byte-identical condition)
drop policy "pm_drafts_admin_read" on public.pm_drafts;
drop policy "pm_publish_log_admin_read" on public.pm_publish_log;
drop policy "user_select_own" on public.user_programs;

-- ---- rewrap every remaining auth.uid() call as (select auth.uid())
alter policy "admin_self_read" on public.admins
  using ((select auth.uid()) = user_id);
alter policy "Users can insert own health data" on public.daily_health
  with check ((select auth.uid()) = user_id);
alter policy "Users can read own health data" on public.daily_health
  using ((select auth.uid()) = user_id);
alter policy "Users can update own health data" on public.daily_health
  using ((select auth.uid()) = user_id);
alter policy "pm_clients_admin_all" on public.pm_clients
  using (
    ((select auth.uid()) in (select admins.user_id from admins))
    and (pm_user_id = (select auth.uid()))
  )
  with check (
    ((select auth.uid()) in (select admins.user_id from admins))
    and (pm_user_id = (select auth.uid()))
  );
alter policy "pm_clients_client_read" on public.pm_clients
  using (client_user_id = (select auth.uid()));
alter policy "pm_drafts_admin_write" on public.pm_drafts
  using ((select auth.uid()) in (select admins.user_id from admins));
alter policy "pm_publish_log_admin_write" on public.pm_publish_log
  using ((select auth.uid()) in (select admins.user_id from admins));
alter policy "user_rls" on public.push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "testers_admin_all" on public.testers
  using ((select auth.uid()) in (select admins.user_id from admins));
alter policy "testers_self_read" on public.testers
  using ((select auth.uid()) = user_id);
alter policy "user_upsert_own" on public.user_programs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "own_rows" on public.user_sync
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy "user_rls" on public.workout_logs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---- unindexed_foreign_keys: covering indexes, column names confirmed
--      against pg_constraint first
create index if not exists naming_overrides_updated_by_idx
  on public.naming_overrides (updated_by);
create index if not exists naming_overrides_canary_updated_by_idx
  on public.naming_overrides_canary (updated_by);
create index if not exists pm_drafts_updated_by_idx
  on public.pm_drafts (updated_by);
create index if not exists pm_publish_log_by_idx
  on public.pm_publish_log ("by");
create index if not exists program_overrides_updated_by_idx
  on public.program_overrides (updated_by);
create index if not exists published_exercises_added_by_idx
  on public.published_exercises (added_by);
create index if not exists published_programs_updated_by_idx
  on public.published_programs (updated_by);

-- ---- extension_in_public: move pg_trgm out of public
-- Confirmed safe before applying: exactly one dependent object
-- (foods_name_trgm, a gin index on public.foods.name) — operator classes
-- are OID-referenced, so existing indexes are unaffected by a schema move.
-- The standard Supabase `extensions` schema already exists in this project
-- and is already first in the default search_path ("$user", public,
-- extensions), so unqualified trigram calls (similarity(), the % operator)
-- keep resolving with no application-code change. Verified post-move with
-- a live similarity() call.
alter extension pg_trgm set schema extensions;
