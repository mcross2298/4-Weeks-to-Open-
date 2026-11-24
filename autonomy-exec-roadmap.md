# Autonomy Roadmap (executive interview, training)

The plan from the owner's executive round, Nov 23, 2026. It came after the
Command Center interview ([`command-center-roadmap.md`](command-center-roadmap.md))
and repeats none of its questions. That interview decided what Home shows
and does. This round decided what success is, how far the app may go, the
risk accepted and how it is measured. It follows the shape of the household
finance app's executive interview, from the athlete's point of view.

Scratch-listed (`content-manifest.json`).

## Status

| Part | What | Status |
|---|---|---|
| 1 | Kill switch: an automatic action undone twice in 30 days pauses and asks instead | Built (with Command Center PR 4) |
| 2 | Friction measured: open-to-first-set seconds and taps per logged set, per phone and week, synced, in a monthly report | Planned |
| 3 | The iOS crash-journal check: a manual script the owner runs on the iPhone, results recorded here | Planned |

## Decisions on record (owner, Nov 23, 2026)

| Question | Answer |
|---|---|
| What decides, at 12 months, whether the app worked? | **Less friction in the gym.** |
| How far may the app ever go with training? | **Logbook and suggestions.** It records and suggests. It never changes a program, a load or a day on its own. |
| When an automatic action stops acting | After **2 Undos of that action in 30 days**. It asks instead until turned back on. |
| Risks accepted, nothing built | Recovery % is a model, not a measurement. Nutrition figures are the cookbook's. |
| Risks not accepted | The IndexedDB crash journal untested on iOS. A signed-out phone lost. |
| The friction target | **Both**: open to first ticked set under 30 seconds, and one tap per set when the suggestion is taken unchanged. |
| How it is measured | The app logs it, synced, per phone and week. |
| The untested iOS journal | Verified on the owner's iPhone by a manual script. |
| A lost signed-out phone | No further answer chosen. The backup nudge (R7) stays as it is; no automatic backup is built (owner, Nov 23). Recorded as an open risk. |
| Attention between gym sessions | **None unless the app is opened.** No new nudges. |

### Where an answer met an existing rule

- **"Logbook and suggestions" against the deload.** A scheduled deload week
  already builds fewer sets (`reduceFor()` in `mc-setlog.js`, phase C).
  That is the program's own prescription, written by its author, not a
  change the app makes. It stays. Lighter stays a tap the athlete makes.
- **What the kill switch covers.** Auto-finish, the one automatic action.
- **Attention: none.** No push type is added (Command Center: "keep as is").
  The Done-for-you log is read when the app is opened, never pushed. The
  monthly friction report is a screen, not a notification.
- **What is logged.** Whole seconds, tap counts and opens only, never which
  screen or which lift, as in the finance app's `data.usage`. A new
  `mc_usage_v1` store goes into `store-registry.json` in the same change,
  with its own merge rule (per phone and week, so two phones never write
  the same row).
- **The iOS check is the owner's to run.** It cannot be run from an agent
  session (`B5`'s constraint). The script below is written; the result is
  recorded here once it has been run. Until then the journal stays verified
  in Chromium only.

## Part 1 as built: the kill switch

- `mc-auto.js` logs each automatic action in `mc_auto_v1` (`act:<n>`) for
  30 days. `undo()` stamps `undoneAt` on the action.
- `undoCount()` counts a kind's Undos within 30 days and since it was last
  turned back on (`pause:<kind>.resumedAt`). The second sets
  `pause:<kind> = { paused: true }`, and `undo()` returns `'paused'`. Home
  then says so once.
- While paused, `finishStale()` banks nothing. Home asks about the stale
  session instead: Bank it (the athlete's own act, not logged as automatic)
  or Leave it. Either way that session is left alone afterwards.
- Settings → Help → Done for you shows the paused state with Turn back on
  (`resume()`), which records `resumedAt`, so the old Undos stop counting.
- `tools/test-mc-auto.js` holds all of it: one Undo doesn't pause, the
  second within 30 days does, a paused action banks nothing, and after
  Turn back on one more Undo doesn't pause again.

## Part 2: friction measured (planned)

- **Open to first set:** from the page load that opened a session to its
  first ticked set, in whole seconds, one figure per session.
- **Taps per logged set:** taps on the session surface between one tick and
  the next, divided by sets logged. Counted separately when the suggestion
  was taken unchanged (`dataset.ghost` still set at the tick), since that is
  the case the target names.
- `mc_usage_v1[device][monday] = { sessions, firstSetSecs[], taps, sets, ghostSets, ghostTaps }`,
  kept 13 months, synced.
- A monthly report under Stats: each week's median open-to-first-set
  against 30 seconds, and taps per unchanged set against 1.

## Part 3: the iOS crash-journal check (script)

Run on the iPhone, from the Home Screen app, signed out so only the device
holds the sets:

1. Open a workout, tick one set.
2. Within one second, swipe the app away from the app switcher.
3. Reopen it from the Home Screen and open the same workout.
4. Record whether the tick is there. Repeat at roughly 0.5 s, 1 s and 3 s,
   and once with an untick instead of a tick.
5. Note the iOS version.

Result: not yet run.
