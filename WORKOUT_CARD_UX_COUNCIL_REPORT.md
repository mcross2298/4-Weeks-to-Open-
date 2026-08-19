# Workout Card UX Council Report

**Subject:** the active-workout exercise card (`.ex-card.a-card` + `mc-setlog.js` logger)
**Panel:** Mobile UX/UI + Product, high-density fitness apps (Strong / Hevy / Fitbod class)
**Date:** 2026-08-19
**Status:** analysis + specification. No implementation in this pass.

---

## 0. Method & alignment

Every number in this report was **measured, not estimated** — `mm-p1.html` rendered in
headless Chromium at three real iPhone viewports (DPR 3, touch enabled), with Day 1
expanded and the first card's Log Sets panel open. That is the true active-workout state.

### Owner decisions taken in Phase 1

| Question | Decision |
|---|---|
| Vertical bloat | Rest-timer bar, hero rep number + badge stack, notes/tempo lines |
| Input model | Last-session prefill + tap-to-confirm; keypad only on change |
| Safe to hide | Coaching notes/tempo, RPE column, "Last: 185 lb · Mar 4" history line |
| Keep visible | **Structural pills** (SUPERSET / TRI-SET) — not selected for hiding, treated as protected |
| Target viewport | *Deferred to the panel* — recommendation below |

### Recommendation on target viewport

**Design to 390×844 (iPhone 15/16) as primary; treat 375×667 (SE/mini) as a hard floor.**

Not Pro Max. Two reasons from the measurements:

1. The current card renders at **exactly 595.9 px on all three viewports** — 390, 375, and
   430 wide. The layout has *zero* height adaptation today, so "designing for Pro Max"
   would optimize a canvas the code never treats differently anyway.
2. The failure is worst where the screen is smallest, and 596 px of card on a 667 px SE
   viewport means **one exercise consumes 89% of the screen**. A design that clears the
   SE floor clears every device; the reverse is not true.

Pro Max then spends its extra 88 px on *more visible exercises*, which is the actual goal —
not on more padding.

---

## 1. LLM Council Findings

### 1.1 The headline number

| State | Height | Share of 390×844 viewport | Share of 375×667 (SE) |
|---:|---:|---:|---:|
| Active card (log panel open) | **595.9 px** | **71%** | **89%** |
| Inactive card (panel closed, avg of 10) | **328 px** | 39% | 49% |
| One training day, full scroll | **3,865 px** | **4.6 full swipes** | 5.8 swipes |

One exercise occupies roughly three-quarters of the phone. The athlete cannot see the set
they just finished and the next exercise at the same time — mid-workout, with a pump and a
phone in one hand, that is the entire problem in one statistic.

### 1.2 Where the 596 px actually goes

Measured, child by child, on the active card:

| Element | Height | Verdict |
|---|---:|---|
| `.mcl-wrap` (the set-logging panel) | 312 px | **Earns its space** — this is the work |
| `.a-top` (index + exercise name) | 47 px | Earns its space |
| `.a-timerbar` (full-width rest timer) | 48 px | Flagged by owner |
| `.mc-quick-actions` (Replace/Reorder/Notes) | 30 + 10 margin | **Pure duplication** — see 1.3 |
| `.a-reps` (hero rep figure, e.g. "5×5") | 38 px | Flagged by owner; also redundant — see 1.4 |
| `.mc-meatball` (⋯ menu) | 36 px | Duplicate entry point of the row above |
| `.a-notes` (coaching cue) | 29.9 px | Flagged by owner |
| `.mcl-toggle` ("LOG SETS ⌄") | 16 px | Sub-target; redundant on an active card |
| Card padding / borders / gaps | ~30 px | — |

**Only 359 px of 596 px (60%) is the exercise and its sets.** The other 40% is chrome,
affordances, and restated information.

### 1.3 The strongest single finding: the card carries its own actions twice

`.mc-quick-actions` (Replace · Reorder · Notes) and `.mc-meatball` (⋯) are **the same three
actions, wired to the same handlers**. This is not inference — it is stated in the source:

> `// QUICK ACTIONS (Replace / Reorder / Notes surfaced on the card face)`
> `// Same handlers as the meatball menu's corresponding items — this is a`
> `// second entry point, not new logic.`
> — `mc-card-actions.js:820`

Both are injected over the same card collection, unconditionally, two lines apart:

> `Array.prototype.forEach.call(cards, injectMeatball);`
> `Array.prototype.forEach.call(cards, injectQuickActions);`
> — `mc-card-actions.js:940`

So this is not one page's quirk — it is **every one of the 80 pages that load
`mc-card-actions.js`**. Cost: **76 px per card × 10 cards = 760 px per training day**,
spent on a second door to a room the athlete is already standing in. And both doors fail
the touch-target floor (quick-action pills 30 px tall; meatball 36×36).

### 1.4 The hero rep number restates what the panel below already says

`.a-reps` renders "5×5" at 25 px, 900 weight — and directly beneath it the logger renders
**five numbered rows**. The prescription is stated twice, once decoratively and once
operationally. The panel's version is the one the athlete touches.

The precedent is already in the file: `.a-strip`'s Sets cell was dropped for exactly this
reason, and the CSS comment says so — *"The Sets cell restated the hero reps number
(already shown big/bold above) so it's dropped unconditionally."* The same argument
applies one level up.

### 1.5 Touch targets: the logger passes, everything the page renders fails

Measured against the 44×44 pt floor:

| Control | Size | 44pt |
|---|---:|:--:|
| `.rest-timer` (idle) | 282 × **26** | ❌ |
| `.mcl-toggle` ("LOG SETS") | 330 × **16** | ❌ |
| `.mc-qa-btn` × 3 | 101 × **30** | ❌ |
| `.a-notes` (tap to expand) | 296 × **30** | ❌ |
| `.mc-meatball` | **36 × 36** | ❌ |
| `.mcl-inp` weight / reps | 90 × 44 | ✅ |
| `.mcl-rpe` | 44 × 44 | ✅ |
| `.mcl-ck` set check | 44 × 44 | ✅ |

The pattern is clean and damning: **`mc-setlog.css` respects the floor; nothing else does.**
The logger was built with an explicit a11y comment (*"44px a11y floor for sweaty-finger
taps"*) and it holds the line. Every control outside it drifted below.

The worst case is the **rest timer at 26 px tall** — the single most-tapped control in a
gym session, operated between heavy sets with chalky, sweaty hands, at 59% of the minimum
safe size. This is a correctness bug in the interaction layer, not a styling preference.

### 1.6 The set rows are 30% taller than their own touch targets require

`.mcl-inp` has `min-height:44px` — correct. But `.mcl-row` then adds `padding:6px 2px` plus
a 1 px divider, so the measured row is **57 px**. The 44 pt floor was satisfied and then
padded on top of.

Five sets × 13 px of surplus = **65 px per exercise, purchased with nothing**. Collapsing
the row to the input's own height removes it *without shrinking a single touch target*.

> The owner did **not** flag the logger panel as bloat, and the panel is indeed the one
> part of the card that earns its height. This recommendation is therefore framed
> narrowly: it removes padding *around* the controls, never the controls themselves.

### 1.7 The collapse mechanism the app already ships — fired one state too late

`mc-setlog.css` already implements a complete collapsed card: `.mcl-strip`, a 48 px tappable
summary (dot + name + set count + chevron) that hides every sibling. It works, it is tested,
it is in production.

It fires **only after every set on the card is logged.**

So the app can already render a 48 px exercise card. It just refuses to do so for the nine
exercises the athlete has not started yet — the exact cards that need it most, because
they are pure lookahead and currently cost 328 px each.

### 1.8 One honest conflict to surface

Extending collapse to *not-yet-started* cards reverses a decision the team made
deliberately. `base.css` records it:

> `// Purely a visual cue (every other exercise stays fully expanded, no accordion)`

That was a reasonable call **when it was made**. The panel's view is that the premise has
since changed: a no-accordion layout is comfortable at 150 px per card and untenable at
328 px, and the card grew past that threshold without the decision being revisited. We
flag it rather than quietly overturning it — **Recommendation 4 is the one item on this
list that needs the owner's explicit buy-in before implementation.**

---

## 2. Top 5 UX/UI Recommendations

Ordered by **density gained per unit of effort**. R5 ranks last on that ratio and ships
first anyway — see its note.

### R1 — Delete the quick-actions row
**Effort: trivial · Gain: 40 px/card, 400 px/day · Risk: none**

Remove `injectQuickActions()`. The meatball menu already provides Replace, Reorder, and
Notes through the same handlers. This is deletion of duplicated UI, not removal of
capability — no action becomes unreachable. It also eliminates three sub-44pt targets.

The one real loss is discoverability: face-level pills are more visible than a ⋯ menu. The
mitigation is R5's header, which promotes the *one* action with a state to show (Notes,
as an ⓘ that lights up when a note exists) into the header row, and leaves the rest in the
menu where they belong.

### R2 — Collapse set-row padding; fold column labels into placeholders
**Effort: trivial (2 CSS rules + placeholder strings) · Gain: 78 px/active card · Risk: none**

- `.mcl-row` `padding:6px 2px` → `padding:1px 2px` — row 57 px → 46 px, input untouched at 44.
- Delete `.mcl-hdr` (23 px). Its labels — SET / WEIGHT / REPS — become the inputs' own
  placeholders, which is where a mobile form puts them anyway.

Net: 5-set exercise drops 308 px → 230 px. **No touch target shrinks.**

### R3 — Collapse inactive cards by default
**Effort: medium · Gain: 264 px per inactive card, ~2,376 px/day · Risk: reverses a prior decision**

Extend the existing `.mcl-strip` (§1.7) from "collapse after completion" to "collapse until
active." One exercise is expanded at a time — the one being performed. Tapping any strip
expands it and collapses the previous.

This is the largest density win available and requires **no new component** — the collapsed
presentation already exists and ships today. Requires owner sign-off per §1.8.

### R4 — Consolidate the header; move secondary metadata behind ⓘ
**Effort: medium-high · Gain: 104 px/active card · Risk: touches per-page markup**

Per the owner's Phase 1 selections:

- **One header row** (52 px): index · exercise name · prescription pill (`4×10`) · ⓘ · ⋯.
- `.a-reps` hero figure **removed** — restated by the panel (§1.4); the prescription
  survives as the header pill.
- `.a-notes` **behind the ⓘ**, which fills in when a note or tempo cue exists.
- **RPE column out** of the row grid; long-press a set row to set it. Frees a 44 px column
  horizontally, which is what makes the weight/reps fields bigger, not smaller.
- **"Last: 185 lb · Mar 4" line removed** — that data becomes the prefilled value (R5).

**Structural pills (SUPERSET / TRI-SET / CLUSTER / DROP) stay visible** — the owner did not
select them for hiding, and they carry the station-anchoring grammar the programs are built
on. They sit inline in the header row; the colored left rail continues to carry the same
signal redundantly, which is correct for a glanceable state.

### R5 — Raise every control to the 44 pt floor
**Effort: low · Gain: none — this one *spends* ~12 px · Risk: none**

Ranked last by density, **ship it first regardless.** §1.5 is an accessibility defect, and
a 26 px rest timer is a functional failure in the app's actual use context.

- `.rest-timer` → **52 px** tall on the active card.
- `.mcl-toggle` → 44 px, or removed entirely on the active card (its panel is always open).
- `.mc-meatball` 36 → 44.
- `.a-notes` tap area → folded into the 44 pt ⓘ button (R4).

The height this costs is repaid many times over by R1–R4. And the timer only renders as a
full band on the **active** card — on collapsed cards it is a dormant chip in the strip.
Same pixels, spent only where the athlete is actually resting.

---

## 3. New Design Suggestions & Component Specs

### 3.1 Structural wireframe

**Collapsed / not-yet-started — 64 px** (was 328 px)

```
┌──────────────────────────────────────────────┐
│▌  3   Incline DB Press          4×10     ⌄   │  64pt
└──────────────────────────────────────────────┘
   ▲    ▲                          ▲        ▲
   │    │                          │        └ expand chevron
   │    │                          └ prescription pill
   │    └ exercise name (1 line, ellipsis)
   └ 4px structural rail: accent / violet=superset / amber=tri-set
```

**Completed — 64 px** (existing `.mcl-strip`, unchanged)

```
┌──────────────────────────────────────────────┐
│▌  ✓   Incline DB Press          4/4      ⌄   │  green ground
└──────────────────────────────────────────────┘
```

**Active — 358 px** (was 596 px)

```
┌──────────────────────────────────────────────┐
│▌  3   Incline DB Press      4×10   ⓘ    ⋯   │  52pt  header
├──────────────────────────────────────────────┤
│   1    [  185  ]   [  10  ]            [✓]   │  46pt
│   2    [  185  ]   [  10  ]            [✓]   │  46pt
│   3    [  185  ]   [   8  ]            [ ]   │  46pt  ← next set
│   4    [  185  ]   [   8  ]            [ ]   │  46pt  ← ghosted
├──────────────────────────────────────────────┤
│         ⏱   REST  90s  ·  tap to start       │  52pt
└──────────────────────────────────────────────┘
                                          total 358pt
```

Grid: `36px 1fr 1fr 52px` (was `30px 1fr 1fr 44px 44px` — the RPE column is what pays for
the wider fields and the 52 pt check).

#### Two refinements found by building it

The working prototype (`workout-card-redesign-demo.dc.html`) surfaced a defect in the header
spec above, and the fix is now part of it:

1. **Controls are scoped to the state they apply to.** The first build put index, name,
   prescription, ⓘ, ⋯ *and* a chevron in one row, and "Barbell Bench Press" truncated to
   "Barbell …" at 390 px. Exercise-name legibility outranks every other element on the card,
   so: **ⓘ and ⋯ render only on the active card** (they act on the exercise you are
   performing), and **the chevron only on collapsed cards** (an expanded card's state is
   self-evident, and its header already collapses on tap). That reclaims ~70 px of header
   width and is better behavior on its own terms.
2. **Long names wrap to two lines rather than ellipsize** (`-webkit-line-clamp:2`), with the
   header at `min-height:52px` growing only when a name actually needs it. At a true 390 px
   viewport every name in Day 1 fits on one line and the header measures **54 px**.

Measured on the prototype at 390×844: collapsed card **54 px** (62 px with margin, against
the 64 px budgeted); 5-set active card **359 px**, against the 358 px budgeted. The budget
in §3.2 holds.

### 3.2 Vertical budget

| Element | Now | Proposed | Δ |
|---|---:|---:|---:|
| Quick-actions row | 40 | **0** | −40 |
| Header (index + name) | 47 | 52 | +5 |
| Hero rep figure | 38 | **0** | −38 |
| Meatball (own band) | 36 | **0** | −36 |
| Notes band | 30 | **0** | −30 |
| Log Sets toggle | 16 | **0** | −16 |
| Logger column header | 23 | **0** | −23 |
| Set rows (5) | 285 | 230 | −55 |
| Rest timer | 48 | 52 | +4 |
| Card padding | ~30 | ~24 | −6 |
| **Active card** | **596** | **358** | **−40%** |
| **Inactive card** | **328** | **64** | **−80%** |
| **Full training day** | **3,865** | **~1,519** | **−61%** |

Screen share on 390×844: **71% → 42%.** On the SE floor: **89% → 54%.**
Scroll cost per day: **4.6 swipes → 1.8.**

### 3.3 Input model — prefill + tap-to-confirm

Per the owner's Phase 1 selection. The data already exists in `mc-setlog.js`: `lset(exId, sn)`
reads the previous session's set, and `mc-suggest.js` already computes an equipment-aware
next-load suggestion. Today both are spent on a *placeholder* and a "Last: …" caption.
Promote them to the field's **value**.

**Ghost state — the safeguard this model needs.** A prefilled number that looks identical to
a logged one invites the athlete to confirm last week's weight without reading it. So:

- Prefilled, unconfirmed → **ghosted**: 55% opacity, italic, dashed underline.
- Tap ✓ → value solidifies, row turns green, weight is committed as typed.
- Tap the number → iOS numeric keypad, field solidifies on first keystroke.
- Fields stay at `font-size:16px` — the existing comment in `mc-setlog.css` is right that
  anything smaller triggers iOS Safari's auto-zoom, which is the worst mid-set surprise
  the app can produce. **Do not lower it during the row-tightening in R2.**

Result for the common case (same weight as last session): **one tap per set**, versus
today's tap-field → keypad → type → dismiss → tap-check.

### 3.4 Micro-interactions

**Set commit.** ✓ tapped → haptic (`mc-haptics.js`), row settles green, ghost on the *next*
row brightens to signal focus, rest timer auto-starts. The timer starting on set-commit
rather than on a separate tap removes the single most-missed interaction in gym apps —
the athlete who forgets to start their rest.

**Rest timer, three states in one 52 pt control.**
`⏱ REST 90s · tap to start` → `⏱ 0:47 ▓▓▓▓▓░░░` (running, progress fill) → `⏱ REST DONE +0:12`
(overtime, rose). Already the behavior in `mc-timer.js`; this only gives it a legible size
and one home.

**Card handoff.** Last set of an exercise committed → 600 ms → card collapses to its
completed strip and the next card expands and scrolls into view. The 600 ms delay is
already implemented in `updateCount()`; this extends it to also promote the successor.

**⌄ Swipe-down on the active card** collapses it without logging — for looking ahead
mid-workout, then returning.

**Long-press a set row** → RPE chip cycle (`– → 8 → 8.5 → 9 → 9.5 → 10 → F`), the existing
`RPE_STEPS` ladder, surfaced on demand instead of occupying a permanent column.

**ⓘ** is present only when a note or tempo cue exists, and is tinted when it does. An empty
info button on every card is the band we just removed, wearing a smaller coat.

### 3.5 What this does not change

- Structural pills and the colored left rail — the superset/tri-set grammar is untouched.
- `mc-timer.js` remains the single timer implementation (`tools/check-one-timer.js` gate).
- `makeRestTimer` / `applyReplacements` stay single-implementation
  (`tools/check-single-impl.js` gate).
- The 16 px input font, for the iOS auto-zoom reason above.
- `mc_setlog_v1` storage shape — every change here is presentational.

---

## 4. Implementation sequencing

| Phase | Contents | Files | Owner gate |
|---|---|---|---|
| **P1** | R5 touch targets + R1 quick-actions deletion | `mc-card-actions.js/.css`, `base.css` | none — defect fixes |
| **P2** | R2 row tightening + placeholder labels | `mc-setlog.css`, `mc-setlog.js` | none |
| **P3** | R4 header consolidation, ⓘ drawer, RPE long-press | `base.css`, `mc-setlog.js`, per-page markup | AskUserQuestion |
| **P4** | R3 collapse-by-default | `mc-setlog.js/.css` | **explicit sign-off — reverses §1.8** |

P1 and P2 together deliver **−118 px per active card for two files of low-risk edits**, with
no owner decision required and no structural change. That is the recommended first ship.

Per this repo's planning rule, this report is itself sufficient authorization to proceed to
implementation; the P3/P4 gates above are the mid-project check-ins the rule preserves.

### Verification required before any PR

`tools/check-one-timer.js`, `tools/check-single-impl.js`, `python3 tools/apply-head-contract.py
--check`, and the light-mode contrast ratchet in `verify.yml` all touch the surfaces this
redesign edits. The headless measurement harness used for this report should be re-run
post-change to confirm the budget in §3.2 against the real DOM rather than against intent.
