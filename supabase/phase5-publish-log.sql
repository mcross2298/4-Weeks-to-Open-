-- =============================================================================
-- phase5-publish-log.sql  —  pm_publish_log (Process & history: H1 + H2)
-- -----------------------------------------------------------------------------
-- Append-only audit/changelog of every PM publish. Powers:
--   • H2 — an auto-changelog (what changed, when, by whom)
--   • H1 — "restore a prior published value" (each row keeps `prev`, the value
--          that was live before this publish overwrote it)
--
-- One row per published override op. Keyed loosely by (section, scope_id):
--   section  : 'pages' | 'exercises' | 'programs' | 'splits' | 'badges' | 'catalog'
--   scope_id : 1-level sections -> the key (origName / progId / exercise name)
--              2-level sections -> "outer|inner"
--                pages  -> "pageId|origName"
--                splits -> "progId|origSplit"
--                badges -> "progScope|badgeId"   (progScope may be 'global')
--   action   : 'upsert' | 'remove'
--   patch    : the published patch (null for remove)
--   prev     : the value that was published before this op (null if none) — for H1 restore
--
-- Owner-only: this is an internal operator log, so reads AND writes are
-- restricted to admins (unlike naming_overrides, whose reads are open).
-- =============================================================================

create table if not exists pm_publish_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  by        uuid        references auth.users(id),
  section   text        not null,
  scope_id  text        not null,
  action    text        not null,
  patch     jsonb,
  prev      jsonb
);

create index if not exists pm_publish_log_at_idx on pm_publish_log (at desc);

alter table pm_publish_log enable row level security;

create policy "pm_publish_log_admin_read" on pm_publish_log
  for select using (
    auth.uid() in (select user_id from admins)
  );

create policy "pm_publish_log_admin_write" on pm_publish_log
  for all using (
    auth.uid() in (select user_id from admins)
  );
