# Handoff: Conditioning Corner Redesign — "Onyx" (continuing direction 1a)

## Overview
Restyle of the **Conditioning tab** (`switchTab('conditioning')` → the screen
rendered into `#condBody` by `renderConditioning()` in `dashboard.html`, driven
by `conditioning-data.js`). Same data and sub-tab structure (🔥 Workouts /
🏃 Exercises) — restyled to the **Onyx** system already shipped on the
Dashboard and Programs screens: dark layered surfaces, refined gold chrome,
Archivo/Manrope type, line icons. The category's signature red
(`#E24B4A`) is kept as the intensity accent — everything else moves onto Onyx
tokens.

> Scope: this handoff covers the **Workouts sub-tab** (sub-category header +
> routine cards for "Not for the Faint of Heart") and the **toggle control**
> itself. The Exercises sub-tab reuses the shared exercise-library search UI
> (`MCSubs.libGroupsHTML`) — only its container chrome needs Onyx tokens, no
> new layout.

## About the design files
The files in this bundle are **design references created in HTML** — a
streaming prototype (`Conditioning Redesign.dc.html`) rendered in an iPhone
bezel. **Do not copy the `.dc.html` / `ios-frame.jsx` files into the app** —
recreate the design in `dashboard.html`'s existing inline `<style>` block /
`base.css`, using the app's existing ids, classes and render function
(`renderConditioning()` in `dashboard.html`). Companion files:
- `onyx-conditioning-tokens-and-styles.css` — paste-ready CSS
- `markup-snippets.md` — restyled toggle, sub-category header, and routine
  card template (as produced by `renderConditioning()`'s string-building JS)

## Fidelity
**High-fidelity.** Colors, typography, spacing and radii specified exactly
below.

---

## ⚠️ Codebase conventions to respect (from the app's `CLAUDE.md`)
- **Invoke the `executive-summary` skill and get explicit approval before
  editing files.**
- Work only in `4-Weeks-to-Open-`; feature branch → draft PR → merge to
  `main`. Never push to `MC-Training-Rolodex`.
- Bump `base.css?v=` if shared styles move there.
- **This screen is built by JS, not static markup** — `renderConditioning()`
  in `dashboard.html` (search for `function renderConditioning`) builds the
  toggle + cards as HTML strings and injects them into `#condBody`. Restyle by
  editing the CSS (below) plus the small string templates inside that
  function (see `markup-snippets.md` for the exact `html +=` lines to change)
  — **do not rewrite the function's data flow, ids, or the
  `onclick="setCondSubTab(...)"` / `data-cond-id` / `data-mc-orig-*` attributes**.
  Those are read by `mc-pm-inline.js` (owner inline-editing) and `mc-cond.js`
  (PB pill decoration, guided-timer bar) — removing them breaks both.
- Keep `#condBody[data-cond-layout="…"]` attribute selectors working — the
  owner-selectable "compact" / "grid" layouts (`mc-layout.js`) key off them.
  Don't rename `.cond-card` / `.cond-sub` / `.cond-tag` / `.cond-name` /
  `.cond-meta` / `.cond-stats` / `.cond-arrow` — retheme in place.
- `mc-cond.js` appends a `.mcc-pb` "🏆 PB mm:ss" pill to any `<a>` whose `href`
  matches a routine — it's appended as a child of `.cond-card` at runtime, so
  make sure the card's flex/block layout has room for a trailing pill (see
  the Hell Week card in the prototype for the intended look, gold-tinted).

---

## Screen: Conditioning (`#condBody`, inside whichever screen wrapper hosts it)

### Layout (top → bottom)
1. **Screen header** — "Conditioning" title + one-line description (new copy
   framing, not currently in the JS — optional addition, ask the owner)
2. **Sub-tab toggle** (🔥 Workouts / 🏃 Exercises) — existing inline-styled
   buttons built by the `tgBtn()` helper in `renderConditioning()`
3. **Workouts tab**: for each `type:'routines'` sub-category in
   `CONDITIONING.subcategories` — a `.cond-sub` block: icon chip + name +
   blurb (`.cond-sub-head`), then its `.cond-card` routines
4. **Exercises tab**: intro copy + search input + `#condLib` (shared library
   search, `MCSubs.libGroupsHTML`) — container restyled to Onyx surface only

### Component specs

**Sub-tab toggle** — replace the current flat "active=red-fill" pill pair with
the Onyx gold-gradient active state (matches the segmented feel used
elsewhere in Onyx):
- Track: `background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:4px;`
- Active button: `background:linear-gradient(135deg,#e9cb7d,#c79c4f); color:#1a1409;` Archivo 800, 13px
- Inactive button: transparent, `color:#8b8b92`

**Sub-category header (`.cond-sub-head`)**
- Icon chip (`.cond-sub-icon`): 38×38, `border-radius:11px`,
  `background:rgba(226,75,74,.14)`, `border:1px solid rgba(226,75,74,.35)` —
  keep the JS-computed `hexA(col,…)` tint formula, just updated alpha/radius
- Name (`.cond-sub-name`): Archivo 800, 16px, `#f4f3f1`
- Blurb (`.cond-sub-blurb`): 12px, `#a6a6ad`

**Routine card (`.cond-card`)**
- `border-radius:16px; padding:16px 18px;`
- Fill: `linear-gradient(135deg, rgba(ACCENT,.1), rgba(20,20,22,.5))` (ACCENT =
  the sub-category's `color`, e.g. `#E24B4A` for "Not for the Faint of Heart")
- Border: `1px solid rgba(ACCENT,.28)`
- Tag (`.cond-tag`): 11px 800, uppercase, `.08em`, colored to ACCENT tint
  (`#f0837f` on the red family)
- Name (`.cond-name`): Archivo 800, 16.5px, `#f4f3f1`
- Description (`.cond-meta`): 12px, `#a6a6ad`, line-height 1.5
- Stat pills (`.cond-stats` / `.cond-stat`): 11px 700, `#c9c9cf`,
  `background:rgba(255,255,255,.05)`, `border:1px solid rgba(255,255,255,.08)`,
  pill shape
- Arrow (`.cond-arrow`, replaces the current colored circle+→): a plain 15px
  chevron-right line icon, `#8b8b92`, top-right, no background circle — quieter
  than the current filled-circle treatment
- PB pill (`.mcc-pb`, from `mc-cond.js`): restyle to
  `color:#e6c579; background:rgba(216,180,99,.12); border:1px solid rgba(216,180,99,.28);`
  gold instead of the current amber, `border-radius:20px`

**Exercises tab container** — intro text `#a6a6ad`, search input
`background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); color:#f4f3f1;`
`border-radius:11px`. `#condLib`'s inner group headers/rows come from
`MCSubs.libGroupsHTML` (shared with Exercise Library) — no changes here beyond
whatever the Exercise Library redesign (future handoff) applies globally.

---

## Interactions & behavior
No new JS logic — `renderConditioning()` keeps building the same DOM; only its
inline style strings/class usage change (see `markup-snippets.md`). Sub-tab
switching (`setCondSubTab`), PB pills, and the guided-timer action bar
(`mc-cond.js`) are unaffected.

## State management
None new. `condSubTab` module variable, `CONDITIONING` data, and
`localStorage('mc_cond_log_v1')` PBs are all unchanged.

## Design tokens
Same Onyx palette as the Dashboard/Programs handoffs:
- Background: `radial-gradient(120% 60% at 50% -10%, #171612 0%, #0a0a0b 46%)`
- Text: `#f4f3f1` / `#f6f5f2` primary, `#a6a6ad` muted, `#8b8b92` muted-2,
  `#7d7d84` faint
- Gold: `#e6c579`, gradient `#e9cb7d → #c79c4f`
- Category accent (kept): `#E24B4A` ("Not for the Faint of Heart")
- Fonts: Archivo 700/800/900 display, Manrope 400/600/700 body (already
  loaded app-wide since the Dashboard Onyx rollout)

Radius: sub-icon chip 11 · routine card 16 · stat pill / PB pill 999 · toggle
track 14 / buttons 11
Motion: `:active` scale .985 on cards, `transition:transform .12s ease`

## Assets
No image assets — inline SVG line icons (flame, chevron-right) in
`markup-snippets.md`. Fonts already loaded from the Dashboard Onyx rollout.

## Files in this bundle
- `README.md` — this document
- `onyx-conditioning-tokens-and-styles.css` — paste-ready CSS
- `markup-snippets.md` — toggle / sub-header / card templates to paste into
  `renderConditioning()`'s string-building JS
- `Conditioning Redesign.dc.html` — HTML prototype. **Visual reference only.**

## Files in the app to edit
- `dashboard.html` — inline `<style>` block (add Onyx Conditioning rules) +
  the `renderConditioning()` function's HTML-string templates (toggle, sub
  header, card markup) — per `markup-snippets.md`. Keep every id, `onclick`,
  and `data-*` attribute exactly as-is.
