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
