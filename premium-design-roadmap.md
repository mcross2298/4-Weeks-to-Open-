# Premium Design Roadmap — `P0–P4`

**Opened 2026-08-24.** Aligned with the owner via `AskUserQuestion` (four
decisions, below). Scratch-listed in `content-manifest.json`, so it never
ships to the public Rolodex build.

---

## Objective

Two reference screenshots of a commercial training app were supplied with the
brief: *"extreme premium sleek look, looks like 4K — what would it take to
install the 4K feel but keep the same style, themes and colors my app owns?"*

**"4K feel" is not resolution.** Neither reference screen contains a single
element this app cannot already render. The gap is entirely in the token
layer, and it decomposes into five measurable defects — every number below
was measured against the real tree, not estimated.

---

## What the measurement found

Run against every tracked `*.css` in the repo:

| Measure | Finding |
|---|---|
| **`font-weight` declarations** | **266 total — 264 of them are 600 or heavier.** 107×`900`, 87×`800`, 53×`700`, 17×`600`, **2×`500`, 0×`400`.** |
| **`border-radius` literals** | **21 distinct** px values (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,20,22,24,999). No radius token exists. |
| **`font-size` px literals** | **28 distinct** hardcoded sizes *in addition to* the 11-step `--fs-*` scale (8.5 → 88px). |
| **Distinct hex colors** | **171.** |
| **Neutral ramp** | **Two incompatible families.** Dark theme is Tailwind *slate* — blue-tinted (`#e2e8f0`, `#cbd5e1`, `#94a3b8`, `#64748b`, `#475569`). Light theme is a warm *stone/cream* ramp (`#faf7f0`, `#f5f2ec`, `#efe9db`, `#8a8377`, `#6b6459`, `#1c1a17`). The accent (`#d4af37` gold) is warm. |

### The five defects, in order of how much they cost

1. **The app has no light type weight.** `--fw-medium:600` is the *lightest*
   token in the scale, and the measurement confirms it: two `500`
   declarations in the entire tree and zero `400`. Premium interfaces get
   their calm from **editorial contrast** — light body copy set against heavy
   display type. Uniform boldness reads loud and consumer-grade. This is the
   single largest contributor and the cheapest to fix.

2. **The dark theme's neutrals are blue; the accent and the light theme are
   warm.** Slate greys under a gold accent are why dark mode reads
   "dashboard" rather than "premium," and why the two themes don't feel like
   one product. The light theme's warm cream/ink pairing is genuinely good —
   the dark theme should join it, not the reverse.

3. **Boxes where the reference uses space and hairlines.** `.pl-stat`,
   `.pl-inside-row` and `.pl-day-swatch` are each a bordered, filled,
   rounded box. The reference's stat row is three cells split by 1px
   hairline rules with no fill, no border, no radius; its per-set reps are
   **bare numerals at varying opacity** — no pills, no badges, no chrome.

4. **No radius scale.** 21 literals, with 6 of them (9/11/12/13/14/15px)
   inside a single 116-line component file. Inconsistent corner geometry is
   precisely what breaks a high-fidelity read at a glance.

5. **Narrow dynamic range.** The type scale tops out at `--fs-hero:30px`; the
   reference display title is ~36–38px. Premium comes from a *wider* ramp
   (10px micro-labels against a 38px display size), not a larger middle.

### What is already right, and must not be touched

- **The typeface pairing.** Archivo (display) + Manrope (UI) is close to the
  reference's geometric grotesk. The type identity is not the problem.
- **The light theme's cream/ink pairing** (`#f5f2ec` / `#1c1a17`).
- **Per-program accent identity** — every program's `color` field, the
  `check-program-colors.js` contract binding `mc-pm-data.js` ↔
  `dashboard.html` ↔ `mc-theme.js`'s `FALLBACK` map. Untouched throughout.

---

## Decisions locked (owner, `AskUserQuestion`, 2026-08-24)

1. **Foundation: full refit.** True-black canvas, de-blued neutral ramp,
   light weights added, one radius scale, type scale extended, hairline-and-
   space over bordered boxes. Inherited by all ~161 pages; re-baselines the
   contrast and visual ratchets.
2. **Rollout: landing + session first** — `cat-*.html` landings
   (`mc-program-hero`, `mc-program-tabs`) and the in-workout session shell
   (`mc-summary`, `.a-hdr`, `mc-setlog`). The two screens the references
   actually show.
3. **Photography: stay typographic.** No image band. `F6` deleted the 190px
   `.pl-imgband` placeholder for good reasons that still hold — matching the
   reference landing would need one real commissioned hero image per program
   (10 programs), plus weight budget, `sw.js` cache strategy and a
   light-theme treatment. The premium read comes from a taller gradient
   field, bigger display type, a hairline stat row and an inverted-contrast
   CTA instead.
4. **Accent: one per screen.** Gold becomes a single identity/state signal
   per screen; chrome, chips, stats and rows go monochrome. Note the
   reference session view uses **zero** accent — restraint is the signal.

---

## Phases

Each phase is its own PR. `AskUserQuestion` gate between phases per the
project's multi-phase rule.

### `P0` — Measurement harness *(gate: none)*
`tools/check-design-tokens.js` — a source gate that counts what this roadmap
just measured by hand, so the numbers can't silently regress:
- fails on a `font-weight` literal outside the declared scale,
- fails on a `border-radius` px literal where a `--r-*` token exists,
- reports (does not yet fail) the hardcoded `font-size` and hex counts as a
  ratchet, seeded at today's values.
Written **before** any token changes, so it is proven to fail on the current
tree first — a gate that cannot fail is worthless (`check-topbar-inset.js`'s
lesson).

### `P1` — Token foundation *(base.css only)*
- **Neutral ramp**, warm, replacing slate: `--ink-0` (true black canvas)
  through `--ink-9`, with `--text` / `--muted` / `--muted2` re-pointed onto
  it so every existing `var()` consumer inherits the correction with no edit.
- **Weight scale gains `--fw-light:400` and `--fw-regular:500`**; existing
  tokens keep their values so nothing shifts until a component opts in.
- **`--r-xs … --r-xl` + `--r-pill`** radius scale.
- **Type scale extended**: `--fs-display:38px` above `--fs-hero`.
- **Elevation + hairline tokens** — `--hairline`, `--elev-1/2`.
- Light theme re-derived from the same ramp so the two themes are one system.
- **Zero component edits.** Measured before/after on the contrast ratchet;
  any budget movement is inspected, then re-baselined deliberately.

### `P2` — Landing surface
`mc-program-hero.css` + `mc-program-tabs.css` onto the new tokens. The
bordered `.pl-stat` boxes become a hairline-divided stat row; `.pl-name`
moves to `--fs-display`; `.pl-tagline` moves to `--fw-light`; the six radius
literals collapse onto the scale; accent drops to one signal per screen; the
CTA becomes the inverted-contrast pill. All 13 `cat-*.html` verified live at
320/390/430 in both themes.

### `P3` — Session surface
`.a-hdr` (in `base.css`), `mc-setlog.css`, `mc-summary.css`. The session
toolbar goes monochrome per decision 4. Per-set rep numerals move from
chrome to opacity-graded bare numerals. **Constraint: no touch target may
shrink** — `check-journey.js`'s 44×44 floor is the gate, and the whole
`S1`–`S5` card-integration chain is upstream of these files, so no runtime
regression is acceptable either (`measure-session.js --check` must hold).

### `P4` — Ratchet re-baseline + docs
Inspect the visual diff on all five `kitchen-sink` baselines **before**
re-baselining, not after (`F3-3`'s discipline). Contrast budgets re-measured.
`quick-tour.html` updated if any of this is user-discoverable.

> **Constraint found in `P1`, and it governs this phase: contrast and visual
> baselines cannot be rewritten from an agent sandbox.** `fonts.googleapis.com`
> is blocked by the sandbox proxy, `document.fonts` comes back empty, and every
> page renders in the `system-ui` fallback instead of Archivo/Manrope. Text
> metrics therefore differ from CI, where the fonts load.
>
> This is not theoretical. `P1` ran `check-contrast.js` twice against an
> unchanged tree: the enforcing pass reported *"310 findings, none over budget,
> 5 pages improved"*, but `--update` then wrote **11 budget INCREASES** on pages
> the change never touched (`pm-mode-overview` 82→83, `psu-strength` 18→19,
> `quick-tour` 6→7, …) alongside the 5 real decreases. Same tool, same tree,
> different per-page numbers — noise, not signal.
>
> Committing that would have permanently loosened the ratchet on 11 pages using
> wrong font metrics, which is strictly worse than the "re-baseline to get past
> a gate" antipattern the `P0` hex-metric fix already avoided once. The file was
> reverted. **Re-baseline contrast and visual budgets from CI, or from an
> environment where `fonts.gstatic.com` resolves — never from here.** Enforcing
> runs are still trustworthy (they passed), only `--update` is not.

---

## Risks carried

- **Both ratchets will move.** That is expected and intended; the discipline
  is that every diff is inspected before a baseline is rewritten — and, per the
  `P4` constraint above, that the rewrite happens somewhere the webfonts load.
- **`--text` is consumed fleet-wide.** Re-pointing it is the highest-leverage
  and highest-blast-radius edit in `P1`. It is why `P1` ships alone, with no
  component changes, so any regression has exactly one possible cause.
- **The light theme must survive.** `check-contrast.js` is a light-mode
  ratchet; a dark-theme-led refit is exactly the change that breaks light
  mode silently.
- **`P3` touches `mc-setlog.css`**, the file five steps of
  `card-integration-roadmap.md` serialised on. Presentation-only edits, and
  the runtime budget gate is the proof.
