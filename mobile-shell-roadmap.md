# Mobile Shell Roadmap — M0–M5

**Opened 2026-08-22.** Owner-directed, evidence-led. Every number below was
measured live (headless Chromium, iPhone 13 viewport 390×844, `isMobile`,
`hasTouch`) against the real tree at `origin/main` — not inferred from source.
Harness: `tools/measure-shell.js` (added in M2).

Scratch-listed in `content-manifest.json`, so it never ships to the public
Rolodex build.

---

## Why this exists

Real-device screenshots from the owner (2026-08-22) showed collisions that the
three prior audits had each partly seen but none had assembled. Measuring the
live pages produced the governing fact:

**An active workout page runs 6–7 simultaneous fixed layers and spends 25% of
the viewport on chrome before any content renders — and 55.7% of the viewport
is covered once a rest timer is actually running.**

> **Corrected 2026-08-22, after building the M3 prototype against the real
> page.** This document previously said 36.4%, derived from `.timer-float`'s
> declared `height:64px` in `base.css`. Measured live on `5on-2off.html` with a
> set logged and the timer counting, the rest panel renders **220px** tall
> (y427–647), and the union of all covered vertical space — overlaps counted
> once — is **470px of 844 = 55.7%**. The earlier figure was too kind. A
> declared height is not a rendered height; only the second one is a fact.

| Page | Fixed layers | Top | Bottom | Chrome |
|---|---|---|---|---|
| `mm-p1.html` | 7 | 46px | 165px | 25% |
| `5on-2off.html` | 6 | 46px | 165px | 25% |
| `chest-tri-pump.html` | 7 | 46px | 165px | 25% |
| `back-traps-pump.html` | 7 | 46px | 165px | 25% |
| `bis-tris-pump.html` | 7 | 46px | 165px | 25% |
| `arnold-legacy.html` | 6 | 46px | 165px | 25% |
| `bro-split.html` | 6 | 0 | 165px | 19.5% |
| `kitchen-sink.html` | 6 | 0 | 165px | 19.5% |

Layer census on `mm-p1.html` at load:

| z-index | element | band |
|---|---|---|
| 1180 | `.mc-qp-trigger` ("Short on time?") | y614–651 |
| 999 | `.prog-bar-wrap.mcs-stat` | y0–46 |
| 141 | `.mc-theme-toggle-float` | y54–94 |
| 140 | `nav.mc-nav` | y789–844 |
| 120 | `#fwBar.fw-bar` | y679–784 |
| 98 | `#mcVoiceBtn.mc-voice-btn` | y597–645 |
| 20 | `#weekSel.week-selector` (sticky) | y221–308 |

260 z-index sites tree-wide, 40+ distinct raw values topping out at 99999.
A 7-token contract exists at `base.css:110-160` — **only 8 rules in the entire
tree use it.**

---

## Confirmed defects (each verified live, with the reproduction)

**D1 — Stat bar punches through the Finish/Exit modal.** Vertical hit-test down
x=195 on `5on-2off.html` with the recap open returns
`div.prog-bar-wrap.mcs-stat z=999` at y=5–46, and the modal (`z=110`) only from
y=50. The app's most important dialog has an opaque 46px strip through its top.

**D2 — Unstyled session stats.** `cat-pmc.html` is the only page in either repo
loading `mc-summary.js` without linking `mc-summary.css`. Drive it split →
workout and `buildStatBar()` fires with no stylesheet: `.mcs-stat-row` renders
`display:block`, producing the literal string `"00:00elapsed0sets done"` in a
38px box overflowing a 3px bar at z999, painted over `.pl-topbar`. Matches the
owner screenshot exactly. *Note: does not reproduce at cold load — the builder
bails with no `.fw-bar` and no cards. State matters.*

**D3 — Duplicate Finish bar and `_FW` clash.** `cat-strength.html:1218` builds
its own `.fw-bar` with `id='fwBar'` in inline JS **and** loads `mc-finish.js`
(`:1258`), which injects another. Two elements share one DOM id; two progress
counters disagree ("0 / 32 sets" vs "0 / 0 sets"). The page also defines `_FW`
while the module sets `window._FW` — one clobbers the other. `run-workout.html`
has the duplicate bar without the `_FW` clash. `mc-finish.js`'s `inject()`
(`:462`) has no idempotency guard. Bounded to **2 pages**;
`the-500`/`hell-week`/`driveway-demolition` build their own bar but correctly
do not load the module.

**D4 — Bottom reservation is 65px short.** `mc-nav.css:40` reserves 196px.
Occupied band with a timer running: nav 0→55, `.fw-bar` 60→169,
`.timer-float` 197→261. `bottom:197px` is a flat literal with no `env()`, so
the shortfall is identical in-tab and notched.

**D5 — Voice mic buried under the rest timer.** `.mc-voice-btn` z98 occupies
y597–645; the running `.timer-float` z100 occupies y427–647. The mic is fully
inside it — visible in the before/after capture as simply absent from the
screen. Unusable exactly when you would speak to it.

**D6 — Sticky tab rows pin under the stat bar.** `.week-tabs` (`base.css:266`,
z8), `.tabs-bar` (28 pages, z8), `.week-selector` (mm-p1/2/3, hv-block, z20)
all stick to `top:0` — the same 46px the z999 stat bar occupies. Confirmed at
scroll-bottom on `mm-p1.html`: `.wtab` hit-tests to `.prog-bar-wrap`.

**D7 — WITHDRAWN, not a defect (checked 2026-08-22).** Listed as a duplicate
suggestion chip on the strength of a raw count of 2. Measured properly:
`mm-p1.html` has **3** conditioning links, 1 excluded as the nav tab, **2
eligible**, and `inject()`'s per-link guard (`if (a.dataset.mcCondChip) return;`)
gave each exactly one chip. One chip per link is the intended behaviour. A count
of two is not evidence of double-injection when the thing being counted has two
legitimate sources. (The nav-leak the owner photographed is separately **already
fixed** at `mc-cond-suggest.js:111` — that screenshot came from a stale
service-worker cache. See M0.)

**D10 — 25 pages rendered two elements with `id="timerFloat"`.** Found while
verifying D3, by a duplicate-id assertion added for D3 — not by looking for it.
`buildTimerFloat()` guards with `getElementById('timerFloat')`, which is correct
in isolation. But those 25 pages call it from an inline `<script>` positioned
**above** their own static `<div id="timerFloat">`, so the guard runs mid-parse,
finds nothing, and builds a second one. The dynamically-created float lands
earlier in document order and is the functional one; the static div is an inert
duplicate. Not visually broken, which is why it survived — but every
`getElementById('timerFloat')` in the tree was one DOM-order change away from
resolving to the dead element. The static divs are redundant: `mc-timer.js:685`
calls `buildTimerFloat()` unconditionally at load and all 25 pages load it.
`mc-cardio.html` and `the-500.html` keep theirs — their call sits *after* the
markup, so no duplicate is produced.

**D8 — Touch targets.** `exercise-library.html`: 202 × `.fav-btn` at 25×23px,
plus 8 × `.filter-btn` at ~27px height. 10–20 sub-44px controls per workout page.

**D9 — Update delivery is invisible.** `mc-sw-update.js:39` shows its banner via
`getElementById('swUpdate')`, and that element exists on **1 of 141 pages**
(`dashboard.html`). A held update is undetectable everywhere else.

---

## Phases

Each phase is one PR, verified live before merge, with an `AskUserQuestion`
gate before the next. Serial: M2 moves the layers M1 has just made legible, and
M3 deletes layers M2 re-homes.

### M0 — Delivery (fixes must reach the device)
*Approved by owner 2026-08-22.* Nothing else matters if shipped code doesn't
arrive. Confirm or refute the hypothesis that `workoutInProgress()`
(`mc-sw-update.js:47`) stays true at load — restored `.mcl-ck.done` rows would
pin the update hold on permanently for any page with logged sets. **Unproven as
of writing; must be reproduced before it is fixed.** Then give the update
banner a home on every page, not just the dashboard (D9).

### M1 — Confirmed defect sweep
D2, D3, D10, D8, and the safe-area top insets. Low-risk, high-relief, no
architectural change.

**The duplicate-id gate is runtime, not static.** A static scan was written
first and thrown away: nearly every id here is generated by a module at load
time, so source analysis cannot see them, and it produced false positives on
JS template literals (`id="${id}"`), string-concatenation prefixes
(`id="log-"`), mutually-exclusive render branches (`hell-week.html`'s three
`hellTime`), and even on a code comment quoting `id="fwBar"`. It also flagged
three pages that hand-write `fwBar` but never load `mc-finish.js`, where no
conflict exists. The check now lives inside `tools/smoke-test-pages.js`, which
already loads every sampled page headlessly in CI — exact, no allow-list, no
extra browser launch. Regression-tested by reintroducing the real D10 bug and
confirming the gate fails on it.

### M2 — Stacking contract + CI gate
Migrate every fixed/sticky layer onto one documented token scale. Delete the 15
page-local duplicate copies of `.prog-bar-wrap` / `.fw-bar` /
`.fw-modal-overlay` / `.fw-auto-banner`. Fixes D1 and D6. Adds
`tools/check-z-index.js`, failing CI on any new raw z-index on a positioned
element. Adds `tools/measure-shell.js` (committed harness — every number in
this document must stay re-checkable).

### M3 — Session shell
The owner-specified redesign, modelled on a reference app they supplied:

- **Top status bar** becomes the session toolbar: `elapsed | Set n/N |
  End workout`. Replaces both disagreeing counters with one (D3 dies here too).
- **`.fw-bar` is removed.** "End workout" opens the existing modal/recap sheet.
  Terminal and destructive actions are summoned, never resident.
- **Rest timer goes inline** — a row in the set list beneath the set just
  checked (`−15s | Rest 146 sec | +15s`), rendered by `TMR` in `mc-timer.js`.
  **Never a second timer implementation** (permanent rule, CLAUDE.md).
  77 of 79 pages load both `mc-timer.js` and `mc-setlog.js`;
  `conditioning-timer.html` and `max-out.html` keep the float.
  A compact countdown persists in the top bar when the inline row is off-screen.
- **Bottom nav auto-hides during an active session.**

Removes D4 and D5 by construction. Result measured on a working prototype
applied to the live page: **7 fixed layers → 1**, covered viewport
**55.7% → 5.5%**, content **633px → 798px**. In the captured state the
prototype shows the entire active card plus three upcoming exercises where the
current build shows one readable exercise name.

**Owner decisions, locked 2026-08-22 (measured, not assumed):**

1. **The toolbar rest countdown SWAPS, it does not add.** Two live timers do not
   fit: measured at 390px, elapsed + rest + `Set 1/32` + `End workout` needs
   **464px** against a **390px** bar (`scrollWidth` 452 > `clientWidth` 390).
   The swap variant needs **344px** and fits with 46px spare. So the elapsed
   slot *becomes* the gold rest countdown for the duration of the rest period,
   then reverts. It swaps whenever rest is running — not on scroll position,
   which would mutate the bar under the user's thumb. Tapping it scrolls back
   to the active set. Accepted cost: session-elapsed is not visible during rest.

2. **The per-card rest badges are eliminated.** Rest time is now shown in two
   better places (toolbar chip while resting, inline row in the set list), so
   the `.rest-timer` chip on each card is redundant clutter and an extra
   sub-44px touch target.

   **The badge is load-bearing — this is not a delete.** `mc-setlog.js:510-517`
   auto-starts rest on set check via
   `var t = card.querySelector('.rest-timer'); if (t) { ... TMR.start(t, secs, 'Rest'); }`
   — the chip is both the anchor `TMR.start()` binds to and the carrier of the
   prescribed duration (`data-rest`, from the program data). Remove it naively
   and `t` is null, the guard fails, and **rest silently stops auto-starting on
   set check** with no error. Required order: carry the rest value on the card
   as a data attribute, rewire `TMR.start()` to bind without a visible anchor,
   then update `tools/check-one-timer.js`, which gates on the literal
   `rest-timer idle` class string as its fleet-wide signature. ~30 pages render
   these.

3. **Prescribed rest survives as plain text.** Folded into the card's existing
   meta line ("Rest 90s"), not a tappable badge — so a trainee can still see
   what the rest is meant to be *before* logging the set, which neither the
   toolbar chip nor the inline row can show (both only exist once the countdown
   is already running). Loses the touch target and the visual weight, keeps the
   information.

4. **The inline row stays the primary control.** ±15s lives there. The toolbar
   chip is a glanceable fallback only.

**Blocking trap:** `mc-summary.js:483` is `if(!document.querySelector('.fw-bar'))return;`
— the top bar is gated on the bottom bar. Removing `.fw-bar` naively silently
kills the status bar. `mc-summary.js:244` and `:383` append the Summary button
into the fw-bar and need a new home. Also touches `mc-nav.js:97`,
`mc-cond.js:150`, `mc-superset-hop.js:213`.

### M4 — Floating control consolidation
Owner-directed: **remove** `.mc-theme-toggle-float` (z141 — belongs in
Settings) and `#mcVoiceBtn` (z98). **Consolidate** `.mc-qp-trigger` off the
floating layer. Retires the z1180 and z98 layers entirely.

### M5 — User demos and report
Drive complete workouts headlessly through a trainee's eyes across the engine
families, at iPhone 13 and iPhone SE, and report back what the experience is
now — measured, not asserted.

---

## Decisions locked (owner, 2026-08-22)

1. Bottom nav auto-hides during an active session.
2. Theme-toggle float and voice mic are **removed**; "Short on time?" is
   consolidated rather than deleted.
3. Full z-index contract migration **with** a CI gate.
4. Phased PRs with a gate between each.
5. Cache-bust gets its own phase (M0), ahead of everything else.

## Standing rule for this roadmap

No claim ships in this document without a live reproduction. Two findings were
corrected during discovery by measuring rather than reasoning: D2 was wrongly
cleared after testing the right page in the wrong state, and D7's nav-leak was
wrongly treated as current when it was a stale cache serving already-fixed
code. Both corrections came from driving the browser, not from re-reading source.
