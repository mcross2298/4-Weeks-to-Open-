# MASTER ROADMAP: VOC/VOA KAIZEN AUDIT & CI INITIATIVES

> **Status:** opened 2026-08-30. Scope: 5 repositories / 4 application categories.
> **Method:** every finding below was measured by driving the real application in a
> real headless Chromium at 390px and 320px — not inferred from reading source.
> Where a claim could not be verified from this environment, it is labelled
> **UNVERIFIED** rather than asserted.
> **Constraint locked with the owner:** all initiatives stay inside the
> vanilla-HTML/CSS/JS, no-framework, no-build-step architecture every one of the
> five repositories documents as deliberate. Node/Python check scripts are the
> only tooling any wave may add.
> **Home:** this file lives in `4-Weeks-to-Open-` and is scratch-listed in
> `content-manifest.json`, so it never reaches the public `MC-Training-Rolodex`
> build.

---

## 1. EXECUTIVE SUMMARY & KAIZEN OVERVIEW

### Purpose & Scope

A Voice-of-the-Customer / Voice-of-the-Associate Kaizen audit across all five
PWAs, to produce one scheduling instrument for future per-repo refinement
sessions. Repositories audited:

| # | Application category | Repository | Role |
|---|---|---|---|
| 1 | Workout & Fitness | `4-Weeks-to-Open-` | Master repo |
| 2 | Workout & Fitness | `MC-Training-Rolodex` | Downstream public build (auto-deployed) |
| 3 | Recipe & Cookbook | `Mikes-Cookbook` | Standalone |
| 4 | Personal Finance | `Cross-Household-` | Private, real household data |
| 5 | Financial Demo | `household-finance` | Public template, fictional demo data |

### What the Gemba walk actually found

**The apps are in materially better shape than a roadmap of this size usually
implies, and that should be said plainly before any finding.** Across 49
page/route loads at two viewport widths:

- **Zero horizontal overflow.** 16 `Cross-Household-` routes, 14
  `household-finance` routes, 8 `Mikes-Cookbook` screens, 11 `4-Weeks-to-Open-`
  pages — all clean at **both** 390px and 320px. The workout repo's `F3-4`
  overflow fix holds fleet-wide.
- **Zero uncaught JavaScript errors** on every route of all four driven apps.
- **Both finance accessibility gates pass**: `Cross-Household-` 16 routes × 2
  themes, `household-finance` 14 routes × 2 themes, contrast and touch targets
  clean.
- **`build-market.py --check` passes** — no licensed content or brand term
  reaches the public Rolodex build (41 licensed files correctly excluded).
- **The cookbook's two pinned regressions hold**: `?cook=1` opens Cooking Mode
  directly, and a running kitchen timer survives a full cross-page navigation
  (`recipe.html` → `index.html`) with its store intact.

### The one structural finding that organises this roadmap

> **Ergonomic enforcement is inversely proportional to ergonomic risk.**

| Application | Where it is used | Automated touch-target enforcement |
|---|---|---|
| `Cross-Household-` | Seated, desk, unhurried | **Every route, both themes, 44px** (`check-a11y.mjs`) |
| `household-finance` | Seated, desk, unhurried | **Every route, both themes, 44px** (`check-a11y.mjs`) |
| `4-Weeks-to-Open-` | Gym floor, sweaty hands, mid-set | **9 of 141 pages**, session-shell controls only (`check-journey.js`) |
| `Mikes-Cookbook` | Kitchen, greasy hands, phone on counter | **None. Zero gates.** (14 CI gates, none measure a target or a contrast ratio) |

The two applications a person uses *seated and unhurried* have the strictest
ergonomic gates in the fleet. The two used *with compromised hands and divided
attention* have almost none. Every persona in Section 2 independently surfaced
this from a different direction, which is why it is the spine of Waves 1–3, 6
and the CI initiatives rather than a single line item.

### The fleet sweep that sizes it

A separate pass drove **all 141 loadable pages** of `4-Weeks-to-Open-` at 390px:

| Measure | Result |
|---|---|
| Pages scanned | 141 |
| Pages with **zero** horizontal overflow | **141 / 141** |
| Pages carrying **≥1 sub-44px control** | **141 / 141** |
| Distinct sub-44 control shapes | 514 |

Two things follow, and they point in opposite directions:

- **Layout is genuinely solved.** Not one page of 141 overflows sideways at
  390px. That is a real engineering achievement and no wave should touch it.
- **The tap-target floor is unenforced everywhere.** Every single page has at
  least one control under 44px, while the journey gate measures 9 of them.

The offenders are **concentrated, not scattered** — which is what makes this
tractable rather than a 141-page grind:

| Class | Pages affected | Measured |
|---|---|---|
| `.mc-nav-tab` | **125** | 78 × 42 |
| `.back-link` | **114** | 29 tall |
| `.mcgd-entry` | 52 | — |
| `.tab` | 49 | 91.5 × 41 |
| `.filter-btn` | 25 | 27 tall |
| `.jump` | 17 | 31 tall |
| `.mc-surprise-btn` | 9 | ~35 tall (**already recorded** in `CLAUDE.md`) |

**Two CSS rules — `.mc-nav-tab` and `.back-link` — reach 125 and 114 pages
respectively.** Fixing those two classes in `base.css` addresses the majority of
the fleet's exposure without touching a single page file. That is the whole
argument for Initiative 3, and it is why Wave 3 is scoped as a shared-CSS change
rather than a page sweep.

This is **not a new discovery of breakage** — `4-Weeks-to-Open-`'s own
`CLAUDE.md` already records the fleet-wide shortfall as "pre-existing, caught by
no gate today." What this audit adds is the **measurement**: which controls, on
which screens, at what size.

### Key metrics / friction indicators

| Indicator | Measured value |
|---|---|
| Routes/pages driven (interactive walk) | 49 loads × 2 widths |
| Workout pages swept fleet-wide @390 | **141** |
| Horizontal-overflow defects (walk + 141-page sweep) | **0** |
| Uncaught JS errors | **0** |
| Cookbook CI gates measuring a touch target | **0 of 14** |
| Workout pages carrying ≥1 sub-44 control | **141 / 141 (100%)** |
| Distinct sub-44 control shapes, workout fleet | **514** |
| Workout page coverage of the 44pt journey gate | **9 of 141 swept (6.4%)** |
| Smallest interactive control found | **8 × 8 px** (`4-Weeks-to-Open-` Quick Tour step dot) |
| Smallest control on a hands-free screen | **32 × 32 px** (Cooking Mode daylight toggle) |
| Finance doc-vs-gate drift | CLAUDE.md says 48px; gate enforces **44px** (both repos) |
| Internal planning docs leaked to public build | **2** (`MC-Training-Rolodex`) |

---

## 2. VOC / VOA INTERVIEW SYNTHESIS

Five associate profiles were run against all four applications. Quotes are
composed to express a **measured** finding — each is traceable to a specific
number in Section 3. No quote below rests on an unmeasured impression.

### Associate 1 — Daily Power User (speed, shortcuts, rapid entry)

> *"The set logger is genuinely fast now. What slows me down is everything
> around it — I keep missing the topbar icons on my phone because they shrink
> as the screen narrows."*

- **Positive:** the workout session surface is the most refined part of the
  fleet. The `S1`–`S5c` runtime work (−99.5% mutation records) is felt: no lag
  logging sets.
- **Friction:** `dashboard.html` topbar icons measure **34.9 × 40px at 390px and
  26.6 × 40px at 320px** — they compress with the viewport instead of scrolling.
  These are the app's primary navigation.
- **Friction:** `exercise-library.html` filter chips are **27px tall** (20 of
  them on screen at once) — the primary way a power user narrows 577 exercises.
- **Request:** a keyboard/quick-entry path for weight+reps that doesn't require
  hitting a 40px target between sets.

### Associate 2 — Mobile-First / On-the-Go (touch, offline, low connectivity)

> *"Cooking Mode is the whole reason I open this on the counter, and it has the
> smallest buttons in the app. My hands are covered in chicken."*

- **Positive:** no horizontal overflow anywhere, at any width tested, in any of
  the four apps. Nothing had to be pinched or side-scrolled.
- **Friction — headline:** `Mikes-Cookbook` Cooking Mode is the *hands-free*
  screen and carries the app's smallest controls: **daylight toggle 32×32**,
  **font ± 40×32**, **voice toggle 40×32**, **Exit 53×18**.
- **Friction:** the serving stepper `±` on `recipe.html` is **40×40** — the
  single most-tapped control while actually cooking.
- **Friction:** collection-card heart and add-to-plan are **34×34**.
- **Offline:** the app shell caches and serves correctly. **But** sign-in loads
  the Supabase SDK from `cdn.jsdelivr.net` at runtime — cross-origin, therefore
  not precacheable — in **both** the cookbook and the workout app.

### Associate 3 — Data & Analytics Enthusiast (reporting, charts, exports)

> *"The numbers are right and the exports round-trip. I just can't tap the thin
> slices on the donut."*

- **Positive:** money-math suites pass in both finance repos; the backup format
  round-trips (`test-mc-export.js`); `check-doc-drift` keeps the CSV contract
  honest against `00-state.js`.
- **Friction:** `household-finance` dashboard donut segments are tappable
  ("View <member> transactions") but a small slice renders at **8.8 × 0.6px**.
  This is *formally exempt* under the repo's own documented WCAG 2.5.8 rule
  (the 44px legend button is the equivalent target) — so it is a UX
  observation, **not a gate violation**.
- **Request:** the Monthly Report (`Cross-Household-`-only) is the deepest
  analytical surface and is measured by no gate at any width other than 390.

### Associate 4 — Casual / Low-Tech (onboarding, hierarchy, error recovery)

> *"The tour is the first thing I ever touched, and the dots to move between
> steps are smaller than a grain of rice."*

- **Friction — headline:** `4-Weeks-to-Open-` `quick-tour.html` step dots are
  **8 × 8px** (22×8 when active). This is the **onboarding** surface — the
  first interactive control a new trainee ever meets.
- **Friction:** `Skip` is 47×30; `Back` is 36×36 across `quick-tour.html`,
  `quick-tour-overview.html`, `program-guide.html` and `workout-logs.html`.
- **Friction:** the cookbook's backup-banner dismiss control is **17 × 23px**.
- **Positive:** both finance apps' Quick Tour + Executive Summary render from
  the single `js/features.js` registry, so the "what can this app do" surface
  cannot drift from the screen list. This is the best onboarding pattern in the
  fleet and is the model Initiative 5 generalises.

### Associate 5 — Cross-Device / Sync (persistence, cache, multi-device)

> *"It works beautifully on one phone. I can't prove to myself it works across
> two."*

- **Positive:** the kitchen timer's absolute-instant design (`endsAt`, never a
  decrementing count) survived a full page navigation in test — verified live.
- **Positive:** `mc-sync.js` merge strategies are unit-tested against real
  conflicting fixtures in both cookbook and workout repos.
- **Friction:** sign-in depends on a **cross-origin CDN script**
  (`cdn.jsdelivr.net/npm/@supabase/supabase-js@2`) in both apps. A service
  worker cannot precache it. On a cold offline launch the sync layer is simply
  unavailable, and the failure is silent.
- **UNVERIFIED / owner-gated:** real two-device Supabase reconciliation. This
  was already flagged as owner-only in `cookbook-bridge-roadmap.md`'s `B5` and
  **remains open**. No wave below claims to close it from an agent session.

### Top common pain points (all applications)

1. **Sub-44px controls concentrated on exactly the screens used with compromised
   hands** — cookbook Cooking Mode, workout Quick Tour, both topbars.
2. **Ergonomic gate coverage inverted vs. risk** — 0 gates (cookbook), 5.5% page
   coverage (workout), full coverage (both finance apps).
3. **Cross-origin CDN dependency** breaks the otherwise-solid offline story in
   both cookbook and workout.
4. **Narrow-viewport (320px) behaviour is correct but unguarded** — all four
   apps are clean at 320 today; no gate in any repo measures it, so nothing
   holds the line.
5. **Documentation drift that the doc-drift gates are not scoped to catch.**

---

## 3. APP SPECIFIC CONTINUOUS IMPROVEMENT (CI) ROADMAPS

Every wave below carries an explicit **Definition of Done**. Waves that cannot
be closed from an agent session say so.

---

### A. Workout Applications (`4-Weeks-to-Open-` & `MC-Training-Rolodex`) — Waves 0 to 4

> **Deploy rule, restated because it governs every wave here:** all work lands in
> `4-Weeks-to-Open-`. `MC-Training-Rolodex` is a downstream build target
> force-pushed by `market-deploy.yml`. **Never push to the Rolodex directly.**

#### Wave 0: Environment Setup, PWA Audit & Quick Tour Verification

- Verify local gate list runs green (documented in `CLAUDE.md`).
- **Finding W0-1 — public build carries internal planning docs.**
  `pm-rename-design.md` and `readiness-stats-roadmap.md` exist in the master
  repo, are **not** in `content-manifest.json`'s `scratch` array, and therefore
  ship into the public `MC-Training-Rolodex` build. Confirmed present in the
  Rolodex checkout. `build-market.py --check` passes because it scans for
  *licensed content and brand terms*, not internal planning docs — the gate is
  behaving as designed; the manifest is incomplete.
  *Fix:* add both to `scratch`. One-line change, no gate change needed.
- **Finding W0-2 — roadmap docs are publicly served.** `pages.yml` strips only
  `*.dc.html` and `stndr-card-concepts.html` from the Pages artifact, so every
  root `.md` (including all 11 existing roadmap docs, and this one) is fetchable
  at the Pages URL. Not a leak of licensed content; a disclosure posture the
  owner should decide on deliberately.
  *Options:* (a) accept — they contain no secrets; (b) extend the `pages.yml`
  strip step to drop scratch-listed files from the Pages artifact too.
  **Owner decision required — `AskUserQuestion` gate.**
- Re-verify `quick-tour.html` / `quick-tour-overview.html` against shipped
  features per the Documentation currency rule.
- **DoD:** manifest updated; W0-2 decision recorded; gates green.

#### Wave 1: Active Workout Logging & Real-Time Timer Bug Fixes

- **No new logging or timer defect was found in this audit.** The session
  surface is the most hardened part of the fleet, and this wave should not
  invent work. Its real content is the two *known, recorded* gaps:
- **W1-1 — `measure-session.js` reports `timer confirmed running: false` on
  `mm-p1.html`.** Already recorded in `CLAUDE.md` as pre-existing and identical
  on `main`: the rest-timer probe never starts a timer there, so that column
  measures idle load rather than the load it names. **The perf gate is weaker on
  that page than it looks.** Fix the probe so the budget measures what it claims.
- **W1-2 — the "cards at load" module class.** `F3-1`/`F3-2`/`F3-3` each found a
  module keying off "are there exercise cards at load" (`mc-session.js`,
  `mc-summary.js`, `mc-finish.js`). `F3-4` found no fifth. Confirm none remains
  before `F3-5` converts the last four pages.
- **DoD:** `measure-session.js` starts a real timer on `mm-p1.html`; perf budget
  re-baselined deliberately; no fifth cards-at-load module.

#### Wave 2: Exercise Library, Rolodex Data Sync & State Management

- **W2-1 — `exercise-library.html` filter chips are 27px tall**, 20 on screen.
  This is the primary interface to 577 exercises. Raise to the 44pt floor.
- **W2-2 — Supabase SDK is a cross-origin CDN script.** `mc-supabase.js:32`
  loads `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` on demand. `sw.js`
  precaches the local wrapper but cannot precache the SDK. Sign-in is therefore
  unavailable on a cold offline launch, and the failure path is silent.
  *Scope for this wave:* make the failure **visible and honest** (a stated
  "sign-in needs a connection" state), not silent. Vendoring the SDK is a
  larger decision — see Initiative 2.
- **W2-3 — content-manifest attribution defect (recorded, unfixed).** One
  licensed workout page is attributed to one program in `content-manifest.json`
  while being linked only from the other program's landing. Both are stripped,
  so neither build is affected — but one of the two is wrong.
- **DoD:** filter chips ≥44px; offline sign-in state visible; attribution
  corrected.

#### Wave 3: Mobile Ergonomics & High-Movement UI/UX Quick Wins

The largest measured wave in the workout repos. All figures measured at 390px
unless stated. **Sequence this as shared-CSS first:** `.mc-nav-tab` (125 pages)
and `.back-link` (114 pages) are two rules in `base.css`, not 239 page edits.

| Control | Measured | Pages |
|---|---|---|
| `quick-tour` `.dot-nav` step dots | **8 × 8** (22×8 active) | onboarding |
| `.topbar-icon` (dashboard) | 34.9 × 40 @390; **26.6 × 40 @320** | dashboard |
| `a.back` | 36 × 36 | quick-tour, tour-overview, program-guide, workout-logs |
| `.filter-btn` (exercise library) | 27 tall | exercise-library |
| `.back-link` | 29 tall | kitchen-sink, exercise-library |
| `.mc-nav-tab` | 78 × 42 | program-guide, cat-strength |
| `.wl-tab` | 38 tall | workout-logs |
| `.ntx-ico` | 38 × 38 | dashboard nutrition |
| `a.skip` | 47 × 30 | quick-tour |
| `.mc-surprise-btn`, `.inst-header-link` | ~35 tall (**already recorded**) | fleet-wide |

- **W3-1 — the topbar must scroll, not compress.** The dashboard topbar icons
  narrow from 34.9px to 26.6px between 390 and 320. This is the same class of
  problem `F0` already solved for the week pills, and it has the same fix:
  five 44px cells cannot fit 320px, so no padding tweak works —
  `flex: 1 0 44px` + `overflow-x: auto`. **Reuse `F0`'s solution; do not
  re-derive it.**
- **W3-2 — Quick Tour dots.** 8×8 is the single worst control in the fleet, on
  the onboarding surface. Raise the hit area (a transparent 44px pad around an
  8px visual dot is acceptable and keeps the design).
- **W3-3 — shared back control.** `a.back` at 36×36 recurs on four pages. Per
  this repo's own `check-single-impl.js` philosophy, define it **once** in
  `base.css` (as `F3-2` did for `.mc-day-back`), don't patch four pages.
- **DoD:** every control above ≥44×44 at 390 **and** 320; no visual regression
  on the ratchets; `check-journey` 9/9.

#### Wave 4: Wave Sign-Off & Verification

- Full local gate list green (all 30 checks in `CLAUDE.md`).
- **W4-1 — extend `check-journey.js` to guard what Wave 3 fixed.** Wave 3's
  gains are worthless unguarded: today the journey gate measures **session-shell
  controls on 9 of 163 pages**, so every control in the Wave 3 table sits outside
  it and can silently regress. Add a **chrome-control pass** covering the
  topbar, back controls, nav tabs and the tour, and add **320px** alongside 390.
  This is the wave's real deliverable.
- Re-baseline visual/contrast/perf ratchets **deliberately**, inspecting the
  diff before accepting — per the `F3-3` precedent.
- **DoD:** Wave 3 controls enforced by a gate proven to fail on the pre-fix tree.

---

### B. Cookbook Application (`Mikes-Cookbook`) — Waves 5 to 8

#### Wave 5: Quick Tour Audit & PWA Offline Capability Pass

- **W5-1 — the cookbook has no accessibility gate of any kind.** 14 blocking CI
  gates; **none** measures a touch target, a contrast ratio, or a viewport
  width. There is no `tools/check-a11y*`, no `check-contrast`, no
  `check-journey` equivalent. Confirmed by inventory, not inferred.
  *This is the single largest coverage gap in the fleet*, and it is on the app
  used with the dirtiest hands.
- **W5-2 — offline shell verified working**; the Supabase CDN dependency
  (identical `SDK_URL` to the workout app) is the one hole. Same treatment as
  W2-2: make it visible, decide vendoring in Initiative 2.
- Verify `quick-tour.html` / `quick-tour-overview.html` currency.
- **DoD:** gap documented with measurements; Wave 6 scoped from real numbers.

#### Wave 6: Kitchen UX / Hands-Free / Scaled Ingredient Calculation Fixes

**The highest-value wave in this roadmap.** Cooking Mode is the app's reason to
exist on a counter, and it carries its smallest controls.

| Control | Measured | Surface |
|---|---|---|
| `.cook-counter-btn` daylight toggle | **32 × 32** | Cooking Mode |
| `.cook-font-btn` (×2) | **40 × 32** | Cooking Mode |
| `.cook-voice-btn` | **40 × 32** | Cooking Mode |
| `.cook-exit` | **53 × 18** | Cooking Mode |
| `.serving-step` `±` (×2) | 40 × 40 | recipe.html |
| `.fav-toggle` / `.plan-toggle` | 84×38 / 77×38 | recipe.html |
| `.fav-toggle` / `.plan-toggle` | **34 × 34** | collection cards |
| `.r-back` | 42 × 21 | recipe.html |
| `.back-fab` | 79 × 40 | recipe.html |
| `.home-search-btn` / `.home-workout-btn` / `.home-account-btn` | 40 × 40 | every shell screen |
| `.backup-banner-dismiss` | **17 × 23** | Home |

- **W6-1 — Cooking Mode first.** Counter Mode exists precisely because this
  screen is used at arm's length in bad light; controls at 32×32 contradict that
  intent. Raising them is consistent with the feature's own design rationale.
- **W6-2 — the serving stepper** is the most-tapped control during actual
  cooking. 40×40 → 44×44 minimum.
- **W6-3 — card controls at 34×34** are the two highest-frequency taps in
  browse/collection. These are also **shared through `mc-cards.js`**, so one fix
  covers the shell and collection pages — verify no second definition exists.
- **Ingredient calculation:** no scaling defect was found. `MCUnits`'
  fragmentation ratchet stands at 179/854 and may only fall. Any work here is
  *improvement*, not repair — grow the `DENSITY` table, watch the ratchet drop.
- **DoD:** every control above ≥44×44 at 390 and 320; `smoke-test.js` green;
  timer-survival regression still pinned.

#### Wave 7: Recipe Search, Categorization & Storage Bugs

- **No search defect found.** `mc-search.js` handles the two documented failure
  cases ("chicken broccoli", "chiken") and its perf assertions hold. Do not
  re-litigate a finished pillar.
- **W7-1 — storage quota surfacing.** `writeStore()` surfaces one toast per
  session on `QuotaExceededError`; `:photos` is capped at 24 images. Verify the
  cap and the toast behave under a genuinely full quota — this is the one
  storage path that fails silently by design.
- **W7-2 — `mc-cookbook:tracker:v1` legacy migration** is scheduled for removal
  on/after 2027-01-08. Not yet due. Log it here so it isn't forgotten.
- **DoD:** quota path verified; no regression in the 14 gates.

#### Wave 8: Wave Sign-Off & Kitchen Readiness Check

- **W8-1 — add the cookbook's first accessibility gate.** The deliverable of
  this whole cluster. Port the *pattern* from `Cross-Household-`'s
  `check-a11y.mjs` (routes × themes × 44px + contrast), adapted to the
  cookbook's hub-and-spoke shell + standalone pages, **and add Cooking Mode as
  an explicit route** — it is reachable via `recipe.html?id=<id>&cook=1`, so it
  is drivable by exactly the mechanism the gate needs.
- **Prove the gate fails on the pre-Wave-6 tree before landing it.** A gate that
  cannot fail is worthless — this repo family's own recorded lesson.
- Run `diagnostics.html` on a real device (owner-side).
- **DoD:** a11y gate blocking in `verify`; proven to fail pre-fix; Wave 6
  controls enforced.

---

### C. Personal Finance Application (`Cross-Household-`) — Waves 9 to 12

> **Privacy rule, restated:** `js/store/00-state.js`'s `seed()` holds **real**
> figures for two named people. Never make this repo public, never copy its seed
> into `household-finance`, and never paste real figures into a PR body.

#### Wave 9: Financial Quick Tour Verification & Ledger State Audit

- **Verified clean:** all 16 routes load with zero console errors and zero
  horizontal overflow at 390 **and** 320. `check-a11y.mjs` passes 16 routes ×
  2 themes. `run-tests.mjs` money-math suite is the gate of record.
- **W9-1 — documentation drift.** `CLAUDE.md` states the a11y job "checks
  contrast and **48px** touch targets." `scripts/check-a11y.mjs:119` enforces
  **44px** (`r.height < 44 || r.width < 44`), and its failure message reads
  `needs 44`. The `doc-drift` gate only compares CSV header and category list
  against `00-state.js`, so it is not scoped to catch this.
  *Fix:* correct the doc to 44 (**recommended** — 44pt is the platform floor
  these repos use elsewhere), or raise the gate to 48 and re-verify every route.
  **Owner decision — `AskUserQuestion` gate**, because raising to 48 is a real
  behavioural change across 16 routes.
- **DoD:** doc and gate agree; decision recorded.

#### Wave 10: Budget Tracking, Transaction Entry & Recurrent Items

- **No entry or math defect found.** Budget, transactions, import, calendar and
  paycheck routes all render clean at both widths.
- **W10-1 — Direct Deposit (`03-paycheck.js`) remains Cross-only by deliberate
  scope decision.** Recorded here so a future session does not "fix" it by
  porting: its HYSA/Roth math derives from a fixed Mike/Bri pair and would need
  re-deriving for `household-finance`'s dynamic N-member roster. **Any port is
  its own scoped feature request.**
- **W10-2 — CSV contract is frozen.** `Store.CSV_HEADER`, column order and the
  19-category list are a live contract with
  `reference/Cross_Finances_Command_Center.xlsx`. No wave may change them in
  passing. `check-doc-drift.mjs` enforces the doc side.
- **DoD:** no contract drift; money-math green.

#### Wave 11: Multi-User / Household Sync & Local Caching Integrity

- **W11-1 — `sync-drift` baseline hygiene.** `check-sync-drift.mjs` compares
  against `household-finance`'s **`main`**, never a feature branch. Any wave
  touching a manifest-covered file must port the change and run
  `node scripts/update-sync-baseline.mjs <path>` **against a real `main`
  worktree** (`git worktree add <tmp> origin/main`). A baseline taken against a
  feature branch silently encodes the wrong comparison and fails later in a way
  that looks like a tooling bug.
- **W11-2 — Supabase live sync status.** `ROADMAP-SUPABASE.md` is the status
  record: `js/cloud.js` and `js/sync.js` are real and loaded; five migrations
  applied across Phases 1–3. Read it before assuming either "no backend" or
  "fully shipped."
- **UNVERIFIED:** true two-device reconciliation. Owner-side.
- **DoD:** baseline refreshed against `main`; sync status re-stated accurately.

#### Wave 12: Analytics, Dashboard Charts & Wave Sign-Off

- **W12-1 — chart segments as touch targets.** Donut/bar segments carry
  `aria-label`s like "View <category> transactions" and are tappable, but are
  sized by the data. This is *formally exempt* in the repo's own rule (the 44px
  legend button is the equivalent target). Confirm the legend equivalence
  actually holds on every chart that exposes a tappable segment — the exemption
  is only honest where an equivalent 44px target genuinely exists.
- **W12-2 — no gate below 390px.** `check-a11y.mjs` runs a single 390px
  viewport. This audit found 320 clean, so this is a **guard gap, not a live
  defect** — but nothing holds that line. Add 320 to the matrix.
- **DoD:** legend equivalence verified per chart; 320 in the a11y matrix; all
  five jobs green.

---

### D. Financial Demo Application (`household-finance`) — Waves 13 to 16

> **Demo-data rule, restated:** `seed()` is a *fictional* household ("Alex &
> Sam"). Never insert real financial data here — a public repo's git history is
> permanent. The in-app **Start fresh** flow is the only place real data belongs.

#### Wave 13: Demo Flow Walkthrough & Scenario State Audit

- **Verified clean:** 14 routes, zero console errors, zero horizontal overflow
  at 390 and 320. `check-a11y.mjs` passes 14 routes × 2 themes.
- **W13-1 — same 48px-vs-44px doc drift as Wave 9**, identical wording in
  `CLAUDE.md`, identical `check-a11y.mjs:119` threshold. Fix both repos in one
  coordinated pass so `sync-drift` sees a single deliberate divergence rather
  than two accidental ones.
- **DoD:** doc/gate agreement matching the Wave 9 decision.

#### Wave 14: Sample Data Seeding, Interactive Controls & Chart Performance

- **W14-1 — thin chart segments.** Measured a donut segment at **8.8 × 0.6px**
  carrying a real `aria-label` ("View Sam transactions"). Formally exempt, but
  on the *demo* app this is the surface a first-time evaluator touches. A
  minimum-angle floor, or routing small slices into an "Other" segment with a
  real target, is a genuine demo-quality improvement.
- **W14-2 — `startFresh()` / `emptyState()` path** is the app's actual
  onboarding. Verify end-to-end that clearing demo data leaves a coherent
  single-member (`"You"`) state across all 14 routes.
- **DoD:** small-slice handling decided; Start-fresh verified on every route.

#### Wave 15: Sandbox Reliability, UI Polish & Presentation Mode

- **W15-1 — this is the demo; first-run polish is the product.** Apply the
  Wave 3/6 tap-target standard here too, so the public template demonstrates the
  fleet standard rather than lagging it.
- **W15-2 — `MIGRATION.md` / `STORAGE.md` / `SUPABASE.md` are drafted, not
  shipped.** Nothing in `js/` implements cloud sync here; `SUPABASE.md`
  self-labels as draft. Ensure no wave's copy implies otherwise to a reader
  evaluating the template.
- **DoD:** demo matches fleet ergonomics; docs unambiguous about what ships.

#### Wave 16: Final Master Integration, Full System Test & Hand-Off

- Run every gate in all five repos.
- Refresh `scripts/sync/baseline/` against a real `origin/main` worktree
  **after** the paired `household-finance` PR merges — until then the baseline
  legitimately shows the whole wave as diff, which is correct, not a bug.
- **W16-1 — the honest close.** These items **cannot** be closed from an agent
  session and must be recorded as owner-side, not silently marked done:
  - real-device QA matrix (iOS Safari, Android Chrome, installed PWA);
  - two-device Supabase reconciliation (open since `B5`);
  - `check-contrast.js --update` re-baselining, which **must run from CI** —
    `fonts.googleapis.com` is unreachable from a headless browser in an agent
    sandbox, so pages render in fallback metrics and `--update` produces wrong
    budgets. **`curl` reaches it and returns 200; the browser does not** — so
    checking with `curl` will not reveal this.
- **DoD:** all gates green; owner-side items listed as open, not closed.

---

## 4. NEW CONTINUOUS IMPROVEMENT (CI) INITIATIVES

All five stay inside the vanilla / no-build constraint locked with the owner.

### Initiative 1: Unified Cross-PWA Ergonomic Floor & Its Gate

- **Description:** one written 44×44 touch floor for all five apps, enforced by
  a gate in **every** repo — not four different levels of coverage. Concretely:
  port `Cross-Household-`'s `check-a11y.mjs` pattern into `Mikes-Cookbook`
  (which has none), and extend `4-Weeks-to-Open-`'s `check-journey.js` with a
  chrome-control pass beyond its 9 session pages. Add **320px** to every matrix.
- **Value:** closes the audit's spine finding — the apps used with compromised
  hands have the weakest enforcement. Turns a documented "known, not fixed"
  into an enforced floor.
- **Impacted repos:** all five (`MC-Training-Rolodex` inherits by construction).
- **Constraint fit:** plain Playwright-in-CI scripts, the exact pattern three of
  these repos already run. No runtime code, no build step.

### Initiative 2: Offline-Honest Sync — Vendor the Supabase SDK

- **Description:** both the cookbook and the workout app load
  `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` at runtime. Cross-origin, so
  the service worker cannot precache it; on a cold offline launch sign-in is
  silently unavailable. Vendor a pinned copy into each repo, add it to the
  precache list, and give the sync layer a visible offline state.
- **Value:** the only remaining hole in an otherwise solid offline story, on the
  two apps most likely to be opened in a basement gym or a kitchen with bad Wi-Fi.
- **Impacted repos:** `Mikes-Cookbook`, `4-Weeks-to-Open-` (→ Rolodex).
- **Constraint fit:** a vendored `.js` file plus a `build-sw.py` run. No bundler.
- **Decision required:** vendoring pins the SDK version and takes on update
  duty. **`AskUserQuestion` gate before implementing.**

### Initiative 3: One Shared Chrome — Topbar, Back Control, Tour Dots

- **Description:** the same three controls are undersized in different ways in
  different repos (`a.back` 36×36 on four workout pages; `.r-back` 42×21 and
  `.col-back` 57×19 in the cookbook; topbar icons compressing to 26.6px at 320).
  Define each **once** per repo — `base.css` / `cookbook.css` — following the
  precedent `F3-2` set by moving `.mc-day-back` into `base.css`, and the rule
  `check-single-impl.js` already enforces for shared JS.
- **Value:** four-page patches are how six divergent `makeRestTimer` bodies came
  to exist. One definition cannot drift.
- **Impacted repos:** `4-Weeks-to-Open-`, `Mikes-Cookbook`.
- **Constraint fit:** CSS only.

### Initiative 4: Cross-App Unified Financial Data Bridge (`Cross-Household-` ↔ `household-finance`)

- **Description:** the workout↔cookbook bridge (`mc-bridge.js`: one read-only,
  byte-identical module, one writer per store, CI drift gate in both repos) is a
  proven pattern in this fleet. The finance pair has **no runtime bridge** —
  only `check-sync-drift.mjs`, a *source-similarity* gate, which is a different
  thing entirely.
- **Honest scoping — read before planning this:** the two finance apps are
  **deliberately divergent**, not two copies. Fixed two-person `WHO` vs. dynamic
  `data.members`; real data vs. fictional demo; Cross-only Direct Deposit and
  Monthly Report. A *data* bridge between a private real household and a public
  demo is **not obviously desirable and may be actively wrong**.
  The defensible version is a **shared-module** bridge — formatting, money math,
  chart primitives — held byte-identical and gated, exactly as `mc-bridge.js` is.
  **This initiative must not begin without an `AskUserQuestion` gate**
  establishing which of the two it is.
- **Impacted repos:** `Cross-Household-`, `household-finance`.

### Initiative 5: The Feature Registry, Fleet-Wide (identified during the Gemba walk)

- **Description:** the finance apps' `js/features.js` — one array driving **both**
  the Quick Tour and the Executive Summary's feature grid — is the best
  onboarding pattern in the fleet: a screen cannot drift out of the two places
  users learn about it, because there is one list. The cookbook and workout apps
  have **hand-authored** tour pages (`quick-tour.html`,
  `quick-tour-overview.html`, nine `<id>-instructions.html`) kept current only by
  a documentation *rule*, not a mechanism.
- **Value:** converts a discipline into a gate. The workout repo already proved
  the failure mode this prevents — `F6` retired an instructions build pipeline
  precisely because two copies of the same guide could drift.
- **Impacted repos:** `Mikes-Cookbook`, `4-Weeks-to-Open-` (→ Rolodex).
- **Constraint fit:** a data file plus a render function; a `--check` gate
  asserting every registered screen appears in the tour. No build step.
- **Caution:** the workout app's guides are long-form authored prose, not
  blurbs. The registry should govern **coverage** (is every screen represented?)
  rather than replace authored content — `F6`'s lesson was that inlining
  authored guides made things worse, not better.

---

## 5. REPO-BY-REPO INDIVIDUAL SESSION EXECUTION PLAN

How to run one focused session per repository from this roadmap.

### Before any session (all repos)

1. Read this file's wave block for the target repo **and** that repo's own
   `CLAUDE.md`. Where they disagree, **`CLAUDE.md` wins** — it is closer to the
   code and this document is a snapshot dated 2026-08-30.
2. Confirm the branch. All five repos develop on `claude/new-session-5wgq7w`
   unless the session is told otherwise.
3. Re-measure before fixing. Every number here is dated; a wave may already be
   closed. **Do not fix a number you have not re-observed.**
4. Waves are sequential *within* a cluster. Between waves, use
   `AskUserQuestion` — the mid-project check-in that all five repos' planning
   rules preserve.

### `4-Weeks-to-Open-` (Waves 0–4) — master workout repo

```bash
cd /home/user/4-Weeks-to-Open-
for f in $(git ls-files '*.js'); do node --check "$f" || echo "FAIL $f"; done
python3 tools/build-market.py --check
node tools/check-journey.js http://localhost:8080      # needs a server + Playwright
```

- Land **all** workout work here. Never push to `MC-Training-Rolodex`.
- New program? Follow the New Program Creation Workflow in `CLAUDE.md` exactly.
- User-facing change? The Documentation currency rule applies in the same PR.
- **Sandbox limit:** `check-contrast.js --update` and the visual ratchet
  `--update` are **not trustworthy from an agent sandbox** (blocked webfonts →
  fallback metrics). Enforcing runs are fine; re-baseline from CI.

### `MC-Training-Rolodex` (Waves 0–4, downstream)

- **Open no PR here.** `main` has unrelated history and is force-pushed by
  `market-deploy.yml`.
- Its only session-worthy task is **verification**: after a Rolodex-affecting
  merge, confirm no licensed content or internal doc reached the public build
  (Wave 0, W0-1).

### `Mikes-Cookbook` (Waves 5–8)

```bash
cd /home/user/Mikes-Cookbook
for f in $(git ls-files '*.js'); do node --check "$f" || echo "FAIL $f"; done
node tools/validate-recipes.js && node tools/check-docs.js
node tools/test-mc-timers.js && node tools/test-mc-data.js
python3 tools/build-sw.py --check && node tools/build-data.js --check
python3 -m http.server 8765 & node tools/smoke-test.js
```

- Wave 6 is the highest-value work in this roadmap; Wave 8's gate is what keeps
  it. **Do not ship Wave 6 without Wave 8** — an unguarded fix regresses.
- Recipe change? `node tools/build-data.js` (no page loads `recipes-data.js`).
- New top-level file? `python3 tools/build-sw.py` and bump the version.

### `Cross-Household-` (Waves 9–12) — private, real data

```bash
cd /home/user/Cross-Household-
node scripts/run-tests.mjs
node scripts/check-token-drift.mjs && node scripts/check-doc-drift.mjs
CHROMIUM_PATH=/path/to/chrome node scripts/check-a11y.mjs
```

- Never expose this repo; never paste real figures into a PR body.
- Manifest-covered file changed? Port to `household-finance` **and** refresh the
  sync baseline against a real `origin/main` worktree.
- UI/UX-visible change? Update `js/features.js` **first**.

### `household-finance` (Waves 13–16) — public demo

```bash
cd /home/user/household-finance
node scripts/run-tests.mjs
node scripts/check-token-drift.mjs && node scripts/check-doc-drift.mjs
CHROMIUM_PATH=/path/to/chrome node scripts/check-a11y.mjs
```

- Never add real data. `seed()` stays fictional.
- Pair Wave 13/15 changes with the matching `Cross-Household-` PR so
  `sync-drift` sees one deliberate divergence.
- Don't port Direct Deposit or Monthly Report casually — see W10-1.

### Suggested session sequence

| Session | Repo | Waves | Why here |
|---|---|---|---|
| 1 | `Mikes-Cookbook` | 5–6 | Largest measured gap, highest user impact |
| 2 | `Mikes-Cookbook` | 7–8 | The gate that protects session 1 |
| 3 | `4-Weeks-to-Open-` | 0–2 | Manifest leak + library ergonomics |
| 4 | `4-Weeks-to-Open-` | 3–4 | Ergonomics + the gate that guards them |
| 5 | `Cross-Household-` | 9–12 | Smallest gap; mostly verification |
| 6 | `household-finance` | 13–16 | Paired with 5; closes sync baseline |

Sessions 1–2 lead because the cookbook has **no ergonomic gate at all** and its
worst controls sit on its hands-free screen — the largest measured
risk-to-coverage gap in the fleet.

---

## Appendix A — Method & Limits

**How findings were produced.** Headless Chromium (Playwright), viewports 390×844
and 320×844, `isMobile`/`hasTouch` on. Every `button`, `a[href]`, `[role=button]`,
`[role=checkbox]`, `input`, `select`, `summary` was measured via
`getBoundingClientRect()`, filtering hidden/zero-size elements. Horizontal
overflow was measured as `documentElement.scrollWidth` against viewport width,
with the widest offending element identified. Console and page errors were
captured per navigation.

**Limits — stated so no reader over-trusts this document.**

1. **Not real devices.** Headless Chromium is not iOS Safari. The real-device
   matrix stays owner-side.
2. **Webfonts are blocked** from this sandbox at the *browser* level — `curl`
   returns 200, Chromium does not. Text metrics therefore differ from CI, so no
   contrast or visual ratchet was re-baselined here, and none should be from a
   sandbox.
3. **`net::ERR_FAILED` / `ERR_TUNNEL_CONNECTION_FAILED` entries observed during
   the walk were caused by this sandbox's egress policy** (blocked webfonts and
   the jsdelivr CDN) and by the harness's own request blocking. **They are not
   application defects and are not reported as findings.** The one real
   conclusion drawn from them — that the Supabase SDK is a cross-origin CDN
   script outside the precache — was confirmed independently in source.
4. **Seeded/default state only.** Apps were driven in their default data state;
   deep flows requiring seeded custom programs or a signed-in account were not
   exercised.
5. **Two-device sync was not tested** and no wave claims it was.
