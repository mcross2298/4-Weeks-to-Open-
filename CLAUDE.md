# Project notes for Claude

## Planning rule — executive summary required

**Invoke the `executive-summary` skill** (`.claude/skills/executive-summary/SKILL.md`)
for: new features or UI additions, development phases, multi-file refactors,
schema/pipeline changes, new HTML pages, and exercise-data structural changes.
Produce a Word-style executive summary and wait for explicit approval ("approved" / "go")
before writing or editing any file.

**Skip the summary for:** isolated bug fixes contained to 1–2 files, single-line
corrections, copy/wording tweaks, and trivial CSS adjustments. See the skill for
full scope guidance.

---

## Documentation currency rule — keep Quick Tour & Program Guides current

**Permanent rule.** Any time a change adds or meaningfully alters a
**user-facing feature** — something a trainee needs to discover or learn how
to use — update the matching onboarding doc in the same piece of work:

- **App-wide feature** (dashboard, Conditioning Corner, calendar, macros
  search, substitute picker, etc.) → update **`quick-tour.html`** and/or
  **`quick-tour-overview.html`**.
- **Program-specific feature** (a new day type, a new intensifier, a change to
  how a specific program's split/structure works) → update that program's own
  **`<id>-instructions.html`** guide (e.g. `mc-instructions.html`,
  `mm-instructions.html`), and add an entry in **`program-guide.html`** if the
  program itself is new (see the New Program Creation Workflow below, step 4,
  for the required `dashboard.html` + `mc-pm-data.js` wiring that makes a new
  program discoverable in the first place).

Purely internal changes (refactors, data-only additions with no user-visible
behavior change, bug fixes restoring already-documented behavior, CSS/copy
tweaks) don't require a doc update. If a feature is removed or changed enough
that existing guide copy is now wrong, update or remove that section rather
than leaving stale copy. This is independent of the executive-summary gate
above — even a change small enough to skip the executive summary still needs
its guide entry if it's user-facing.

---

## New Program Creation Workflow

Whenever asked to **create a new program**, follow this pipeline exactly:

1. **Executive summary first** — invoke the `executive-summary` skill and wait for
   explicit approval before writing any file.
2. **Build the program HTML page** — follow the 7-day layout standard and
   station-anchoring constraints documented below. All new programs use
   `5-on 2-off` and the 7-card day structure.
3. **Register in `mc-pm-data.js`** — add a new entry to the flagship programs
   array (before the `MARKET:STRIP` block) unless the program uses licensed
   influencer content, in which case place it inside the MARKET:STRIP section.
   Required fields: `id`, `icon`, `name`, `meta`, `color`, `desc`, `href`, `splits`.
4. **Add the program's bespoke look to `dashboard.html`** — `#flagGrid`, the
   Home screen's `.prog-rail`, and `.influencer-grid` all render their markup
   automatically at runtime from `MC_PM_DATA.programs` (`renderProgramCards()`,
   top of the big inline `<script>` in `dashboard.html`) — a new entry in
   `mc-pm-data.js` with `tier: 'flagship'` or `tier: 'influencer'` is enough to
   make the card and (for flagship) its rail tile appear with no HTML to hand-write.
   Two things still need a matching hand-added block per new `id`, since they're
   bespoke per program and not derivable from data alone:
   - **CSS** — add `.cat-card.<id>` / `.rail-card.<id>` (background gradient,
     border-top, `.cat-tag` color) inside the `#scr-programs` / `#scr-dashboard`
     scoped rule groups, next to the existing per-id blocks. `border-top`'s hex
     is what `tools/check-program-colors.js` enforces against `mc-pm-data.js`'s
     `color` field for *both* the grid and rail blocks — keep it in sync. Do
     **not** add a `.cat-designer` color rule — `#scr-programs .cat-designer`
     is set to `display:none`, so flagship/influencer cards never show it; only
     the separate "Your Programs" / "Published Programs" tiers render that line.
   - **Icon** — add an entry to the `PROGRAM_ICONS` map inside `renderProgramCards()`
     (stroke/fill/path or circles) keyed by the new `id`; it's shared by the
     rail (19px) and grid (18px/15px) renders, so there's exactly one icon
     definition per program, not two. For an **influencer** program, add the
     entry inside the map's existing `MARKET:STRIP influencer-icons` comment
     block, alongside the other influencer ids, not above it with the
     flagship entries — anything outside that block ships in the public
     Rolodex build. A per-program dynamic UI hook (like the live-streak badge
     on one of the influencer cards) belongs on the *data* object as a plain
     boolean flag (see `liveBadge` in `mc-pm-data.js`) rather than an
     `if (p.id === '<name>')` check in `dashboard.html` — a literal influencer
     name/id comparison in shared, unwrapped code is exactly what
     `tools/build-market.py --check`'s brand-term scan is there to catch.
   The `.topbar-sub` program count is computed from the rendered `#flagGrid`
   cards at runtime — no manual count to update.
5. **Commit and push to a feature branch in `4-Weeks-to-Open-`.**
6. **Create a draft PR targeting `main` of `4-Weeks-to-Open-`.**
7. **Merge to main** → the deploy pipeline auto-propagates all changes to
   `MC-Training-Rolodex`. Never push directly to the Rolodex repo.

## Repository relationship & deploy pipeline (IMPORTANT)

`4-Weeks-to-Open-` is the **master repository**. `MC-Training-Rolodex` is a
**downstream deploy target**, not a place to push directly.

- There is an automatic deploy function: once changes are pushed to
  `4-Weeks-to-Open-`, they are propagated/applied to `MC-Training-Rolodex`
  automatically (the Rolodex is the market/public build, with licensed
  influencer content stripped via the `MARKET:STRIP` markers).
- **Do all work in `4-Weeks-to-Open-` and push there.** Do NOT manually push
  to `MC-Training-Rolodex` (its `main` has an unrelated history and is managed
  by the deploy pipeline). Manually overwriting Rolodex `main` would be
  destructive and is never the right move.

## Active Development Plan — launch-roadmap.md

> **The governing plan is now [`launch-roadmap.md`](launch-roadmap.md)**
> (approved 2026-07-12): a phased launch-readiness roadmap (L0–L6) driving
> the app to a finished product — installable PWA + commercial layer, with
> L6 as the definition of done. Each phase requires its own executive
> summary + approval before code, and an AskUserQuestion gate before the
> next phase. The section below is the previous plan, kept as a historical
> record; its two open closeout items (Task 3.2, `exercisedata.json`
> retirement) are absorbed into roadmap Phase L0.

> **Companion cross-app plan:** [`cookbook-bridge-roadmap.md`](cookbook-bridge-roadmap.md)
> (approved 2026-07-15) governs the two-way data bridge between this app and
> Mike's Cookbook, toward a joint launch as two linked PWAs (B0–B5). Its final
> phase folds into launch-roadmap.md L6. Same gate discipline: each phase needs
> its own executive summary + approval before code. Scratch-listed
> (`content-manifest.json`), so it never ships to the public Rolodex build.
>
> **B0 shipped (2026-07-15):** `mc-sync.js` gained a `CONSUME` map that pulls
> `mc-cookbook:mealplan` read-only from Mike's Cookbook (never pushed — one
> writer per store); `mc-bridge.js` is the shared, read-only cross-app view
> (`todaysMeals`/`todaysWorkout`/`macroTargets`/`recentActivity`/`today`),
> **byte-identical to the copy in Mikes-Cookbook** and gated by
> `tools/test-mc-bridge.js`. Macro targets come from the already-shared
> `mc_macros_v1.goals`, not a workout-only store.
>
> **B1 shipped (2026-07-15):** `mc-macros.js` (dashboard's Nutrition tab)
> gained a "Today's Planned Meals" card built on `mc-bridge.js` — lists today's
> cookbook-planned meals (title/icon/macros denormalized onto each meal entry
> by the cookbook, since this app never loads `recipes-data.js`), a one-tap
> **Log** button that writes into the shared `mc_macros_v1` (never back into
> the cookbook-owned plan store), and a plan-vs-target readout. `mc-bridge.js`
> now loads immediately before `mc-macros.js` (not near `mc-sync.js`) so
> `window.MCBridge` exists at first render.
>
> **B2 shipped (2026-07-15):** `mc-bridge.js` gained `likelyTrainingDays()` — a
> real historical weekday-training pattern from `mc_workout_log_v1` (this app's
> own store), consumed by the cookbook to bias its Smart Week / Macro Smart
> Generator toward higher protein on likely training days. Also fixed a real
> bug from B0/B1: `perServingMacros()`'s fallback used the wrong macro field
> names (`kcal/p/f/c` instead of the cookbook's real `calories/protein_g/
> fat_g/carbs_g`), which would have logged zero macros for any real planned
> meal — now normalizes correctly. Also: any pulled `CONSUME`-store change now
> arms `mc-sync.js`'s one-shot reload (previously only owned-store pulls did),
> since consumer stores have real rendered surfaces now.
>
> **B3 shipped (2026-07-15):** a real architecture correction — the two apps
> are actually **same-origin** (`mcross2298.github.io`, different path, not
> two separate origins as B0 assumed), so same-device `localStorage` (and the
> Supabase session, since both apps use the same project ref/default storage
> key) is already shared by the browser; the sync bridge remains the
> cross-device/partitioned-storage safety net, not made redundant by this.
> `dashboard.html` gained a compact cross-app "Today" strip
> (`populateTodayStrip()`, near the momentum strip) summarizing today's
> cookbook-planned meals + macro goal, hidden with no bridge data. The
> Rolodex-only one-way cookbook nav icon is now paired with an always-visible
> standalone-build link (absolute URL, `MARKET:STRIP`-gated so the Rolodex
> build still gets its own relative-path version) — first persistent,
> two-way nav between the apps.
>
> **B4 shipped (2026-07-15):** `mc-account.js`'s sign-in copy now mentions
> Mike's Cookbook (the cookbook's already mentioned the workout app). A real
> defect from B3 was found and fixed here too, on the cookbook side: its new
> workout-nav button silently overlapped the pre-existing account button at
> the same position slot. `mc-install.js` and `mc-backup-status.js` (this
> repo's originals) are now shared, byte-identical modules with the cookbook
> — `mc-backup-status.js` was adjusted to re-query its DOM element on every
> render rather than cache it once, since the cookbook's SPA rebuilds Home's
> DOM on every visit and a cached reference would go stale there.
>
> **B5 shipped (2026-07-16) — session-verifiable half only; owner sign-off is
> the remaining gate:** `mc-sync.js`'s merge functions (browser-only IIFE, not
> `require()`-able) now have a `module.exports` hook exploiting function-decl
> hoisting, tested against the real source via `tools/test-mc-sync-merge.js`
> (vm-sandboxed, same technique as `test-mc-bridge.js`) — 24 real
> conflicting-fixture assertions. A real CI gap was found and closed: neither
> repo's `pages.yml` ran the bridge/sync tests before now, and Mikes-Cookbook
> had no copy of `test-mc-bridge.js` at all despite owning a byte-identical
> `mc-bridge.js` — both fixed. A full cross-app QA loop was verified
> headlessly end-to-end for the first time (prior phases only tested in
> isolation) — 7 checkpoints, zero console errors. Offline/SW verified live
> where the environment allows; this app's `sw.js` has a pre-existing
> (predates this roadmap) hardcoded production-origin guard in its fetch
> handler, so true offline-reload is only observable on the real deployed
> origin, not localhost — documented, not silently skipped. `mc-export.js`
> reconfirmed to already exclude CONSUME-only stores correctly. **Not done,
> and can't be from this environment:** the real-device QA matrix (iOS
> Safari, Android Chrome, installed-PWA), and confirming actual Supabase
> reconciliation across two signed-in physical devices — both are the
> owner's to close before B5/L6 can be called truly complete. Full
> breakdown in `cookbook-bridge-roadmap.md`'s B5 section.

## Previous plan (historical) — workout_cookbook_dev_plan_v2

### Decisions locked in (via AskUserQuestion, session 2026-06-27)
- **Catalog scope (Task 3.1):** Full catalog — add `equipment` + `movement` fields to ALL 539+ exercises
- **Weight engine (Task 3.3):** Hardcoded multipliers per equipment type (no user-input friction)
- **Search no-results fallback (Task 2.1):** Show "No exact matches — try fewer keywords" message
- **Execution order:** Phase 1 → Phase 2 → Phase 3 in sequence; AskUserQuestion alignment check before each phase

### Phase 1 — Polish & Stability ✅ Complete (merged to main)
- `mc-calendar.js`: collapsible toggle (`localStorage mc_cal_collapsed` — moved off `sessionStorage`, which reset the collapse state every new tab even for daily users), chevron indicator, `MCCalendar.toggle()` / `MCCalendar.focus()` API
- `dashboard.html` / `base.css`: text truncation fixes (`overflow-wrap`, `word-break`) on `.hero-name`, `.cat-name`, `.ex-name`, `.ss-name`; `.cat-meta` `-webkit-line-clamp` relaxed 2→3
- `mc-macros.js`: swipe-to-dismiss gesture on bottom-sheet handle (touchstart/move/end, 50 px threshold, scrollTop guard)

### Phase 2 — Search & Nutrition UX ✅ Complete (PR #96, merged to main)
- `mc-macros.js`: `tokenFilter()` client-side multi-keyword AND scoring post-API; `showEmpty()` always-visible prompt (never blank); backspace clears immediately without debounce
- `mc-macros.js`: nutrition sheet contrast — `.nt-ring-lbl` + `.nt-nrow` upgraded from `var(--muted)` → `var(--text)`, font-weight 700→800

### Phase 3 — Exercise Intelligence ✅ Complete (4-Weeks-to-Open- only)
- **Task 3.1:** Done — `exercise-catalog.js` has `equipment` and `movement` fields on all 577 exercises; the actual picker (`mc-card-actions.js` → `openSubstitute()`, powered by `mc-biomech.js`'s `alternatives()`) shows the top 3 closest matches (same muscle + same movement first, then same muscle any movement) plus a "Browse all for [muscle]" link, with gym-profile filtering removed so results are catalog-driven only, matching the locked decision. `Smith` exists as a 7th equipment value alongside the original 6 — left as-is rather than force-folded into Barbell/Machine, since it's a real distinct equipment type on gym floors.
- **Task 3.2:** Closed (verified in roadmap Phase L0, 2026-07-13) — the swap flow is coherent: the meatball "Replace exercise" route (`mc-card-actions.js` `doReplace()`) uses a `confirm()` dialog before navigating to `exercise-library.html?replace=`, and the biomechanical in-place substitute (`applySwap()`) uses a recoverable Undo toast (deliberate gym-floor fat-thumb recovery), persisting `{origLower:newName}` to `mc_replacements_global`/`mc_replacements|<pageId>` which `mc-replace.js::applyReplacements()` re-paints on reload. `mc-live-tracker.js` reads progress from `mc_setlog_v1` + live DOM card counts, **not** `mc_daily_v1` (the store name in the old note was stale — no file references it); the setlog+DOM source is internally consistent, so no code change was needed.
- **Task 3.3:** Done — `mc-suggest.js` has the equipment-aware increment table (Cable/Machine ×0.5 step, Dumbbell "per hand" label) and `mc-maxout.js` has the Cable/Machine ×0.85 Epley coefficient. The `.github/workflows/pages.yml` regression-coverage step has not been added.
- **New:** `exercisedata.json` (904 records, no `equipment`/`movement` fields) was a legacy, unenriched dataset superseded by `exercise-catalog.js` — **retired** (verified gone in roadmap Phase L0, 2026-07-13): no `*.js`/`*.html`/`*.json` file references it, and `tools/build-sw.py` explicitly excludes the superseded datasets from the precache.

---

## Conditioning Corner

The "Conditioning Corner" is the **Conditioning tab** on `dashboard.html`
(`dashboard.html?tab=conditioning`), rendered by `renderConditioning()` from
`conditioning-data.js` (the `CONDITIONING` object) into `.cond-card` elements.

The owner-only PM inline-editing layer (`mc-pm-inline.js`) covers it:
- direct inline text edits on each card (name / tag / description) via a ✎
  pencil, reusing the page-override pipeline under a synthetic `'cond'` page
  (scope_id = routine id) — no dedicated Supabase section,
- a "Layout & Theme" line (🎨 chip) scoped to the `conditioning` layout view
  (`cards` / `compact` / `grid`, defined in `mc-layout.js`).

---

## Weekly Layout Standard — 7-Day 5-On 2-Off Architecture

> **Permanent rule.** All program HTML pages using this schedule pattern must
> implement a full 7-card day layout. Plain-text rest/active-rest banners are
> forbidden. Every day must be a `.day-card` UI component.

### Schedule pattern
- **Label:** `5-on 2-off` (replace all legacy `4-on 2-off` labels)
- **Day count:** 7 cards per week — Days 1–5 are training/conditioning; Days 6–7 are recovery

### Day specification

| Day | Card Title | Subtext | Card Type |
|-----|-----------|---------|-----------|
| 1 | Chest & Biceps | `Day 1 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 2 | Shoulders & Triceps | `Day 2 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 3 | Back & Traps | `Day 3 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 4 | Legs | `Day 4 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 5 | Conditioning Day | `Day 5 · Select Workout · 5-on 2-off` | Interactive dropdown / link to Conditioning Corner |
| 6 | Active Rest Day | `Day 6 · Recovery Plan · 5-on 2-off` | Info card: Low Intensity Cardio · Stretching · Mobility Work |
| 7 | Rest Day | `Day 7 · Full Rest · 5-on 2-off` | Info card: Full Rest · Deep Sleep & Active Recovery · Optimized Nutrition |

### Card rendering rules
- **Day 5 (Conditioning):** Render as `.day-card` with amber (`#d97706`) accent. Expandable
  panel shows a "Browse Conditioning Corner →" link to `dashboard.html?tab=conditioning`.
  No static exercise list — pulls from the Conditioning Corner library at runtime.
- **Day 6 (Active Rest):** Render as `.day-card` with teal (`#0d9488`) accent. Expandable
  panel shows three activity rows (icon + name + description). Not a training card — no
  exercise counter, no rest timers.
- **Day 7 (Rest):** Render as `.day-card` with slate (`#334155`) accent. Expandable
  panel shows three recovery-focus rows. No exercise counter, no rest timers.
- **Footer order:** PROGRAM SUMMARY → navigation bar → Finish Workout banner must
  appear below the Day 7 card. No content may overlap or clip Day 7.

---

## Gym Programming Rules & Station-Anchoring Constraints

> **Permanent constraint applied to all future program builds.** Every superset,
> triset, and giant set must satisfy exactly one of the four approved archetypes.
> These rules exist to eliminate equipment hogging in a commercial gym.

### The Station-Anchoring Principle

All supersets, trisets, and giant sets must be **completely station-anchored**.
The trainee completes the entire sequence within a single, minimal footprint —
one piece of equipment or one square area — without walking across the floor.

**Forbidden pairings (never do this):**
- Two different major machines in the same block
- A machine + a separate cable column
- A barbell rack + a distant bench movement

### Approved archetypes

**A. DB / Bench Anchor**
Entirely dumbbell-based movements at a single adjustable bench.
> Example: Seated DB Shoulder Press → Incline DB Fly → Incline DB Hex Press

**B. DB / Fixed-Barbell Combo**
A single fixed-weight barbell or EZ-bar paired with dumbbells or bodyweight
at a single bench station.
> Example: EZ-Bar Skull Crusher → DB Hammer Curl (seated at same bench)

**C. Single-Machine Anchor**
A machine movement paired **only** with a bodyweight exercise or a dumbbell
exercise where the DBs are brought directly to that machine before starting.
> Example: Leg Press → BW Calf Raises on the platform → DB Goblet Squat next to machine

**D. Single-Cable Column Anchor**
One cable stack with multiple attachments, or a cable movement paired with
a DB/bodyweight exercise executed directly in front of that same machine.
> Example: Tricep Rope Pushdown → Overhead Cable Extension (same pulley) → BW Push-Ups

### Intensity & time-efficiency drivers

- **Mechanical Drop Sets:** Transition immediately from a weaker to a stronger
  movement using the same weight and equipment (e.g., DB Fly → DB Hex Press,
  same dumbbells).
- **Rest-Pause / Myo-Reps:** Single-station or machine movements only —
  no weight changes or setup adjustments required.

### Single-bar barbell complex (grouped-block archetype for barbell phases)

A tri-set or superset may be run as a **single-bar complex**: one loaded
barbell / EZ-bar used for 2–3 movements back-to-back at one station, no
re-loading and no walking. This is the most station-anchored block possible and
keeps a barbell phase barbell-dominant (it extends Archetype B).

### Smith / Olympic-barbell independence (Modality Matrix Phase 2 rule)

> **Permanent rule for Barbell & Smith programs.** Smith-machine and Olympic
> (7 ft) barbell movements are **independent** — they may never share a tri-set
> or superset. Concretely:
> - **Smith lives only at Pos 8 (cluster) & Pos 9 (drop)** — single-station,
>   never inside a grouped block. Exactly **2 Smith lifts per day**.
> - **Olympic-barbell compounds are standalone** (Pos 1–2) — never supersetted.
> - **Grouped blocks (Pos 3–7) are single-bar EZ/short-barbell complexes.** A
>   Smith move may only ever pair with a **mobile EZ-bar / BW / DB** brought to
>   the Smith — never with an Olympic compound.
> - The day is **dominantly barbell** (Olympic at Pos 1–2 + barbell complexes at
>   Pos 3–7), with the Pos 10 bodyweight finisher per the standard.

### Cable / plate-loaded independence (Modality Matrix Phase 3 rule)

> **Permanent rule for Cable & Plate-Loaded programs.** The day is
> **cable-dominant** with exactly **3 plate-loaded machines**, and the 3 phases
> together (DB → Barbell/Smith → Cable/Plate-loaded) cover every equipment type.
> - **Plate-loaded lives only at Pos 1 (low-rep anchor), Pos 8 (cluster) &
>   Pos 9 (drop)** — standalone single-station, never inside a tri-set/superset.
>   The Pos 1 plate-loaded compound carries the heavy 5×5 the cables can't.
> - **Grouped blocks (Pos 3–7) are pure single cable-column complexes** — one
>   stack, swap attachments for 2–3 moves at that column (Archetype D), no DB/BW.
> - **Cable** fills Pos 2–7; the **Pos 10 bodyweight finisher** per the standard.

### Applied workout structure (10 exercises/session)

| Position | Exercise type | Station rule |
|----------|--------------|--------------|
| 1–2 | Compound (standalone) | No superset — station-anchoring N/A |
| 3–5 | TRI-SET | Must satisfy one archetype (A/B/C/D) |
| 6–7 | SUPERSET | Must satisfy one archetype (A/B/C/D) |
| 8 | CLUSTER SET | Single station only |
| 9 | DROP SET | Single station only |
| 10 | FINISHER | Bodyweight only — no station constraint |

### Day-type archetype assignments (reference)

| Day | Tri-Set Archetype | Superset Archetype |
|-----|------------------|--------------------|
| Chest & Biceps | D (Single Cable Column) | B (EZ-Bar + DB at bench) |
| Shoulders & Triceps | D (Single Cable Column) | D (Single Cable Column) |
| Back & Traps | A (DB / Bench Anchor) | C (Machine + DB pre-staged) |
| Legs | C (Leg Press or Machine Anchor) | C (Machine + DB or BW) |

---

## Per-Day Intensifier Coverage (multi-week / modality programs)

> **Permanent rule.** In any program where the exercises stay fixed across a
> multi-week block (e.g. **The Modality Matrix**), every training day must
> independently carry the **7 intensifiers in every week** (low-rep, high-rep,
> TUT, tri-set, superset, cluster, drop). A weekly theme must never strip an
> intensifier out of the day — the week's dominant style is applied **visibly to
> exactly 4 feature lifts**, not the whole workout.

**Each training day = 10 exercises** on a fixed position → intensifier blueprint
(the 10-exercise table above). The intensifier TYPE per position never changes
week to week. Within those 10 exercises:

- **Required every day, every week:** low-rep, high-rep, TUT, tri-set, superset,
  cluster, drop set — plus a **2 / 4 / 4 working-set mix** (2 five-set, 4 four-set,
  4 three-set). **Tri-sets are always 3 sets.**
- **6 ANCHORs** keep a FIXED rep scheme across all weeks (only load/cues progress).
  Anchors guarantee the spread is always present:
  - **Pos 1** = low-rep anchor (heavy ~5×5, every week) · **Pos 10** = high-rep
    finisher anchor (bodyweight, high-rep/AMRAP every week)
  - **Pos 4** (a tri-set member) = TUT anchor — fixed **3 sec negatives / 2 sec
    pauses** every week (TUT gets an explicit structural home, not just notes)
  - **Pos 3** tri-set · **Pos 7** superset · **Pos 9** drop
- **4 FEATURE lifts (Pos 2, Pos 5, Pos 6, Pos 8)** visibly take on the week's
  theme in the **set field itself** (real pyramid strings, explicit `@ tempo`
  notation, paired supersets) while keeping their set count and base role.
- **Week themes (5-week block):** **W1 Low-Rep · W2 Pyramid · W3 Tempo (explicit
  e.g. `@ 4-0-1`) · W4 High-Rep · W5 Superset.** Pyramid and tempo must appear as
  actual schemes, not just coaching notes. The low-rep week uses a **mix**
  (5×5 · 5×8 · 8/6/4/4 · 4×6) across the lifts of differing set counts.
- **`renderWeekTabs` must derive from `WEEK_THEMES`** (no hardcoded 4-week list).
- **W5 superset-week contingency (render-time).** The Superset week is
  superset-dominant, so a tri-set defeats the theme. `renderExercise` collapses
  the Pos 3–5 tri-set **in W5 only** — **Ex 3 runs standalone, Ex 4–5 pair as a
  superset** — keyed off `currentWeek === WEEK_THEMES.length-1 && tag === "TRI-SET"`.
  The blueprint **data is unchanged** (Pos 3–5 stay tagged `TRI-SET`); the swap
  is display-only and must be carried in every cloned program page.

> **8-exercise training days are forbidden** under this rule — expand to the full
> 10-position blueprint so the complete intensifier spread fits.

### Shipping checklist — get a multi-week program right the first time

These are hard-won gotchas; check them **before opening the PR**:

1. **One `w[]` entry per week theme.** Every exercise's `w` array length MUST equal
   `WEEK_THEMES.length` — `currentWeek` indexes straight into it, so a short array
   renders `undefined`. Add a week theme → add a `w[]` entry to *every* exercise.
2. **Week/phase count must agree in every surface.** When the count changes, update
   ALL of: the render schedule label (`"N-Week Block"`), the `cat-*.html` meta
   badges **and** phase week-ranges, the `dashboard.html` `.cat-count`, and the
   `mc-pm-data.js` `meta`. (The Modality Matrix lives in 4+ spots — 12→15 touched
   them all.)
3. **Themes drive the tabs.** `renderWeekTabs` derives from `WEEK_THEMES`; never
   hardcode the week list or duplicate the short theme names so they can drift.
4. **Pre-merge parse-check (required gate).** `new Function()`-syntax-check the
   inline `<script>`, then parse the `DAYS` array and assert for **every training
   day × every week**: all 7 intensifiers present, the 2/4/4 working-set mix holds,
   tri-sets = 3 sets, and the week's theme is **visible in the set field** (a real
   pyramid string in the pyramid week, `@ x-x-x` tempo in the tempo week, a paired
   superset in the superset week). Notes alone do not satisfy this.
