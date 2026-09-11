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
> **Both open items closed (2026-09-10), and measuring changed both answers.**
>
> **The 21s records.** The contradiction was real — "DB 21" filed Forearms,
> "21s" filed Biceps — but it was not the defect. `mc-classify.js` indexes the
> catalog by exact lowercased name, and **neither string is a name any page
> renders**: the programs render "DB 21s", "DB 21's" and "DB 21s (standing,
> full + partial curls)". All three matched no record, fell through to the
> regexes, and resolved to **"other"** — no muscle at all on the Stats body
> map, the post-session reveal or the Readiness Brief. So the fix is two
> things, not one: `DB 21` is corrected to Biceps and off the `Forearm Curl`
> master, and the three rendered spellings each get a record under a shared
> `21s` master — the same shape `Barbell Row` and `Hammer Curl` already use, so
> the Library shows one collapsible group rather than five loose rows. All five
> names now resolve Biceps. Catalog 577 → 580.
>
> **A second, larger finding came out of that.** `tools/gen-schedules.js`
> generates the per-day `muscles` used by the Readiness Brief, and it loaded
> `mc-muscle-map.js` **alone** — not the catalog, not `mc-classify.js`. So it
> ran the classifier permanently in its regex fallback while the two surfaces
> that consume its output load all three files and read the curated record. Its
> own comment claimed the two "can never disagree". Wiring the catalog in moved
> **eight day records**: a Chest day stopped reporting Triceps (only "Dip
> Machine" ever said so, and the catalog files it as Chest), two Arms days
> stopped reporting Chest, three Back days gained Shoulders from their shrug
> and rear-delt work, a Deadlift/Pull day dropped Legs (the catalog files
> "Barbell Deadlift" as Back), and "Cable Crossover" resolved at all for the
> first time.
>
> **The tick chip. It was never visible.** The plan was to move it out of
> `.ex-name`; measuring first showed there was nothing to move *to*. `base.css`
> carried `.ex-card.a-card .stndr-ck{display:none}` — "completion shown via idx
> + strike" — and **all 191 cards across the four STNDR pages render as
> `.a-card`**. So the chip was pure dead decoration whose only effect was
> corrupting the identity it sat inside. It is deleted, along with the
> `base.css` rule that existed solely to hide it (one fewer `MARKET:STRIP`
> block). Completion still reads as the struck-through name and the dimmed
> card, and the card-body tap — the only thing that ever worked — is untouched.
>
> **The gate is at the source now, not at the key.** `test-mc-exercise-identity.js`
> already asserted that no history key carries a tick glyph, which only proves
> the defensive read works, and only for the one glyph somebody happened to
> inject. It now compares each `.ex-name`'s own text against the authored name
> node, so **any** injected text fails — a badge, a set counter, a superset
> letter. All four STNDR pages joined the sweep. Proven to fail on the tree
> before the fix (191 of 266 cards dirty, every other page already clean) and
> to pass after; 27 → 47 assertions.

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

> **Phase 4 opened (2026-09-10) — scoping pass, and four of the phase's own
> premises did not survive it.** Two decisions taken with the owner, recorded
> below. Per the Planning rule this entry authorises implementation; each step
> still reports what it measured.
>
> **1. "Each program record already declares its rest positions" is true of
> three programs, not ten.** Evaluated from `mc-pm-data.js`: only `ss`
> (rest `[6,7]`), `mm` (rest `[5]`, 3 phases) and `hv` (4 phases, a different
> rest pattern each week) carry a `schedule`. The other seven — `pmc`, `mc`,
> `ks`, `stndr`, `pump`, `gainz`, `psu` — carry none, and `F5` left it that way
> on purpose: their metas describe collections ("7 Splits", "10 Workouts"), not
> blocks, so there is no prescription to adhere to. **Decision:** a program with
> no schedule infers its rest pattern from the athlete's own history.
> `mc-bridge.js`'s `likelyTrainingDays()` already derives exactly that from
> `mc_workout_log_v1` for the cookbook, so this is a second consumer of
> existing arithmetic, not a new one.
>
> **2. There are two streaks, and they disagree.**
> `mc-live-tracker.js`'s `computeStreak()` walks `mc_activity.days` backwards
> over consecutive calendar days, and `dashboard.html`'s `maybeCheckStreak()`
> independently re-derives a seven-day streak from `mc_workout_log_v1` for the
> milestone push. Two implementations of one concept over two different stores
> — the drift shape `check-single-impl.js` exists for. The milestone is
> unreachable for a second reason on top of `EN-4`: **every program in the app
> rests at least one day a week**, so an athlete who follows any prescription
> exactly can never log seven consecutive calendar days.
>
> **3. Step 2 is largely built, and what is missing is not what the step
> says.** `mc-exercise-trends.js` already charts every lift across every
> finished workout **matched by name app-wide**, with an Epley estimate per
> session — "one lift, one curve, across every program" is the behaviour it
> already has. Two real gaps sit underneath it. There is **no record marked on
> the curve**, which is the half the step actually asks for. And there are
> **two divergent one-rep-max estimators**: `mc-exercise-trends.js` uses bare
> Epley, while `mc-maxout.js` applies the Cable/Machine ×0.85 coefficient that
> Task 3.3 added precisely because bare Epley overstates a machine lift. The
> same lift therefore reports two different estimated maxes depending on which
> screen the athlete is looking at. Consolidating them onto one implementation
> is this step's real content — the same call Phase 2.4 made for `equipCat()`,
> and it needs no new decision.
>
> **4. Step 4's control is a non-semantic `<div>`.** `.mcl-rpe` is a seven-step
> cycling chip (`– → 8 → 8.5 → 9 → 9.5 → 10 → F`) on **every** set row, so
> recording "to failure" costs six taps and the chip is keyboard-unreachable —
> Volume II Phase 6 converted the rest-timer and set-check controls to real
> `<button>`s and this one was not in that sweep. The step's own prescription
> (three choices, last set of an exercise only) fixes the tap cost; the element
> type is a second, separate defect on the same control.
>
> **5. Step 5 cannot be fully proven from a session.** It needs Phase 1 step 1,
> the weekly check-in secret, which is the owner's and still open. **Decision:**
> build it, verify everything testable without a real scheduled run, and record
> the unproven half explicitly rather than reporting the step closed.
>
> **Step 1 shipped (2026-09-10) — one streak, and it counts adherence.**
> `mc-streak.js` (`MC_STREAK.compute()`) holds the count; the two divergent
> implementations are gone, and `computeStreak` is registered in
> `check-single-impl.js` so a third cannot appear. Three modes, picked by what
> the athlete's data supports: **schedule** walks the program's own day
> sequence backwards from the last completed day (a prescribed rest day is
> skipped, a missed training day ends it — no calendar mapping is involved,
> because the day sequence IS the prescription); **history** stands the
> athlete's own training weekdays in for one, via `mc-bridge.js`'s existing
> `likelyTrainingDays()`; **calendar** is the original count, kept so a
> brand-new athlete still reads something.
>
> **Staleness is derived, not picked.** A schedule streak has no calendar in
> it, so alone it would freeze at 12 forever. The grace window is the longest
> run of consecutive prescribed rest days anywhere in the block, plus one, read
> off `isRest()` — so `hv`, which rests a different pair each week, answers for
> itself and nothing has to know which program it is looking at.
>
> **The day arithmetic is not reimplemented.** The caller passes
> `mc-program-progress.js`'s own `isRest()`. Its `def` derivation, which lived
> inline in `dashboard.html`'s `dayModuleDef()`, moved into that module as
> `defFromSchedule()` — the streak is its second consumer and runs on
> `stats.html`, where the day module's dependencies are not loaded.
>
> **The label was wrong the moment the count changed.** Ten prescribed training
> days span fourteen calendar days on a 5-on 2-off block, so "10-day streak"
> was a false statement. `MCActivity.get()` publishes `streakUnit` alongside
> the count, and all three surfaces (the momentum strip, the licensed program
> card, the Stats heatmap line) plus the milestone push read it: "10-workout
> streak" in schedule and history mode, "3-day streak" in calendar mode.
>
> **A real bug, found by driving and not by reading — the same class this
> repository keeps meeting.** `likelyTrainingDays()` answers with
> **capitalised** codes (`Mon`, `Tue`, …), because `mc-bridge.js` is
> byte-identical with the cookbook's copy and its `DAYS` array always was. The
> first implementation assumed lower case, so the pattern check found no
> training day and **every history-mode athlete fell silently through to
> calendar mode** — no error, and a unit test written against the same wrong
> assumption passed. Driving `dashboard.html` with a real eight-week Mon/Wed/Fri
> log is what exposed it (read 1, should read 24). The pattern is normalised on
> the way in rather than changing the gated shared module, and the suite now
> pins the REAL shape taken from `mc-bridge.js`'s own array.
>
> `tools/test-mc-streak.js` — 35 vm-sandboxed assertions against the real
> source, wired into `verify.yml`, and **proven to fail on the old behaviour**
> (a probe that breaks on a rest day instead of skipping it fails 6, including
> the headline case) rather than only to pass on the new.
>
> **Step 2 shipped (2026-09-10) — one estimator, and records on the curve.**
> The step reads "an all-time estimated one-rep-max curve per lift with real
> records on it". The curve already existed and was already cross-program:
> `mc-exercise-trends.js` charts every lift across every finished workout,
> matched by name app-wide. What was actually wrong sat underneath it.
>
> **There were TWO estimators and they disagreed about the same logged set.**
> `mc-maxout.js` capped reps at 12 (Epley is fitted on low-rep work and runs
> away above about a dozen) and discounted leverage-assisted equipment ×0.85;
> `mc-exercise-trends.js` did neither. Measured before the fix:
>
> | exercise | set | equipment | Max Out | trend sheet |
> |---|---|---|---|---|
> | Tricep Rope Pushdown | 60 × 20 | Cable | 71 | 100 |
> | Cable Crossover | 40 × 25 | Cable | 48 | 73 |
> | Leg Press | 300 × 15 | Machine | 357 | 450 |
> | Barbell Bench Press | 225 × 5 | Barbell | 263 | 263 |
> | DB Curl | 35 × 12 | Dumbbell | 49 | 49 |
>
> They agreed only on a barbell or dumbbell set at or under the cap, so the
> same lift reported two different maxes depending on which screen was open —
> and the difference is 26–52% on exactly the equipment the coefficient exists
> for. `e1rm()` and `applyEquipCoeff()` now live in `mc-log-read.js`, chosen
> because **every** page that loads the trend sheet already loads it (79 of 79,
> checked) and so does `max-out.html`: one implementation, no new script tag on
> any page. Both are registered in `check-single-impl.js`.
>
> **A source check backs the registry**, because `check-single-impl.js` catches
> a second `e1rm` DECLARATION and not the arithmetic written inline under
> another name. `test-mc-maxout.js` now sweeps all 296 tracked files for an
> Epley expression outside `mc-log-read.js` and fails on one — proven by
> planting a copy in `mc-stats.js`. Its first version reported
> `mc-exercise-trends.js`, which no longer contains the arithmetic at all: the
> scan was reading the formula out of a PROSE header. It strips comments now,
> and that header — which still claimed the file computed Epley itself — was
> corrected rather than left to mislead.
>
> **Records on the curve.** `MC_CHART.line()` takes `p.best` and draws that
> point as a ringed dot with "best to date" in its `<title>`, so the mark is
> not carried by colour alone (one accent per screen, and it has to read in
> both themes). A point is marked when it is a new all-time best **in the
> series being shown**, so the mark means the same thing on all three tabs; the
> first session is never marked, or every one-session curve would look like a
> record. The app's own PR flag — `mc-finish.js` writes it, the Stats PR
> timeline reads it — is reported separately in the meta line (🏆 2 PRs) rather
> than folded in, so the two notions of "record" cannot drift into disagreeing.
>
> Verified live on `stats.html` at 320 and 390: six sessions of a cable
> pushdown mark 3 records on Top weight, 4 on Est. 1RM and 1 on Total reps,
> the Est. 1RM series opens at **71** for the 60 × 20 set (the capped,
> discounted figure — it would have read 100 before), no horizontal overflow,
> zero console errors.
>
> **Steps 3 and 4 shipped (2026-09-10).** Step 4 was taken before step 3
> because step 3 needed a decision and step 4 did not.
>
> **Step 4 — six choices, two outcomes.** The effort control was a seven-step
> chip on EVERY set row, so recording "to failure" cost six taps, and effort
> was logged on 1.6% of sets. Measuring what READS it showed the deeper
> problem: `mc-suggest.js`, `mc-strain.js` and `mc-readiness.js` all test the
> same predicate — `rpe === 'F' || parseFloat(rpe) >= 9.5` — so six choices
> only ever produced TWO answers. It is now one question on the finished
> exercise: **Easy / Solid / To failure**, three real `<button>`s at the 44px
> floor (the old chip was a non-semantic `<div>`, so keyboard-unreachable —
> Volume II Phase 6 fixed exactly this for the rest-timer and set-check
> controls and missed this one). The stored values stay inside the old
> vocabulary (`8`, `9`, `F`), so existing logs, the Supabase column and all
> three consumers are untouched. Tapping the chosen answer again clears it,
> and the freed 44px column goes to the weight and reps inputs.
>
> **A bug the change created, caught by driving it:** `onCheck()` read the
> removed element for its rpe value, so re-checking the last set would have
> written `''` and silently erased an answer already given. It carries the
> stored value forward now.
>
> **Step 3 — the decision first.** "Schedule a real deload at the end of each
> block" has two readings, and one of them rewrites authored program content
> across the page data, the landing badges, the dashboard and `mc-pm-data.js`,
> all of which must agree. Put to the owner: **the last week of each block
> becomes a deload** — no week counts change.
>
> `deloadWeeks` is DATA on the schedule record, not "the last week" as a rule
> in a renderer, so a program can declare none. It is re-derived from the
> definition on every read and never persisted, for the same reason `phases`
> is: a stored record must not be able to contradict the program's own
> prescription. `ss` carries `[6]` by hand, `gen-schedules.js` emits `[weeks]`
> for `mm` and `hv`. Deliberately the last week of the BLOCK and not of each
> phase — `mm` is three five-week phases, but `hv` is four phases of ONE week
> each, where per-phase would make every week a deload.
>
> **Both halves reduce volume through ONE code path**, so they cannot drift
> into meaning different things: `planFor()` builds one working set fewer,
> floored at one, and `plannedSetCount()` — `mc-finish.js`'s completion
> denominator — falls with it automatically. Drop rows are untouched, because a
> drop set IS the reduction on that exercise, and a prescription that never
> stated a set count is left alone (P2-12): trimming a default nobody asked for
> would be inventing a number twice. The card says which reason applies.
>
> The pre-session brief gains a third action, **Lighter**, offered only when
> there is a real reason — a group `MC_READY` itself calls overreached, a
> Recovery Score under its low band, or a deload week. Verified suppressed with
> none of the three. It writes `mc_deload_v1` to sessionStorage (a decision
> about today's session, not a setting: tab-scoped, timestamped, four-hour
> window, cleared by `mc-finish.js` on completion) and is declared in
> `store-registry.json` in the same change.
>
> **A real race, found by driving a deep link and not by reading.** With
> `?week=4&day=1` the deload did NOT apply, while the same week reached through
> the day list did. `mc-pm-data.js` was reaching three of the five
> schedule-bearing pages only through an ASYNC injection, so the first cards
> were built before the program record existed — and the resolved answer was
> cached, so one early "no" governed the whole page load. Two fixes: those
> pages now load the data synchronously before `mc-setlog.js`, and an
> unknowable answer is never cached, so a mis-ordered page degrades for one
> pass instead of permanently.
>
> **And a bug that was not one.** `hv-block.html?week=2` appeared to render a
> day with zero exercises. Week 2 of that block is entirely supersets, so it
> renders `.ss-ex` units and no `.ex-card` — the probe was counting the wrong
> selector. Confirmed identical on the unchanged tree before concluding it.
>
> Verified live: week 4 of the four-week block prescribes 4 rows where weeks 1
> and 2 prescribe 5, with `plannedSetCount` agreeing; a page with no schedule
> is untouched; the brief's three buttons fit at 320 with no overflow and the
> Lighter control measures 83×45; the effort answer survives a reload.
> `mc-program-progress.js` grew 91 → **102 assertions**, every local gate is
> green and `check-journey` is 9/9; `quick-tour.html` documents both.
>
> **Step 5 shipped (2026-09-10) — and the ask was never on screen.** The step
> reads "turn the notification path on and earn the permission". Driving the
> dashboard rather than reading it found why the path was dead beyond the
> unset secret: **`#pushChip` does not exist in the document.** The CSS for it,
> the `initPushChip()` guard chain and the global `onEnablePush()` have all
> been in `dashboard.html` since the push work landed, but the ELEMENT was
> never authored — `getElementById('pushChip')` returned null on every load,
> and the `if (chip)` guard swallowed it. So the app has never once asked for
> notification permission. Verified in a browser, not inferred.
>
> **Two asks now, and they are one ask between them.** The welcome moment is
> the chip, finally rendered — as a real `<button>`, so Enter and Space work —
> and shown only once the athlete has **finished at least one workout**, since
> asking a first-time visitor to accept notifications before they have trained
> is the ask people refuse. The second is the moment the step names: right
> under the new records on the Session Complete recap, naming the record it
> would have told them about, on the user gesture that opened the recap
> (browsers require one). Both write `mc_push_asked_v1` **before** calling the
> browser's dialog — whatever the athlete answers there, this app has had its
> one turn — so neither nags and they never compete.
>
> `mc-push.js` is loaded **on demand** by the recap rather than added to 78
> workout pages: the service worker already precaches it, so it is a cache hit
> offline too, and nothing loads it for the athletes who never see the prompt.
>
> **Content.** The PR push said "your best lift ever", which is true of every
> PR and so says nothing. It now carries the number it beat and the difference,
> which is the part worth reading on a lock screen and was already in hand at
> the call site. The seven-day milestone copy was corrected in step 1, since a
> streak of prescribed sessions is not "seven days in a row".
>
> **Not closed, and it is not code.** Phase 1 step 1 — the repository secret
> the weekly check-in workflow guards on — is still unset, so the Sunday
> check-in has still never fired and cannot be proven from a session. Every
> other part of this step is verified live: the chip is hidden with no
> training history, appears after one finished workout (354×94 at 390, 284×122
> at 320), and is suppressed once asked; the post-PR offer appears through the
> real `_FW.confirm()` flow with a 96×44 control and is suppressed once asked;
> no console errors and no overflow at 320 or 390.
>
> **A pre-existing defect surfaced by the new copy, not fixed here.** The
> recap's PR chips take their name from `deSlug()`, which rebuilds a display
> name from the lowercased, 24-char-truncated history slug — so a lift renders
> as "Bb Flat Bench Press". The push itself is unaffected (`mc-setlog.js` reads
> the authored name off the card), but the recap and now this prompt both show
> the mangled form. Fixing it means carrying the authored name into the log
> entry, which is a data-shape change and wants its own step.

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

> **Phase 5 shipped (2026-09-11) — all five steps.** Three decisions were taken
> with the owner up front. Two of the five steps needed no code at all, and
> finding that out first is what kept the phase small.
>
> **Step 5 was already done.** All five Phase 0 suites have been in
> `verify.yml` since Phase 0 (lines 216, 234, 399, 407, 415), the pytest job
> already skipping behind its own secret. What this step actually added is the
> ONE gate Phase 5 itself introduces, `tools/test-mc-day-key.js`.
>
> **Step 4 measured clean, and then became a test anyway.** Five tables are
> readable with no session at all; `program_overrides` holds the audit's 67
> rows across six page ids, **none of them a licensed page**, and a brand-term
> scan of both override tables over all ten terms returned **zero**. A
> one-time confirmation would rot, and the reason it would is specific:
> `build-market.py` strips licensed content from FILES, and a database row is
> not a file, so nothing in that pipeline has ever looked here — an owner
> editing a licensed page in PM mode writes its text straight into a
> world-readable row. `tests/test_rls.py` now reads `content-manifest.json`
> directly, so the terms and pages it checks are the same list the build
> enforces rather than a second copy free to disagree. Both predicates were
> run against a planted row and fire; against the real data they read zero.
>
> **`5.1` — the day key carries a year.** `mc_setlog_v1` stamped every session
> with `toLocaleDateString('en-US', {month:'short', day:'numeric'})` — `Sep 11`,
> a display LABEL used as a primary key. It collides with itself annually, it
> is locale- and timezone-shaped, and it **cannot be ordered**, which is why
> `EN-10` had to patch `mergeSetlog`'s five-session cap with a separate numeric
> `ts` and could only reorder a list in which every entry carried one — a store
> holding any older session did not, so the common case stayed on encounter
> order and the cap kept dropping the wrong session.
>
> `mc-log-read.js` owns the dated key and the upgrade, because it is the one
> module both the browser and the `vm`-sandboxed suites can reach. A legacy
> label is dated from its own `ts` when EN-10 stamped one and otherwise from
> the **most recent past occurrence**; one it cannot read is returned
> **untouched**, never replaced with a guess. `Feb 29` walks back to a year in
> which that date exists rather than rolling to Mar 1.
>
> **Migrating in the READ path is the decision that kept this small.** `st()`
> hands every caller an already-dated store, so `mc-setlog.js`'s eight
> comparison sites did not change at all and the store on disk converges on the
> first save — no one-shot migration to sequence, and a legacy entry arriving
> later from sync is upgraded on the next read rather than slipping past a
> migration that already ran.
>
> **Four modules read that store through their own private copy of the read**,
> and every one had to be dated too: `mc-suggest.js`, `mc-finish.js` (three
> sites), `mc-live-tracker.js`, and `mergeSetlog` itself. That was verified,
> not assumed: with the normaliser neutered on a real page — dated "today",
> legacy store — a real `_FW.confirm()` banked a finished workout containing
> **zero sets**, and two with it. Changing `dayStamp()` alone would have
> shipped exactly that.
>
> **A `var` at module scope is `undefined` on the Node path, and the sandboxed
> suite caught it on its first run.** `mc-sync.js`'s `module.exports` hook sits
> above its own `if (window.__mcSync) return;` guards and relies on
> function-declaration hoisting; the guard returns before any module-level
> `var` INITIALISER runs, so a regex held in one threw the moment a test called
> in. Phase 2.5 hit the identical trap in `mc-pmc-confusion.js`. A second gap
> was closed in the same file: the merge suite's sandbox has no `require`, so
> `mergeSetlog`'s guard would have resolved to null and the tests would have
> exercised the **un-normalised** path while reporting a pass — it now loads
> the real `mc-log-read.js` into the same context, as a page does.
>
> **A fixture that was always nonsense.** The EN-10 cases used `ts: 1000..9000`
> — five seconds past the epoch — harmless while `ts` was only ever compared
> against another `ts`, and wrong the moment a legacy label could be dated from
> it: all five sessions collapsed onto 1 Jan 1970 and unioned into one. They
> carry real stamps now, and the "a mixed list keeps encounter order" assertion
> is **replaced** rather than repaired, because that behaviour is precisely
> what FIX-06 removes.
>
> **`5.2` — the ceilings, only once they are real.** 200 finished workouts and
> 5 sessions per exercise are both hard bounds that nothing ever stated. The
> history page names the first at 200, and the exercise progress sheet names
> whichever bounds it — silent at 199 logs and 4 sessions, verified at both
> sides of both thresholds. The per-exercise depth is keyed through
> `MCSetlogUtil.exIdOf`/`histKey`, never by re-slugging the name, and is simply
> not claimed on a page with no cards (`stats.html` opens the same sheet).
>
> **`5.3` — Phase 0's warning had never once been shown.** Phase 0 left a
> stopgap on the set-log write that called `MC_TOAST` behind an
> `if (window.MC_TOAST)` guard. **`MC_TOAST` is defined nowhere in the tree**,
> so the guard swallowed it — the same shape as the `#pushChip` element Phase
> 4.5 found. The banner builds its own element and depends on nothing.
> Verified by filling localStorage until the browser really refused: it
> renders, carries `role="alert"`, its dismiss measures exactly 44×44 at both
> 390 and 320, nothing overflows sideways, and dismissing removes it.
> `MCSetlogUtil.writeStore()` is published and the workout-log and in-progress
> session writes route through it.
>
> **What that measurement corrected about M7 itself.** With storage genuinely
> full, the set-log write **still landed** — replacing an existing key frees
> its old bytes first, so a small delta write fits. The real exposure is
> narrower than "a full device loses every set": it needs a write that GROWS
> past the remaining headroom, which is the first set of a new session, a
> newly banked workout, or a sync pull. Worth knowing before anyone reads M7
> as broader than it is.

---

## Gates introduced by this roadmap

| Gate | Path | Asserts |
|------|------|---------|
| `TEST 1` | `tools/test-mc-setlog-concurrency.js` | Two real tabs, five sets each; every accepted set survives. A single-tab control must also pass, so a broken harness cannot read as a pass. |
| `TEST 2` | `tools/test-mc-crash-recovery.js` | Persistent profile, `SIGKILL`, relaunch; sets restored and not duplicated. Graceful-close control in the same run. |
| `TEST 3` | `tools/test-mc-store-resilience.js` | Five corruption shapes across five pages; zero uncaught exceptions. |
| `TEST 4` | `tools/test-mc-numeric-guards.js` | Hostile numeric input against the real exports; every result finite and non-negative. |
| `TEST 5` | `tests/test_rls.py` | The seven cross-user attacks, parametrised, inside a rolled-back transaction. The one place `pytest` is the right tool — the database layer has no JavaScript to test against. **Phase 5.4** adds the other question a database connection is the only way to ask: what the WORLD can read. Four world-readable tables, scanned for every brand term and licensed page in `content-manifest.json` — the same list `build-market.py` enforces over files, applied to the rows that pipeline has never looked at. |
| `FIX-06` | `tools/test-mc-day-key.js` | The dated day key and the legacy-label upgrade, against `mc-log-read.js`'s real exports. Every year-inferring case passes an explicit `now`, so the suite asserts the same thing on every day of the year rather than passing in September and failing in March. |

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
| Access control | **Pass** | Seven attacks repelled. Keep it passing with `TEST 5` in CI. Phase 5.4 adds the world-readable scan to the same suite: 67 override rows, zero on a licensed page, zero brand-term hits. |
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
| `mc-sync.js` | edit | Date both sides in `mergeSetlog` before bucketing; sort by the dated key, `ts` as tiebreaker | 5.1 |
| `mc-log-read.js` | edit | `dayKey()`/`dayLabel()`/`normalizeDay()`/`normalizeSessions()` — the dated key and its migration, in the one module both the browser and the `vm` suites reach | 5.1 |
| `mc-setlog.js` | edit | `st()` migrates on read; `dayStamp()` dates; `writeStore()` published; the quota banner | 5.1, 5.3 |
| `mc-suggest.js`, `mc-finish.js`, `mc-live-tracker.js` | edit | Date the store in each of the private readers before comparing | 5.1 |
| `mc-session.js`, `mc-finish.js` | edit | Route the session and workout-log writes through `MCSetlogUtil.writeStore()` | 5.3 |
| `workout-logs.html`, `mc-exercise-trends.js`, `base.css` | edit | The two retention ceilings at the cap; the quota banner's styles | 5.2, 5.3 |
| `tools/test-mc-day-key.js` | new | `FIX-06` | 5.1 |
| `tools/test-mc-sync-merge.js` | edit | Load `mc-log-read.js` into the sandbox; real epoch fixtures | 5.1 |
| `tests/test_rls.py` | edit | The world-readable leak scan, read from `content-manifest.json` | 5.4 |
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
