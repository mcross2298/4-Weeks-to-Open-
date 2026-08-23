# Program Day View roadmap — `D0–D3`

**Opened 2026-08-23.** Governs the UI/UX refactor of the **Strength & Supersets**
(`ss`, `cat-strength.html`) program view from a dashboard-style split picker into
a full-screen, day-by-day active workout module: a paginated weekly schedule bar,
a stateful hero card for the current day, automatic progression on completion,
a rest-day recovery state, and a program context drawer.

Scratch-listed in `content-manifest.json`, so it never ships to the public
Rolodex build.

---

## Decisions locked (AskUserQuestion, 2026-08-23)

Four decisions were put to the owner before any code was written. All four
recommendations were taken.

1. **Progression state → a new local store, synced.** `mc_program_progress_v1`,
   declared in `store-registry.json`, registered in `mc-sync.js` under the
   existing **`dictBase`** strategy (per-program key granularity, exactly as
   `mc_weekly_overrides_v1` already works) and added to `mc-export.js`'s `KEYS`.
   **No Supabase migration.** There are no `user_programs` / `program_days` /
   `completed_logs` tables today and none are added here — Supabase in this app
   is auth, PM publishing, backup status and food lookups, not workout
   progression. Cross-device coverage comes from the existing sync layer.

2. **Rest day → recovery hero + next-session peek.** Slate/teal accents matching
   the Weekly Layout Standard's governed Day 6 (`#0d9488`) / Day 7 (`#334155`)
   palette, showing days since last session, this week's completed count, a
   preview of the next training day, and an explicit "Train anyway" override.

3. **Three shared `mc-*` modules**, not one bundle and not page-local:
   `mc-week-bar.js`, `mc-day-hero.js`, `mc-program-menu.js`, plus one
   `mc-program-day.css`. Reusable by the other nine `cat-*.html` programs later.
   The state layer is a fourth module, `mc-program-progress.js` — the three view
   modules are pure renderers over it and hold no state of their own.

4. **Synthetic accent art, not photography.** The repo ships zero photo assets
   and `mc-program-hero.js` already renders a deliberate accent-stripe band
   (`.pl-imgband`) in place of imagery. The day hero extends that treatment
   per-day rather than introducing a photo pipeline, a precache size decision
   and a licensing question all at once.

---

## Findings from scoping (measured, not assumed)

**`cat-strength.html` cannot derive day-level completion from history.** The page
is a three-view SPA (`#view-dashboard` / `#view-split` / `#view-workout`) serving
all five training days and all six weeks, and it does **not** set
`MC_PID_OVERRIDE`. Every module that keys off page identity —
`mc-finish.js`, `mc-setlog.js`, `mc-session.js`, `mc-summary.js` — therefore
resolves the same `pageId` (`cat-strength`) for Legs Week 1 and for Arms Week 6,
and the log entry's only other identifying field, `workoutName`, comes from
`document.title`, which is the constant string `Strength & Supersets`. Nothing in
`mc_workout_log_v1` distinguishes one day of this program from another.

`MC_PID_OVERRIDE` is not a fix here: every consumer captures it **at module load**
(`var PID = window.MC_PID_OVERRIDE || …` at IIFE top level), so setting it when
a workout view opens would be read by nobody. Changing that is a fleet-wide
contract change across five modules for one page's benefit.

So day identity is recorded **explicitly at completion time**, by the page that
already knows which day and week are active, into `mc_program_progress_v1`'s
`completed` map — with the finished log entry's `id` stored alongside it so the
completed-day hero's "View log →" can still deep-link into real history. The
workout log stays the source of truth for *what was lifted*; the progress store
is the source of truth for *which prescribed day that was*.

**`mc-finish.js` has exactly one completion point** — `window._FW.confirm()`,
which calls `saveWorkout()` and returns the banked entry. It emits no event, so
a same-page listener has nothing to hook. D1 adds one line there: a
`mc:workout-finished` `CustomEvent` carrying the entry. That is the whole
fleet-wide touch — 78 pages load this module and none of them listen, so the
event is inert everywhere it is not wanted.

**Gate exposure for `cat-strength.html`:** it is in `tools/smoke-test-pages.js`
and carries a `tools/contrast-budgets.json` budget of 1. It is **not** a
`check-journey.js` page, not a `check-visual-ratchet.js` baseline page, and not a
`measure-session.js` probe page. It is unique by filename, so
`check-script-manifest.py`'s family check does not apply — but the capability
contract half of that tool does, and new `<script>` tags must not break it.

---

## Phases

### `D0` — state layer

`mc-program-progress.js`, exporting `window.MC_PROGRAM_PROGRESS`
(`MC_UPPER_SNAKE`, per `tools/check-exports.js`).

Store shape, keyed by program id:

```
mc_program_progress_v1 = {
  "ss": {
    startedAt: "<iso>",
    weeks: 6, perWeek: 7,
    order: [ "legs", "chest", "back_shoulders", "arms_forearms", "cardio_calves" ],
    rest: [ 6, 7 ],                       // 1-based positions within a week
    weekOrder: { "2": [ ... ] },          // per-week reorder override, sparse
    completed: { "8": { ts, workoutId, week, logId } },
    ts: <ms>
  }
}
```

Day numbers are **continuous across the block** (`Day 8` = week 2, position 1),
matching the reference. `weeks × perWeek` is the block length. Rest positions are
data, defaulting to the Weekly Layout Standard's 5-on-2-off (`[6, 7]`), never
hardcoded in a renderer.

Registered in `store-registry.json`, `mc-sync.js` `STORES` (`dictBase`) and
`mc-export.js` `KEYS` in the same change, as the store rule requires.

Covered by `tools/test-mc-program-progress.js` (vm-sandboxed against the real
source, the `test-mc-bridge.js` technique) and wired into `verify.yml`.

### `D1` — progression + completion signal

`mc-finish.js` emits `mc:workout-finished`. `cat-strength.html` listens, marks
the active day complete, and advances the cursor to the next chronological day —
training day or rest day, whichever comes next.

### `D2` — the three view modules

* `mc-week-bar.js` (`MC_WEEK_BAR`) — paginated 7-day pill row, `‹`/`›` week
  arrows, per-day state (active / complete / rest / future), tap-to-jump.
* `mc-day-hero.js` (`MC_DAY_HERO`) — training, completed and rest hero states;
  stats grid; `View workout` + `Start Day X`, swapping to `View log →` when done.
* `mc-program-menu.js` (`MC_PROGRAM_MENU`) — the six-action drawer, built on the
  existing `.mc-menu-overlay` / `.mc-sheet` / `.mc-item` bottom-sheet CSS rather
  than a second sheet implementation.

All three are pure renderers over `MC_PROGRAM_PROGRESS`; one `mc-program-day.css`
carries their styles, light-theme variants included (the page has a contrast
budget).

### `D3` — page integration + docs

`cat-strength.html` mounts the components above its existing views and maps a day
number to the workout its `PMC_SPLITS` data already defines. Reorder and restart
write through the state layer. Per the documentation currency rule, this is a
user-facing feature: `ss-instructions.html` and `quick-tour.html` are updated in
the same change.

---

## Non-goals

* **No badge/achievement system.** The reference's "Badge Unlocked!" banner has
  no data source in this app — there is no achievements store, table or module.
  The hero reserves a slot for a banner and renders nothing into it; inventing an
  achievement engine is a separate feature, not a UI refactor.
* **No photography pipeline** (decision 4).
* **No rollout to the other nine `cat-*.html` programs.** The modules are built
  to be reusable and are mounted on one program. Fleet rollout is its own phase
  with its own per-program data work.
