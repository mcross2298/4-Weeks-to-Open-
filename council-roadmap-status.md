# MC Training Suite — Council Roadmap Status

> Handoff summary of the four-seat LLM council audit (2026-07-07) of
> `mcross2298/4-Weeks-to-Open-` (workout app, master repo) and
> `mcross2298/Mikes-Cookbook`. Full report artifact:
> https://claude.ai/code/artifact/7513f897-3bb6-4de8-93ca-e6d31514c962
>
> Phase 0 is **shipped and merged to main in both repos**. Phases 1–4 are outstanding.

---

## Council findings (context for any future session)

1. **The intelligence is open-loop.** Engines suggest but don't act — `mc-suggest.js` detects plateaus/deloads but never applies them; the `coach-claude` Supabase edge function returns prose no engine consumes.
2. **The two apps are one product forked by copy-paste.** `mc-foodapi.js` ≡ `tracker-foodapi.js` (byte-identical, same edge function, same cache key); same for the macro calculators and barcode modules. But they write to **two macro stores that never reconcile** — the workout app's `mc_macros_v1` is Supabase-synced; the cookbook's `mc-cookbook:tracker:v1` is stranded in one browser's localStorage, along with Mike's user-authored recipes (`mc-cookbook:userrecipes`). **Headline risk: one browser wipe loses the cookbook's user data.**
3. **Polish never reached the fleet.** The flagship multi-week program pages (`mm-p1/p2/p3.html`, `iron-engine.html`, `the-500.html`, `hv-block.html`, `kitchen-sink*.html`) are hand-cloned HTML with inline `DAYS`/`renderExercise` logic (622/846 lines diverge between siblings), validated only by the human checklist in CLAUDE.md.
4. **"Full control" already exists, locked away.** `mc-layout.js` resolves user-selectable layouts (stack/grid/carousel · list/swipe/grouped) but the editor (`mc-pm-layout-editor.js`) is owner-only.

**LLM placement (council unanimous):** deterministic logic owns progression, deloads, macro control, scheduling. An LLM earns its keep in exactly three places — structured coaching synthesis, natural-language food logging, semantic fallback when strict matchers return <3 results. The infra (`coach-claude`, server-side key, RLS) already exists.

---

## ✅ Phase 0 — COMPLETE (merged 2026-07-07)

PRs: [4-Weeks-to-Open- #168](https://github.com/mcross2298/4-Weeks-to-Open-/pull/168) · [Mikes-Cookbook #93](https://github.com/mcross2298/Mikes-Cookbook/pull/93). All deploys green, including the Rolodex clean-build (leak gate passed) and the cookbook Pages deploy (which also healed the previously-failed deploy of PR #92 — production had been stale for a day).

| Item | What shipped | Files |
|---|---|---|
| 0.1 A11y floor | Global `:focus-visible` ring, blanket `prefers-reduced-motion` guard, 44px touch targets on set-logging inputs/checkboxes/RPE chips — lifts all ~150 program pages | `base.css`, `mc-setlog.css` |
| 0.2 Carry-forward planned loads | Suggestions persist as next session's targets in new **`mc_plan_targets_v1`** store (sync-whitelisted) and prefill the weight inputs for the sets they apply to (pyramid-safe via `base` weight; typed values never overwritten). Tests extended. | `mc-suggest.js`, `tools/test-mc-suggest.js` |
| 0.3 Live-region timers | Polite `aria-live` announcements for timer start / 10s warning / done (shared `#mcTimerLive` node), and Cooking Mode step/done announcements (`#cookLive`) | `mc-timer.js`, `superset-timers.js`, cookbook `cookbook.js` |
| 0.5 Dead files retired | Deleted byte-identical `exercisedata-phase8.json`/`_8_1.json`, `mcsplitsupdate.bundle`, `index-v4.html` (~14.8k lines); manifest + `build-sw.py` deny-list entries removed; SW → v119 | `content-manifest.json`, `tools/build-sw.py`, `sw.js` |
| 0.6 Sync merge fix | New `arrayByIdTs` merge (newest `updatedAt`/`ts` wins) for `mc_custom_programs_v1` + `mc_custom_workouts_v1` → **edits now converge across devices**. Custom-**program** deletes leave synced tombstones (`{id, deleted:true, updatedAt}`, pruned after 90 days); `MCPrograms.getAll/get` filter them | `mc-sync.js`, `mc-program-store.js` |
| 0.7 Bidirectional deep links | Workout nutrition tab (today, goals set, ≥100 kcal left) shows **"Cook to hit your remaining macros"** → `Mikes-Cookbook/index.html?mkcal=&mp=#recipes`. Cookbook Recipes screen consumes it: dismissible **"🎯 Fits your day"** banner, ≤ remaining kcal (+25 tolerance), protein-first, params stripped after consumption. Reverse of the existing `tracker-recipe.js` handoff. Smoke-tested headless. | `mc-macros.js`, cookbook `cookbook-home.js`, `cookbook.css` |
| 0.8 Quick Tours in nav | **Already shipped pre-audit** (workout dashboard tool card w/ NEW badge; cookbook first-launch banner + Home module). Council finding was stale — no change needed. | — |
| Docs | Quick Tours updated for the prefilled loads + both handoff surfaces (documentation-currency rule) | both `quick-tour.html` |

### ⚠️ Left over from Phase 0
- **0.4 — Branch-protect `MC-Training-Rolodex` `main` (MANUAL, owner-only).** Repo Settings → Branches → protect `main`, restrict pushes to the deploy bot (`mc-market-bot` / `ROLODEX_DEPLOY_TOKEN` actor). Needs repo admin; the one change that would have prevented the past licensed-content leak (roadmap item G6 in `pm-improvement-roadmap.md`).
- **Custom-workout delete tombstones deferred.** `mc_custom_workouts_v1` has ~6 direct readers (`build-workout.html`, `run-workout.html`, `mc-bonus-routing.js`, `mc-collections.js`, `mc-quick-pump.js`, `import.html`) that would surface tombstones. Either centralize reads behind one store module first, or teach each reader to filter `deleted`. Workout *edits* do converge now.

---

## 🔲 Phase 1 — One nutrition brain (NEXT, the strategic commitment)

Prerequisite for everything in Phases 2–4 that crosses the two apps.

| # | Item | Effort | Notes |
|---|---|---|---|
| 1.1 | Extract shared nutrition modules (foodapi / macrocalc / barcode) to one versioned source both apps consume | S | `tools/extract-shared-modules.py` exists for exactly this; zero behavior change |
| 1.2 | Unify the macro store: point the cookbook tracker at `mc_macros_v1` + existing Supabase sync (`mc-supabase.js`/`mc-sync.js`); retire `mc-cookbook:tracker:v1` | M | Cookbook gains login + multi-device for free; migrate existing tracker data on first run |
| 1.3 | Cookbook durability: sync/export remaining `mc-cookbook:*` state (meal plans, macro history, **user recipes**) via the `user_sync` pattern; plus logged-out JSON export in both apps | M | Kills the report's headline data-loss risk |

## 🔲 Phase 2 — Close the loops

| # | Item | Effort |
|---|---|---|
| 2.1 | Auto-deload insertion — when `detectPlateau()` returns `deload`, generate the −10% week (detection already shipped; `mc-schedule.js` mutates instances cleanly) | S |
| 2.2 | Training-load-aware calorie targets — derive activity multiplier + train/rest-day split from logged volume (`mc-recap`/`mc_workout_log_v1` → macro goals). *Needs Phase 1.* | M |
| 2.3 | Adaptive macro control loop — weekly reconcile goals vs. logged intake vs. 7-day bodyweight trend (`mc_body_v1`), nudge ±100 kcal. Deterministic, not LLM. | M |
| 2.4 | History-aware Quick Pump — bias away from muscles trained <48h, seed weights from `mc_setlog_v1`/`mc_plan_targets_v1`, balance weekly volume | M |
| 2.5 | Unlock the layout engine for trainees — personal localStorage layer over `mc-layout.js` (currently owner-only); personal accent/density picker | M |
| 2.6 | Meal-plan ↔ training-calendar cross-wiring — carb-forward recipes on leg days; cook-log as adherence signal | M |

## 🔲 Phase 3 — Automation-grade foundations

| # | Item | Effort |
|---|---|---|
| 3.1 | Turn CLAUDE.md's pre-merge program checklist into CI — `tools/validate-programs.js` parsing every page's `DAYS`, asserting intensifier coverage / 2-4-4 set mix / visible week themes | M |
| 3.2 | Data-drive the flagship multi-week pages — extract inline `DAYS`/`WEEK_THEMES`/`renderExercise`/W5 logic into one shared engine + per-program data files (pattern proof: `pmc-data.js`, data-driven dashboard) | L |
| 3.3 | Single source of truth for program/split/badge/page maps (roadmap C1) — generated at build time; shrinks the `MARKET:STRIP` surface | M |
| 3.4 | Headless render smoke test in CI for sampled program pages + cookbook screens (a working local pattern exists from Phase 0 verification — Playwright, global install, `NODE_PATH=/opt/node22/lib/node_modules`) | M |
| 3.5 | Data-drive the `mc-s*`/`pmc-s*` fleet — day-card exercise rows become data; all ~117 pages generated, not authored | L |

## 🔲 Phase 4 — The next level

| # | Item | Effort |
|---|---|---|
| 4.1 | Structured coach-claude — edge function returns JSON (per-lift flags, volume warnings, swaps) rendered as actionable chips, not prose | M |
| 4.2 | Natural-language food logging — "two eggs and a bagel" → parsed macros, matched to Open Food Facts | M |
| 4.3 | LLM substitution fallback — when `mc-biomech`/recipe matchers return <3 results | M |
| 4.4 | Voice control — opt-in `SpeechRecognition`: "log 10 reps / start timer" (gym), "next step / read ingredients" (Cooking Mode) | L |
| 4.5 | Client roster in PM Mode — assign program + macro profile per client on existing Supabase identity | L |
| 4.6 | Automated weekly check-ins — bodyweight trend + training + nutrition adherence → coach recap via `mc-push.js` | M |
| 4.7 | Unified market — recipes/collections ride `content-manifest.json` + `build-market.py` into the Rolodex | L |

---

## Working notes for the next session

- **Workflow:** all work in `4-Weeks-to-Open-` (master); never push to `MC-Training-Rolodex` (generated build, auto-deployed on merge to main). Cookbook pushes to `main` are production deploys — run `node --check` over all JS + `tools/validate-recipes.js` + `tools/build-sw.py --check` (bump version when assets/JS change) before pushing.
- **Workout repo local gates:** `node --check` all JS · `tools/test-mc-suggest.js` · `tools/test-mc-maxout.js` · `tools/test-naming.js` · `tools/check-program-colors.js` · `python3 tools/build-market.py --check` · `python3 tools/build-sw.py --check`.
- **New store shipped in Phase 0:** `mc_plan_targets_v1` (`{ "pid|exId": { w, status, why, ts } }`, dictByTs-synced) — Phase 2 items 2.1/2.4 should read from it.
- Deploy URLs: workout `https://mcross2298.github.io/4-Weeks-to-Open-/` · cookbook `https://mcross2298.github.io/Mikes-Cookbook/`.
