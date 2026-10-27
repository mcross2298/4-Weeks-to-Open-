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
| D-33 | The weekly check-in has never sent | `WEEKLY_CHECKIN_SECRET` unset (workflow log, 18 Oct) | — | High | **Open** — secret set 2026-10-25; run 16 then failed on a malformed VAPID public key secret (owner) |
| D-34 | Leaked-password protection is off | Supabase Auth setting | advisor | Low | **Closed — not applicable** (paid-plan feature; free plan, owner 2026-10-25) |
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

**R3 shipped (2026-10-24), all five steps.** S-04 to S-07 pass, and `fa-offline-sw.js` is now a CI gate (it runs in `verify.yml`'s browser job). It gained two checks that pull the D-17 fix apart, S-08 and S-09, and goes from 3 to **9 of 9**; on the pre-R3 sources it scores 3 of 9. One new unit gate, `tools/test-mc-outbox.js` (13 checks, all failing on the pre-R3 `mc-supabase.js`), and three existing ones grow: `test-mc-sw.js` 20 → 31, `test-mc-sw-update.js` 9 → 15, `test-mc-offline-prefetch.js` 8 → 19.

- **D-17, two halves.** In `sw.js`, `activate` no longer just deletes the old deploy's cache: whatever the new cache lacks moves into `mc-training-carry-v1` first, newest deploy last. That cache is read **only when the network fails**, so an online visit always gets the new deploy's page. That needed a second change, which was the real trap: `staleWhileRevalidate()` read with `caches.match()`, which searches **every** cache, so a carried copy would have been served ahead of the network. It now reads `CACHE_NAME` alone. On the page side, `mc-offline-prefetch.js`'s record keeps the URLs it fetched and the app cache it filled, so the next dashboard visit after a deploy fills the new cache again. S-08 proves the first half (offline straight after an update, before the dashboard has run) and S-09 the second.
- **Step 3.** The dashboard paints "Available offline ✓" from the record first and then from `MCOfflinePrefetch.verify()`, which asks the Cache API. A page missing from the cache also triggers a refetch inside the 14-day window, which the record alone never could.
- **D-18.** History, the workout detail page, Stats, the Library and both builders are precached (`tools/build-sw.py`'s `EAGER_HTML`, six small HTML files whose scripts were already precached). They are app screens reached from the bottom nav, so the program prefetch, which blocklists them, never fetched them.
- **D-19.** A per-set cloud write that fails is queued in `mc_workout_logs_outbox_v1` and replayed on `online` and on the next page load. The write was already an upsert on its natural key, so a replay is idempotent. The outbox keeps only the latest operation per set, so a set unticked while offline is replayed as a delete, never back in.
- **D-20.** `reg.update()` returns a promise, and the `try/catch` around it never caught its rejection. Every offline check became an unhandled rejection that the head boot script recorded, so going offline filled the 20-entry error buffer. The rejection is handled now, no check is made while the browser knows it is offline, and a failed check shows the offline bar. That covers gym Wi-Fi that reports `onLine` but has no route out, which `navigator.onLine` alone cannot see.

**Found running the gate: the harness could not run here at all.** In this agent sandbox Chromium ignores `--no-proxy-server` and tunnels every request through the ambient proxy, so the very first navigation failed with `ERR_TUNNEL_CONNECTION_FAILED`. Playwright's own `proxy` option with a bypass list for the mapped hosts is honoured. Everything else is sent to a dead port, which is what an offline test wants anyway, in CI too.

**Known residuals, not fixed here:**
- **A set ticked offline gets no PR push later.** The replay writes the row but does not re-run the PR check that sends the lock-screen notification. The record still counts at Finish, which reads the local store.
- **The carry-over cache is never pruned.** It is bounded by the distinct URLs this device has opened, and only read on a network failure, but it does not shrink.
- **A write the server refuses for good** (not a network failure) is retried until the outbox's 7-day limit drops it.
- **Not verified on a real device**, including iOS Safari's storage eviction of an installed PWA's caches.

### R5 · Flexible mid-session, one sheet contract
Defects: D-09, D-10, D-15, D-16.
1. Today-only swaps, with "Keep this swap"; History shows "swapped from …".
2. Key a substitute's sets to the substitute.
3. Add "+ Add set" and "Skip exercise".
4. Reorder: arrows on every card at 48px, with a today-only or keep choice.
5. A shared sheet module: dialog role, focus in and out, Escape, scroll lock, and a history entry so Back closes it. Opening a day pushes history too. Replace `alert()`/`confirm()`.
6. Remember the dashboard tab and scroll, the History tab, the Stats toggle and the workout-builder draft.

Acceptance: R-09, R-10, R-14, R-15.

**R5 shipped (2026-10-24), all six steps.** R-09, R-10, R-14 and R-15 pass, so `fa-repro.js` is **23 of 23** (19 before R5). With every check in it green, it is wired into `verify.yml` now, and so is `fa-engines.js` (14 of 14, in the static job): the roadmap kept them out until their fixes landed (`W-I1`). `tools/test-mc-session-durability.js` gains 17 R5 checks and runs 58; on the pre-R5 sources 7 of them fail, and the `DAY-BACK` control passes on both.

- **D-10, swaps are for today.** A swap from the substitute sheet used to go to `mc_replacements_global`, so swapping a busy machine once changed that lift on every program page for good. It is now stored in `mc_swaps_today_v1`, day-stamped, unless the sheet's **Keep this swap** switch is on, which keeps it for this page only. Nothing writes the global key any more, but it is still read, so a swap kept before this change keeps working.
- **D-09, a substitute's sets are its own.** The rows had already been built under the original lift's key, so after a swap the next set landed in the original's bucket. `mc-replace.js` marks a swapped card `data-mc-swap-name` / `data-mc-swap-from`, `origNameOf()` reads the swap ahead of the rename original (a rename is the same lift, a swap is not), and `MCSetlogUtil.rekeyCard()` rebuilds the card's logger under the new key and reopens it if the athlete was on it. Sets logged on the original before the swap stay the original's. Each substitute set records `sw`, and History and the detail page show "swapped from …".
- **Step 3, + Add set and Skip exercise.** Both are today's decision, in `mc_session_adjust_v1`, and both flow through `planFor()`, so the row list, the counter and Finish's denominator agree from one place. Added sets are working sets and sit before any drop rows. A skip keeps the sets already logged and drops the rest. It counts as finished for the hand-off but is never marked `.checked`, so nothing reports it as trained, and it moves on to the next exercise after the rebuild (the first draft's hand-off was undone by the rebuild reopening the card). A rebuild repaints every tick from the store with `paintLoggedRow()`, the same path a reload uses.
- **Step 4, reorder.** The ▲/▼ arrows were 36px in the header corner beside the meatball, where two 48px targets do not fit. In reorder mode they now get their own 48px row at the top of each card. An order is for today (`mc_ex_order_today_v1`) unless **Keep this order** is on in the reorder bar.
- **Step 5, one sheet contract: `mc-sheet.js`.** It is loaded by `mc-nav.js`, the way `mc-appearance.js` is, so no page needed a tag; `conditioning-timer.html` carries no `mc-nav.js` and gets its own. It **adopts** the eleven overlays rather than asking each module to call in: role `dialog`, `aria-modal`, focus in and back out, Tab kept inside, Escape, page scroll locked, and a history entry so Back closes it. Closing goes through the module's own path, a backdrop click with its cancel button as the fallback, so no module is left believing a sheet is still open. Detection runs after a click, a key, a history move or a render. It is deliberately not a subtree attribute observer, because `measure-session.js` counts mutation records delivered to the app's observers.
- **Step 5, Back from a day.** Every F3 day-list page renders the shared `.mc-day-back`, so `mc-sheet.js` pushes a history entry when it appears and presses it on Back, with no engine changed. A `?day=` landing pushes nothing, so Back from a deep-linked day still leaves the page.
- **The history rule worth knowing before touching this.** The module never calls `history.back()` on its own initiative. A sheet that closes and then navigates (Browse all → the exercise library) would have that navigation cancelled by a `back()` queued a moment earlier. A sheet or day closed on screen leaves its entry **spent** (`replaceState`) instead, and the next Back that lands past a spent entry steps over it, so one press still does one visible thing. The `DAY-BACK` journey asserts exactly that.
- **Step 5, `alert()`/`confirm()`.** `MC_SHEET.confirm()` / `.alert()` replace the athlete-facing ones: Discard, End session, Restart program, the max-out retry, History deletes, the builder, the conditioning pages' resets, Replace, the import preview, and the custom program's delete and publish. Each keeps a native fallback for a page where the module has not loaded. **Found driving it: the first version rendered under the bottom nav** (its `--z-modal` is 110 and the nav's is 140), so OK could not be tapped; it sits at 1360 now, above the card sheets it is opened from. The two owner-only editors (`program-manager.js`, `mc-pm-layout-editor.js`) keep the OS dialogs.
- **Step 6, remembered state.** The dashboard reopens the tab and scroll a session was on when no `?tab=` is named (`mc_ui_dash_v1`, session storage). The nav's Home link now says `?tab=dashboard`, so tapping Home is an explicit choice. History's tab and the Stats map's Recovery/Volume toggle are remembered per browsing session. H1 locked Recovery as the Stats default, so a fresh launch still opens there. The workout builder keeps a half-built workout in `mc_builder_draft_v1` until it is created.
- **The perf gate caught one:** the adjustment store was read from `localStorage` on every `planFor()` call, which runs per card on every pass (`storageReads` 26 → 50 on `mm-p1`). It is cached now and invalidated by its own writer, another tab's `storage` event, or a new day, which brings it to 30, inside the budget's ceiling.

**Known residuals, not fixed here:**
- **iOS scroll lock is unverified.** The page behind a sheet is locked with `overflow:hidden` on the root and `overscroll-behavior:contain` on the overlay, which holds in Chromium. Whether iOS Safari honours it for touch scrolling needs a device.
- **A sheet opened from a timer** rather than a click, key or render is adopted only on the next interaction. None is known; `MC_SHEET.check()` exists for one.
- **The swap mid-exercise starts the substitute at 0/N.** Sets already done on the original stay the original's and count at Finish, but the card does not carry them over as done sets.
- **The owner editors still use OS dialogs**, as noted above.
- **Not verified on a real device**, including the Android Back gesture in an installed PWA.

### C · Program content and deloads
Defects: D-25 to D-29.
1. A real deload (cut a third to half of working sets, cap intensity cues) through the one `planFor()` path.
2. Extend the peak-week check to hand-written schedules.
3. A Pos 4 tempo badge across all 60 cells, with a validator check.
4. Generate the Strength & Supersets record from page data.
5. Copy fixes: the High-Volume description and the Modality Matrix title. Update each program's guide page.

**C shipped (2026-10-24), all five steps.** `gen-schedules --check`, `validate-programs` and `check-program-data` pass with the new rules, and Strength & Supersets week 6 now builds lighter than week 5 on every day (89 rows across the week against 142). `tools/test-mc-gen-schedules.js` grows 17 → 32 assertions, and `tools/test-mc-session-durability.js` gains `DELOAD` and `TUT` steps.

- **D-25, a real deload.** `mc-setlog.js`'s `reduceFor()` is the one place a reduced day changes a row count. A deload keeps `floor(2n/3)` working sets (5 → 3, 4 → 2, 3 → 2, 6 → 4, 8 → 5, always a third to a half), drops the drop rows, and the card says so: "Deload week — 3 of 5 working sets · no drop sets · stop 2–3 reps short of failure on every set, finishers included". That last clause is the intensity cap: it covers the escalated AMRAP targets (ss week 6's finisher asks for 100–200 reps) without rewriting the program. **Lighter stays one set fewer**, a lighter session and not a deload. The deload outranks it, and the Readiness Brief no longer offers Lighter on a deload day, where it would have changed nothing.
- **A pre-existing bug fixed on the way: the deload answer was cached once per page load.** `cat-strength.html`, `hv-block.html` and the Modality Matrix pages change week in place, so opening week 5 and switching to the deload week built it at full volume (34 rows of a 33-row week 5 on Legs; 48 on `mm-p3`) until a reload, and the reverse kept the deload after leaving it. It is cached per open program and week now. Measured on `main` before the change, and covered by `DELOAD`.
- **Step 2, the deload check.** `tools/gen-schedules.js` now runs `deloadProblems()` over every program, generated or declared. A deload week, **as the logger builds it**, must be lighter than every other week of its block and at least a third lighter than the lightest of them. The second rule is what the old one-set cut failed: ss week 6 built 123 rows against a lightest week of 142, lighter but by 13%. The test proves it by swapping the old rule in. `lastWeekMayDeload()` still only *proposes* a deload for a generated block, so High-Volume still gets none.
- **What the stricter measure found:** the "flat" volume the old check relied on was week-1 figures. Measured per week, the Modality Matrix's fifth week of each phase carries 192 rows against 184, so week 15 is its block's raw peak too, and ss's week 6 is 157 against 142–154. Both pass only because the real deload cuts them (88 and 89).
- **D-28, Strength & Supersets is generated.** `buildSS()` reads `cat-strength.html`'s `PMC_SPLITS` and `PMC_SPLIT_META.cycle`, which now carries `rest` and `deloadWeeks`; each workout carries its `tags`. The day hero's set counts are the logger's (Legs 32, Back 34, Arms 35, was 30/32/32), `min` keeps F0's ratio of 2.5 minutes a set, and `muscles` comes from the real classifier (Calves & Cardio is `calves`, not empty: its calf work is authored on the page).
- **D-26, the Pos 4 tempo badge.** Each training day's 4th exercise in `mm-data.js` carries `tut: { down: 3, pause: 2 }`, and `mm-engine.js` renders it as "⏱ 3s down · 2s pause" in every week: 60 of 60 cells, verified in the browser. `validate-programs.js` fails a day whose Pos 4 lacks it (12 of 12 fail on the old data). **Found driving it:** `mc-group-split.js` lifts a tempo badge into the tri-set's group row with a digit match, which cut the label to "⏱ 3". The badge carries `data-tempo-label` now, and every other page's badge reads as before.
- **D-27 and D-29, copy.** High-Volume reads "4-Week Block · Mostly 15–25 Reps" on its card, landing and block page, and its guide says what runs outside that range (38 of 158 exercises have a set count other than 5–6, 68 have a rep target outside 15–25). The Modality Matrix's tab title says 15-Week, and its card and landing name "4 Lift + 2 Conditioning Days". The guides for ss and mm describe their deload weeks, and mm's describes the badge.
- **Effort labels on the RIR scale.** "Easy" (three or more reps left) stored RPE 8, which is two in reserve, and "Solid" stored 9. They store 7 and 8.5 now. Every consumer tests only `F` or ≥ 9.5, so no decision changes. An answer stored before lights the button it was given on, and a re-check never rewrites it.

**Known residuals, not fixed here:**
- **A deload session probably reads as a hold.** It logs fewer sets than the card's authored prescription, and R4 made a partial session a hold, so the next suggestion should keep the pre-deload load. That follows from reading `mc-suggest.js`; it was not driven, and it was not a separate decision.
- **High-Volume has no deload**, by `lastWeekMayDeload()`'s rule (F-03). Adding one would be a content decision.
- **Not verified on a real device.**

### R6 · Ergonomics to the owner's standard (with the Phase 2 session declutter)
Defects: D-30, D-31.
1. Raise `check-journey` and `CHROME_SELECTORS` from a 44 to a 48 floor and add an 8px spacing check, seeded as a ratchet.
2. Set controls to 48: checkbox 48×48, inputs and ±15s 48 tall, rows at least 8px apart.
3. Floating timer and reorder controls to 48, with a 13px text floor.
4. A press state on the set checkbox, and `enterkeyhint` on inputs.
5. Back-to-top on 10-exercise days and scroll restoration on landings.
6. Phase 2 declutter: one rest readout, Replace/Reorder moved into ⋯, a neutral prescription pill, tinted finished rows, a 5.23:1 light-mode ghost, and an in-session PR moment.

Update the Quick Tour where controls move.

**R6 shipped (2026-10-24), all six steps.** The audit's done criterion holds: `check-journey.js`'s new session sweep reports **0 controls under 48px, 0 pairs closer than 8px and 0 text nodes under 13px on all 9 journey pages**. Measured on `main` before the change, the same sweep found 77, 69 and 217 across the nine.

- **Step 1, the gate.** `SWEEP` in `tools/check-journey.js` measures the session surface the way the athlete sees it: the toolbar, the rest-end bar and every exercise unit on screen, with one set logged and its rest running. It hard-fails rather than ratchets, because all nine pages reached zero before it landed. `CRITICAL` and the guided-mode / interval-timer floors moved from 44 to 48 with it. Two scoping choices are deliberate:
  - **Page chrome stays on the ratchet.** Week tabs, the back link and the bottom nav render on the visual ratchet's day-list baselines, which can only be re-baselined from CI (P4). The CHROME pass now reports against 48 but still fails only on a shrink. The five day-list pages were screenshotted on `main` and on this branch and are pixel-identical.
  - **Spacing is measured within a layer.** A control scrolling under the pinned toolbar is not its neighbour, and the occlusion pass already covers that case.
- **Steps 2 and 3, the controls.**
  - Set controls: the checkbox, inputs, ±15s, effort buttons and the toggle are now 48px. Rows sit 9px apart (they were 3px) and the grid gap is 8.
  - Card header: the ⋯ and ⓘ are 48px and 8px apart; they were 44px and 4px apart.
  - Toolbar: both buttons are 48px tall with 13px text.
  - Other controls now at 48px: the rest chip, the Quick Pump trigger, guided mode's entry and exit, and the interval timer's back and run buttons.
  - The floating timer's gear, video, adjust, done, cue toggles and presets are 48px with 13px text. D-30 measured them at 24–38px.
  - Every label on the session surface is 13px or more. `max()` guards the density-scaled ones, because `--density` can be 0.82.
  - At 320px:
    - The toolbar drops the word "Elapsed", which no longer fits beside End workout.
    - A superset leg's logger takes back the 30px its header reserves for ⋯, so its inputs are 63px wide rather than 39px.
- **Step 4.**
  - The set checkbox has a press state.
  - Each input has a label ("Set 2 weight, pounds") and `enterkeyhint`. Next moves from weight to reps, and Done on the last field logs the set. A finished row is never unticked from the keyboard.
- **Step 5.**
  - **Back to top:** an inline ↑ Back to top button sits after the last exercise of a day with 10 or more. It is inline rather than floating, so it can never cover a control.
  - **Landing restore:** each program landing restores its tab, open group and scroll position on Back or reload (`mc_ui_landing_v1`). A fresh visit still opens on Overview.
- **Step 6, the declutter**, with two decisions taken with the owner:
  - **Replace / Reorder stay on the card.** The owner put them there (VOC-C1) because the ⋯ menu was too cluttered, and kept them. They now share one row with + Set / Skip at the foot of the open exercise: four "change today" actions in one 48px row instead of two rows. `mc-card-actions.js` publishes `MC_CARD_ACTIONS` so the row calls the same `doReplace()` / `startReorder()` the menu does.
  - **One rest readout: the inline row.** The toolbar keeps elapsed time while the row under the set counts down. It takes the countdown only where there is no inline row (the float and video views).
  - **A neutral prescription pill:** no gold glow and no rose drop target. The current set is still the brightest text in it.
  - **Finished rows are tinted, not faded.** Opacity 0.55 plus a strike-through had made the logged numbers the hardest text on the card to read.
  - **D-31:** the light-mode ghost value uses `--ink-6`, which measures 5.23:1.
  - **An in-session PR moment.** A new best weight shows "🏆 New best — 190 lb, up from 185" on the set, with the PR haptic and an announcement. It uses this device's own history, so it needs no account. The rule is the cloud PR's (G-03): a lift's first-ever log is a baseline, not a record. A second set at the same new weight is not a second PR, and an untick clears it.
- **Measured:** open-card height at 390px is 583 → 596px on `mm-p1`, 509 → 512 on `bro-split` and 590 → 590 on `psu-strength`. Folding the Replace / Reorder row into the actions row pays for the taller rows. Contrast improved without being targeted: light 299 → 281 findings, dark 74 → 56. The budgets are left where they are, for a CI run to lower.

**Known residuals, not fixed here:**
- **Page chrome under 48:** week tabs, the back link (44 tall) and the bottom nav. Raising them moves the day-list visual baselines, so it needs a CI re-baseline in the same change.
- **The PR mark is not repainted on reload.** The set and its tick restore; the line under it does not.
- **iOS's numeric keypad has no return key**, so Next / Done works on Android and hardware keyboards only.
- **Not verified on a real device.**

### R7 · Data mobility
Defects: D-36, D-39.
1. CSV export: one row per set, using the share sheet where supported.
2. A backup nudge for signed-out athletes ("Last backup: never / N days ago"), and surface the `persist()` result.
3. Lift the 200-workout cap or archive older workouts compactly, and stop trimming the cloud copy.

**R7 shipped (2026-10-24), all three steps.** One decision was taken with the owner: **archive** rather than lift the cap, so the newest 200 stay exactly where every reader already looks.

- **Step 3 first, because steps 1 and 2 read it.**
  - **Two places cut at 200.** `mc-log-read.js`'s writers kept the newest 200 on this device. `mc-sync.js`'s `mergeWorkoutLog()` also cut at 200, so the cloud copy and every device that pulled it lost the oldest workouts too.
  - **The overflow now moves to `mc_workout_archive_v1` instead of being dropped.** It is a compact form: a table of the lift names each workout uses, then one short row per set. Unknown entry fields and unknown set fields ride along whole, so the round trip is lossless; `tools/test-mc-archive.js` checks it field by field.
  - **The archive is written first.** If that write fails (a full device), the log keeps all 201 rather than losing one.
  - **The sync merge no longer cuts at all.**
    - After a pull, `MC_LOG.rollover()` moves the overflow into the archive.
    - The archive syncs with its own strategy, `workoutArchive`: a union by the log's identity, honouring the same deletion records, never trimmed.
  - **Readers:**
    - The ~20 readers of the log are unchanged and still see the newest 200.
    - History, workout detail, Stats, the calendar, the exercise trend chart and the CSV read `MC_LOG.readAllWorkouts()` instead, which is the log plus the archive. A workout present in both (a pull can bring an archived one back into the log) is listed once, and the log's copy wins.
  - **Delete, clear and import reach the archive too.** Import merges it the way it merges the log.
  - **The two Phase 5.2 notes are gone,** on History and on the trend sheet. Both said "each new one now replaces the oldest", and that is no longer true.
  - **Measured:** 205 seeded workouts left 200 in the log and 5 in a 1,251-byte archive. History listed all 205, and an archived workout's detail page rendered.
- **Step 1, CSV.**
  - `MCExport.exportCSV()` writes one row per set, oldest first: date, time, workout, exercise, set, weight, reps, effort, PR, swapped-from and duration. A workout with no sets (conditioning) gets one row.
  - It uses the share sheet where the browser can share files, and a download otherwise.
  - Two details are deliberate:
    - The date is the athlete's calendar day, not UTC's, so an evening session in the US does not land on tomorrow.
    - A cell starting with `= + - @` is prefixed with `'` so a spreadsheet does not run it as a formula. Negative numbers are left alone.
- **Step 2, the backup nudge.**
  - **Account sheet.** It now says "Last backup on this device: never / today / N days ago", plus what `navigator.storage.persisted()` answered. `mc-finish.js` has asked for persistence since L6; nothing ever said whether the browser agreed, and a refusal is exactly when a backup file matters.
  - **Home card.** A **Back up your training** card shows when all of these hold:
    - nobody is signed in;
    - there are 3 or more finished workouts;
    - there has been no backup in 14 days;
    - it was not dismissed in the last 7 days.

    It has two buttons, 48px tall and 8px apart. Back up now saves the file and clears the card; Later snoozes it for a week.
  - **Only the JSON backup counts as a backup.** A CSV cannot be restored.
  - **Storage:** the backup time lives in `mc_backup_last_v1`, which is registered, device-local and not exported.

**Known residuals, not fixed here:**
- **The set log keeps 5 sessions per exercise** (the other half of D-39). It feeds the "Last:" cue and the suggested weight, not history: every finished workout keeps all of its sets, and those are what is archived. The trend sheet still says so when the cap is reached.
- **The 20 log readers that stay on the newest 200** include the streak, the bridge and readiness, and they only look back weeks. Whether anything else should read the archive is an owner call rather than a defect.
- **The share sheet with a file is not verified on a real device.** Headless Chromium has no `navigator.share`, so only the download path ran.

### G · Token gate and migration · I · Builder redesign
Defect: D-32, plus the Phase 1 design items (one bottom nav, builder exercises-first, color semantics).

**G shipped (2026-10-24).** Two decisions were taken with the owner: **G first, with I as its own PR**, and **History is the bottom nav's fifth tab**.

- **The gate (D-32).** `tools/check-design-tokens.js` gained a sixth pass. It reads `.css`, `.html` and `.js` with comments stripped, and both hex and `rgb()`/`rgba()`.
  - **The test is a property of the value.** A colour fails if it is blue-leaning with chroma of 44 or less, unless it is one of the hues that do a job: a green, cyan or violet lean, or a dark navy.
  - Every match is a **hard fail** unless the value is named in `COOL_SEMANTIC` or `COOL_PENDING`.
  - It was proven to fail on three planted shapes before landing: a JS-injected hex, an inline `rgba()`, and a stylesheet `rgba()` with spaces. A value quoted in a comment does not count.
- **What the gate found.** It counted **915 cool neutral literals across 153 files**, against **zero** in the stylesheets the old gate could see. The audit's "119 + 446" undercounted, because it named slate hexes only. Most were the slate mid-tones (`#94a3b8` ×244, `#e2e8f0` ×209, `#64748b` ×82), plus the bottom nav's `rgba(8,10,16)`.
- **The migration.** Each value moved to the warm ramp's colour of the **same WCAG relative luminance**, so every contrast ratio it takes part in is unchanged. Only the blue cast goes.
  - A literal rather than a `var(--ink-*)`, because several pages do not load `base.css`. P2 recorded that an undefined `var()` drops the whole declaration.
  - `tools/gen-program-css.py` emitted one of them itself, so the generator now carries the warm value.
  - **Left alone on purpose:**
    - `#334155`, the rest-day slate the 7-day standard governs (all 47 uses are that accent; it is now in `COOL_SEMANTIC`).
    - `#2d3748`, still `COOL_PENDING`: it needs a readable value, not a luminance match.
    - The declared semantic grounds.
    - One cyan chip tint the first pass caught wrongly. That is why the predicate has a cyan-lean clause.
- **Measured.**
  - **Visual ratchet:** 0% changed at its own threshold on all six of its pages. At threshold 0, 2–25% of pixels moved, so the change did render; it is below what the ratchet treats as a regression, by design.
  - **Dark contrast:** 56 → 56.
  - **Light contrast:** 281 → 262 (see below).
- **Colour semantics.** The Modality Matrix week tab and week-theme label were hard-coded blue / red / green per phase. Gold marks what's active, and red is reserved for failure, so all three now read `--accent`. The light theme already darkens it to 4.72:1. (The red prescription pill was R6.)
- **One bottom nav.**
  - `mc-nav.js` uses the dashboard's line icons, and its fifth tab is **History** (`workout-logs.html`). The page you are on is lit in the dashboard's active gold. Tabs are 48px (44 before), and the chrome ratchet is raised to 48 so they cannot shrink back.
  - The dashboard's own History tab opened `stats.html`, a label that did not match its destination; it now opens History.
  - Stats moved to two places: a **Stats** card in Home's Training Tools and a 48px **Stats** link at the top of History.
- **Found by looking, fixed here:**
  - **History had no light header.** Its top bar, hero, stats strip, tabs and log cards kept their dark grounds while `mc-light.css` darkened the ink, so the page title rendered near-black on near-black. Because History is now a nav tab, it got a full light block.
  - **Home's tool-card subtitles were about 2.4:1 in light mode.** They now use `--ink-6`, 5.23:1.
  - Light contrast **281 → 262**: `dashboard.html` and `index.html` 8 → 0, `workout-logs.html` 4 → 1. The three budgets are lowered by hand.

- **A CI hang, found on this PR and fixed in it.** `fa-offline-sw.js`'s S-08 failed once on a CI runner (a navigation error offline straight after a simulated deploy) and then hung the browser job for 2.5 hours until it was cancelled. Two defects in the harness, neither in the app:
  - It waited a **fixed 7s** for the new service worker. It now waits for the worker to be active with its cache created, up to 45s. It passed 5/5 locally before the change and 2/2 after, in 39s instead of 45.
  - **`page.evaluate()` has no timeout**, so one promise that never settled held the runner. Every in-page call now has a 20s deadline, proven with a never-settling probe that returned null after 20s, plus an 8-minute watchdog.
  - The smoke job also gets `timeout-minutes: 60`; it normally takes about 20.

**Known residuals, not fixed here:**
- **The back link and week tabs are still 44.** They sit on the visual ratchet's day-list baselines with the nav, and this change kept under the ratchet's 0.5% without a re-baseline (0.35–0.48% measured here). Raising them will need one.
- **`#2d3748`** (the placeholder slate) still needs a readable value chosen for it.
- **The visual ratchet's day-mode entry is still unseeded** (`seed: true`).

**I · scope (opened 2026-10-24, its own PR after G).** `build-workout.html`, from the Phase 1 audit's pain point 4. The done criterion: a new workout can be built, saved and started without scrolling past a form.
1. **Exercises first.** The page opens on search and the muscle filters. Saved workouts become one compact row above them that expands, rather than a list pushing the search down.
2. **Save details in the tray.** Name, program and collection move from the top of the page into the review sheet's Save step. The name is pre-filled from the main muscles selected (for example "Chest & Triceps") until the athlete types their own.
3. **Start from the tray.** After Save, the sheet shows ▶ Start workout for the workout just made, so build → save → start never leaves the sheet.
4. **Warm ramp, gold accent.** The blue header, teal/cyan gradients and sky-blue labels go. Superset violet and cluster cyan stay: they are the app's set-type grammar.
5. **One count.** The search placeholder and the results line use the same number as Home's tile (the catalog minus cardio and core), computed rather than typed. Today they read "450+", "542" and the catalog holds 580.
6. **The owner's 48 / 8 / 13 standard** on the page's own controls: Start, Share, Delete, the filter chips, the review pill and the tray's row controls.

**I shipped (2026-10-24), all six points.** The done criterion holds, driven at 390 and 320:
- **Built, saved and started without scrolling past a form.** The page opens on search; the search box sits at 270px with nothing between it and the header except the one-row "My custom workouts". Three exercises were added and opened in Review. The name read "Chest & Triceps" with nothing typed. Save showed ▶ Start workout in the same sheet, and the started workout rendered 3 cards and banked its logged set at Finish (A1 re-checked).
- **One count:** the placeholder and results line read 542, the same as Home's tile, computed from `EXERCISES`.
- **The draft** (R5) still saves and restores, and now records whether the name was typed. A suggested name is re-derived rather than frozen.
- **Controls:** every control in the sheet is 48px. The three exceptions are the cluster checkboxes, whose 48px label is the tap target. The superset button moved to the sets/reps row, because four 48px controls and a name do not fit one row at 320.
- **Light contrast** on the page fell 4 → 0 (dark 0 → 0); the budget is lowered by hand.
- **Pre-existing defects found by looking, fixed here:**
  - The sheet's drag handle painted its 12px tap padding, so it rendered as a grey square.
  - In light mode, a saved workout's name was white on cream; `mc-light.css` still listed `.saved-name` as "on a dark card" after `.saved-card` went Sand.
  - The light sheet's background started at 40% opacity, so the backdrop showed through as a grey band.

### E · Visibility · J · First-visit performance
Defects: D-35, D-40.

**E shipped (2026-10-24); the table is the owner's to run.** Decision: a new Supabase table, signed-in athletes only.
- **The table:** `supabase/phase14-client-errors.sql`.
  - Policies: insert only, the caller's own rows; admins may read.
  - Limits: length checks on every text column.
  - Duplicates: one row per (user, fingerprint, time).
  - Deletion: rows cascade with the account.
  - **Not applied.** The connector's approval prompt timed out twice, so the owner will run it in the SQL editor. Until then the client's insert fails and the entries simply wait.
- **`mc-error-beacon.js` runs on Home.**
  - It sends new `mc_errors_v1` entries at most every 10 minutes, each once (`mc_errors_sent_v1`).
  - The source goes as a file name only; messages are cut to 500 characters.
  - A failed send is silent and retried on a later visit.
  - `tools/test-mc-error-beacon.js` (21 assertions) runs the real file in a sandbox.
  - The Executive Summary says what is sent and what never is.
- **`verify.yml`:** every browser gate in the smoke step echoes `FAILED: <gate>`. The roadmap and CLAUDE.md both asked for this after a failure was buried under later gates' output.

**J shipped (2026-10-24).** Decision: a generated core bundle — a committed file plus a `--check` gate, still no bundler and no `package.json`.
- **`tools/build-bundles.js`** writes `workout-core.js` (12 modules: persistence, finish, sync, card actions) and `workout-logger.js` (12 modules: the set logger and session) from `tools/bundles.json`. It swaps a run for one tag only where the members appear **contiguously and in order** (HTML comments between them are kept, moved above the tag), so no module runs earlier or later than before. `workout-core.js` loads on 67 pages and `workout-logger.js` on 62; 6 and 14 pages interleave another script inside the run and keep their separate tags. `--check` runs in `verify.yml`: a stale bundle, a page still carrying a whole run, or a page loading a bundle and one of its members all fail.
- **Each member is wrapped in its own `try/catch`.** As separate files, one module throwing at load stopped only itself; concatenated, it would stop everything after it. The catch re-throws on a timer with the member's name on the message, so it still reaches `mc_errors_v1` and the beacon. That is only safe for a member with no top-level declaration, so the generator refuses one with a top-level `function`/`const`/`let`/`class` or a file-level `'use strict'`. All 24 are a single IIFE today (or one assignment).
- **The gates read source, not copies.** Ten source-scanning gates skip the bundles (`tools/bundle-outputs.js`, read from `bundles.json`), or "exactly once", "only writer" and "every reader guards" would count the copy as a second implementation. `check-script-manifest.py` expands a bundle tag back into its members for the capability and log-reader contracts.
- **Measured** with the new `tools/measure-first-visit.js`: HTTP/2 + gzip (how Pages serves it), DevTools Slow 3G, service worker blocked, median of 3, this sandbox's Chromium.

  | Page | Scripts | Script KB | First paint | DOMContentLoaded | Load |
  |---|---|---|---|---|---|
  | `mc-s1-back.html` | 43 → 21 | 386 → 373 | 12.0 → 7.4 s | 12.1 → 10.9 s | 16.6 → 15.4 s |
  | `kitchen-sink-s3.html` | 45 → 23 | 389 → 376 | 11.6 → 7.5 s | 12.0 → 11.0 s | 16.4 → 15.5 s |
  | `mm-p1.html` | 49 → 49 | 416 → 416 | 12.0 → 11.9 s | unchanged | unchanged |

  First paint falls by about a third where the bundles apply; parsing and load move 7–10%. **Bytes barely move**, because concatenation is not minification, and bytes are what dominate a slow link. `mm-p1.html` is one of the pages that interleave a script inside the run, so it is not bundled.
- **Not done:** minification (it needs a real JavaScript parser to be safe, which is a build-tool decision), and bundling the Modality Matrix pages (their run would need reordering, and module order is the risk this design avoids).
- **Editing a member now means regenerating:** `node tools/build-bundles.js`. CI fails until you do.

### N1–N3 · The three residuals after E · J

Taken on the owner's go-ahead, as one PR (#372), after the R-phase residual lists.
- **N3 · an untick survives sync (R1 residual).** `unsave()` writes `mc_setlog_deleted_v1` (`{'key|day|set': {ts}}`, pruned after 120 days) and `save()` stamps each set's tick time `t`. `mergeSetlog()` drops a set whose tick is not newer than its record, so a set re-ticked later stays; the per-page pull and the backup import union the records from both sides. Six assertions in `test-mc-sync-merge.js`, one of them the defect.
- **N2 · video view and the cue toggles reachable (R2 residual).** The inline rest row gains **Full screen** and **Rest cues** (48px). Rest cues renders the same toggle list as the float's tray. Back from video view mid-rest remounts the row at the time remaining.
- **N1 · page chrome at 48 (R6/G residual).** Back link (base.css and 53 per-page copies), week tabs (one `.tabs-bar .tab` rule; they were 42), the back icon, the dashboard topbar icons, PM unlock (36) and See all (16 tall), the landing icon, nutrition icons, Surprise Me, the guide link, the tour dot and Skip (31). `chrome-budgets.json` heights raised by hand, and the week tab is measured now. A one-shot `workflow_dispatch` job re-baselined the visual ratchet from CI, seeding the day-mode entry for the first time, and was then removed.

**Known residuals, not fixed here:**
- **The dashboard greeting has less room.** It was already cut off at every width; with five 48px controls it goes 92 → 72px at 390 and 84 → 66px at 320. Rearranging that row is a design call.
- **The untick record keys on the day.** A set unticked on one day and the same set number ticked on a later day are different keys, as intended; a clock skew between devices larger than the gap between a tick and its untick could misorder them.

### Residuals 1–5 · after R3, R4, R5, R6 and G

Taken on the owner's go-ahead, as one PR, from the "Known residuals" lists above.
- **1 · The PR line survives a reload (R6).** A new best stores the weight it beat on the set (`pr` on the `mc_setlog_v1` entry). `paintLoggedRow()` redraws the line from it, without a second announcement. `prCheck()` can't simply be re-run on reload: by then the set itself, and any heavier set ticked after it, count as today's.
- **2 · `#2d3748` has a readable value (G).** The set-logger placeholder and `.sl-hl` header read `var(--muted)` on `base.css` and the 12 pages carrying their own copy, in both themes. The light rules (`#b7b0a3`, `#8a8377`) were as faint as the dark one. `COOL_PENDING` is empty now.
- **3 · A swap mid-exercise keeps its done sets (R5).** The substitute shows the sets already done on the original as done, read-only, labelled "Done as <original>", and the next tick goes to the next row. They stay in the original's bucket, so Finish banks them under the lift they were lifted on. Verified by driving `kitchen-sink-s3.html?day=1`: 2 ticks, swap, 2/4, reload, 2/4, tick set 3, 3/4, with set 3 stored under the substitute.
- **4 · A record set ticked offline still notifies (R3).** `logSet()` takes the push the in-session check found, from local history, and the outbox replays it after the row is written. Only within 12 hours (`PUSH_FRESH_MS`). After that it is old news. Two cases in `tools/test-mc-outbox.js` (17 assertions).
- **5 · Substitute weights read the right history (R4).** `mc-biomech.js`'s `historyWeight()` and `mc-card-actions.js`'s `lastLoggedWeight()` matched the first 24 characters anywhere in a key, so they also matched longer names sharing the prefix. **Measuring found a worse bug:** both read `bucket.sets`, but a bucket has been a list of sessions since EN-10. So neither had found any logged weight since then, and every "from your log" weight was really an estimate. Now a key matches on the whole name (plus a `-<n>` occurrence suffix), every session is read, and the card's own bucket is read by the logger's key. Five cases in `tools/test-mc-biomech.js`, one of which fails on the old code.

**Known residuals, not fixed here:**
- **Undoing a swap** rebuilds the card under the original. Sets ticked on the substitute stay the substitute's and are not shown on the original's rows.
- **The carry-over is by set number.** If the substitute has fewer rows than the sets already done, the extra ones aren't shown on the card. They still count at Finish.

### Owner actions (no code)
- ~~Set the `WEEKLY_CHECKIN_SECRET` repo secret (D-33).~~ Done 2026-10-25.
- Re-set the weekly check-in's VAPID public key function secret to the key in `mc-push.js` (D-33: run 16 returned 500, `Vapid public key must be a URL safe Base 64`).
- ~~Turn on leaked-password protection (D-34).~~ Closed as not applicable: a paid-plan feature, and the project is on the free plan.
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

## Phases S (settings & intelligence) and B (launch board) — opened 2026-10-25

A brief asked for a Phase 4 (settings, auto-progression, telemetry, update
lifecycle, local reset) and a Phase 5 (an adversarial launch board). Surveyed
against `main @ a3b2b7c` first. Much of it already exists: the wake-lock
toggle (R2), the global `error` / `unhandledrejection` catchers (head boot),
the beacon to `client_errors` (E), the rest-end bar (R2) and the update
banner (`mc-sw-update.js`). The steps below are the real gaps only.

Owner decisions (`AskUserQuestion`, 2026-10-25): extend `client_errors` rather
than add `app_telemetry_logs`, opt-in and **default off**; Reset clears
**caches and UI state only**, never history, set logs, macros or sign-in;
settings keep **instant-apply** (no Cancel / Save); auto-move **after logging
on** (today's behaviour, now switchable), **after rest off** (new, opt-in).

| Step | Objective | Files |
|---|---|---|
| S1 | Workout settings: sounds, vibration, auto-move ×2 beside Keep screen on; every sheet control ≥ 48px with 8px gaps | `mc-account.js`, `mc-timer.js` |
| S2 | Silent-switch fallback: a full-screen flash at 0s, independent of the sound pref | `mc-timer.js` |
| S3 | Auto-move flushes typed drafts first; after-rest moves to the next open set without opening the keyboard | `mc-setlog.js`, `mc-timer.js` |
| S4 | Double progression: inside a rep range, the rep ghost climbs one rep per session until the top, then the load steps and reps reset | `mc-suggest.js`, `tools/test-mc-suggest.js` |
| S5 | Diagnostics drawer over `mc_errors_v1` (stack, kind, page, time), stacks captured, storage and network failures recorded; beacon opt-in | head contract, `mc-account.js`, `mc-error-beacon.js`, `mc-log-read.js`, phase14 SQL |
| S6 | Update lifecycle: a controller swap held mid-workout now shows the banner; the in-progress test reads `TMR.isRunning()` | `mc-sw-update.js` |
| S7 | Reset local state (caches + UI only), refused offline | `mc-account.js` |
| B  | Launch board: RAID log, go/no-go, runbook with numeric rollback triggers — published as an artifact | — |

### Board B — outcome (2026-10-25)

**CONDITIONAL GO**, signed by the owner, with the full writeup in the artifact
`https://claude.ai/artifact/ScbXQhEsfybKyiyPCVCTJU`. The canary is the owner's devices plus testers for
48 hours. Full rollout waits on four things: phase14 applied (my attempt timed out on the
Supabase server's confirmation prompt; I verified the table is absent), `WEEKLY_CHECKIN_SECRET`
(15 of 15 runs failed, latest 18 Oct), leaked-password protection, and the device matrix above.
**Update 2026-10-25:** phase14 is applied and the secret is set. Leaked-password protection is
closed as not applicable (paid-plan only). The device matrix is the one condition left.

- **R-1 resolved before merge:** the rep goal goes in the hint only. The reps box ghosts what was
  done (`repGhosts()`), because a ghost ticked unchanged is logged as-is.
- **Rollback triggers:** ≥ 3 distinct new fingerprints, or one fingerprint on ≥ 2 athletes, within
  24 h; any lost-set report; offline smoke failing on the live origin; any contrast, perf or
  journey gate red on `main`. Rollback is a revert PR. It reaches a device on its next update
  check and is held while a workout is in progress.
- **Telemetry is opt-in**, so these triggers fire only if the canary cohort turns on
  *Send error reports*.

### S8 — Workout Settings page (2026-10-25, owner's reference screen)

The owner shared a reference Workout Settings screen. Four calls via `AskUserQuestion`: its own
page, **staged Cancel / Save changes** (this reverses S1's instant-apply), two switches where
the example's "Auto move after logging" meant something else (**Start rest after logging**, the
example's meaning, plus **Auto move after logging**, which opens the next exercise), and I chose
the extra switches. Added: **Show max weight logged** (off). Left out: *Show rest timer*
(Start rest after logging already covers it), *Free navigation* (locking sets would reverse how
every engine works today) and *Rest timer notifications* (an iPhone suspends a backgrounded web
app, so this needs a server push, which is unproven).

`workout-settings.html` is in `EAGER_HTML` because the rest row's ⚙️ Rest cues panel links to it
mid-session; the session toolbar has no width left for another control. The account sheet keeps
one row into the page.

## Phase T · the tail (opened 2026-10-25)

The owner asked for the open code items and the small known gaps to be closed,
and approved bringing Mike's Cookbook into the change for the one shared file.
Two parts, with an `AskUserQuestion` check-in between them.

**T1 · small gaps (one PR here, one in Mike's Cookbook):**

| Step | Gap | Files |
|---|---|---|
| T1.1 | `mc-bridge.js` reads an entry's `sets` unguarded (`SETS_PENDING`) | `mc-bridge.js` in both repos, `tools/check-log-readers.js`, `tools/test-mc-bridge.js` |
| T1.2 | The workout deletion store has no cap | `mc-log-read.js` |
| T1.3 | A write the server refuses for good is retried for 7 days | `mc-supabase.js`, `tools/test-mc-outbox.js` |
| T1.4 | The offline carry-over cache is never pruned | `sw.js` |
| T1.5 | On the Modality Matrix a set ticked in week 1 shows on week 2 | `mc-setlog.js`, `mc-session.js` |
| T1.6 | Undoing a swap drops the substitute's done sets from the card | `mc-setlog.js`, `mc-card-actions.js` |
| T1.7 | Carried sets beyond the substitute's row count are not shown | `mc-setlog.js` |
| T1.8 | A deload week can suggest adding weight, and the deload session counts as a stall afterwards | `mc-setlog.js`, `mc-suggest.js`, `tools/test-mc-suggest.js` |
| T1.9 | The owner layout editor's last OS dialog | `mc-pm-layout-editor.js` |

**T2 · the optional items, each its own decision:** the IndexedDB crash
journal (R1 step 9), bundling the Modality Matrix pages, and minification (J).

**T1 shipped (2026-10-25), all nine steps.** Each fix has a check that fails on
the code before it:
- **T1.1** `test-mc-bridge.js` 37 → 42 (5 fail on the old file), mirrored to
  Mike's Cookbook byte-identically; `SETS_PENDING` is empty.
- **T1.2** `test-mc-archive.js`: a record older than 365 days, or malformed, is
  dropped on the next deletion.
- **T1.3** `test-mc-outbox.js` 17 → 23 (5 fail on the old file): the refused write
  leaves, the one behind it is sent, the expired-session one stays.
- **T1.4** `test-mc-sw.js` case 10 (2 fail on the old file).
- **T1.5** reproduced first by driving `mm-p1.html` (week 2 showed the week-1
  tick on a tab switch and on reload); `WEEK-TICK` in
  `test-mc-session-durability.js` covers `mm-p1` and `cat-strength`.
- **T1.6** `SWAP-UNDO`: 2 ticks, swap, 1 tick, Undo, reload → 3 done, 1 labelled.
- **T1.7** driven: 7 original sets onto a 5-row substitute paints 5 and says
  "+2 more sets done as Incline DB Press".
- **T1.8** `test-mc-suggest.js` (4 fail on the old file) and `DELOAD-TAG`.
- **T1.9** the layout editor's alert uses `MC_SHEET.alert()`.

**Known residuals, not fixed here:**
- **One day, two weeks, one lift:** ticking week 1 and week 2 of the same lift
  on the same day writes both into one bucket, and the same set number is
  overwritten. The week tag stops the wrong paint; it does not split the store.
- **Only the pages that register a day resolver get week tags** (`mm`, `hv`,
  `ss`); other multi-week pages keep the old shared paint.
- **A carry-over copy with no Date header is never pruned**, since its age is
  unknown.

### T2 · the optional items (owner chose all three, 2026-10-25)

**T2.1 · the Modality Matrix pages are bundled.** `mm-p1/p2/p3` and
`hv-block` load `workout-core.js` and `workout-logger.js` now. Their runs were
broken by three modules and, on the `mm` pages, by the `MM.init` /
`MM.renderSummary` inline calls. `mc-program-progress.js` and
`mc-program-day.js` load ahead of the run, `mc-pm-data.js` ahead of
`mc-muscle-map.js` (still before `mc-setlog.js`, which needs it), and
`mc-group-split.js` after `mc-superset-hop.js`. None of them reads the run's
modules at load. The inline calls moved to just after the core run.

**Proven by DOM equivalence, not by reasoning:** every day of all four pages
(32 renders) was snapshotted before and after. The rendered DOM and the set of
`MC*` globals are identical; the only differences are moved HTML comments and a
hint's position, which also varies between two runs of the unchanged tree.

| Slow 3G, median of 3 | requests before → after | first paint |
|---|---|---|
| `mm-p1.html` | 58 → 35 | 12.1 s → 12.1 s |
| `hv-block.html` | 52 → 29 | 11.4 s → 7.6 s |

`mm-p1` gains no first paint: its render (`MM.init`) used to run after only
`mc-replace.js` and now waits for the core bundle. It is not slower, and its
DOMContentLoaded moves 12.7 → 12.1 s. Making it faster would mean rendering
before `mc-replace.js`, whose swap repaint the engine calls directly.

**T2.2 · the crash journal (R1 step 9).** `mc-setlog.js` writes every tick and
untick to IndexedDB (`mc-setlog-journal`) with `durability: 'strict'`, and on load
replays whatever the set log is missing through the same locked write a tick
uses, then repaints the row. Only today's records are kept. Journaled for every
athlete, not only signed-out ones: it costs one small write, and the replay is a
no-op where the store already has the set.

| SIGKILL after the tick | localStorage alone | after reopening the page |
|---|---|---|
| 100 ms | lost | kept, ticked on screen |
| 300 ms | lost | kept, ticked on screen |
| 1500 ms | lost | kept, ticked on screen |
| 3000 ms | kept | kept |

`tools/test-mc-crash-journal.js` is a CI gate now (TICK, ONCE and UNTICK; 0 of 3
pass without the journal, and its control confirms the kill really lost the
write). `fa-kill-window.js` reports both columns.

**Not verified:** iOS. The roadmap asked for an iOS check first. WebKit's
IndexedDB durability and how an installed PWA is killed both differ from desktop
Chromium; the device-matrix item 2 run is where to see it.

**T2.2 follow-up · a discard is not replayed.** Discard cleared the page's sets
from `mc_setlog_v1` but not from the journal, so the next load put a discarded
workout back. `test-mc-setlog-concurrency.js`'s clean-setup check caught it.
`forgetRecent()`, the discard path's existing hook, now also drops the page's
journal records; `test-mc-crash-journal.js` gained a DISCARD journey (fails on
the commit before the fix). The browser tests that clear storage to stand for a
fresh or wiped device now delete the journal too, since a real wipe would.

**T2.3 · the deploy artifact is minified.** `tools/minify-deploy.js` (terser
5.36.0, scratch prefix, no `package.json`) minifies the JavaScript `pages.yml`
uploads. Top-level names, function names and class names are kept, so classic
scripts still share their globals and error stacks still name their functions;
the vendored Supabase bundle ships as is; a parse failure fails the deploy. The
repository is never minified. `verify.yml`'s new `minified` job builds the same
tree and drives the smoke, journey, durability, crash-journal, identity and
flagship-scenario gates against it, so the code that deploys is code they ran.
The Rolodex build is not minified.

| Slow 3G, HTTP/2 + gzip, median of 3 | script transferred | first paint | load |
|---|---|---|---|
| `kitchen-sink-s3.html`, source → minified | 388 → 192 KB | 7.6 → 7.0 s | 15.8 → 12.0 s |
| `mm-p1.html`, T2.1 → T2.1 + minified | 414 → 206 KB | 12.1 → 8.3 s | 16.5 → 12.5 s |
| `hv-block.html`, T2.1 → T2.1 + minified | 384 → 186 KB | 7.6 → 7.0 s | 15.8 → 12.2 s |

Uncompressed, the shipped JavaScript goes 3,213 → 1,698 KB. Verified in this
sandbox on both trees (one gate, `check-journey`'s back-link width, fails here
on unchanged `main` too: a text-derived width this Chromium build renders 3.7px
narrower) and on CI, where all three jobs passed on `8e24abf`.

### T3 · the small known limitations (owner, 2026-10-27)

Scope: the residuals the T1 and N lists recorded as "not fixed here". The
three below ship as one PR; the rest are scoped out at the end, with the reason.

- **Week tags on every multi-week page.** T1.5 tagged a tick with its program
  week only where a day resolver exists (`mm`, `hv`, `ss`), so on every other
  page with week tabs a week-1 tick still painted on week 2's same lift.
  Measured on `main`: tick set 1 on `mc-s1-back.html?w=1`, open `?w=2`, and the
  tick is there. Those pages keep their week in a top-level `let activeWeek`
  (or `let week`), which classic scripts share by name, so `weekTag()` now
  falls back to it as `page:<PID>|<week>` (19 page and engine sources). A page
  with neither still tags nothing. New durability check `WEEK-TICK-PAGE`.
- **A carried page with no Date header ages out.** `pruneCarry()` kept such a
  copy forever. The first prune that meets one now stamps it with
  `x-mc-carried-at`, and it goes 60 days later like any other
  (`test-mc-sw.js` 10d–10f).
- **Home's greeting has its own row.** With five 48px controls in the bar it
  was cut off at every width (72px at 390, 66 at 320). Fixing it found a real
  bug: the avatar is **not** decorative, `mc-account.js` makes it the
  account-sheet button, and a rule hid it below 360px, so Home lost its way
  into the account sheet there. The bar keeps the controls, right-aligned 8px
  apart, and stays sticky; the greeting and the 48px avatar sit under it and
  scroll away. Measured at 320 and 390: greeting 124px of 124, avatar 48×48,
  no sideways overflow.

**Scoped out, with the reason:**
- **One day, two weeks, one lift** still share a bucket and a set number. With
  the week tag everywhere, a tick is never *painted* on the wrong week; a
  second week's tick of the same set on the same day overwrites the first.
  Splitting the store means changing the set key that 49 read sites across nine
  modules, the journal, the untick records and the sync merge all rely on — a
  store migration for a case that needs two program weeks of one lift on one
  calendar day. Not worth its risk until it is seen in use.
- **The untick record and clock skew** stay as recorded: a misorder needs two
  devices' clocks to disagree by more than the gap between a tick and its untick.
- **`F3-5`** (the four licensed pages still on the old day layout) is a phase,
  not a residual, and needs its own `AskUserQuestion` gate.
