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
