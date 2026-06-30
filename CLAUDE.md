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
4. **Add card to `dashboard.html`** — insert a `.cat-card` block in `#flagGrid`
   (between the last flagship and the "Iron & Engine" coming-soon card). Add matching
   `.cat-card.<id>` CSS (background gradient, border-top, `.cat-tag`, `.cat-designer`
   color) immediately after the `.cat-card.ie` block. Increment the `.topbar-sub`
   program count by 1.
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

## Active Development Plan — workout_cookbook_dev_plan_v2

### Decisions locked in (via AskUserQuestion, session 2026-06-27)
- **Catalog scope (Task 3.1):** Full catalog — add `equipment` + `movement` fields to ALL 539+ exercises
- **Weight engine (Task 3.3):** Hardcoded multipliers per equipment type (no user-input friction)
- **Search no-results fallback (Task 2.1):** Show "No exact matches — try fewer keywords" message
- **Execution order:** Phase 1 → Phase 2 → Phase 3 in sequence; AskUserQuestion alignment check before each phase

### Phase 1 — Polish & Stability ✅ Complete (merged to main)
- `mc-calendar.js`: collapsible toggle (sessionStorage `mc_cal_collapsed`), chevron indicator, `MCCalendar.toggle()` / `MCCalendar.focus()` API
- `dashboard.html` / `base.css`: text truncation fixes (`overflow-wrap`, `word-break`) on `.hero-name`, `.cat-name`, `.ex-name`, `.ss-name`; `.cat-meta` `-webkit-line-clamp` relaxed 2→3
- `mc-macros.js`: swipe-to-dismiss gesture on bottom-sheet handle (touchstart/move/end, 50 px threshold, scrollTop guard)

### Phase 2 — Search & Nutrition UX ✅ Complete (PR #96, merged to main)
- `mc-macros.js`: `tokenFilter()` client-side multi-keyword AND scoring post-API; `showEmpty()` always-visible prompt (never blank); backspace clears immediately without debounce
- `mc-macros.js`: nutrition sheet contrast — `.nt-ring-lbl` + `.nt-nrow` upgraded from `var(--muted)` → `var(--text)`, font-weight 700→800

### Phase 3 — Exercise Intelligence ⏳ Pending (4-Weeks-to-Open- only)
- **Task 3.1:** `exercise-catalog.js` — add `equipment` (Barbell/Dumbbell/Cable/Plate-Loaded/Bodyweight/Machine) and `movement` (Push/Pull/Hinge/Squat/Carry/Isolation) fields to all exercises; `mc-replace.js` — rebuild picker to show **top 3 closest matches** (same muscle + same movement first, then same muscle any movement) + "Browse all for [muscle]" link that opens the full catalog filtered to that muscle group. No gym profile filtering — catalog-driven only.
- **Task 3.2:** `mc-replace.js` — swap confirmation writes replacement exercise name into `mc_daily_v1` localStorage (currently DOM-only); verify `mc-live-tracker.js` reads from store, not DOM
- **Task 3.3:** `mc-suggest.js` — equipment-aware increment table (Cable/Machine ×0.5 → +2.5 lb step, Dumbbell labeled "per hand"); `mc-maxout.js` — equipment coefficient on Epley formula (Cable/Machine ×0.85); `.github/workflows/pages.yml` — inline Node assertion test step for weight-math regression coverage

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
