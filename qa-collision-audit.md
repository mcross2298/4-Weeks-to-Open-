# QA collision audit — tap intent and dialog layering

Opened and shipped 2026-10-28 against `main @ 354ad25`. Scratch-listed in
`content-manifest.json`, so it never ships to the public Rolodex build.

## Objective

Drive the workout pages headlessly and look for two kinds of collision that
the existing gates miss:

- **One tap, two intents.** A tap on a control fires its own action and also
  fires a handler on the element around it.
- **Layering.** A dialog sits under fixed chrome, or runs past the screen
  edge with no way to scroll to its content.

## Scope and method

All 79 pages that load the set logger, at 390×844 and 320×568, in headless
Chromium with touch emulation. For the tap pass, every in-card control was
tapped (the Log Sets strip, ⋯, ⓘ, the weight input, the rest chip, rest
±15s). The probe then read the enclosing card's `.checked` class and whether
the superset hop bar had opened. For the layering pass, each dialog was
opened in a real state (nav up, hop bar up, small screen), and every control
inside it was hit-tested with `elementFromPoint`, which is what a finger
lands on.

## Findings (all fixed here)

| # | Defect | Reach | Root cause |
|---|---|---|---|
| 1 | Tapping the rest chip, ⓘ or the Log Sets strip also marked the exercise done (struck through and dimmed, counted by the summary). A second tap on the chip un-did it. | **51 of 79** logging pages | About 30 card/row "tap to check off" handlers each kept their own ignore list. The lists were older than the set logger and its button controls. |
| 2 | On the STNDR pages, ticking every set never marked the exercise done. | 5 pages | `stndr-checkoff.js`'s `decorate()` runs on every DOM mutation and overwrote the logger's own `.checked` with its own tap record. |
| 3 | Before the first tick, the bottom nav still shows. **End workout** then opens the recap under the nav, so Cancel / Log workout can't be tapped and a tap opens a nav tab instead. | every page with the nav | The scale put `--z-modal` at 110, under `--z-nav` at 140. That assumed the nav is always hidden while a dialog is up, and that is not true. |
| 4 | End workout during a superset hop: the "Next up" bar covered the recap's buttons. Its Skip button sat where Log workout should be. | superset pages | `.sshop-buffer` used a literal `z-index:1000`, off the documented scale. |
| 5 | Session Complete is 816px tall. At 320×568 its top 264px, including the title, was off-screen and could not be scrolled to. On iPhone the home bar also sat on its bottom edge. | small phones; every dialog on the `.fw-modal` shell | When a flex-end item overflows its container, it spills off the *start* edge. The sheet had no `max-height`/`overflow`, and the overlay ignored both safe-area insets. |
| 6 | The End workout recap said "0 sets" after real sets were logged, then emphasised **Exit & discard** because of it. | every page | `mc-summary.js` counted only the prescribed sets of fully finished exercises. `mc-finish.js` already had the correct tick count. |

## What changed

- `mc-setlog.js` publishes **`window.MC_CARD_TAP_IGNORE`**, the one list of
  tap targets that must never also check a card off. Every tap-to-check
  handler reads it at click time and keeps a generic fallback: the engines
  (`mc-engine`, `mc-pmc-engine`, `mc-freq-engine`, `mc-group-split`), the
  inline handlers on 23 pages, `stndr-checkoff.js` and the superset hop's
  fallback gesture. The superset handlers called `stopPropagation()` before
  their old guard, and now return before it, so a control inside a superset
  member is no longer swallowed either.
- **Owner decision (2026-10-28): a card with the set logger is completed by
  its sets only.** The "tap the exercise name to check it off" gesture is
  removed there. `mc-setlog.js`'s `buildStrip()` marks every card it attaches
  to `.mcl-host` (on the strip pass, so lazily built cards are covered), and
  `MC_CARD_TAP_IGNORE` names that class, so every handler above ignores any
  tap on such a card. `pmc-s7-giant.html`'s inline `toggleCheck()` checks the
  class directly. The gesture survives only on pages with no logger.
- `stndr-checkoff.js` reads a logger card's completion from its sets alone, so
  a mark saved by the old gesture cannot leave a card stuck as done.
- `base.css`: `--z-modal` 110 → **175**. That is above the nav (140/141),
  `mc-timer.js`'s video view (150), rest-over wash and bar (159/160), and
  `mc-guided.js`'s exit pill (170). It stays below the app's own sheets
  (1200–1400), so a confirm can still open from inside a dialog. The scale
  comment is reordered to match.
- `mc-superset-hop.js`: the buffer is on the scale at `--z-timer-float`.
- `base.css`: `.fw-modal` scrolls inside itself (`max-height:100%`), and
  `.fw-modal-overlay` pads for both safe-area insets.
- `mc-finish.js` exposes `_FW.checkedSets()`, and the recap uses it. The two
  "log or discard?" dialogs can no longer disagree.
- **`tools/check-tap-intent.js`**, wired into `verify.yml`'s smoke step and the
  minified-tree loop. It drives one page per handler family plus the three
  layering scenarios and the recap count. It runs 17 checks, including name taps. **12 of the original 16 fail
  on the pre-fix tree; all 17 pass after.**

## Verified

All fast gates and these browser gates pass: `test-mc-session-durability` (70),
`fa-repro` (23), `fa-engines` (14), `test-mc-exercise-identity` (61),
`test-mc-pr-scope`, concurrency, store resilience, crash recovery, crash
journal, smoke (38 pages), and `measure-session --check` on all three probe
pages. `check-journey.js` reports two `back link` CHROME-CONTROL failures.
They reproduce identically on untouched `main` in an agent sandbox, which is
the text-width/font constraint recorded in CLAUDE.md. `check-visual-ratchet.js`
was not run here (`pngjs` is not installed in this sandbox). This change does
not alter any page at rest, which is what that ratchet measures.

## Overlap with T4 (PR #385)

A parallel session fixed three of these defects (F4/F5 hop bar and nav vs the
dialog, and the superset row tap) as `flagship-readiness-roadmap.md`'s T4,
which merged to `main` first. The two were merged keeping both behaviours:

- **`--z-modal` 175**, not T4's 145, so the dialog also covers the rest Video
  view (150) and rest-over bar (160); the scale's own reason for sitting above
  the timer is that a finished-workout dialog must win over a countdown.
- **T4's dialog layout** (the overlay scrolls, the card sits on
  `margin-top:auto`) replaces this audit's inner-scroll version, plus this
  audit's top safe-area inset. `check-tap-intent.js`'s Session Complete check
  now asserts the card's top is on screen and its end is reachable by scrolling,
  which holds for either layout.
- **Superset rows** keep T4's open-on-tap gesture: `mc-group-split.js` checks
  its controls first, then opens a logger row, and only then reads
  `MC_CARD_TAP_IGNORE`.
- Both gates run in CI: T4's `test-mc-overlay-stack.js` (18/18) and
  `check-tap-intent.js` (17/17) on the merged tree.

## Not changed, deliberately

- The live summary's "Sets Done" (not the recap) still counts finished
  exercises. It is a progress readout by design.
- `.tf` in the frequency pages' inline CSS (z-index 200) styles an element
  nothing renders. It is dead CSS, not a live layer.
- Not verified on a real iOS device: safe-area insets resolve to 0
  headlessly, so the inset padding is a source change checked by reading.

## Continuous QA (opened 2026-10-28)

The owner asked for QA that keeps running against the live app, in two layers.
Decisions, taken with `AskUserQuestion`: both layers, against the **live
site**, the agent may open **draft PRs and a report**, **nightly scripts and a
weekly agent**, with a push notification only when something is found.

| Layer | Where | When | Does |
|---|---|---|---|
| **Nightly scripts** | `.github/workflows/live-qa.yml`, GitHub runner | 03:17 ET nightly + on demand | Runs the browser gates against `https://mcross2298.github.io/4-Weeks-to-Open-/`. On a failure it opens one `live-qa` issue (or comments on the open one), naming each failing gate and linking the run. Never changes code. |
| **Weekly agent** | Claude scheduled task "Weekly live QA" | Wednesdays 20:23 ET, fresh session | Reads open `live-qa` issues first, then explores the app in headless Chromium. Fixes confirmed defects in draft PRs with a regression check, publishes a findings report, and never merges. |

**Why live and not the tree.** The deploy serves minified JavaScript (T2.3)
and a real service worker that only activates on the production origin. A
defect in either can only be seen on the deployed site.

**Phases.** (1) The workflow and the scheduled task. (2) The first manual run
of the workflow after merge settles which gates hold on the live origin. A gate
that fails there for an environmental reason is fixed in the gate, never
dropped from the list.

**Known constraint.** This repository's cloud environment denies
`mcross2298.github.io`, so the weekly agent cannot reach the live site until
the owner adds that host to the environment's allowed domains. Until then it
tests a local checkout of `main`, says so at the top of its report, and leaves
live-only checks to the nightly workflow.

## Cycle 2 (opened 2026-10-31): the three queued checks

The owner asked for the three follow-up checks queued after cycle 1. Same
method as cycle 1: drive the app headlessly at 390×844 and 320×568 with
touch emulation, and count a defect only when it reproduces and its cause is
named in the code. Fixes ship in one PR with regression checks added to
`tools/check-tap-intent.js` (or a sibling gate).

| Check | Scope | What is measured |
|---|---|---|
| A. Non-workout pages | Home (all tabs), Stats, History, workout detail, Workout Settings, exercise library, builder, collections, Max Out, Wrapped, program guide; the account, Report-a-problem, macros and calendar sheets | every control of every open sheet is what a finger hits; no sideways overflow; nothing hidden under the nav at the end of the page; console errors |
| B. Light theme | the same pages plus the session surfaces, with `mc_theme_mode = 'light'` | contrast of text inside OPEN dialogs and fixed bars (the contrast ratchet only measures pages at rest); dark-only literals on light surfaces |
| C. Rapid repeated taps | set check, rest chip, End workout, Log workout, + Set, Skip, Finish | one finished workout per Log tap burst, one set per check burst, one sheet per open burst, one rest timer per chip burst |

### Results

**A. Non-workout pages — no defects found.** 14 page views at 390 and 320:
no sideways overflow, nothing left under the nav at the end of a page, no
console errors. 15 sheets opened (12 from the sweep, plus the builder tray,
the account sheet and Diagnostics): every control was what a finger hits,
and the tall ones scroll and pad for both safe-area insets. Four apparent
failures were the probe's own mistakes, not the app's, and are not counted:
a ⋯ tapped while it sat under the nav, a builder tray measured while closed,
a storage error from a test script running inside a sandboxed iframe, and
an empty result list read as "no sheets".

**B. Light theme — six dialog defects, fixed.** Measured with an in-page
WCAG check that composites ancestor backgrounds and scores a gradient by its
worst stop.

| Where | Before | After | Cause |
|---|---|---|---|
| Session Complete title | 1.12:1 (white on cream) | 15.5:1 | `mc-finish.js` injects dark-card literals; `base.css` turns the card cream in light theme. Every element in it now has a light rule. |
| Session Complete: Save card, refuel line, labels | 1.05–4.26:1 | 4.84–12.2:1 | same |
| Body map outline (Session Complete, Stats, readiness brief) | invisible | visible | neutral shapes fill `rgba(255,255,255,0.06)`; now marked `.is-neutral` and re-inked by one `base.css` light rule. The canvas export keeps the dark ink, since a standalone SVG carries no page CSS. |
| Done / Begin (`.fw-confirm` on the accent) | 3.98:1 | 5.27:1 | black on the light accent `#826919`, measured the same on all 79 pages that load the finish sheet; white text in light theme |
| Readiness brief warning, deload line | 2.48:1 | passes | dark-ground red and cyan |
| Report sheet text, Send report | 3.10 / 3.52:1 | passes | the dashboard's light `--muted` was `--ink-7`, one step LIGHTER than `base.css`'s `--ink-6`, which costs contrast on cream; now `--ink-6` |

Also lifted to `--ink-6` (`#6b6459`) in light theme: the bottom nav labels,
the dashboard tab bar, and the session toolbar's `0/31` counter (all
3.36:1). These were already counted by the at-rest contrast ratchet, so
they were known rather than new. The dashboard's active tab went from
`#a9762f` (3.53:1) to the shared light accent `#826919`. The substitute
sheet's Bodyweight chip went from 4.19:1 to passing.

**Left as is:** the account sheet stays dark in light theme (a hardcoded
dark card). That is a design choice, not a contrast failure; its one low
line (`.acct-note`, 4.06:1) now passes.

**C. Rapid repeated taps — five ghost taps and a stray rest, fixed.** A
second tap 120ms after the first, at the same spot, landed on whatever the
first tap had just put under the finger:

| Double-tap | What the second tap hit |
|---|---|
| Log workout | Session Complete's Done, which closed the card before it was read |
| the last set's check | the auto-opened recap's backdrop, which closed the recap |
| ⋯ | Replace exercise, which left the page |
| Skip | the next exercise's first set check: a phantom logged set (0/31 became 1/26) |
| + Set | a different control in the shifted row |

In every case one workout was saved per Log burst; the damage was to what
the athlete saw and, for Skip, to the log itself. `mc-sheet.js` (loaded by
`mc-nav.js` on every page) now swallows a second tap that lands on a
DIFFERENT control within 450ms and 24px of the first. A genuine double tap
on the SAME control (a set check ticked then unticked) is untouched. It
applies to touch and pen only: the first version also caught mouse clicks,
and CI's minified-build job failed both swap journeys (`SWAP-UNDO`, `R-09`),
where a scripted mouse picks a substitute within 450ms of opening the sheet.
A fast mouse user is choosing, not double-tapping.

Separately, ticking a set and unticking it at once left the rest timer the
tick had auto-started running. `mc-setlog.js` now stops that rest on the
untick, but only if it is still the same rest (same row, same start time),
so a rest the athlete started by hand is never cancelled.

### Regression checks

`tools/check-tap-intent.js` grew 17 → 28 checks: GHOST (double-tap ⋯, Skip
and Log workout; tick then untick stops the rest) and LIGHT (six Session
Complete elements measured in light theme). 10 of the 11 new checks fail on
the pre-fix tree; the eleventh only asserts the title was found.
