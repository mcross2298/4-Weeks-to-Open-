# GO LIVE multi-app run — 2026-09-17

**Interactive report: [`go_live_report.html`](go_live_report.html)** — start there. This file is the
markdown record the protocol requires; the HTML report carries the same evidence with the
33 individual agent reports (11 agents x 3 phases) expandable.

**Protocol:** `claude_code_go_live_protocol.md` §0 + §1 + §2 + §3, executed phase by phase.
**Scope:** MC Training (this repo), Cross' Finances (`Cross-Household-`), Mike's Cookbook (`Mikes-Cookbook`).

## Executive verdict

```text
CONDITIONAL GO — 2 of 3 applications clear; 3 named conditions
```

| Application | Verdict | P0 | P1 | Condition |
|---|---|---|---|---|
| MC Training | CONDITIONAL GO | 0 | 3 found, 2 fixed | `DEF-08` — the weekly check-in has never worked. Not code. |
| Cross' Finances | **GO** | 0 | 1 found, fixed | None. The portable half should be ported to `household-finance`. |
| Mike's Cookbook | CONDITIONAL GO | 0 | 0 | 18 recipe records contradict themselves. Data, not code. |

**4,185 assertions and measurements executed.** As-found DPMO 1,672.6 (~4.4 sigma);
as-shipped 716.8, and every remaining defect is one an agent may not close.

## Phase 1 — MC Training (clean-room re-execution)

- 142/142 pages render with zero thrown exceptions, console errors, duplicate ids or overflow at 390px.
- **71/71 complete workout sessions driven** — log, persist, reload, survive, finish, bank — 0 failures.
  The other 8 logger-bearing pages render no session by design.
- 46/46 independent formula assertions (Epley, MET x kg x h, Mifflin-St Jeor, Atwater), each written
  longhand from the published formula rather than imported from the app.
- 109 scenario assertions across chaos, PWA/mobile, accessibility, security, set types/PR,
  tools/nutrition and performance.
- 51 committed non-browser gates plus 6 browser gates re-run green after every fix.
- **Defects:** `DEF-CR-01` (P1, fixed), `DEF-CR-02` (P1, fixed), `DEF-CR-03` (P3, fixed),
  `DEF-08` (P1, OPEN — owner action).

## Phase 2 — Cross' Finances

All scenarios use synthetic data only. This repository's `seed()` and reference workbook hold real
figures for two named people; the store is replaced with an invented month before anything is
measured, and the first assertion checks the replacement actually happened.

- 67/67 scenario assertions; 333/333 money-math tests (the repo's own CI suite).
- **Zero reconciliation discrepancies** across Transactions -> Accounts -> Budget -> Safe to Spend ->
  Savings Goals -> Debt -> Net Worth -> Monthly Report, against an independently built ledger.
- Transfers and card payments move neither spend nor Safe to Spend, and never enter
  `data.transactions` — the structural double-count defence holds.
- Debt payoff matches a longhand amortisation exactly, monotonic in both rate and payment.
- **Defect:** `DEF-FIN-01` (P1, fixed).

## Phase 3 — Mike's Cookbook

- All 318 recipes swept, not sampled. 33/33 kitchen campaign assertions; 25 CI gates plus `check-a11y`.
- Search, grocery merging, the timer attack and the cross-app bridge all pass.
- **Defects:** `DEF-CB-01` (8 nutrition records) and `DEF-CB-02` (10 scaling records), both
  REPORTED not fixed — the correct values are an authoring decision. Both are now gated with named
  allowlists so no unnamed instance can appear.

## Unverified axes — named, not skipped

| Axis | Why |
|---|---|
| Offline *reload* (MC Training) | `sw.js`'s fetch handler is gated to the production origin. |
| Live cross-user RLS | Needs a direct Postgres URL this session does not hold. |
| `smoke-test.js` (Cookbook) | Waits for `networkidle`, which never settles behind this sandbox's egress proxy. |
| Real-device QA; multi-device sync | Not reachable from any agent session. |

## Final Auditor

The certification is confirmed, with one correction to the Release Director's original framing:
`DEF-CR-01` was first characterised as silent data corruption. It is not — the store was correct
throughout, and the corruption path requires a post-reload edit. The corrected characterisation is
what stands, and it is recorded in `bugs.md` and in the HTML report rather than quietly amended.


---

# GO LIVE — release report: MC Training

**Assessment date:** 2026-09-15 · **Baseline:** `main` @ `905286f` (CI green, `pages.yml` #357)
**Protocol:** §0 Global Directive + §1 MC Training. §2 and §3 were not read and are out of scope.
**Specification:** the Executive Summary (`quick-tour-overview.html`).

---

## Executive verdict

```text
CONDITIONAL GO — full GO LIVE withheld on two named conditions
```

> **Updated 2026-09-15 after Phase 2, the full-scale sweep.** Phase 1's verdict rested on a sampled
> engine test; Phase 2 drove the surface Phase 1 had named as unverified. Coverage moved from 38 to
> **all 142** pages rendered, from 9 to **71 of 79** workout pages completing a full session, and the
> live RLS attacks — one of Phase 1's three conditions — **now run and all pass**, so that condition
> is closed. Four more defects were found; two are fixed, one is gated, one is reported with a
> reproduction. Detail in `bugs.md` (`DEF-11`–`DEF-14`).

**P0 defects: 0.** **P1 defects: 1 open, and it is not code.**

The engine this product sells — log the set, rest on the clock, beat last time, bank the PR — is
sound, and it is now more correct than it was this morning. Every critical calculation was validated
against its published formula rather than against itself; the workout logger survived reload, cold
reopen, duplicate taps, hostile input, interruption and a full device without losing a set; and the
one materially wrong number found (PR detection) is fixed, with a gate that fails on the old code.

Full certification is withheld because three things are **unverified rather than passing**, and a
release protocol whose whole instruction is "certify based on evidence" cannot count an untested axis
as a pass:

1. **The weekly check-in has never worked.** 10 of 10 scheduled runs failed, 2026-07-12 through
   2026-09-13; `push_subscriptions` holds 0 rows. §7 of the specification promises it. Owner action:
   set the secret and prove one run, or remove the claim. *(DEF-08, P1)*
2. **Real offline behaviour cannot be observed off the production origin.** `sw.js`'s fetch handler
   is gated to `https://mcross2298.github.io`, so on localhost it is inert. One real offline reload
   on the deployed site closes this in minutes. *(DEF-09, P2)*
3. ~~**Live row-level security was not re-run.**~~ **CLOSED by Phase 2** — 12 cross-user attacks
   executed directly against the project (read, update, delete, forge a row owned by another user,
   self-grant admin, self-grant tester, non-admin override write), every one blocked, database
   verified untouched afterwards.

One further item is the owner's call rather than a defect: the session calorie ring is insensitive to
tonnage and to effort for essentially every real session *(DEF-02, P2)*.

---

## Coverage

| | |
|---|---|
| Features discovered | ~120 declared capabilities across the Executive Summary's 8 sections; protocol §1 names 61 product areas |
| Inventory | 142 HTML pages · 163 JS modules · 14 stylesheets · 78 tools · 16 Supabase tables (all RLS-enabled) |
| Committed gates executed | **60** — 58 passed, 1 informational-only, 1 not runnable here (green in CI on this commit) |
| Pages rendered in a real browser | **142 of 142** — zero uncaught throws, zero non-resource console errors, zero duplicate element ids, zero sideways overflow at 390px *(Phase 2)* |
| Workout pages driven through a complete session | **71 of 79** — log → persist → reload → survive → finish → bank, **zero failures**; the other 8 render no session by design *(Phase 2)* |
| Live cross-user attacks | **12, all blocked** *(Phase 2)* |
| JS parsed | **163 / 163** tracked files, zero syntax failures |
| Scenario sets driven | **8** (5 browser campaigns + 3 independent-formula validators), all committed and re-runnable |
| Scenario assertions | **96** driven in a real browser (87 pass; 6 unreachable-input hardening, 3 harness artifacts resolved) |
| Independent-formula assertions | **274** — Epley, `MET × kg × h`, Mifflin-St Jeor, Atwater |
| New permanent assertions added to CI | **237** across 2 new gates |
| Viewports | 390×844 and 320 (via the journey gate's chrome pass), plus a replayed 59 px safe-area inset |
| Pages rendered in a real browser | 38 sampled (zero console errors, no duplicate ids) + 141 measured for contrast + 9 driven through a complete workout |
| Offline / PWA scenarios | manifest, install meta, SW registration, 131-entry precache, offline set-log persistence, storage exhaustion. **Real offline reload: blocked — see DEF-09** |
| Cross-feature journeys | logger → session → finish → bank → history → resume; cookbook bridge and sync-merge via committed suites |

---

## Defects

Full detail with root cause and proof in `GO_LIVE/bugs.md`. Summary:

| ID | Sev | Feature | Status |
|---|---|---|---|
| DEF-03 | **P1** | PR detection scoped to the page, not the lift — awarded false PRs *and* suppressed real ones | **FIXED** + new CI gate proven to fail pre-fix |
| DEF-08 | **P1** | Weekly check-in push: 10/10 scheduled runs failed, 0 subscriptions | **OPEN — owner action** |
| DEF-01 | P2 | The two-tab data-loss gate failed ~1 run in 4 (harness, not app) | **FIXED** — 6/6 consecutive |
| DEF-02 | P2 | Session calories insensitive to tonnage and effort above 100 lb/min | **OPEN — owner decision**; boundary now pinned in CI |
| DEF-09 | P2 | Offline unverifiable off the production origin | **OPEN — recommendation** |
| DEF-04 | P3 | A negative bodyweight prescribed −220 g protein | **FIXED** (clamp + form `min`) |
| DEF-05 | P3 | The nutrition goal calculator had no CI coverage at all | **FIXED** — new 230-assertion gate |
| DEF-06 | P3 | The fleet-wide render smoke test could not run outside CI | **FIXED** — now honours `MC_CHROMIUM` |
| DEF-07 | P3 | CLAUDE.md documented two CI gates that have never existed | **FIXED** (documentation) |
| DEF-11 | P3 | An all-AMRAP working row asked for "reps" — on the mandatory Pos-10 finisher | **FIXED** |
| DEF-12 | P2 | The 🧩 cluster breakdown does nothing until the page is reloaded | **OPEN (code) / CLOSED (claim)** — owner chose the copy fix; the app no longer advertises it |
| DEF-15 | P2 | A cluster edit on `run-workout.html` un-checks a set already logged (store intact) | **OPEN — folds into DEF-12's fix** |
| DEF-13 | P2 | The three Nutrition entry controls are 38px, covered by no budget | **FIXED (gated)** |
| DEF-14 | P2 | The rest-day subtitle was 1.44:1 in dark mode on 9 pages | **FIXED** |

**Across all three passes: 8 defects fixed, 4 gates added or repaired, 5 items left open with each one
named.** Phase 2 also closed the live-RLS gap.

---

## Validation

| Axis | Result |
|---|---|
| **Data integrity** | No set was lost in any scenario. Two-tab race: 10 accepted, 10 persisted, 6 runs consecutively. Crash recovery and corrupt-store resilience both pass. Hostile input never wrote `NaN`/`Infinity`/`undefined` into any store. |
| **Calculation accuracy** | 1RM: 141/141 vs published Epley, including the rep cap, the ×0.85 leverage coefficient and the cluster top-set rule. Nutrition: 230/230 vs Mifflin-St Jeor and Atwater, split closing on its own target. Strain: tonnage is an exact independent sum; kcal matches `MET × kg × h` exactly — and the measurement is what exposed DEF-02. |
| **Persistence** | Survives reload, cold reopen in a new tab, leaving mid-session and returning, and a full device. Badge recomputes to `5/5` after reload, not `0/5`. |
| **Offline behaviour** | Partially verified — see DEF-09. A set logged with the network down persists locally; the real reload path is unobservable here. |
| **PWA** | Manifest installable with 192 and 512 icons, `viewport-fit=cover`, iOS standalone meta, theme-color, SW activated, 131 entries precached. |
| **Mobile UX** | 9/9 complete-workout journeys clean; no control unreachable at any scroll position; nothing overflows sideways; session-shell controls clear 44×44; real 59 px inset pass on 9 pages. |
| **Accessibility** | The rest chip is a native `<button>` with a full accessible name and starts on Enter; the set control declares `role="checkbox"`, carries a name, measures exactly 44×44 and flips `aria-checked` on Space; reduced motion is honoured with real `@media` rules. 273 light-mode contrast findings remain within budget; dark mode is measured but **ungated**. |
| **Security** | All 16 public tables RLS-enabled. Advisor: no missing-policy findings; one WARN (leaked-password protection disabled). The live 7-attack suite did not run — named as a gap. |
| **Performance** | S1's −99.5% runtime win holds via `perf-budgets.json`; the journey gate reports at-rest chrome at 6.8–13.6% across 9 pages. |
| **Integrations** | Cookbook bridge, sync merge and consume-store handling pass their committed suites; the Nutrition tab's planned-meals card renders its signed-out state correctly. |
| **Regression** | Every suite re-run after every fix. Nothing regressed. |

---

## Final Auditor

*Challenging the recommendation independently, as the protocol requires.*

**Is this product ready for real users?** For the thing it is — a training logger used in a gym with
no signal — the core is ready, and I would say so on evidence rather than on appearance. The
strongest reason to believe that is not the 58 green gates; it is that the two defects which mattered
most were invisible to all of them. DEF-03 needed seeded history and a driven completion; DEF-01
needed the same gate run four times. Both were found by driving, which is the pattern this repository
has recorded a dozen times and which held again here.

**Why I still will not stamp GO LIVE.** Three reasons, in order of how much they should bother the
owner:

1. A feature the specification promises has **never once worked in production**, and nothing in the
   session can close it. Shipping §7 as written means shipping a claim measurably contradicted by ten
   consecutive failed runs.
2. **Offline is the product's stated differentiator and it is the least verified axis in this
   report.** I can prove the service worker registers and precaches 131 files. I cannot prove a
   trainee in a basement gym can reload the page. That gap is a property of a deliberate
   origin guard, not of a missing test, and it is one reload on the live site away from closed.
3. **Dark mode is the app's default theme and the one axis with no contrast gate.** 160 measured
   findings sit behind no budget file. A regression there ships invisibly.

**What I am explicitly not counting as risk.** The calorie-ring finding is real but it is an estimate
normalised against the athlete's own baseline, and the clamp that causes it is the physiologically
correct half of the formula. The sub-44px chrome controls are ratcheted and tracked. The
`TMR.start()` input gap is unreachable from every live call site, which I verified rather than
assumed.

**Conditions to convert this to GO LIVE, after Phase 2:** close DEF-08 (the weekly check-in), and
verify one real offline reload on the deployed origin. Two decisions sit alongside them rather than
blocking: DEF-02 (the calorie formula's calibration) and DEF-12 (when to touch the set-persistence
path to make the cluster breakdown apply mid-session). The live-RLS condition is closed.

---

## Closeout status — asked to close this assessment (2026-09-17)

**It does not close yet, and the reason is one item, not a long list.**

DEF-12's *claim* is closed: the owner chose the copy fix, and the app no longer advertises behaviour
it does not have (verified by driving all three tour surfaces, not by grepping). That pass also found
**DEF-15** by checking a code comment rather than trusting it — `run-workout.html`'s cluster edit
un-checks a set the athlete already logged. No data is lost (the store holds it; a reload brings it
back), and it folds into DEF-12's own `rebuildRows(card)` fix rather than being separate work.

What actually blocks the stamp:

| | Blocks GO LIVE? | Whose |
|---|---|---|
| **DEF-08** — the weekly check-in has never fired; 10/10 runs failed, `push_subscriptions` empty | **Yes — P1** | Owner: set the secret and prove one run, or drop the §7 claim |
| **DEF-09** — no real offline reload verified on the deployed origin | **Yes** | Owner: one reload on the live site |
| DEF-02 — calorie calibration | No — decision | Owner |
| DEF-12 / DEF-15 — the repaint gap | No — cosmetic, no data loss | Whenever the set logger is next opened deliberately |

**So: two owner actions, neither of them code, neither performable from a session.** Everything this
assessment could close from here is closed. The verdict stays **CONDITIONAL GO** — not because the
engine is weak, but because a protocol whose instruction is "certify based on evidence" cannot count
an untested axis as a pass, and offline is this product's stated differentiator.

**The honest summary of the whole effort:** every page in the tree renders clean, every workout page
that renders a session completes one, the data layer held under twelve deliberate cross-user attacks,
and the one shared-module defect this work exposed in Mike's Cookbook is fixed there too. The
remaining unknown is concentrated where it has been all along — the **signed-in surface**, which
needs an invite, and the **deployed origin**, which needs a phone.

**What Phase 2 changed about my confidence.** Phase 1's "zero P0" meant zero P0 *in what was
exercised*, and that was a fair caveat to make. It is a much smaller caveat now: every page in the
tree renders clean, every workout page that renders a session completes one, and the data layer held
under twelve deliberate attacks. The four new defects are all presentation or affordance — none of
them loses a set. The remaining unknown is concentrated in one place, and it is the same place it was
before: **the signed-in surface**, which needs an invite I do not have.

> **GO LIVE means the product survives reality.** It survives everything reality could be simulated
> to throw at it here. Four things reality has not been asked yet.
