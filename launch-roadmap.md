# MC Training — Launch Roadmap (governing plan)

Status: **ACTIVE — L0 not started**
Approved: 2026-07-12 (executive summary approved by owner)
Goal: drive the app from its current state to a **finished, launch-ready
product** — an installable PWA with a commercial layer.

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

Tasks:
1. **First-run experience** — detect first visit; short guided path:
   pick a program → see this week → start Day 1. No wall of choices.
2. **Quick-tour refresh** — bring `quick-tour.html` /
   `quick-tour-overview.html` current with everything shipped since they
   were written (documentation-currency rule says they must track features;
   verify they actually do), and make the tour reachable from onboarding.
3. **Taps-to-first-workout metric** — count today's path, set a target
   (≤3 taps from open to Day-1 exercise list), and redesign the home/
   dashboard entry flow to hit it.
4. **Feature discoverability** — the audit will flag buried features
   (substitute picker, conditioning corner, macros, max-out, wrapped);
   add contextual entry points instead of relying on the tour.
5. **Program guide clarity** — `program-guide.html` as the "which program is
   for me" front door, with plain-language descriptions per program.

Exit criteria: first-run flow ships · taps target met · tours verified
current against the live feature set · audit-list onboarding items closed.

## Phase L4 — Functionality completion

**Goal:** the feature set is *complete* for launch — nothing a paying user
would immediately ask "where is…?" about.

Tasks:
1. **Unify progress & history** — `mc-stats.js`, `mc-exercise-trends.js`,
   `mc-chart.js`, `wrapped.html`, `workout-logs.html` exist as separate
   surfaces; unify into one coherent Progress area (history, PRs, trends,
   volume) reachable from the dashboard.
2. **Promoted council Phase-4 items** (owner to confirm at phase gate;
   candidates in priority order):
   - **4.6 Automated weekly check-ins** — infra partially exists
     (`mc-push.js`, `supabase/functions/weekly-checkin`, `phase10-push.sql`);
     verify actual state, then finish.
   - **4.2 Natural-language food logging** — builds on the shared
     `mc-foodapi.js` modules.
   - **4.1 Structured coach-claude chips** — gates on first verifying the
     `coach-claude` edge function's real state (unverified since the
     original audit; see council doc).
3. **Audit-driven gaps** — whatever L0's findings list surfaces as missing
   table-stakes functionality.
4. **Explicitly NOT in scope:** council Phase 3.5 (the `mc-s*`/`pmc-s*`
   data-drive refactor) stays deferred — it's internal code health, not
   launch-gating; and PM-mode backlog items ride their own roadmap.

Exit criteria: Progress area shipped · promoted items shipped or explicitly
descoped by owner decision · no open "table-stakes" findings from L0.

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

Exit criteria: **every item above checked or explicitly waived by the owner
in writing in this document. That is the definition of "finished product."**

---

## Status board

| Phase | Theme | Status |
|-------|-------|--------|
| L0 | Debt closeout & audit baseline | ✅ Complete |
| L1 | UI/UX & design-system unification | 🔲 Not started |
| L2 | Mobile experience & PWA installability | 🔄 In progress (Sub-Phase A) |
| L3 | Onboarding & ease of use | 🔲 Not started |
| L4 | Functionality completion | 🔲 Not started |
| L5 | Commercial layer | 🔲 Not started |
| L6 | Launch hardening (Definition of Done) | 🔲 Not started |

Update this table (and append a short "shipped" note under the phase) as
each phase merges. Statuses: 🔲 Not started · 🔄 In progress · ✅ Complete ·
⏸ Waived/deferred (owner decision, link it).

### Shipped notes

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
