# Project notes for Claude

## Planning rule — artifact/roadmap authorizes implementation

**The executive-summary wait-for-approval gate is deprecated.** For new
features or UI additions, development phases, multi-file refactors,
schema/pipeline changes, new HTML pages, and exercise-data structural
changes: produce a discovery artifact and/or a roadmap entry covering the
objective, scope, and phases of the change before writing code. **Creating
that artifact/roadmap is itself sufficient evidence and direction to proceed
directly to implementation** — no separate "approved" / "go" reply is
required before writing or editing any file.

This replaces the old rule ("draft an executive summary and wait for
explicit approval before writing or editing any file"), including step 1 of
the New Program Creation Workflow below and the planning-gate language in the
Active Development Plan section. Historical "shipped" log entries elsewhere
in this file that describe approvals granted under the old rule are a record
of what already happened and are left as-is.

**Skip the artifact/roadmap for:** isolated bug fixes contained to 1–2 files,
single-line corrections, copy/wording tweaks, and trivial CSS adjustments —
same scope guidance as before, just without the approval wait.

For **multi-phase work**, still pause between phases with `AskUserQuestion`
to confirm the owner wants to continue before starting the next one — that
mid-project check-in is a separate mechanism from the deprecated pre-code
approval gate and stays in place.

---

## Architecture & tech stack

Deliberately no framework and no build step:

- **Frontend:** plain multi-page HTML + `base.css` + a shared set of
  `mc-*.js` vanilla-JS modules (~90 files, one page per workout/split/tool).
  No bundler, no `package.json` — CI installs Playwright into a scratch
  prefix outside the repo (`/tmp/pw-ci`) only when a job needs a headless
  browser.
- **Data:** `mc-pm-data.js` (10 programs — 6 flagship, 4 licensed-influencer)
  and `exercise-catalog.js` (577 deduplicated exercises, each tagged
  `equipment` + `movement`) are the two catalog sources of truth.
- **Backend:** Supabase — accounts/auth, PM-mode publish + inline edits
  (`mc-pm-inline.js`, `mc-program-pub.js`), backup status
  (`mc-backup-status.js`), food-macro lookups (`mc-foodapi.js`), and a
  scheduled Edge Function (`weekly-checkin`, fired by
  `.github/workflows/weekly-checkin.yml` every Sunday 14:00 UTC) that pushes
  a check-in to trainees who haven't opened the app that day.
- **PWA/offline:** `manifest.json` + a single versioned service worker
  (`sw.js`, stale-while-revalidate) — precaches the app shell, caches every
  other page network-first-with-fallback on first visit.
- **Cross-app bridge:** `mc-bridge.js` is a read-only, byte-identical-with-
  Mikes-Cookbook view (`todaysMeals`/`todaysWorkout`/`macroTargets`/
  `recentActivity`/`today`) consumed by `mc-macros.js`'s "Today's Planned
  Meals" card. See the Active Development Plan section below
  (`cookbook-bridge-roadmap.md`) for the full cross-app history.

---

## Build, test & CI

No test framework — every check is a plain `node`/`python3` script run
against the real source. Local gates before every PR (all of these also run
in CI — see below):

```bash
# JS syntax (every tracked .js file)
for f in $(git ls-files '*.js'); do node --check "$f"; done

node tools/test-naming.js              # resolver/precedence unit tests
python3 tools/validate-overrides.py    # program-overrides.json shape
node tools/test-mc-suggest.js          # weight-suggestion math
node tools/test-mc-maxout.js           # 1RM/Epley math
node tools/test-mc-strain.js           # session-kcal + 0-21 daily-strain math
node tools/test-mc-readiness.js        # per-muscle recovery-curve math
node tools/test-mc-quick-pump.js       # history-aware selection incl. mc-readiness.js integration
node tools/test-mc-bridge.js           # cross-app bridge read layer
node tools/test-mc-sync-merge.js       # mc-sync.js merge logic
node tools/test-mc-sw.js               # service-worker fetch strategy
python3 tools/build-sw.py --check      # committed sw.js matches the tree
python3 tools/check-script-manifest.py --check   # clone pages load identical module lists
python3 tools/apply-head-contract.py --check     # canonical <head> block + PWA tags on every page
node tools/check-program-colors.js     # mc-pm-data.js vs dashboard.html vs mc-theme.js
node tools/check-day-colors.js         # governed training-day palette
node tools/validate-programs.js        # multi-week intensifier coverage (mm-p1/p2/p3.html)
node tools/check-exports.js            # global-namespace convention (MC_SNAKE / MCPascal)
node tools/check-program-data.js       # note-field + day-type vocabulary, fleet-wide
node tools/check-one-timer.js          # no orphan/duplicate/missing rest-timer implementation
node tools/check-single-impl.js        # declared shared functions exist exactly once tree-wide
python3 tools/build-market.py --check  # no licensed content leaks into the Rolodex build
```

`tools/dom-parity.js`, `tools/ks-parity.js`, `tools/extract-shared-modules.py`,
and `tools/add-pwa-meta.py` are manual / one-off tools — not wired into any
workflow below, so a green CI run does not exercise them.

**Workflows** (`.github/workflows/`):
- **`verify.yml`** — the canonical gate list (everything above, plus a
  headless-Chromium render smoke test and a light-mode contrast ratchet).
  Called by both `pr.yml` and `pages.yml` so a PR runs exactly what the
  deploy runs. `cross-repo-drift` (the Mikes-Cookbook shared-module
  byte-identity check) is deploy-only by design — it fails by construction
  between a shared-module PR merging here and the matching cookbook PR
  landing there, so it must not gate pull requests.
- **`pr.yml`** — runs `verify.yml` on every pull request.
- **`pages.yml`** — on push to `main`: runs `verify.yml` (with
  `cross-repo-drift: true`), regenerates `sw.js` with a run-scoped cache
  version, strips `*.dc.html` design comps from the deploy artifact, and
  publishes to GitHub Pages.
- **`market-deploy.yml`** — on push to `main`: extracts the licensed-
  content-free tree (`tools/build-market.py`, driven by
  `content-manifest.json`) and force-pushes it to `MC-Training-Rolodex` as a
  single fresh commit.
- **`weekly-checkin.yml`** — Sunday 14:00 UTC cron that calls the
  `weekly-checkin` Supabase Edge Function.

---

## Documentation currency rule — keep Quick Tour & Program Guides current

**Permanent rule.** Any time a change adds or meaningfully alters a
**user-facing feature** — something a trainee needs to discover or learn how
to use — update the matching onboarding doc in the same piece of work:

- **App-wide feature** (dashboard, Conditioning Corner, calendar, macros
  search, substitute picker, etc.) → update **`quick-tour.html`** and/or
  **`quick-tour-overview.html`**.
- **Program-specific feature** (a new day type, a new intensifier, a change to
  how a specific program's split/structure works) → update that program's own
  **`<id>-instructions.html`** guide (e.g. `mc-instructions.html`,
  `mm-instructions.html`), and add an entry in **`program-guide.html`** if the
  program itself is new (see the New Program Creation Workflow below, step 4,
  for the required `dashboard.html` + `mc-pm-data.js` wiring that makes a new
  program discoverable in the first place).

Purely internal changes (refactors, data-only additions with no user-visible
behavior change, bug fixes restoring already-documented behavior, CSS/copy
tweaks) don't require a doc update. If a feature is removed or changed enough
that existing guide copy is now wrong, update or remove that section rather
than leaving stale copy. This is independent of the planning rule above —
even a change small enough to skip the artifact/roadmap still needs its
guide entry if it's user-facing.

---

## New Program Creation Workflow

Whenever asked to **create a new program**, follow this pipeline exactly:

1. **Plan first** — produce an artifact/roadmap entry covering the objective,
   scope, and phases; creating it is sufficient to proceed directly to code
   (see the Planning rule above) — no separate approval wait required.
2. **Build the program HTML page** — follow the 7-day layout standard and
   station-anchoring constraints documented below. All new programs use
   `5-on 2-off` and the 7-card day structure. **Then run
   `python3 tools/apply-head-contract.py`** so the new page picks up the
   canonical `<head>` block (manifest link, install meta, theme-color, the
   before-first-paint theme + PWA cold-launch boot) and the `mc-sw-update.js`
   tail tag. Never hand-write those tags — `--check` runs in CI and the block
   is regenerated, so a hand-added copy is drift, not a contribution. The page
   still needs `<html lang>`, `<meta charset>` and a `viewport-fit=cover`
   viewport of its own; the tool verifies those but won't write them.
3. **Register in `mc-pm-data.js`** — add a new entry to the flagship programs
   array (before the `MARKET:STRIP` block) unless the program uses licensed
   influencer content, in which case place it inside the MARKET:STRIP section.
   Required fields: `id`, `icon`, `name`, `meta`, `color`, `desc`, `href`, `splits`.
4. **Add the program's bespoke look to `dashboard.html`** — `#flagGrid`, the
   Home screen's `.prog-rail`, and `.influencer-grid` all render their markup
   automatically at runtime from `MC_PM_DATA.programs` (`renderProgramCards()`,
   top of the big inline `<script>` in `dashboard.html`) — a new entry in
   `mc-pm-data.js` with `tier: 'flagship'` or `tier: 'influencer'` is enough to
   make the card and (for flagship) its rail tile appear with no HTML to hand-write.
   Two things still need a matching hand-added block per new `id`, since they're
   bespoke per program and not derivable from data alone:
   - **CSS** — add `.cat-card.<id>` / `.rail-card.<id>` (background gradient,
     border-top, `.cat-tag` color) inside the `#scr-programs` / `#scr-dashboard`
     scoped rule groups, next to the existing per-id blocks. `border-top`'s hex
     is what `tools/check-program-colors.js` enforces against `mc-pm-data.js`'s
     `color` field for *both* the grid and rail blocks — keep it in sync. That
     same gate also enforces `mc-theme.js`'s `FALLBACK` map, so a new program
     needs an entry there too — it is the only copy of the color used on pages
     that never load `mc-pm-data.js`; everywhere else `mc-theme.js` derives the
     palette from the data file at call time (audit G-01). Do
     **not** add a `.cat-designer` color rule — `#scr-programs .cat-designer`
     is set to `display:none`, so flagship/influencer cards never show it; only
     the separate "Your Programs" / "Published Programs" tiers render that line.
   - **Icon** — add an entry to the `PROGRAM_ICONS` map inside `renderProgramCards()`
     (stroke/fill/path or circles) keyed by the new `id`; it's shared by the
     rail (19px) and grid (18px/15px) renders, so there's exactly one icon
     definition per program, not two. For an **influencer** program, add the
     entry inside the map's existing `MARKET:STRIP influencer-icons` comment
     block, alongside the other influencer ids, not above it with the
     flagship entries — anything outside that block ships in the public
     Rolodex build. A per-program dynamic UI hook (like the live-streak badge
     on one of the influencer cards) belongs on the *data* object as a plain
     boolean flag (see `liveBadge` in `mc-pm-data.js`) rather than an
     `if (p.id === '<name>')` check in `dashboard.html` — a literal influencer
     name/id comparison in shared, unwrapped code is exactly what
     `tools/build-market.py --check`'s brand-term scan is there to catch.
   The `.topbar-sub` program count is computed from the rendered `#flagGrid`
   cards at runtime — no manual count to update.
5. **Commit and push to a feature branch in `4-Weeks-to-Open-`.**
6. **Create a draft PR targeting `main` of `4-Weeks-to-Open-`.**
7. **Merge to main** → the deploy pipeline auto-propagates all changes to
   `MC-Training-Rolodex`. Never push directly to the Rolodex repo.

## Repository relationship & deploy pipeline (IMPORTANT)

`4-Weeks-to-Open-` is the **master repository**. `MC-Training-Rolodex` is a
**downstream deploy target**, not a place to push directly.

- There is an automatic deploy function: once changes are pushed to
  `4-Weeks-to-Open-`, they are propagated/applied to `MC-Training-Rolodex`
  automatically (the Rolodex is the market/public build, with licensed
  influencer content stripped via the `MARKET:STRIP` markers).
- **Do all work in `4-Weeks-to-Open-` and push there.** Do NOT manually push
  to `MC-Training-Rolodex` (its `main` has an unrelated history and is managed
  by the deploy pipeline). Manually overwriting Rolodex `main` would be
  destructive and is never the right move.

## Active Development Plan — launch-roadmap.md

> **The governing plan is now [`launch-roadmap.md`](launch-roadmap.md)**
> (approved 2026-07-12): a phased launch-readiness roadmap (L0–L6) driving
> the app to a finished product — installable PWA + commercial layer, with
> L6 as the definition of done. Each phase gets its own artifact/roadmap
> entry before code (per the Planning rule above — phases through L4 were
> gated by the now-deprecated executive-summary approval instead, since they
> predate this rule change), and an AskUserQuestion gate before the next
> phase. The section below is the previous plan, kept as a historical
> record; its two open closeout items (Task 3.2, `exercisedata.json`
> retirement) are absorbed into roadmap Phase L0.

> **Companion cross-app plan:** [`cookbook-bridge-roadmap.md`](cookbook-bridge-roadmap.md)
> (approved 2026-07-15) governs the two-way data bridge between this app and
> Mike's Cookbook, toward a joint launch as two linked PWAs (B0–B5). Its final
> phase folds into launch-roadmap.md L6. Same gate discipline: each phase
> needs its own artifact/roadmap entry before code (see the Planning rule
> above — B0–B5 were gated by the now-deprecated executive-summary approval
> instead, since they predate this rule change). Scratch-listed
> (`content-manifest.json`), so it never ships to the public Rolodex build.
>
> **B0 shipped (2026-07-15):** `mc-sync.js` gained a `CONSUME` map that pulls
> `mc-cookbook:mealplan` read-only from Mike's Cookbook (never pushed — one
> writer per store); `mc-bridge.js` is the shared, read-only cross-app view
> (`todaysMeals`/`todaysWorkout`/`macroTargets`/`recentActivity`/`today`),
> **byte-identical to the copy in Mikes-Cookbook** and gated by
> `tools/test-mc-bridge.js`. Macro targets come from the already-shared
> `mc_macros_v1.goals`, not a workout-only store.
>
> **B1 shipped (2026-07-15):** `mc-macros.js` (dashboard's Nutrition tab)
> gained a "Today's Planned Meals" card built on `mc-bridge.js` — lists today's
> cookbook-planned meals (title/icon/macros denormalized onto each meal entry
> by the cookbook, since this app never loads `recipes-data.js`), a one-tap
> **Log** button that writes into the shared `mc_macros_v1` (never back into
> the cookbook-owned plan store), and a plan-vs-target readout. `mc-bridge.js`
> now loads immediately before `mc-macros.js` (not near `mc-sync.js`) so
> `window.MCBridge` exists at first render.
>
> **B2 shipped (2026-07-15):** `mc-bridge.js` gained `likelyTrainingDays()` — a
> real historical weekday-training pattern from `mc_workout_log_v1` (this app's
> own store), consumed by the cookbook to bias its Smart Week / Macro Smart
> Generator toward higher protein on likely training days. Also fixed a real
> bug from B0/B1: `perServingMacros()`'s fallback used the wrong macro field
> names (`kcal/p/f/c` instead of the cookbook's real `calories/protein_g/
> fat_g/carbs_g`), which would have logged zero macros for any real planned
> meal — now normalizes correctly. Also: any pulled `CONSUME`-store change now
> arms `mc-sync.js`'s one-shot reload (previously only owned-store pulls did),
> since consumer stores have real rendered surfaces now.
>
> **B3 shipped (2026-07-15):** a real architecture correction — the two apps
> are actually **same-origin** (`mcross2298.github.io`, different path, not
> two separate origins as B0 assumed), so same-device `localStorage` (and the
> Supabase session, since both apps use the same project ref/default storage
> key) is already shared by the browser; the sync bridge remains the
> cross-device/partitioned-storage safety net, not made redundant by this.
> `dashboard.html` gained a compact cross-app "Today" strip
> (`populateTodayStrip()`, near the momentum strip) summarizing today's
> cookbook-planned meals + macro goal, hidden with no bridge data. The
> Rolodex-only one-way cookbook nav icon is now paired with an always-visible
> standalone-build link (absolute URL, `MARKET:STRIP`-gated so the Rolodex
> build still gets its own relative-path version) — first persistent,
> two-way nav between the apps.
>
> **B4 shipped (2026-07-15):** `mc-account.js`'s sign-in copy now mentions
> Mike's Cookbook (the cookbook's already mentioned the workout app). A real
> defect from B3 was found and fixed here too, on the cookbook side: its new
> workout-nav button silently overlapped the pre-existing account button at
> the same position slot. `mc-install.js` and `mc-backup-status.js` (this
> repo's originals) are now shared, byte-identical modules with the cookbook
> — `mc-backup-status.js` was adjusted to re-query its DOM element on every
> render rather than cache it once, since the cookbook's SPA rebuilds Home's
> DOM on every visit and a cached reference would go stale there.
>
> **B5 shipped (2026-07-16) — session-verifiable half only; owner sign-off is
> the remaining gate:** `mc-sync.js`'s merge functions (browser-only IIFE, not
> `require()`-able) now have a `module.exports` hook exploiting function-decl
> hoisting, tested against the real source via `tools/test-mc-sync-merge.js`
> (vm-sandboxed, same technique as `test-mc-bridge.js`) — 24 real
> conflicting-fixture assertions. A real CI gap was found and closed: neither
> repo's `pages.yml` ran the bridge/sync tests before now, and Mikes-Cookbook
> had no copy of `test-mc-bridge.js` at all despite owning a byte-identical
> `mc-bridge.js` — both fixed. A full cross-app QA loop was verified
> headlessly end-to-end for the first time (prior phases only tested in
> isolation) — 7 checkpoints, zero console errors. Offline/SW verified live
> where the environment allows; this app's `sw.js` has a pre-existing
> (predates this roadmap) hardcoded production-origin guard in its fetch
> handler, so true offline-reload is only observable on the real deployed
> origin, not localhost — documented, not silently skipped. `mc-export.js`
> reconfirmed to already exclude CONSUME-only stores correctly. **Not done,
> and can't be from this environment:** the real-device QA matrix (iOS
> Safari, Android Chrome, installed-PWA), and confirming actual Supabase
> reconciliation across two signed-in physical devices — both are the
> owner's to close before B5/L6 can be called truly complete. Full
> breakdown in `cookbook-bridge-roadmap.md`'s B5 section.

> **Companion card-layer plan:** [`card-integration-roadmap.md`](card-integration-roadmap.md)
> (opened 2026-08-19) merges two audits taken the same day against the same
> page — a TIMWOODS runtime waste audit (`A-1…A-17`) and a card UX council
> report (`R1…R5`) — into one dependency-ordered sequence `S0–S6`. They are the
> same subject on two axes (work per second vs pixels per exercise) and seven
> of their proposals collide, so they cannot be shipped independently. Four
> decisions are locked there; `mc-setlog.js` is edited in five of the six code
> steps, so it runs as one serial chain, one PR at a time. S4 carries an
> `AskUserQuestion` gate and S5 needs explicit sign-off (it reverses
> `base.css`'s recorded no-accordion decision). Scratch-listed
> (`content-manifest.json`), so it never ships to the public Rolodex build.
>
> **S0 + S1 shipped (2026-08-19):** `tools/measure-session.js` is the committed
> replacement for the two throwaway harnesses the audits used — runtime
> counters and layout metrics in one tool, counting mutation records *as
> delivered to the app's own observers*. Then the storm itself: with a rest
> timer running, mutation records fell 2983.8/s → 35/s (−99%),
> `querySelectorAll` 1061.6 → 289.9 (−73%), `localStorage` reads 1927.3 → 26
> (−99%), and all five sub-44pt controls now clear the touch floor.
> `mc-rep-progress.js`'s "clean slate then re-apply" was the amplifier — it was
> landed and measured alone first (−98% on its own) rather than assumed.
> `A-3` rewrote two persistence-key functions and was verified byte-identical
> against the old algorithm on 216 cards across 9 pages before landing. The
> active card grew 24 px, which `R5` spends by design and later steps repay.
>
> **S2 shipped (2026-08-20):** the reload-correctness step, and the gate for
> `R3`/S5. `restoreSets()` now calls the same `updateCount()` derivation a
> real check does (exposed as `window.MCSetlogUtil.updateCountByCard()`) —
> verified live: log 2 of 5, reload, badge reads `2/5` (was `0/5`). A typed-
> but-unchecked value now survives a reload too (`mc_setlog_pending_v1`), and
> the suggested-fill mechanism became a visible, ghosted value (muted color +
> italic + dashed border, not opacity, so R5's touch targets stay legible)
> that solidifies on the first keystroke or on check — verified live end to
> end including the untouched-ghost-never-persists case the ordering (A-10
> before ghosting) exists to guarantee. "Exit & discard" (D-2, the app's most
> destructive control, previously zero-confirmation and no-undo) now confirms
> naming the exact set count and snapshots the removed session to
> `mc_discard_snapshot_v1`; `mc-resume.js` (already the dashboard's session-
> banner module) offers "Restore discarded workout" from it, dropped silently
> if a newer session already exists for that page. Verified live as a full
> round trip: discard → dashboard banner → Restore → both stores byte-
> identical to what was removed. The local/cloud divergence D-2 also named is
> closed with `MC_SB.deleteSessionLog()`, scoped to the discarding page-
> load's session id. `mc-live-tracker.js`'s wake lock and catch-up alert now
> key off a new `TMR.isRunning()` instead of a CSS class only ever set under
> the List rest view, fixing Video view's screen-stays-asleep gap.
> `currentUser()` now prefers the already-cached `auth.getSession()` (as four
> other call sites already did) over a network-validating `auth.getUser()`,
> and the PR check's max-weight lookup became a page-lifetime local cache —
> together turning "4 round trips per checked set" into one insert per set
> after the first check of each exercise. Runtime numbers hold at S1's level
> (0% delta on all four counters) — S2 touches none of the mutation/scan/
> storage paths S1 fixed, by design.
>
> **S3 shipped (2026-08-20):** `.mcl-row` padding 6px → 1px and the
> SET/WEIGHT/REPS/RPE column-header row deleted entirely — active card
> 624px → 551px, no touch target shrinks. `setActiveCard()` now opens a
> card's logger the moment it becomes active, and the existing 600ms
> auto-collapse timer was extended to find and activate the next unfinished
> exercise (collapse, promote, scroll into view) — the "Log Sets" tap is now
> only needed to open a card out of order. The open card persists in
> `mc_session_v1.activeCard` and restores across a reload, including
> re-opening its day via a simulated header click (no single shared
> "open this day" function exists across the ~9 rendering engines, so a
> real click works regardless of which one wired it). A real bug surfaced
> by testing the superset case specifically, not just the common one: the
> first handoff implementation always skipped straight past a superset's
> second leg instead of promoting it — fixed and re-verified before
> shipping. Runtime holds at 0% delta; this step is presentation-only.
>
> **S4a shipped (2026-08-20):** S4 was gated and split — engines first, the
> hand-written pages second. Scoping that split corrected a plan assumption:
> there are **5** card engines, not 2 (`mm-`, `mc-pmc-`, `mc-`, `mc-s3-`,
> `ks-`), covering **39 pages**, and only **17** pages hand-write `.a-top`,
> with zero overlap — not the "~80" the roadmap carried (that was the count
> of pages loading `mc-card-actions.js`, a larger and different set). S4a
> ships the consolidated `.a-hdr` header as a shared component plus all five
> engines; the old `.a-top` rules are untouched so unmigrated pages are
> unaffected, and the new markup opts in via an `.a-hdr-card` marker.
> **R4's wireframe did not survive the real data:** it put the prescription
> inline as a compact `4×10` pill, but real prescriptions render as
> `12·10·8·8→∞·∞` and a fixed right-hand column starved `.a-head` into a
> **320px** header on kitchen-sink.html — caught by the harness, fixed by
> giving the prescription its own row. A second bug from the same pass:
> `.a-head` at `flex-basis:auto` pushed ⓘ onto a third line, since flexbox
> breaks lines on hypothetical main size; fixed with `flex:1 1 0` plus
> floating ⓘ beside the ⋯ meatball. Headers now measure 68–78px across every
> engine. Also fixed a live regression **S1 introduced**: `.mc-meatball` went
> 36→44px but `.a-top`'s `padding-right:calc(42px * var(--density))` was not
> updated with it, so at `--density:0.82` the meatball overlapped the
> exercise name by ~16px; both headers now use a fixed 54px, since they clear
> a fixed-size element. Active card 551 → 470px, full day 3868 → 3165px,
> runtime 0% delta.
>
> **S5a shipped (2026-08-20):** the owner signed off on S5, and `A-13` landed
> alone before `A-14`/`R3` per the serial rule. `A-13` turned out **not to need
> a new contract**: the audit proposed inventing `mc:cards-rendered`, but
> `program-overrides.js` already publishes `MC_SCAN` — one shared debounced
> body observer with `subscribe()`/`schedule()` — and three modules were
> already on it. So A-13 became a migration onto existing infrastructure (no
> new module, no manifest churn, removes observers rather than adding one),
> and `MC_SCAN.schedule()` *is* the "cards just rendered" signal `A-14` needs.
> Six modules moved off their private body observer + retry ladder;
> 7 of 9 ladders gone (the two left wait on the finish bar, not cards).
> `mc-rep-progress`'s observer was doing two unrelated jobs and is now split
> correctly; `mc-readiness`'s observer had **no debounce at all** (audit O-6),
> fixed as a side effect. Boot `querySelectorAll` fell 42%/19%/36% across three
> probe pages, and removing six observers cut steady-state records a further
> 57% (35 → 15/s) — cumulative **2983.8 → 15/s, −99.5%**. Also fixed a silent
> bug S4b introduced: five pages rendered `.a-notes` with no ⓘ, so the
> coaching cue was permanently unreachable (S4b's transformer keyed on a named
> `noteHtml` variable; these five render it inline). Verified live, not by
> inspection.
>
> **S5b shipped (2026-08-20) — `R3` only; `A-14` split out to S5c.** Scoping
> `A-14` first showed the two are not a sequence: `mc-finish.js` derives
> completion from a **DOM count** (`getTotalSets()` counts `.sl-ck,.set-check`
> in the document), so building loggers lazily collapses that denominator from
> **172 to 5** on `mm-p1.html` — measured — and `done >= total` would fire the
> Finish Workout modal one exercise into the session. `A-14` therefore needs
> completion accounting moved onto the prescription data first (**S5c**), and
> `R3` was not held behind it. `R3` makes `.mcl-strip` — the 48px summary row a
> card already collapsed to when finished — the **resting state of every
> card**, so a day reads as a list and exactly one exercise is expanded. That
> inverts the strip's meaning, which is the whole change: it was green (it
> only ever appeared on finished cards, so every unstarted exercise would have
> read as logged — the green moved behind `.is-done`); its dot was a hard-coded
> `✓` (now the exercise's position, swapped for `✓` on completion); and its
> `aria-label` **overrode its own text**, so the `2/5 Sets` span inside the
> button was never announced — the label is now rebuilt on every
> `updateCount()` and carries the count. Two edges found by testing:
> `setActiveCard()` collapses the others (so S3's automatic handoff is what
> closes the previous card), and `updateCount()`'s "not all done → expand"
> branch had to be narrowed to the **done→not-done transition** — unguarded it
> re-expanded all ten cards on every pass, since "not finished" is now the
> normal resting condition. Resting card 272.5 → **71.2px (−74%)**, full day
> 3165 → **1353px (−57%)**, active card unchanged, runtime **0% delta**.
> `totalSetsInDom` stays 172 through all five checkpoints — the assertion that
> proves completion accounting is untouched, and the reason `R3` is safe while
> `A-14` is not.
>
> **S4b shipped (2026-08-20):** all 17 hand-written pages migrated onto the
> `.a-hdr` markup and the old `.a-top` rule deleted — one card header in the
> tree now, not two. Five template syntaxes were involved, so 15 pages went
> through a structural transformer and the two string-concat pages were
> hand-edited (in concat form the captured `.a-reps` fragment must be
> re-entered into string context; the transformer got that wrong and would
> have shipped a syntax error). Verified in a browser on **all 17**, not
> sampled — five needed driving into a card-rendering state first
> (`run-program`/`run-workout` want a seeded custom program/workout;
> `cat-pmc`/`cat-strength`/`pmc-workout` are pickers). Headers 53–92px, zero
> console errors, no meatball overlap, all 45 inline scripts re-parsed clean.
>
> **`A-17` (the `defer` sweep) is blocked and was pulled out of S4b.** Its
> premise — "the modules all self-initialise on `DOMContentLoaded`, so
> `defer` preserves order" — is true module-to-module and ignores inline
> scripts, which are never deferred and jump ahead of every deferred module.
> **53 pages carry a bare top-level call to a shared-module function in an
> inline `<script>`** (typically `buildTimerFloat();` immediately after
> `<script src="mc-timer.js">`), so deferring would throw a `ReferenceError`
> on load. Verified against real source, not inferred. The fix is to wrap
> those calls in `DOMContentLoaded` first — its own step, best done after S5,
> which is likely to touch the same inline bootstrap code.

## Previous plan (historical) — workout_cookbook_dev_plan_v2

### Decisions locked in (via AskUserQuestion, session 2026-06-27)
- **Catalog scope (Task 3.1):** Full catalog — add `equipment` + `movement` fields to ALL 539+ exercises
- **Weight engine (Task 3.3):** Hardcoded multipliers per equipment type (no user-input friction)
- **Search no-results fallback (Task 2.1):** Show "No exact matches — try fewer keywords" message
- **Execution order:** Phase 1 → Phase 2 → Phase 3 in sequence; AskUserQuestion alignment check before each phase

### Phase 1 — Polish & Stability ✅ Complete (merged to main)
- `mc-calendar.js`: collapsible toggle (`localStorage mc_cal_collapsed` — moved off `sessionStorage`, which reset the collapse state every new tab even for daily users), chevron indicator, `MCCalendar.toggle()` / `MCCalendar.focus()` API
- `dashboard.html` / `base.css`: text truncation fixes (`overflow-wrap`, `word-break`) on `.hero-name`, `.cat-name`, `.ex-name`, `.ss-name`; `.cat-meta` `-webkit-line-clamp` relaxed 2→3
- `mc-macros.js`: swipe-to-dismiss gesture on bottom-sheet handle (touchstart/move/end, 50 px threshold, scrollTop guard)

### Phase 2 — Search & Nutrition UX ✅ Complete (PR #96, merged to main)
- `mc-macros.js`: `tokenFilter()` client-side multi-keyword AND scoring post-API; `showEmpty()` always-visible prompt (never blank); backspace clears immediately without debounce
- `mc-macros.js`: nutrition sheet contrast — `.nt-ring-lbl` + `.nt-nrow` upgraded from `var(--muted)` → `var(--text)`, font-weight 700→800

### Phase 3 — Exercise Intelligence ✅ Complete (4-Weeks-to-Open- only)
- **Task 3.1:** Done — `exercise-catalog.js` has `equipment` and `movement` fields on all 577 exercises; the actual picker (`mc-card-actions.js` → `openSubstitute()`, powered by `mc-biomech.js`'s `alternatives()`) shows the top 3 closest matches (same muscle + same movement first, then same muscle any movement) plus a "Browse all for [muscle]" link, with gym-profile filtering removed so results are catalog-driven only, matching the locked decision. `Smith` exists as a 7th equipment value alongside the original 6 — left as-is rather than force-folded into Barbell/Machine, since it's a real distinct equipment type on gym floors.
- **Task 3.2:** Closed (verified in roadmap Phase L0, 2026-07-13) — the swap flow is coherent: the meatball "Replace exercise" route (`mc-card-actions.js` `doReplace()`) uses a `confirm()` dialog before navigating to `exercise-library.html?replace=`, and the biomechanical in-place substitute (`applySwap()`) uses a recoverable Undo toast (deliberate gym-floor fat-thumb recovery), persisting `{origLower:newName}` to `mc_replacements_global`/`mc_replacements|<pageId>` which `mc-replace.js::applyReplacements()` re-paints on reload. `mc-live-tracker.js` reads progress from `mc_setlog_v1` + live DOM card counts, **not** `mc_daily_v1` (the store name in the old note was stale — no file references it); the setlog+DOM source is internally consistent, so no code change was needed.
- **Task 3.3:** Done — `mc-suggest.js` has the equipment-aware increment table (Cable/Machine ×0.5 step, Dumbbell "per hand" label) and `mc-maxout.js` has the Cable/Machine ×0.85 Epley coefficient. Regression coverage is wired in: `verify.yml` runs `tools/test-mc-suggest.js` and `tools/test-mc-maxout.js`, and both `pr.yml` and `pages.yml` call `verify.yml`.
- **New:** `exercisedata.json` (904 records, no `equipment`/`movement` fields) was a legacy, unenriched dataset superseded by `exercise-catalog.js` — **retired** (verified gone in roadmap Phase L0, 2026-07-13): no `*.js`/`*.html`/`*.json` file references it, and `tools/build-sw.py` explicitly excludes the superseded datasets from the precache.

---

## One rest timer — `TMR` in `mc-timer.js` (audit G5.0)

**Permanent rule.** The app has exactly one rest-timer implementation: `TMR`
from `mc-timer.js`, surfaced on a page via `makeRestTimer(rest, name)` (which
emits a `.rest-timer` span) and the `#timerFloat` element `buildTimerFloat()`
builds. Never hand-roll a second one on a page.

Twenty-seven pages used to carry a complete duplicate — a `_T` controller,
`_rp()` emitting a `.rest-pill`, `_restFor()`, `_initTF()` and a static
`<div id="_tf">`. **None of it ever ran**: `_rp()` was declared and never
called, so nothing reached `_T`. `.rest-pill` rendered zero times on all 27
pages while `.rest-timer` rendered 8–39. Removing all of it changed the
rendered DOM on zero pages.

That is the trap worth remembering: a dead timer reads exactly like a working
one in source, so it survives review indefinitely.

A second, live variant of the same trap showed up later (CI initiative audit,
2026-08-01): seven pages, spanning both flagship and licensed-influencer
program content, carried a full, *working* page-local `const TMR = {...}`
because they never loaded `mc-timer.js` at all. Not dead code this time —
each one ran fine in isolation — but it meant those seven pages got no
`MC_PREFS` haptics/sound/cue prefs, no Up Next cue, and no screen-reader
timer announcements, silently out of step with the other ~130 pages. All
seven were migrated onto the shared engine; one of them also carried its own
local `updateProgress`/`_progObs`/`addTimerPresets` trio duplicating
functions `mc-timer.js` already provides — same fix, same reasoning.

`tools/check-one-timer.js` (renamed from `check-dead-timer.js`) runs in CI
and fails on: the original dead-subsystem identifiers reappearing, a page
loading `mc-timer.js` while also declaring its own local `TMR` (the two
`const TMR` declarations would throw a SyntaxError the instant the second
one parses — classic `<script>` tags share one global lexical environment),
or a page whose own `makeRestTimer()`/`makeRT()`/`restTimer()` clone emits
the `.rest-timer` chip markup while not loading `mc-timer.js`.

**Volume II Phase 6 ("Operable by Everyone") rewrote the chip itself.** Every
`.rest-timer` (and `mc-setlog.js`'s `.mcl-ck` set-checkbox) used to be a
non-semantic `<div>`/`<span>` with an inline `onclick="...TMR.toggle(...)"`
attribute — unreachable by keyboard, and the exact mechanism behind the D-3
apostrophe bug above. Both are now real `<button>`s carrying `data-secs`/
`data-name` (rest-timer) or `role="checkbox"`/`aria-checked`/`aria-label`
(set-check), with a SINGLE delegated `document.addEventListener('click', ...)`
in `mc-timer.js` doing the `TMR.toggle()` call for every `.rest-timer[data-secs]`
on the page, however it was rendered. A native `<button>` is keyboard-focusable
and fires `click` on both Space and Enter for free — no custom keydown handling
needed. This closes a real escape hatch the old `check-one-timer.js` orphan
check used to allow: a page-local `const TMR` no longer substitutes for
loading `mc-timer.js`, because the delegated listener only exists if
`mc-timer.js`'s own script ran — skip it now and every rest-timer button on
the page is silently inert (no error) rather than throwing "TMR is not
defined".

---

## Single-implementation functions (`tools/check-single-impl.js`)

**Permanent rule.** `TMR` itself isn't the only function that drifted into
per-page clones — `makeRestTimer` (the helper that renders a `.rest-timer`
chip) had **6 behaviorally distinct bodies across 21 sites**, and
`applyReplacements` (re-paints saved exercise swaps) had **5**, before the
CI initiative roadmap Volume II Phase 4 audit collapsed both onto
`mc-timer.js` / `mc-replace.js`. Two of the `applyReplacements` copies never
read `mc_replacements_global` at all — a swap made from the meatball menu
(which defaults to that key) silently never repainted on those pages. Every
`makeRestTimer` copy's apostrophe handling was broken (D-3): the plain
`.replace(/'/g,"\'")` sites were a no-op in a double-quoted JS string, and
the two `esc()`-based sites *looked* safer but had the identical live bug
through a different door — verified by execution — an HTML attribute's
`&#39;` entity decodes back to a raw `'` before the `onclick` string is
parsed as JS, so the string literal still breaks. Only a real
backslash-escaped JS string literal survives that decode step correctly;
see `_mcEscRestTimerJsArg()` in `mc-timer.js`.

`tools/check-single-impl.js` declares a list of function names
(`makeRestTimer`, `applyReplacements`) that must exist **exactly once**
tree-wide and fails CI the moment a second declaration of any of them
appears anywhere — including a byte-identical one, since a duplicate that
matches today is exactly how six divergent variants came to exist in the
first place. An engine whose own `render()` is IIFE-scoped rather than
global (`mm-engine.js`) can't rely on `mc-replace.js`'s usual "wrap
`window.render`" trick, so it calls `mc-replace.js`'s exposed
`window.MC_REPLACE.apply()` hook directly instead — see that file's own
comment for when to use which.

---

## Conditioning Corner

The "Conditioning Corner" is the **Conditioning tab** on `dashboard.html`
(`dashboard.html?tab=conditioning`), rendered by `renderConditioning()` from
`conditioning-data.js` (the `CONDITIONING` object) into `.cond-card` elements.

The owner-only PM inline-editing layer (`mc-pm-inline.js`) covers it:
- direct inline text edits on each card (name / tag / description) via a ✎
  pencil, reusing the page-override pipeline under a synthetic `'cond'` page
  (scope_id = routine id) — no dedicated Supabase section,
- a "Layout & Theme" line (🎨 chip) scoped to the `conditioning` layout view
  (`cards` / `compact` / `grid`, defined in `mc-layout.js`).

---

## Weekly Layout Standard — 7-Day 5-On 2-Off Architecture

> **Permanent rule.** All program HTML pages using this schedule pattern must
> implement a full 7-card day layout. Plain-text rest/active-rest banners are
> forbidden. Every day must be a `.day-card` UI component.

### Schedule pattern
- **Label:** `5-on 2-off` (replace all legacy `4-on 2-off` labels)
- **Day count:** 7 cards per week — Days 1–5 are training/conditioning; Days 6–7 are recovery

### Day specification

| Day | Card Title | Subtext | Card Type |
|-----|-----------|---------|-----------|
| 1 | Chest & Biceps | `Day 1 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 2 | Shoulders & Triceps | `Day 2 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 3 | Back & Traps | `Day 3 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 4 | Legs | `Day 4 · 10 exercises · 5-on 2-off` | Standard (Expandable list) |
| 5 | Conditioning Day | `Day 5 · Select Workout · 5-on 2-off` | Interactive dropdown / link to Conditioning Corner |
| 6 | Active Rest Day | `Day 6 · Recovery Plan · 5-on 2-off` | Info card: Low Intensity Cardio · Stretching · Mobility Work |
| 7 | Rest Day | `Day 7 · Full Rest · 5-on 2-off` | Info card: Full Rest · Deep Sleep & Active Recovery · Optimized Nutrition |

### Card rendering rules
- **Day 5 (Conditioning):** Render as `.day-card` with amber (`#d97706`) accent. Expandable
  panel shows a "Browse Conditioning Corner →" link to `dashboard.html?tab=conditioning`.
  No static exercise list — pulls from the Conditioning Corner library at runtime.
- **Day 6 (Active Rest):** Render as `.day-card` with teal (`#0d9488`) accent. Expandable
  panel shows three activity rows (icon + name + description). Not a training card — no
  exercise counter, no rest timers.
- **Day 7 (Rest):** Render as `.day-card` with slate (`#334155`) accent. Expandable
  panel shows three recovery-focus rows. No exercise counter, no rest timers.
- **Footer order:** PROGRAM SUMMARY → navigation bar → Finish Workout banner must
  appear below the Day 7 card. No content may overlap or clip Day 7.

---

## Gym Programming Rules & Station-Anchoring Constraints

> **Permanent constraint applied to all future program builds.** Every superset,
> triset, and giant set must satisfy exactly one of the four approved archetypes.
> These rules exist to eliminate equipment hogging in a commercial gym.

### The Station-Anchoring Principle

All supersets, trisets, and giant sets must be **completely station-anchored**.
The trainee completes the entire sequence within a single, minimal footprint —
one piece of equipment or one square area — without walking across the floor.

**Forbidden pairings (never do this):**
- Two different major machines in the same block
- A machine + a separate cable column
- A barbell rack + a distant bench movement

### Approved archetypes

**A. DB / Bench Anchor**
Entirely dumbbell-based movements at a single adjustable bench.
> Example: Seated DB Shoulder Press → Incline DB Fly → Incline DB Hex Press

**B. DB / Fixed-Barbell Combo**
A single fixed-weight barbell or EZ-bar paired with dumbbells or bodyweight
at a single bench station.
> Example: EZ-Bar Skull Crusher → DB Hammer Curl (seated at same bench)

**C. Single-Machine Anchor**
A machine movement paired **only** with a bodyweight exercise or a dumbbell
exercise where the DBs are brought directly to that machine before starting.
> Example: Leg Press → BW Calf Raises on the platform → DB Goblet Squat next to machine

**D. Single-Cable Column Anchor**
One cable stack with multiple attachments, or a cable movement paired with
a DB/bodyweight exercise executed directly in front of that same machine.
> Example: Tricep Rope Pushdown → Overhead Cable Extension (same pulley) → BW Push-Ups

### Intensity & time-efficiency drivers

- **Mechanical Drop Sets:** Transition immediately from a weaker to a stronger
  movement using the same weight and equipment (e.g., DB Fly → DB Hex Press,
  same dumbbells).
- **Rest-Pause / Myo-Reps:** Single-station or machine movements only —
  no weight changes or setup adjustments required.

### Single-bar barbell complex (grouped-block archetype for barbell phases)

A tri-set or superset may be run as a **single-bar complex**: one loaded
barbell / EZ-bar used for 2–3 movements back-to-back at one station, no
re-loading and no walking. This is the most station-anchored block possible and
keeps a barbell phase barbell-dominant (it extends Archetype B).

### Smith / Olympic-barbell independence (Modality Matrix Phase 2 rule)

> **Permanent rule for Barbell & Smith programs.** Smith-machine and Olympic
> (7 ft) barbell movements are **independent** — they may never share a tri-set
> or superset. Concretely:
> - **Smith lives only at Pos 8 (cluster) & Pos 9 (drop)** — single-station,
>   never inside a grouped block. Exactly **2 Smith lifts per day**.
> - **Olympic-barbell compounds are standalone** (Pos 1–2) — never supersetted.
> - **Grouped blocks (Pos 3–7) are single-bar EZ/short-barbell complexes.** A
>   Smith move may only ever pair with a **mobile EZ-bar / BW / DB** brought to
>   the Smith — never with an Olympic compound.
> - The day is **dominantly barbell** (Olympic at Pos 1–2 + barbell complexes at
>   Pos 3–7), with the Pos 10 bodyweight finisher per the standard.

### Cable / plate-loaded independence (Modality Matrix Phase 3 rule)

> **Permanent rule for Cable & Plate-Loaded programs.** The day is
> **cable-dominant** with exactly **3 plate-loaded machines**, and the 3 phases
> together (DB → Barbell/Smith → Cable/Plate-loaded) cover every equipment type.
> - **Plate-loaded lives only at Pos 1 (low-rep anchor), Pos 8 (cluster) &
>   Pos 9 (drop)** — standalone single-station, never inside a tri-set/superset.
>   The Pos 1 plate-loaded compound carries the heavy 5×5 the cables can't.
> - **Grouped blocks (Pos 3–7) are pure single cable-column complexes** — one
>   stack, swap attachments for 2–3 moves at that column (Archetype D), no DB/BW.
> - **Cable** fills Pos 2–7; the **Pos 10 bodyweight finisher** per the standard.

### Applied workout structure (10 exercises/session)

| Position | Exercise type | Station rule |
|----------|--------------|--------------|
| 1–2 | Compound (standalone) | No superset — station-anchoring N/A |
| 3–5 | TRI-SET | Must satisfy one archetype (A/B/C/D) |
| 6–7 | SUPERSET | Must satisfy one archetype (A/B/C/D) |
| 8 | CLUSTER SET | Single station only |
| 9 | DROP SET | Single station only |
| 10 | FINISHER | Bodyweight only — no station constraint |

### Day-type archetype assignments (reference)

| Day | Tri-Set Archetype | Superset Archetype |
|-----|------------------|--------------------|
| Chest & Biceps | D (Single Cable Column) | B (EZ-Bar + DB at bench) |
| Shoulders & Triceps | D (Single Cable Column) | D (Single Cable Column) |
| Back & Traps | A (DB / Bench Anchor) | C (Machine + DB pre-staged) |
| Legs | C (Leg Press or Machine Anchor) | C (Machine + DB or BW) |

---

## Per-Day Intensifier Coverage (multi-week / modality programs)

> **Permanent rule.** In any program where the exercises stay fixed across a
> multi-week block (e.g. **The Modality Matrix**), every training day must
> independently carry the **7 intensifiers in every week** (low-rep, high-rep,
> TUT, tri-set, superset, cluster, drop). A weekly theme must never strip an
> intensifier out of the day — the week's dominant style is applied **visibly to
> exactly 4 feature lifts**, not the whole workout.

**Each training day = 10 exercises** on a fixed position → intensifier blueprint
(the 10-exercise table above). The intensifier TYPE per position never changes
week to week. Within those 10 exercises:

- **Required every day, every week:** low-rep, high-rep, TUT, tri-set, superset,
  cluster, drop set — plus a **2 / 4 / 4 working-set mix** (2 five-set, 4 four-set,
  4 three-set). **Tri-sets are always 3 sets.**
- **6 ANCHORs** keep a FIXED rep scheme across all weeks (only load/cues progress).
  Anchors guarantee the spread is always present:
  - **Pos 1** = low-rep anchor (heavy ~5×5, every week) · **Pos 10** = high-rep
    finisher anchor (bodyweight, high-rep/AMRAP every week)
  - **Pos 4** (a tri-set member) = TUT anchor — fixed **3 sec negatives / 2 sec
    pauses** every week (TUT gets an explicit structural home, not just notes)
  - **Pos 3** tri-set · **Pos 7** superset · **Pos 9** drop
- **4 FEATURE lifts (Pos 2, Pos 5, Pos 6, Pos 8)** visibly take on the week's
  theme in the **set field itself** (real pyramid strings, explicit `@ tempo`
  notation, paired supersets) while keeping their set count and base role.
- **Week themes (5-week block):** **W1 Low-Rep · W2 Pyramid · W3 Tempo (explicit
  e.g. `@ 4-0-1`) · W4 High-Rep · W5 Superset.** Pyramid and tempo must appear as
  actual schemes, not just coaching notes. The low-rep week uses a **mix**
  (5×5 · 5×8 · 8/6/4/4 · 4×6) across the lifts of differing set counts.
- **`renderWeekTabs` must derive from `WEEK_THEMES`** (no hardcoded 4-week list).
- **W5 superset-week contingency (render-time).** The Superset week is
  superset-dominant, so a tri-set defeats the theme. `renderExercise` collapses
  the Pos 3–5 tri-set **in W5 only** — **Ex 3 runs standalone, Ex 4–5 pair as a
  superset** — keyed off `currentWeek === WEEK_THEMES.length-1 && tag === "TRI-SET"`.
  The blueprint **data is unchanged** (Pos 3–5 stay tagged `TRI-SET`); the swap
  is display-only and must be carried in every cloned program page.

> **8-exercise training days are forbidden** under this rule — expand to the full
> 10-position blueprint so the complete intensifier spread fits.

### Shipping checklist — get a multi-week program right the first time

These are hard-won gotchas; check them **before opening the PR**:

1. **One `w[]` entry per week theme.** Every exercise's `w` array length MUST equal
   `WEEK_THEMES.length` — `currentWeek` indexes straight into it, so a short array
   renders `undefined`. Add a week theme → add a `w[]` entry to *every* exercise.
2. **Week/phase count must agree in every surface.** When the count changes, update
   ALL of: the render schedule label (`"N-Week Block"`), the `cat-*.html` meta
   badges **and** phase week-ranges, the `dashboard.html` `.cat-count`, and the
   `mc-pm-data.js` `meta`. (The Modality Matrix lives in 4+ spots — 12→15 touched
   them all.)
3. **Themes drive the tabs.** `renderWeekTabs` derives from `WEEK_THEMES`; never
   hardcode the week list or duplicate the short theme names so they can drift.
4. **Pre-merge parse-check (required gate).** `new Function()`-syntax-check the
   inline `<script>`, then parse the `DAYS` array and assert for **every training
   day × every week**: all 7 intensifiers present, the 2/4/4 working-set mix holds,
   tri-sets = 3 sets, and the week's theme is **visible in the set field** (a real
   pyramid string in the pyramid week, `@ x-x-x` tempo in the tempo week, a paired
   superset in the superset week). Notes alone do not satisfy this.
