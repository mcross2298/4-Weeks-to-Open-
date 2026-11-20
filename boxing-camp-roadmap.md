# 12-Week Boxing Training Camp — roadmap entry

Opened 2026-11-20. Scratch-listed (`content-manifest.json`), so it never ships
to the public Rolodex build. Per CLAUDE.md's Planning rule, this entry is the
plan that authorizes the implementation; it is one phase, so there is no
mid-project check-in.

## Objective

A 12-week, 3-phase boxing camp in the Conditioning Corner. The screen stays
low-clutter: punch combinations are short chips like `1+2` with a small
subtitle, not sentences. The heavy-bag round in progress shows its own
combinations, so the fighter never scrolls to find them.

## What exists already (inspected before writing code)

- The Conditioning Corner is `dashboard.html?tab=conditioning`, rendered by
  `renderConditioning()` from `conditioning-data.js`'s `CONDITIONING.subcategories`.
  A new `type:'routines'` subcategory renders with no dashboard change.
- `boxing-routine.html` is a single-session boxing page. Its engine is an
  in-page `BOX` object with `Countdown`/`CountUp` classes and a `.pstep` card
  timeline, styled by `conditioning-elite.css` under `body.cond-elite`. The
  page is locked to the dark theme.
- `mc-cond.js` adds the PB pill and the Log-result bar to any page whose
  filename matches a routine `href`. The camp gets both for free.
- `mc-interval.js` (the guided timer) needs a flat `protocol`. The camp has
  three phases and its own in-page runner, so it declares no protocol.

## Scope

1. **`boxing-camp-data.js` (`window.MC_BOXING_CAMP`).** Holds the punch
   legend, a combo dictionary (each combo and its name), and three phases.
   Each phase has its round counts, drills, heavy-bag rounds and finishers.
   A heavy-bag round lists only what it adds (`add`) or names the round it
   repeats (`same`). "Carried over" is derived from earlier rounds, so the
   cumulative lists cannot drift from the additions.
2. **`boxing-camp.html` + `boxing-camp.js` (engine) + `boxing-camp.css`.**
   - Phase switcher: Weeks 1–4 / 5–8 / 9–12. It remembers the last phase
     (`mc_boxing_camp_v1`, device-local) and accepts a `?phase=N` deep link.
   - A compact strip of what changes by phase: rope and bag rounds, the 3:00 /
     0:30 timer, and the finisher targets.
   - A collapsible punch legend.
   - A combo board with round pills and an All / New-only toggle. New combos
     have a NEW mark; carried combos are muted.
   - A session timeline. Every round drill runs 3:00 work / 0:30 rest; Jump
     Rope and Heavy Bag scale with the phase. The heavy-bag card shows a live
     panel of the current round's combos, which follows the round as it runs.
     Finishers use count-up clocks with rep and distance logging.
   - A screen wake lock is held while any timer runs.
3. **Wiring.** A new "Fight Camp" subcategory in `conditioning-data.js`, the
   `store-registry.json` entry, the `sw.js` regeneration, and the head contract.
4. **Gate.** `tools/test-boxing-camp-data.js` checks the data against the
   brief, wired into `verify.yml`.
5. **Docs.** The Quick Tour Conditioning step mentions the camp.

## Out of scope

- Restoring a timer after a page reload. `boxing-routine.html` doesn't do it
  either, and the in-page runner would need snapshot state.
- Tracking which camp week the athlete is on. The athlete picks the phase.
