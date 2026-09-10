# Engine Repair Roadmap — Phase 0 through Phase 5

> Opened 2026-09-10. This document is the repository's copy of a three-part
> architecture audit of the flagship training path, carried out over three
> passes in one session and published as three HTML artifacts. It exists so
> the plan survives the session that produced it. Per the Planning rule in
> `CLAUDE.md`, creating it is sufficient to begin `Phase 0` directly — no
> separate "approved" reply required — but each phase after `Phase 0` still
> gets its own `AskUserQuestion` check-in before starting, per the
> multi-phase-work rule. Scratch-listed in `content-manifest.json`, so it
> never ships to the public Rolodex build.

## The three source artifacts

| # | Artifact | What it establishes |
|---|----------|--------------------|
| 1 | **Flagship Engine Audit** — `https://claude.ai/code/artifact/587fdbb3-6d00-4633-b158-bd080fd329e9` | Pass 1. The end-to-end engine flow and its four information losses; findings `DB-1…DB-11`, `PG-1…PG-7`, `EN-1…EN-13`; the top five gaps and the top five retention improvements. |
| 2 | **Engine Repair Roadmap** — `https://claude.ai/code/artifact/557454c4-94ec-4b76-a962-2c1e6f9df9d8` | Pass 2. Twenty more modules, all nine Edge Functions, every table policy, all 58 declared stores; findings `P2-01…P2-14`; **three corrections to pass 1**; the original four-phase execution plan (Phases 1–4). |
| 3 | **Launch Readiness Gate** — `https://claude.ai/code/artifact/a3df0b87-9619-448d-a894-f8b3609273a2` | Pass 3. Concurrency, crash recovery, numeric boundaries and a live RLS penetration test; findings `L-01…L-09`; fixes `FIX-01…FIX-06`; gates `TEST 1…TEST 5`; **Phase 0 in front and Phase 5 behind** the four; the go-live matrix and this repo handoff. |

**Numbering.** The plan runs **Phase 0 through Phase 5 — six phases**. There
is no Phase 6; artifact 3 added one phase in front of artifact 2's four and
one behind them, and nothing numbered beyond that. Phase 0 supersedes the
ordering in artifact 2, because two of its items destroy data today and
artifact 2's own Phase 1 does not.

**Scope.** Six flagship programs, the core engine and the Supabase layer. All
licensed influencer programs are excluded from every pass.

---

## What the audit found, in one paragraph per pass

**Pass 1 — the seam.** Every automated gate in this repository passes: 20 gate
scripts, 11 unit suites, zero failures. The defects all sit in one place, the
seam between a prescribed exercise and the data the engine keeps about it. An
exercise is free text on a card, identified by its position in the DOM,
classified by three regex engines that disagree with each other and with
`exercise-catalog.js` (36.2% match rate), and persisted under a key scoped to
whichever page rendered it. Six live history-key collisions. All 125 live
`workout_logs` rows carry a null muscle group and a null program id.

**Pass 2 — the silence.** The weekly check-in has **failed on all nine of its
scheduled runs since 12 July and has never sent a notification**: the workflow
guards on a repository secret that was never set and exits before the call.
Cluster sets can never progress, because the progression classifier runs
`parseInt` on `5+5+6` and reads 5 — 17 prescriptions, every one judged a
failed session forever. Six athlete-authored training stores (swaps, order,
notes, tempo, favourites, intensifiers) are backup-only and never sync.

**Pass 3 — the data loss.** Two tabs open destroys half the session silently
(10 sets accepted, 5 persisted; the single-tab control loses nothing). A
process kill loses every set written since the last browser flush, and
although a signed-in user's sets already sit in the cloud one row per set,
**nothing ever reads them back**. Row-level security, by contrast, repelled
seven cross-user read, write and privilege-escalation attacks with zero
findings.

### Corrections carried forward

Three pass-1 claims were wrong or understated and are restated here so nothing
downstream is built on them:

1. **The app does ask for notification permission.** `mc-push.js` implements
   the full subscription flow and the dashboard shows a push chip. What is
   missing is a function for it to talk to, not the permission path.
2. **The weekly check-in is already secret-gated**, and the gating is good.
   The defect is that the secret was never set, so the function has never
   been invoked at all.
3. **The pass-1 volume figures were understated.** They were collected with a
   document-wide selector that missed the standalone cards, capturing five of
   ten prescriptions per Modality Matrix day. Re-measured per card: chest 41,
   shoulders 35, quads 21, triceps 12, back 9, glutes 8, biceps 7, hamstrings
   5, calves 4, core 0. The imbalance holds and is slightly larger.

---

## Phase 0 — Launch blockers

> **Gates every other phase and the launch itself.** Nothing else ships until
> these four are green. Two of them destroy data on the current build.

| # | Step | Fix | Gate |
|---|------|-----|------|
| 0.1 | Serialise set-log writes and listen across tabs | `FIX-01` · `mc-setlog.js` | `TEST 1` |
| 0.2 | Rehydrate the set log from the cloud | `FIX-02` · `mc-supabase.js`, `mc-setlog.js` | `TEST 2` |
| 0.3 | Total the numeric layer and the log readers | `FIX-03`, `FIX-04` | `TEST 3`, `TEST 4` |
| 0.4 | Apply the hardening migration | `FIX-05` · `supabase/phase12-launch-hardening.sql` | `TEST 5` |

**0.1 (`L-01`).** The set logger reads the whole store, mutates it and writes
it back. Two tabs interleaving that sequence means the second write is
computed from a snapshot taken before the first, so it overwrites it. No
error, no warning. Only two of the 43 modules that write browser storage
listen for cross-tab changes, and neither is the logger; there is no lock and
no broadcast channel anywhere in the tree. Route every mutation through one
helper that re-reads inside the critical section and takes a `navigator.locks`
lock where the browser offers one, then repaint on the `storage` event.

**0.2 (`L-02`).** Browser storage is flushed to disk asynchronously, so an
abrupt termination loses recent writes — a platform characteristic no web app
defeats with browser storage alone. The design choice is the exposure: the
durable cloud copy exists and no code path reads it back. Add
`getSessionSets()` and fill gaps on init, never overwriting a local value.
Depends on the exercise-identity work in Phase 2 to be fully reliable, since
rehydration is keyed on the exercise name.

**0.3 (`L-03`, `L-04`, `L-05`, `L-06`, `P2-02`).** Three modules throw on
valid JSON of the wrong shape — an object where an array belongs, or a `null`
member — and the crash lands on the stats page, the history page and the
end-of-session recap. Five modules carry the same five-line log reader and all
five have the same hole, so extract one `readWorkoutLog()` and add it to
`check-single-impl.js` so a sixth cannot appear. Separately the one-rep-max
chain propagates `NaN` straight into the warm-up ladder, and a negative weight
produces confidently wrong output rather than an error.

**0.4 (`L-08`, `P2-04`, `P2-05`, `EN-6`).** Deduplicate `workout_logs` first
or the migration fails on live data, then add the uniqueness constraint on
`(user_id, session_id, exercise, set_number)`, put `ON DELETE CASCADE` on the
`user_sync` foreign key (the only one of five without it, which blocks account
deletion outright), and add the missing delete policy on `daily_health`.

> **Applied 2026-09-10**, with the owner watching, and verified straight after:
> 125 → 120 rows (exactly the 5 surplus duplicates), 0 duplicate groups, the
> uniqueness constraint present, `user_sync`'s foreign key now reading
> `ON DELETE CASCADE`, and `daily_health` carrying 4 policies including
> `DELETE`. `TEST 5`'s three schema assertions were written to fail before
> this ran and pass after it, which is the only way to know they assert
> anything.

---

## Phase 1 — Critical system and data integrity repairs

> No dependencies. Each step can ship on its own.

1. **Set the check-in secret and prove one run.** Nine of nine scheduled runs
   have failed. Until this is done every notification feature is theatre.
   Fixes `P2-01`; blocks Phase 3 step 3 and Phase 4 step 5.
2. **Deploy the push and coaching functions at the slugs the client calls.**
   The deployed slugs are `quick-service` and `hyper-function`; the client
   posts to `/push-notify` and `/coach-claude`, and both deployed bodies are
   the unmodified starter template. Fixes `EN-3`; blocks Phase 4 step 5.
3. **Harden the five log readers, once.** Overlaps Phase 0.3 — done there.
4. **Fill the cloud attribution columns.** Load the classifier where the
   logger runs, or classify server-side on insert, then backfill by name and
   remove the empty `catch` that hides the failure. Fixes `EN-2`; blocks
   Phase 2 step 1 and Phase 4 steps 2 and 3.
5. **Give the set log a correction path.** Client half of Phase 0.4: switch
   the insert to an upsert and delete the cloud row when a set is unchecked.
   Fixes `EN-6`.
6. **Close the two backend gaps.** Migration half of Phase 0.4, plus enabling
   leaked-password protection. Fixes `P2-04`, `P2-05`, `EN-13`.

> **`1.2` and `1.4` shipped (2026-09-10).** The whole of `1.2` turned out to be
> a deployment defect, not a code one: **the repository already contained
> complete, competent implementations** of both functions under
> `supabase/functions/`, and they had simply never been deployed to the slugs
> the client calls. Those exact files are now live at `push-notify` and
> `coach-claude`, byte-identical to what is committed here. The
> starter-template copies at `quick-service` and `hyper-function` are left in
> place rather than deleted, so nothing is destroyed before the real ones are
> confirmed working on a device.
>
> **A correction, recorded because the lesson is the point.** The first attempt
> at this step *rewrote* both functions from scratch without reading what was
> already there, and deployed those instead. The rewrite discarded real work —
> the original `push-notify` clamps title and body length and lists the
> `x-client-info`/`apikey` CORS headers a Supabase client actually sends;
> `coach-claude` carries a full forced-tool-use schema with grounding rules
> that keep the model from inventing an exercise, and an `emptyReport()` shape
> so the frontend never special-cases a missing field. All of it was thrown
> away and then restored. The audit said these functions were *the unmodified
> starter template*; that was true of what was DEPLOYED and false of what was
> in the repository, and the two were never checked against each other.
>
> The one client-side change that was genuinely needed stands: `sendPush()` now
> checks the response status. It called `res.json()` on a 404 and resolved
> successfully, which is why the failure was silent for the life of the
> feature.
>
> **The attribution fix needed no new script tag, and measuring is what found
> that.** The roadmap offered "load the classifier on the logging pages, or
> classify server-side". Neither was necessary: `mc-muscle-map.js` is already
> loaded on all 79 pages that load `mc-setlog.js` (checked, zero missing), and
> `MC_MUSCLES.classify()` is the same taxonomy the recovery curve, the heatmap
> and the volume stats already use — so the cloud now agrees with the client
> instead of adding a third opinion. `program_id` had a second, simpler bug:
> it read `window.activeProg`, a dashboard-local variable that does not exist
> on a workout page, so the `||` fell through to `''` every time. It reads the
> persisted `mc_active_prog` store now, the same one `mc-theme.js` uses.
>
> **Dry-running the classifier over the real logged names before backfilling
> caught a live bug that reading the regexes would not have.** Two of the 39
> distinct names came back as **Shoulders** — `Barbell Squat (shoulder width)`
> and `Leg Press (feet shoulder width)` — because the classifier read the
> stance cue in the parentheses as the movement. `classify()` now drops
> parentheses before matching, since a parenthetical on an exercise name is
> always a cue and never the movement; the taxonomy itself is untouched, so
> nothing that was already right could reshuffle. `gen-schedules.js --check`
> caught the knock-on immediately: one Modality Matrix leg day had been
> carrying `shoulders` in its muscle scope, which the Readiness Brief dims by.
> `ss`'s hand-typed scope had the same spurious entry and is corrected, and
> `H4b`'s note calling it a narrow false positive "left as-is" is rewritten
> rather than left to mislead.
>
> **Backfilled 120 of 120 rows**, using the app's own classifier through a
> `vm` sandbox rather than a second regex written in SQL — a taxonomy
> reimplemented in the database is exactly the drift this project has a
> single-implementation gate for. Seven distinct groups now, where every row
> was null. `program_id` stays null on the historical rows and that is
> deliberate: there is no way to know retroactively which program a past
> session belonged to, and inventing one would be worse than a null.
>
> **Still open in Phase 1, and both are the owner's:** `1.1`, the check-in
> secret, and the leaked-password setting from `1.6`. Neither is code — see
> the handoff table.

---

## Phase 2 — Core engine and program logic realignment

> Step 1 gates most of Phase 4.

1. **Give every exercise a stable catalog identity.** Stamp a catalog id on
   the card at authoring time and key history on it instead of the current mix
   of group index, position index and positional name slug; keep the old slug
   as a migration fallback so existing history maps forward. Ends the six live
   collisions and the page-scoped shards in one change. Fixes `EN-1`, `EN-8`.
2. **Reconcile the three classifiers into one.** With regression cases for
   each ordering defect: the Back rule matching inside *Flat*, close-grip
   curls falling to the triceps branch, the unreachable upright-row branch,
   overhead triceps work resolving as a shoulder press, the calf raise caught
   by the squat rule, and `BW ` not being recognised at all. Then make the
   curated catalog authoritative and the regex the fallback. Fixes `DB-2`
   through `DB-11` and `P2-14`.
3. **Teach the parser the notations the programs actually use.** Sum cluster
   mini-sets before comparison; treat AMRAP as having no fixed target rather
   than a target equal to the set count; reject a rep-range finisher as a
   progression input; surface an unparseable prescription instead of
   defaulting it to three sets. Fixes `P2-08`, `P2-09`, `P2-12` — 17 cluster
   and 57 AMRAP prescriptions are affected today.
4. **Correct the progression arithmetic.** Remove the fallback that reaches
   past the exclude-today filter, validate the weight field, cap dumbbell
   increments at 5 lb per hand, extend the machine-leverage discount to
   Plate-Loaded, stop flooring the warm-up ladder at an empty barbell for
   lifts that do not use one, and consolidate the two divergent `equipCat()`
   copies. Fixes `EN-5`, `EN-11`, `EN-12`, `P2-10`, `P2-11`, `P2-13`.
5. **Repair the muscle-confusion rotation.** Rotate intensifiers as a set
   rather than returning one replacement badge, preserve superset structure,
   emit real tempo notation, and derive the tab list from the theme data as
   the project's own shipping checklist requires. Fixes `PG-1`, `PG-3`,
   `PG-4` — all 54 week 3–4 workouts are affected.
6. **Collapse the duplicated program dataset.** `cat-pmc.html` and
   `pmc-workout.html` each carry a full copy of the same 30-workout engine,
   ~865 lines apiece, with nothing enforcing agreement. Remove the 24 dead
   `file:` references while the file is open. Fixes `PG-6`, `PG-7`.

> **Phase 2 shipped (2026-09-10)**, in two pull requests: `2.6`, `2.5` and
> `2.3` in the first, `2.4`, `2.2` and `2.1` in the second. Taken out of order
> on purpose — `2.6` before `2.5` so the rotation engine was repaired in one
> copy rather than two, and `2.3` before the rest because `2.5`'s own new
> regression suite caught its AMRAP defect on the first run.
>
> **Four of the roadmap's own numbers were wrong, and measuring is what showed
> it.** Every one of them was understated:
>
> `2.1` says "six live history-key collisions". On the page that serves all 30
> PMC workouts from one document, **31 of 32 distinct history keys were shared
> by DIFFERENT exercises**, and the worst single key carried **eight** — a
> squat's logged weight in the same bucket as a lat pulldown's, averaged into a
> progression suggestion. Across the wider fleet, 170 of 456 cards carried a
> positional id. Zero real collisions remain (two keys are one lift spelled two
> ways, which SHOULD share a bucket).
>
> `2.5` says "all 54 week 3–4 workouts are affected". 54 is right, but it is
> workout-WEEKS, not workouts: 30 workouts, 60 week-3/4 slots, 6 of them block
> format and 4 hand-authored, leaving 50 that rotate automatically. Within
> them: 77 supersets broken apart, 58 badge sets truncated, 53 tempo rotations
> emitting no tempo.
>
> `2.3` says 17 cluster and 57 AMRAP prescriptions. The cluster defect reaches
> further than the progression classifier the step scopes it to — the same
> `parseInt` sat at **seven** call sites, so tonnage, strain and weekly volume
> all counted a third of a cluster set's work.
>
> `2.2` says the regex classifiers match the curated catalog 36.2% of the time.
> Measured, the coarse taxonomy agreed with the catalog on **416 of 556**
> comparable exercises (74.8%) and answered "other" for 66.
>
> **And one premise did not survive contact with the data.** "Make the curated
> catalog authoritative" assumes the catalog is clean. It is not: going
> authoritative rescues 57 exercises no regex could classify, but overrides the
> regex on 71 more, **17 of which were data errors** — 11 exercises filed under
> Forearms purely because their name carries a grip modifier, and 6 tricep
> kickbacks filed as glute work beside five identically-named ones already
> filed as triceps. Put to the owner with the measurements; the decision was to
> correct the records and then go authoritative, which is what shipped.
>
> **Three bugs were found by the new gates rather than by review**, which is
> the argument for writing them: a bare `AMRAP` states no set count, so four
> prescribed sets rendered three; a `var` holding a regex had not initialised
> when the Node export hook called in; and `chin`, unbounded, matches the
> substring inside ma-CHIN-e — the **seventh** instance of a pattern this
> repository already fixed once, in a file nobody re-checked.
>
> **Two changes were inert until they were driven, not read.** `2.2` was
> measured live on `stats.html` and found to change nothing, because that page
> loads neither the catalog nor the classifier — it carries no card actions, so
> it never received the async catalog injection every workout page gets. And
> `2.1`'s identity gate surfaced a completion chip rendered INSIDE the name
> element, slugging a tick into the history key, on a page where `mc-setlog.js`'s
> own comment already forbids exactly that.
>
> **Migration policy for `2.1`, stated because it is a decision and not a
> detail:** a positional key holds a MIXTURE of exercises, so carrying it
> forward would attribute one lift's sets to another. Only a legacy id that was
> already name-derived is migrated. Everything else is left exactly where it
> is — untouched, still in the store, still recoverable, simply no longer
> written to. No athlete data is deleted and none is mixed.
>
> New gates, all wired into `verify.yml`: `test-mc-pmc-confusion.js` (93),
> `test-mc-cluster-reps.js` (49), `test-mc-classify.js` (60),
> `test-mc-muscle-classify.js` (71), `test-mc-exercise-identity.js` (27,
> browser-driven), plus 37 more in `test-mc-setlog-plan.js` (65 → 102).
>
> **Not closed here:** "DB 21" is filed Forearms while "21s" is Biceps — the
> same movement, filed two ways, outside the correction pattern the owner
> approved. And the root cause of the tick-in-the-name is the page that renders
> the chip there; `mc-setlog.js` reads past it defensively, which is the
> identity layer's job, but moving the chip out is not.

---

## Phase 3 — Automation and edge-case stabilisation

> Needs Phase 2 step 1 for the sync keys.

1. **Sync the six athlete-authored training stores.** Replacements (global and
   page-scoped), order, notes, tempo, favourites and personal intensifiers
   each need a merge rule, not just a backup flag. Replacements matter most:
   a device without them shows the wrong exercise. Fixes `P2-03`.
2. **Make sync conflicts resolvable.** Resolve by timestamp instead of
   first-writer-wins, and sort by real date before applying the five-session
   cap. Fixes `EN-9`, `EN-10`.
3. **Wire the biometric pipeline that already exists.** The `daily_health`
   table, its unique constraint and a correct upsert function are all in place
   and unused while the app keeps the same data in a browser store. Point the
   client at it or retire it — do not leave two homes for one signal. Fixes
   `P2-06`.
4. **Reconcile the two session denominators.** The resume banner counts
   exercises, the toolbar counts sets, so one session reads "1 of 10" and
   "1 of 43". Fixes `P2-07`.
5. **Drive the paths that were only read.** Guided mode, voice control, the
   interval timer, offline prefetch and the naming resolver were opened at
   header level only. Extend `check-journey.js`, the only check in the project
   that drives the app rather than inspecting it at rest.

> **Phase 3 shipped (2026-09-10).** Steps `3.1`–`3.5`, in branch order
> `3.1` → `3.2` → `3.4` → `3.3` → `3.5`.
>
> **`3.1` — the six athlete-authored stores now sync.** Replacements
> (`mc_replacements_global` plus the per-page `mc_replacements|<pageId>`
> family), order, notes, tempo, favourites and personal intensifiers each got a
> real merge rule in `mc-sync.js` and a `store-registry.json` declaration in the
> same change, as the registry's own rule requires. The page-scoped family
> needed a mechanism the file did not have — its keys are a PREFIX, not a fixed
> name — so `PREFIX_STORES()` and `syncableKeys()` were added rather than
> enumerating page ids that change every time a page is added. Favourites are a
> set, not a dictionary, so `mergeStringSetBase()` was written for them; a
> dictionary merge would have resurrected an un-favourited exercise on the next
> pull from the other device.
>
> **The hoisting trap, met three times in this phase alone.** `mc-sync.js`'s
> Node export hook runs at module scope, so a table held in a `var` is still
> `undefined` when the hook reads it. `PREFIX_STORES` had to become a hoisted
> **function**. The identical shape had already bitten `2.3` (a `var` holding a
> regex) and bit once more inside `3.x`. Anything a `module.exports` hook reads
> in one of these browser-first IIFEs must be a function declaration.
>
> **`3.2` — conflicts resolve by time, not by who wrote first.** `entryTs()`
> learned `createdAt` and `date` alongside its existing fields, five stores
> moved from `arrayById` to `arrayByIdTs`, and `mergeSetlog` now sorts by
> timestamp **before** applying the five-session cap — but only when every
> entry actually carries one, so a store of untimestamped legacy entries keeps
> its existing order rather than being reshuffled by a sort on `undefined`.
>
> **`3.4` — one denominator.** The resume banner counted exercises while the
> toolbar counted sets, so a single session read "1 of 10" in one place and
> "1 of 43" in another. Both now state their unit in the visible text and in
> the `aria-label`, which was the actual defect: the numbers were each correct
> for what they measured and neither said what it was measuring.
>
> **`3.3` — `daily_health` kept, and documented in-repo.** The roadmap says
> "the table, its unique constraint and a correct upsert function are all in
> place". Two of those three are true. **There is no upsert function** — the
> table exists (0 rows), the unique constraint exists, and nothing in the
> repository or the database writes to it. The roadmap's framing, "two homes
> for one signal", also did not survive the data: `daily_health` is shaped for
> **device-measured** biometrics and `mc_vitals_v1` for **manual self-report**,
> and only 2 of 5 fields overlap. Put to the owner; the decision was to keep it
> and record it, so `supabase/daily-health.sql` now carries the live schema and
> its four RLS policies, transcribed from `pg_catalog` and deliberately NOT
> applied — the file documents what is already there.
>
> **`3.5` — driving found three defects that reading had not, and corrected the
> step's own premise.** Two of the five paths it names, offline prefetch and the
> naming resolver, **already have substantive unit coverage**
> (`test-mc-offline-prefetch.js`, `test-naming.js`) covering exactly what the
> step describes. "Opened at header level only" described the audit's own
> reading depth, not the repository's. Recorded rather than duplicated.
>
> The other three had nothing, and driving them found:
>
> **Guided mode was dead on eight pages.** `mc-guided.js` keyed its step
> selector to `.ex-card, .ss-card` while `mc-setlog.js`'s own unit selector is
> `.ex-card, .ss-ex, .ex-item` — so the eight frequency pages got a working set
> logger and **no entry button at all**, with no error to notice. Measured by
> driving all **79** pages that load `mc-setlog.js`: 63 offered guided mode, 8
> rendered `.ex-item` rows and offered nothing, 8 are pickers rendering no
> cards (correctly nothing). An `.ex-item` is never nested inside a card on any
> of them, verified before widening the selector, so listing all three cannot
> double-count a step.
>
> **Three touch-floor violations, all on the only way OUT of something.** The
> guided-mode entry button measured 39px and its **exit** button 32px — the one
> control that leaves a mode which dims the entire page. The interval timer's
> back button measured **17×24**, the only way off that screen before a run
> starts. All three now clear 44×44.
>
> **The interval timer itself was correct end to end** and is now asserted:
> Start swaps to the run screen at station 1, Pause freezes the total (it is
> wall-clock arithmetic, so a broken pause reads right for one second and
> drifts after), a reload mid-run resumes in place from its `sessionStorage`
> snapshot, and finishing writes a real `mc_cond_log_v1` entry, shows the
> personal-best line and clears the snapshot.
>
> **Voice is deliberately a load-and-publish assertion, not a drive.**
> `mountButton()` is an intentional no-op — its own comment records that the
> floating mic was retired — and `SpeechRecognition` does not exist in headless
> Chromium, so an end-to-end drive would be testing a stub. What can still
> regress is the injection `mc-card-actions.js` performs, and that is what is
> checked.
>
> All of it lands as a **subsystem pass** in `tools/check-journey.js`, hard
> assertions rather than a ratchet — every one is clean on this branch, so
> there is no "red from birth" problem the fleet-wide chrome ratchet above it
> has to work around.
>
> **The gate found a fourth violation on its own first full run**, which is the
> best argument for it: the interval timer's three run controls measure **43px**
> under the tool's own rendering, where an ad-hoc probe of the same page in the
> same browser had read 44. A one-pixel difference in a font fallback is exactly
> the margin a hand-check loses and a committed gate keeps. Fixed with the same
> `min-height:44px` pattern.
>
> It also exposed a **reporting artifact in `check-journey.js` itself**: the
> summary line divided by the page count while counting chrome, inset AND
> subsystem failures, so one failing subsystem printed "8/9 complete workout
> journeys clean" when all nine journeys were in fact clean. The per-page count
> is now snapshotted before the later passes add to it.
>
> **Proven to fail before being trusted**, per this repository's standing rule
> that a gate which cannot fail is worthless: reverting the step selector makes
> it report guided mode unreachable on the `.ex-item` page, and removing the
> exit button's floor makes it report the control's real size. Its fourth shape
> was proven organically, by the 43px finding above.

---

## Phase 4 — Retention and habit-loop implementation

> Every step depends on an earlier phase.

1. **Make the streak understand rest days.** Count adherence to the schedule,
   not consecutive calendar days: a prescribed rest day preserves the streak,
   a missed training day breaks it. Each program record already declares its
   rest positions. Fixes `EN-4` and the unreachable seven-day milestone.
2. **One lift, one curve, across every program.** An all-time estimated
   one-rep-max curve per lift with real records on it. Needs Phase 1 step 4
   and Phase 2 step 1.
3. **Let readiness change the session.** Give the pre-session brief authority
   to offer a reduced-volume version of today's day, and schedule a real
   deload at the end of each block — no flagship program has one today,
   including the fifteen-week one. Fixes `PG-2`; needs Phase 2 step 2.
4. **Make effort a one-tap answer.** Auto-regulation is well designed and
   effectively never fires: effort is recorded on 1.6% of sets. Three choices
   on the last set of an exercise only. Fixes `EN-7`.
5. **Turn the notification path on and earn the permission.** Ask at one
   welcome moment and immediately after a personal record, and keep the
   content specific. Needs Phase 1 steps 1 and 2.

---

## Phase 5 — Post-launch reliability

> First sprint after go-live.

1. **Replace the year-less date key** (`FIX-06`), with a migration, so
   existing sessions are not orphaned. Gate: manual scenario M5.
2. **Surface the retention ceilings.** Five sessions per exercise and 200
   workouts are invisible limits today (`L-07`).
3. **Handle a full storage quota visibly.** The write is wrapped in a catch
   that swallows the failure (manual scenario M7).
4. **Confirm the anonymous-readable override rows.** 67 rows are
   world-readable by design; verify none carries licensed program text, since
   the public build's content stripping does not apply to database rows
   (`L-08`).
5. **Wire the new gates into CI** — all five suites into `verify.yml`.

---

## Gates introduced by this roadmap

| Gate | Path | Asserts |
|------|------|---------|
| `TEST 1` | `tools/test-mc-setlog-concurrency.js` | Two real tabs, five sets each; every accepted set survives. A single-tab control must also pass, so a broken harness cannot read as a pass. |
| `TEST 2` | `tools/test-mc-crash-recovery.js` | Persistent profile, `SIGKILL`, relaunch; sets restored and not duplicated. Graceful-close control in the same run. |
| `TEST 3` | `tools/test-mc-store-resilience.js` | Five corruption shapes across five pages; zero uncaught exceptions. |
| `TEST 4` | `tools/test-mc-numeric-guards.js` | Hostile numeric input against the real exports; every result finite and non-negative. |
| `TEST 5` | `tests/test_rls.py` | The seven cross-user attacks, parametrised, inside a rolled-back transaction. The one place `pytest` is the right tool — the database layer has no JavaScript to test against. |

Each is written to **fail on the current build and pass after its matching
fix**, which is the only way to know a gate works. That is the same discipline
`check-topbar-inset.js`, `check-design-tokens.js` and `check-journey.js` were
built under.

**A correction to the original mandate, recorded because it will come up
again.** The brief that opened pass 3 asked for `pytest` suites against paths
like `src/engine/progression.py`. This repository has no Python application
code, no `src/`, no `package.json` and no test framework — it is flat HTML and
vanilla JavaScript with build tooling under `tools/`. Suites written that way
could not import anything. Four of the five gates therefore follow the
project's real convention: a plain `node` script run against the real source
and wired into `verify.yml`.

---

## Go-live matrix

| Gate | Status at open | Criterion to pass |
|------|----------------|-------------------|
| Data durability | **Fail** | `TEST 1` and `TEST 2` green. |
| Crash recovery | **Fail** | Relaunch after a force-quit restores every checked set, no duplicates. Manual M2 on a real device. |
| Error resilience | **Fail** | `TEST 3` green. |
| Numeric safety | **Fail** | `TEST 4` green. |
| Database integrity | Partial | Migration applied, `TEST 5` green, an account can actually be deleted. |
| Access control | **Pass** | Seven attacks repelled. Keep it passing with `TEST 5` in CI. |
| Offline | **Pass** | Verified in pass 2: page served, day rendered, set logged with the network cut. |
| Notifications | **Fail** | Fix or disable before launch. A dead feature is better than a broken one. |
| Multi-device | Unverified | Manual M3 and M4 on two real signed-in devices. Not testable from an agent session in any pass. |

### Manual scenarios — the owner's to run on a real device

| # | Scenario | Pass criterion |
|---|----------|----------------|
| M1 | Same day open in two tabs, three sets in each, reload both | All six sets present in both |
| M2 | Log four sets, force-quit from the task switcher, reopen | Four sets restored, none duplicated |
| M3 | Log ten sets while toggling airplane mode; open a second device | Ten sets on both, no cloud duplicates |
| M4 | Two devices signed in, different days trained simultaneously | Both sessions survive the merge |
| M5 | Log a session, move the clock forward six weeks, reopen the exercise | History intact, no date-key collision |
| M6 | Substitute an exercise mid-session, then revert the swap | Logged sets stay attached, no orphan key |
| M7 | Fill browser storage to the quota, then log a set | A visible warning, not a silent no-op |

---

## Repository handoff

| Path | Action | Change | Phase |
|------|--------|--------|-------|
| `mc-setlog.js` | edit | `withStore()`, route `save()` through it, cross-tab `storage` listener, cloud rehydrate on init | 0.1, 0.2 |
| `mc-supabase.js` | edit | `getSessionSets()`; `logSet()` insert → upsert; delete on uncheck | 0.2, 0.4 |
| `mc-strain.js` | edit | Guard `sessionTonnage()` against null members and non-arrays; clamp weight, reps, duration | 0.3 |
| `mc-maxout.js` | edit | Make `round5()` and `applyEquipCoeff()` total; add Plate-Loaded to the discount | 0.3 |
| `mc-data.js` | edit | Export the shared `readWorkoutLog()` | 0.3 |
| `mc-stats.js`, `mc-recap.js`, `mc-calendar.js`, `mc-exercise-trends.js`, `mc-maxout.js` | edit | Delete the five local log readers, call the shared one | 0.3 |
| `mc-sync.js` | edit | Sort by date before the five-session cap; resolve conflicts by timestamp | 5.1 |
| `supabase/phase12-launch-hardening.sql` | new | Dedup, unique constraint, cascade FK, health delete policy | 0.4 |
| `tools/test-mc-setlog-concurrency.js` | new | `TEST 1` | 0.1 |
| `tools/test-mc-crash-recovery.js` | new | `TEST 2` | 0.2 |
| `tools/test-mc-store-resilience.js` | new | `TEST 3` | 0.3 |
| `tools/test-mc-numeric-guards.js` | new | `TEST 4` | 0.3 |
| `tests/test_rls.py` | new | `TEST 5` | 0.4 |
| `tools/check-single-impl.js` | edit | Add `readWorkoutLog` to the declared list | 0.3 |
| `.github/workflows/verify.yml` | edit | Add the node gates; pytest job behind a repository secret | 5.5 |
| `.github/workflows/weekly-checkin.yml` | config | Set `WEEKLY_CHECKIN_SECRET` and the matching project secret | 1.1 |
| `CLAUDE.md` | edit | Add the new gates to the local gate list | 5.5 |

---

## What this audit still cannot tell you

Recorded rather than absorbed into a clean sign-off, because the mandate asked
for confirmation that every path was analysed with zero unverified assumptions
and that confirmation would be false.

- **Module coverage is partial.** About 45 of 102 modules were opened across
  the three passes. Roughly 57 remain, mostly page engines and owner-mode
  tooling outside the flagship training path.
- **Read but not driven.** Guided mode, voice control, the interval timer,
  offline prefetch, the program store, the naming resolver and the hints
  layer. Phase 3 step 5 closes this.
- **Two HTTP probes unmade.** Outbound access to the project is blocked from
  an agent session. The platform API's "Function not found" for both slugs is
  strong corroboration, not the call itself.
- **Multi-device sync is unverified.** Every sync finding comes from reading
  the merge functions and the live store keys. This is the same gap
  `cookbook-bridge-roadmap.md`'s `B5` already records as the owner's to close.
- **Rendering measurements were not attempted.** `fonts.googleapis.com` is
  unreachable from an agent sandbox's browser, the same constraint
  `premium-design-roadmap.md`'s `P4` and `W-I3` both hit.
- **The production sample is one account with 125 logged sets.** Proportions
  are indicative; the categorical findings — null columns, failed runs — hold
  regardless of sample size.
- **Muscle attribution depends on the classifier this audit finds
  unreliable**, so per-muscle volume figures are lower bounds and the
  imbalance is the trustworthy part.
- **Nothing at scale.** Everything is single-user. Three passes say nothing
  about load.

Nothing in the audit modified the repository or the database: the SQL ran
inside rolled-back transactions and every browser test used a throwaway
profile.
