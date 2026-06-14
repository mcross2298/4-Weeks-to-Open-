# PM Mode — Layout Templates, Theme Engine & Bonus Workouts (Design)

Status: **DESIGN — for review before implementation (Phase 0)**
Scope: Layout templates (4 views × 2 styles) · Theme config · Inline "Edit
Layout" editor · "+" Creator wizard · Automated Bonus-Workout routing
Repos: `4-Weeks-to-Open-` (primary) → `MC-Training-Rolodex` (generated build)
Audience: **owner-only**, paint-on-top (decided 2026-06-14)

> This doc is the Program-Manager-Mode spec ("Program_Manager_Mode.md")
> translated onto the app as it actually exists: a **static vanilla HTML/CSS/JS
> PWA** with a **paint-on-top override layer** (`program-overrides.js`),
> per-program accent theming (`mc-theme.js`), and a generated public build
> (`tools/build-market.py`). It does **not** introduce React/Tailwind/Flutter
> (see Module 7 for why, and when that might change). Build order is
> **phase-by-phase**; Phase 1 ships Bonus Workouts only.

---

## Module 0 — Ground rules (carried over from the rename layer)

The rename/customization layer (`pm-rename-design.md`) already established the
pattern this design extends. Same three invariants apply unchanged:

- **G1 — Original identifiers are keys, presentation is paint.** A layout-style
  swap or re-skin is keyed by an immutable id (`pageId`, program id, or template
  id). It changes only what is *rendered*, never the authored HTML or stored
  data.
- **G2 — Logs and content are never rewritten.** `mc_setlog_v1`, custom
  programs (`mc_custom_programs_v1`), and custom workouts
  (`mc_custom_workouts_v1`) are untouched by theming/layout. A theme is cosmetic.
- **G3 — One working copy, one Publish.** Layout/theme/bonus edits flow through
  the **existing** local-edit → Publish → Supabase (+ `program-overrides.json`
  fallback) pipeline. No new persistence model, no second PM bar.

Three persistence tiers (already built — we reuse them verbatim):

1. `localStorage mc_pm_overrides` — owner's local working copy, instant preview.
2. Supabase `program_overrides` — published, live for all users (RLS owner-write).
3. `program-overrides.json` — committed offline/fallback copy.

---

## Module 1 — Schema: extend the v2 override document

The override doc today has five sections: `pages`, `exercises`, `programs`,
`splits`, `badges` (see `program-overrides.js#emptyDoc()`). We add **three**
sibling sections. Old clients only read sections they know, so this stays
backward compatible by construction — `emptyDoc()` simply gains the new keys.

```jsonc
{
  "version": 2,
  "updated": "2026-06-14T00:00:00Z",

  // … existing pages / exercises / programs / splits / badges unchanged …

  // NEW — per-VIEW structural layout choice. Keyed by a view scope:
  //   "program-cards"            (the dashboard program grid)
  //   "landing:<progId>"         (a cat-*.html landing page, e.g. landing:ss)
  //   "split:<progId>"           (the split-hub view for a program)
  //   "workout:<pageId>"         (an individual workout page, e.g. workout:pmc-s5-push.html)
  // value.style is the structural template id (Module 2). reset shadows a
  // published entry back to the HTML-authored default.
  "layouts": {
    "program-cards":   { "style": "grid" },        // grid | carousel
    "landing:ss":      { "style": "hero" },         // hero | split
    "split:ss":        { "style": "accordion" },    // accordion | tabbed
    "workout:pmc-s5-push.html": { "style": "list" } // list | swipe
  },

  // NEW — ThemeConfig per scope. Same key space as `layouts`. Any subset of
  // fields may be present; absent fields fall back to the program accent
  // (mc-theme.js PALETTE) then the global default. Colors are hex; never a
  // brand term (leak-safe).
  "themes": {
    "landing:ss": {
      "primaryBg":  "#0a0a0a",
      "cardBg":     "#101010",
      "accent":     "#e11d48",
      "typography": "athletic"      // "sans" | "athletic"
    }
  },

  // NEW — bonus-routing state. The owner never edits this by hand; the
  // workout builder writes it (Module 4). Listed here so it publishes through
  // the same pipeline and is visible to every device.
  "bonus": {
    "order": ["cw_abc123", "cw_def456"],   // custom-workout ids, newest first
    "container": { "name": "Bonus Workouts", "icon": "🎁", "accent": "#38bdf8" }
  }
}
```

`buildEffective()` in `program-overrides.js` already merges every section
published→canary→local with last-writer-wins. The three new sections are all
1-level maps, so they slot into the **exact same** merge loop (one added clause
each). No new precedence logic.

---

## Module 2 — Layout templates (the 4 views × 2 styles)

Each view exposes two **structural** styles. A style is just a CSS class on the
view's root plus, where needed, a small JS render mode — no DOM is destroyed,
only re-flowed. This keeps swaps reversible (G1).

| View | Style A (default) | Style B | Real anchor in the app |
| --- | --- | --- | --- |
| **Program Cards** | `grid` — 2-up/3-up matrix | `carousel` — horizontal scroll / vertical stack | `dashboard.html` `.cat-grid` |
| **Landing Pages** | `hero` — top media, metrics, vertical phases | `split` — sticky left summary, scrollable right | `cat-*.html` |
| **Split Cards** | `accordion` — collapsible day rows | `tabbed` — top tab bar per week/phase | split hubs |
| **Workout Cards** | `list` — chronological w/ superset indicators | `swipe` — one block at a time | `*-workout.html` |

**Spec note honored:** the accordion split layout is the **default for
`ss` (Strength & Supersets) only**. Every other program defaults to `tabbed`
unless an explicit `layouts["split:<id>"]` says otherwise. Encoded as a
`DEFAULT_LAYOUT` map, not hard-coded per page:

```js
// mc-layout.js (new) — structural defaults, override-aware
var DEFAULT_LAYOUT = {
  programCards: 'grid',
  landing:  'hero',
  split:    'tabbed',
  splitSS:  'accordion',   // ss only, per spec
  workout:  'list'
};
```

Resolution mirrors `MC_NAMES`: `MC_LAYOUT.styleFor(scope)` returns
`override ?? default`, and a painter applies the class. Style B markup/CSS is
additive (new classes in `base.css`), shipped behind the toggle so nothing
changes for users until a style is published.

### ThemeConfig (Module 1 `themes`)

`mc-theme.js` today sets only `--accent`/`--gold*`. We extend `apply()` to also
read the resolved ThemeConfig for the current scope and set `--surface-bg`
(primaryBg), `--card-bg` (cardBg), and a `data-typography` attribute on
`<html>` that flips a font stack in `base.css` (`sans` vs `athletic`). Accent
continues to fall back to the program PALETTE when unset, so existing pages are
unaffected.

---

## Module 3 — Admin entry points

Two surfaces, both **owner-only** (gated exactly like today's PM bar).

### 3.1 Inline "Edit Layout" (draft state)

- An **"Edit Layout"** button appears in the PM bar on any program-card grid,
  landing, split, or workout view (owner only).
- Click → page enters **Draft State**: a right-side **config sidebar** opens
  with (a) a structural-style toggle (A/B) for the current view and (b) the
  ThemeConfig controls (primaryBg, cardBg, accent, typography).
- Every change writes to the **local working copy** only and re-paints live
  (instant preview — reusing the existing `mc:names-changed`-style event, new
  `mc:layout-changed`). Nothing reaches users.
- **Save & Publish** routes through the existing Publish pipeline (Supabase +
  JSON export). **Discard** clears the local layout/theme keys and reverts.

This reuses the published/local/Discard machinery wholesale — Edit Layout is a
new *editor surface*, not a new *persistence path*.

### 3.2 "+" Creator wizard

A prominent **"+"** button opens a dropdown: `[+ New Program]`,
`[+ New Workout Split]`, `[+ New Workout Card Template]`. Selecting one opens a
blank wizard with the spec's fixed step order:

1. **Structure** — pick the baseline style (Module 2).
2. **Skin** — apply ThemeConfig.
3. **Content** — populate metadata (name/icon/desc/exercises).
4. **Destination** — assign to a target (a program, a split, or *unassigned* →
   triggers Bonus routing, Module 4).

`+ New Program` and `+ New Workout` already have real builders
(`build-program.html`, `build-workout.html`); the wizard **wraps and extends**
them with the structure/skin steps rather than replacing them. "New Workout
Card Template" is the only genuinely new canvas.

---

## Module 4 — Automated Bonus-Workout routing (PHASE 1 — builds first)

This is the first slice to ship. It is small, concrete, and self-contained.

**Today:** `build-workout.html` saves custom workouts to
`localStorage mc_custom_workouts_v1` (`getSaved`/`setSaved`) with **no program
assignment** and they surface only inside the builder's own "saved" list.

**Change:**

1. Add an optional **"Assign to program"** select to the workout builder's save
   flow (default: *— None (Bonus) —*). Options are the dashboard programs +
   custom programs (`MCPrograms.getAll()`).
2. On **Save & Publish** of a workout with **no** program assignment, the
   routing engine:
   - stamps the workout `{ bonus: true, publishedAt: <ISO> }`;
   - prepends its id to `overrides.bonus.order` (newest-first =
     `SortOrder: Descending by PublishDate`);
   - publishes through the normal pipeline.
3. The dashboard renders a **permanent "Bonus Workouts" container card**
   (the already-present, currently-unused `.cat-card.bonus` style — `🎁`,
   `#38bdf8`). It opens a grid that lists every bonus workout in
   `bonus.order` (newest at top). No manual linking step.

```
[Save & Publish workout]
        │
        ▼
[assigned to a core program?] ──Yes──► attach to that program's split list
        │
        No
        ▼
[Bonus routing] → mark bonus:true, unshift id into overrides.bonus.order
        │
        ▼
[Dashboard] renders "Bonus Workouts" card → grid sorted desc by publishedAt
```

**Routing engine location:** a small `mc-bonus-routing.js` (no server needed —
"backend pipeline" maps to our publish pipeline). It exposes
`MC_BONUS.route(workout)` called by the builder's save handler, and
`MC_BONUS.list()` consumed by the dashboard renderer. Reassigning a workout to a
real program later simply removes it from `bonus.order` (idempotent).

### Phase 1 acceptance criteria

- [ ] Workout builder has an optional "Assign to program" control; default is Bonus.
- [ ] Publishing an unassigned workout adds it to `bonus.order`, newest first.
- [ ] Dashboard shows a permanent "Bonus Workouts" card only when ≥1 bonus exists.
- [ ] The bonus grid lists workouts descending by `publishedAt`; tapping opens the workout.
- [ ] Assigning a workout to a real program removes it from the bonus list.
- [ ] Survives the leak check (`build-market.py --check`) — no brand terms, no licensed refs.
- [ ] Owner-only: a non-owner sees published bonus workouts but no edit/assign UI.

---

## Module 5 — Workflow logic (state passes, all phases)

1. **Layout swap (inline):** Edit Layout → toggle B → `MC_LAYOUT.setLocal(scope,
   style)` writes local working copy → `mc:layout-changed` fires → painter swaps
   root class → preview live → Save & Publish → Supabase + JSON.
2. **Re-skin:** same path via `MC_THEME` reading the `themes` section; CSS vars
   update with no reflow of content.
3. **Creator wizard:** Structure → Skin → Content → Destination; on finish,
   content goes to its builder store, layout/theme go to the override doc,
   destination decides program-attach vs Bonus routing (Module 4).
4. **Bonus routing:** Module 4 diagram above.

Every path ends at the **one** Publish, so Discard / Preview-as-user / publish
history (already shipped) work on layouts/themes/bonus for free.

---

## Module 6 — Phasing & deliverables

| Phase | Deliverable | Builds |
| --- | --- | --- |
| **0** | *This doc* | Schemas + wireframes + workflow (no production code) |
| **1** | Bonus Workouts | `mc-bonus-routing.js`, builder "assign" control, dashboard Bonus card |
| **2** | Layout + Theme engine | `mc-layout.js`, `mc-theme.js` ThemeConfig, Style-B CSS, override sections |
| **3** | Admin entry points | Inline "Edit Layout" sidebar + "+" Creator wizard |

Each phase ships its own JSON schema delta, vanilla components, and passes the
leak gate before the next phase starts.

---

## Module 7 — React/Tailwind (future option, not now)

Recorded per the owner's question. **React** would let each view be a reusable
component that re-renders on state change — Style A↔B swaps and live re-skins
become declarative instead of class-juggling + MutationObservers. **Tailwind**
styles via utility classes in markup instead of `base.css`. Both are a strong
fit *only* if the front-end is ever rebuilt as one bundled app; bolting them
onto the current static PWA adds a build toolchain for little gain. Revisit if a
ground-up rewrite is ever on the table. **Decision: stay vanilla.**

---

## Resolved decisions (owner, 2026-06-14)

1. **Bonus card placement** — **under the flagship grid** on the dashboard
   (above "Influencer Programs").
2. **Bonus structure** — the **"Bonus Workouts"** dashboard card opens a
   landing that follows the **Daily Pump / Daily Gainz** pattern: a category
   page built from collapsible **modules** (`.module` → `.module-header` +
   `.drill`) whose `drill-inner` lists `workout-row` links. See the existing
   `<!-- BONUS -->` module in `cat-pump-new4.html` (lines ~253–275) as the
   template. Each auto-routed custom workout is appended as a new
   `workout-row` (`row-emoji` / `row-name` / `row-detail` / `row-badge` /
   `row-arrow`), newest first. A dedicated `bonus-workouts.html` hosts this
   landing; individual items open via the existing custom-workout viewer.
3. **Assign control scope** — **loose attach** in Phase 1 (program-level only;
   no split/day picker). Split/day targeting deferred to the Phase 3 wizard.

---

## Module 8 — Additional template options catalog (candidates)

Beyond the base Style A/B set in Module 2. **Candidate list — not committed**;
the owner greenlights which land in Phase 2. Owner recommendation captured:
ship the three ⭐ low-cost theme knobs + one standout layout per view
(featured+grid, timeline, week-calendar, superset-grouped); the rest stay here
as future options.

### 8.1 Themes (extend `ThemeConfig`)
| Option | Adds | Cost |
| --- | --- | --- |
| **Preset palettes** ⭐ | Named vibes (e.g. "Crimson Steel") — one tap re-skins all four ThemeConfig fields | Low |
| Accent gradient / dual-tone | Gradient direction + 2nd color (cat-cards already use `135deg`) | Low |
| **Density** ⭐ (compact/comfortable/spacious) | App-wide padding & row height token | Low |
| Shape/radius (sharp/rounded/pill) | Corner-radius token | Low |
| **Motion level** ⭐ (off/subtle/hype) | Gates glow/sheen/pulse; respects reduced-motion | Low |
| Surface finish (flat/glass/outlined) | Glassmorphism token (already in save bars) | Med |
| Light / high-contrast mode | Non-black variant (accessibility) | Med-High |

### 8.2 Layouts (add Style C per view)
- **Program Cards:** `featured-grid` (one hero + grid) ⭐ · `compact-list` (dense `plan-card` rows).
- **Landing:** `timeline` (vertical phase/progress tracker) ⭐.
- **Split:** `week-calendar` (7-day grid) ⭐ · `day-carousel` (swipe day-cards).
- **Workout:** `superset-grouped` (bracketed pairs) ⭐ · `timer-first` (reuse `conditioning-timer.html`) · `checklist` (compact).

### 8.3 Structures (net-new containers)
- **Bonus Workouts** — Phase 1 (in progress).
- **Collections / Folders** — tag-based grouping independent of programs (pairs with Bonus).
- **Featured / Spotlight strip** — rotating featured workout on the dashboard.
- **Filter / segmented control** — landing filter by muscle group / duration.
- **Resume card** — "Continue where you left off" (reuses history/streak data).
- **Weekday scheduler** — assign workouts to days of the week.
