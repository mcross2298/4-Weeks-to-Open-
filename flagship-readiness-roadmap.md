# Flagship readiness roadmap

Opened 2026-10-23 against `main @ 27fc096`. This is the repository copy of a
three-phase audit of the app, run with the owner over three `AskUserQuestion`
alignment rounds:

| Phase | What it covered | Published report | Repository copy |
|---|---|---|---|
| 1 · Health audit | Codebase health, VOC/VOA journeys, top pain points, design upgrades | https://claude.ai/artifact/4fdtxhosnkwn7rJspwuDgs | [`GO_LIVE/flagship-audit/phase1-health-audit.html`](GO_LIVE/flagship-audit/phase1-health-audit.html) |
| 2 · Master audit | Program engines and formulas, parameter verification matrix, tab-by-tab compliance | https://claude.ai/artifact/EVshNAH1dQB3bnTAQfp7qb | [`GO_LIVE/flagship-audit/phase2-master-audit.html`](GO_LIVE/flagship-audit/phase2-master-audit.html) |
| 3 · Gym readiness | Real-world stress: interruptions, offline, screen lock, swaps, prefill, ergonomics, data mobility | https://claude.ai/artifact/6ZMwVdJcpnM4KnzkjCQtda | [`GO_LIVE/flagship-audit/phase3-gym-readiness.html`](GO_LIVE/flagship-audit/phase3-gym-readiness.html) |

Runnable reproductions live in [`GO_LIVE/flagship-audit/scenarios/`](GO_LIVE/flagship-audit/scenarios/)
and their captured output in [`GO_LIVE/flagship-audit/evidence/`](GO_LIVE/flagship-audit/evidence/).
This file and that directory are scratch-listed in `content-manifest.json`, so
neither ships to the GitHub Pages deploy or the public Rolodex build. Several
findings are operational (an unset secret, an Auth setting) and don't belong on
the live site.

## How to use this roadmap

- Per CLAUDE.md's Planning rule, this roadmap is the discovery artifact for the
  phases below. Each phase still opens with its own `AskUserQuestion` check-in,
  per the multi-phase rule.
- Every step names an **acceptance check** from the scenarios. The checks
  assert the *decided* behavior, so on the audited tree they fail by design. A
  step is done when its check flips to PASS and the existing CI gates stay green.
- The scenarios are deliberately **not** wired into `verify.yml`. A gate that
  is red from birth gets turned off (`W-I1`). Wire each check into CI as its
  fix lands.

| Scenario | Runs | On `main @ 27fc096` |
|---|---|---|
| `fa-engines.js` | Node only, real modules | 3 pass, 11 fail |
| `fa-repro.js <baseUrl>` | headless Chromium | 2 controls pass, 21 fail |
| `fa-offline-sw.js` | real `sw.js` on a mirrored production origin | 3 controls pass, 4 fail |
| `fa-kill-window.js <baseUrl>` | persistent profile + SIGKILL (measurement) | lost at 0.3 s and 1.5 s, kept at 3 s and 6 s |

## Decisions locked with the owner

**Round 1 (health audit).** Data integrity first. Retire `run-workout.html`'s
own Finish and route through `mc-finish.js`. A delete applies everywhere, as a
deletion record that syncs. All four design tracks are in scope: session
declutter, token gate plus migration, touch and navigation consistency, and
builder redesign.

**Round 2 (master audit).**
- Progression is per set: rep ranges target the **top** of the range, and a
  session with fewer sets logged than prescribed holds.
- Machine, cable and plate-loaded steps follow CLAUDE.md Task 3.3's **×0.5**
  rule, with a tightened big-lift pattern, because "bench" used as a prop
  isn't a big lift.
- A **real deload** cuts a third to half of working sets and caps intensity cues.
- **One shared sheet and navigation contract**: dialog semantics, focus,
  Escape, scroll lock, and Back closes the sheet and returns from a day to its list.

**Round 3 (gym readiness).**
- A **whole-session wake lock** from the first logged set to Finish,
  re-acquired after every interruption, with a "Keep screen on during
  workouts" setting.
- **Swaps are today-only by default**, with an opt-in "keep". A substitute's
  sets are recorded under the substitute's own history.
- The **48px touch-target floor with 8px spacing** from the owner's UI
  standard replaces the 44px floor, and the CI gates move with it.
- This PR carries the artifacts and this roadmap; fixes ship phase by phase.

**Defaults, which the owner may override:**
- CSV export.
- Merge-safe import with a preview and confirmation.
- A backup nudge plus a share-sheet save for signed-out athletes.
- An optional IndexedDB crash journal, verified on iOS first.
- Fix High-Volume's description rather than re-author its workouts.
- A structural tempo badge on Modality Matrix Pos 4.
- Strength & Supersets' schedule record generated from its page data.
- A single-rep set is its own max.

## Health snapshot (`main @ 27fc096`)

- 52 of 52 static gates pass. 7 of 8 browser gates pass: the `check-journey`
  failure is the back link's text *width*, which CLAUDE.md records as a sandbox
  Chromium build difference.
- 38 of 38 smoke pages render with zero console errors. Contrast is within
  budget in both themes.
- Scores (judgment on stated rubrics, not measurements): code health **68/100**,
  architecture **8/10**, real-world gym readiness **53/100**.

## Defect register

Severity is harm × reach, in my judgment. "Check" is the acceptance check that
must flip.

| ID | Defect | Root cause | Check | Sev. | Step |
|---|---|---|---|---|---|
| D-01 | A week, phase or cycle tab round trip deletes the live session, on all 7 tabbed engines | `mc-session.js:359` wires the DEF-CR-02 re-restore only inside `if (session)`; `save()` then deletes the record on zero ticks (`:128`) | R-01 | Critical | R1 |
| D-02 | Custom workout's bottom Finish saves 0 sets | `run-workout.html:368` `finishWorkout()` reads the pre-Phase-2.1 `card.dataset.id` key | R-02 | Critical | R1 |
| D-03 | An unticked set is still saved at Finish | `mc-setlog.js:1083` uncheck branch removes the cloud row and re-arms pending, never the local set | R-03 | High | R1 |
| D-04 | A running rest timer is never persisted, and a restore wouldn't show it | `mc-session.js:304` records the timer before the original `start()`, whose `stop()` nulls it; the restore uses `TMR.setTime` (float only) | R-04 | High | R1 |
| D-05 | A typed but unticked weight is lost if interrupted while focused | `mc-setlog.js:1665` saves pending only on `blur` | R-05 | Medium | R1 |
| D-06 | No wake lock during the first exercise | `mc-summary.js:359,426` start the session lock only at `exDone > 0`; `mc-live-tracker.js:297` watches `#timerFloat`'s class | R-06 | High | R2 |
| D-07 | The session wake lock isn't re-acquired after an interruption | `mc-live-tracker.js:151` re-acquires only while a rest runs | R-07 | High | R2 |
| D-08 | The suggested load never reaches the one-tap prefill | `mc-suggest.js:355` skips any non-empty field; since S2 the ghost fills every field's value | R-08 | High | R4 |
| D-09 | A swap writes the substitute's sets into the original lift's history | identity is `origNameOf()` (Phase 2.1), so the key never follows a swap | R-09 | High | R5 |
| D-10 | Swaps are global and permanent by default, leaking into other programs | `mc-card-actions.js:482` `applySwap()` writes `mc_replacements_global` | R-10 | Medium | R5 |
| D-11 | History shows storage keys (`x-incline-db-press`) | `mc-finish.js:153` names each set by its key segment | R-11 | High | R4 |
| D-12 | History keys collide: 12 keys shared by 34 catalog exercises | `mc-setlog.js:1761` truncates the slug to 24 characters | R-12 | High | R4 |
| D-13 | Muscle attribution from stored keys drifts on 187 of 580 exercises | consequence of D-11 | R-12 (info) | Medium | R4 |
| D-14 | Restoring an older backup erases newer workouts, with no confirmation | `mc-export.js:87` `importJSON()` overwrites each store | R-13 | High | R1 / R7 |
| D-15 | The Back gesture leaves an open day for the dashboard | no `popstate` handling anywhere | R-14 | Medium | R5 |
| D-16 | Sheets lack the contract: of 11 overlays, 3 dialog roles, 4 move focus, 1 closes on Escape, 1 locks the page | each module builds its own overlay | R-15 | Medium | R5 |
| D-17 | A deploy evicts prefetched program pages while "Available offline ✓" stays | `sw.js:182` `activate` deletes old caches; `mc-offline-prefetch.js:59` keeps a 14-day record with no cache-version tie | S-06, S-07 | High | R3 |
| D-18 | History, Stats, Library and Builder are unavailable offline | not precached; on the prefetch blocklist | S-04 | Medium | R3 |
| D-19 | Per-set cloud inserts made offline are dropped | `mc-setlog.js:1175` swallows the failure, no retry | — | Medium | R3 |
| D-20 | Going offline fills the 20-entry error buffer | `mc-sw-update.js:218` `reg.update()` rejections unhandled | S-05 | Low | R3 |
| D-21 | Progression targets the floor of a range and a pyramid's last rep; partial sessions progress | `mc-suggest.js:121` `topRep()`, `:184` `classifySession()` | E-01–E-05 | High | R4 |
| D-22 | 18 machine, cable or plate-loaded big lifts step 2.5 lb (spec: 5); a bench-as-prop curl steps 10 | `mc-suggest.js:71` `computeIncrement()` | E-07–E-09b | Medium | R4 |
| D-23 | A single-rep set reports a max 3.3% above the weight lifted | `mc-log-read.js:148` applies Epley at r = 1 | E-10 | Low | R4 |
| D-24 | A workout deleted on one device comes back on the next pull | `mc-sync.js:307` `mergeWorkoutLog()` is a pure union | E-12 | High | R1 |
| D-25 | Strength & Supersets week 6 is flagged as the deload but authored heavier; a deload is one set fewer | `mc-pm-data.js` `ss` schedule; `mc-setlog.js` `planFor()` | Phase 2 render | Medium | C |
| D-26 | Modality Matrix Pos 4 tempo cue lives only in notes ("2 s pause" in 6 of 60 cells) | `mm-data.js` | Phase 2 data | Low | C |
| D-27 | High-Volume "5–6 sets · 15–25 reps": 25% and 43% of exercises outside | `mc-pm-data.js` `hv` meta | Phase 2 render | Low | C |
| D-28 | Strength & Supersets day-hero set counts differ from the logger on 3 of 5 days | hand-typed `ss` record | Phase 2 render | Low | C |
| D-29 | The Modality Matrix landing title says "12-Week Program" | `cat-mm.html:6` | — | Low | C |
| D-30 | Against the 48px / 8px / 13px standard: 25 of 32 session controls under 48, set rows 3–7px apart, 35 text nodes under 13px, floating timer controls 24–38px | session CSS, `mc-timer.js` | Phase 3 sweep | Medium | R6 |
| D-31 | Light-mode suggested weight is 1.47:1 | `mc-setlog.css:93` keeps the dark `--ink-8` | — | Medium | R6 |
| D-32 | The token gate can't see JS-injected or inline CSS or `rgba()` (119 + 446 slate literals) | `tools/check-design-tokens.js` reads `.css` and hex only | — | Medium | G |
| D-33 | The weekly check-in has never sent | `WEEKLY_CHECKIN_SECRET` unset (workflow log, 18 Oct) | — | High | Owner |
| D-34 | Leaked-password protection is off | Supabase Auth setting | advisor | Low | Owner |
| D-35 | Field errors never leave the device | `mc_errors_v1` is local only | — | Medium | E |
| D-36 | No CSV export; no backup nudge for signed-out athletes | — | — | Medium | R7 |
| D-37 | An orphan set-logger on a licensed landing polls every 100 ms forever | `cat-gainz.html` WAVE3-SETLOG `watchForCards()` | — | Low | R1 |
| D-38 | Four pages write the workout log directly; three skip the storage-full warning | `run-workout.html` and three conditioning pages | — | Low | R1 |
| D-39 | Retention: 200 workouts (the cloud copy is trimmed too), 5 sessions per exercise | `mc-finish.js`, `mc-sync.js`, `mc-setlog.js` | — | Medium | R7 |
| D-40 | First visit: 38–53 scripts, 1.2–1.5 MB, first paint 2.5–4.1 s (emulated slow 3G) | no bundling (no-build stance) | — | Medium | J |

## Consolidated phases

Phase IDs come from the Phase 3 report (R1–R7) and Phase 2 report (C, E, G, J);
each folds in the overlapping Phase 1 and Phase 2 items.

### R1 · Never lose a set or a tick
Defects: D-01, D-02, D-03, D-04, D-05, D-14 (merge-safe import), D-24, D-37, D-38.
1. Wire the re-render restore to `MC_SCAN` whether or not a record existed at load. Never delete a record while today's `mc_setlog_v1` holds sets for the page.
2. Record the rest timer after the original `start()`. Restore it into the inline row.
3. Save pending values on `input` (debounced). Flush on `visibilitychange` and `pagehide`.
4. Make untick delete the local set as well as the cloud row.
5. Retire `run-workout.html`'s `.fw-bar`/`finishWorkout()`; `mc-finish.js` already handles custom workouts.
6. Add workout-log deletion records (`{id, deleted, deletedAt}`), merged newest-wins and filtered in `readWorkoutLog()`.
7. Import: preview, confirm, and merge the workout log by id.
8. Add a single-writer gate for `mc_workout_log_v1`, and remove the orphan logger.
9. Optional: an IndexedDB journal with `durability: 'strict'` for signed-out athletes, verified on iOS first.

Acceptance: R-01 to R-05, R-13, E-12. New journey coverage for refresh mid-rest, refresh while typing, the week round trip and untick-then-finish.

**R1 shipped (2026-10-23), steps 1–8. Step 9 (the IndexedDB journal) is not done.** It's optional, and it needs an iOS check that a sandbox can't run.
Every R1 acceptance check now passes: R-01 on all 7 engines, R-02 to R-05, R-13 and E-12. `fa-repro.js` goes from 2 to 14 of 23 and `fa-engines.js` from 3 to 4 of 14. The 9 checks still failing belong to R2, R4 and R5.
The journeys are now a CI gate, `tools/test-mc-session-durability.js`, with 22 checks. On the pre-R1 tree 18 of them fail and its refresh control passes. `tools/check-workout-log-writers.js` is new too. It failed on 8 real write sites before the fix.

- **D-01.** The re-restore is wired whether or not a record existed at load. `save()` no longer infers an untick from the DOM; the stored list shrinks only on an untick (`mc:set-unchecked`), Finish or Discard. Driving bro-split showed a second cause. A tab that re-renders other cards moves the positional owner key (`i0`), so restore built the wrong card. Restore now finds a row's owner from the row id's exercise identity (`MCSetlogUtil.rowIdPrefix`).
- **D-04.** The rest is recorded after the original `start()`, from TMR's own state, and ±15s moves the stored end too. The restore re-starts the same rest on the same card through `start()`, so the inline row comes back and counts toward the original end.
- **D-05.** Drafts are saved on `input` (300 ms debounce) and flushed on `visibilitychange`/`pagehide`.
- **D-03.** An untick writes a removal record through the same locked, broadcast and replayed path as a check. A day left with no sets is removed.
- **D-02.** `run-workout.html`'s bar and `finishWorkout()` are gone. Custom workouts finish through `mc-finish.js`, with an id and PR flags.
- **D-24.** Deletions live in their own synced store, `mc_workout_log_deleted_v1` (`dictByTs`), not as tombstones inside the log. The log has twenty readers, one of them byte-identical with Mike's Cookbook, and a separate store changes none of them. `mergeWorkoutLog()` drops recorded keys from both sides. It is also three-way against the last server copy, so a removal made since the last sync isn't pulled back.
- **D-14.** Import plans first, shows a `confirm()` preview, then applies. The workout log merges by identity and respects deletions. The set log merges with `mc-sync.js`'s own `mergeSetlog`, published as `MC_MERGE`. Every other store is still replaced from the file, and the preview lists them by name.
- **D-38.** `mc-log-read.js` owns every write: `appendWorkout`, `deleteWorkouts`, `clearWorkouts` and `writeWorkoutLog`. The storage-full writer moved there from `mc-setlog.js`, so the three conditioning pages that don't load the set logger now warn as well.
- **D-37.** The orphan WAVE3-SETLOG logger is removed from `cat-gainz.html`.

**Found while driving, beyond the register.** On the pre-R1 tree, finishing a workout didn't clear its session record, even with a real tap on Log workout. The ticked page wrote it straight back. It's now cleared on `mc:workout-finished` and stays cleared.

**Known residuals, not fixed here:**
- **An untick can come back through sync.** `mergeSetlog()` unions set numbers and `mc_setlog_v1` has no deletion records. If the page reloads before the next push, a pull can restore a set that was unticked on a signed-in device. The window is narrow because a push runs on hide, but it is real.
- **Import replaces every other store.** The preview says so. Making those stores merge-safe is R7 work.
- **A tick shows on another week.** On the Modality Matrix, a set ticked in week 1 also shows as ticked on week 2's same exercise. A history key names the exercise, not the week. This predates R1 and is unchanged.
- **The deletion store has no cap.** It holds one small record per deleted workout.
- **Not verified on a real device.** That covers the timer restore after an iOS background kill, the draft flush on a real lock, and a delete propagating between two signed-in devices (device matrix items 2 and 5).

### R2 · Screen stays on, rest always lands
Defects: D-06, D-07.
1. Take the session lock at the first logged set, and start the session clock then too.
2. Re-acquire on every return while a session is active, as `mc-interval.js` already does.
3. Drive locks and the catch-up alert from `TMR` state, not `#timerFloat`'s class.
4. Add the "Keep screen on during workouts" setting (default on).
5. Show a visible full-width change at rest end (silent iPhones).
6. Video view: controls to 48, "SEC" only under seconds, and Done versus Cancel made distinct or merged.

Acceptance: R-06, R-07, plus a release at Finish.

**R2 shipped (2026-10-24), all six steps.** R-06 and R-07 pass. `fa-repro.js` goes from 14 to 16 of 23, and the 7 still failing belong to R4 and R5. `tools/test-mc-session-durability.js` gains 11 R2 checks and now runs 40. On `main`, 9 of those 11 fail. The "nothing holds the screen before the first set" control passes there too, and the bar-tap check doesn't run there because no bar appears.

- **D-06, the root cause.** `mc-live-tracker.js` decided "a rest is running" from `#timerFloat`'s `.visible` class, and M3b stopped setting that class on every page with set rows. The measurement on `main` makes it plain: with "Keep screen on" off, a running rest held **no** lock on `mm-p1.html`. `mc-timer.js` now announces every start and stop as `mc:rest-state`, and the tracker listens to that. The catch-up alert computes the remaining time from `TMR.remaining()`. It used to parse the float's text, which stays frozen while the float is hidden.
- **D-06, the session half.** `mc-summary.js` started the session clock and the whole-session lock at `exDone > 0`, a whole exercise checked. Both now start at the first ticked set.
- **D-07.** `onShow()` re-syncs the lock whenever a session or a rest wants it. It used to do so only while a rest was running.
- **Release at Finish.** Finish and Discard now stop a running rest first. A rest left in overtime would otherwise have kept holding the screen after the workout ended.
- **Step 4.** `mc_prefs_v1.keepAwake` defaults to on; turned off, the screen is held only during a rest. The toggle lives in the account sheet, the one settings surface every athlete can reach, and in the timer tray. It is a 48 px `role="switch"`.
- **Step 5.** A full-width green bar reading "Rest over — next" appears at zero, directly under the session toolbar, and clears with the rest. The catch-up path shows it too. **The first draft was a tappable button across the top of the screen, and `check-journey.js` caught it covering End workout and the progress control while it showed.** It is now purely visual: `pointer-events:none` and `role="status"`. A cue that blocks the control that ends the session is worse than no cue. The durability gate asserts both points: nothing under the bar is blocked, and End workout stays reachable.
- **Step 6.** Every video-view control is now at least 48 px. "SEC" shows only under a seconds readout. Done and Cancel both called `TMR.stop()`, so they are merged into one "End rest" button.

**Found while driving, beyond the register: the "cards at load" trap, a sixth time.** Every gate check above used a `?day=` deep link, and the first draft of R2 passed all of them. Entering the normal way, from the day list, showed a different result. `mc-live-tracker.js`'s `init()` returned when no exercise card existed at load, which an F3 day list always satisfies. So a session entered by tapping a day got no rest-time lock and wrote no activity record, and the dashboard's resume banner reads that record. Both were broken on `main` too, on all three engine families. Separately, the tracker's card selector left out `.ex-item`, so the eight frequency pages were never treated as workout pages at all. A third gap was in `mc-summary.js`: its auto-built summary returned early on an unchanged signature, and that signature only changes when a whole exercise is finished. So on those pages the first set never started the session. All three are fixed: `init()` defers on `MC_SCAN`, exactly as `mc-session.js` has since F3-1. They are gated as `DAY-LIST` checks on `mm-p1`, `kitchen-sink` and `2on-1off`. The gate has 40 checks now, and 9 of the 11 R2 ones fail on `main`.

**Known residuals, not fixed here:**
- **Video view and the cue toggles are hard to reach.** Both open only from the rest float (🎬 and ⚙️), and the float is hidden on every page with set rows since M3b. On most workout pages an athlete can't switch to video view or reach the sound, vibrate and 10s toggles mid-session. This predates R2; it belongs with R6's control work. The account-sheet toggle avoids the problem only for the new setting.
- **Not verified on a real device.** That includes whether iOS honours the Screen Wake Lock in an installed PWA. Device matrix item 1 (silent iPhone, music playing, screen locked through a rest) is still the owner's to run.

### R4 · Prefill, identity and progression you can trust
Defects: D-08, D-11, D-12, D-13, D-21, D-22, D-23.
1. The planned load replaces the ghost on the sets it was computed from.
2. Store a readable name with each finished set, keeping the key separately, and show names in History. Resolve legacy entries where possible.
3. Stop truncating new keys, migrating as Phase 2.1 did: legacy keys stay readable and nothing is mixed.
4. Classify by name, not by key.
5. Progression per set, top of range; partial sessions hold; ×0.5 increments with the tightened big-lift pattern; a single is its own max.

Acceptance: R-08, R-11, R-12, E-01 to E-10.

**R4 shipped (2026-10-24), all five steps.** R-08, R-11 and R-12 pass, and so does every engine check: `fa-engines.js` goes from 4 to **14 of 14** (measured on the pre-R4 tree in the same session), and `fa-repro.js` from 16 to **19 of 23**, the four still failing being R5's. `tools/test-mc-exercise-identity.js` gains 14 R4 checks and now runs 61; on the pre-R4 sources 8 of them fail.

- **D-08, the planned load.** The `S2` ghost writes last session's weight into the field's real value, and `mc-suggest.js` skipped every field that was not empty, so the hint read 195 while one tap logged 185. A ghost is a suggestion nobody has confirmed (`mc-setlog.js` never persists one), so the planned load now replaces it on the sets it was computed from and stays ghosted. Typed and pending values carry no ghost mark and are still never touched. Drop rows are skipped, because a drop is lighter by definition.
- **D-21, per set and top of range.** `repTargets()` rewrites every range to its top and then reads the targets through `mc-setlog.js`'s own parser, so it cannot disagree with the logger about how many sets there are. A pyramid is judged set by set, and a session with prescribed sets missing holds the weight. The unit test now loads the real parser through the module's Node hook. It used to fall back to a regex that could not read a comma list, so the pyramid cases passed only in a browser.
- **D-22, increments.** Leverage-assisted equipment steps half the free-weight jump (it was a flat 2.5 lb), and "bench" used as a prop (a curl, a fly, a row on a bench) no longer makes a lift "big". That leaves the 18 machine, cable and plate-loaded big lifts the Phase 2 correction counted.
- **D-23.** A single is its own max: 315 × 1 reads 315, not Epley's 326.
- **D-11, readable names.** `mc-finish.js` banked each set under its key's segment (`x-incline-db-press`), and History, the detail page and the recap all showed that. `mc-setlog.js` now stores the lift's name on each set (`n`). It sits on the set rather than the session because `mc-sync.js`'s `mergeSetlog()` rebuilds each session as `{d, sets, ts}` but copies a set entry whole, so the name survives a merge, the cross-tab replay and the locked write with no change to any of them. A finished set carries `name` plus `key`, and PR detection compares by key.
- **Legacy entries are resolved on read, not migrated.** `MC_LOG.readSets()` hands back a copy of any key-named set with a readable name: the catalog's exact name when exactly one name maps to that key, otherwise the key spelled out with the app's abbreviations restored (DB, BB, EZ, RDL…). A key two catalog names share is spelled out, never guessed. Every history reader already goes through `readSets()`, so History, Stats, readiness, max-out, trends, the calendar and the recap all read names with no change of their own. The stored entry is never rewritten.
- **D-12, whole-name keys.** The slug was cut at 24 characters, so 12 keys were shared by 34 catalog names. Keys are the whole name now; a name of 24 characters or fewer keys exactly as before. A longer name's old bucket is carried forward on first render, Phase 2.1's way: only when no other name on the page and no catalog name truncates to the same 24 characters, and the old bucket is left in place either way. The catalog reaches most logging pages late or not at all, so its shared prefixes are pinned in `mc-setlog.js` (`SHARED_LEGACY`), and `tools/test-mc-setlog-plan.js` re-derives them from `exercise-catalog.js` and fails when they drift.
- **D-13, classify by name.** It falls out of the two changes above: every muscle classification of a logged set reads `s.name`, and that is now the name. The audit's informational measure, keys that classify differently from their names, reads 148 of 580. It measures the key, which nothing classifies any more.

**Found while driving: `workout-detail.html` had never used its guarded reader.** The page calls `render()` inline at parse time, and `mc-log-read.js` was loaded nine lines below it. So `MC_LOG.readSets` never existed when the page rendered, and its fallback branch is what had actually run since the L-03 fix. The tag now loads first. The page also groups by key rather than name, so the same lift prescribed twice in one workout keeps its two cards.

**Known residuals, not fixed here:**
- **An in-progress session on a long-name lift, open across the deploy,** keeps its stored sets but loses its painted ticks and draft: `mc_session_v1` row ids and `mc_setlog_pending_v1` are keyed by the old id. That affects only names over 24 characters and only for that one session.
- **The migration's ambiguity check sees the catalog and the rendered document.** A non-catalog name sharing a 24-character prefix with another on a different, unrendered day of the same page is not detected. The pinned catalog list covers the 12 known shared prefixes.
- **A legacy name truncated mid-word is spelled out truncated** (`Seated Cable Row (cable, Seated`) when the catalog is absent or the prefix is shared. It is legible and claims nothing, which is the point, but it is not the full name.
- **`mc-biomech.js` and `mc-card-actions.js` still match history by a 24-character substring** to find a best weight. That prefix is a substring of both key generations, so their behaviour is unchanged; it was already a loose match before R4.

### R3 · Offline you can trust
Defects: D-17, D-18, D-19, D-20.
1. Survive deploys: carry same-origin HTML into the new cache in `activate`, or key the prefetch record to `CACHE_NAME` and re-run it after `controllerchange`.
2. Make History, Stats, the Library and the builder available offline.
3. "Available offline ✓" checks `caches.match()`, not a stored record.
4. Queue offline per-set inserts, or have PR baselines read the local store first.
5. Catch update rejections, and show the banner on failed fetches as well as on `navigator.onLine`.

Acceptance: S-04 to S-07. `fa-offline-sw.js` is a candidate CI job once green.

### R5 · Flexible mid-session, one sheet contract
Defects: D-09, D-10, D-15, D-16.
1. Today-only swaps, with "Keep this swap"; History shows "swapped from …".
2. Key a substitute's sets to the substitute.
3. Add "+ Add set" and "Skip exercise".
4. Reorder: arrows on every card at 48px, with a today-only or keep choice.
5. A shared sheet module: dialog role, focus in and out, Escape, scroll lock, and a history entry so Back closes it. Opening a day pushes history too. Replace `alert()`/`confirm()`.
6. Remember the dashboard tab and scroll, the History tab, the Stats toggle and the workout-builder draft.

Acceptance: R-09, R-10, R-14, R-15.

### C · Program content and deloads
Defects: D-25 to D-29.
1. A real deload (cut a third to half of working sets, cap intensity cues) through the one `planFor()` path.
2. Extend the peak-week check to hand-written schedules.
3. A Pos 4 tempo badge across all 60 cells, with a validator check.
4. Generate the Strength & Supersets record from page data.
5. Copy fixes: the High-Volume description and the Modality Matrix title. Update each program's guide page.

### R6 · Ergonomics to the owner's standard (with the Phase 2 session declutter)
Defects: D-30, D-31.
1. Raise `check-journey` and `CHROME_SELECTORS` from a 44 to a 48 floor and add an 8px spacing check, seeded as a ratchet.
2. Set controls to 48: checkbox 48×48, inputs and ±15s 48 tall, rows at least 8px apart.
3. Floating timer and reorder controls to 48, with a 13px text floor.
4. A press state on the set checkbox, and `enterkeyhint` on inputs.
5. Back-to-top on 10-exercise days and scroll restoration on landings.
6. Phase 2 declutter: one rest readout, Replace/Reorder moved into ⋯, a neutral prescription pill, tinted finished rows, a 5.23:1 light-mode ghost, and an in-session PR moment.

Update the Quick Tour where controls move.

### R7 · Data mobility
Defects: D-36, D-39.
1. CSV export: one row per set, using the share sheet where supported.
2. A backup nudge for signed-out athletes ("Last backup: never / N days ago"), and surface the `persist()` result.
3. Lift the 200-workout cap or archive older workouts compactly, and stop trimming the cloud copy.

### G · Token gate and migration · I · Builder redesign
Defect: D-32, plus the Phase 1 design items (one bottom nav, builder exercises-first, color semantics).

### E · Visibility · J · First-visit performance
Defects: D-35, D-40.
- The error beacon needs a new Supabase table, so it asks first.
- Add a per-gate `FAILED: <gate>` echo in `verify.yml`.
- A core bundle would change the no-build stance, so it's an owner decision.

### Owner actions (no code)
- Set the `WEEKLY_CHECKIN_SECRET` repo secret (D-33).
- Turn on leaked-password protection (D-34).
- Run the device matrix below.

## Device test matrix (cannot be proven from a sandbox)

1. iPhone on silent, Spotify playing, screen locked through a rest: does anything alert?
2. Installed iOS PWA killed in the background mid-rest: what survives?
3. A Safari tab install left unused for more than 7 days: is local storage intact?
4. A real basement with signal bars but no data: does the offline banner appear?
5. After R1 step 6, two signed-in devices: does a delete propagate?

## Corrections recorded

- **Increments:** Phase 2 reported "25 of 580" lifts off the ×0.5 spec. Under a big-lift rule that doesn't count "bench" used as a prop, it's **18** machine, cable or plate-loaded big lifts plus **1** barbell curl. The published Phase 2 report is updated (version 2).
- **Builder form:** Phase 1's first draft measured "about 1,300px" from a 2× screenshot. The CSS figure is about **650px**; this was corrected before publishing.
- **Week-tab root cause:** Phase 2 reported the wipe. Phase 3 found the cause: the re-render guard exists (DEF-CR-02) but is wired only when a record already existed at page load.

## Limits

- Not verified: real devices and the installed PWA, iOS audio, vibration and storage eviction, live sign-in and two-device sync, and real weak-signal networks.
- Simulated backgrounding doesn't suspend timers the way a phone does.
- Kill timings are one trial per delay; two separate runs agree.
- All browser results come from this sandbox's Chromium 141 build.
