# PM Mode — Full Rename & Customization Layer (Design)

Status: **DESIGN — for review before implementation**
Scope: Programs · Splits · Exercises (global + split-specific) · Badges
Repos: `4-Weeks-to-Open-` (primary) and `MC-Training-Rolodex` (mirror)

---

## Module 0 — Architecture recap & ground rules

The app is a static PWA: workout HTML is the source of truth, and PM Mode
already works as a **paint-on-top override layer** (`program-overrides.js`)
keyed by `(pageId, original exercise name)`, with three tiers:

1. `localStorage mc_pm_overrides` — owner's local working copy (instant preview)
2. Supabase `program_overrides` — published, live for all users (RLS owner-write)
3. `program-overrides.json` — committed offline/fallback copy

This design **extends that exact pattern** to programs, splits, badges, and
global exercise renames. Nothing is migrated; static HTML and historical logs
are never rewritten. Three invariants drive everything below:

- **G1 — Original names are keys, display names are paint.** Every override is
  keyed by the immutable original (HTML-authored) identifier. Renames only
  change what is painted, never what is stored against.
- **G2 — Logs are append-only and rename-proof.** `mc_setlog_v1`, `mc_history`,
  and `mc_replace_log` keys/records must always derive from original
  identifiers, never from displayed text (see Module 3 — this requires a
  Phase 0 bug fix that stands alone).
- **G3 — One working copy, one Publish.** All rename types flow through the
  existing local-edit → Publish → Supabase (+ JSON export fallback) pipeline,
  so the PM bar, edit counter, Discard, Import/Export all keep working with
  no new mental model.

---

## Module 1 — Schema adjustments

### 1.1 Overrides document v2 (JSON shape)

`program-overrides.json`, the localStorage working copy, and the export format
all share one document. v1's `pages` section is **unchanged**; four sibling
sections are added. Old clients only read `.pages`, so v2 files are backward
compatible by construction.

```jsonc
{
  "version": 2,
  "updated": "2026-06-13T00:00:00Z",

  // v1 — UNCHANGED. Split-specific exercise overrides (rename + sets/rest/
  // note/tempo). A split-scoped rename is just this section's `name` field —
  // it already exists and stays the default rename scope.
  "pages": {
    "pmc-s5-push.html": {
      "Pronated DB Chest Flies": { "name": "Crucifix Flies", "sets": "4x15" }
    }
  },

  // NEW — global exercise renames, keyed by original catalog/HTML name.
  // Applies on every page that shows the exercise, unless a page-level
  // override (above) wins. { "reset": true } shadows a published entry.
  "exercises": {
    "Romanian Deadlifts (Barbell or DB)**": { "name": "RDL (Bar or DB)" }
  },

  // NEW — program-level cosmetics, keyed by the dashboard PROGS id
  // ('pmc', 'mc', 'ss', …) or a custom program id ('cprog-<id>').
  "programs": {
    "pmc": { "name": "Project Chaos", "icon": "🌀", "desc": "…optional…" }
  },

  // NEW — split renames, keyed by program id + ORIGINAL split label exactly
  // as it appears in PROGS.splits / the cat page schedule / split hub titles.
  "splits": {
    "pmc": { "Split 5": { "name": "Chest Hypertrophy Focus" } }
  },

  // NEW — badge/label customization. Badge ids (tb-superset, tb-drop,
  // tb-highrep12, lb-ss, …) are already stable keys in the data files.
  // "global" applies everywhere; a program section wins inside that program.
  "badges": {
    "global":  { "tb-amrap":    { "label": "💀 To The Grave" } },
    "pmc":     { "tb-superset": { "label": "⚡ Chaos Pair", "color": "#a855f7" } }
  }
}
```

Notes:

- **Why original-name keys for splits instead of indexes:** indexes shift if a
  split is ever added/removed in HTML; the original label is stable, matches
  the existing `pages` keying convention, and lets the painter find the text
  on every surface (dashboard chip, cat schedule row, hub title, back-links).
- **Badge patch fields:** `label` (text incl. emoji) and optional `color`.
  Structural badge CRUD (creating brand-new badge types) is out of scope —
  badges are rename/retheme only, since chips are styled per-page by CSS class.
- **`reset` semantics** carry over from v1 to every new section: a local
  `{ "reset": true }` shadows a published entry so the original renders again.

### 1.2 Supabase: new `naming_overrides` table

`program_overrides` is left untouched (zero migration risk). One new generic
table covers the four new scopes — `supabase/phase4-naming.sql`:

```sql
create table if not exists naming_overrides (
  scope      text not null,   -- 'program' | 'split' | 'exercise' | 'badge'
  scope_id   text not null,   -- progId | progId + '|' + origSplitName
                              -- | origExerciseName | progScope + '|' + badgeId
  patch      jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users,
  primary key (scope, scope_id)
);

alter table naming_overrides enable row level security;

create policy read_all on naming_overrides
  for select using (true);

create policy admin_write on naming_overrides
  for all
  using      ( auth.uid() in (select user_id from admins) )
  with check ( auth.uid() in (select user_id from admins) );
```

`mc-supabase.js` gains three mirror functions — `getNaming()` (folds rows back
into the v2 document sections), `upsertNaming(scope, scopeId, patch)`,
`removeNaming(scope, scopeId)` — plus the same realtime `postgres_changes`
subscription so a publish from one device repaints others live.

### 1.3 localStorage working copy

`mc_pm_overrides` keeps its key and simply gains the new sections. The reader
tolerates v1 documents (missing sections ⇒ `{}`), so no migration step. Export
(`MC_PO.exportData`) emits `version: 2` with all sections; Import accepts
v1 or v2.

### 1.4 Resolution precedence (single source of truth)

| Entity | Precedence (first hit wins) |
| --- | --- |
| Exercise display name | `pages[pageId][orig].name` → `exercises[orig].name` → original |
| Other exercise fields (sets/rest/note/tempo) | `pages[pageId][orig]` only (unchanged v1) |
| Program name/icon/desc | `programs[progId]` → built-in PROGS / MCPrograms value |
| Split name | `splits[progId][origSplit].name` → original label |
| Badge label/color | `badges[progId][badgeId]` → `badges.global[badgeId]` → page's built-in map |

Within each cell, local working copy overlays published (existing `effective()`
merge), and `reset` entries drop to the next tier.

### 1.5 Page → program mapping

Split/badge painting needs to know which program a page belongs to. Add a
small static map (`MC_PAGE_PROG`) inside the new resolver module, keyed by
filename — e.g. `pmc-*.html → 'pmc'`, `mc-s*.html / mc-split*.html → 'mc'`,
plus explicit entries for the cat pages and irregular names. `cat-custom.html`
and `run-workout.html` resolve from their `?prog=` param / `MC_PID_OVERRIDE`
instead. (~150 entries, generated once from the repo file list; a follow-up
could derive it from `content-manifest.json` at build time, not required now.)

---

## Module 2 — State management & frontend logic

### 2.1 New module: `mc-naming.js` (pure resolver, no DOM)

Owns the v2 document and exposes `window.MC_NAMES`:

```
MC_NAMES.exercise(pageId, origName)  -> display name string
MC_NAMES.program(progId)             -> { name, icon, desc } (merged)
MC_NAMES.split(progId, origSplit)    -> display name string
MC_NAMES.badge(progId, badgeId)      -> { label, color } | null
MC_NAMES.progOf(pageId)              -> progId | null      (MC_PAGE_PROG)
MC_NAMES.setLocal(section, key, patch) / clearLocal(...)
```

It reuses `program-overrides.js`'s storage helpers (same localStorage key,
same published loader) rather than fetching twice: `program-overrides.js`
keeps owning load/merge and exposes the merged v2 doc; `mc-naming.js` is the
read API every surface calls. After any local write or published refresh it
dispatches `document` event **`mc:names-changed`** — painters listen for that
one event instead of re-implementing storage watching.

### 2.2 Paint surfaces (idempotent, observer-safe)

All painting follows the proven `program-overrides.js` discipline:
**snapshot original → set text only if different → revert on reset → wrap DOM
writes in `withoutObserver()`** so MutationObserver loops settle. No
framework, no re-render storms — `setText` no-ops when unchanged.

| Surface | File(s) | What gets painted |
| --- | --- | --- |
| Dashboard hero + program select sheet | `dashboard.html` (`allProgs()`) | program name/icon/desc; split chips via `MC_NAMES.split` — map PROGS through the resolver before render instead of DOM-painting (these are JS-rendered, so transform-at-source is cheaper than observing) |
| Catalog/schedule pages | `cat-*.html` | program title, split section headings, badge-key legend labels |
| Split hub pages | `mc-split*.html`, `pmc-split*.html` | split title, day links |
| Workout pages | all workout HTML | header/back-link split name; exercise names via existing card painter (now consulting global `exercises` tier); badge chips (match by `tb-*`/`lb-*` class, repaint label/color) |
| History / stats / wrapped views | `workout-logs.html`, `stats.html`, `mc-wrapped.js`, `mc-recap.js` | display-map stored original names at render time (read-only mapping; stored data untouched) |

Implementation split: extend `program-overrides.js`'s `applyToCard` for the
exercise global tier (one extra lookup), and add one new painter module
`mc-naming-paint.js` for headers/titles/badges/legends, included by the same
pages that include `program-overrides.js`.

### 2.3 PM editor UI (`program-manager.js`)

1. **Exercise editor (existing modal):** add a checkbox under the name field —
   `☐ Rename in ALL programs & splits`. Unchecked (default) ⇒ writes
   `pages[pageId][orig].name` (today's behavior). Checked ⇒ writes
   `exercises[orig].name` and leaves the page entry's name empty. The modal
   shows which tier currently supplies the visible name ("renamed globally" /
   "renamed in this split") so scope is never ambiguous.
2. **Rename Center:** the PM bar gains a `Names` button opening a panel,
   scoped to the current page's program: program row (name/icon/desc) →
   its splits → its badges, each with inline edit + per-row Reset. This gives
   programs/splits/badges a home that doesn't depend on long-pressing text
   scattered across pages.
3. **Edit counter / Publish / Discard:** `localEditCount()` and `doPublish()`
   iterate all five sections; publish maps sections → `upsertNaming`/
   `removeNaming` (and `pages` → existing `upsert`/`remove`). Discard clears
   the whole working copy as today.

### 2.4 Re-render & integrity rules (checklist)

- [ ] All painters subscribe to `mc:names-changed`; no painter reads
      localStorage directly.
- [ ] Every DOM write is conditional (`textContent !== next`) and wrapped in
      `withoutObserver()`; scans stay debounced (existing 80 ms pattern).
- [ ] Snapshots (WeakMap) captured before first paint on every new surface so
      Reset reverts live without reload.
- [ ] JS-rendered surfaces (dashboard PROGS, custom program cards) resolve
      names at data-mapping time, not by DOM observation.
- [ ] `data-mc-orig-name` is stamped on cards **before** any rename paints
      (already done) and is the only rename join key.

---

## Module 3 — Edge cases & historical log integrity

1. **🐞 Phase 0 fix (pre-existing bug, ships first):** `mc-setlog.js#nameId()`
   derives the persistence key from the *currently displayed* `.ex-name` text,
   and `mc-finish.js` records displayed names into `mc_history`. A v1 rename
   already forks a user's set history today. Fix: both must prefer
   `card.getAttribute('data-mc-orig-name')` over displayed text. Both load
   orders converge: if setlog runs first the display *is* the original; if the
   painter ran first the attribute holds the original. History entries gain an
   optional `displayName` alongside the original for cosmetics.
2. **Logs are never rewritten.** Renames map original → display at *read* time
   in logs/stats/wrapped views. If an override is later reset, history
   naturally shows original names again — nothing was lost.
3. **Rename-of-rename:** edits are always keyed and displayed against the
   original (`Original: <b>` in the modal), so renaming twice replaces one
   override rather than chaining.
4. **Display-name collisions:** a global rename may make two distinct
   exercises display identically. Keys stay distinct so logs are safe, but the
   editor warns when the new name matches a different catalog entry.
5. **Custom programs (`MCPrograms`)** store names directly and are the user's
   own data — renaming there is a true edit. Their ids (`p…`/`cprog-…`) key
   logging via `MC_PID_OVERRIDE`, so renames don't touch history. PM rename
   sections apply to *built-in* content; custom programs keep their own editor.
6. **Whitespace/case drift** between authored HTML and saved keys: reuse the
   existing tolerant lookup (`trim().toLowerCase()` fallback) in every new
   section.
7. **Old clients / fallback:** v1 readers ignore unknown JSON sections;
   `naming_overrides` failing to load degrades to original names (paint layer
   is purely additive). Export keeps the JSON fallback complete.
8. **Sync:** `mc_pm_overrides` is owner-local working state — excluded from
   `mc-sync.js` (as today). Published state syncs via Supabase realtime.

---

## Module 4 — Implementation plan (phased; each phase ships green)

**Phase 0 — Log-integrity hardening** (standalone, highest value)
`mc-setlog.js`, `mc-finish.js`: original-name key derivation per Module 3.1.
*Accept:* rename an exercise via existing PM Mode → set history and Finish
summary keep accruing under the original key.

**Phase 1 — Schema + resolver**
`supabase/phase4-naming.sql`; `mc-supabase.js` naming APIs; v2 sections in
`program-overrides.js` storage/merge/export/import; new `mc-naming.js`
(resolver + `MC_PAGE_PROG` + `mc:names-changed`).
*Accept:* unit-style console checks of precedence table 1.4; v1 JSON imports cleanly.

**Phase 2 — Paint surfaces**
Global exercise tier in `applyToCard`; new `mc-naming-paint.js`; dashboard
`allProgs()` mapping; history/stats display-mapping; badge chips + cat legend.
*Accept:* seeded local overrides repaint every surface listed in 2.2; Reset
reverts live; no observer loops (DevTools paint check).

**Phase 3 — PM editor UI**
Global-rename checkbox + tier indicator in the exercise modal; Rename Center
panel; counter/publish/discard over all sections.
*Accept:* full owner flow — rename program, split, badge, exercise (both
scopes), publish, verify on a second profile, reset each.

**Phase 4 — Mirror to `MC-Training-Rolodex`**
Port the same files (Rolodex shares the module layout; it lacks `supabase/`
SQL, which is backend-side anyway). Re-run Phase 2/3 acceptance.

**Phase 5 — QA sweep**
iOS PWA modal behavior, offline (JSON fallback), SW cache-bust, second-device
realtime repaint, history views before/after rename + reset.

---

## Module 5 — Decisions locked / open review points

Locked (from alignment): extend override layer (no ID migration) · split-only
rename default with explicit global toggle · both repos · design-then-build.

For review before build:
1. Badge customization depth — this design: `label` + optional `color`,
   program-scoped with global fallback; no new badge types.
2. Program `icon`/`desc` included as optional patch fields — trim to
   name-only if preferred.
3. Rename Center placement — PM bar `Names` button (proposed) vs. long-press
   on each title.
