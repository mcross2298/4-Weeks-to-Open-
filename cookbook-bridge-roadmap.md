# Cookbook ↔ Workout — Data-Bridge & Joint-Launch Roadmap

Status: **ACTIVE — plan approved 2026-07-15; B0–B5 not started, each phase gated**
Approved: 2026-07-15 (executive summary approved by owner; delivered also as a
shareable Artifact roadmap)
Goal: drive **Mike's Cookbook** and **4 Weeks to Open** to a **joint launch as
two linked PWAs** — one sign-in, shared data, a full **two-way bridge** so meals
inform training and training informs meals, and a suite that reads as one
product. Not date-gated — launch happens when B5 (the joint Definition of Done)
is met.

> **This roadmap runs alongside [`launch-roadmap.md`](launch-roadmap.md)**, which
> drives the workout app on its own to launch (L0–L6). This document governs the
> *cross-app* work only. Its final phase (B5) folds into `launch-roadmap.md`'s L6
> Definition of Done, so "launched" means **both apps together**, not either
> alone. The cookbook side is tracked in `Mikes-Cookbook/ROADMAP.md`, whose
> open "real data-bridge" backlog item this roadmap resolves.

## Locked decisions (owner, session 2026-07-15)

- **Bridge scope:** **full two-way bridge.** Cookbook → Workout (meals surface in
  the workout app), Workout → Cookbook (training data drives meal planning), plus
  a unified daily view in both apps.
- **Launch shape:** **two linked PWAs.** Each app stays its own installable PWA;
  the bridge is seamless cross-linking, one sign-in, shared data, and consistent
  branding — a suite, not a merged super-app.
- **Weighting:** **balanced phases** — foundation (data contract & sync) first,
  then bridge features, then a dedicated UI/UX unification pass, then joint
  hardening. No single concern is best-effort.
- **Audience & pace:** **invite-only clients, flexible timeline.** Quality over
  speed; phases gated on owner approval exactly like `launch-roadmap.md`.
- **Process:** phases execute in order B0 → B5. Each phase gets its own executive
  summary + explicit approval before any code is written, and an AskUserQuestion
  gate before the next phase starts. This document's status board + shipped notes
  are updated as each phase lands (the anti-drift discipline `launch-roadmap.md`
  learned the hard way in L1/L4).
- **Workflow invariants:** master work lands in `4-Weeks-to-Open-`; the cookbook
  side lands in `Mikes-Cookbook`. Never push to `MC-Training-Rolodex` (generated
  build). Standard local gates before every PR (`node --check` touched JS ·
  each repo's `build-sw.py --check` · this repo's `build-market.py --check`
  leak-scan · program/naming/suggest/maxout tests where touched).

---

## Architecture reality — the one constraint that shapes everything

The two apps ship as **two standalone PWAs on two origins**. Two origins means
**no shared `localStorage`** — the cookbook cannot read the workout app's
`localStorage` directly, and vice versa. There are exactly two places their data
can actually meet:

1. **Signed-in Supabase sync (the real bridge).** Both apps already share one
   Supabase project, one invite-only account, and one `user_sync(user_id,
   store_key, data jsonb, …)` table (RLS-isolated per user). `mc_macros_v1`
   already reconciles across both apps through it. The bridge is built by
   **widening each app's sync whitelist** so it also *pulls* (read-only) the
   stores the other app owns.
2. **The Rolodex market mount (same-origin, free reads).** `build-market.py`'s
   roadmap-4.7 machinery already mounts the whole cookbook under `./cookbook/` in
   the public Rolodex build, so there the cookbook is same-origin with the
   workout app and `localStorage` reads *are* shared. This is a bonus path, not
   the primary one — the invite-only launch targets the two standalone PWAs.

**Consequence:** B0 exists to settle this contract on paper *first*, so B1–B3 are
built against a real read layer (`mc-bridge.js`) that works in both deployment
shapes, instead of assuming a shared `localStorage` that only exists in one of
them. Every store keeps **exactly one writing app**; the other side is a
**read-only consumer**. The sole intentional exception is `mc_macros_v1`, which
both apps write and which already has a field-level merge in each app's
`mc-sync.js`.

### Shared-store ownership map (the B0 contract, in brief)

| Store key | Writer (owner) | Consumer (read-only) | Merge on conflict |
|-----------|----------------|----------------------|-------------------|
| `mc_macros_v1` | **both** (tracker) | both | field-level (already shipped) |
| `mc-cookbook:mealplan` | Cookbook | → Workout | by `uid` |
| `mc-cookbook:cooked` | Cookbook | → Workout | by recipe |
| `mc-cookbook:mealplan:macrohistory` | Cookbook | → Workout | by `uid` |
| `mc_activity` | Workout | → Cookbook | activity merge |
| `mc_workout_log_v1` | Workout | → Cookbook | workout-log merge |
| `mc_plan_targets_v1` | Workout | → Cookbook | dict-by-ts |

Consumers never write a store they don't own — that's what keeps the widened
sync whitelist from creating two-writer conflicts.

---

## Phase B0 — Bridge foundation & data contract

**Goal:** a written, enforced contract for every shared store and a tiny shared
read layer, so later phases build on solid ground instead of guessing at the
two-origin reality.

Tasks:
1. **Data-contract doc** — finalize the ownership map above (writer / consumers /
   merge / cross-origin path) as the canonical reference both repos link to.
2. **Widen the sync whitelists** — in each app's `mc-sync.js`, add the other
   app's needed stores as **pull-only** consumers (workout pulls the three
   `mc-cookbook:*` planning stores; cookbook pulls `mc_activity`,
   `mc_workout_log_v1`, `mc_plan_targets_v1`). No store gains a second writer.
3. **`mc-bridge.js` — a shared read module** in both repos exposing a small,
   deployment-agnostic API: `todaysMeals()`, `todaysWorkout()`, `macroTargets()`,
   `recentActivity()`. It reads local `localStorage` on the same-origin Rolodex
   mount and the synced mirror when standalone. **Reads only — never writes.**
4. **Round-trip verification** — signed in, confirm a store written in one app
   appears (read-only) in the other, both directions, and that a signed-out user
   sees exactly today's behavior (bridge is a no-op).

Exit criteria: contract doc merged in both repos · whitelists widened with no
two-writer store (except `mc_macros_v1`) · `mc-bridge.js` reads verified both
directions · signed-out behavior unchanged.

## Phase B1 — Cookbook → Workout (meals inform training)

**Goal:** a signed-in trainee sees today's planned meals and macro plan inside
the workout app, without leaving it.

Tasks:
1. **Planned meals in the Nutrition tab** — `dashboard.html?tab=nutrition` reads
   `mc-bridge.js::todaysMeals()` and lists today's planned meals with their
   per-serving macros.
2. **One-tap "log planned meal"** — tapping a planned meal writes it into
   `mc_macros_v1` (the store both apps already share), so it counts toward the
   day exactly like a manually-logged food.
3. **Plan-vs-target readout** — surface planned-meal macros against the day's
   `mc_plan_targets_v1` targets on the dashboard/nutrition surface.
4. **Empty & signed-out states** — a designed empty state when there's no plan or
   no sign-in (reuse the `showEmpty()` vocabulary), never a blank panel.

Exit criteria: planned meals visible and loggable in the workout app for a
signed-in user · degrades cleanly signed-out · Quick Tour updated
(`quick-tour.html`).

## Phase B2 — Workout → Cookbook (training informs meals)

**Goal:** the cookbook's smart features become training-aware — the planner knows
what the trainee did (and will do) in the gym.

Tasks:
1. **Training-day-aware Smart Week** — the Smart Week / Macro Smart Generator
   scoring reads `mc-bridge.js::recentActivity()` / `todaysWorkout()` and biases
   selection (higher protein on lifting days, appropriate fueling on conditioning
   days, lighter on rest days).
2. **Workout-aware Home nudge** — the cookbook Home surfaces a short, specific
   line ("Leg day today — here's a higher-protein plan") instead of a generic
   prompt, driven by real activity data.
3. **Fused weekly recap** — the planned-vs-cooked adherence stat gains a training
   column (workouts completed that week from `mc_workout_log_v1`), so one recap
   shows both domains.
4. **Closes the cookbook's deferred macro-trend-bias backlog** — this phase is
   the natural home for `ROADMAP.md` Pillar C's deferred bias fast-follow, now
   that real cross-app signal exists to bias on.

Exit criteria: Smart Week visibly shifts on a training day vs. a rest day · recap
shows both domains · signed-out cookbook unchanged · cookbook Quick Tour updated.

## Phase B3 — Unified "Today" view & reciprocal navigation

**Goal:** one glance in either app answers "what am I doing today?" — workout,
meals, and macros together — and moving between the apps is first-class.

Tasks:
1. **Shared "Today" strip** — a small component (built on `mc-bridge.js`)
   rendering today's workout, today's meals, and the macro ring; dropped into the
   workout dashboard Home and the cookbook Home.
2. **Reciprocal, first-class navigation** — a persistent, branded link from each
   app to the other (today only the Rolodex market-mount injects a one-way
   cookbook icon). Make it two-way and present in the standalone PWAs too, with
   sign-in preserved across the hop.
3. **Deployment-shape parity** — the Today strip and nav work identically whether
   standalone (synced reads) or Rolodex-mounted (local reads).

Exit criteria: Today strip renders in both apps from `mc-bridge.js` · nav works
both directions in both deployment shapes · both apps' onboarding docs mention
the sister app.

## Phase B4 — Suite UI/UX & design unification

**Goal:** the two apps read as one designed product — the "linked PWAs" promise
made visible.

Tasks:
1. **Consistent account & install experience** — one visual language for the
   sign-in sheet, Install moment, and sync/backup status across both apps.
2. **Unified bridge-surface vocabulary** — shared empty / loading / error states,
   iconography, and accent treatment for "the other app" everywhere the bridge
   shows up.
3. **Cross-app polish pass** — typography, spacing, and motion on the bridge
   surfaces reconciled so a user moving between apps feels continuity, not a seam.
4. **Docs** — both quick tours + `program-guide.html` describe the suite and the
   bridge features per each repo's documentation-currency rule.

Exit criteria: a side-by-side review of the bridge surfaces reads as one product
· both apps' onboarding docs current on the bridge · no orphaned/inconsistent
bridge UI.

## Phase B5 — Joint launch hardening (Definition of Done)

**Goal:** the two apps launch **together**, verified as a suite. This phase folds
into `launch-roadmap.md` L6 — both must be green to call the product finished.

Tasks & checklist:
1. **Cross-app QA matrix** — the full loop on iOS Safari + Android Chrome, each
   installed and in-browser: sign in → plan a meal in the cookbook → see & log it
   in the workout app → train → see it reflected in the cookbook recap → confirm
   macros reconcile across both.
2. **Sync-conflict & offline behavior** — edit the same day in both apps
   offline, reconnect, confirm the documented merge wins; core flows usable
   offline in each app.
3. **Data safety across the bridge** — export/import in each app round-trips the
   bridge stores; Supabase backups confirmed.
4. **Version & regression** — both service workers bumped; each repo's gates
   green in CI; smoke coverage includes the bridge surfaces.
5. **Launch checklist review** — owner walk-through; anything unchecked is fixed
   or explicitly waived in writing here **and** in `launch-roadmap.md` L6.

Exit criteria: **every matrix row and checklist item above passes or is waived in
writing by the owner, in this document and in `launch-roadmap.md` L6. That is the
definition of "finished product, launched together."**

---

## Status board

| Phase | Theme | Direction | Status |
|-------|-------|-----------|--------|
| B0 | Bridge foundation & data contract | ⇄ both | 🔲 Not started |
| B1 | Cookbook → Workout (meals inform training) | 🍎 → 🏋️ | 🔲 Not started |
| B2 | Workout → Cookbook (training informs meals) | 🏋️ → 🍎 | 🔲 Not started |
| B3 | Unified "Today" view & reciprocal nav | ⇄ both | 🔲 Not started |
| B4 | Suite UI/UX & design unification | ⇄ both | 🔲 Not started |
| B5 | Joint launch hardening (Definition of Done) | ⇄ both | 🔲 Not started |

Update this table (and append a short "shipped" note under the phase) as each
phase merges. Statuses: 🔲 Not started · 🔄 In progress · ✅ Complete ·
⏸ Waived/deferred (owner decision, link it).

### Shipped notes

_(none yet — B0 is the next gated slice; it needs its own executive summary and
owner approval before any code is written.)_
