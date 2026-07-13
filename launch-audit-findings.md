# Launch Audit — Findings (Phase L0.2)

Produced: 2026-07-13 · Governing plan: [`launch-roadmap.md`](launch-roadmap.md)

**Purpose.** A grounded, page-family-level audit of the current app, organized
by the four launch priority areas (UI/UX & design · mobile & PWA · onboarding &
ease of use · functionality). Every finding is tagged with the phase (L1–L5)
that should own the fix, so each later phase can pull its task list straight
from this doc instead of re-auditing.

**Method.** Code-level inspection of the deployed page fleet and shared assets
(manifest, service worker, base/onyx token sheets, dashboard entry flow, the
substitute/replace flow, the progress surfaces) plus counts across all 144
HTML pages. Each finding cites the concrete evidence it rests on. This is a
findings list, not a fix — no app behavior was changed in L0.2.

**Severity key:** 🔴 blocks a credible launch · 🟠 clearly sub-par, fix before
launch · 🟡 polish / nice-to-have.

---

## Summary — findings by target phase

| Phase | Area | Findings | Highest severity |
|-------|------|----------|------------------|
| L1 | UI/UX & design-system | U1–U6 | 🟠 |
| L2 | Mobile & PWA | M1–M8 | 🔴 |
| L3 | Onboarding & ease of use | O1–O5 | 🔴 |
| L4 | Functionality completion | F1–F4 | 🟠 |
| L5 | Commercial layer (audit notes) | C1–C2 | 🟡 |

The two 🔴 clusters — **PWA installability/safe-area (L2)** and **the total
absence of a first-run experience (L3)** — are the biggest gaps between "an app
that works" and "a product you can launch." They should anchor L2 and L3.

---

## Area 1 — UI/UX & design-system unification → **L1**

**U1 · Multiple token-defining stylesheets, drift risk.** 🟠
Custom-property color/token roots are defined in at least `base.css`,
`gainz-dark.css`, and `onyx-tokens-and-styles.css`, with more component sheets
(`mc-card-actions.css`, `mc-program-hero.css`, `mc-program-landing.css`,
`mc-summary.css`) carrying their own values. No single source of truth. L1's
"one token system" task should reconcile these so every surface consumes the
same tokens.
→ *Evidence:* 7 CSS files define `--bg`/`--text`/`--accent`-class properties.

**U2 · Hardcoded hex instead of tokens on shared surfaces.** 🟠
`index.html` inlines `#0a0a0a` / `#94a3b8` / `#fbbf24` rather than referencing
tokens; the REPLACED-swap badge hardcodes `#22d3ee` cyan in **both**
`mc-replace.js` and `mc-card-actions.js` (duplicated literal). These one-off
literals are exactly the drift L1's audit should eliminate.
→ *Evidence:* `index.html` `<style>` block; `mc-replace.js:36,40`,
`mc-card-actions.js` `paintReplaced()`.

**U3 · Sand light-mode rollout incomplete.** 🟠
The most recent merges are "Phase 7 batch: complete Sand light mode for
[program]" — i.e. light mode is being rolled out program-by-program and is not
yet fleet-wide. L1 should finish the remaining families and shared surfaces so
light mode is a first-class theme, not a partial one.
→ *Evidence:* `git log` Phase-7 batch commits (MC, Kitchen Sink, Strength &
Supersets, PMC, Modality Matrix done; rest pending).

**U4 · Duplicated inline paint logic across two modules.** 🟡
`paintReplaced()` in `mc-card-actions.js` is documented as "mirror
`mc-replace.js`'s applyReplacements paint" — the same cyan-name + REPLACED-badge
markup is authored twice. A shared helper would prevent the two from drifting.
→ *Evidence:* `mc-card-actions.js:515` comment + duplicated badge cssText.

**U5 · No shared empty/loading/error-state pattern.** 🟡
Only `mc-macros.js` has an always-visible empty prompt (`showEmpty()`, from
Phase 2). Other lists/charts/sheets have no documented empty state. L1's
"designed empty states everywhere" task should generalize the `showEmpty()`
pattern.
→ *Evidence:* CLAUDE.md Phase 2 notes; no equivalent in stats/trends surfaces.

**U6 · Design-comp mockups ship to production.** 🟡
Four `*.dc.html` files ("Dashboard Redesign", "Programs Redesign",
"Conditioning Redesign", "Program Landing") are real, reachable pages **and**
sit in the SW precache — internal design comps being downloaded to every user's
device. They should be excluded from the shipped build (see also M7).
→ *Evidence:* `sw.js` precache lists all four `.dc.html` files.

---

## Area 2 — Mobile experience & PWA installability → **L2**

**M1 · Safe-area insets unsupported on 138 of 144 pages.** 🔴
Only 6 of 144 HTML pages carry `viewport-fit=cover` in their viewport meta.
Without it, `env(safe-area-inset-*)` does nothing, so on any notched/home-
indicator iPhone in standalone mode the bottom nav and Finish-Workout banner
render under the home indicator and content runs under the notch.
→ *Evidence:* `grep -l viewport-fit=cover *.html` → 6/144.

**M2 · Standalone web-app meta missing on 139 of 144 pages.** 🔴
`apple-mobile-web-app-capable` (and the status-bar-style/title metas) is present
on `index.html` but absent from ~139 pages, so navigating within the installed
app to a program/day page loses the standalone treatment inconsistently.
→ *Evidence:* `grep -L apple-mobile-web-app-capable *.html` → 139/144.

**M3 · base.css has effectively no safe-area handling.** 🔴
A single `safe-area-inset`/`env()` reference exists in `base.css`. The gym-
critical bottom controls (log set, rest timer, finish banner) need explicit
`padding-bottom: env(safe-area-inset-bottom)` treatment paired with M1.
→ *Evidence:* `grep -c "safe-area-inset\|env(" base.css` → 1.

**M4 · Manifest ships an SVG-only icon set — iOS install shows no real icon.** 🔴
`manifest.json` lists a single `icon.svg` (`"sizes":"any"`). iOS ignores SVG
manifest icons and there is no `apple-touch-icon` link, so an installed
home-screen icon falls back to a screenshot/blank. Needs PNG 192 + 512, a
`maskable` variant, and an `apple-touch-icon`.
→ *Evidence:* `manifest.json` `icons` array (one SVG entry).

**M5 · Manifest `screenshots` array is empty.** 🟠
No install-sheet screenshots, so Android's richer install UI and any store-style
listing get nothing. Populate once L1 visuals settle.
→ *Evidence:* `manifest.json` `"screenshots": []`.

**M6 · Service worker precaches the entire tree indiscriminately.** 🟠
`sw.js` precaches 241 URLs including the four `.dc.html` design comps (M7/U6)
and every program page whether or not the user will ever open it — a large
first-install payload and cache footprint. `tools/build-sw.py` should learn an
exclusion list and the app should define offline-critical (active program,
logging, timers) vs. network-first (macros API, sync).
→ *Evidence:* `sw.js` "241 URLs"; `.dc.html` entries present.

**M7 · Design comps reachable + cached (mobile payload).** 🟠
Same four `.dc.html` files as U6 — called out here too because they inflate the
install/precache payload, not just hygiene. Exclude from `build-sw.py`.
→ *Evidence:* `sw.js` precache.

**M8 · Touch-target coverage unverified on gym-critical controls.** 🟠
`base.css` has only ~7 references to 44/48px sizing. The highest-frequency
one-handed actions (log set, rest timer, next exercise, swap) need an explicit
44px-minimum + thumb-zone pass. Confirm against the live workout page during L2.
→ *Evidence:* `grep -c "44px\|48px\|min-height:4[048]" base.css` → 7.

---

## Area 3 — Onboarding & ease of use → **L3**

**O1 · There is no first-run experience at all.** 🔴
A repo-wide search for onboarding/first-run/welcome/"has seen tour" markers
returns nothing in the app code (the only hit, `mc-naming.js`, is the unrelated
rename resolver). A brand-new trainee lands on the full dashboard cold, with no
guided "pick a program → see this week → start Day 1" path. This is the single
biggest ease-of-use gap and should anchor L3.
→ *Evidence:* `grep -rln "first.run\|onboard\|hasSeenTour\|welcome" *.js *.html`
→ only `mc-naming.js` (false positive).

**O2 · `index.html` is a bare redirect, no orientation.** 🟠
`index.html` immediately `location.replace('dashboard.html')`. There is no
landing surface to explain what the app is or route a first-time vs. returning
user differently — relevant to both L3 (first-run) and L5 (public landing).
→ *Evidence:* `index.html` head-script redirect.

**O3 · Quick-tour currency unverified.** 🟠
`quick-tour.html` / `quick-tour-overview.html` exist, but the documentation-
currency rule requires they track every shipped feature; they have not been
verified against the current feature set (substitute picker, conditioning
corner, macros search, calendar collapse, adaptive macros, etc.). L3 must
diff them against reality and refresh.
→ *Evidence:* CLAUDE.md documentation-currency rule; no recent tour commits in
`git log` alongside the Phase-2/3 feature work.

**O4 · Taps-to-first-workout unmeasured.** 🟠
The roadmap sets a ≤3-tap target from app open to the Day-1 exercise list; the
current path length has not been counted. L3 needs the baseline before
redesigning the entry flow.
→ *Evidence:* no metric captured; dashboard → programs → program → split → day
is the apparent path (needs live confirmation).

**O5 · Feature discoverability relies on the tour, not context.** 🟡
Powerful features (substitute picker via the meatball menu, max-out calculator,
wrapped, conditioning corner) are reachable but not contextually surfaced. L3
should add in-context entry points rather than depending on users finding the
tour.
→ *Evidence:* substitute picker lives behind the ⋮ menu (`mc-card-actions.js`);
no first-use hint.

---

## Area 4 — Functionality completion → **L4**

**F1 · Progress & history are fragmented across three pages + several modules.** 🟠
`stats.html`, `workout-logs.html`, and `wrapped.html` are separate destinations,
backed by `mc-stats.js`, `mc-exercise-trends.js`, `mc-chart.js`, and
`mc-wrapped.js`. A paying user expects one coherent Progress area (history · PRs
· trends · volume) reachable from the dashboard. L4 should unify them.
→ *Evidence:* three sibling HTML pages; four separate progress/chart modules.

**F2 · Council Phase-4 items unverified against current infra.** 🟠
The promoted candidates — automated weekly check-ins
(`supabase/functions/weekly-checkin`, `mc-push.js`, `phase10-push.sql`),
natural-language food logging (`mc-foodapi.js`), structured coach-claude chips
(edge function) — all have infra that has **not been re-verified** since the
original council audit. L4 must confirm actual state before scoping.
→ *Evidence:* files present in tree; council-roadmap-status.md flags them
"unverified."

**F3 · Swap/replace flow is coherent (verified — no action).** ✅
Recorded here so L4 doesn't re-open it: the meatball "Replace exercise" route
uses a `confirm()` dialog → Exercise Library; the biomechanical in-place
substitute uses a recoverable Undo toast and persists via
`mc_replacements_global`/`mc_replacements|<page>`, re-painted on reload by
`mc-replace.js`. `mc-live-tracker.js` reads `mc_setlog_v1` + live DOM counts
(not `mc_daily_v1`). Closed in L0.1.
→ *Evidence:* `mc-card-actions.js:295,441`; `mc-live-tracker.js:37,163,176`.

**F4 · No unified "resume active workout" affordance surfaced.** 🟡
`mc-resume.js` exists but the audit did not confirm a single prominent "resume
where you left off" entry on the dashboard — a high-value ease-of-use +
functionality overlap. Confirm during L3/L4 and surface if missing.
→ *Evidence:* `mc-resume.js` present; dashboard entry flow not yet traced live.

---

## Area 5 — Commercial layer (early audit notes) → **L5**

**C1 · No monetization surface of any kind exists.** 🟡
No payment/checkout/entitlement/paywall references anywhere in the tree (matches
the roadmap's assumption). L5 starts from zero — reinforces the need for the
architecture spike gated at the top of L5.
→ *Evidence:* `grep -i "stripe\|payment\|checkout\|paywall\|entitlement"` →
only doc mentions, no implementation.

**C2 · `index.html` doubles as the future landing slot.** 🟡
Since `index.html` is currently a throwaway redirect (O2), it is the natural
home for L5's public marketing landing page — worth noting so L3's first-run
work and L5's landing work don't collide over the same file.
→ *Evidence:* `index.html` redirect.

---

## Hand-off

- **L1** pulls: U1–U6.
- **L2** pulls: M1–M8 (M1–M4 are the 🔴 installability blockers).
- **L3** pulls: O1–O5 (O1 is the 🔴 first-run gap).
- **L4** pulls: F1, F2, F4 (F3 already closed).
- **L5** pulls: C1–C2 plus the gated architecture spike.

Each phase's own executive summary should convert its findings above into a
concrete task list, re-confirming any item marked "needs live confirmation"
against the running app first.
