# Command Center Roadmap (training)

The plan from the owner's interview of Nov 23, 2026: five rounds on why the
app gets opened, how Home's figures should read, where a tap goes nowhere,
what may run without being asked and what a push may carry. It follows the
shape of the household finance app's Command Center interview, from the
athlete's point of view only. Trainees and the Rolodex build are out of
scope. The questions skip ground already settled elsewhere: the five nav
tabs, the Readiness Brief, the streak rule, the 48px / 8px / 13px floor, the
Sunday check-in, and double progression.

The executive round that followed is in
[`autonomy-exec-roadmap.md`](autonomy-exec-roadmap.md). Scratch-listed
(`content-manifest.json`), so it never ships to the public Rolodex build.

## Status

| PR | What | Status |
|---|---|---|
| 1 | Home figures: block position row with vs last week, a block progress ring, the block sheet (done, missed, rest, upcoming), a sync chip shown only when something is waiting | Built |
| 2 | Drill-downs: Recovery explained (per muscle and the Recovery ring), tappable readiness chips, last-time compare on workout detail, a lift history sheet | Built |
| 3 | Visuals and normal: the training calendar shaded by volume (a day opens its workout), and "what's normal", a trailing six-week sets, volume and sessions line | Planned |
| 4 | Autonomy: auto-finish a stale session, a Done-for-you log with Undo, the kill switch (from the executive round) | Planned |

Each PR keeps its own `AskUserQuestion` check-in before it starts, per the
multi-phase rule in `CLAUDE.md`.

## Decisions on record (owner, Nov 23, 2026)

| Question | Answer |
|---|---|
| What opens the app? | Walking into the gym, and checking progress. Not planning, not a push. |
| The one thing on top of Home? | Today's session (the day module, as now). |
| What does "on track" mean? | Adherence: prescribed days done, rest days counting as done. |
| When it isn't on track? | **Silent.** No verdict word or color. Home shows the figures and the athlete judges. |
| Figures under today's session | Block position (week X of Y, day N of M). |
| Comparison | Against last week. |
| Figures doubted | Recovery / readiness, and nutrition totals. |
| Sync status | Shown only when something is waiting. Hidden while synced. |
| Where taps dead-end | Owner asked for an investigation (below). Fix: Recovery explained, last-time compare, the block sheet. |
| Visuals | A training calendar heatmap and a block progress ring. |
| Drill depth | Two levels at most, as sheets. |
| A lift's tap | A lift history sheet: e1RM trend, best set, last five sessions, next suggested load. |
| Questions no screen answers | What's normal (trailing six weeks). |
| What runs on its own | Auto-finish a stale session, and a weekly backup when signed out. Each says so afterwards, with Undo. |
| How far may it advise | Suggest, the athlete decides (as now). It never changes the program. |
| Pushes | Keep as is: PRs and the Sunday check-in. |
| Figures in pushes | Yes. |
| Goals on Home | None. Progress shows through trends. |
| First to build | Home figures and the block. |

### The dead-end investigation

The owner asked for this to be found rather than answered, so it was read
from the source (a browser run with the fixture athlete was refused in this
session's sandbox, so nothing below was driven). Each item names where it
lives:

- **Streak strip** (`#momentumStrip`, `dashboard.html`): not tappable.
- **Recovery ring** (`#vitalsStrip`): only its Log button acts. The score
  never says what it is made of.
- **Stats readiness board** (`mc-stats.js`, the `.ready-chip`s under Current
  Readiness): static. The figure is only in a `title` tooltip, which a phone
  never shows. The body-map legend chips do act, but they open one
  exercise's trend (`MCTrends.open`), not why the muscle reads as it does.
- **Macro rings** (`mc-macros.js`, `.nt-ring`): not tappable.
- **Workout detail** (`workout-detail.html`): nothing sets a session beside
  the last time that day was trained.
- **The block**: the week bar (`mc-week-bar.js`) pages weeks, but nothing
  shows the whole block, with done and missed days counted.

Two taps already go somewhere: the Today strip opens Nutrition, and the
weekly pulse strip opens Stats. The owner chose to fix Recovery, last-time
compare and the block. The streak strip opens the block sheet too. The macro
rings stay as they are.

### Where an answer met an existing rule

- **Silent, beside the Readiness Brief.** `H4`'s brief (`mc-readiness-brief.js`)
  stays as built. It opens from Start Day N and is a recovery map, not a
  verdict. Home adds no verdict of its own.
- **Recovery is doubted, and accepted as a model** (executive round). So the
  Recovery sheets explain the figure and label it an estimate. They never
  present it as a measurement. The two figures stay separate, as `H3`
  decided: per-muscle recovery (`mc-readiness.js`, from logged sets) and the
  Recovery ring (`mc-vitals.js`, from sleep and resting HR). Each gets its
  own sheet. Neither feeds the other.
- **Nutrition totals are doubted, and accepted as the cookbook's.** Nothing
  is built for them, and the macro rings stay without a drill-down.
- **"vs last week" on block position.** Moving a week ahead is not a change
  worth showing. The comparison is days done this week against days done by
  the same weekday last week.
- **Block position needs a real schedule.** Only `ss`, `mm` and `hv` carry a
  `schedule` record. For the other programs the row and the block sheet are
  not shown, and no schedule is invented for them (`F1b` and `F4`'s rule).
  Phase 4's history-inferred rest pattern answers the streak, not the block.
- **The sync chip and the offline bar.** `#offlineBar` already says when the
  device is offline. The chip covers what the bar doesn't: sets waiting in
  the outbox (`mc_workout_logs_outbox_v1`) and a last pull older than a day
  while signed in. With nothing waiting it is hidden.
- **The lift sheet extends `MCTrends`.** `mc-exercise-trends.js` already
  charts top weight, e1RM and reps per session. It is the one sheet. The new
  parts are the best set, the last five sessions and the next suggested load
  (`mc-suggest.js`). It opens from a lift name on History, workout detail
  and Stats, and from the ⋮ menu and "Last:" cue as now. **In a session a
  lift name stays inert**: the QA collision audit decided that a card with a
  set logger is completed by its sets only. A name tap there must not start
  doing something new.
- **The heatmap uses the existing calendar.** `#calendarCard`
  (`mc-calendar.js`) already lays out the month and opens a day. PR 3 shades
  its cells by the day's volume. It does not add a second calendar.
- **Figures in pushes are already sent.** The PR push carries the weight and
  the weight it beat (`mc-setlog.js`). "Yes" keeps that. Nothing changes,
  and no per-phone switch is added.
- **No goals.** The block ring shows how much of the block is done, which is
  position rather than a target. No goal store is added.
- **Auto-backup on the web.** A page cannot save a file to the phone without
  a tap, so a fully automatic weekly backup file cannot be built as asked.
  A copy in the app's own storage would not survive a lost phone either.
  **Decided (owner, Nov 23, 2026): keep the R7 backup nudge as it is.** No
  automatic backup is built.
- **Auto-finish and the resume window.** `mc-resume.js` drops a session
  snapshot after 36 hours. Auto-finish acts at 12 hours, checked when the app
  next opens (a PWA has no background run). It banks through the same path
  Finish uses, so the workout log, the program cursor and
  `mc:workout-finished` agree. Undo removes it through the deletion records
  (`mc_workout_log_deleted_v1`) and puts the session back.

## PR 1 as built

- **`mc-block.js` (`window.MC_BLOCK`)** renders the block from
  `mc-program-progress.js`'s record and keeps no state of its own.
  `summary(rec, now)` gives the week and day, training days done out of the
  block's (rest days never counted, each week's own rest pattern respected),
  and this week against last week. Those two are counted by when a day was
  done: Monday to now, against last Monday to the same moment a week ago.
  `grid(rec, now)` marks every day done, missed, rest, today or upcoming;
  missed is a training day before the current one with no completion.
- **The block row** (`#dmBlock`, under the day module): `Week X of Y · Day N
  of M`, `N days this week · ↑1 vs last week` (only a drop is colored), and
  a 44px progress ring with its percentage. The whole row is one 48px+
  button; its label reads every figure.
- **The block sheet**, from the row and from the streak strip (which was a
  dead end): each week as a row of seven 48px cells, deload weeks labelled,
  today scrolled into view. A done day opens its workout
  (`workout-detail.html`), the second and last level. Adopted by
  `mc-sheet.js` (dialog role, focus, Escape and Back). Text on a done day is
  the darkest or lightest end of the ink ramp, picked from the accent's own
  luminance (`inkOn()`), so it holds in the light theme: 5.39:1 on the
  Modality Matrix's accent.
- **The sync chip** (`#syncChip`, under the top bar, beside the offline
  bar): shown when sets wait in the outbox, a store can't be written
  (storage full), or a sync failed after the last good one. Hidden
  otherwise, and while offline the offline bar speaks instead. It opens
  Diagnostics. Checked on load, on coming back online and on returning to
  the app; no timer, so the perf gate's counters don't move.
- `tools/test-mc-block.js` (24 assertions, vm-sandboxed against the real
  source) runs in `verify.yml` beside the progress tests.
  `quick-tour-data.js` describes the row and the sheet.

Where it departs from the plan:

- **No "last pull older than a day" signal.** `mc-sync.js` keeps `lastPull`
  in memory only, so a fresh page always reads 0. The chip uses a failure
  newer than the last good pull or push instead (`lastError.at`, which
  `mc-sync.js` never clears).
- **The chip sits under the top bar, not in it.** The bar is a row of 48px
  icons with no room for text at 320px, so the chip takes the offline bar's
  place in the layout.

Verified with the fixture athlete in headless Chromium at 390 and 320 (no
sideways scroll, every cell 48px, Escape closes, a done day opens its log),
with progress seeded in the light theme, and through `check-fixture`,
`check-tap-intent`, `smoke-test-pages` and both contrast ratchets (which
measure Home at rest, not the open sheet; the sheet's contrast was measured
by hand above).

## PR 2 as built

- **Recovery, per muscle.** `MC_READY.explain(id)` in `mc-readiness.js`
  returns what a muscle's figure is made of: the last workout that trained
  it, its sets for that muscle and how many went to failure, the curve's
  time constant, the hours until it reads fresh (70%), and each lift with
  its sets. It reads the same `lastStimulus()` and time constant that
  `recoveryFor()` uses, so the sheet can't explain a different number from
  the one shown. `mc-recovery-sheet.js` (`MC_RECOVERY_SHEET.muscle()`)
  shows it, labelled an estimate, with how it's worked out. The last
  workout row opens that workout and each lift row opens its history: the
  second and last level.
- **Where it opens.** On Stats, This Week's Readiness chips were divs whose
  figure lived only in a `title` tooltip. They are 48px+ buttons now (79px
  measured) that show the % and open the sheet. In Recovery mode the body
  map's legend chips open it too; in Volume mode they still open the
  muscle's top lift.
- **The Recovery ring.** `MC_VITALS.explain()` returns the score's parts:
  the readiness answer that sets the start, sleep's nudge, and resting HR
  shown but not counted. `MC_RECOVERY_SHEET.vitals()` opens from the ring
  and its line on Home (`#vtOpen`, a 48px button). The parts are tested to
  add up to the ring.
- **Last time.** Workout detail sets each lift beside the last session
  before this one that included it: top set, total reps, and how far the top
  weight moved, or "First time logged". The line opens that earlier
  workout, and the lift's name opens its history.
- **Lift history sheet.** `MCTrends` (`mc-exercise-trends.js`) gains the
  next suggested load (with mc-suggest.js's reason), the best set
  (heaviest, more reps breaking a tie), and the last five sessions, each
  opening its workout. Its tabs went from about 30px to 48px and from 11px
  to 13px text. It opens from a lift's name on workout detail and from each
  record in Stats' Personal Records and Verified Maxes, as well as from the
  ⋮ menu and the "Last:" cue as before.
- **Finding the next load off a workout page.** `mc_plan_targets_v1` is
  keyed by page and card, which a page with no card can't derive.
  `mc-suggest.js` now records the lift's name with each carried-forward
  target (`n`), and the sheet finds the newest target with that name.
  Targets written before this change have no name, so they show "none yet"
  until the lift's workout is opened again.
- `tools/test-mc-lift-sheet.js` (14 assertions: next load, best set, the
  vitals parts adding up) and 9 new `explain()` checks in
  `tools/test-mc-readiness.js`. Quick Tour updated.

Where it departs from the plan:

- **Last time is the last session with that lift, not "the same program
  day".** A finished workout doesn't record which program day it was
  (`cat-strength` logs every day under one page and title), so "same day"
  can't be found reliably. The last session that included the lift always
  can.
- **History's list doesn't open the lift sheet.** Each row in History is
  already one tap target that opens the workout; putting a second target
  inside it is the collision `qa-collision-audit.md` warns about. The lift
  names are tappable one level in, on the workout itself.
- **A light-theme defect fixed in passing.** Workout detail's lift names
  were white on the light theme's light card (1.12:1, now 15.54:1). The
  contrast gate opens that page with no workout loaded, so it never saw
  them. Its set numbers still read 3.32:1 there, and that is left as it
  was.

Verified with the fixture athlete at 390 and 320 in headless Chromium:
every sheet is a dialog with no control under 48px and no sideways scroll,
each hop lands on the right lift or workout, and there are no page errors.
In the light theme the Recovery sheet's text measures 4.83 to 14.34:1 and
the last-time line 5.23:1.

## PR 3: visuals and normal (planned)

- The calendar's day cells shaded by that day's working sets. The number
  stays on the surface color and a swatch carries the shade, so contrast
  never depends on volume. Rest days have their own mark.
- **What's normal:** weekly sets, volume and sessions averaged over the up to
  six finished weeks before this one (shown only with three or more), and
  this week beside it. On Stats, and as one line in the block sheet.

## PR 4: autonomy (planned)

The rules are in `autonomy-exec-roadmap.md`: the Done-for-you log, Undo,
and the kill switch after two Undos in 30 days. Auto-finish as described
above. No automatic backup (the owner kept the R7 nudge as it is).
