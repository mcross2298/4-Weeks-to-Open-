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

### The second finding: a stale offline shell in both finance apps

The service-worker `SHELL` in **both** finance repos still precaches
`./js/store.js` — a file deleted when the store was split into `js/store/*.js` —
plus `./js/views/plan.js`, which never existed. Neither lists a single one of the
real store files. The install handler swallows both 404s with
`.catch(() => {})`, so nothing has ever surfaced it.

The fetch handler caches at runtime, which masks the gap **only if the user
happened to be online long enough**. That makes offline correctness a race:

| Online warm-up before going offline | `Cross-Household-` | `household-finance` |
|---|---|---|
| 800 ms | OK | OK |
| 3 s | OK | **BLANK** |
| 8 s | OK | OK |

The public demo renders a **white screen with no error message** on a reload
after losing connection. This is the one finding in the audit that is a live,
reproducible functional defect rather than an ergonomic or coverage gap — and
`check-sync-drift.mjs` could not catch it, because it compares source
similarity, not behaviour.

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
| Internal planning docs served from public build | **3** at HTTP 200 (incl. `CLAUDE.md`) |
| Scripts missing from the offline shell | **13** (`household-finance`), **12** (`Cross-Household-`) |
| Offline reload of the public demo | **non-deterministic** — blank in 1 of 3 runs |
| Interviews conducted | **25** (5 profiles × 5 repos) |
| Declared capabilities demo-verified | **59 of 60 true, 0 false** (1 unverifiable locally) |
| CI initiatives proposed | **24** (21 repo-specific, 3–5 each, + 3 cross-cutting) |

---

## 2. VOC / VOA INTERVIEW SYNTHESIS

**25 interviews — 5 associate profiles × 5 repositories.** Every persona was run
against every application separately, because the same profile hits genuinely
different walls in different apps. Each quote below is tied to a **measured**
observation; nothing here rests on an unmeasured impression. Where a persona
found nothing wrong, that is recorded as a finding too.

### 2.0 Quick Tour verification — every declared capability, demoed

**This is the Gemba walk proper.** Before interviewing anyone, every capability
each app *declares* was extracted from its own onboarding surface and then
**driven in a real browser** to confirm it actually does what it claims.

Claims were taken from the authoritative source in each app, not paraphrased:
the workout tour's 18 rendered steps, the cookbook's `SLIDES` array (12), and
each finance app's `js/features.js` registry (16 and 14).

| Application | Declared capabilities | Source of truth | Verified true | Unverifiable here | False |
|---|---|---|---|---|---|
| `4-Weeks-to-Open-` | 18 | `quick-tour.html` steps | **17** | 1 | 0 |
| `MC-Training-Rolodex` | 18 (inherited) | same tour, public build | **18** link-integrity | — | 0 |
| `Mikes-Cookbook` | 12 | `SLIDES` in `quick-tour.html` | **12** | 0 | 0 |
| `Cross-Household-` | 16 | `js/features.js` | **16** | 0 | 0 |
| `household-finance` | 14 | `js/features.js` | **14** | 0 | 0 |
| **Total** | **60** | | **59 demoed true** | **1** | **0** |

**The headline result: not one declared capability turned out to be false.**
Every tour and every feature blurb describes something the app actually does.
For a fleet this size with hand-authored onboarding, that is a genuinely strong
result and it should be stated before any finding.

**What "verified" means here** — these were functional demos, not presence
checks. A sample of what was actually driven:

- **Logging a set** (`W7`): checked a real set box on `kitchen-sink.html?day=1`
  and confirmed `mc_setlog_v1` was written — `{"kitchen-sink|x-bb-flat-bench-press":
  [{"d":"Aug 30","sets":{"1":{"w":…` — with the rest-timer chip present.
- **Pinning a program** (`W3`/`W5`): drove the complete journey — Choose Program →
  sheet → confirm — and watched `mc_active_prog` become
  `{"id":"ss","name":"Strength & Supersets"…}` and the dashboard hero re-render as
  **Week 1 · DAY 1–5 · REST · REST**, then **DAY 1 · WEEK 1 — Legs — 8 Exercises**.
  That is `F0`'s day module, with its real rest pattern, reached the way a user
  reaches it.
- **Scaling a recipe** (`C4`): tapped the serving stepper and confirmed the
  ingredient panel re-rendered as *"Scaled live from 2 servings"*.
- **Search** (`C3`): typed `"chicken broccoli"` and confirmed results render with
  the `rc-match-badge` — the "matched: ingredient" badge — proving the ranked
  search path, not a substring scan, produced them.
- **Favorites persistence** (`C10`): tapped a heart and read
  `mc-cookbook:favorites = ["jalapeno-chicken-bake"]` back out of storage.
- **The ⋮ menu** (`W8`): opened it and confirmed Replace, Reorder and Notes are
  all present.
- **Offline** (`C11`): reloaded with the network cut and confirmed the cookbook
  still rendered 1,576 characters of app.

**The one unverifiable claim.** `4-Weeks-to-Open-`'s *"Install & train offline"*
(`W17`) could not be confirmed locally: the service worker is registered and
active, but `sw.js` carries a hardcoded production-origin guard in its fetch
handler, so offline behaviour is only observable on the deployed origin. This is
pre-existing and already documented in `CLAUDE.md`. **Recorded as unverified, not
as working, and not as broken.**

**Tour link integrity — including in the public build.** Every internal link in
both tours was resolved against both builds. All 7 workout targets
(`dashboard`, `cat-strength`, `workout-logs`, `build-workout`, `quick-pump`,
`exercise-library`, `quick-tour-overview`) and all 4 cookbook targets return
HTTP 200. Critically, **no tour link points at a page the market build strips** —
a real risk given 40 pages are removed, and it holds.

---

### The one copy defect the demo pass found

**`4-Weeks-to-Open-` — the dashboard's empty state misdirects the user.**

`dashboard.html:1412` renders:

> *"Open any program below and tap 'Set as Active' to pin it here."*

Following that literally sends the user to a program landing (`cat-strength.html`
and its nine siblings), where the only comparable control is **"Start Program"**.
There is no "Set as Active" there. Measured: the sole matching control on that
landing is `["Start Program"]`.

The real affordance is **on the dashboard itself** — the "Choose Program" /
"See all" sheet (`.ps-overlay`), whose confirm button pins the program. Driven
end to end, that path works perfectly.

**The Quick Tour gets this right** — it says *"Tap 'See all,' and a sheet slides
up with every program… hit Set as Active Program"*, which is accurate. So this is
**not** tour drift: it is the dashboard's own empty-state copy contradicting the
tour and the UI. Fix is a one-line copy change pointing at "Choose Program".

*Severity: low. Impact: highest on the Casual / Low-Tech persona, who follows
instructions literally and has no model of where else to look.*

---

### A note on method, because it changed the findings

**Seven apparent failures in this pass were my own measurement bugs, not app
defects**, and each was chased down before being written up. They are worth
listing, because a less careful pass would have filed all seven as bugs:

| Apparent failure | Reality |
|---|---|
| Cookbook tour "doesn't advance" | It is a **scroll page**, not a stepper — all 12 slides render at once |
| Browse search "returns 0 results" | Results render as `.rc`, which my `[class*=card]` selector missed |
| Recipe "doesn't scale" | I sampled **macros**, which are per-serving constant **by design** |
| Tracker "won't open" | My harness reused one page; the SPA didn't re-route. Fresh load works |
| Workout tour "has 0 headings" | Titles are `h1`, my selector looked for `h2`/`h3` |
| "No day-by-day schedule" | It lives on the **dashboard** since `F0`, not the landing |
| Debt "missing snowball/avalanche" | Present — my text capture truncated before that section |

The correction applied was **one fresh browser context per claim**, since SPA
state bleed between probes caused three of the seven. Every remaining pass or
fail in the matrix above was re-observed after that fix.


### Profiles

| # | Profile | Focus |
|---|---|---|
| A1 | Daily Power User | Speed, shortcuts, rapid entry, input efficiency |
| A2 | Mobile-First / On-the-Go | Touch targets, responsiveness, offline reliability |
| A3 | Data & Analytics Enthusiast | Reporting accuracy, charts, exports, modelling |
| A4 | Casual / Low-Tech | Onboarding clarity, hierarchy, error recovery |
| A5 | Cross-Device / Sync | State persistence, cache updates, multi-device |

---

### 2.1 `4-Weeks-to-Open-` — Workout (master)

**A1 · Daily Power User**
> *"Logging sets is genuinely fast now. It's everything around the logging that costs me time — I miss the topbar icons because they get smaller as my screen gets smaller."*

- The session surface is the most refined thing in the fleet; the `S1`–`S5c`
  runtime work (mutation records −99.5%) is felt as real responsiveness.
- **Measured:** `.topbar-icon` is 34.9 × 40px at 390 and **26.6 × 40 at 320** —
  it compresses instead of scrolling. Primary navigation.
- **Measured:** `.filter-btn` on `exercise-library.html` is **27px tall**, 20 on
  screen — the main way to narrow 577 exercises.
- **Ask:** a between-sets entry path that doesn't require a 27px target.

**A2 · Mobile-First**
> *"Nothing has ever needed side-scrolling. That's rarer than it sounds."*

- **Measured:** **0 horizontal-overflow defects across all 141 pages** at 390,
  and 0 at 320 on the 11 walked pages. The `F3-4` fix holds fleet-wide.
- **Measured:** offline reload could **not** be verified locally — `sw.js`
  carries a hardcoded production-origin guard in its fetch handler, so offline
  behaviour is only observable on the deployed origin. Pre-existing and
  documented; recorded as **UNVERIFIED**, not as working.
- **Measured:** `.mc-nav-tab` 78 × **42** on **125 pages** — two pixels under.

**A3 · Data & Analytics**
> *"I trust the numbers. I can't see what the app looks like in dark mode to anyone auditing it."*

- **Measured:** `check-contrast.js` is a **light-mode ratchet**; dark-mode
  contrast is unmeasured end to end — the repo's own `P3`/`P5` notes say so.
- **Measured:** `.wl-tab` on `workout-logs.html` is **38px tall**; `.ntx-ico` on
  the nutrition tab **38 × 38**.
- **Recorded gap:** `measure-session.js` reports `timer confirmed running:
  false` on `mm-p1.html` — the perf budget measures idle, not the load it names.

**A4 · Casual / Low-Tech**
> *"The dots that move me through the tour are smaller than a grain of rice — and the tour is the first thing I ever touched."*

- **Measured:** `quick-tour.html` `.dot-nav` = **8 × 8px** (22×8 active). The
  smallest interactive control in the entire fleet, on the onboarding surface.
- **Measured:** `a.skip` 47 × **30**; `a.back` **36 × 36** on four pages.
- **Positive:** an onboarding overlay (`ps-overlay`) does auto-present on clean
  storage — the entry path exists and fires.

**A5 · Cross-Device / Sync**
> *"One phone is flawless. I can't prove the second one."*

- **Measured:** `mc-supabase.js:32` loads the SDK from `cdn.jsdelivr.net` at
  runtime — cross-origin, so `sw.js` **cannot** precache it. Sign-in is
  unavailable on a cold offline launch and fails silently.
- **Measured:** only `mc_device_id` is written on a first visit — clean.
- **UNVERIFIED:** two-device Supabase reconciliation. Owner-side, open since `B5`.

---

### 2.2 `MC-Training-Rolodex` — Workout (public build)

**A1 · Daily Power User**
> *"Same app, same friction. It inherits everything."*

- **Measured:** 101 HTML pages vs. the master's 141 — 40 licensed pages
  correctly stripped. Every ergonomic finding in 2.1 is inherited by
  construction; none is separately fixable here.

**A2 · Mobile-First**
> *"Identical build, so identical behaviour — but nothing checks that."*

- **Measured:** `MC-Training-Rolodex` has **no `.github/workflows` directory at
  all**. Zero gates run against the public artifact. It is force-pushed by
  `market-deploy.yml`, and the *master's* CI is the only thing verifying it.

**A3 · Data & Analytics**
> *"I can read your internal roadmap from the public site."*

- **Measured, HTTP 200 from the served build:** `pm-rename-design.md`,
  `readiness-stats-roadmap.md`, **and `CLAUDE.md`** — internal architecture and
  planning history, publicly fetchable.
- **Verified — and this bounds the finding:** a brand-term scan of every served
  `.md` using the manifest's own 10 terms returns **0 hits**. `.md` *is* in
  `build-market.py`'s `TEXT_EXT` and the leak scan does cover it. **This is an
  internal-document disclosure, not a licensed-content leak.** The gate is
  working exactly as designed; the manifest's `scratch` list is incomplete.

**A4 · Casual / Low-Tech**
> *"The tour made it over intact."*

- **Measured:** 9 tour + instruction pages present in the public build —
  onboarding parity with the master is genuinely good.

**A5 · Cross-Device / Sync**
> *"Whatever ships here, ships unverified."*

- The public build is a force-pushed artifact with no post-deploy check. A
  regression introduced by the extraction itself — not by the master's source —
  would reach users with nothing standing in the way.

---

### 2.3 `Mikes-Cookbook` — Recipe & Cookbook

**A1 · Daily Power User**
> *"Search finally understands me. Adding to the plan is what slows me down."*

- **Positive:** `mc-search.js` handles `"chicken broccoli"` and `"chiken"`,
  which the old scan returned zero results for, at ~4–8 ms/query.
- **Measured:** `.fav-toggle` / `.plan-toggle` on collection cards are
  **34 × 34** — the two highest-frequency taps in the browse flow.

**A2 · Mobile-First**
> *"Cooking Mode is why this app is on my counter, and it has the smallest buttons in it. My hands are covered in chicken."*

- **Measured, all in Cooking Mode:** daylight toggle **32 × 32**; font ± **40 ×
  32**; voice toggle **40 × 32**; Exit **53 × 18**.
- **Measured:** the serving stepper `±` is **40 × 40** — the most-tapped control
  during actual cooking.
- **Positive:** offline reload **rendered correctly**; `?cook=1` opens Cooking
  Mode directly; 0 horizontal overflow on all 8 screens at both widths.

**A3 · Data & Analytics**
> *"The grocery maths is honest about its own estimates. I like that."*

- **Positive:** `MCUnits` tags every density-derived conversion (`viaDensity`)
  so the UI can show its work; the fragmentation ratchet stands at **179/854**
  and may only fall.
- **Positive:** backup format v2 round-trips, pinned by `test-mc-export.js`.
- **Measured gap:** `:photos` is deliberately unsynced, so a cook's photos exist
  in the backup file but never cross devices — correct by design, invisible in UI.

**A4 · Casual / Low-Tech**
> *"The thing telling me to take the tour has a dismiss button I can't hit."*

- **Measured:** `.backup-banner-dismiss` = **17 × 23px**; its CTA
  ("Take the tour →") is 118 × **30**.
- **Measured:** `.home-search-btn` / `.home-workout-btn` / `.home-account-btn`
  are **40 × 40** on **every** shell screen.
- **Measured:** `.r-back` ("‹ Back") is 42 × **21**; `.col-back` 58 × **19.5**.

**A5 · Cross-Device / Sync**
> *"The timer survives everything. The sign-in doesn't survive a bad kitchen Wi-Fi."*

- **Positive, verified live:** a running timer survived a full navigation from
  `recipe.html` to `index.html` with its store intact — the absolute-instant
  (`endsAt`) design works.
- **Measured:** identical `cdn.jsdelivr.net` SDK dependency to the workout app;
  `sw.js` precaches the local `mc-supabase.js` wrapper but not the SDK.
- **Measured:** **zero** of the 14 CI gates measures a target, a ratio, or a width.

---

### 2.4 `Cross-Household-` — Personal Finance (private, real data)

**A1 · Daily Power User**
> *"Sixteen screens, nothing broken. I have no speed complaint."*

- **Measured:** all 16 routes clean at 390 **and** 320 — zero console errors,
  zero overflow. Inputs and selects render at 46px, above the floor.
- The strongest-built app in the fleet on this axis. No A1 finding.

**A2 · Mobile-First**
> *"It works offline. I just found out that's partly luck."*

- **Measured:** offline reload succeeded **3/3** across 800 ms / 3 s / 8 s
  warm-up windows.
- **Measured, latent:** `sw.js`'s `SHELL` still precaches **`./js/store.js`** —
  a file deleted when the store was split into `js/store/*.js` — plus
  `./js/views/plan.js`, which does not exist. **None of the 8 real store files
  is precached**, nor `ui.js`, `features.js`, `tour.js`, `summary.js`. The
  install handler's `.catch(() => {})` swallows both 404s silently. Offline
  works here only because the fetch handler caches at runtime and this app won
  the race — see 2.5, where the identical bug produces a blank app.

**A3 · Data & Analytics**
> *"The Excel bridge holds. The deepest screen in the app is measured at one width."*

- **Positive:** money-math suite green; `check-doc-drift.mjs` keeps
  `CSV_HEADER` / `CATEGORIES` honest against `00-state.js`.
- **Measured:** Monthly Report (`#/report`) is Cross-only and the most
  analytically dense surface here — `check-a11y.mjs` runs **390px only**.

**A4 · Casual / Low-Tech**
> *"The tour found me on my own. That's the best onboarding of the five."*

- **Measured:** a real modal tour auto-presents on clean storage.
- **Positive:** both onboarding surfaces render from the single
  `js/features.js` registry, so a screen cannot drift out of the two places
  users learn about it. **The best onboarding pattern in the fleet.**
- **Measured:** `check-a11y.mjs` passes 16 routes × **2 themes** — light and
  dark both enforced, which the workout app does not do.

**A5 · Cross-Device / Sync**
> *"Two devices remains a promise, not a proof."*

- **Positive:** `check-sync-drift.mjs` makes divergence from the public template
  deliberate rather than accidental.
- **Measured:** only 2 localStorage keys after a first visit — a tidy surface.
- **UNVERIFIED:** real two-device Supabase reconciliation (Phases 1–3 applied).

---

### 2.5 `household-finance` — Financial Demo (public, fictional data)

**A1 · Daily Power User**
> *"Fourteen routes, all clean. Nothing to report."*

- **Measured:** 14 routes, zero errors, zero overflow at both widths. No A1
  finding — recorded as a pass, not padded into a complaint.

**A2 · Mobile-First**
> *"I lost signal, reloaded, and got a white screen. On the app that's supposed to sell the others."*

- **Measured and reproduced — the sharpest defect in this audit:** offline
  reload is **non-deterministic**. Across three identical runs differing only in
  online warm-up time: **OK (1673 chars) / BLANK (53 chars) / OK**. The blank run
  threw `ReferenceError: CATEGORIES is not defined` and
  `ReferenceError: Store is not defined`.
- **Root cause, confirmed in source:** `sw.js`'s `SHELL` precaches
  **`./js/store.js`** (deleted in the store split) and `./js/views/plan.js`
  (nonexistent). **13 scripts the app actually loads are absent from the
  shell** — all 9 `js/store/*.js`, plus `ui.js`, `features.js`, `summary.js`,
  `tour.js`. The install handler swallows the 404s; the fetch handler's runtime
  caching masks the gap **only if the user happened to be online long enough**.
- This is the same latent bug as 2.4 — here it actually fires.

**A3 · Data & Analytics**
> *"I tried to tap a slice and there was nothing to tap."*

- **Measured:** a dashboard donut segment carrying a real `aria-label`
  ("View Sam transactions") renders at **8.8 × 0.6px**.
- **Formally exempt** under the repo's own documented WCAG 2.5.8 rule (the 44px
  legend button is the equivalent target) — so a UX observation, **not a gate
  violation**. But this is the *demo*: it is the surface an evaluator touches.

**A4 · Casual / Low-Tech**
> *"Good tour. Then a blank screen the second time I opened it on the train."*

- **Positive:** same auto-presenting modal tour and same `features.js` registry
  as 2.4 — onboarding is a strength.
- The A2 defect lands hardest on this persona: a blank app offers no error, no
  explanation, and no recovery path.

**A5 · Cross-Device / Sync**
> *"The docs describe sync that isn't there. I couldn't tell until I read the code."*

- **Measured:** `MIGRATION.md` / `STORAGE.md` / `SUPABASE.md` describe a cloud
  sync layer; **nothing in `js/` implements it** — no `supabase/` directory, no
  client code. `SUPABASE.md` self-labels as draft; the other two do not.
- **Measured:** this repo has **no `sync-drift` job** (correct — it is the
  downstream side), so nothing here detects divergence from `Cross-Household-`.

---

### Top common pain points

1. **Sub-44px controls concentrated on the screens used with compromised hands**
   — cookbook Cooking Mode, workout Quick Tour, both topbars.
2. **Ergonomic gate coverage inverted against ergonomic risk** — full coverage
   on the desk apps, 6.4% on the gym app, zero on the kitchen app.
3. **A stale service-worker shell in both finance apps** — reproduced as a blank
   offline app on the public demo, latent on the private one.
4. **Cross-origin CDN auth** breaks the offline story in cookbook and workout.
5. **320px is correct everywhere and guarded nowhere** — no gate in any of the
   five repos measures below 390.
6. **Documentation that no doc-drift gate is scoped to catch** — the 48-vs-44
   claim, and `household-finance`'s unshipped-sync docs.

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
- **W0-3 — Quick Tour verification is DONE and passed (see 2.0).** All 18
  declared steps were demoed; 17 verified true, 1 (offline) unverifiable
  locally by design. No tour claim is false. Tour link integrity holds in both
  the master and the public build.
- **W0-4 — one copy defect to fix.** `dashboard.html:1412` tells the user to
  "Open any program below and tap 'Set as Active'", but that control lives in
  the dashboard's own "Choose Program" / "See all" sheet; program landings offer
  "Start Program". The Quick Tour is correct; the empty-state copy is not.
  One-line fix.
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
- **W5-3 — Quick Tour verification is DONE and passed (see 2.0).** All 12
  declared slides demoed true, including recipe scaling, ranked search, planner,
  tracker, favorites persistence, Cooking Mode deep link and offline reload.
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
- **W11-3 — repair the stale service-worker shell (`X-I1`).** `SHELL` precaches
  `./js/store.js` (deleted in the store split) and `./js/views/plan.js`
  (nonexistent), and omits all 8 real store files plus `ui.js`, `features.js`,
  `tour.js`, `summary.js`. Offline works here today only by runtime-cache luck.
- **UNVERIFIED:** true two-device reconciliation. Owner-side.
- **DoD:** baseline refreshed against `main`; `SHELL` matches `index.html`'s
  script tags, enforced by a static gate; sync status re-stated accurately.

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

- **W13-0 — the offline shell is broken, and it fires (`H-I1`). Take this first.**
  Offline reload is **non-deterministic**: across three identical runs varying
  only in online warm-up, results were **OK / BLANK / OK**, the blank run
  throwing `ReferenceError: Store is not defined`. `sw.js`'s `SHELL` precaches
  `./js/store.js` (deleted) and `./js/views/plan.js` (nonexistent) while omitting
  **13** scripts the app actually loads. The install handler's `.catch(() => {})`
  swallows the 404s; runtime caching masks the gap only if the user was online
  long enough. **A blank screen with no error is the worst first impression the
  demo app can give.**
- **Verified clean otherwise:** 14 routes, zero console errors, zero horizontal
  overflow at 390 and 320. `check-a11y.mjs` passes 14 routes × 2 themes.
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

**24 initiatives — 21 repo-specific (3 to 5 each) plus 3 cross-cutting.** Every one is
derived from a numbered finding in Section 2, and every one stays inside the
vanilla / no-framework / no-build-step constraint locked with the owner. Node
and Python check scripts are the only tooling any initiative may add.

Each carries an **effort** estimate (S / M / L) and names the finding it answers.

---

### 4.1 `4-Weeks-to-Open-` — Workout (master) · 5 initiatives

**W-I1 · Chrome-control pass for the journey gate** — *answers A1, A2, A4* · **M**
Extend `check-journey.js` beyond its 9 session pages with a **chrome-control
pass** covering topbar, back controls, nav tabs and the tour, and add **320px**
alongside 390. Today 141 of 141 pages carry a sub-44 control and the gate sees
none of them. *Value:* the ergonomics work in Wave 3 is unguarded without this —
a fix that no gate holds is a fix that regresses.

**W-I2 · Shared chrome consolidation** — *answers A1, A4* · **S**
`.mc-nav-tab` (125 pages) and `.back-link` (114 pages) are two rules in
`base.css`, not 239 page edits. Follow the precedent of moving `.mc-day-back`
into `base.css` in `F3-2`. *Value:* highest fix-to-reach ratio in the audit;
per-page patching is exactly how six divergent `makeRestTimer` bodies arose.

**W-I3 · Dark-mode contrast gate** — *answers A3* · **M**
`check-contrast.js` is a **light-mode ratchet**; dark-mode contrast is unmeasured
end to end, which the repo's own `P3`/`P5` notes state plainly — and dark is the
default the athlete actually trains in. Add a dark pass. *Value:* closes the one
axis where a regression is currently invisible to CI.
*Caveat:* must be baselined **from CI**, never an agent sandbox — blocked
webfonts change text metrics.

**W-I4 · Perf-probe integrity** — *answers A3* · **S**
`measure-session.js` reports `timer confirmed running: false` on `mm-p1.html`,
so that budget measures idle rather than the rest-timer load it claims. Fix the
probe, then re-baseline deliberately. *Value:* a green gate that measures the
wrong thing is worse than no gate — it manufactures false confidence.

**W-I5 · Topbar that scrolls instead of compressing** — *answers A1* · **S**
`.topbar-icon` narrows 34.9 → 26.6px between 390 and 320. Five 44px cells cannot
fit 320px, so no padding tweak works. **Reuse `F0`'s solved pattern**
(`flex: 1 0 44px` + `overflow-x: auto`) rather than re-deriving it.

---

### 4.2 `MC-Training-Rolodex` — Workout (public build) · 3 initiatives

> All three are about the **build and its verification**, never source — this
> repo is force-pushed and is never a place to land a fix.

**R-I1 · Manifest completeness gate** — *answers A3* · **S**
`build-market.py --check` verifies licensed content and brand terms, and passes.
It does **not** assert that every root document is *classified*. Add a check that
fails when a root `.md` is neither scratch-listed nor explicitly marked
shippable. *Value:* `pm-rename-design.md`, `readiness-stats-roadmap.md` and
`CLAUDE.md` are served at HTTP 200 from the public build today; a classification
gate makes that a deliberate choice rather than an omission.

**R-I2 · Post-deploy verification of the public artifact** — *answers A2, A5* · **M**
The Rolodex has **no workflows at all** — nothing verifies the thing users
actually load. Add a minimal post-deploy job (shell boots, no console errors, no
404 on a precached asset, leak re-scan). *Value:* today a defect introduced by
the *extraction* rather than the source would ship unopposed.

**R-I3 · Pages-artifact strip parity** — *answers A3* · **S** · **decision first**
`pages.yml` strips only `*.dc.html` and one page, so scratch-listed files are
excluded from the Rolodex but still published to GitHub Pages from the master.
Either accept deliberately or extend the strip step to honour `scratch`.
*Value:* one disclosure rule instead of two that disagree.

---

### 4.3 `Mikes-Cookbook` — Recipe & Cookbook · 5 initiatives

**C-I1 · The cookbook's first accessibility gate** — *answers A2, A4* · **M**
Port the `check-a11y.mjs` pattern (routes × themes × 44px + contrast) to the
hub-and-spoke shell and standalone pages, **with Cooking Mode as an explicit
route** — it is drivable via `recipe.html?id=<id>&cook=1`, exactly the mechanism
a gate needs. *Value:* closes the single largest coverage gap in the fleet: 14
blocking gates, none measuring a target, a ratio, or a width.
*Rule:* prove it fails on the pre-fix tree before landing it.

**C-I2 · Cooking Mode ergonomic refit** — *answers A2* · **S**
Daylight toggle 32×32, font ± 40×32, voice 40×32, Exit 53×18 → 44 minimum.
*Value:* Counter Mode exists *because* this screen is used at arm's length in
bad light with dirty hands; 32px controls contradict the feature's own rationale.

**C-I3 · Offline-honest authentication** — *answers A5* · **M** · **decision first**
Vendor a pinned Supabase SDK into the repo and precache it, replacing the
runtime `cdn.jsdelivr.net` fetch the service worker cannot cache; give the sync
layer a visible offline state. *Value:* the one hole in an otherwise solid
offline story. *Trade-off:* vendoring pins the version and takes on update duty.

**C-I4 · Feature registry + tour-coverage gate** — *answers A4* · **M**
Adopt the finance apps' `features.js` pattern — one array, rendered by both the
tour and an overview — plus a `--check` asserting every registered screen appears
in `quick-tour.html`. *Value:* converts the Documentation currency *rule* into a
*mechanism*. *Caution:* govern **coverage**, not authored prose — `F6` reversed
an inlining pipeline for exactly that reason.

**C-I5 · High-frequency card controls** — *answers A1* · **S**
`.fav-toggle` / `.plan-toggle` at 34×34 are the two most-tapped controls in the
browse flow. They render through the shared `mc-cards.js`, so **one** fix covers
the shell and collection pages — verify no second definition exists first.

---

### 4.4 `Cross-Household-` — Personal Finance (private) · 4 initiatives

**X-I1 · Repair and gate the service-worker shell** — *answers A2* · **M**
`SHELL` precaches `./js/store.js` (deleted in the store split) and
`./js/views/plan.js` (nonexistent), and omits all 8 real store files plus
`ui.js`, `features.js`, `tour.js`, `summary.js`. Add a check that every
`<script src>` in `index.html` appears in `SHELL` and that every `SHELL` entry
exists on disk. *Value:* offline currently works by runtime-cache luck; in the
sibling repo the identical bug produces a blank app. **The silent
`.catch(() => {})` on install is what let this survive** — the gate must be
static, not runtime.

**X-I2 · 320px in the accessibility matrix** — *answers A2, A3* · **S**
`check-a11y.mjs` runs one 390px viewport. This audit found 320 clean across all
16 routes — so this protects a currently-correct state rather than fixing a
defect, which is the cheapest kind of gate to add.

**X-I3 · Reconcile the documented floor with the enforced one** — *answers A3* · **S** · **decision first**
`CLAUDE.md` says 48px; `check-a11y.mjs:119` enforces 44. Then **extend
`check-doc-drift.mjs`** to cover claims about gate thresholds, not just
`CSV_HEADER` / `CATEGORIES`. *Value:* the drift existed precisely because the
doc-drift gate wasn't scoped to catch it.

**X-I4 · Chart-segment target equivalence audit** — *answers A3* · **S**
The exemption for data-sized chart segments is honest **only where an equivalent
44px target genuinely exists**. Verify the legend equivalence holds on every
chart exposing a tappable segment. *Value:* keeps a documented exemption truthful
rather than a blanket waiver.

---

### 4.5 `household-finance` — Financial Demo (public) · 4 initiatives

**H-I1 · Repair the offline shell, and gate it** — *answers A2, A4* · **M** · **highest priority in this repo**
Same stale `SHELL` as X-I1, but **13** missing scripts and it actually fires:
offline reload was reproduced as **blank** with `Store is not defined`. Fix the
list, then add both the static gate from X-I1 **and** an offline-reload
assertion. *Value:* a white screen with no error is the worst possible first
impression for the app that exists to demonstrate the others.

**H-I2 · Demo-quality chart targets** — *answers A3* · **S**
A tappable donut segment measured 8.8 × 0.6px. Introduce a minimum-angle floor,
or route small slices into an "Other" segment with a real target. *Value:*
formally exempt, but this is the demo — it is the surface being evaluated.

**H-I3 · Paired 320px + threshold reconciliation** — *answers A2, A3* · **S**
Mirror X-I2 and X-I3 **in the same wave as the Cross-Household- change**, so
`sync-drift` sees one deliberate divergence instead of two accidental ones.

**H-I4 · Start-fresh onboarding verification** — *answers A4* · **S**
`startFresh()` / `emptyState()` is the real onboarding path — a cloned demo
becomes a real household there. Assert end-to-end that clearing demo data leaves
a coherent single-member (`"You"`) state across all 14 routes. *Value:* the one
flow where a new user's first action is destructive and irreversible.

---

### 4.6 Cross-cutting · 3 initiatives

**F-I1 · One ergonomic floor, written once, enforced everywhere** — **L**
A single documented 44px standard with a gate in *every* repo, rather than four
different levels of coverage. Composed of W-I1, C-I1, X-I2, H-I3.
*Impacted:* all five.

**F-I2 · Shared-module offline parity** — **M**
Cookbook and workout carry byte-identical shared modules and the **identical**
`cdn.jsdelivr.net` dependency.
**Verified scoping correction:** `mc-supabase.js` — the file that actually holds
that CDN URL — is **not** in either coupling system. It is an independent copy in
each repo, compared by no gate. So the SDK-vendoring work is **two independent
PRs**, not a paired set, and neither blocks the other (see 5.0, Rule 1B). Only a
change to one of the **7** genuinely shared files needs the canonical-first,
paired-PR discipline.
*Impacted:* `Mikes-Cookbook`, `4-Weeks-to-Open-` → Rolodex.

**F-I3 · Finance shared-module bridge — scope before building** — **L** · **decision first**
The brief proposed a cross-app *data* bridge. The two finance apps are
**deliberately** divergent — fixed two-person roster vs. dynamic members, real
data vs. fictional demo, Cross-only Direct Deposit and Monthly Report — so
bridging *data* between a private household and a public demo may be actively
wrong. The defensible version is a shared-**module** bridge (formatting, money
math, chart primitives) held byte-identical and gated, exactly as `mc-bridge.js`
already is between cookbook and workout — and X-I1/H-I1 prove the two SWs
*already* drifted in a way `check-sync-drift.mjs` did not catch, because it
compares source similarity, not behaviour.
**Must not begin without an `AskUserQuestion` gate** establishing which of the
two it is.
*Impacted:* `Cross-Household-`, `household-finance`.

---

### Initiative index

| ID | Repository | Initiative | Effort | Gate? |
|---|---|---|---|---|
| W-I1 | 4-Weeks-to-Open- | Chrome-control journey pass | M | adds |
| W-I2 | 4-Weeks-to-Open- | Shared chrome consolidation | S | — |
| W-I3 | 4-Weeks-to-Open- | Dark-mode contrast gate | M | adds |
| W-I4 | 4-Weeks-to-Open- | Perf-probe integrity | S | fixes |
| W-I5 | 4-Weeks-to-Open- | Topbar scrolls, not compresses | S | — |
| R-I1 | MC-Training-Rolodex | Manifest completeness gate | S | adds |
| R-I2 | MC-Training-Rolodex | Post-deploy artifact verification | M | adds |
| R-I3 | MC-Training-Rolodex | Pages-artifact strip parity | S | decision |
| C-I1 | Mikes-Cookbook | First accessibility gate | M | adds |
| C-I2 | Mikes-Cookbook | Cooking Mode refit | S | — |
| C-I3 | Mikes-Cookbook | Offline-honest auth | M | decision |
| C-I4 | Mikes-Cookbook | Feature registry + tour gate | M | adds |
| C-I5 | Mikes-Cookbook | High-frequency card controls | S | — |
| X-I1 | Cross-Household- | Repair + gate the SW shell | M | adds |
| X-I2 | Cross-Household- | 320px in a11y matrix | S | adds |
| X-I3 | Cross-Household- | Threshold reconciliation | S | decision |
| X-I4 | Cross-Household- | Chart equivalence audit | S | — |
| H-I1 | household-finance | Repair offline shell + gate | M | adds |
| H-I2 | household-finance | Demo-quality chart targets | S | — |
| H-I3 | household-finance | Paired 320px + threshold | S | adds |
| H-I4 | household-finance | Start-fresh verification | S | adds |

---

## 5. REPO-BY-REPO INDIVIDUAL SESSION EXECUTION PLAN

How to run one focused session per repository from this roadmap.

### 5.0 PR strategy — how changes land, repo by repo

**One PR cannot span repositories.** A GitHub pull request targets exactly one
repo, so "one PR for the whole roadmap" is not an option. The unit of work is a
**wave**; the unit of delivery is **one PR per repo per wave** — except where a
file is *coupled*, and then it is a **paired set landed in a fixed order**.

#### Rule 0 — there are four pushable repos, not five

| Repo | PR here? | Why |
|---|---|---|
| `4-Weeks-to-Open-` | **Yes** | Master workout repo. All workout work lands here |
| `Mikes-Cookbook` | **Yes** | Standalone |
| `Cross-Household-` | **Yes** | Private finance |
| `household-finance` | **Yes** | Public demo |
| `MC-Training-Rolodex` | **NEVER** | Force-pushed by `market-deploy.yml`; its `main` has unrelated history. It inherits every fix automatically. Opening a PR here is always wrong |

#### Rule 1 — know whether your file is coupled before you branch

There are **two independent coupling systems**, and they behave differently.

**A. Finance pair — `Cross-Household-` ↔ `household-finance`**
Governed by `scripts/sync/manifest.json`: **31 coupled units**, enforced by
`check-sync-drift.mjs` as a **blocking PR job**.

Coupled (a change here needs a paired PR *or* a consciously updated baseline):

> `js/app.js` · `js/charts.js` · `js/features.js` · `js/motion.js` · `js/icons.js`
> · `js/lock.js` · `js/theme.js` · `js/tour.js` · `css/styles.css` · **`sw.js`** ·
> `index.html` · `tests.html` · `manifest.json` · `.github/workflows/tests.yml` ·
> `scripts/run-tests.mjs` · `scripts/check-doc-drift.mjs` · **`js/store/` (whole
> directory, concatenated)** · and all 14 `js/views/*.js`

Not coupled, so free to change alone: `js/cloud.js`, `js/sync.js`,
`js/views/paycheck.js`, `js/views/report.js`, `supabase/`, `reference/`, and
every doc.

**B. Cookbook ↔ workout — exactly 7 files**
Enforced by `sync-shared-modules.py`, run as `cross-repo-drift`, which is
**deploy-only by design** — it fails *by construction* between the two merges,
so it must never gate a PR.

| Canonical (`4-Weeks-to-Open-`) | Copy in `Mikes-Cookbook` | Kind |
|---|---|---|
| `mc-foodapi.js` | `tracker-foodapi.js` | generated, renamed |
| `mc-macrocalc.js` | `tracker-calc.js` | generated, renamed |
| `mc-barcode.js` | `tracker-barcode.js` | generated, renamed |
| `mc-bridge.js` | `mc-bridge.js` | **byte-identical** |
| `mc-install.js` | `mc-install.js` | **byte-identical** |
| `mc-backup-status.js` | `mc-backup-status.js` | **byte-identical** |
| `tools/test-mc-bridge.js` | same | **byte-identical** |

**Direction is fixed: edit in `4-Weeks-to-Open-` (canonical), copy to the
cookbook. Never the reverse.** Land the workout PR **first**, the cookbook PR
second.

> **Verified correction — do not plan `C-I3` as a paired PR.** `mc-supabase.js`
> is **not** in either coupling system. Both repos carry an independent copy
> with the identical `cdn.jsdelivr.net` SDK URL, and no gate compares them. The
> Supabase-vendoring work is therefore **two independent PRs**, related only by
> intent. They can land in any order, and neither blocks the other.

#### Rule 2 — the slicing table

| Wave / initiative | Repos touched | PRs | Coupled? | Landing order |
|---|---|---|---|---|
| `H-I1` + `X-I1` offline shell | hf + Cross | **2, paired** | **Yes — `sw.js`** | Either first, then refresh baseline |
| `X-I2`/`X-I3` + `H-I3` 320px & thresholds | Cross + hf | **2, paired** | **Yes — `tests.yml`, `check-doc-drift.mjs`** | Either first, then refresh baseline |
| `W-I1`…`W-I5` workout ergonomics | workout | **1** | No | Rolodex inherits on merge |
| `C-I1`, `C-I2`, `C-I5` cookbook a11y | cookbook | **1** | No | — |
| `C-I3` cookbook SDK vendoring | cookbook | **1** | **No** (verified) | Independent |
| `W`-side SDK vendoring | workout | **1** | **No** (verified) | Independent |
| `F-I2` shared-module change | workout + cookbook | **2, paired** | **Yes — the 7 files** | **Workout first**, cookbook second |
| `R-I1`…`R-I3` Rolodex initiatives | **workout** | **1** | No | Fixes live in the master repo |
| `H-I2`, `H-I4` demo polish | hf | **1** | Depends on file — check the 31 | — |
| `X-I4` chart audit | Cross | **1** | `js/views/*` **is** coupled — check | Pair if a view changes |

#### Rule 3 — landing a paired set (finance)

1. Open **both** PRs. Each is normal and independently reviewable.
2. Merge one. `check-sync-drift` on the *other* now legitimately shows the whole
   wave as diff. **That is correct, not a bug** — do not "fix" it by editing code.
3. Merge the second.
4. **Then** refresh the baseline, against a real `main`:
   ```bash
   # from a household-finance checkout
   git worktree add /tmp/hf-main origin/main
   # from Cross-Household-
   node scripts/update-sync-baseline.mjs /tmp/hf-main
   ```
   **Never baseline against a feature branch.** CI checks out `main` with no
   `ref:` override, so a branch-derived baseline encodes the wrong comparison
   and fails later in a way that looks like a tooling bug but isn't.
5. Commit the refreshed baseline as its own small PR.

> **The one place "port it" is the wrong instinct:** `js/features.js` is coupled
> *and* deliberately divergent — its manifest entry records that Cloud Sync and
> Live Sync are Cross-only until Phase 5. There, accept the divergence into the
> baseline rather than porting.

#### Rule 4 — pre-push gate, per repo

Run the repo's own checks before pushing. One validated push beats three
speculative ones.

```bash
# 4-Weeks-to-Open-
for f in $(git ls-files '*.js'); do node --check "$f" || echo "FAIL $f"; done
python3 tools/build-market.py --check
python3 tools/build-sw.py --check
python3 tools/apply-head-contract.py --check

# Mikes-Cookbook
node tools/validate-recipes.js && node tools/check-docs.js
node tools/build-data.js --check && python3 tools/build-sw.py --check
python3 -m http.server 8765 & node tools/smoke-test.js

# Cross-Household- / household-finance  (CHROMIUM_PATH avoids a browser download)
node scripts/run-tests.mjs
node scripts/check-token-drift.mjs && node scripts/check-doc-drift.mjs
CHROMIUM_PATH=/path/to/chrome node scripts/check-a11y.mjs
node scripts/check-sync-drift.mjs            # Cross only
```

#### Rule 5 — every PR, every time

- Branch: `claude/<slug>`, never push to `main`.
- Open as a **draft PR** targeting that repo's `main`.
- One wave per PR. Don't widen it because a file was already open.
- If it touches a coupled unit, **say so in the PR body** and link its pair.
- Re-baseline a ratchet only when the change is deliberate, and inspect the diff
  **before** accepting it — never after.
- **Never re-baseline `check-contrast.js` or the visual ratchet from an agent
  sandbox.** Webfonts are blocked at the *browser* level there (`curl` returns
  200, Chromium does not), so text metrics differ from CI and `--update`
  produces wrong budgets. Enforcing runs are trustworthy; only `--update` is not.


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
