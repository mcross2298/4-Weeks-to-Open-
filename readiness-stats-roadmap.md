# Readiness/Recap re-placement — Dashboard → Stats (2026-08-03)

## Objective

The Dashboard Home screen currently renders, in order: momentum/today strips
→ **Readiness board** (9-chip muscle recovery grid) → **"This Week" recap
card** (Strain/Readiness rings + Workouts/Sets/Tonnage/PRs + 7-day spark) →
**Current Program hero** → Coach Note → Calendar → **Programs rail**. Both
new modules sit directly above the two things a trainee opens the app to
reach — the active program and the programs list — pushing them below the
fold. Owner decision (session 2026-08-03, via `AskUserQuestion`): shrink both
into a single glanceable strip and move the full detail to the Stats page,
which gains a real "review past weeks" workflow.

## Scope

- `dashboard.html` — remove the full Readiness board + This Week card from
  their current position (before Current Program); Current Program/Programs
  rail become the first things after the momentum/today strips as a result.
  Add one slim "pulse strip" (readiness % + this-week workout count + link)
  after the Programs rail.
- `mc-readiness.js` — drop the now-dead `renderBoard()` dashboard renderer
  and its dashboard-only CSS (`.ready-board`/`.ready-chip`/etc., injected via
  JS). The data API (`byMuscle`/`score`/`stale`/`overall`) and the exercise-
  card freshness dot (`decorateCards`) are unchanged — nothing else in the
  fleet reads the removed renderer, confirmed by repo-wide grep for
  `readinessBoard`/`ready-board`/`ready-chip` before removal.
- `mc-recap.js` — drop the now-dead full `#recapCard` renderer (`render()`,
  `renderReadout()`, `animateRingsIn()`) and its dashboard-only CSS. Keep
  `weeklyStats()` (mc-macros.js's training-load heuristic depends on its
  exact trailing-7-day contract — untouched). Add `statsForWeek(offset)` —
  a **calendar-week** (Mon–Sun) version, distinct from `weeklyStats()`'s
  trailing-7-days-from-now window, for the Stats week-picker. Add
  `renderPulseStrip()` for the new dashboard strip.
- `stats.html` / `mc-stats.js` — new "Weekly Review" section: a prev/next
  week picker, that week's Workouts/Sets/Tonnage/PRs + spark (via
  `MC_RECAP.statsForWeek`), and a muscle-group panel underneath.

## The readiness-history snag (resolved via a second `AskUserQuestion`)

Recovery % is inherently a live "right now" figure (hours-since-trained
relative to the current moment) — there's no honest way to answer "what was
my Chest readiness on July 20th" without snapshotting daily, which the owner
declined (chose live recompute, no new storage, in the first round). Owner
decision: the muscle panel shows the **live 9-chip Readiness grid** only for
the current week (offset 0); any past week shown in the picker swaps to
**that week's actual volume-by-muscle split** (sets/tonnage per muscle,
fully reconstructable from the dated log — the same computation
`mc-stats.js`'s existing "Volume by Muscle Group" section already does for a
30-day window, just re-scoped to the picked week).

## Not in scope

No new Supabase tables, no localStorage schema changes, no snapshot/archival
job. Everything renders from the existing `mc_workout_log_v1` log, computed
on demand.

## Docs

`quick-tour.html` / `quick-tour-overview.html` both currently describe the
Readiness board and This Week/Readout card as dashboard features — updated
in the same piece of work per the Documentation currency rule, since this
changes what a trainee sees on Home and adds a new Stats capability.
