# Handoff: Dashboard Redesign — "Onyx" (direction 1a)

## Overview
A premium restyle + light restructure of the **Dashboard (home) screen** in
`dashboard.html` of the `4-Weeks-to-Open-` app. Same content and data, elevated
identity: layered near-black surfaces, a refined softer gold accent used
sparingly, glass depth, refined typography, and **line icons instead of emoji**.

The redesign is built around three usability goals the owner asked for:
1. **One-tap to the right workout** — the hero becomes a bold "Resume workout"
   card (program + week/day + progress ring + primary button).
2. **Browse/pick a program fast** — a new horizontal **Programs rail** on the
   dashboard, sourced from the same flagship programs already in the app.
3. **Cleaner hierarchy & nav** — fewer competing sections, a refined 5-tab bar.

> Scope: this handoff covers the **`#scr-dashboard` screen only**. The Programs
> screen, program pages, nutrition, etc. keep their current markup — but the new
> design tokens (fonts + refined gold) can be rolled out app-wide later.

## About the design files
The files in this bundle are **design references created in HTML** — a streaming
"Design Component" prototype (`Dashboard Redesign.dc.html`) showing the intended
look and behavior. **Do not copy the `.dc.html` / `ios-frame.jsx` files into the
app.** They use a prototyping runtime and an iPhone bezel that don't belong in
production.

Your task is to **recreate the Onyx dashboard in the app's existing environment**:
plain HTML + the inline `<style>` block in `dashboard.html` and/or `base.css`,
using the app's established class names, element ids, and JS hooks. Everything you
need (exact values + paste-ready CSS + markup snippets) is in this README and the
two companion files:
- `onyx-tokens-and-styles.css` — paste-ready CSS (design tokens + component styles)
- `markup-snippets.md` — the hero, programs rail, tools, and tab-bar markup with
  the inline SVG line icons

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, shadows, and motion
are specified exactly below. Recreate pixel-for-pixel, then verify against the
prototype screenshots (ask the designer to include them if not attached).

---

## ⚠️ Codebase conventions to respect (from the app's `CLAUDE.md`)
- **Invoke the `executive-summary` skill and get explicit approval before editing
  files** — this is a UI change to an existing page, which that rule covers.
- Work only in the **`4-Weeks-to-Open-` master repo**; open a feature branch → draft
  PR → merge to `main`. **Never push to `MC-Training-Rolodex`** (auto-deploy target).
- `dashboard.html` links `base.css?v=65`. If you put styles in `base.css`, **bump
  the `?v=` query** on every page that links it so the PWA cache serves fresh CSS.
- Preserve every existing element **id**, **`onclick=`**, and script hook — the
  dashboard is heavily JS-driven (hero, streak, tabs, calendar, macros). This is a
  **presentation-layer** change; do not alter JS behavior.

---

## Screen: Dashboard (`#scr-dashboard`)

### Layout (top → bottom)
Single scrolling column, 20px horizontal padding, on the Onyx background.
Fixed bottom tab bar (existing `.tab-bar`). Section order:

1. **Header row** — monogram + greeting/date (left), search pill (right)
2. **Streak strip** (existing `.momentum-strip`, restyled) — flame + streak + DAY badge
3. **Hero — "Continue where you left off"** (existing `.hero-card`, restyled) —
   active program, week/day, progress ring, muscle pills, **Resume workout** button
4. **Programs** section — header ("Browse all") + **horizontal rail** (NEW)
5. **Training tools** — 2×2 grid (existing `.tools-grid`, restyled, emoji → SVG)
6. **Bottom tab bar** (existing `.tab-bar`, restyled, emoji → SVG)

### Component specs

**Background** — apply to `#scr-dashboard` (or `body` on the dashboard):
`radial-gradient(120% 60% at 50% -10%, #171612 0%, #0a0a0b 46%)`.

**Header monogram (`.avatar`)** — 44×44, `border-radius:14px`,
`background:linear-gradient(140deg,#e6c579,#b8934a)`, text `#1a1409`, Archivo 900
15px, shadow `0 6px 18px -6px rgba(216,180,99,.55)`.
- Greeting (`.topbar-title`): Archivo 700, 18px, `#f4f3f1`, `-0.01em`.
- Date (`.topbar-sub`): Manrope 600, 12px, `#7d7d84`.
- **Search pill** (right, replaces the 🔐/📅 cluster visually — keep those handlers):
  40×40, `border-radius:12px`, `background:rgba(255,255,255,.05)`, border
  `1px solid rgba(255,255,255,.08)`, magnifier SVG stroke `#c9c9cf`.

**Streak strip (`.momentum-strip`)** — keep ids `#msStreak`, `#msSub`, `#msBadge`.
- Container: margin `16px 20px 20px`, padding `10px 14px`, `border-radius:14px`,
  `background:linear-gradient(120deg,rgba(216,180,99,.12),rgba(216,180,99,.02))`,
  border `1px solid rgba(216,180,99,.2)`.
- Flame: line/filled SVG, fill `#e6c579` (drop the 🔥 emoji).
- `#msStreak`: Archivo 700, 13.5px, `#f4f3f1`. `#msSub`: 11px 600, `#8b8b92`.
- `#msBadge`: 11px 800, `#e6c579`, bg `rgba(216,180,99,.14)`, border
  `1px solid rgba(216,180,99,.28)`, `border-radius:9px`, padding `5px 10px`.

**Hero (`.hero-card`)** — the star. Keep `onclick="openActiveProgram()"` and ids
`#heroName`, `#heroDesc`, `#heroDay`, `#heroPhases`.
- Eyebrow above card: Archivo 700, 11px, `letter-spacing:.18em`, uppercase,
  `#8b8b92` — text "Continue where you left off".
- Card: `border-radius:24px; overflow:hidden;`
  `background:linear-gradient(158deg,#1c1a16 0%,#0e0e10 68%)`,
  border `1px solid rgba(216,180,99,.24)`,
  shadow `0 24px 50px -24px rgba(0,0,0,.85)`.
- Glow overlay: `radial-gradient(90% 70% at 15% 0%, rgba(216,180,99,.12), transparent 60%)`.
- Sheen overlay: a 70px vertical band `linear-gradient(90deg,rgba(255,255,255,.14),transparent)`
  animated `sheenSlide 6.5s ease-in-out infinite` (keyframe in the CSS file).
- Inner padding `20px 20px 18px`.
- "Active Program" chip: 10.5px 800, uppercase, `.1em`, `#e6c579`, bg
  `rgba(216,180,99,.12)`, border `1px solid rgba(216,180,99,.3)`, pill.
- Program name (`#heroName`): Archivo 800, 23px, `line-height:1.12`, `-0.02em`, `#f6f5f2`.
- Meta (`#heroDesc` → repurpose to "Week 2 · Day 3 · Push"): 13px 600, `#a6a6ad`.
- **Progress ring** (56–60px): SVG, track `rgba(255,255,255,.08)` width 5, progress
  stroke `#e6c579` width 5 round-cap; center shows `#heroDay`-driven % (Archivo 900
  16px `#e6c579`) + "CYCLE" label 8.5px `#7d7d84`. (Compute stroke-dashoffset from
  cycle %; r=26 → circumference ≈163.)
- Muscle pills (`#heroPhases`): first/active pill filled `#e6c579` text `#0f0e0c`;
  rest `rgba(255,255,255,.05)` bg, `1px solid rgba(255,255,255,.1)` border, text
  `#a6a6ad`. 11px 700, pill, padding `5px 12px`.
- **Resume button** (repurpose `.hero-tap` → make it the primary CTA; drop the
  green `.hero-tap.resume` treatment): full-width, padding 14px, `border-radius:15px`,
  `background:linear-gradient(135deg,#e9cb7d,#c79c4f)`, shadow
  `0 12px 26px -10px rgba(216,180,99,.65)`; play-triangle SVG `#1a1409` +
  "Resume workout" Archivo 800 15.5px `#1a1409`. Active: `transform:scale(.985)`.

**Programs rail (NEW)** — insert between the hero and Training tools on the
dashboard. Source the cards from the flagship programs already defined in
`mc-pm-data.js` / rendered in `#flagGrid` (Strength & Supersets, Project Muscle
Confusion, Mike's Favorite Splits, …). Each rail card links to its `cat-*.html`.
- Section header: title "Programs" Archivo 800 19px `#f4f3f1`; right link "Browse
  all" 13px 700 `#e6c579` → `switchTab('programs')`.
- Rail: `display:flex; gap:12px; overflow-x:auto;` hide scrollbar; padding
  `2px 20px 4px`.
- Card: `flex:0 0 156px; border-radius:18px; padding:15px;` tinted gradient of the
  program's accent over the dark surface,
  `background:linear-gradient(160deg, rgba(ACCENT,.16), rgba(20,20,22,.4))`,
  border `1px solid rgba(ACCENT,.28)`, `border-top:2.5px solid ACCENT`.
  Active `transform:scale(.98)`.
- Card icon chip: 34×34, `border-radius:10px`, bg `rgba(ACCENT,.16)`, line-icon SVG
  in accent tint.
- Card title: Archivo 800 15px `#f4f3f1` line-height 1.2. Meta: 11.5px `#8b8b92`.
- Accent map: Strength & Supersets `#c9505a`; Project Muscle Confusion `#8b7ff0`;
  Mike's Favorite Splits `#d8b463`; Kitchen Sink `#e0a03c`; Modality Matrix
  `#6f77e0`; High-Volume `#9fbf4a`. (These are refined versions of the existing
  `.cat-card.*` accents — see markup-snippets.md.)

**Training tools (`.tools-grid` / `.tool-card`)** — keep the existing `<a href>`
targets (`exercise-library.html`, `build-workout.html`, etc.).
- Card: `border-radius:16px; padding:14px;` bg `rgba(255,255,255,.035)`, border
  `1px solid rgba(255,255,255,.07)`. Active `scale(.98)`.
- Icon chip: 30×30, `border-radius:9px`; the gold "featured" tool uses bg
  `rgba(216,180,99,.1)` + border `rgba(216,180,99,.2)` and gold SVG; others use
  `rgba(255,255,255,.05)` + `rgba(255,255,255,.08)` and `#c9c9cf` SVG.
- Name: Archivo 700 13.5px `#f4f3f1`. Sub: 11px `#7d7d84`.
- Replace emoji (📚🔧📊🍎) with line-icon SVGs (in markup-snippets.md).

**Tab bar (`.tab-bar` / `.tab` / `.tab-icon`)** — keep `onclick="switchTab(...)"`.
- Bar: `background:rgba(10,10,11,.82)`, `backdrop-filter:blur(20px)`, top border
  `1px solid rgba(255,255,255,.07)`, padding `10px 8px 30px` (+ safe-area inset).
- Replace emoji tab icons with 21px line-icon SVGs. Active tab: stroke + label
  `#e6c579`; inactive: `#6b6b72`. Labels 9.5px 700.

---

## Interactions & behavior
- **Resume workout** → existing `openActiveProgram()` (opens the active program's
  current day). Keep the whole hero tappable too.
- **Programs → Browse all** and **rail cards** → navigate to `cat-*.html` /
  `switchTab('programs')`. No new JS logic — reuse existing routing.
- **Tap feedback**: every card/button scales to `.98`–`.985` on `:active`
  (`transition: transform .12s ease`).
- **Hero sheen**: CSS-only `sheenSlide` keyframe, 6.5s loop; wrap in
  `@media (prefers-reduced-motion: reduce){ animation:none }`.
- **Progress ring**: driven by the same value that currently fills `#heroDay` /
  cycle position — set `stroke-dashoffset` from the cycle %.

## State management
No new state. All dynamic values already exist and are populated by the app's
scripts: active program + day (hero JS), streak (`#msStreak`/`#msSub`/`#msBadge`
via the momentum-strip logic), program list (`mc-pm-data.js`). The rail should
render from the same program data used for `#flagGrid` (ideally generated by the
same code path so it stays in sync).

## Design tokens
Colors
- Background: `#0a0a0b`; dashboard radial `#171612 → #0a0a0b`
- Surface: `rgba(255,255,255,.035)`; surface border `rgba(255,255,255,.07)`
- Hero surface: `linear-gradient(158deg,#1c1a16,#0e0e10)`; hero border `rgba(216,180,99,.24)`
- **Refined gold (primary accent):** `#e6c579`; gradient `#e9cb7d → #c79c4f`; deep `#b8934a`
- Gold tints: `rgba(216,180,99,.12)` bg, `.28`/`.3` borders
- Text: primary `#f4f3f1` / `#f6f5f2`; muted `#a6a6ad`; muted-2 `#8b8b92`; faint `#7d7d84` / `#6b6b72`
- Program accents: `#c9505a`, `#8b7ff0`, `#d8b463`, `#e0a03c`, `#6f77e0`, `#9fbf4a`

> Migration note: the app currently uses `--gold:#d4af37`. Onyx uses a softer
> `#e6c579`. Recommended: retune `--gold` to `#e6c579` app-wide for a cohesive
> lift (it flows through every screen's gold accents), OR scope new tokens to the
> dashboard if you want to stage the rollout.

Typography — **add Google Fonts** (currently the app uses `'Segoe UI'`):
- Display: **Archivo** — 700 / 800 / 900 (headlines, names, buttons, section titles)
- UI/body: **Manrope** — 400 / 600 / 700 (labels, meta, sub-text)
- Scale: greeting 18/700 · section title 19/800 · hero name 23/800 (`-0.02em`) ·
  meta 13/600 · eyebrow 11 (`.18em`, uppercase) · tool name 13.5/700 · tab label 9.5/700

Radius: rail card 18 · card 16 · hero 24 · icon chip 9–14 · pill/999 · button 15
Shadows: hero `0 24px 50px -24px rgba(0,0,0,.85)` · button `0 12px 26px -10px rgba(216,180,99,.65)` · monogram `0 6px 18px -6px rgba(216,180,99,.55)`
Motion: `sheenSlide` 6.5s ease-in-out infinite; `:active` scale .98–.985

## Assets
No image assets. All iconography is **inline SVG line icons** (provided in
`markup-snippets.md`) — search, flame, dumbbell, bolt, chart, apple, book, wrench,
home, calendar, play. Fonts load from Google Fonts (Archivo + Manrope). If the PWA
must work fully offline, self-host the two font families and reference them via
`@font-face` instead of the Google CDN link.

## Files in this bundle
- `README.md` — this document (self-sufficient spec)
- `onyx-tokens-and-styles.css` — paste-ready CSS: tokens + component styles + keyframes
- `markup-snippets.md` — hero, programs rail, tools, tab-bar HTML with inline SVGs
- `reference/onyx-dashboard.png` — **dashboard** in Onyx (header, streak, Resume
  hero, programs rail, tools, tab bar) — the target of this handoff
- `Dashboard Redesign.dc.html` + `ios-frame.jsx` — the HTML prototype these PNGs
  were rendered from. **Visual reference only — not for production use.**

> Match the PNGs pixel-for-pixel. The gold shown is the retuned `#e6c579`; note how
> sparingly it appears (chips, active pill, set numbers, one primary button per
> screen) — keep that restraint when applying it app-wide.

## Files in the app to edit
- `dashboard.html` — inline `<style>` block + the `#scr-dashboard` markup (header,
  momentum strip, hero, **new programs rail**, tools grid); tab-bar icons.
- `base.css` — if you prefer shared styles here (bump `?v=` on all pages that link it).
- Font `<link>` in `<head>` of `dashboard.html` (and other pages if rolling out).
