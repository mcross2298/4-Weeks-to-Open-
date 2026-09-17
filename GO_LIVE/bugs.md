# GO LIVE multi-app run — 2026-09-17 — defects

Full records with scenario, expected, observed, root cause, fix and regression test are in
[`go_live_report.html`](go_live_report.html) (Defect matrix tab).

| ID | Sev | App | Feature | Status |
|---|---|---|---|---|
| `DEF-CR-01` | P1 | MC Training | Session restore showed the prescription, not the performance | FIXED + gate |
| `DEF-CR-02` | P1 | MC Training | A mid-session reload destroyed the session record on the re-render engine | FIXED + gate |
| `DEF-CR-03` | P3 | MC Training | A first-run hint swallowed the tap that starts Guided Mode | FIXED |
| `DEF-FIN-01` | P1 | Cross' Finances | A legitimate backup could not be restored | FIXED + gate |
| `DEF-CB-01` | P3 | Cookbook | 8 recipes' calories disagree with their own macros by 15-24% | REPORTED + gate |
| `DEF-CB-02` | P3 | Cookbook | 10 ingredients do not scale sanely; 3 REDUCE when the recipe doubles | REPORTED + gate |
| `DEF-08` | P1 | MC Training | Weekly check-in: 10/10 scheduled runs failed since 12 July | OPEN — owner action |

**Correction to the record.** `DEF-CR-01` was initially characterised as silent data corruption.
That was wrong. `mc_setlog_v1` was correct throughout and the tick was visible; only the displayed
values were the prescription rather than the performance. The corruption path is real but narrower
— it needs an uncheck/re-check after the reload.


---

# GO LIVE — defects found (MC Training, Phase 1 assessment, 2026-09-15)

Baseline: `main` @ `905286f` (CI green: pages.yml run #357, which runs `verify.yml`).
Severity per the protocol's own scale. Every entry names what was observed, not what was inferred.

---

## DEF-01 — P2 — the two-tab data-loss gate fails intermittently

| | |
|---|---|
| Feature | Set-log durability under concurrent tabs (`tools/test-mc-setlog-concurrency.js`) |
| Scenario | Run the committed gate repeatedly against an unchanged tree |
| Expected | Deterministic pass or a real failure |
| Observed | 1 failure in 4 runs: `race started with 5 sets already in the store — setup is not clean`, `accepted: 0`. Three immediately following runs passed. **The app lost nothing in any run** (control 5/5, race 10/10, writes correctly serialised behind the lock). |
| Root cause | `openTab()` loaded the *workout page* before the store was cleared, so both tabs restored the previous pass's 5 sets into their in-memory sessions. Navigating a tab away persists that session — and that write is serialised behind the cross-tab lock `FIX-01` added, so it has **no ordering relationship** with the harness's `clearStore()` and can land just after it. The app is behaving correctly; the gate's setup assumed its clear was final. |
| Why it matters | This is the gate guarding the app's single highest-severity risk. A gate that goes red at random is a gate that stops being believed, and the next red is the real one. |
| Fix | `tools/test-mc-setlog-concurrency.js` — tabs now open on a neutral document, and the clear repeats until the store actually reads empty (`clearStoreSettled`). |
| Regression test | The gate is its own regression test. Re-run **6 consecutive times: 6 passed, 0 failed**, control 5/5 and race 10/10 every run. |
| Status | **FIXED** |

---

## DEF-02 — P2 — the session calorie ring is insensitive to both work done and effort

| | |
|---|---|
| Feature | Strain ring + estimated calories on the Session Complete recap (`mc-strain.js`) |
| Scenario | Drive `session()` with four realistic sessions and compare against the published MET formula (`GO_LIVE/scenarios/indep-strain-math.js`) |
| Expected | Per the Executive Summary: "based on the weight you actually moved, your logged bodyweight, and session length" |
| Observed | The formula `met = 5.0 + (tonnage/min)/25` is clamped to 9.0, so it **saturates at a tonnage rate of 100 lb/min** — i.e. above 6,000 lb in a 60-minute session. Measured, same 60 minutes, 200 lb athlete: 20 sets (27,000 lb) → **816 kcal**; 40 sets (54,000 lb) → **816 kcal**; 80 sets (108,000 lb) → **816 kcal**. The near-failure RPE bonus (+0.75 MET) measured **delta 0** on all four realistic sessions. Above the boundary the number is bodyweight × duration alone. |
| Root cause | The rate→MET mapping is calibrated below where athletes actually train. The clamp itself is correct — an unclamped MET reached 41.0 on a real session, which would be nonsense. It is the sensitivity *range* that sits under the real input distribution. The repo's own suite already worked around this: its RPE assertion uses a deliberately light tonnage "because that one's rate already saturates the MET clamp", i.e. it tests the bonus only in a regime real sessions never reach. |
| Fix | **Not fixed — deliberately.** Recalibrating a shipped calorie formula changes every historical reading and is a product decision, not a defect with one clear intended behaviour (protocol: "never silently invent product requirements"). Countermeasure applied instead: `tools/test-mc-strain.js` now **pins the saturation boundary and the inert RPE bonus as stated assertions**, so the regime is deliberate and a constant change fails CI rather than quietly going inert. |
| Recommendation | Either normalise tonnage rate by bodyweight (`rate/bw`, dimensionally sounder) so realistic densities span the MET range, or soften the Executive Summary's claim to bodyweight + duration. Owner's call. |
| Status | **OPEN — owner decision, countermeasure landed** |

---

## DEF-03 — P1 — a "personal record" was scoped to the page, not the lift

| | |
|---|---|
| Feature | Automatic PR detection (`mc-finish.js` → `getSessionSets()`), feeding the recap, `mc_workout_log_v1.prs`, the Stats PR timeline and MC Wrapped |
| Scenario | Seed a 300 lb best for an exercise under page id `kitchen-sink` and a 100 lb best for the *same exercise* under `mm-p1`; log 150 lb on `mm-p1`; finish |
| Expected | 150 lb is not a personal record — the athlete has already lifted 300 lb on that exercise, in their own history, in this app |
| Observed | `prs = 1`, set flagged, gold 🏆 awarded. **And in the other direction**: with the prior best living only on another page, genuinely record-setting sets came back **unflagged** (`prs = 0` where 2 were earned) — the pre-fix gate run shows both failures. |
| Root cause | `prevMax` was derived from `store[pageId + '|' + exerciseId]` — one page's history. One exercise catalog feeds ten programs and every program page owns its own set-log key, so each lift carried a separate and invisible history per page. The app already held the correct notion one layer down: `mc-setlog.js`'s signed-in push path asks `MC_SB.getMaxWeight(exName)`, scoped to the **exercise** — so the recap and the push notification disagreed about the same set. Same "two implementations of one number" shape roadmap Phase 4.2 fixed for the estimated 1RM. |
| Fix | `mc-finish.js` — new `prevBestByExercise()` gathers the heaviest weight for an exercise id across **every** page, from sessions dated before today. Both existing rules preserved: a prior session must exist (audit G-03's false-positive guard) and a same-day session is never a "previous best". |
| Regression test | **New CI gate `tools/test-mc-pr-scope.js`** (7 browser-driven cases, wired into `verify.yml`). Proven to **fail on the pre-fix tree** (2 of 7 cases, in both directions) and pass after. The 16-case independent-expectation suite (`GO_LIVE/scenarios/s2-pr-progression.js`) re-run: 16/16. |
| Status | **FIXED** |
| Known narrower case left open | A page listing the same exercise twice keys the second `<exId>-2`; those are still counted as separate lifts. Folding the occurrence suffix in is a second behaviour change and wants its own measurement. |

---

## DEF-04 — P3 — a negative bodyweight prescribed negative macros

| | |
|---|---|
| Feature | Nutrition goal calculator (`mc-macrocalc.js`), reached from the Nutrition tab's ⚙ gear |
| Scenario | `recommend({sex:'male', age:30, heightCm:180, weightLb:-200, activity:'moderate', goal:'cut'})` |
| Expected | Finite, non-negative targets — the invariant this repo already holds every exported calculation to (`tools/test-mc-numeric-guards.js`) |
| Observed | `{bmr:73, tdee:113, kcal:90, p:-220, f:-70, c:400}` — **−220 g protein, −70 g fat** on a 90 kcal target |
| Root cause | Protein and fat are anchored to bodyweight with no floor, and the form is a bare `<input type="number">` with **no `min` attribute**; the only guard (`!profSnapshot.weightLb`) rejects falsy values, and `-200` is truthy. |
| Fix | `mc-macrocalc.js` — a `meas()` reader floors body measurements at 0, and the calorie target and carb remainder can no longer go negative. `mc-macros.js` — `min="0"` added to all four numeric profile fields (weight, age, feet, inches). |
| Regression test | Covered by the new `tools/test-mc-macrocalc.js`, which is the gate that **found it** on its first run. |
| Status | **FIXED** |

---

## DEF-05 — P3 — the nutrition goal calculator had no CI coverage at all

| | |
|---|---|
| Feature | `mc-macrocalc.js` |
| Observed | Every other exported calculation in the app has a suite in `verify.yml` (`test-mc-suggest`, `test-mc-maxout`, `test-mc-strain`, `test-mc-readiness`, `test-mc-log-read` via others). The goal calculator — which produces the calorie and macro targets the athlete eats to — had none. A changed activity multiplier or a flipped sex constant would have shipped silently. |
| Fix | **New CI gate `tools/test-mc-macrocalc.js`** — 230 assertions against the *published* Mifflin-St Jeor and Atwater formulas rather than against the module itself, plus the standard activity factors, goal directions, Atwater closure and boundary handling. Wired into `verify.yml`. |
| Status | **FIXED** (and it immediately found DEF-04) |

---

## DEF-06 — P3 — the fleet-wide render smoke test could not run outside CI

| | |
|---|---|
| Feature | `tools/smoke-test-pages.js` |
| Observed | `browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1243/...` — it was the one browser gate in `tools/` not honouring `MC_CHROMIUM`, so a session's pre-installed Chromium (build 1194) could never satisfy a freshly-installed Playwright. Already recorded in CLAUDE.md as a constraint; it is a one-line fix. |
| Fix | `tools/smoke-test-pages.js` now reads `MC_CHROMIUM` like its siblings. |
| Verification | Ran for real afterwards: **38 sampled pages, zero console errors, no duplicate element ids.** |
| Status | **FIXED** |

---

## DEF-07 — P3 — CLAUDE.md documented two CI gates that have never existed

| | |
|---|---|
| Observed | The Quick Tour section states "**Two CI gates read the tour's prose here**: `tools/check-tour-coverage.js` … and the tour claims in `tools/check-docs.js`". Neither file is in the tree; `git log --all --` on both paths returns nothing, so neither ever was, and no workflow references them. Separately, the canonical gate list omitted three gates `verify.yml` really runs (`check-set-schemes.js`, `test-mc-setlog-plan.js`, `test-mc-streak.js`). |
| Why it matters | The Documentation currency rule is described as CI-enforced. It is not enforced by anything. Anyone trusting that line will let the Quick Tour drift. |
| Fix | `CLAUDE.md` — the false claim is replaced with a correction stating plainly that the rule has no automated enforcement today; the three real gates (and the two added by this assessment) are added to the canonical list. |
| Status | **FIXED (documentation)** |

---

## DEF-08 — P1 — the weekly check-in push has never once worked

| | |
|---|---|
| Feature | "Weekly check-in push — with notifications on, a short recap lands once a week" (Executive Summary §7) |
| Scenario | Read the real run history of `.github/workflows/weekly-checkin.yml` and the `push_subscriptions` table |
| Observed | **10 of 10 scheduled runs have failed**, every Sunday from 2026-07-12 to 2026-09-13 inclusive — run numbers 1 through 10, conclusion `failure` on every one, no successful run in the workflow's entire history. `push_subscriptions` holds **0 rows**. |
| Root cause | The repository secret the workflow guards on was never set (already recorded in `engine-repair-roadmap.md` Phase 1 step 1 at 9 runs; this assessment confirms a 10th and that nothing has changed). |
| Fix | **Not code.** Owner action: set the secret, then confirm a run succeeds and a subscription lands. |
| Status | **OPEN — owner action, blocks the notification claim in §7** |

---

## DEF-09 — P2 — offline behaviour cannot be verified anywhere but the live production origin

| | |
|---|---|
| Feature | Offline-first PWA (`sw.js`) |
| Scenario | Visit a program page online, wait for the SW to cache it, go offline, reload |
| Observed | `net::ERR_INTERNET_DISCONNECTED`. A page never visited also fails. The dashboard *appeared* to open offline, but that is Chromium's HTTP cache, not the service worker. |
| Root cause | `sw.js:374` — `if (!url.startsWith('https://mcross2298.github.io')) return;`. A hardcoded production origin, **generated** by `tools/build-sw.py` from its `BASE` constant and gated by `build-sw.py --check`. Off that origin the fetch handler is inert, so no cache-first, no offline fallback, no revalidation. This is deliberate and documented in `tools/test-mc-sw.js`'s own header. |
| What IS verified | The SW registers and activates and **precaches 131 entries** (measured). The fetch-strategy logic is covered in isolation by `test-mc-sw.js`, `test-mc-sw-update.js` and `test-mc-offline-prefetch.js` (all pass). A set logged with the network down **persists to `localStorage`** (measured). |
| What is NOT verified | A real offline reload of a program page, offline cold launch, the update banner against a real new SW, and reconnect/sync — none of it, in either direction, from anywhere but the deployed origin. |
| Fix | **Not fixed — recommended.** Deriving the gate from `self.location.origin` keeps production behaviour byte-identical (same-origin requests still match), makes offline verifiable on localhost and on any future custom domain, and removes a silent failure mode if the app ever moves off `github.io`. It touches generated code with a CI gate, so it wants the owner's sign-off. |
| Status | **OPEN — recommendation; offline is an unverified axis of this assessment** |

---

## DEF-10 — P2 — the committed evidence tripped three fleet-wide gates the moment it was tracked

| | |
|---|---|
| Scenario | Commit `GO_LIVE/scenarios/*.js` and let CI run |
| Observed | Three gates that had passed locally went red, because all three sweep **tracked** `.js` files and the scenario scripts were untracked when the local sweep ran: `test-mc-maxout` (*"a second Epley estimate exists outside mc-log-read.js"*), `check-dangling-refs` (*"2 global(s) read but assigned nowhere"*), `check-store-coverage` (*"`mc_setlog_probe_v1` used in code but not declared"*). |
| Root cause and fix, one at a time | |
| **1. Second Epley implementation** | `test-mc-maxout.js` sweeps every tracked file for a second 1RM estimator — roadmap Phase 4.2 collapsed two disagreeing ones (a cable pushdown read 71 on one screen and 100 on another). It exempts `mc-log-read.js` and `tools/`: app code gets one implementation, test code may restate it. The validator sat outside both. **Not fixed by excluding it** — the expectations became a **frozen golden table** derived once from the published Epley equation, which satisfies the gate *and* is the better test, since a restated formula can silently track a source edit while a frozen number cannot. 141 → **169 assertions**. |
| **2. Two globals read but assigned nowhere** | The gate caught the assessment making exactly the mistake it exists to catch. `window.MC_QUICK_PUMP` and `window.MC_MAXOUT` **do not exist**: Quick Pump publishes `window.MCQuickPump`, and `mc-maxout.js` publishes no global at all. That guess is why S4 originally reported *"Quick Pump is not published"* — a wrong probe, not a missing feature. Pointed at the real global on its real page (`quick-pump.html`, not the dashboard), **Quick Pump is now genuinely exercised for the first time**: 5 exercises for 30 min, 9 for 45 min, 5 for a Chest focus, every one named and prescribed. |
| **3. An undeclared `mc_*` key** | The s4b probe wrote `mc_setlog_probe_v1`. `store-registry.json` governs that namespace, and a throwaway test key has no business in it — renamed to `__golive_write_probe`. |
| Status | **FIXED** — all three gates green; `check-dangling-refs` now resolves 497 ids and 161 globals across 315 files |

### A claim of mine that this round corrected

`S4.3` originally tried to reach a workout page *by navigating while offline*, which cannot succeed on this origin (DEF-09) — so the navigation failed and **the offline set-logging assertion never ran**, even though the first draft of this report stated it had. Rewritten to the realistic case: load the page online, drop the network, then log. Now genuinely measured — **1 → 2 sets persisted with the network down, and the rest timer keeps running**. S4 went 23/26 with 3 unexplained to **33/33**.

---
---

# PHASE 2 — the full-scale sweep (2026-09-15)

Phase 1 tested the engine hard and sampled the rest. Phase 2 was asked to surface
"anything and everything", so it drove the surface Phase 1 named as unverified.

**Coverage moved:** pages rendered 38 → **142 (all of them)**; workout pages driven
through a complete session 9 → **71 of 79** (the other 8 are pickers/landing/history
that render no session by design); set types verified by driving rather than by data
gate; the ⋮ menu, cluster flow, supersets, Build Your Own, Quick Pump, replacement,
nutrition and conditioning all exercised for the first time; and the live RLS attacks
finally run.

---

## DEF-11 — P3 — an all-AMRAP working row asked for "reps", not "AMRAP"

| | |
|---|---|
| Feature | The Log Sets rep box on an open-ended set |
| Scenario | Drive every card on 10 pages spanning all six intensifiers and compare each row's rep placeholder against the authored prescription |
| Expected | Per the Executive Summary: "The Log Sets table still spells it out as **AMRAP** in the Reps box, so you know to type in exactly how many reps you got" |
| Observed | Where AMRAP is one leg of a mixed scheme (`12·10·8·8→∞·∞`) the open rows are labelled correctly — **64 cards**. Where the prescription is open-ended all the way through (`3×AMRAP`, `AMRAP × 3`, `×failure`, bare `AMRAP`) the rows read the generic **"reps"** — **11 cards across 8 pages**. |
| Root cause | `mc-setlog.js:1427` — `rPh` took the literal `'AMRAP'` only on the **drop** branch. A working row used `repFor()`, which correctly returns nothing for an open rep token (making it return a number is the exact `4×AMRAP → 4 reps` bug the `isOpenRep` work removed), then fell through to `'reps'`. |
| Why it matters more than it looks | The Weekly Layout Standard makes a **bodyweight AMRAP finisher mandatory at Pos 10 of every training day**, so the all-open shape is the app's most common AMRAP — and it was the one place the cue went missing. |
| Fix | One line: an open-ended working row now shows `AMRAP` too. Display only **by construction** — `onCheck()` reads `clusterRVal(row)`, whose single-box branch returns `mini[0].value`, and tap-to-fill reads `data-fill` (`rFill`), a different variable. Nothing reads a single row's placeholder. |
| Proof | Re-ran the same 10-page drive: findings 11 → **0**, passes 73 → **84**, and the driven row/stored-set counts are **identical** page by page (13/11/13/15/12/16/14/11/15/13) — the fix moved no data. Then `test-mc-setlog-plan`, `test-mc-cluster-reps`, `check-set-schemes`, `check-journey` (9/9), `test-mc-exercise-identity`, `test-mc-setlog-concurrency`, `test-mc-store-resilience`, `test-mc-crash-recovery`, `test-mc-pr-scope` and `smoke-test-pages` all pass. |
| Status | **FIXED** |

---

## DEF-12 — P2 — the 🧩 cluster breakdown does nothing until the page is reloaded

| | |
|---|---|
| Feature | Cluster sets — the one intensifier with its own emoji, its own tour slide and a dedicated mid-session promise |
| Scenario | On `mm-p1.html`, ⋮ → 🧩 Cluster → type `5+5+5` into "Reps per cluster" → Save → open the card's logger |
| Expected | Both the Executive Summary and `quick-tour-data.js` say: "Tap the 🧩 Cluster badge or note on the card itself to adjust the whole breakdown **mid-session**" — so the working sets should become rep bubbles |
| Observed | Mid-session: `data-mc-cluster="5+5+5"` **is** stamped on the card and `mc_personal_intensifiers` **is** written correctly — but the rows are unchanged, **0 multi-rep rows**, no bubbles, no `🧩 Cluster` row label. After a **reload** of the same page: **5 bubble rows, seeded `["5","5","5"]`, label `🧩 Cluster`** — the feature works perfectly. |
| Root cause | Two correct halves with nothing joining them. `program-overrides.js:350` stamps the attribute; `mc-setlog.js:1369` reads `card.dataset.mcCluster` **only inside `buildRows()`**, and `buildRows()` opens with `if (host.querySelector('.mcl-wrap')) return;` — the rows for that card are already built, so nothing re-reads the attribute. |
| Athlete-visible effect | Mid-workout, the athlete taps 🧩, types a breakdown, saves, and the card looks identical. The reasonable conclusion is that it did not work. The setting is not lost — it applies from the next load. |
| **Not fixed — deliberately** | A correct fix is a rebuild-and-repaint path: drop the card's `.mcl-wrap`, rebuild, then re-mark the sets already logged. The repaint half lives in **`mc-session.js`'s `restoreSets()`**, which is module-private and not exported, and `buildRows()` itself only restores *typed-but-unchecked* values (`getPending`), not checked ones. So the fix needs new plumbing across the two modules that own set persistence — the highest-severity code in this app, which the card-integration roadmap deliberately changes one serialized PR at a time. A wrong version of this fix loses a logged set mid-workout, which is strictly worse than the bug. |
| Recommended shape | Export a `rebuildRows(card)` from `mc-setlog.js` that removes the wrap, rebuilds, re-applies the stored sets for that `exId` (mc-setlog already owns `mc_setlog_v1`), restores the open/collapsed state, and calls `updateCountByCard`; then call it from `applyIntensifier()` when the cluster value actually changes. Verify with a logged set present before the change, not just an empty card. |
| Owner decision (2026-09-16) | **Fix the promise, not the persistence path — for now.** Presented as two options; the owner chose the copy fix. The damage today is a broken promise, not broken data: the setting *is* saved, it just doesn't repaint until the next load, so an athlete who taps 🧩 and sees no change reasonably concludes it failed. Both places that promised the mid-session case now describe the real behaviour — `quick-tour-data.js`'s cluster slide (which `quick-tour.html` and `quick-tour-full.html` both render, so there is one copy, not three) and `quick-tour-overview.html`'s Cluster sets bullet. The rebuild-and-repaint work above is **not cancelled** — it stays the real fix, unblocked for whenever the set logger is next opened deliberately. |
| Status | **OPEN (code) / CLOSED (claim)** — the app no longer advertises behaviour it doesn't have. The repaint gap itself is unchanged and still wants the `rebuildRows(card)` shape above. |

---

## DEF-13 — P2 — the three Nutrition entry controls are 38px, and no budget covered them

| | |
|---|---|
| Feature | The Nutrition tab header: ◎ jump to today, ★ the favorites library, ⚙ the goal calculator |
| Observed | All three are `.ntx-ico`, **38×38 px at both 390 and 320** (`mc-macros.js`: `width:38px;height:38px`). They are the **only** way into the favorites library and into the calculator that sets every macro target. `chrome-budgets.json` covered `.mc-nav-tab`, `.back-link`, `.topbar-icon`, `.dot-nav` and `.back` — not these. They do carry proper `aria-label`s ("Jump to today", "Favorite foods", "Goals"), so they are reachable by name; they are just 6px under the touch floor. |
| Fix | Added `.ntx-ico` to `check-journey.js`'s fleet-wide chrome pass, plus `dashboard.html?tab=nutrition` as a measured page (the tab renders on demand, so the control does not exist otherwise). **Ratcheted, not hard-failed** — the same reasoning `W-I1` recorded for the other four: they are already under the floor and their resize is a separate design-reviewed change (`W-I2`), so asserting `>=44` would be red from birth. |
| Why this budget CAN be seeded from a session | `.ntx-ico`'s size is a fixed `width:38px;height:38px`, not text metrics — so unlike the contrast and visual ratchets it carries none of the Google-Fonts caveat. Seeded **by hand** at the measured 38×38 rather than with `--update`. |
| Proof | The pass now measures **12 control/viewport pairs** (was 10) and names the nutrition icons among those under the floor. Proven to fail on a real shrink: with the budget temporarily claiming 44×44, `check-journey` reports *"nutrition header icon @ 390 measured 38x38px, smaller than the recorded 44x44px — a real regression, not drift"*. |
| Status | **FIXED (gated); the resize itself belongs with `W-I2`** |

---

## DEF-14 — P2 — the rest-day subtitle was effectively invisible in dark mode on 9 pages

| | |
|---|---|
| Feature | The rest / active-rest day card's descriptive line ("Full Recovery & Growth", "Active Recovery") |
| Scenario | Force the app's own dark theme (`mc_theme_mode: dark`) and measure every leaf text node against what is actually painted behind it |
| Observed | `.rest-sub{color:#1e293b}` — Tailwind **slate-800 on a true-black ground: 1.44:1**, on **9 pages** (`arnold-legacy`, `bro-split`, `hv-block`, `legacy-prep`, `mm-p1`, `mm-p2`, `mm-p3`, `push-pull-legs`, `weeks-to-open`). This is precisely the hardcoded-slate pattern `W-I3` recorded and `P3`'s by-name sweep did not reach. |
| Fix | `#1e293b` → `var(--muted, #94a3b8)` inside the `.rest-sub` rule on all 9 pages. `--muted` is the app's own secondary-text token at **5.59:1** (raised there by `P3`); the literal fallback is kept because an undefined `var()` invalidates the whole declaration — the trap `P2` hit on the four landings that do not link `base.css`. All 9 of these do link it; the fallback costs nothing. `45-minute-burner.html` already used `#94a3b8` for the same class, so this follows the tree's own precedent. |
| Proof | Dark-mode invisible-text findings across 26 representative pages: **3 → 0**. Light mode unchanged and still within budget (141 pages, 273 findings, none over). `check-design-tokens` and the head contract both pass. |
| Status | **FIXED** |

### What this pass did NOT confirm, and should be said plainly

The first version of the dark probe reported **13** findings. Adding gradient
awareness — an element sitting on a `background-image` is *unreadable by this
method*, not invisible — removed **10 of them as false positives from my own
probe**: `.avatar`, `.hero-empty-btn`, `.create-btn`, `.mk-btn`, `.day-icon` and,
notably, the two controls `W-I3` named at 1.00:1, `.coach-icon` (🤖) and
`.lift-name`. Those two are gradient-backed, so this pass **can neither confirm
nor refute** W-I3's reading of them; it can only say a gradient-aware probe does
not reproduce it. The 3 that survived are one real defect, fixed above.

---

## DEF-15 — P2 — a cluster edit on `run-workout.html` un-checks a set the athlete already logged

| | |
|---|---|
| Feature | 🧩 Cluster edit on the custom-workout runner (`run-workout.html`'s own `openClusterEdit()` / `clusterBadge()`, a separate implementation from the program pages' `program-overrides.js` path) |
| Found | While executing DEF-12's copy fix (2026-09-16) — two code comments still promised the mid-session case, and checking whether `run-workout.html` shared DEF-12's bug meant driving it |
| Scenario | Seed a custom workout with a `5+5+5` cluster → open Log Sets → fill and **check one set** → tap the 🧩 badge → change the last mini-set to `3` → Done. `GO_LIVE/scenarios/phase3/def15-run-workout-cluster.js` |
| Expected | The split updates and the set already logged stays logged |
| Observed | The split **does** update — `data-mc-cluster` goes `5+5+5` → `5+5+3` live, so this page does **not** have DEF-12's symptom. But the rebuilt rows come back **unchecked**: DOM checked rows `1` → **0**, badge `1/3` → **`0/3 Sets`**. The set is **still in `mc_setlog_v1`** (verified: store count `1` → `1`), so **no data is lost** — the screen just stops showing it until the next load. |
| Root cause | Each cluster handler calls `saveWorkoutClusterEdit(wk)` then `render()`. `saveWorkoutClusterEdit()` only writes localStorage (its comment claimed it also re-stamped the card and dropped the Log Sets panel — it never did; the repaint comes from `render()`). The full re-render rebuilds the rows, and **nothing re-runs `mc-session.js`'s `restoreSets()`** afterwards, so checked state is not re-applied. Same shape as the pre-existing reload bug `F3-1` fixed on the day pages — cards rebuilt after `restoreSets()` has already run. |
| Athlete-visible effect | Mid-workout, adjusting a cluster appears to **wipe the set you just did**. Worse than DEF-12's "looks like nothing happened", because this looks like something was destroyed. It wasn't — a reload brings it back. |
| Relationship to DEF-12 | **Same underlying gap, opposite symptom.** DEF-12: the value never reaches the rows. DEF-15: the value reaches the rows but the logged state doesn't survive the rebuild. Both need the one thing DEF-12 names — a rebuild path that re-applies stored sets. `restoreSets()` being module-private is the blocker in both. |
| **Not fixed — deliberately, same reasoning as DEF-12** | The fix is DEF-12's `rebuildRows(card)` shape, which re-applies the stored sets for that `exId` after rebuilding. Doing it here first would mean writing that plumbing anyway, on the persistence path, which the card-integration roadmap changes one serialized PR at a time. Countermeasures applied instead: the misleading comment above `saveWorkoutClusterEdit()` now describes what the function really does and names this defect, and the scenario is committed so the regression is re-runnable. |
| Why no gate caught it | `check-journey.js` drives sessions but never edits an intensifier; `run-workout.html` needs a seeded custom workout before it renders a card at all (which is why `S4b` had to drive it specially), so it is outside every default probe list. |
| Status | **OPEN — reported with a committed reproduction; fold into DEF-12's fix, not a separate change** |

---

## Verified clean — things Phase 1 could not vouch for

| Area | Result |
|---|---|
| **Every page renders** | **142/142** at 390px: no uncaught throw, no non-resource console error, **no duplicate element id**, no sideways overflow |
| **Every workout page completes a session** | **71/79** drove log → persist → reload → survive → finish → bank with **zero failures**. The 8 remaining render no session at all and each is a picker, landing or history page (`cat-gainz`, `cat-pmc`, `cat-strength`, `mc-cardio`, `pmc-workout`, `run-program`, `run-workout`, `workout-logs`) |
| **PSU Football** | Driven for the first time — 3 cards, 15 rows, 15 sets stored, clean |
| **Set types** | 84 assertions across 10 pages: 64 AMRAP rows correctly labelled, 12 drop rows, tempo, and **no `NaN`/`undefined`/`Infinity` in any stored value on any page** |
| **The ⋮ menu** | Opens with all 9 actions (`trends, replace, reorder, tempo, notes, int-drop, int-cluster, int-ss, cancel`), **every one 46–49px — above the floor** |
| **Notes** | Persist to `mc_ex_notes`, survive a reload, and the ⋮ **does** get its gold marker (`mc-has-note` + `.mc-dot-ind`) — an earlier note that it was missing was my selector, not the app |
| **Supersets** | Both legs of a real pair driven on `iron-engine.html`; each leg stores under its **own** history key |
| **Replace exercise** | A saved replacement repaints in place via `MC_REPLACE.apply()` **and** after a reload |
| **Quick Pump end to end** | `generate()` → `saveAndStart()` → lands on `run-workout.html?id=cw-…` with **5 cards and a working logger** |
| **Custom workouts** | `run-workout.html` renders and logs a seeded custom workout — so two of the 8 "no session" pages are correct-by-design, not broken |
| **Conditioning** | 9 routines render on the tab; a real conditioning page opens with its run controls above 44px |
| **Nutrition store** | Goals, a favorite and a logged food all survive a reload; 17 ring elements render |
| **Signed-out degradation** | The Coach Note card shows a sensible empty state ("Log some workouts and check back for personalized insights.") and **throws nothing**. Note: the Executive Summary calls it "Signed-in only" while it in fact renders for everyone with that empty state — a documentation nit, not a defect |
| **Live row-level security** | **12 attacks, all blocked** — see below |

## Live RLS — the gap Phase 1 could not close, now closed

`tests/test_rls.py` still needs `SUPABASE_DB_URL`, so the attacks were run
directly against the project read-only, simulating each actor with
`set local role` + `request.jwt.claims` inside a `read only` (reads) or
rolled-back (writes) transaction. Verified afterwards that the database was
untouched: 120 workout logs, 36 sync rows, 67 override rows, 0 probe rows.

| Actor | Result |
|---|---|
| Authenticated attacker, valid token, different uid | **0 rows** from `user_sync`, `workout_logs`, `daily_health`, `push_subscriptions`, `user_programs`, `admins`, `testers`, `pm_clients`, `pm_drafts`, `naming_overrides_canary` |
| Anonymous visitor | **0 rows** from every private table. World-readable by design: `program_overrides` (67), `naming_overrides` (4), `foods` (294), `published_programs` (0), `published_exercises` (0) |
| Update every `workout_logs` row | **0 rows updated** |
| Update every `user_sync` row | **0 rows updated** |
| Delete all `workout_logs` / all `user_sync` | **0 rows deleted** |
| Insert a row owned by the real user | **blocked** — new row violates RLS |
| Self-grant `admins` | **blocked** |
| Self-grant `testers` | **blocked** |
| Non-admin write to `program_overrides` | **blocked** |

All **16** public tables have RLS enabled; the advisor reports **no missing-policy
findings** (one WARN only: leaked-password protection disabled).

**One structural note worth keeping:** every admin check is
`auth.uid() IN (SELECT user_id FROM admins)`, and that subquery is itself
subject to RLS on `admins`, which has only a self-read policy. It resolves
correctly today and cannot fail *open* (disabling that policy would return all
admin ids, and the `IN` still only matches real admins) — but it does mean the
whole PM authorisation surface depends on `admins.admin_self_read` continuing to
exist. Removing it would break PM mode silently, in the safe direction.

**Also corrected:** `list_tables` reported `foods` as 0 rows — that is Postgres'
row estimate, not a count. It holds **294** rows, world-readable by design.
