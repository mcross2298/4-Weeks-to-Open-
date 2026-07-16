# MC Training — Launch Roadmap (governing plan)

Status: **ACTIVE — L0/L1/L3/L4 complete, L2 code-complete (owner acceptance pending), L5/L6 not started**
Approved: 2026-07-12 (executive summary approved by owner)
Goal: drive the app from its current state to a **finished, launch-ready
product** — an installable PWA with a commercial layer.

> **Companion plan:** [`cookbook-bridge-roadmap.md`](cookbook-bridge-roadmap.md)
> (approved 2026-07-15) governs the *cross-app* work — the two-way data bridge
> between this app and Mike's Cookbook, toward a **joint launch as two linked
> PWAs**. It runs alongside this roadmap; its final phase (B5, joint launch
> hardening) folds into **L6** below, so the Definition of Done means **both
> apps launched together**, not this app alone.

> **This is the governing development plan.** It supersedes (but links, and
> does not duplicate) the open threads in:
> - `council-roadmap-status.md` — Phases 0–3 shipped; Phase 3.5 deferred;
>   Phase 4 scoped-not-started (items promoted into L4 below).
> - `pm-improvement-roadmap.md` — owner-only PM-mode backlog (independent
>   track; not launch-gating unless noted).
> - `CLAUDE.md` § Active Development Plan (`workout_cookbook_dev_plan_v2`) —
>   complete except two closeout items, absorbed into L0 below.

## Locked decisions (owner, session 2026-07-12)

- **Launch definition:** installable mobile PWA **and** paid/commercial
  product. Not date-gated — launch happens when the Definition of Done (L6)
  is met, however long that takes.
- **First-class priority areas:** UI/UX & visual design · mobile experience ·
  onboarding & ease of use · new functionality. All four get a dedicated
  phase; none is best-effort.
- **Process:** phases execute in order L0 → L6. Each phase gets its own
  executive summary + explicit approval before any code is written
  (CLAUDE.md planning rule), and an AskUserQuestion phase gate before the
  next phase starts. This document is updated (status + shipped notes) as
  each phase lands.
- **Workflow invariants:** all work in `4-Weeks-to-Open-` (master); never
  push to `MC-Training-Rolodex` (generated build, auto-deployed on merge to
  main). Local gates before every PR: `node --check` all touched JS ·
  `tools/test-mc-suggest.js` · `tools/test-mc-maxout.js` ·
  `tools/test-naming.js` · `tools/check-program-colors.js` ·
  `tools/validate-programs.js` · `python3 tools/build-market.py --check` ·
  `python3 tools/build-sw.py --check` (bump SW version when assets change).

---

## Phase L0 — Debt closeout & audit baseline

**Goal:** enter the improvement phases with zero known loose ends and a
concrete, page-by-page findings list so L1–L3 fix *observed* problems, not
guessed ones.

Tasks:
1. **Close dev-plan-v2 Task 3.2** — re-verify `mc-replace.js` swap
   confirmation and whether `mc-live-tracker.js` reads from the
   `mc_daily_v1` store vs. the DOM; fix whichever is stale.
2. **Retire `exercisedata.json`** — confirm nothing still reads the legacy
   904-record dataset (superseded by `exercise-catalog.js`), then remove it
   from the tree, `content-manifest.json`, and the SW precache.
3. **`serviceWorker` truthiness sweep** — `mc-push.js:30` still uses the
   truthy-vs-`'serviceWorker' in navigator` pattern that bit
   `mc-sw-update.js`/`exercise-library.html`; sweep the whole repo.
4. **Full UX/design audit** — walk every user-facing page (dashboard tabs,
   every program landing + day page family, tools like max-out/stats/wrapped,
   quick tour) on a phone-sized viewport; log findings per page under the
   four priority areas. Deliverable: `launch-audit-findings.md` (feeds L1–L3
   task lists).
5. **Widen the regression net** — extend `tools/smoke-test-pages.js` beyond
   its current 18-page sample toward the full user-facing page list, so the
   later phases refactor against a real safety net.

Exit criteria: Task 3.2 verified closed · `exercisedata.json` gone from
master and Rolodex build · sweep clean · audit findings doc merged · smoke
test covers all page families.

## Phase L1 — UI/UX & design-system unification

**Goal:** the app reads as one designed product on every page — same tokens,
type, spacing, and states everywhere.

Tasks (to be finalized from the L0 audit):
1. **One token system** — reconcile `base.css` with the `onyx-*` token/style
   sheets; every page consumes shared tokens, no per-page drift.
   **✅ shipped** — the dashboard's inline Onyx `#scr-*` type now references the
   shared `--fs-*` scale on every clean match; see closed ticket below.
2. **Finish the Sand light-mode rollout fleet-wide** — Phase 7 batches have
   covered MC, Kitchen Sink, Strength & Supersets, PMC, Modality Matrix;
   complete the remaining program families and shared surfaces so light mode
   is a first-class theme, not a partial one. **✅ shipped** — Phase A title
   contrast (PR #197) + the L1.5 Sand-completeness sweep of every bespoke
   tool-page dark card (PR #200), both via the shared `mc-light.css`.
3. **Typography & spacing pass** — consistent scale, weights, and rhythm
   across dashboard, program pages, and tools. **✅ shipped (PR #198)** —
   `--fs-*` / `--fw-*` / `--sp-*` scale in `base.css`, adopted on the shared
   hierarchy (reaches all day pages) + tool page titles consolidated.
4. **Empty/loading/error states** — every list, chart, and sheet has a
   designed empty state (no blank panels), consistent with the
   `showEmpty()` pattern already in `mc-macros.js`. **✅ shipped (PR #199)** —
   shared `.empty-state` vocabulary in `base.css`; the three drifting variants
   (collections, exercise-library, stats) converged onto it.
5. **Motion & transition polish** — consistent card/sheet/tab transitions;
   respect `prefers-reduced-motion`. **✅ shipped (PR #199)** — global
   `@media (prefers-reduced-motion: reduce)` guard in `base.css`.

Exit criteria: token audit shows zero hardcoded one-off colors on shared
surfaces · Sand mode complete on all user-facing pages · audit-list UI items
for this phase closed.
**✅ All met (2026-07-14) — Phase L1 complete.**

### Locked decisions (owner, AskUserQuestion alignment, 2026-07-14)

- **Status-board correction:** before scoping this phase, found all 5 tasks
  above already marked shipped in this doc (PRs #197–#200 + the onyx-
  reconciliation commit, all verified as merged to `main`), while the status
  board still said "🔲 Not started" — a stale-bookkeeping gap, same pattern
  as L4's Phase-4 discovery. Owner chose a quick verification pass over the
  exit criteria (rather than blindly flipping the status board, or a full
  fresh re-audit of the whole app) before declaring the phase closed.
- **Verification found a real, live gap:** a token audit of `base.css` found
  `--success`/`--danger` are identical hex in both themes (hardcoding them
  page-side is a harmless hygiene nit, not a bug), but `--muted` changes for
  Sand mode (`#64748b` → `#6b6459`) and **57 pages** linking `mc-light.css`
  still hardcoded the literal dark-mode `#64748b` instead of `var(--muted)`
  — meaning secondary/meta text rendered in the wrong color in Sand mode on
  those pages, undermining PR #200's "Sand mode complete" claim. Owner chose
  to fix this now (mechanical, zero-risk swap) rather than log-and-defer.

### L1.6 — muted-text Sand-mode fix (2026-07-14)

Swapped all 191 raw `#64748b` occurrences across the 57 affected pages to
`var(--muted)`. Zero visual change in dark mode (`--muted` is already
`#64748b` there); Sand mode now correctly renders `#6b6459` instead of the
stale dark-mode gray. Verified with a live headless-Chromium screenshot pass
of `2on-1off.html` in both themes — clean, no regressions. `sw.js` bumped
v137→v138 for the asset change. `--success`/`--danger` hardcoding left as-is
(identical value in both themes — no live bug, pure hygiene, not worth the
churn).

### Open ticket — L1 task 1: base.css ↔ dashboard onyx token reconciliation

> **Status: CLOSED** (logged 2026-07-13; resolved 2026-07-13).
> Originally to be filed as a GitHub issue — recorded here instead because
> the GitHub connection was unavailable at logging time.

`dashboard.html` runs a **layered onyx type system**. Its `#scr-*`-scoped rules
**win by ID specificity** over the base component classes and carry their own
font stack (`--font-display` Archivo / `--font-ui` Manrope) plus hardcoded pixel
sizes, so the L1 Phase B `--fs-*` scale did **not** previously reach the
dashboard. This was left alone deliberately — it's a design decision, not a
mechanical swap, and a blind refactor risks the intentional dashboard look.

**Finding (correction to the original note):** the three `onyx-*-tokens-and-styles.css`
files are **paste-ready handoff artifacts that no HTML page `<link>`s** (they're
only precached by `sw.js` / listed in `content-manifest.json`). The Onyx styling
that actually renders lives **inline in `dashboard.html`'s `<style>` block** — so
that inline block was the real reconciliation target, not the standalone sheets.

**Resolution:** the inline Onyx `#scr-*` type now references the shared `--fs-*`
scale on every exact match (124 declarations tokenized, **zero pixel change** —
`--fs-*` has a single definition in `base.css` and is not overridden in Sand
mode, so both dark and Sand render identically). No `--o-*` / `--font-display` /
`--font-ui` name collisions with `base.css` (confirmed). The fractional /
between-step / glyph-only sizes (8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 15.5, 16.5,
17, 19, 22, 23, 26, 28px) were **kept bespoke and documented as intentional
exceptions** (comment block at the top of the `<style>`), rather than snapped —
snapping would visibly shift the Onyx layout on the exact `#scr-*` screens the
acceptance says must not regress. The unreferenced `onyx-*.css` handoff files are
a separate dead-file cleanup candidate (out of scope here).

**Approach when picked up:**
1. Map the exact-match sizes onto the scale (zero pixel change): 18→`--fs-2xl`,
   20→`--fs-3xl`, 16→`--fs-xl`, 15→`--fs-lg`, 14→`--fs-md`, 13→`--fs-sm`,
   12→`--fs-xs`, 11→`--fs-2xs`, 24→`--fs-title`, 30→`--fs-hero`.
2. Surface the fractional / oddball sizes (13.5, 15.5, 19, 23px) for an
   explicit decision — snap to nearest step (e.g. 23→24, 19→20) or keep as an
   intentional bespoke value — rather than silently normalizing.
3. Confirm no `--o-*` token-name collisions with `base.css`; keep
   `--font-display` / `--font-ui` as the dashboard's fonts.

**Acceptance:** dashboard type references the shared scale wherever a clean
match exists; oddballs snapped-with-signoff or documented as exceptions; no
visual regression on any `#scr-*` screen (dashboard / programs / conditioning /
nutrition) in dark **and** Sand mode.

## Phase L2 — Mobile experience & PWA installability

**Goal:** installs cleanly on iOS and Android, feels app-like, works
one-handed in a gym, and works offline where it matters.

Tasks:
1. **Real icon set** — `manifest.json` currently ships a single SVG
   (`icon.svg`), which iOS ignores: add PNG 192/512 + maskable variants,
   `apple-touch-icon`, and manifest `screenshots` for install sheets.
2. **Service-worker strategy tune-up** — `sw.js` (v125) precaches the entire
   tree, including the four `*.dc.html` design comps and non-user files;
   teach `tools/build-sw.py` an exclusion list, and define what must work
   offline (active program pages, logging, timers) vs. network-first
   (macros API, sync).
3. **Install-prompt UX** — in-app "Add to Home Screen" moment (Android
   `beforeinstallprompt`, iOS instruction sheet), surfaced from onboarding
   and settings, never nagging.
4. **iOS standalone quirks pass** — safe-area insets, status-bar/theme
   color, no 300ms-tap or rubber-band artifacts, `standalone` navigation
   (no dead ends without browser chrome).
5. **Gym-floor ergonomics** — touch-target minimums (44px), thumb-zone
   placement for the highest-frequency actions (log set, rest timer, next
   exercise), sweat-proof big-tap variants where the audit flags them.
6. **Performance budget** — Lighthouse PWA + performance baseline recorded
   now, budget enforced in L6.

Exit criteria: Lighthouse PWA installability checks pass · install verified
on a real iPhone and Android device · core workout flow fully usable offline
· audit-list mobile items closed.

## Phase L3 — Onboarding & ease of use

**Goal:** a brand-new trainee reaches their first logged set in minimal
taps, and every major feature is discoverable without being told.

### Locked decisions (owner, AskUserQuestion alignment, 2026-07-14)

- **L2 gate:** L2 code is complete; its owner-acceptance items (real-device
  install check, real Lighthouse run) stay open as a tracked follow-up and do
  **not** block starting L3.
- **First-run experience (Task 1):** skippable guided path — pick a program →
  see this week → start Day 1, with a visible "Skip" at every step.
- **Taps-to-first-workout target (Task 3):** keep ≤3 taps from open to the
  Day-1 exercise list, as originally scoped.
- **Feature discoverability (Task 4):** add contextual entry points for all
  five buried features this phase — substitute picker, conditioning corner,
  macros, max-out, wrapped.
- **Day-1 hand-off scope (mid-Phase-1 gate, 2026-07-14):** the guided flow's
  final step ends at the chosen program's own landing page (today's
  hero-tap target), not literally inside its Day-1 exercise list — each
  `cat-*.html` runs its own bespoke split/day view logic with no shared
  engine to hook into from `dashboard.html` alone. Reaching the *program
  page* in ≤3 taps (verified: 2 taps — pick a card, then "Start Day 1") is
  Phase 1's scope; a generic per-program auto-start hook that lands
  literally on the Day-1 exercise list was explicitly descoped to keep
  Phase 1 to `dashboard.html` + one new file, not all 10 program pages.

Tasks:
1. **First-run experience** — detect first visit; short guided path:
   pick a program → see this week → start Day 1. No wall of choices.
   **✅ shipped (Phase 1)** — `mc-onboarding.js` + `dashboard.html`, skippable,
   gated on no onboarding flag and no pinned program.
2. **Quick-tour refresh** — bring `quick-tour.html` /
   `quick-tour-overview.html` current with everything shipped since they
   were written (documentation-currency rule says they must track features;
   verify they actually do), and make the tour reachable from onboarding.
   **✅ shipped (Phase 4)** — stale flagship roster and program count fixed;
   Max-Out and Wrapped documented for the first time. Already reachable from
   onboarding via the dashboard's Training Tools grid (pre-existing).
3. **Taps-to-first-workout metric** — count today's path, set a target
   (≤3 taps from open to Day-1 exercise list), and redesign the home/
   dashboard entry flow to hit it.
   **✅ shipped (Phase 1)** — baseline measured at ~6 taps; new guided flow
   hits 2 taps to the program's landing page (see mid-phase scope note above
   for why "page" rather than "exercise list").
4. **Feature discoverability** — the audit will flag buried features
   (substitute picker, conditioning corner, macros, max-out, wrapped);
   add contextual entry points instead of relying on the tour.
   **✅ shipped (Phase 2)** — Nutrition added to the shared nav bar; Max-Out
   and Wrapped added to the dashboard's Training Tools grid. Substitute
   picker and Conditioning Corner verified already well-discoverable.
5. **Program guide clarity** — `program-guide.html` as the "which program is
   for me" front door, with plain-language descriptions per program.
   **✅ shipped (Phase 3)** — `forWho` field added per program, rendered as a
   "Best for:" line on every guide card.

Exit criteria: first-run flow ships · taps target met · tours verified
current against the live feature set · audit-list onboarding items closed.
**✅ All met (2026-07-14) — Phase L3 complete.**

## Phase L4 — Functionality completion

**Goal:** the feature set is *complete* for launch — nothing a paying user
would immediately ask "where is…?" about.

### Locked decisions (owner, AskUserQuestion alignment, 2026-07-14)

- **Council items 4.1–4.7 re-scope:** before drafting this phase's plan, a
  git-log/grep check found all seven promoted council Phase-4 items
  already merged to `main` under `roadmap 4.x`-tagged commits (structured
  coach-claude chips, NL food logging, LLM substitution fallback, voice
  control, PM client roster, automated weekly check-ins, unified
  market/cookbook) — contradicting this doc's and
  `council-roadmap-status.md`'s "not started"/"unverified" framing. Owner
  decided: take the commit history at face value rather than re-auditing
  each feature live; mark them shipped and close finding F2.
- **F1 (Progress/history unification) approach:** light hub, not a full
  merge/refactor — `stats.html` already functions as the single nav entry
  point (bottom nav + dashboard's History tab both route here) and already
  links out to Wrapped and Max-Out; the only missing link is Workout Logs,
  so F1 closes by adding that one card rather than consolidating
  `mc-stats.js`/`mc-exercise-trends.js`/`mc-chart.js`/`mc-wrapped.js` into a
  single page.
- **F4 (resume-workout affordance):** confirmed adequate as-is
  (`dashboard.html`'s `heroNextLift()` computes a live in-progress-workout
  resume target on the hero card; `mc-resume.js` covers the program
  pages) — closed with no new UI work, same pattern as F3 in L0.

Tasks:
1. **Unify progress & history (F1).** **✅ shipped** — `stats.html` gains a
   "Workout History" link card (same pattern as the existing "MC Wrapped"
   card) pointing to `workout-logs.html`. PRs/trends/volume/consistency
   already lived on this page; this closes the one missing cross-link so
   history, PRs, trends, volume, and Wrapped are all one hop from the Stats
   hub.
2. **Promoted council Phase-4 items (F2).** **✅ closed — already shipped,
   pre-dating this phase.** Verified via `git log`/`grep` for `roadmap 4.x`
   commit tags and in-code comments, all merged to `main`:
   - **4.1** Structured coach-claude report — `coach-claude` edge function
     returns `{summary, flags[], volumeWarnings[], swaps[]}`; rendered as
     chips by `dashboard.html`'s `renderCoachReport()`/`loadCoachNote()`.
   - **4.2** Natural-language food logging — `mc-foodapi.js`'s parse
     function, wired into `mc-macros.js`'s describe flow.
   - **4.3** LLM substitution fallback — `coach-substitute` edge function,
     called from `mc-card-actions.js` when `mc-biomech.js` returns <3
     alternatives.
   - **4.4** Voice control — `mc-voice.js`, opt-in `SpeechRecognition` for
     gym pages.
   - **4.5** Client roster in PM Mode — `pm_clients` table
     (`mc-supabase.js`), roster UI in `program-manager.js`, assignment
     banner in `dashboard.html`.
   - **4.6** Automated weekly check-ins — `supabase/functions/weekly-checkin`
     + `mc-push.js` push delivery.
   - **4.7** Unified market — Mikes-Cookbook merged into the Rolodex build
     via `build-market.py`'s existing strip/leak-scan machinery.
3. **Audit-driven gaps (F4).** **✅ closed — confirmed adequate, no action.**
   See locked decision above.
4. **Explicitly NOT in scope:** council Phase 3.5 (the `mc-s*`/`pmc-s*`
   data-drive refactor) stays deferred — it's internal code health, not
   launch-gating; and PM-mode backlog items ride their own roadmap.

Exit criteria: Progress area shipped · promoted items shipped or explicitly
descoped by owner decision · no open "table-stakes" findings from L0.
**✅ All met (2026-07-14) — Phase L4 complete.**

## Phase L5 — Commercial layer

**Goal:** the app can take money and gate content, legally and safely, on a
static GitHub Pages host.

> ⚠️ **Architecture spike required first.** Payments on a static host means
> the trust boundary lives in Supabase (edge functions + RLS), not the
> pages. The spike must settle: payment provider (Stripe Checkout is the
> likely fit — redirect flow, no PCI surface, webhooks into an edge
> function), what exactly is gated (programs? PM features? the whole app?),
> and how entitlements map onto the existing Supabase auth
> (`mc-account.js`, `mc-supabase.js`, RLS patterns). No commitment until the
> spike's exec summary is approved.

Tasks:
1. **Entitlement model** — Supabase table + RLS: user → plan → gated
   content; client reads entitlements, server enforces them (client-side
   gating alone is cosmetic, and the code is public — the *data*, e.g.
   premium program content, must be what's protected).
2. **Payment integration** — provider checkout + webhook edge function
   writing entitlements; test-mode end-to-end before anything real.
3. **Gated-content UX** — locked-state cards, upgrade sheet, restore
   purchase / manage subscription path.
4. **Legal & trust pages** — privacy policy, terms of service, refund
   policy; linked from onboarding and the account sheet.
5. **Public landing page** — the marketing front door (`index.html` today
   goes straight to the app); what the product is, screenshots, install
   instructions, pricing.
6. **Rolodex interplay** — decide what the free public Rolodex build is
   post-launch (demo tier? separate free app?); `build-market.py` already
   provides the strip/leak-scan machinery.

Exit criteria: test-mode purchase → entitlement → gated content unlock works
end-to-end · legal pages live · landing page live · Rolodex positioning
decided and documented.

## Phase L6 — Launch hardening (Definition of Done)

**Goal:** the final gate. When every box below is checked, the product is
launched.

Tasks & checklist:
1. **Cross-device QA matrix** — iOS Safari (installed + browser), Android
   Chrome (installed + browser), small/large phones, tablet, desktop; every
   core flow (install → onboard → run a full workout → log → sync → check
   progress → purchase) passes on each.
2. **Performance budget enforced** — Lighthouse: Performance ≥ 90 on
   dashboard + a day page over mid-tier mobile throttling; PWA checks green.
3. **Accessibility pass** — keyboard/focus order, contrast (build on the
   Phase 0 a11y floor), screen-reader labels on the workout logging flow,
   `prefers-reduced-motion` honored.
4. **Regression net final** — smoke test covers all page families (from
   L0.5), all local gates green in CI, SW version bumped and update flow
   (`mc-sw-update.js`) verified on-device.
5. **Data safety** — export/import verified, Supabase backups confirmed,
   sync-conflict behavior sanity-checked.
6. **Docs current** — quick tours, program guides, and instructions pages
   verified against the shipped feature set (documentation-currency rule).
7. **Launch checklist review** — owner walk-through of this list; anything
   unchecked either gets fixed or gets an explicit owner waiver noted here.

8. **Joint-launch gate** — `cookbook-bridge-roadmap.md`'s Phase B5 (cross-app
   QA matrix, sync-conflict/offline, bridge data-safety) passes or is waived.
   Launch is a **suite** launch: this list *and* B5 must both be green.
   **Status (2026-07-16):** B5's session-verifiable work is done — real
   sync-conflict merge tests now CI-gated in both repos (previously untested
   in CI at all), a full cross-app QA loop verified headlessly end-to-end,
   offline/SW behavior verified live where the environment allows it, and a
   real CI gap closed (the cookbook repo had no regression coverage at all
   for its own copy of `mc-bridge.js`). **Not yet closed:** the real-device QA
   matrix (iOS Safari, Android Chrome, installed-PWA mode) and confirming
   actual Supabase reconciliation across two signed-in physical devices —
   neither is simulable from this environment and both need the owner. See
   `cookbook-bridge-roadmap.md`'s B5 section for the full breakdown.

Exit criteria: **every item above (including the B5 joint-launch gate) checked
or explicitly waived by the owner in writing in this document. That is the
definition of "finished product" — both apps launched together.**

---

## Status board

| Phase | Theme | Status |
|-------|-------|--------|
| L0 | Debt closeout & audit baseline | ✅ Complete |
| L1 | UI/UX & design-system unification | ✅ Complete |
| L2 | Mobile experience & PWA installability | 🔄 In progress (code complete, owner acceptance pending) |
| L3 | Onboarding & ease of use | ✅ Complete |
| L4 | Functionality completion | ✅ Complete |
| L5 | Commercial layer | 🔲 Not started |
| L6 | Launch hardening (Definition of Done) | 🔲 Not started |

Update this table (and append a short "shipped" note under the phase) as
each phase merges. Statuses: 🔲 Not started · 🔄 In progress · ✅ Complete ·
⏸ Waived/deferred (owner decision, link it).

### Shipped notes

**L1 — UI/UX & design-system unification** (2026-07-14): Closed out a phase
whose 5 tasks had already shipped across earlier PRs (#197–#200 + the onyx
token-reconciliation commit) but whose status board and exit criteria were
never checked off — a verification pass (rather than a blind doc flip)
turned up one real, live gap: 191 raw `#64748b` hardcodes across 57
Sand-mode pages that didn't respect the theme's muted-text override. Fixed
mechanically (`#64748b` → `var(--muted)`, zero dark-mode visual change,
verified live in both themes via headless Chromium). `--success`/`--danger`
hardcodes left alone — identical value in both themes, no live bug. `sw.js`
bumped v137→v138. This closes out L1: exit criteria genuinely met, not just
marked.

**L4 — Functionality completion** (2026-07-14): Closed all three exit-criteria
items. **F1:** added a "Workout History" link card to `stats.html` (mirrors the
existing "MC Wrapped" card) pointing at `workout-logs.html` — the Stats page
was already the de facto Progress hub (single nav entry point, already linking
to Wrapped and Max-Out with PRs/trends/volume/consistency sections built in),
so this closes the one real gap rather than requiring a page merge. **F2:**
discovered — via `git log`/grep for `roadmap 4.x` commit tags — that all seven
promoted council Phase-4 items (4.1 structured coach-claude chips, 4.2 NL food
logging, 4.3 LLM substitution fallback, 4.4 voice control, 4.5 PM client
roster, 4.6 automated weekly check-ins, 4.7 unified market/cookbook) were
already merged to `main`, contradicting this doc's and
`council-roadmap-status.md`'s stale "not started"/"unverified" status; both
docs corrected. **F4:** confirmed `dashboard.html`'s `heroNextLift()` +
`mc-resume.js` already provide an adequate live resume-workout affordance —
closed with no new UI. `sw.js` bumped v136→v137 for the `stats.html` change.
This closes out L4: exit criteria met, no open table-stakes findings from L0.

**L3 Phase 4 — quick-tour refresh** (2026-07-14) — Phase L3 complete: Both
`quick-tour.html` and `quick-tour-overview.html` described a flagship roster
that no longer exists ("Best of Both Worlds," "Iron & Engine") and omitted
three real programs (Everything Under the Kitchen Sink, The Modality Matrix,
High-Volume Training Template), plus a wrong program count (claimed 9/7,
actually 10) and a stale "18 workouts" figure for Mike Cross' Favorite
Splits — all corrected in the welcome slide, Module 3's narration, and the
overview's hero/programs section. Max-Out Calculator and MC Wrapped, absent
from both files, are now documented alongside Workout Logs/rep progression
(overview's logging-engine section) and in the guided tour's Module 7 —
both already reachable from onboarding via the pre-existing dashboard
Training Tools grid, so no separate "reachable from onboarding" wiring was
needed beyond Phase 2's entry-point work. This closes out L3: all 5 tasks
shipped, exit criteria met.

**L3 Phase 3 — program-guide clarity** (2026-07-14): Added a `forWho` field to
every program in `mc-pm-data.js` (6 flagship + 4 influencer) — a short
plain-language "who is this for" line, additive to the existing marketing
`desc`. `program-guide.html` renders it as a "Best for:" line on each card,
turning the guide from a pure router (icon + name + marketing tagline) into
an actual decision aid. Also fixed the hero subtitle's hardcoded "all 7
programs," which had drifted from the real 10-program roster — it now counts
the rendered list at runtime, the same pattern the dashboard's `.topbar-sub`
already uses, so it can't drift again.

**L3 Phase 2 — feature discoverability** (2026-07-14): Added Nutrition to the
shared `mc-nav.js` bottom-nav bar (🍎, deep-links `dashboard.html?tab=nutrition`,
already handled generically by the existing `?tab=` reader) — it was previously
dashboard-only, missing from the bar every other page injects. Added Max-Out
Calculator and MC Wrapped as two new `.tool-card` entries in the dashboard's
existing "Training Tools" grid — each previously had exactly one inbound link
in the whole app (`stats.html`, 2 taps deep); now 1 tap from Home, same pattern
as the other five tool cards. Verified substitute picker and Conditioning
Corner need no new work — `launch-audit-findings.md`'s O5 evidence line
("substitute picker lives behind the ⋮ menu") was itself stale: Replace is a
one-tap button on the card face, and Conditioning is already a bottom-nav tab.
O5 marked closed with a correction note.

**L3 Phase 1 — first-run flow & tap-count redesign** (2026-07-14): New
`mc-onboarding.js` shows a skippable 2-step sheet ("Pick your program" →
"This week" summary + "Start Day 1") the first time `dashboard.html` loads
with no `mc_onboarded` flag and no pinned `mc_active_prog` — gated on both,
so it never re-shows to a returning user and auto-marks itself done for
any user who already had a program pinned before this shipped (no forced
re-onboarding). Reuses the existing `.ps-*` Program Select sheet styling
(no new visual language) plus a new `startOnboardProgram(id)` hook in
`dashboard.html` that pins the chosen program and navigates straight to it
in one step — collapsing the old pick→confirm→hero-tap sequence. Verified
via a real headless-Chromium run (4 scenarios: new user, reload-after-
onboarding, skip, pre-existing user) — new-user path is **2 taps** (pick a
program card, tap "Start Day 1") to the program's landing page, down from
~6 for the previous cold-start path through the empty hero card. Per the
mid-phase gate above, this lands on the program page, not literally the
Day-1 exercise list — a generic per-program auto-start hook was descoped
to keep this phase to 2 files. `sw.js` bumped v132→v133 for the new asset;
`test-naming.js`, `check-program-colors.js`, `validate-programs.js`,
`test-mc-suggest.js`, `test-mc-maxout.js`, `build-market.py --check`, and
`build-sw.py --check` all green.

**L2 Sub-Phase B — app-feel, offline strategy & ergonomics** (2026-07-14):
Closed M6–M8 and the remaining roadmap tasks. **SW payload (M6/M7):** the
`.dc.html` design comps were already excluded from precache (confirmed —
`DENY_SUFFIXES` in `build-sw.py` already handled it, so M7 needed no change).
The real M6 fix was an eager/lazy split in `collect_urls()`: install-time
precache now covers only the app shell (`index.html`, `dashboard.html`, and
every shared JS/CSS/manifest/icon) — **243 → 106 URLs, 4.46MB → 1.84MB**. The
~137 remaining program/day/tool pages are no longer front-loaded, but nothing
loses offline support once opened: `sw.js`'s fetch handler was already
network-first-with-cache-fallback for every request regardless of precache
membership, so a page is cached the instant it's visited, same as before.
Bumped SW `v130→v131`. **Install UX:** new `mc-install.js` captures
`beforeinstallprompt` at dashboard load (it fires once per session and only
reaches a listener already attached) and exposes `MC_INSTALL` for
`mc-account.js`'s new Install section (`appendInstallSection`, following the
existing Appearance/Backup pattern) — native one-tap install on Android,
numbered Share→Add to Home Screen steps on iOS, an "Already installed" state
via the same `display-mode: standalone` check `mc-nav.js` uses. Also fixed an
unrelated pre-existing bug noticed in passing: `dashboard.html`'s
`apple-touch-icon` link pointed at `icon-192.png` (dead until Sub-Phase A
created that file, and inconsistent with the `apple-touch-icon.png` every
other page now links) — repointed to match. **Touch targets (M8):** checking
every gym-critical control found `.mcl-ck` (set-log check) already at 44px
with a documented comment, and `.mc-meatball` deliberately kept at 36px
(documented crowding reason) — left alone. The two real gaps were
`.timer-float-btn` (rest-timer Skip/Reset, ~35px) and `.timer-preset`
(15s/30s/60s/2min, ~30px); both bumped to 44px min-height, verified with a
live headless-Chromium screenshot of the running rest timer on a current-gen
program page (`mc-s1-back.html`) — clean fit, no clipping. **Perf budget:**
Lighthouse itself can't run in this container (no throttled real device, no
CDP-to-Lighthouse bridge this sandbox exposes) — captured a CPU-throttled
(4×) + network-shaped (150ms/1.6Mbps) headless-Chromium timing pass instead as
a **rough, non-Lighthouse directional baseline**: dashboard.html FCP ≈2.4s,
program-page (`mc-s1-back.html`) FCP ≈3.2s, both with this sandbox's external
font fetch excluded (blocking it dropped dashboard's number from 13.2s to
2.4s, showing this container's own network path skews raw numbers too much to
trust in absolute terms). **A real Lighthouse run stays an owner acceptance
item**, alongside Sub-Phase A's on-device install check — L2's code-side work
is complete; the roadmap's Lighthouse + real-device exit criteria remain open
until the owner runs them. Docs: `quick-tour.html`/`quick-tour-overview.html`
updated to point at the new account-sheet Install section.

**L2 Sub-Phase A — installability blockers** (2026-07-13, in progress): Closed
the four 🔴 findings (M1–M4). Generated a real raster icon set from `icon.svg`
(`icon-192/512.png` + `-maskable` variants + `apple-touch-icon.png`, rendered
via headless Chromium) and wired them into `manifest.json` and the SW precache
(`build-sw.py` INCLUDE_FILES). Added `tools/add-pwa-meta.py` — an idempotent
head sweep that propagated `viewport-fit=cover` + the `apple-mobile-web-app-*`
metas + the `apple-touch-icon` link across all 144 pages (now 144/144; doubles
as the coverage gate via `--check`). Added real `env(safe-area-inset-*)`
handling to `base.css` for the shared program-page furniture (`.header`,
`.back-link`, `.hero`, `.week-tabs`, fixed top banners, floating rest timer,
FW modal) — targeted, not a global `body` pad, so the dashboard's own Onyx
`.topbar`/`.mc-nav` insets can't double up. Bumped `base.css?v=66→67`
fleet-wide and SW `v129→v130`. All local gates green (`build-sw --check`,
`build-market --check` leak-clean, program/naming/suggest/maxout tests, plus a
headless-Chromium render smoke of a page-family sample). **Owner acceptance
items (can't run in CI):** install on a real iPhone + Android and confirm
icon/standalone/safe-area; capture the Lighthouse PWA baseline. Sub-Phase B
(SW offline strategy, install-prompt UX, gym ergonomics, perf budget) is the
next gated slice; `screenshots: []` (M5) deferred to it once L1 visuals settle.

**L0 — Debt closeout & audit baseline** (2026-07-13): Fixed the last
`navigator.serviceWorker` truthy check (`exercise-library.html`); verified
Task 3.2 closed (swap flow coherent, live tracker reads `mc_setlog_v1`+DOM —
no fix needed) and `exercisedata.json` fully retired; bumped SW cache
v125→v126. Produced [`launch-audit-findings.md`](launch-audit-findings.md) —
a grounded page-family audit feeding L1–L5, with two 🔴 clusters (PWA
installability/safe-area → L2, and the absent first-run experience → L3)
anchoring the next phases. Widened `tools/smoke-test-pages.js` from 18 to 33
pages across all distinct render families. Scratch-listed the planning docs
so they never ship to the public Rolodex.
