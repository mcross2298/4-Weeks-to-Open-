# MC Training Suite — Council Roadmap Status

> Handoff summary of the four-seat LLM council audit (2026-07-07) of
> `mcross2298/4-Weeks-to-Open-` (workout app, master repo) and
> `mcross2298/Mikes-Cookbook`. Full report artifact:
> https://claude.ai/code/artifact/7513f897-3bb6-4de8-93ca-e6d31514c962
>
> **Phases 0–3 are shipped and merged to main in both repos.** Phase 3.5 is
> explicitly deferred (see below). Phase 4 is scoped but not started — this
> doc exists to hand it to a fresh session cleanly.

---

## Original council findings (historical context)

1. **The intelligence is open-loop.** *(Addressed by Phase 2 — deloads now
   apply, calorie targets read real training load, macros self-adjust.)*
2. **The two apps are one product forked by copy-paste.** *(Addressed by
   Phase 1 — shared nutrition modules, one macro store, cross-app sync.)*
3. **Polish never reached the fleet.** *(Partially addressed — the 3
   `mm-p*.html` pages are now data-driven with a CI checklist gate, Phase
   3.1/3.2. The much larger `mc-s*`/`pmc-s*` fleet is Phase 3.5, deferred —
   see below.)*
4. **"Full control" already exists, locked away.** *(Addressed by Phase
   2.5 — personal accent/density layer over `mc-layout.js`, no PM unlock
   required.)*

**LLM placement (council unanimous, still the guiding principle for Phase
4):** deterministic logic owns progression, deloads, macro control,
scheduling. An LLM earns its keep in exactly three places — structured
coaching synthesis, natural-language food logging, semantic fallback when
strict matchers return <3 results. The infra (`coach-claude` edge function,
server-side key, RLS) reportedly already exists per the original audit but
**has not been touched or re-verified in any phase since** — confirm its
current state before scoping Phase 4 work against it.

---

## ✅ Phases 0–3 — COMPLETE

Full PR-by-PR detail lives in each PR's description (all follow the same
executive-summary → approval → implement → verify → draft-PR pattern). This
section is deliberately a compact index, not a re-summary.

### Phase 0 — merged 2026-07-07
`4-Weeks-to-Open-` [#168](https://github.com/mcross2298/4-Weeks-to-Open-/pull/168) ·
`Mikes-Cookbook` [#93](https://github.com/mcross2298/Mikes-Cookbook/pull/93)
A11y floor, carry-forward planned loads (`mc_plan_targets_v1`), live-region
timers, dead-file retirement, sync merge fix, bidirectional
workout↔cookbook macro-fit deep links.
**Left open (manual, owner-only):** branch-protect `MC-Training-Rolodex`
`main` (repo admin action, item 0.4 — never automatable from a session).

### Phase 1 — One nutrition brain
| # | Item | `4-Weeks-to-Open-` | `Mikes-Cookbook` |
|---|---|---|---|
| 1.1 | Shared nutrition modules (foodapi/macrocalc/barcode), `tools/sync-nutrition-modules.py` | [#170](https://github.com/mcross2298/4-Weeks-to-Open-/pull/170) | [#94](https://github.com/mcross2298/Mikes-Cookbook/pull/94) |
| 1.2 | Unified macro store (`mc_macros_v1` + Supabase sync in the cookbook) | — | [#95](https://github.com/mcross2298/Mikes-Cookbook/pull/95) |
| 1.3 | Cookbook durability (meal-plan/recipe sync + manual export/import both apps) | [#171](https://github.com/mcross2298/4-Weeks-to-Open-/pull/171) | [#96](https://github.com/mcross2298/Mikes-Cookbook/pull/96) |

### Phase 2 — Close the loops (`4-Weeks-to-Open-`, + one cookbook companion)
| # | Item | PR |
|---|---|---|
| 2.1–2.3 | Auto-deload, training-load-aware calories, adaptive macro control loop | [#172](https://github.com/mcross2298/4-Weeks-to-Open-/pull/172) |
| 2.4–2.5 | History-aware Quick Pump, personal accent/density picker | [#173](https://github.com/mcross2298/4-Weeks-to-Open-/pull/173) |
| 2.6 | Day-type derivation → cookbook carb-forward handoff | [#174](https://github.com/mcross2298/4-Weeks-to-Open-/pull/174) + cookbook [#97](https://github.com/mcross2298/Mikes-Cookbook/pull/97) |

### Phase 3 — Automation-grade foundations (`4-Weeks-to-Open-` only, scope-locked)
| # | Item | PR |
|---|---|---|
| 3.1 | CI-enforced intensifier-coverage checklist — `tools/validate-programs.js` | [#175](https://github.com/mcross2298/4-Weeks-to-Open-/pull/175) |
| 3.2 | Data-drive the Modality Matrix trio — `mm-data.js` + `mm-engine.js` | [#176](https://github.com/mcross2298/4-Weeks-to-Open-/pull/176) |
| 3.3 | Consolidate badge labels / split map / program-guide.html onto `mc-pm-data.js` | [#177](https://github.com/mcross2298/4-Weeks-to-Open-/pull/177) |
| 3.4 | Headless render smoke test in CI (report-only) — `tools/smoke-test-pages.js` | [#178](https://github.com/mcross2298/4-Weeks-to-Open-/pull/178) |

**New tools/patterns Phase 3 leaves behind** (reusable in Phase 3.5 / Phase 4):
- `tools/validate-programs.js` — balanced-bracket array-literal extraction
  from a data module, no `vm` sandbox needed since the data lives in an
  IIFE-attached global, not scraped from inline `<script>` text anymore.
- `mm-data.js` + `mm-engine.js` — the reference data/engine split pattern:
  one shared render engine parametrized by per-program metadata, one data
  module per set of programs. `pmc-s7-data.js` is the older, single-program
  version of the same idea. **Both are the pattern proof for Phase 3.5.**
- `tools/smoke-test-pages.js` — CI-only Playwright, installed into a scratch
  prefix (`/tmp/pw-ci`), no `package.json` added to the repo. Currently
  samples 18 pages; extending the list is cheap (append to `PAGES`).
- The `navigator.serviceWorker` truthy-vs-`in`-operator bug class (fixed in
  `mc-sw-update.js` + `exercise-library.html`) — worth a quick
  `grep -rn "'serviceWorker' in navigator"` sweep if touching more pages,
  since `mc-push.js:30` still has the same pattern (not yet triggered by
  anything the smoke test exercises, so left alone — see PR #178).

---

## 🔲 Phase 3.5 — Data-drive the `mc-s*`/`pmc-s*` fleet (DEFERRED)

**Status: explicitly deferred by owner decision** (AskUserQuestion during
Phase 3 planning, "Defer entirely"). Re-scope from scratch if revisited —
don't assume the original roadmap wording still holds; it didn't survive
first contact with the actual fleet.

### What research already found (don't re-derive this)
- **Page count corrected:** the roadmap's original "~117 pages" estimate is
  wrong. Actual count is **48 day-detail pages** after excluding 12
  split-index/landing pages (which aren't day-detail content and don't fit
  the `DAYS`/`renderExercise` shape anyway).
- **Structural divergence is real, not cosmetic:** unlike the Modality
  Matrix trio (which turned out to be byte-identical render logic once
  compared directly), the `mc-s*`/`pmc-s*` fleet has **different
  function/variable names, different badge taxonomies, inconsistent week
  counts, and no existing regression net** across pages. A single
  mechanical `mm-engine.js`-style extraction will not work as-is — this
  fleet needs page-by-page reconciliation *before* any shared engine can be
  written, or several smaller sub-engines for genuinely different families
  of pages rather than one universal one.
- **Two data/engine pattern proofs now exist** to model from:
  `pmc-s7-data.js` (single program, pre-existing) and `mm-data.js` +
  `mm-engine.js` (three programs, built in Phase 3.2). Neither has had to
  handle real structural divergence between siblings — Phase 3.5's hard
  part is exactly the part neither proof covers.

### If picked back up, suggested first steps (not yet executed)
1. Re-verify the 48-page count and pull a fresh diff matrix (which pages are
   actually identical vs. genuinely divergent, and in what way — function
   names? data shape? badge taxonomy? week count?). Don't trust the Phase 3
   count without a re-check; new pages may have shipped since.
2. Group pages into families by structural similarity rather than assuming
   one universal engine. Likely 2–4 families, not 1 or 48.
3. Pick the *most* homogeneous family first and prove the pattern on it
   (small blast radius), verified byte-for-byte against the original data
   the same way Phase 3.2 did (`JSON.stringify` deep-equal check before
   ever touching the live pages).
4. Only after one family is proven should `tools/validate-programs.js` be
   generalized to cover it (it's currently hardcoded to `mm-data.js`'s
   3-program shape).
5. Executive summary + explicit approval required before writing any code
   (CLAUDE.md's planning rule) — this is unambiguously a "multi-file
   refactor."

---

## 🔲 Phase 4 — The next level (NOT STARTED)

Every item below is LLM/automation-facing, matching the council's "LLM earns
its keep in exactly three places" framing. **First action for a future
session: verify the `coach-claude` Supabase edge function's actual current
state** (endpoint, auth, response shape) — the original audit said the infra
"already exists," but nothing in Phases 0–3 touched or re-confirmed it, so
treat that claim as unverified until checked.

| # | Item | Effort | Builds on |
|---|---|---|---|
| 4.1 | Structured coach-claude — edge function returns JSON (per-lift flags, volume warnings, swaps) rendered as actionable chips, not prose | M | `coach-claude` edge function (unverified — check first) |
| 4.2 | Natural-language food logging — "two eggs and a bagel" → parsed macros, matched to Open Food Facts | M | `mc-foodapi.js`/`tracker-foodapi.js` (synced identically since Phase 1.1) |
| 4.3 | LLM substitution fallback — when `mc-biomech`/recipe matchers return <3 results | M | `mc-biomech.js`'s `alternatives()` (deterministic tier, built pre-Phase-1 per dev-plan Task 3.1) — this adds a fallback tier on top, doesn't replace it |
| 4.4 | Voice control — opt-in `SpeechRecognition`: "log 10 reps / start timer" (gym), "next step / read ingredients" (Cooking Mode) | L | — new surface, no existing infra |
| 4.5 | Client roster in PM Mode — assign program + macro profile per client on existing Supabase identity | L | `mc-supabase.js`/`mc-sync.js` auth + RLS pattern, `mc-account.js` sign-in sheet |
| 4.6 | Automated weekly check-ins — bodyweight trend + training + nutrition adherence → coach recap via `mc-push.js` | M | `mc-push.js` (Web Push manager, exists — confirmed present during Phase 3.4 but unaudited beyond that) |
| 4.7 | Unified market — recipes/collections ride `content-manifest.json` + `build-market.py` into the Rolodex | L | `tools/build-market.py`'s existing `MARKET:STRIP`/leak-scan pattern — this phase extends it to a second repo's content, which it wasn't designed for yet |

### Sequencing notes for a future session
- **4.1–4.3 are the true "LLM earns its keep" items** per the council's own
  placement principle — natural candidates to scope first, and 4.1 in
  particular gates on the infra-verification step above.
- **4.5 and 4.7 are cross-cutting/infrastructure-heavy**, not LLM features
  per se — closer in spirit to Phase 3's foundation work than Phase
  4's stated theme. Worth flagging to the owner if they're prioritized
  early, since they don't share Phase 4's "LLM" throughline.
- **4.4 (voice control) has zero existing infra** to build on, unlike every
  other Phase 4 item — likely the largest true "new surface" effort in this
  phase.
- No item in Phase 4 has been scoped in AskUserQuestion-level detail the way
  Phase 3.3's four sub-items were — expect the same pattern (research each
  item's actual current-state assumptions before committing to an executive
  summary) to surface real surprises here too, the way it did in 3.3
  (orphaned `faint` program) and 3.5 (page-count correction).

---

## Working notes for the next session

- **Workflow:** all work in `4-Weeks-to-Open-` (master); never push to
  `MC-Training-Rolodex` (generated build, auto-deployed on merge to main).
  Cookbook pushes to `main` are production deploys — run `node --check` over
  all JS + `tools/validate-recipes.js` + `tools/build-sw.py --check` (bump
  version when assets/JS change) before pushing.
- **Workout repo local gates** (current, post-Phase-3): `node --check` all
  JS · `tools/test-mc-suggest.js` · `tools/test-mc-maxout.js` ·
  `tools/test-naming.js` · `tools/check-program-colors.js` ·
  `tools/validate-programs.js` · `python3 tools/build-market.py --check` ·
  `python3 tools/build-sw.py --check`. Optionally
  `tools/smoke-test-pages.js <baseUrl>` against a local static server (needs
  Playwright installed to a scratch prefix — see PR #178's CI step for the
  exact commands).
- **Branch pattern:** shared branch `claude/council-review-rswfod` per repo.
  After each PR merges: `git fetch origin main && git checkout -B
  claude/council-review-rswfod origin/main` before starting the next item —
  don't keep stacking on the pre-merge branch state.
- **Stores introduced across Phases 0–3** (all sync-whitelisted where
  relevant): `mc_plan_targets_v1` (Phase 0), `mc_macros_v1` unification
  (Phase 1.2), `mc-cookbook:cooked` sync (Phase 2.6/cookbook #97).
- Deploy URLs: workout `https://mcross2298.github.io/4-Weeks-to-Open-/` ·
  cookbook `https://mcross2298.github.io/Mikes-Cookbook/`.
- **Planning rule reminder:** both repos' CLAUDE.md require an executive
  summary + explicit approval before writing/editing any file for anything
  beyond an isolated 1–2 file bug fix. Phase 3.5 and every Phase 4 item
  qualify — don't skip the gate even if this doc makes the scope feel
  pre-approved. This doc is a *briefing*, not a substitute for that
  approval step.
