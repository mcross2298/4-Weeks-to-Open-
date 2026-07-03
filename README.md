# Handoff: Program Landing Page (Onyx)

## Overview
A new "landing" screen for the moment a user taps into a program from the
Programs list — it sits **before** the existing day-by-day workout view
(`cat-*.html` / split pages like `bro-split.html`). It gives every program a
proper hero: name, one-line pitch, week/day/level stats, a 7-day schedule
strip, and two "what's inside" callouts, ending in a sticky "Start Program"
CTA. It continues the "Onyx" visual system already established in
`Dashboard Redesign.dc.html` and `Programs Redesign.dc.html` (dark background,
refined-gold accent, Archivo/Manrope type, glass-card depth).

This should be inserted as a new top section on **every** program/split page
in the app — the 10 programs in `mc-pm-data.js`, plus the individual split
pages they link out to (`bro-split.html`, `cat-hv.html`, `cat-pmc.html`, the
`cat-*` pages generally, etc.) — so the experience is consistent no matter
which program a user opens.

## About the Design Files
The bundled file (`Program Landing.dc.html`) is a **design reference**, built
in this design tool's own HTML component format (streaming templates +
React-in-`<x-import>` device bezel) purely so it could be previewed and
tweaked live. **It is not production code and should not be copied in as-is.**
The task is to **recreate this design inside the existing app's real stack**
— plain HTML + `base.css` + the `mc-*.js` script set already used by
`bro-split.html`, `cat-hv.html`, etc. — following those files' existing
conventions (inline `<style>` blocks per page, `render()`-and-innerHTML
pattern, `--accent`/`--accent-rgb` CSS custom properties, `escapeHtml`
helper, etc.). Do not introduce React or a new build step for this.

`ios-frame.jsx` is only the device bezel used to preview the mock at phone
size — it is not part of the real app and does not need to be ported.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and copy tone below are final
— implement pixel-close, adapting only where the existing codebase's patterns
require a different technical approach (e.g. inline `<style>` + vanilla JS
instead of React).

## Screen: Program Landing Hero

**Purpose:** First thing a user sees after tapping a program card. Orients
them (what is this, how long, how hard) and gets them into the workout in one
tap, without dumping the full week-by-week accordion on them immediately.

**Layout** (mobile, 402px reference width, scrolls vertically):
1. Top bar — back chevron (left, 38×38 rounded-12 glass button) · tier label,
   centered, uppercase, 11px/800/`.16em` tracking, `#8b8b92` · overflow-menu
   dots (right, same glass button style, accent-colored dots)
2. Hero image band — 190px tall, `border-radius:22px`, `margin:14px 18px 0`.
   Placeholder is a diagonal accent-tinted stripe pattern (swap for a real
   program photo); a 44×44 rounded-13 icon badge sits top-left in accent-tinted
   glass; a bottom-to-top dark gradient sits over the image for text safety;
   a one-shot diagonal "sheen" sweep animates across on load (`sheenSlide`,
   6.5–7s ease-in-out, `translateX(-120%)→translateX(320%) skewX(-18deg)`,
   infinite — matches the existing hero-card sheen on the dashboard).
3. Title block, `padding:16px 20px 0` — tier pill (10.5px/800 uppercase,
   accent-tinted background+border+text, `border-radius:20px`, `padding:4px
   11px`) · program name (Archivo 800, 27px, line-height 1.08, `-.02em`
   tracking, `#f6f5f2`) · one-line tagline (Manrope 500, 13.5px, `#a6a6ad`,
   line-height 1.55).
4. Stat strip — 3-column grid, `gap:8px`, `padding:18px 20px 0`. Each cell:
   `rgba(255,255,255,.035)` bg, `1px solid rgba(255,255,255,.07)` border,
   `border-radius:14px`, centered. Big value: Archivo 900, 17px, `#f4f3f1`.
   Label below: 9.5px/700 uppercase `.06em` tracking, `#7d7d84`. Cells:
   Weeks · Days/wk · Level.
5. "This week" schedule strip — section header row (Archivo 800 16px title +
   accent-colored 12px/700 schedule-pattern label, e.g. "5-on 2-off") then 7
   equal flex cells (Mon–Sun), each a square `aspect-ratio:1` `border-radius:
   11px` swatch: accent-tinted (`rgba(accent,.16)` bg / `rgba(accent,.4)`
   border / accent-colored glyph) for training days, dim
   (`rgba(255,255,255,.03)` bg / `rgba(255,255,255,.06)` border / `#4a4a50`
   glyph) for off days. Day-of-week initial below each in 8.5px/700 `#7d7d84`.
6. "What's inside" — section header, then 2 stacked info rows: 30×30
   rounded-9 accent-tinted icon chip + title (Archivo 700 13.5px `#f4f3f1`) +
   body (12px `#8b8b92`, line-height 1.45). Card: `rgba(255,255,255,.03)` bg,
   `1px solid rgba(255,255,255,.06)` border, `border-radius:15px`,
   `padding:13px 14px`.
7. Sticky bottom CTA bar — pinned to bottom, dark-to-transparent gradient
   scrim behind it. Primary button: full-width, `border-radius:16px`,
   `padding:15px`, `linear-gradient(135deg, accentLight, accent)` fill,
   dark (`#14110b`) icon+label text, drop shadow `0 14px 28px -10px
   {accent}77`, label "Start Program" (Archivo 800 15.5px) with a play-icon.
   Secondary text link below, centered, 12px/700 `#8b8b92`: "View full
   {weeks}-week schedule →".

**Background:** page background is `radial-gradient(120% 60% at 50% -10%,
{accent at 16% opacity} 0%, #0a0a0b 46%)` — i.e. the whole screen tints
toward the program's accent color from the top, same technique as the
existing dashboard hero glow.

## Design Tokens
- **Fonts:** Archivo (500/600/700/800/900) for all headings/labels/buttons;
  Manrope (400–800) for body copy. Both already loaded via Google Fonts in
  the Onyx redesigns — reuse the same `<link>`.
- **Base surfaces:** `#0a0a0b` (page bg), `#141314` (card fill under stripes),
  `#f6f5f2` / `#f4f3f1` (primary text), `#a6a6ad` (secondary text), `#8b8b92`
  (tertiary/label text), `#7d7d84` (quietest labels), `#4a4a50` (dim/off
  state).
- **Accent system:** a single per-program accent hex drives everything
  tinted on the page. Derive these from it (accent = program's `color` from
  `mc-pm-data.js`):
  - `accentFaint` = `rgba(accent-rgb, .14)` (chip/icon backgrounds)
  - `accentBorder` = `rgba(accent-rgb, .3)` (chip/hero borders)
  - `accentGlow` = `rgba(accent-rgb, .16)` (page background radial)
  - `accentBadgeBg` = `rgba(accent-rgb, .18)` (hero icon badge bg)
  - `accentLight` = a lightened tint of accent for CTA gradient (~30% toward
    white) — pass explicitly per program, don't compute at runtime
  - `accentSoft` = same as `accentLight`, used for small accent-colored text
    (tier pill text, schedule label, hero caption)
- **Radii:** 22px (hero image), 20px (pills), 16px (CTA button), 15px (info
  rows), 14px (stat cells), 13px (icon badge), 11px (day swatches), 9px (small
  icon chips).
- **Spacing:** screen horizontal padding 18–20px throughout; section vertical
  rhythm ~24–26px between major blocks, ~9–10px between items in a group.

## Per-Program Data Mapping
Source of truth is already in the codebase: `mc-pm-data.js` →
`window.MC_PM_DATA.programs`. Bind directly, no new data model needed:

| field on hero | source |
|---|---|
| `accent` | `program.color` |
| `programName` | `program.name` |
| `tagline` | `program.desc` |
| hero icon badge glyph | `program.icon` (or its existing SVG equivalent, see `Programs Redesign.dc.html` for the per-program line-icon set already drawn for each id) |
| tier pill label | `"Flagship"` for the first 6 ids (`ss, pmc, mc, ks, mm, hv`), `"Influencer"` for the last 4 (`stndr, pump, gainz, psu`) — matches the existing two-tier grouping in `Programs Redesign.dc.html` |
| weeks / days-per-week / schedule label | parse from `program.meta` where it follows the "N-Week … · N Days/Day Split" shape (`ss`, `mm`, `hv`); see fallback below for the others |
| "This week" 7-day strip | mark the first `daysPerWeek` cells as training, rest as off — matches the "5-on 2-off" standard in `CLAUDE.md` for any program built after that rule landed |
| "What's inside" callouts | 2 short lines per program pulled from its actual structure — for the 6 flagship programs, the two truths that are always available are (1) its station-anchoring/pairing style and (2) its progression mechanism; write one sentence each per program (see below) |

### Explicit per-program values

| id | name | color | weeks | days/wk | level | schedule label |
|---|---|---|---|---|---|---|
| `ss` | Strength & Supersets | `#e11d48` | 6 | 5 | Int. | 5-on 2-off |
| `pmc` | Project Muscle Confusion | `#7F77DD` | 2 *(per split)* | — | Adv. | 7 splits, 2 wks each |
| `mc` | Mike Cross' Favorite Splits | `#d4af37` | — | — | Int. | 5 splits |
| `ks` | Everything Under the Kitchen Sink | `#f59e0b` | — | — | Adv. | 6 splits |
| `mm` | The Modality Matrix | `#6366f1` | 15 | 4 | Adv. | 3 phases |
| `hv` | High-Volume Training Template | `#84cc16` | 4 | 5–6 | Int. | 4-week block |
| `stndr` | STNDR | `#1D9E75` | — | — | Int. | 4 programs |
| `pump` | Daily Pump | `#D85A30` | — | — | Beg. | 10 workouts |
| `gainz` | Daily Gainz | `#378ADD` | — | — | Int. | 8 programs |
| `psu` | PSU Football | `#639922` | — | — | Adv. | 3 phases |

Rows with `—` are **collection-level** programs (`pmc`, `mc`, `ks`, `stndr`,
`gainz`, `psu`) — tapping them goes to a menu of splits, not straight into a
week view. For these, show this same hero **once the user picks a specific
split**, using that split's own week/day/schedule numbers (already present on
each split's page, e.g. `bro-split.html`'s `DATA.schedule` string) — don't
try to force a single week/day number onto the collection card itself. If a
hero is wanted on the collection-picker screen too, drop the stat strip and
schedule-preview sections and keep only the title block + "what's inside"
(listing the splits) + a "Browse splits" CTA instead of "Start Program".

### Suggested "what's inside" copy per program
- **Strength & Supersets:** "Heavy compound lifts every session" / "Supersets and AMRAP finishers push volume at the end, not the start."
- **Project Muscle Confusion:** "A new stimulus every 2 weeks" / "Supersets, pyramids, drop sets, tempo and AMRAP rotate through all 7 splits."
- **Mike Cross' Favorite Splits:** "Five personal training styles" / "Pick whichever split matches how you want to train this block."
- **Kitchen Sink:** "Six splits, one station-anchored system" / "Every pairing keeps you at one spot on the floor — no equipment hogging."
- **Modality Matrix:** "Three modalities, three phases" / "Dumbbell, then barbell, then cable — 15 weeks covering every equipment type."
- **High-Volume Template:** "Compound into superset into pyramid" / "Volume escalates week to week; trisets are banned by design."

## Interactions & Behavior
- Tapping the top-left chevron navigates back to the Programs list.
- Tapping the CTA (`Start Program`) opens the program's day/week view at
  Day 1 (i.e. what `bro-split.html` etc. currently render on load).
- Tapping the "View full N-week schedule →" link scrolls/navigates to the
  same day/week view but should land the user on the full accordion rather
  than starting a workout.
- Hero sheen animation runs continuously (decorative, no interaction).
- No loading or error states — all data is static/local, same as the rest of
  the split pages today.

## Assets
No real photography or icons are bundled. The hero image band is a
diagonal-stripe placeholder — replace with an actual program photo per
program (or leave as a styled placeholder if no photography exists yet). All
icons are inline SVG, hand-picked per program to match the set already used
in `Programs Redesign.dc.html`; reuse those paths directly, do not
regenerate.

## Files
- `Program Landing.dc.html` — the full design reference (open directly in a
  browser; accent color / copy / stats are editable via the tweak panel in
  the top-right for quick what-if exploration across programs).
- `ios-frame.jsx` — device bezel used only for previewing the design; not
  needed in the real app.
