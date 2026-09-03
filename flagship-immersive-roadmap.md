# Flagship Immersive Roadmap — Spatial Muscle Intelligence + Biometric Recovery

> Opened 2026-09-02. Scope, positioning and the two feature vectors below were
> locked via two `AskUserQuestion` rounds in the session that opened this
> document (core identity: **high-aesthetic immersive experience**; vectors:
> **spatial muscle heatmap** + **wearable/biometric recovery sync**; social/
> community layer explicitly **out of scope**; infrastructure ambition:
> **new Supabase tables + browser sensor APIs allowed**). Per the Planning
> rule in `CLAUDE.md`, creating this document is sufficient to begin `H0`
> directly — no separate "approved" reply required — but each phase after
> `H0` still gets its own `AskUserQuestion` check-in before starting, per the
> multi-phase-work rule, and `H3` (the Supabase schema step) is called out
> below as needing one explicitly. Scratch-listed in `content-manifest.json`,
> so it never ships to the public Rolodex build (same as every other
> companion roadmap linked from `CLAUDE.md`).

> **`H0` shipped (2026-09-02).** `MC_CHART.bodyMap(dataByGroup, opts)` added
> to `mc-chart.js` alongside the existing `line`/`bars`/`heatmap`/`ring` —
> same pattern (pure function, returns SVG markup strings, no dependency on
> any other module, colors default to page tokens). Front and back figures
> are two independent `<svg>` strings (no wrapping markup, matching every
> other function here); `view:'front'|'back'|'both'` (default `'both'`)
> picks which. Nine regions match `MC_MUSCLES`' own group ids exactly
> (calves/shoulders/legs/triceps/back/chest/core/biceps/forearms) — the
> front figure is canonical for 7 of them, the back figure for `back` and
> `triceps` only. **A real bug caught before finalizing:** the first draft
> colored a group from `dataByGroup` on *both* figures wherever it had a
> shape (e.g. `legs` on the back figure too), contradicting the "one value
> per group" design — fixed by splitting each figure's shape list into
> `ALL` (drawn) vs. `PRIMARY` (data-colored; everything else on that figure
> renders as a fixed neutral/dimmed region regardless of data). Verified
> programmatically (region counts, front/back title placement, the
> `Forearms` group's colored title appearing exactly once — front only —
> not twice) and once visually via the design-review process this session
> already ran the same coordinates through. No new store, no CSS-token
> change: colors reuse the app's existing `--accent`/`--success`/`--danger`
> tokens (no new semantic hue introduced), and the neutral/dim fill matches
> `heatmap()`'s own existing "off cell" treatment
> (`rgba(255,255,255,0.06)`), so nothing here is new to
> `check-design-tokens.js`, which only scans `*.css` files in any case — a
> runtime-generated SVG string in a `.js` file is outside its scope. No test
> file added, matching the file's existing precedent: `line`/`bars`/
> `heatmap`/`ring` have none either. `H1` (wiring this into the Stats hub)
> still needs its own `AskUserQuestion` gate before starting.

> **`H1` shipped (2026-09-03) — two decisions locked first.** Replace, not
> supplement: the Stats hub's old 30-day muscle-volume bar list
> (`renderMuscles()`/`#muscleCard`) is gone, not duplicated alongside the new
> map. Default mode on load: **Recovery**, not Volume — the vector this whole
> roadmap was scoped around, and the newer of the two signals.
>
> **A real touch-target constraint changed the tap-through design from what
> Feature 1's spec literally said.** The spec called for tapping an SVG
> region directly; measured against this card's actual width on a 320–390px
> phone (two figures side by side inside a ~680px-max content column with
> 16–32px of padding stacked on both sides), a region's real screen size
> — a forearm or bicep rect included — comes out well under the app's 44px
> touch floor. Padding every limb's hit-area out to 44px would make
> neighboring regions' hit zones overlap enough that tapping one would
> often land on another. So the SVG stays a pure visual (still carries
> `<title>` tooltips), and the tap-through target is a 9-chip legend below
> it, built on `.ready-board`/`.ready-chip` — the exact component
> `renderCurrentReadiness()` already uses one section up on this same page
> for its own live-readiness grid, so this borrows a real ≥44px control
> rather than inventing a second one. Tapping a chip opens
> `mc-exercise-trends.js`'s sheet on that muscle group's most-logged
> exercise (all-time, not scoped to the 30-day window Volume mode displays,
> so a chip stays useful even for a muscle trained a while ago); a chip with
> no logged history at all renders `.static` — visible, not tappable.
>
> `MC_CHART` gained one more export, `bodyMapColorFor` — `H0`'s internal
> low/mid/high bucket function, exposed so the chip legend colors its bars
> with the exact same thresholds the body map used, rather than a second
> copy of that logic at the call site.
>
> `mc-stats.js`'s `renderWeekMuscles()`/`renderCurrentReadiness()` (the
> separate week-picker view further up the same page) are untouched — out
> of this phase's scope, since the roadmap named `renderMuscles()`
> specifically and touching the week-picker's own muscle view was never
> part of the locked decisions.
>
> Verified with a stubbed-DOM harness driving the real source (not a mock):
> default Recovery render (9 chips, correct default-active toggle state),
> a real mode toggle round-trip (Volume shows "last 30 days" + correct
> per-group set counts, Recovery restores cleanly), and the empty-state
> path when `MC_READY` is unavailable and the log has no sets — all three
> render without throwing and degrade to the expected empty-state copy
> rather than a blank card. All local CI-equivalent gates run clean:
> `check-exports`, `check-single-impl`, `check-script-manifest`,
> `apply-head-contract --check`, `check-design-tokens`,
> `check-store-coverage`, `check-topbar-inset`, `build-market --check`, and
> a full tree-wide `node --check` sweep.

> **`H2` shipped (2026-09-03) — three decisions locked first.** Placement:
> the reveal sits right after the strain ring, before the stats grid — the
> visual payoff while attention is highest, not a closing afterthought.
> Save-card scope: a small standalone canvas export, not a shared pipeline
> with `mc-wrapped.js`. Animation: static reveal only, no ~1.2s stagger —
> this session has no headless browser to verify animation timing/easing
> against (the same constraint `premium-design-roadmap.md`'s `P4` and
> `W-I3` already hit re-baselining ratchets from here), so it ships
> something verifiable instead of a motion feel nobody here could watch.
>
> **The roadmap's own "reuse mc-wrapped.js's canvas pipeline" assumption
> didn't survive reading the real code**, and this is exactly the kind of
> gap the alignment round exists to catch before code, not after: `save()`
> in `mc-wrapped.js` is one monolithic function drawing its own specific
> 1080×1350 card tied to its own month/year aggregate data — there is no
> separated export helper to plug a second card into. `mc-finish.js` gets
> its own small `saveMuscleCard()`, deliberately duplicating the
> `canvas.toBlob` → share-sheet/download plumbing (~20 lines, same pattern
> `mc-wrapped.js`'s `save()` already uses) rather than refactoring a
> shipped, working feature as a prerequisite to this one.
>
> `renderMuscleReveal()` computes a per-session muscle read from
> `entry.sets` (`sessionMuscleData()`) — a single session has no meaningful
> 0–100 "recovery" reading of its own, so this reuses `H1`'s Volume
> convention (percent of this session's own max-group set count), not the
> Recovery one. Wired directly into `showDone()` (the one place that both
> already calls `renderStrain()`/`renderRefuel()` in this exact pattern
> and is guaranteed to run right after the entry is saved) rather than
> listening for the `mc:workout-finished` `CustomEvent` the roadmap's
> spec named — that event exists for a *different* consumer
> (`program-day-view-roadmap.md`'s day-identity listener on a separate
> page), and `showDone()` already has the entry in hand synchronously, so
> a same-file function call is simpler and one less moving part than an
> event round-trip to itself.
>
> `mc-chart.js` gained one line: `bodyMap()`'s root `<svg>` now carries
> `xmlns="http://www.w3.org/2000/svg"`. Free in every existing caller
> (inserted via `innerHTML`, where the HTML parser resolves the namespace
> regardless), but required for `H2`'s new use — loading the same markup
> as a standalone `Image().src` data URI for canvas export, which is not
> guaranteed to render without it.
>
> Verified in isolation (the full `mc-finish.js` self-inits off
> `location.pathname` at load, so it isn't `require()`-able the way
> `mc-chart.js`/`mc-stats.js` are; `sessionMuscleData()`'s exact body was
> extracted and run standalone instead): correct percent-of-max
> normalization (3/3/1/2 sets across three groups → 100/66.7/33.3), `null`
> on an empty or missing session, and the two-figure `bodyMap()` render
> reading a `Chest · 100%` title with `xmlns` present on both `<svg>`
> roots. Every page carrying `mc-finish.js` (77) already loads both
> `mc-chart.js` (80) and `mc-muscle-map.js` (83) — confirmed by diffing
> the two script-tag sets, not assumed — so no page's script list needed
> touching. All local CI-equivalent gates re-run clean on the new commit:
> `check-exports`, `check-single-impl`, `check-store-coverage`,
> `check-script-manifest --check`, and a full tree-wide `node --check`
> sweep.

---

## 1. Executive summary & codebase audit

### 1.1 Current architecture (verified by reading the source, not assumed)

This is not a green-field app being pitched a first flagship feature set — it
is a ~90-module vanilla-JS PWA that has already run **seven prior roadmap
initiatives** to flagship-grade completion (see `CLAUDE.md`'s Active
Development Plan): a launch-readiness pass (`L0–L6`), a cross-app nutrition
bridge (`B0–B5`), a program-day/schedule model (`D0–D3`, `F0–F5`), a full
runtime-performance + card-UX overhaul (`S0–S6`, −99.5% mutation-record
rate), a design-token refit (`P0–P5`), and a fleet-wide accessibility/contrast
audit (`W-I1–W-I4`). Concretely, at the time this document was written the
app already has, verified by reading each file:

- **Frictionless logging** — ghost-fill suggested weights that solidify on
  first keystroke, auto-advancing active card, a 44px touch-floor ratchet,
  and a measured 2983.8 → 15 mutation-records/sec runtime (`card-integration-
  roadmap.md`).
- **Progression math** — `mc-suggest.js` (equipment-aware next-session load
  suggestions from RPE/rep history) and `mc-maxout.js` (equipment-discounted
  Epley e1RM).
- **Recovery/strain modeling** — `mc-readiness.js` (per-muscle 0–100%
  recovery curve, saturating-exponential, τ stretched by volume and RPE) and
  `mc-strain.js` (0–21 daily strain score, MET-based kcal estimate) — both
  explicitly WHOOP-inspired in their own header comments, and both derived
  **entirely from lifting history**, never from a biometric sensor.
- **Analytics** — `mc-stats.js` Stats hub: consistency heatmap, tonnage
  trend, PR timeline, volume-per-muscle (bar list), week-over-week
  comparison; `mc-exercise-trends.js` per-lift progress sheets;
  `mc-wrapped.js` shareable PNG recap cards (canvas-rendered, fully offline).
- **Chart primitives** — `mc-chart.js` (`MC_CHART.line/bars/heatmap/ring`) —
  hand-rolled SVG, no library, capped at ≤200-point datasets by design
  (no-build-step constraint).
- **Muscle taxonomy** — `mc-muscle-map.js` (`MC_MUSCLES.classify()`), a
  regex classifier over exercise names into **9 groups**: calves, shoulders,
  legs, triceps, back, chest, core, biceps, forearms. This is the single
  source of muscle-group truth already consumed by both the Stats hub and
  `mc-readiness.js` — the new features below reuse it rather than inventing
  a second vocabulary.
- **PM/design governance** — a design-token system (`--ink-*`, `--fw-*`,
  `--r-*`) with a hard-fail CI gate (`check-design-tokens.js`) that catches
  even *cool dark neutrals by luminance formula*, not just by name — the
  bar this roadmap's own visual work needs to clear.

### 1.2 Key UI/UX bottleneck identified in Phase 1

The gap is not logging friction, not progression math, not analytics
breadth — all three are already deep. The gap is **presentation dimension**:
every piece of muscle/recovery data the app already computes is rendered as
a **list or a bar chart**. There is no spatial encoding anywhere in the
tree — confirmed by grep across every `.js` file for `silhouette`,
`body-map`, `heatmap.*body`, `svg.*body`: zero matches outside `mc-chart.js`
itself (which defines a *calendar* heatmap, not a body one) and two files
that only use the word "heatmap" to mean the same calendar chart. A trainee
can see "Chest: 4,200 lb this week" as a bar, but never see *where on their
own body* that volume landed relative to everything else — which is exactly
the visual language STNDR-, Hevy-, and RP-style apps lead with on their
analytics screens (see the sourcing caveat in §1.3).

The second bottleneck is narrower: `mc-readiness.js`'s recovery model is
**100% inferred from training history** — no HR, HRV, or sleep signal exists
anywhere in the codebase (confirmed: zero matches for `heart.?rate`,
`HRV`, `HealthKit`, `wearable`, `DeviceMotion` across every `.js` file). Two
trainees who lift identical volume at identical RPE get identical recovery
numbers regardless of how they actually slept — the model cannot tell them
apart.

### 1.3 Benchmark gap analysis — with a correction the audit surfaced

The task brief that opened this session named five benchmark apps: STNDR
(CBUM), Daily Gainz (Bradley Martyn), RP Hypertrophy, Hevy, and WHOOP.
**Two of those five are not external competitors to this app — they are
licensed content already shipping inside it.** `content-manifest.json`
lists `stndr` (owner "STNDR / CBUM", files including `cat-stndr.html`,
`stndr-checkoff.js`, `push-pull-legs.html`, `bro-split.html`,
`arnold-legacy.html`, `weeks-to-open.html`) and `gainz` (owner "Bradley
Martyn / Daily Gainz", files including `2on-1off.html`,
`3on-1off-high-freq.html`) as **licensed influencer program tiers of this
same app**, market-stripped out only for the public Rolodex build. Comparing
this app against STNDR/Daily Gainz as if they were rival products would
have been comparing the app against a piece of itself.

That leaves RP Hypertrophy, Hevy, and WHOOP as the genuinely external
references. **I do not have verified, current, sourced information about
those three apps' actual shipped feature sets** — no citation, screenshot,
or documentation was available in this session to confirm specifics, and my
training-data knowledge of fast-moving consumer apps may be outdated or
wrong in detail. Where this document invokes them below, it is only as a
**category label** for a known design pattern (e.g. "an anatomical
volume/recovery map, the kind these categories of apps are known for"), not
as a factual claim about any specific app's current UI. Verify against the
live apps before using this document to make a competitive claim externally.

---

## 2. The flagship feature proposals

Four proposals, all built from the two locked vectors (spatial muscle
heatmap, biometric recovery sync) plus the locked identity (high-aesthetic
immersive experience) — the last two proposals are the "immersive" payoff:
they fuse the first two into one premium moment at the start and end of a
session, rather than shipping two isolated widgets.

### Feature 1 — Spatial Muscle Engagement Map

**Concept vision.** Replace/supplement `mc-stats.js`'s `renderMuscles()` bar
list with an interactive front/back anatomical SVG body diagram. Each of the
9 `MC_MUSCLES` regions is a tappable path, shaded on a single continuous
scale rather than a categorical palette — the app already has a governed
`--ink-*` ramp and a `COOL_SEMANTIC`/`COOL_PENDING` dark-mode gate
(`premium-design-roadmap.md` `P5`) that this must be authored against from
day one, not retrofitted into later.

**UI/UX spec.**
- Two toggled modes, sharing one SVG: **Volume** (this week's tonnage per
  region, already computed by `mc-stats.js`'s existing 30-day cutoff logic)
  and **Recovery** (today's 0–100% per region, already computed by
  `mc-readiness.js` — no new math, just a new renderer for existing output).
- Front/back flip via a tap or swipe on the figure itself (CSS 3D flip,
  `transform-style: preserve-3d`, respecting `prefers-reduced-motion`).
- Tapping a region opens the existing `mc-exercise-trends.js` sheet
  pre-filtered to that muscle group's most-trained lift — reuses a shipped
  component instead of building a new drill-in.
- Mobile-first: the SVG viewBox is fixed-aspect and scales to container
  width; touch targets on individual muscle paths are padded to the 44px
  floor via an invisible hit-area overlay path, not the visible fill path
  (a visible deltoid region is much smaller than 44px on a 360px screen).

**Technical architecture & data flow.**
- New function `MC_CHART.bodyMap(dataByGroup, opts)` added to `mc-chart.js`
  alongside the existing `line`/`bars`/`heatmap`/`ring` — same pattern
  (returns an SVG markup string, accent-token driven, no new file), so
  `check-single-impl.js`'s "one canonical implementation" discipline holds
  from the start rather than needing a later consolidation pass like
  `makeRestTimer`/`applyReplacements` did.
- `dataByGroup` is `{calves: 0-100, shoulders: 0-100, ...}` — a plain object
  keyed by `MC_MUSCLES`' existing 9 group ids, normalized to 0–100 by the
  caller (`mc-stats.js` for Volume mode, `mc-readiness.js` for Recovery
  mode). `mc-chart.js` never reaches into `mc_workout_log_v1` itself — it
  stays a pure renderer, consistent with its existing "hand-rolled SVG
  primitives, no business logic" scope.
- No new store, no Supabase change — this feature is a **pure rendering
  layer over data two existing modules already compute**. Lowest-risk of
  the four proposals; should ship first.

**Competitive advantage.** Turns two numbers-only screens (`mc-stats.js`
volume bars, `mc-readiness.js`'s per-muscle percentages, currently rendered
as a list in whatever surfaces it today) into one spatial artifact a
trainee can read in under a second — the category of visualization named in
the §1.3 caveat, built entirely on data this app already owns.

### Feature 2 — Post-Session Muscle Impact Reveal

**Concept vision.** At the moment a workout finishes (`mc-finish.js`'s
`_FW.confirm()` — already the app's one completion point, already emitting
`mc:workout-finished` since `program-day-view-roadmap.md`'s `D0–D3`), show
an animated reveal of the Feature 1 body map lighting up region-by-region in
the order the session actually trained them, ending on the same completion
recap `mc-finish.js` already shows.

**UI/UX spec.**
- Listens for the existing `mc:workout-finished` event — no new completion
  hook needed, the wiring point already exists and is already inert on the
  77 other pages that load `mc-finish.js` but don't finish.
  reveal animates in the recap modal `mc-finish.js` already opens.
- Regions light up sequentially over ~1.2s (staggered, not simultaneous) in
  the order their first logged set occurred this session — a deliberate,
  short, skippable animation (single tap dismisses immediately;
  `prefers-reduced-motion` skips straight to the settled state).
- "Save card" reuses `mc-wrapped.js`'s existing canvas-to-PNG export
  pipeline rather than building a second image exporter — the body map
  becomes one more layer on that canvas, not a new share mechanism (also
  keeps this fully inside the locked "no social layer" decision: it is a
  save-to-device/native-share-sheet image, identical in kind to what
  `mc-wrapped.js` already ships, not a feed or a follow graph).

**Technical architecture & data flow.**
- Consumes Feature 1's `MC_CHART.bodyMap()` directly — this proposal adds
  zero new rendering primitives, only a new caller and the sequencing logic.
- Per-region "first hit this session" ordering reads `mc_setlog_v1` (already
  loaded by every page that reaches `mc-finish.js`), classified through the
  existing `MC_MUSCLES.classify()` — no new store.

**Competitive advantage.** Converts the single moment every trainee is
already paying full attention to (workout completion) into the app's
highest-craft visual beat, at effectively the cost of one new caller over
already-shipped primitives.

### Feature 3 — Biometric Recovery Sync

**Concept vision.** Feed `mc-readiness.js`'s recovery model a real
physiological signal instead of inferring recovery from training load
alone. **This is the proposal with real platform constraints, and they need
to be named plainly rather than glossed over:**

- This is a **browser-only PWA with no native shell**. A web page cannot
  read Apple HealthKit directly — there is no browser API for it. Three
  paths exist, in order of how much new infrastructure they cost:
  1. **Manual entry** (always works, zero platform risk): a small daily
     form — resting HR, sleep hours, a 1–5 subjective readiness — stored
     locally, same pattern as `mc-body.js`'s existing bodyweight log.
  2. **iOS Shortcuts bridge**: I believe (not fully certain, and this may
     have changed since my knowledge cutoff — verify current capability
     before committing engineering time) the iOS Shortcuts app can read
     HealthKit data and make an authenticated HTTP request on an automated
     schedule, which would let a trainee set up a personal automation that
     POSTs their sleep/HRV to a Supabase Edge Function each morning with no
     native app build required on this app's side. This needs a real
     spike against a current iOS device before it's treated as a committed
     plan, not just a roadmap line.
  3. **Web Bluetooth** to a paired HR strap/watch: a real browser API, but
     I believe it is Chrome/Android-only — Safari on iOS has historically
     not implemented Web Bluetooth. If that is still true, this path
     structurally cannot reach the iOS trainees who are likely the
     majority of this app's install base (the app already has Apple-
     specific PWA install-meta handling in its head contract), which would
     make it a partial/Android-only feature, not a flagship one. Verify
     current Safari support before scoping.
  Given those constraints, **manual entry is the only path with zero
  platform risk**, and should be the baseline the feature ships with; (2)
  and (3) are additive enhancements gated on their own verification spikes,
  not prerequisites.

**UI/UX spec.**
- A single daily card (dashboard, near the existing momentum/Today strip
  described in `CLAUDE.md`'s `B3` entry): resting HR, sleep hours, a 1–5
  readiness dial — three taps, no keyboard needed for two of the three
  fields (steppers, not text inputs).
- `mc-readiness.js`'s existing per-muscle recovery curve gets a bounded
  multiplier from this signal (e.g. a bad-sleep night dampens the recovery
  curve's τ growth, consistent with the file's existing "τ stretches with
  volume/RPE" language — this is one more input to the same formula, not a
  parallel model).
- Recovery Score surfaces as a single ring (`MC_CHART.ring()` — already
  exists, zero new chart work) on the dashboard, and as an input to Feature
  4 below.

**Technical architecture & data flow.**
- New store `mc_biometric_v1` — append-only `[{id:<iso>, date, restingHr,
  sleepHrs, readiness, source:'manual'|'shortcuts'|'ble'}]`, same shape and
  same `arrayById` sync strategy `mc_body_v1` already uses (direct
  precedent in the same file family). **Must be added to
  `store-registry.json` in the same change** per the repo's standing rule,
  with `mc-sync.js` `STORES` and `mc-export.js` `KEYS` updated together —
  `check-store-coverage.js` fails CI otherwise.
- New Supabase table `biometric_samples` (user_id, date, resting_hr,
  sleep_hrs, readiness, source, created_at) **only if/when the Shortcuts
  bridge (path 2 above) is actually built** — the manual-entry baseline
  needs no server table at all, since it rides the existing local-first +
  `mc-sync.js` cross-device path every other `mc_*` store uses. Follows the
  `mc-supabase` skill's own guidance: "use `list_tables` before schema
  changes."
- This is the one step in this document that touches server schema, so per
  `CLAUDE.md`'s multi-phase rule it gets its own `AskUserQuestion` gate
  before `H3` starts, even though the roadmap document itself doesn't need
  a second approval to exist.

**Competitive advantage.** A recovery score that responds to how a trainee
actually slept, not just how much they lifted — the category of signal
named in the §1.3 caveat, built honestly within what a browser can actually
access rather than assuming a native-app-only capability is available here.

### Feature 4 — Immersive Pre-Session Readiness Brief

**Concept vision.** The "flagship leapfrog" that ties Features 1–3 into one
premium moment instead of three separate widgets: a full-screen brief a
trainee sees when they tap "Start Workout," showing today's Recovery Score
(Feature 3) overlaid on the body map (Feature 1) in Recovery mode, scoped to
just the muscles today's prescribed workout will train.

**UI/UX spec.**
- Triggered from the existing program-day "Start Day N" CTA
  (`mc-program-day.js`/`F0`'s dashboard day module, or a workout page's own
  entry point) — an interstitial, not a new navigation destination.
- Body map renders in Recovery mode, but only the muscle regions today's
  prescribed exercises will hit are at full opacity; everything else is
  dimmed — computed from the day's exercise list run through
  `MC_MUSCLES.classify()`, the same classifier every other proposal here
  reuses.
- One clear action: "Begin" (dismisses into the normal workout flow,
  unchanged) — this is a 2–3 second beat, not a blocking gate; skippable
  with one tap, respects `prefers-reduced-motion`, and — like Feature 2 —
  never blocks or delays the actual logging flow the `S0–S6` runtime work
  spent so much effort making fast.
- If Feature 3's signal shows a muscle group is under-recovered for what's
  prescribed, a single non-blocking inline note appears (e.g. "Shoulders
  are still recovering — consider a lighter top set") — advisory only,
  never auto-modifies the prescribed weights (that would be intra-workout
  auto-regulation, a vector this roadmap's `AskUserQuestion` round
  explicitly did not select).

**Technical architecture & data flow.**
- Pure composition of Features 1 + 3's existing outputs plus the day's
  exercise list (already available wherever the day module renders) — no
  new store, no new chart primitive, no new classifier.

**Competitive advantage.** This is the proposal that actually earns the
"high-aesthetic immersive experience" identity locked in this session's
alignment round — Features 1–3 are each real but incremental on their own;
this is the one moment where the visual and biometric investment reads as a
single premium product beat rather than three dashboard widgets.

---

## 3. Step-by-step production implementation plan

| Phase | Maps to spec's | Content | Gate |
|-------|-----------------|---------|------|
| **H0** | A (primitives) | `MC_CHART.bodyMap()` in `mc-chart.js`; a static 9-region front/back SVG (calves/shoulders/legs/triceps/back/chest/core/biceps/forearms) authored against the existing `--ink-*`/`COOL_SEMANTIC` tokens from day one | None — this doc authorizes starting immediately per the Planning rule |
| **H1** | A (integration) | Feature 1 wired into `mc-stats.js`'s Stats hub, Volume + Recovery modes, tap-through to `mc-exercise-trends.js` | `AskUserQuestion` before starting (multi-phase rule) |
| **H2** | C (integration) | Feature 2 — post-session reveal off `mc:workout-finished`, `mc-wrapped.js` export integration | `AskUserQuestion` |
| **H3** | B (state/engine) | Feature 3 — `mc_biometric_v1` store + `store-registry.json`/`mc-sync.js`/`mc-export.js` updates (manual-entry baseline); Shortcuts-bridge and Web Bluetooth paths spiked and verified **before** being scoped as committed work, not assumed | `AskUserQuestion` **explicitly required** — this is the schema-touching phase |
| **H4** | C (integration) | Feature 4 — the fusion pre-session brief | `AskUserQuestion` |
| **H5** | D (production readiness) | `check-journey.js`/`check-visual-ratchet.js`/`check-contrast.js --dark` coverage for every new screen; `measure-session.js` budget check (the body-map SVG must not reintroduce the mutation-storm class of regression `S0–S6` eliminated); Quick Tour doc update per the Documentation currency rule (`quick-tour.html`/`quick-tour-overview.html` — this is app-wide, not program-specific) | `AskUserQuestion` before declaring done |

Each phase ships as its own PR against `main` of `4-Weeks-to-Open-`, per the
repo's standing branch/PR discipline — this document does not implement any
of `H0`–`H5` itself.

---

## 4. What this roadmap deliberately does not do

- **No social/community layer** — explicitly excluded in this session's
  alignment round. `mc-share.js`'s peer-to-peer link export stays the only
  sharing mechanism; Feature 2's "Save card" is a device-local image export
  in the same family as `mc-wrapped.js`, not a feed.
- **No intra-workout auto-regulation, no tempo/velocity capture** — both
  were named as verified gaps in Phase 1 but were not selected in the
  alignment round. Feature 4's advisory note is the only place this
  roadmap touches "adjust today's session," and it is explicitly
  non-blocking and non-mutating.
- **No claim that this makes the app superior to RP Hypertrophy, Hevy, or
  WHOOP specifically** — per §1.3, I don't have verified current
  information about those products to make that comparison responsibly.
