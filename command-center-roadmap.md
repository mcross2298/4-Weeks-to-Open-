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
| 1 | Home figures: block position row with vs last week, a block progress ring, the block sheet (done, missed, rest, upcoming), a sync chip shown only when something is waiting | Planned |
| 2 | Drill-downs: Recovery explained (per muscle and the Recovery ring), tappable readiness chips, last-time compare on workout detail, a lift history sheet | Planned |
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

## PR 1: Home figures and the block (planned)

- A block row under the day module: `Week X of Y · Day N of M`, and days
  done this week against the same weekday last week (an arrow and the
  change; only a drop is colored). Read from `mc-program-progress.js` and
  the program's `schedule`. Hidden without a schedule.
- A block progress ring beside it (`MC_CHART.ring`): prescribed days done
  out of the block's training days. Rest days are not counted.
- The block sheet, from the row, the ring and the streak strip: each week as
  a row of days marked done, missed, rest or upcoming, today marked. A done
  day opens its workout (`workout-detail.html`), its second level. Built on
  `mc-sheet.js`.
- The sync chip in the top bar, shown only when something is waiting.
- Controls at 48px with 8px between. The fixture athlete gets a schedule
  so `check-fixture.js` renders the row. `quick-tour-data.js` gains the
  block sheet per the documentation rule.

## PR 2: drill-downs (planned)

- **Recovery, per muscle:** a sheet listing the sessions and sets that
  loaded each muscle in its window, its estimated recovered %, and when it
  reads fresh again, labelled an estimate. It opens from the Stats readiness
  chips (made into 48px buttons) and the body-map legend. The legend chip's
  link to an exercise trend moves into the sheet as one of its rows.
- **Recovery ring:** a sheet of the score's inputs (sleep, resting HR, the
  readiness answer) and how each moved it, from `mc-vitals.js`'s own
  `recoveryScore()`.
- **Last time:** workout detail sets each lift beside the previous session
  of the same program day: top set and total reps, with the change.
- **Lift history sheet:** `MCTrends` gains the best set, the last five
  sessions and the next suggested load. Lift names on History, detail and
  Stats open it.

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
