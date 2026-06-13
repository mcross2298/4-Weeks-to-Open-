-- =============================================================================
-- phase4-naming.sql  —  naming_overrides table (Phase 1: v2 rename layer)
-- -----------------------------------------------------------------------------
-- Stores PM-published name overrides for exercises, programs, splits, badges.
-- Keyed by (scope, scope_id) where scope is one of:
--   'exercise' | 'program' | 'split' | 'badge'
-- and scope_id is the original name/ID string.
--
-- patch is a JSONB object, typically { "name": "..." } or { "reset": true }.
--
-- RLS mirrors program_overrides: anyone can read; only admins can write.
-- =============================================================================

create table if not exists naming_overrides (
  scope      text        not null,
  scope_id   text        not null,
  patch      jsonb       not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id),
  primary key (scope, scope_id)
);

alter table naming_overrides enable row level security;

create policy "naming_overrides_read_all" on naming_overrides
  for select using (true);

create policy "naming_overrides_admin_write" on naming_overrides
  for all using (
    auth.uid() in (select user_id from admins)
  );
