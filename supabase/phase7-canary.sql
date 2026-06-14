-- =============================================================================
-- phase7-canary.sql  —  canary audience (Staged rollout R2)
-- -----------------------------------------------------------------------------
-- Lets the owner publish naming changes to a subset of real users (testers)
-- first, verify in production, then promote to everyone — without a build.
--
-- Two new tables, kept SEPARATE from the live naming_overrides so the
-- read-all live path that serves every user is untouched:
--   testers                 — allow-list of canary recipients
--   naming_overrides_canary — testers-only overlay (same shape as naming_overrides)
--
-- Canary rows are visible ONLY to testers + admins (RLS). For everyone else the
-- client's getCanaryNaming() returns nothing, so the overlay is a no-op.
-- Promotion (canary → live) happens client-side: copy rows into naming_overrides,
-- then clear canary.
--
-- Scope note: this version canaries the v2 NAMING sections (exercises /
-- programs / splits / badges). Page-level (program_overrides) edits still
-- publish straight to live; a program_overrides_canary mirror is a follow-up.
-- =============================================================================

create table if not exists testers (
  user_id  uuid primary key references auth.users(id),
  added_at timestamptz not null default now()
);

alter table testers enable row level security;

-- a user may see their own tester row (so the client can tell if it's a tester);
-- admins manage the list.
create policy "testers_self_read" on testers
  for select using (auth.uid() = user_id);

create policy "testers_admin_all" on testers
  for all using (auth.uid() in (select user_id from admins));

create table if not exists naming_overrides_canary (
  scope      text        not null,
  scope_id   text        not null,
  patch      jsonb       not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id),
  primary key (scope, scope_id)
);

alter table naming_overrides_canary enable row level security;

-- visible only to testers + admins (NEVER the general public)
create policy "canary_read_testers" on naming_overrides_canary
  for select using (
    auth.uid() in (select user_id from testers)
    or auth.uid() in (select user_id from admins)
  );

create policy "canary_admin_write" on naming_overrides_canary
  for all using (
    auth.uid() in (select user_id from admins)
  );
