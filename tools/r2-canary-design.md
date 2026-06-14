# R2 — Canary audience (design, for review before build)

Status: **DESIGN — not yet implemented.** R1 (server-side drafts → promote) ships
in the same PR; R2 is the riskier half and needs sign-off because it changes the
**live override read-path that serves every user**.

## Goal

Publish a change to a **subset of real users (testers)** first, verify in
production, then promote it to everyone — without a separate build.

## Why this is the risky one

Every other PM feature either touches owner-only tables (`pm_drafts`,
`pm_publish_log`) or paints from the existing live tables unchanged. Canary
requires the **live read-path** (`naming_overrides` / `program_overrides`, read
by all users) to return *different rows depending on who is asking*. A mistake
in that RLS or the client merge could:

- leak unfinished canary changes to all users, or
- hide live overrides from normal users (app shows original names everywhere).

So it must be done deliberately, with testing in a dev project, not shipped blind.

## Proposed approach (separate-table, mirrors R1's safety)

Keep `naming_overrides` / `program_overrides` (live, read-all) **untouched**.
Add parallel **canary** storage + a **testers** allow-list:

```sql
create table if not exists testers (
  user_id uuid primary key references auth.users(id)
);
alter table testers enable row level security;
create policy "testers_self_read"  on testers for select using (auth.uid() = user_id);
create policy "testers_admin_all"   on testers for all   using (auth.uid() in (select user_id from admins));

create table if not exists naming_overrides_canary (
  scope text not null, scope_id text not null, patch jsonb not null default '{}',
  updated_at timestamptz default now(), updated_by uuid references auth.users(id),
  primary key (scope, scope_id)
);
alter table naming_overrides_canary enable row level security;
-- visible ONLY to testers + admins (never to the general public):
create policy "canary_read_testers" on naming_overrides_canary for select using (
  auth.uid() in (select user_id from testers) or auth.uid() in (select user_id from admins)
);
create policy "canary_admin_write" on naming_overrides_canary for all using (
  auth.uid() in (select user_id from admins)
);
```
(A `program_overrides_canary` mirrors this for page-level edits if needed.)

## Client (mc-supabase.js + program-overrides.js)

- `getCanaryNaming()` — same shape as `getNaming()`, reads `naming_overrides_canary`.
  RLS returns rows only for testers/admins; everyone else gets an empty set, so
  the call is safe to make unconditionally (it simply yields nothing for normal
  users).
- `program-overrides.js` published-load: after loading live `published`, also
  fetch canary and **overlay it on top of live** (canary wins) — but only the
  rows RLS returned, so normal users are unaffected. This is the one change to
  the live paint path; it must be additive and fail-open (canary fetch error →
  ignore, keep live).

## PM UI (program-manager.js)

- Publish sheet (W4 selective) gains an audience choice: **Canary (testers)**
  vs **Everyone (live)**. Canary writes to the `*_canary` tables; live writes to
  the existing tables (today's behavior).
- A **"Promote canary → live"** action copies canary rows into the live tables
  and clears canary.
- A small **testers** manager (add/remove user ids) — or manage in Supabase
  directly for v1.

## Acceptance / testing (must do in a dev project)

1. As a non-tester user: canary changes are **invisible**; live overrides paint
   normally.
2. As a tester: canary overlays live; toggling tester membership flips it.
3. Promote: canary change becomes visible to everyone; canary table cleared.
4. Canary fetch failure degrades to live (no blank-out).

## Recommendation

Land R1 (drafts) first (this PR). Build R2 as its own PR once the approach is
approved, and validate the four acceptance cases against a dev Supabase project
before it reaches `main` — the deploy leak-gate won't catch an RLS logic error.
