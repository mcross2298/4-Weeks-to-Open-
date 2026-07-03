# Handoff: Programs Screen Redesign — "Onyx" (continuing direction 1a)

## Overview
A premium restyle of the **Programs screen** (`#scr-programs` in `dashboard.html`,
reached via the bottom tab bar or the dashboard's "Browse all" link). Same content,
same data source, same tiering (Flagship → Influencer) — restyled to match the
**Onyx** system already shipped on the Dashboard (`#scr-dashboard`): layered
near-black surfaces, refined soft gold accent, glass depth, Archivo/Manrope
typography, line icons instead of emoji.

This is a **direct continuation** of the Onyx dashboard handoff that shipped
earlier (see the `#scr-dashboard` Onyx block already in `dashboard.html`'s
`<style>`). It closes the visual gap users currently hit: Onyx hero → tap
"Browse all" → flat, un-restyled `.cat-card` grid.

> Scope: this handoff covers the **`#scr-programs` screen only** (the Flagship
> and Influencer program lists, the Exercise Library link, and the "Build a
> Program" CTA). The individual program pages (`cat-*.html`) are out of scope —
> a separate handoff.

## About the design files
The files in this bundle are **design references created in HTML** — a
streaming "Design Component" prototype (`Programs Redesign.dc.html`) rendered
inside an iPhone bezel, showing the intended look and behavior. **Do not copy
the `.dc.html` / `ios-frame.jsx` files into the app.** They use a prototyping
runtime that doesn't belong in production.

Your task is to **recreate the Onyx Programs screen in the app's existing
environment**: the inline `<style>` block in `dashboard.html` and/or `base.css`,
using the app's established class names, element ids, and JS hooks — exactly
like the dashboard Onyx rollout did. Everything you need is in this README plus
the two companion files:
- `onyx-programs-tokens-and-styles.css` — paste-ready CSS
- `markup-snippets.md` — the restyled tier headers, flagship cards, influencer
  grid, library link, and "Build a Program" CTA, with inline SVG line icons

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, borders and per-program
accent tints are specified exactly below. Recreate pixel-for-pixel; ask the
designer for prototype screenshots if useful for cross-checking.

---

## ⚠️ Codebase conventions to respect (from the app's `CLAUDE.md`)
- **Invoke the `executive-summary` skill and get explicit approval before
  editing files** — this is a UI change to an existing page, which that rule
  covers.
- Work only in the **`4-Weeks-to-Open-` master repo**; feature branch → draft PR
  → merge to `main`. **Never push to `MC-Training-Rolodex`** (auto-deploy
  target).
- `dashboard.html` links `base.css?v=65`. If styles go in `base.css`, **bump
  the `?v=` query** on every page that links it.
- **Preserve every existing element id, `href`, and script hook.** The
  Programs screen is simpler than the dashboard (mostly static links + a few
  JS-populated slots), but these ids are load-bearing:
  - `#flagGrid` — flagship card container (count is read at runtime by
    `document.querySelectorAll('#flagGrid .cat-card').length` into `#flagCount`)
  - `#bonusCardSlot`, `#collectionsSlot` — populated by `mc-bonus-routing.js` /
    `mc-collections.js`
  - `#pubTier` / `#pubProgList`, `#customTier` / `#customProgList` — owner
    published/custom programs, toggled `display:none` → visible by JS
  - `#gainzCard` / `#gzLive` / `#gzStreak` — Daily Gainz's live streak module
  - The `MARKET:STRIP` comment markers around the Influencer Programs block —
    **do not remove or move these**; the Rolodex (public) build strips
    everything between them. Keep the restyle **inside** the markers.
- This is a **presentation-layer** change; do not alter routing, data, or JS
  behavior. Every `<a href="cat-*.html">` stays a plain link.

---

## Screen: Programs (`#scr-programs`)

### Layout (top → bottom)
Single scrolling column inside `.prog-screen-inner` (max-width 680px, centered),
on the Onyx background (shared with `#scr-dashboard`). Fixed bottom tab bar.
Section order:

1. **Top bar** — "Programs" title + live count sub-label (existing `.topbar`,
   restyled to Onyx tokens — same treatment as the dashboard's top bar)
2. **Flagship Programs** — tier label + 6 full-width stacked cards (`#flagGrid`)
3. Bonus/Collections slots (unchanged, JS-populated — inherit Onyx surface
   tokens automatically since they use `.cat-card`)
4. **Influencer Programs** — tier label + 2-up compact grid (`.influencer-grid`,
   4 cards) — kept inside `MARKET:STRIP` markers
5. Published/Custom program slots (owner-only, unchanged)
6. **Exercise Library** link card (existing `.lib-link`, restyled)
7. **Build a Program** dashed CTA card
8. Bottom tab bar (existing `.tab-bar` — already Onyx-styled app-wide from the
   dashboard rollout; "Programs" tab shows active/gold here)

### Component specs

**Screen background** — apply the same radial gradient used on
`#scr-dashboard`: `radial-gradient(120% 60% at 50% -10%, #171612 0%, #0a0a0b 46%)`.

**Top bar** — title ("Programs"): Archivo 800, 26px, `#f6f5f2`, `-0.02em`. Count
sub-label (`#flagCount`, e.g. "10 training programs"): Manrope 600, 13px,
`#a6a6ad`.

**Tier label (`.tier-label`)** — Archivo 800, 11px, `.16em` letter-spacing,
uppercase, with a hairline rule filling the remaining width
(`::after{flex:1;height:1px;background:rgba(255,255,255,.08)}`).
- `.tier-label.flag` — "★ Flagship Programs" — color `#e6c579` (gold).
- `.tier-label.influencer` — "Influencer Programs" — color `#8b8b92` (muted),
  `margin-top:24px` to separate from the flagship block above.

**Flagship card (`.cat-card`, inside `#flagGrid`)** — full-width, stacked,
`gap:12px` between cards.
- Shape: `border-radius:20px; padding:18px; overflow:hidden;`
- Fill: `linear-gradient(160deg, rgba(ACCENT,.16), rgba(20,20,22,.5))`
- Border: `1px solid rgba(ACCENT,.28–.3)`; `border-top:2.5px solid ACCENT`
- Icon chip (`.cat-icon`, replaces emoji): 34×34, `border-radius:10px`,
  `background:rgba(ACCENT,.18)`, centered line-icon SVG stroke tinted to the
  accent, `margin-bottom:14px`
- Flagship pill (`.cat-tag`): "Flagship" — 10px 800, uppercase, `.1em`, pill,
  `background:rgba(ACCENT,.2)`, `border:1px solid rgba(ACCENT,.4)`, text tinted
  to accent (light tint, e.g. `#fda4af` for the rose accent) — replaces the old
  "★ Flagship · …" long-form tag copy with just **"Flagship"**
- Name (`.cat-name`): Archivo 800, 18px, `#f6f5f2`, line-height 1.2
- Description (`.cat-meta`): Manrope 12.5px, `#c9c9cf`, line-height 1.5
- Meta row (`.cat-count`): Manrope 700, 11px, uppercase, `.06em`, `#8b8b92` —
  drop the trailing "→" (a chevron SVG in the top-right does that job now)
- Chevron affordance: 18px line-icon arrow, `#8b8b92`, top-right of the card,
  vertically aligned with the name (see markup snippet)
- Active/tap: `transform:scale(.985)`

**Accent map (per program id, same hex family as the dashboard's rail):**
- `ss` Strength & Supersets → `#c9505a`
- `pmc` Project Muscle Confusion → `#8b7ff0`
- `mc` Mike Cross' Favorite Splits → `#d8b463`
- `ks` Everything Under the Kitchen Sink → `#e0a03c`
- `mm` The Modality Matrix → `#6f77e0`
- `hv` High-Volume Training Template → `#9fbf4a`

**Influencer card (`.influencer-grid .cat-card`)** — 2-column grid, `gap:10px`
(1-column under ~560px width, matching the existing responsive rule).
- Shape: `border-radius:16px; padding:14px;`
- Fill/border: same accent-tint formula as flagship but lighter —
  `linear-gradient(160deg, rgba(ACCENT,.14), rgba(20,20,22,.5))`,
  `border:1px solid rgba(ACCENT,.26)`, `border-top:2px solid ACCENT`
- Icon chip: 28×28, `border-radius:8px`, `margin-bottom:20px` (pushes name
  toward the bottom, echoing the dashboard rail card's proportions)
- Name (`.cat-name`): Archivo 800, 14px, `#f4f3f1`
- One-line description (`.cat-meta`): 11px, `#8b8b92`, line-clamp 2
- Meta (`.cat-count`): 10px 700, uppercase, `.06em`, `#7d7d84`
- No flagship pill on influencer cards (keeps them visually secondary, per the
  existing tier hierarchy)

**Accent map (influencer):**
- `stndr` → `#1d9e75` · `pump` → `#d85a30` · `gainz` → `#378add` ·
  `psu` → `#639922`

**Exercise Library link (`.lib-link`)** — full-width card.
- `border-radius:16px; padding:14px 16px;`
- `background:rgba(216,180,99,.08); border:1px solid rgba(216,180,99,.24);`
- Icon chip: 32×32, `border-radius:9px`, `background:rgba(216,180,99,.14)`,
  gold line-icon (open-book / library glyph)
- Title (`.lib-name`): Archivo 800, 14px, `#e6c579`
- Sub (`.lib-sub`): 11px 600, `#8b8b92`
- Trailing chevron, same style as flagship cards

**Build a Program CTA** — dashed empty-state card.
- `border-radius:18px; border:1.5px dashed rgba(216,180,99,.3);`
- `background:rgba(255,255,255,.02); padding:24px 18px; text-align:center;`
- Plus-icon (24px, gold stroke) above title
- Title: Archivo 800, 15px, `#f4f3f1`. Sub: 12px, `#8b8b92`, line-height 1.5

---

## Interactions & behavior
- No new JS logic. Every card stays a plain `<a href="cat-*.html">` /
  `<a href="build-program.html">` / `<a href="exercise-library.html">`.
- **Tap feedback**: cards scale to `.98`–`.985` on `:active`
  (`transition: transform .12s ease`), matching the dashboard's rail/tool cards.
- `#flagCount` continues to be computed at runtime from the rendered `#flagGrid`
  children — do not hardcode a count.
- JS-populated slots (`#bonusCardSlot`, `#collectionsSlot`, `#pubProgList`,
  `#customProgList`) render `.cat-card` elements from their own scripts — since
  they reuse the same class, they inherit the Onyx restyle automatically. No
  changes needed in `mc-bonus-routing.js`, `mc-collections.js`, etc.

## State management
No new state. All values are static (program list) or already populated by
existing scripts. This is a pure restyle of existing DOM/CSS.

## Design tokens
Reuses the **same Onyx tokens** already defined for `#scr-dashboard` — scope
new rules to `#scr-programs` the same way (or promote the shared tokens to a
common ancestor if `#scr-dashboard`'s tokens are refactored to be global later).

Colors
- Background: `radial-gradient(120% 60% at 50% -10%, #171612 0%, #0a0a0b 46%)`
- Card surface tint: `rgba(255,255,255,.02–.035)` base, accent-tinted gradients
  per program (see accent maps above)
- Text: primary `#f6f5f2` / `#f4f3f1`; muted `#c9c9cf` / `#a6a6ad`; muted-2
  `#8b8b92`; faint `#7d7d84`
- Refined gold (primary accent): `#e6c579`

Typography — same as dashboard Onyx:
- Display: **Archivo** 700/800/900 · UI/body: **Manrope** 400/600/700/800
- Scale: screen title 26/800 · tier label 11/800 (`.16em` uppercase) · flagship
  name 18/800 · flagship desc 12.5/600 · influencer name 14/800 · meta 10–11/700
  uppercase

Radius: flagship card 20 · influencer card 16 · icon chip 8–10 · library/CTA
card 16–18 · pill 999
Motion: `:active` scale .98–.985, `transition:transform .12s ease`

## Assets
No image assets. All iconography is **inline SVG line icons** (in
`markup-snippets.md`) — barbell, bolt, crown, flame, hexagon, bar-chart, open
book, plus, chevron-right. Fonts already loaded app-wide from the dashboard
Onyx rollout (Archivo + Manrope via Google Fonts).

## Files in this bundle
- `README.md` — this document (self-sufficient spec)
- `onyx-programs-tokens-and-styles.css` — paste-ready CSS: component styles
- `markup-snippets.md` — tier headers, flagship cards (all 6), influencer grid
  (all 4), library link, build CTA — with inline SVGs, ready to paste into
  `#scr-programs`
- `Programs Redesign.dc.html` — the HTML prototype these specs were written
  from. **Visual reference only — not for production use.**

## Files in the app to edit
- `dashboard.html` — inline `<style>` block (add the Onyx Programs rules,
  scoped `#scr-programs …`) + the `#scr-programs` markup (replace emoji icons
  and long-form tags on the 6 `#flagGrid` cards and 4 `.influencer-grid` cards
  per `markup-snippets.md`; keep every `href`, id, and the `MARKET:STRIP`
  markers exactly where they are).
- `base.css` — only if you choose to move shared styles there instead (bump
  `?v=` on every page that links it if so).
