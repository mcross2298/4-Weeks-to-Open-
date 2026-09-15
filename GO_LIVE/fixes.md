# GO LIVE — fixes applied

Every fix below was reproduced first, root-caused, fixed, then re-run against the original scenario
**and** the adjacent suites. Nothing here was fixed by reading alone.

| # | File(s) | Change | Proof |
|---|---|---|---|
| 1 | `mc-finish.js` | `prevBestByExercise()` — a previous best is the heaviest set of that **exercise** across every page, from sessions dated before today. Replaces the per-page lookup. (DEF-03) | New gate fails pre-fix on 2 of 7 cases, passes after; the 16-case independent suite stays 16/16 |
| 2 | `tools/test-mc-pr-scope.js` *(new)* | 7-case browser gate pinning PR scope, both directions. Wired into `verify.yml` beside `test-mc-exercise-identity.js` | Proven to fail on the pre-fix tree before being trusted |
| 3 | `mc-macrocalc.js` | `meas()` floors body measurements at 0; the calorie target and carb remainder can no longer go negative (DEF-04) | `test-mc-macrocalc.js` 230/230 (it is the gate that found the bug) |
| 4 | `mc-macros.js` | `min="0"` on all four numeric profile fields | Browser refuses the input at source |
| 5 | `tools/test-mc-macrocalc.js` *(new)* | 230 assertions against published Mifflin-St Jeor / Atwater, plus boundary handling. Wired into `verify.yml` (DEF-05) | Found DEF-04 on its first run |
| 6 | `tools/test-mc-setlog-concurrency.js` | Tabs open on a neutral document; the clear repeats until the store actually reads empty (DEF-01) | **6 consecutive runs, 6 passed** — control 5/5, race 10/10 every run |
| 7 | `tools/smoke-test-pages.js` | Honours `MC_CHROMIUM` like every sibling gate (DEF-06) | Ran for real: **38 pages, zero console errors, no duplicate ids** |
| 8 | `tools/test-mc-strain.js` | Pins the MET saturation boundary (100 lb/min) and the inert near-failure bonus as stated assertions (DEF-02 countermeasure) | Suite passes; a constant change now fails CI instead of going silently inert |
| 9 | `GO_LIVE/scenarios/indep-1rm-math.js` | Expectations become a frozen golden table rather than a restated Epley formula, so the single-estimator gate holds (DEF-10) | `test-mc-maxout` fails on the old file, passes on the new; validator 141 → **169** assertions |
| 10 | `GO_LIVE/scenarios/s4-*.js` | Probe the real globals (`MCQuickPump` on `quick-pump.html`; `mc-maxout.js` publishes none), move the throwaway key out of the `mc_*` namespace, and test offline logging on an already-open page (DEF-10) | `check-dangling-refs` and `check-store-coverage` green; **Quick Pump genuinely exercised**; S4 23/26 → **33/33** |
| 11 | `CLAUDE.md` | Corrects the claim that two CI gates read the Quick Tour's prose (neither file has ever existed); adds the five gates missing from the canonical list (DEF-07) | `git log --all` on both paths returns nothing; `build-market.py --check` still passes |

## Regression sweep after the changes

| Suite | Result |
|---|---|
| 46 static gates from the canonical list | **46 pass** (the only 2 "failures" are the two tools DEF-07 proves never existed) |
| `check-set-schemes`, `test-mc-setlog-plan`, `test-mc-streak`, `test-mc-macrocalc` | **4 pass** |
| JS syntax, all 163 tracked files | **0 failures** |
| `check-journey` | **9/9 journeys, 3/3 subsystems, 9-page real-inset pass** |
| `test-mc-crash-recovery` · `test-mc-store-resilience` · `test-mc-exercise-identity` | **pass** |
| `smoke-test-pages` | **38/38, zero console errors** |
| `test-mc-setlog-concurrency` | **6/6 consecutive** |
| `test-mc-pr-scope` | **7/7** |
| S1 logger campaign (re-run post-fix) | **20/20** |
| S2 PR campaign (re-run post-fix) | **16/16** |
| `verify.yml` YAML validity | parses clean |
