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
