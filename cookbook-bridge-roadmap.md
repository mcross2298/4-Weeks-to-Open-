# Cookbook ↔ Workout — Data-Bridge & Joint-Launch Roadmap

Status: **ACTIVE — plan approved 2026-07-15; B0–B4 shipped, B5's
session-verifiable work complete (owner-only sign-off — real-device matrix +
production Supabase reconciliation — is the one remaining gate)**
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

> **Correction (B3, 2026-07-15):** the original version of this section assumed
> the two standalone PWAs sit on **two separate origins**. They don't. Both
> deploy as GitHub Pages *project* sites under the same GitHub Pages user
> domain — `https://mcross2298.github.io/4-Weeks-to-Open-/` and
> `https://mcross2298.github.io/Mikes-Cookbook/` — same scheme + host + port,
> different **path**. `localStorage` (and cookies, IndexedDB) are scoped by
> **origin**, not path, so on the same device in the same browser, the two
> apps' `localStorage` is **already shared by the browser natively**, no sync
> needed — confirmed via the Supabase client too: both apps use the same
> project ref with no custom `storageKey`, so the default session-storage key
> is identical, meaning a sign-in in one app is *already* visible in the other
> in that same-browser case. This is why B3's reciprocal nav links need no
> token hand-off to "preserve sign-in across the hop" — it was never actually
> missing for that case. **This does not make the Supabase sync bridge (B0–B2)
> redundant** — it's still what carries data across *devices* (a different
> phone, a different browser) and is the only mechanism that's robust if an
> installed PWA's storage ends up partitioned per-icon on a given platform
> (a known, version-dependent nuance particularly on iOS home-screen web
> apps). Same-origin sharing is a same-device bonus on top of the sync bridge,
> not a replacement for it — the two mechanisms cover different failure modes.

The two apps ship as **two standalone PWAs**, same origin, different path (see
correction above) for the common same-browser case — but the sync bridge below
still assumes the conservative, robust case (cross-device, or a platform that
partitions storage per installed PWA) rather than relying on same-origin
sharing, since that's the only assumption that holds everywhere. There are two
places their data can meet:

1. **Signed-in Supabase sync (the real bridge, and the one that works
   everywhere).** Both apps already share one Supabase project, one
   invite-only account, and one `user_sync(user_id, store_key, data jsonb, …)`
   table (RLS-isolated per user). `mc_macros_v1` already reconciles across
   both apps through it. The bridge is built by **widening each app's sync
   whitelist** so it also *pulls* (read-only) the stores the other app owns.
2. **Same-origin `localStorage` (free, same-device bonus).** Confirmed in B3:
   the same-browser case gets live, zero-latency sharing for free, with no
   reload/sync round-trip — see the correction above.

**Consequence:** B0 exists to settle this contract on paper *first*, so B1–B3 are
built against a real read layer (`mc-bridge.js`) that works in every deployment
shape (cross-device via sync, same-device via either sync-then-reload or free
same-origin sharing), instead of assuming any one mechanism. Every store keeps
**exactly one writing app**; the other side is a **read-only consumer**. The
sole intentional exception is `mc_macros_v1`, which both apps write and which
already has a field-level merge in each app's `mc-sync.js`.

### Shared-store ownership map (the B0 contract — as shipped)

Finalized against the real code in B0. Two first-draft assumptions were
corrected: **macro targets are NOT a workout-only store** — they live in
`mc_macros_v1.goals`, which both apps already share, so `mc_plan_targets_v1`
(which is workout *load* carry-forward, not nutrition) is **not** bridged; and
`mc-cookbook:cooked` / `:macrohistory` stay **cookbook-internal** (the fused
recap reads them locally in the cookbook), so they are not cross-consumed.
Result: the minimal correct set — each side pulls only what it actually renders.

| Store key | Writer (owner) | Consumer (read-only) | Consumer merge |
|-----------|----------------|----------------------|----------------|
| `mc_macros_v1` (incl. `goals` targets) | **both** (tracker) | both | field-level *(already shipped)* |
| `mc-cookbook:mealplan` | Cookbook | → Workout | `replace` (owner authoritative) |
| `mc_activity` | Workout | → Cookbook | `replace` (owner authoritative) |
| `mc_workout_log_v1` | Workout | → Cookbook | `replace` (owner authoritative) |

A consumer **pulls but never pushes** a store it doesn't own — `push()` iterates
owned stores only, which is what keeps the widened whitelist from ever creating
a second writer. The owning app's copy is authoritative, so the consumer-side
merge is a plain `replace`.

Consumers never write a store they don't own — that's what keeps the widened
sync whitelist from creating two-writer conflicts.

---

## Phase B0 — Bridge foundation & data contract

**Goal:** a written, enforced contract for every shared store and a tiny shared
read layer, so later phases build on solid ground instead of guessing at the
two-origin reality.

Tasks (✅ **all shipped** — see the shipped note below):
1. **Data-contract doc** — ✅ the ownership map above, finalized against the real
   code (with the two corrections noted there).
2. **Widen the sync whitelists** — ✅ each `mc-sync.js` gained a `CONSUME` map of
   **pull-only** stores (workout pulls `mc-cookbook:mealplan`; cookbook pulls
   `mc_activity` + `mc_workout_log_v1`). `push()` still iterates owned stores
   only, so no store gains a second writer.
3. **`mc-bridge.js` — a shared read module** — ✅ byte-identical in both repos,
   deployment-agnostic API: `todaysMeals()`, `todaysWorkout()`, `macroTargets()`,
   `recentActivity()`, `today()`. Reads `localStorage` only — never writes.
4. **Round-trip verification** — ✅ `tools/test-mc-bridge.js` loads the real
   module in a mocked window and asserts both read directions, cookbook
   enrichment, and clean signed-out degradation (18 assertions).

Exit criteria: contract doc merged in both repos · whitelists widened with no
two-writer store (except `mc_macros_v1`) · `mc-bridge.js` reads verified both
directions · signed-out behavior unchanged.

## Phase B1 — Cookbook → Workout (meals inform training)

**Goal:** a signed-in trainee sees today's planned meals and macro plan inside
the workout app, without leaving it.

Tasks (✅ **all shipped** — see the shipped note below):
1. **Planned meals in the Nutrition tab** — ✅ a "Today's Planned Meals" card on
   `dashboard.html?tab=nutrition` reads `MCBridge.todaysMeals()` and lists
   today's planned meals with their per-serving macros.
2. **One-tap "log planned meal"** — ✅ tapping **Log** writes a normal entry into
   `mc_macros_v1` (the store both apps already share), counting toward the day
   exactly like a manually-logged food — never writes back to the
   cookbook-owned `mc-cookbook:mealplan`.
3. **Plan-vs-target readout** — ✅ surfaces planned-meal macro totals against the
   day's targets from the already-shared `mc_macros_v1.goals` (not
   `mc_plan_targets_v1` — that reference in the original draft was corrected in
   B0; see the ownership map above).
4. **Empty & signed-out states** — ✅ a designed empty state (`.empty-state`,
   the same shared vocabulary the rest of the app uses) for no-plan-today and
   for signed-out, with distinct copy for each.

Exit criteria: planned meals visible and loggable in the workout app for a
signed-in user · degrades cleanly signed-out · Quick Tour updated
(`quick-tour.html`).
**✅ All met (2026-07-15) — Phase B1 complete.**

## Phase B2 — Workout → Cookbook (training informs meals)

**Goal:** the cookbook's smart features become training-aware — the planner knows
what the trainee did (and will do) in the gym.

Tasks (✅ **all shipped** — see the shipped note below):
1. **Training-day-aware Smart Week** — ✅ both the Smart Week (`smw*`) and Macro
   Smart Generator (`msg*`) scoring read a new `MCBridge.likelyTrainingDays()` —
   a real historical weekday-training pattern from `mc_workout_log_v1`, not a
   fabricated future schedule — and bias selection (higher protein on likely
   training days, lighter/lower-kcal on likely rest days).
2. **Workout-aware Home nudge** — ✅ the cookbook Home's empty-plan hero shows a
   specific line when real training signal exists ("Legs today — plan meals
   that fuel the recovery...", or a streak-based line), falling through to the
   existing generic time-of-day copy otherwise.
3. **Fused weekly recap** — ✅ the "Past 7 Days" card gains a workouts-this-week
   count from the bridge, shown only once the workout app has actually been
   linked (never claims "0 workouts" to someone who's never connected it).
4. **Closes the cookbook's deferred macro-trend-bias backlog** — ✅ genuinely
   implemented, not just referenced: the Macro Smart Generator reads real
   `mc-cookbook:mealplan:macrohistory` and biases its protein target when the
   trailing trend is clearly under goal, with a visible, non-silent UI reason
   line, per that backlog item's own acceptance criterion.

Exit criteria: Smart Week visibly shifts on a training day vs. a rest day · recap
shows both domains · signed-out cookbook unchanged · cookbook Quick Tour updated.
**✅ All met (2026-07-15) — Phase B2 complete.**

## Phase B3 — Unified "Today" view & reciprocal navigation

**Goal:** one glance in either app answers "what am I doing today?" — workout,
meals, and macros together — and moving between the apps is first-class.

Tasks (✅ **all shipped** — see the shipped note below):
1. **Shared "Today" strip** — ✅ built on `MCBridge.today()`, but implemented as
   two *complementary* additions rather than one identical component, since
   each app's Home already covers half the picture: the workout dashboard
   gains a compact strip for today's cookbook-planned meals + macro target
   (it already shows its own training streak); the cookbook's existing
   "Today" card gains a real workout-status badge (it already shows meals +
   macro ring). Together, one glance in either app answers the full question.
2. **Reciprocal, first-class navigation** — ✅ a persistent icon link each way,
   present in both standalone PWAs (not just the Rolodex market-mount's
   one-way cookbook icon). **Sign-in preservation turned out to need zero
   code** — see the architecture correction above; same-origin `localStorage`
   sharing already carries the Supabase session across the hop for free in
   the common same-browser case.
3. **Deployment-shape parity** — ✅ both new nav links use the
   `MARKET:STRIP`/`MARKET:ADD` pattern (absolute URL standalone, relative path
   when Rolodex-mounted) — verified by simulating the actual market-build
   regex transform against both files, not just assumed.

Exit criteria: Today strip renders in both apps from `mc-bridge.js` · nav works
both directions in both deployment shapes · both apps' onboarding docs mention
the sister app.
**✅ All met (2026-07-15) — Phase B3 complete.**

## Phase B4 — Suite UI/UX & design unification

**Goal:** the two apps read as one designed product — the "linked PWAs" promise
made visible.

Tasks (✅ **all shipped** — see the shipped note below):
1. **Consistent account & install experience** — ✅ found and closed two real
   parity gaps, not just polished what existed: the cookbook had **no install
   moment at all** (`mc-install.js` ported, wired into its account sheet) and
   **no ambient sync-status indicator** (`mc-backup-status.js` ported). Also
   aligned the sign-in copy itself — the workout app's account sheet never
   mentioned the cookbook connection while the cookbook's already did;
   both now reference each other.
2. **Unified bridge-surface vocabulary** — ✅ audited; the cross-app accent
   (`rgb(167,139,250)` / `#a78bfa`) was already consistently in use on both
   the workout Today strip and the cookbook's workout badge — confirmed
   rather than assumed. A real defect found instead: B3's new
   `.home-workout-btn` silently overlapped the pre-existing
   `.home-account-btn` at the identical `right:68px` slot, fully occluding
   the workout-nav icon behind the account button. Fixed.
3. **Cross-app polish pass** — ✅ folded into the fixes above; no separate
   typography/motion issues found beyond the positioning bug.
4. **Docs** — ✅ **`program-guide.html` turned out to be the wrong venue**
   (it's a per-program training-methodology reference, not an onboarding
   page — a roadmap-drafting assumption corrected here, same as B0/B2's
   corrections) — the actual onboarding docs are the Quick Tours, already
   kept current through B1–B3. Added an explicit suite-framing sentence +
   stat chip to both apps' `quick-tour-overview.html` (previously the
   sister app was only ever mentioned feature-by-feature, never framed as
   "these are one linked product").

Exit criteria: a side-by-side review of the bridge surfaces reads as one product
· both apps' onboarding docs current on the bridge · no orphaned/inconsistent
bridge UI.
**✅ All met (2026-07-15) — Phase B4 complete.**

## Phase B5 — Joint launch hardening (Definition of Done)

**Goal:** the two apps launch **together**, verified as a suite. This phase folds
into `launch-roadmap.md` L6 — both must be green to call the product finished.

Tasks & checklist:
1. **Cross-app QA matrix** — ⚠️ **owner action required.** Session-verified: the
   full loop (plan a meal → see & log it in the workout app → train → see it
   reflected in the cookbook recap → macros reconcile) simulated headlessly
   end-to-end across both real app codebases (not a mockup) — see the B5.3
   shipped note below. **Not verified** (cannot be, from this environment): real
   iOS Safari / Android Chrome, installed-PWA mode, or physical-device behavior.
   The owner must run this matrix on real hardware before launch.
2. **Sync-conflict & offline behavior** — ✅ session-verified. `mc-sync.js`'s
   seven (workout) / six (cookbook) real merge functions now have dedicated
   regression suites run against the actual source (not a duplicated copy) —
   see B5.2. Offline reload verified live in headless Chromium for the
   cookbook app (real SW cache serves the shell + bridge modules with the
   network killed); the workout app's SW registration/precache verified the
   same way, but its fetch handler's `fetch` event only intercepts requests on
   `https://mcross2298.github.io` (a pre-existing guard, predates this
   roadmap) — so live offline-reload for that app is only observable on the
   real production origin, not localhost. See B5.4 shipped note.
3. **Data safety across the bridge** — ✅ session-verified. Both apps'
   `mc-export.js`/import already correctly exclude the other app's
   CONSUME-only stores from export and import (confirmed by reading both
   implementations, not assumed) — one-writer-per-store holds even through a
   manual backup round-trip, no code change needed. ⚠️ **Owner action
   required:** confirming real Supabase row reconciliation across two actual
   signed-in devices — not simulable locally against a real project.
4. **Version & regression** — ✅ done. Both repos' `sw.js` precache lists
   confirmed current (`mc-bridge.js`/`mc-sync.js` already precached from B0);
   no top-level asset was added/removed this phase so no manual version bump
   was needed (CI bumps to `ci-<run_number>` on every deploy regardless). A
   real gap was found and closed: **neither repo's CI actually ran the
   bridge/sync regression tests before this phase**, and the cookbook repo
   didn't even have its own copy of `test-mc-bridge.js` despite owning a
   byte-identical copy of `mc-bridge.js` itself. Fixed: copied the test into
   `Mikes-Cookbook/tools/`, and wired `test-mc-bridge.js` +
   `test-mc-sync-merge.js` into both repos' `pages.yml` as a blocking step.
5. **Launch checklist review** — ⚠️ **owner action required.** Everything a
   headless session can verify is done (B5.1–B5.4 below); the items flagged
   ⚠️ above are real gaps that only the owner can close (physical devices,
   production Supabase, final go/no-go). This document and `launch-roadmap.md`
   L6 are both updated to reflect exactly this split — nothing is marked
   "done" that wasn't actually checked.

Exit criteria: **every matrix row and checklist item above passes or is waived in
writing by the owner, in this document and in `launch-roadmap.md` L6. That is the
definition of "finished product, launched together."** As of this phase, the
**session-verifiable half is green**; the **owner-only half (real-device QA,
production Supabase reconciliation, final sign-off) is the one remaining gate**
before either roadmap can call L6/B5 truly complete.

---

## Status board

| Phase | Theme | Direction | Status |
|-------|-------|-----------|--------|
| B0 | Bridge foundation & data contract | ⇄ both | ✅ Complete |
| B1 | Cookbook → Workout (meals inform training) | 🍎 → 🏋️ | ✅ Complete |
| B2 | Workout → Cookbook (training informs meals) | 🏋️ → 🍎 | ✅ Complete |
| B3 | Unified "Today" view & reciprocal nav | ⇄ both | ✅ Complete |
| B4 | Suite UI/UX & design unification | ⇄ both | ✅ Complete |
| B5 | Joint launch hardening (Definition of Done) | ⇄ both | 🔄 Session work complete — owner sign-off (real-device matrix, production Supabase reconciliation) pending |

Update this table (and append a short "shipped" note under the phase) as each
phase merges. Statuses: 🔲 Not started · 🔄 In progress · ✅ Complete ·
⏸ Waived/deferred (owner decision, link it).

### Shipped notes

**B5 — Joint launch hardening** (2026-07-16): The hardening pass, split
cleanly between what a headless session can actually verify and what
genuinely needs the owner (real devices, production Supabase, final
sign-off) — nothing below is claimed as "done" beyond what was truly checked.
**B5.2 (sync-conflict merges, real logic not a copy):** `mc-sync.js` in both
repos is a browser-only IIFE guarded by `if (window.__mcSync) return;` etc.,
so its merge functions couldn't be `require()`'d directly. Added a
`module.exports` hook as the literal first statement inside the IIFE, before
those guards — since the merge functions are `function` declarations further
down the same closure, they're hoisted and already defined regardless of
whether the guards return early (verified this hoisting behavior with a
throwaway Node snippet before relying on it). Test harnesses
(`tools/test-mc-sync-merge.js`, new in both repos) sandbox the real file with
`vm.createContext`/`vm.runInContext` (same technique as `test-mc-bridge.js`),
supplying a fake `window`/`MC_SB` so the guards resolve to their early return
after `module.exports` is already set. 24 assertions (workout: 7 merge
strategies) / 12 assertions (cookbook: 6 strategies) against real conflicting
local/remote fixtures — newest-wins tombstones, day/session unions, macro
scalar-vs-per-entry timestamp resolution, etc. **B5.3 (full cross-app QA loop,
headless):** every prior phase (B0–B4) was verified in isolation; this ran
the whole loop together for the first time — seeded a cookbook-planned meal
into the workout app exactly as `mc-sync.js`'s CONSUME pull would, confirmed
the Today strip/Nutrition-tab planned-meal card/Log button/mc_macros_v1 write
all agree end-to-end (live-regression-guarding the exact B2 macro-field-name
bug), then seeded workout activity into the cookbook app and confirmed the
Today card's workout-badge-with-zero-planned-meals path (the exact B3 bug)
renders correctly and the reciprocal nav link is correct — 7 checkpoints,
zero console/page errors, both directions. Caught two seeding mistakes of its
own along the way (conflating `mc-cookbook:mealplan`'s weekday-code `day`
field with `mc_activity`'s calendar-date `dayKey` field) — worth noting since
it shows the two stores' key formats are easy to confuse even for someone who
just wrote the bridge. **B5.4 (offline/SW):** both repos' precache lists
confirmed current and already include `mc-bridge.js`/`mc-sync.js`. Live
offline-reload (kill the network, reload, confirm the shell **and** the
bridge modules still work from cache) verified for real in headless Chromium
for the cookbook app. The workout app's SW registers/activates/precaches
correctly locally, but its fetch handler has a pre-existing (2026-07-06,
predates this roadmap) hardcoded `url.startsWith('https://mcross2298.github.io')`
guard — correct in production, but it means the SW never intercepts anything
on `localhost`, so true offline-reload for that app is only observable on the
real deployed origin. Documented as a known environment limitation, not a
bridge regression — flagged for the owner's real-device pass rather than
silently left unverified. **B5.1/CI gap (real, found and closed):** neither
repo's CI actually ran `test-mc-bridge.js` (or the new sync-merge test)
before this phase — `pages.yml` in both repos only ran unrelated regression
suites. Worse, the cookbook repo never had its own copy of
`test-mc-bridge.js` at all, despite owning a byte-identical copy of
`mc-bridge.js` — meaning a silent drift in the cookbook's copy would never
have been caught by its own CI. Fixed: copied the test file over, wired both
bridge test files into both repos' `pages.yml` as blocking steps. Also
reconfirmed (not re-assumed) both apps' `mc-export.js`/import already exclude
CONSUME-only stores correctly, both directions, zero code changes required —
one-writer-per-store holds even through a manual backup round-trip. **What
remains, and can only be the owner's:** the real-device QA matrix (iOS
Safari, Android Chrome, installed-PWA mode), confirming actual Supabase row
reconciliation across two signed-in physical devices, and the final
go/no-go walkthrough. `launch-roadmap.md` L6 item 8 and this phase's own exit
criteria are both updated to name these explicitly rather than mark B5
"Complete" outright.

**B4 — Suite UI/UX & design unification** (2026-07-15): The audit-first phase
— checked what actually existed before deciding what to build, and found two
real parity gaps plus one real defect, rather than a purely cosmetic pass.
**Install moment ported:** the cookbook had zero "Add to Home Screen"
mechanism — `mc-install.js` (fully app-agnostic, no workout-specific
dependency) copied byte-identical into the cookbook and wired into its
account sheet's new Install section, matching the workout app's copy/UX
pattern with the app name swapped. **Sync-status indicator ported:**
likewise the cookbook had no ambient "☁️ Backed up · Nm ago" signal at all —
`mc-backup-status.js` ported, but **not** byte-identical as-is: the original
cached its `#backupStatus` element reference once at script-load time, which
works fine against the workout dashboard's stable DOM but would have gone
stale after the very first Home render in the cookbook's hub-and-spoke SPA
(`cookbook-home.js` rebuilds Home's entire DOM — `innerHTML = ""` then
re-append — on every visit). Fixed at the shared-module level (re-queries
`document.getElementById` fresh on every `render()` call) so the same file
is correct in both architectures, plus a new `MC_BACKUP_STATUS.refresh()`
hook the cookbook calls immediately after each Home re-render instead of
waiting up to 15s for the next interval tick. **A real defect found and
fixed:** B3's `.home-workout-btn` and the pre-existing `.home-account-btn`
both sat at `right:68px` — since the account button mounts after the workout
button in Home's render order, it silently and fully occluded the workout-nav
icon behind it (same z-index, same slot). Moved the workout button to
`right:116px`, verified via a real bounding-rect overlap check in headless
Chromium, not just eyeballed. **Account-copy symmetry:** the cookbook's
sign-in copy already referenced the workout app ("the same account works in
the workout app"); the workout app's own copy never mentioned the cookbook at
all — both directions now do. **Accent audit:** confirmed (not assumed) that
the cross-app violet accent (`rgb(167,139,250)`) was already consistently
applied on both the workout Today strip and the cookbook's workout badge — no
change needed there. **Docs:** `program-guide.html`, named in the original
roadmap draft, turned out to be the wrong venue once actually opened — it's a
per-program training-methodology reference, not an onboarding page (a
roadmap-drafting assumption corrected here, same class of fix as B0/B2's
corrections). The real onboarding docs — both apps' Quick Tours — were
already kept current through B1–B3; added an explicit suite-framing sentence
and a stat chip to both `quick-tour-overview.html` files (previously the
sister app was only ever mentioned feature-by-feature, never framed as "these
are one linked product"), and fixed a stale recipe count (144 → 318) noticed
in the same paragraph. All verified live in headless Chromium: button
positions/overlap, install-section render + copy, `MC_BACKUP_STATUS` API
presence, and no regressions to B0–B3's existing nav/bridge features.

**B3 — Unified "Today" view & reciprocal navigation** (2026-07-15): **A real
architecture correction, found before it caused a problem, not after:** the
original B0 doc assumed the two standalone PWAs are on two separate origins,
requiring a bridge for cross-app reads. They're actually **same-origin**
(`mcross2298.github.io`, different path) — confirmed both apps' Supabase
clients use the same project ref with no custom `storageKey`, so a sign-in in
one app is already visible in the other via ordinary same-origin
`localStorage` sharing, same-browser. This didn't make B0's sync bridge
redundant (it's still what covers cross-device use and any platform that
partitions storage per installed PWA), but it did mean B3's reciprocal-nav
"sign-in preserved across the hop" requirement needed **zero new code** — see
the corrected Architecture reality section above. **Today strip:** rather than
one identical component copy-pasted into both apps, built as two
*complementary* halves since each Home already covers half the picture — the
workout dashboard gets a compact strip (`populateTodayStrip()`) summarizing
today's cookbook-planned meals + macro goal (clickable into the Nutrition
tab), hidden entirely with no bridge data; the cookbook's existing "Today"
card gets a real workout-status badge (`todayWorkoutBadge()`) and now renders
even on a day with a workout logged but no meals planned (previously it
returned `null` in that case, silently dropping the workout signal). Verified
live: hidden/shown states, exact summary text, and the meals-empty-but-trained
case all confirmed in a real headless-Chromium pass against both apps.
**Reciprocal nav:** a persistent icon link each way in both standalone PWAs
(previously only a one-way, Rolodex-market-only cookbook icon existed on the
workout side; the cookbook had no workout-app link at all). Both new links use
the same `MARKET:STRIP`/`MARKET:ADD` pattern already established for the
existing one-way link — an absolute, personally-identifying URL in the
standalone build, swapped for a relative path when mounted in the Rolodex
market build (a separate white-label product) — verified by running the
*actual* market-build regex transform against both files (not just assumed
correct), confirming clean toggling and valid resulting markup/JS in both
directions. Docs: `quick-tour.html`/`quick-tour-overview.html` (workout) and
the cookbook's Quick Tour updated to mention the sister-app link and Today
strip additions per the documentation-currency rule.

**B2 — Workout → Cookbook (training informs meals)** (2026-07-15): The cookbook's
smart-planning features became training-aware, built on B0's `mc-bridge.js`.
**New bridge API:** `MCBridge.likelyTrainingDays()` — a real historical
weekday-training pattern derived from `mc_workout_log_v1` (≥3 sessions on a
weekday within a trailing 8-week window counts as a "likely training day"),
deliberately **not** a fabricated future schedule neither app tracks; returns
`{}` (no bias anywhere) until enough real history exists. **Smart Week
(`smw*`):** a new `smwTrainBias()` adds up to +21 score for high-protein
recipes on a likely training day, or up to ±8 toward a lighter (~650 kcal)
target on a likely rest day — verified live with a real 8-week Mon/Wed/Fri
training pattern seeded into the actual app: **78.7g avg protein on training
days vs. 34.6g on rest days** across 45 samples per day (15 full-grid
regenerations × 3 slots), confirmed via the real DOM and real `recipes-data.js`,
not a math-only test. **Macro Smart Generator (`msg*`):** the same pattern
bumps a likely-training day's protein *target* by +15g before the existing
greedy per-slot budget fit runs (smoke-verified: day-fit % stays sane, no
regression). **Also closes `ROADMAP.md` Pillar C's deferred macro-trend-bias
backlog for real** (not just by reference) — a new `macroTrendBias()` reads
`mc-cookbook:mealplan:macrohistory` (≥4 days of real data, trailing 14 days)
and adds +12g to the protein target when the trend is clearly under goal,
surfaced as a non-silent UI callout in the Smart Week overlay's Macro-Targeted
mode ("📈 Trending under on protein lately — meals biased +12g") — verified
live: absent with no history, present with real under-goal data. **Home
nudge:** the empty-plan hero's `emptyHeroCopy()` now checks real training
signal first — a specific line naming today's actual workout
(`"Legs today — plan meals that fuel the recovery..."`, sourced from the
bridged `mc_workout_log_v1`) when trained today, a streak-based line at ≥3
days, falling through unchanged to the existing generic time-of-day copy with
no signal — all 3 branches verified live. **Fused recap:** the "Past 7 Days"
card's `weeklyRecapStats()` gains `workoutsThisWeek` (rolling 7-day count from
the bridge), shown only when `mc_workout_log_v1` has ever been pulled at all
(so it never claims "0 workouts" to someone who's never linked the workout
app) — verified: absent when never-linked, correct count when linked and
active, and a genuine "0 workouts" shown when linked but truly inactive that
week. **A real cross-app sync gap was also caught and fixed along the way:**
consumer-store (`CONSUME`) pulls weren't arming the existing one-shot reload
(only owner-store pulls were), meaning a fresh sign-in wouldn't show freshly
pulled bridge data without a manual navigation — now any pulled-store change
(owned or consumed) arms the reload, in both repos' `mc-sync.js`, since B1/B2
gave consumer stores real rendered surfaces for the first time. **Also fixed
a genuine data bug from B0/B1**, caught before it shipped further: `mealSnapshot()`
and `mc-bridge.js`'s `perServingMacros()` fallback were reading the wrong macro
field names (`kcal/p/f/c` instead of `recipes-data.js`'s real
`calories/protein_g/fat_g/carbs_g`), which would have logged **zero** calories
for every real planned-meal log in production; both now normalize correctly,
verified against real recipe data and a corrected `test-mc-bridge.js` fixture
that actually exercises the raw-to-normalized conversion instead of masking it.
Docs: `quick-tour.html` and `quick-tour-overview.html` updated for the
training-aware Smart Week and the fused recap.

**B1 — Cookbook → Workout (meals inform training)** (2026-07-15): A "Today's
Planned Meals" card on `dashboard.html`'s Nutrition tab (`mc-macros.js`), built
on B0's `mc-bridge.js`. Shown only while viewing today (the bridge always
answers for the real calendar day, so a past/future `selKey` would mismatch).
**A real cross-app rendering gap surfaced and was fixed along the way:** the
workout app never loads `recipes-data.js`, so a bare `recipe_id` pulled from
the cookbook's plan had no title, icon, or macros to show. Fixed by having the
cookbook **denormalize a `{title,icon,macros}` snapshot directly onto each meal
entry** at write time (`cookbook-home.js`'s new `mealSnapshot()`, used by all
three meal-creation paths — `addMeal`, `commitSmartWeek`, and the plan-history
"Reuse" flow) — `macro_profiles` are per single serving and identical across
every authored tier, so the snapshot never goes stale even if a meal's serving
count changes later. `mc-bridge.js` now prefers this snapshot, falling back to
a live `window.RECIPES` lookup for any pre-existing legacy plan entries (still
byte-identical across both repos). **Logging:** tapping **Log** on a meal
writes a normal entry into the shared `mc_macros_v1` (never back into the
cookbook-owned `mc-cookbook:mealplan` — the meal's `completed` flag there is
untouched), tagged `planUid` so the row flips to a disabled "✓ Logged" state
and can't double-log; a toast **Undo** removes that specific entry. **Plan-vs-
target:** a summary line totals planned kcal/protein against the day's targets
from the already-shared `mc_macros_v1.goals` (the roadmap's original draft
referenced `mc_plan_targets_v1` for this — corrected here to match B0's actual
contract). **Empty/signed-out states** reuse the shared `.empty-state`
vocabulary with distinct copy for "no plan today" vs. "not signed in."
**A real script-order bug was caught by live verification, not left to be
found later:** `mc-bridge.js` loaded near `mc-sync.js`, well after
`mc-macros.js` had already run its first `render()` — so `window.MCBridge`
was undefined at first paint. Fixed by loading `mc-bridge.js` immediately
before `mc-macros.js` instead (it has no dependency on `mc-sync`/`mc-supabase`
being loaded first) and removing the now-duplicate later `<script>` tag.
**Verify:** `tools/test-mc-bridge.js` extended to 21 assertions (denormalized-
snapshot-preferred path + legacy-fallback path); a live headless-Chromium pass
drove the actual `dashboard.html` end-to-end — signed-out empty copy, seeded
plan rendering, the plan-vs-target line, one-tap logging updating the shared
macro totals live, the cookbook's plan store confirmed untouched
(`completed` flags stay `false`), and Undo cleanly reversing the log — all
green with zero real console/page errors. `sw.js` bumped (workout + cookbook).
Docs: `quick-tour.html` (new step + tip sentence) and
`quick-tour-overview.html` (new bullet) updated per the documentation-currency
rule; no cookbook-side Quick Tour change needed (the snapshot addition is
purely internal — no cookbook UI changed).

**B0 — Bridge foundation & data contract** (2026-07-15): Laid the plumbing and
settled the contract against the real code. **Sync whitelists:** both
`mc-sync.js` files gained a `CONSUME` map of pull-only stores, pulled into local
`localStorage` and merged `replace` (owner authoritative) but never pushed —
`push()` still iterates owned `STORES` only, so no store gets a second writer.
Workout consumes `mc-cookbook:mealplan`; cookbook consumes `mc_activity` +
`mc_workout_log_v1`. **`mc-bridge.js`:** a new, byte-identical shared read module
in both repos (`todaysMeals` / `todaysWorkout` / `macroTargets` /
`recentActivity` / `today`) that reads `localStorage` only and enriches meals
from `window.RECIPES` where it's loaded (the cookbook), returning bare refs
elsewhere (the workout dashboard). Wired into `dashboard.html` (workout) and
`index.html` (cookbook) and both SW precaches (workout `v141`, cookbook `v20`).
**Two contract corrections vs. the first-draft map:** (1) macro targets live in
the already-shared `mc_macros_v1.goals`, so `mc_plan_targets_v1` (workout *load*
carry-forward, not nutrition) is **not** bridged; (2) `mc-cookbook:cooked` /
`:macrohistory` stay cookbook-internal (the recap reads them locally), so
they're not cross-consumed — each side pulls only what it renders. **Verify:**
`tools/test-mc-bridge.js` (18 assertions — both directions, enrichment,
signed-out degradation) green; `node --check` on all touched JS,
`build-sw.py --check` (both repos), and `build-market.py --check` (leak-clean)
all pass. Signed-out behavior is unchanged — the bridge is a no-op with no
cross-app keys present.
