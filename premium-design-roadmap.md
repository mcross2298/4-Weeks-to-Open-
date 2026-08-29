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

### `P0` — Measurement harness ✅ **shipped 2026-08-24** (PR #308)

`tools/check-design-tokens.js`, written **before** any token change and proven
to fail on the tree first — a gate that cannot fail is worthless
(`check-topbar-inset.js`'s lesson). Both directions were exercised: injecting
`font-weight:350` fails it, removing it passes.

- **`font-weight` is a hard failure.** Every weight in the tree already sat on
  the declared 400–900 scale, so the check passes today and fails the moment an
  off-scale one appears — which is the whole job.
- **Radius, hardcoded sizes and component-literal hex are ratchets** that may
  only go down. Failing 97 off-scale radii on day one would have meant the gate
  got disabled, and a disabled gate protects nothing.

**The ratchet fired on `P0`'s own commit**, because adding 12 canonical ramp
tokens raised the distinct-hex count. Re-baselining past my own gate would have
taught the next person that re-baselining is how you get past it, so **the
metric was corrected instead**: hexes now count only as literals inside
component rules, never as custom-property definitions. A token definition is
the cure; a literal buried in a rule is the disease. That tightened the real
number 169 → 158.

### `P1` — Token foundation ✅ **shipped 2026-08-24** (PR #308)

One warm `--ink-0 … --ink-11` ramp, **read from opposite ends by the two
themes**. The light theme's ramp was the good one, so it won: every step at 3
and above is a value light mode already shipped, and the light block re-points
onto the tokens with its **rendered output byte-identical**. Only dark changes,
which is why the light-mode contrast ratchet could not regress from this step.

`--ink-0` is true `#000` on purpose — on the OLED panels this app is used on
the pixel switches off, and that infinite local contrast behind near-white type
is most of what reads as "4K" in the references.

Also added `--fw-light`/`--fw-regular` (the missing light half of the editorial
pairing), the `--r-*` radius scale, `--fs-display:38px`, `--hairline` and two
elevation steps. The four original weight tokens kept their exact values, so
nothing shifted until a component opted in. **Zero component edits** — `P1`
shipped alone so a regression would have exactly one possible cause.

**Measured, driving a browser against the parent commit:**

| token | before | after | |
|---|--:|--:|---|
| `--text` | 15.90:1 | 19.80:1 | improves |
| `--muted` | **4.16:1** | **5.59:1** | was FAILING WCAG AA |
| `--muted2` | 2.63:1 | 3.59:1 | improves |

3 of 4 probe pages moved `#0a0a0a` → `#000`; light-mode token values
byte-identical everywhere; zero overflow, zero pageerrors, `scrollWidth`
unchanged.

**Two corrections the verification forced**, recorded because both would
otherwise have shipped as false claims. The first A/B ran against a stale local
`main` (`f3cc45a`) rather than the true parent (`84458e1`) — a pre-`F3` tree —
and appeared to show a 395px → 390px overflow "fix" this change does not make.
And setting `data-theme` after `DOMContentLoaded` is **clobbered by each page's
own theme-boot script**, so the first light-mode run compared dark values on
both sides and reported five false differences.

**Known, not fixed:** `dashboard.html` overrides `--text`/`--muted`/`--body-bg`
itself and is insulated from the ramp — it stays `rgb(10,10,10)`. Pre-existing
and identical on both sides. It is the most bespoke surface in the app
(hand-written CSS per program id), so folding it into a phase aimed at other
files is how a broad regression gets in unnoticed. **It wants its own step.**

### `P2` — Landing surface ✅ **shipped 2026-08-25** (PR #309)

`mc-program-hero.css` onto the `P1` scales across all 13 `cat-*.html` landings.
Bordered `.pl-stat` boxes became a hairline-divided stat row; `.pl-inside-row`
became hairline-separated rows on flat ground; `.pl-name` moved to
`--fs-display`; `.pl-tagline` dropped to `--fw-light` and moved *up* the ramp
to `--ink-8`, because light type needs more contrast, not less. The accent went
from **six places to one** (the tier pill), and the CTA became an
inverted-contrast near-white pill. Also fixed a seam `P1` created: the hero
gradient's far stop was a hardcoded `#0a0a0b`, visible against the new
true-black canvas.

**Four defects, all found by driving 52 checkpoints (13 landings × 2 themes ×
2 widths), none of which reading would have caught and none of which raised an
error.**

1. **A comment terminator hidden in prose.** This file's own new header said the
   work moved it onto the `--ink`, `--r` and `--fw` scales — written, at first,
   as a slash-separated list of globs. A token glob written directly against a
   slash **forms a comment terminator**: the comment closed twenty lines early,
   the rest of the prose was parsed as CSS, and it swallowed the entire
   `.pl-hero` rule. Every landing rendered a 16px title and a transparent,
   unrounded CTA. Diagnosed by asking the browser for `document.styleSheets` —
   the rule came back NOT FOUND while `.pl-hero *` right after it survived.

   Sweeping the tree for the same shape found a **pre-existing instance** in
   `mc-light.css`, where `.set-*` written against `/.tf` had been eating
   `html[data-theme="light"] .mcl-toggle{…}` — confirmed absent from
   `document.styleSheets` on the parent commit too, so the Log Sets toggle kept
   its dark-mode colour on the cream ground, precisely the unreadability the
   block above it says it exists to fix. Now gated by
   `check-design-tokens.js`. Writing that gate's own explanation reproduced the
   bug a **third** time, in JavaScript — the trap is not CSS-specific.

2. **The component must survive without `base.css`.** Four landings (`cat-hv`,
   `cat-ie`, `cat-ks`, `cat-mm`) deliberately do not link it — documented
   self-contained pages under DG-1/DG-2 — and they load this stylesheet. Moving
   everything onto shared tokens broke them silently: an undefined `var()`
   invalidates the whole declaration, so three rendered a 16px title while ten
   were correct. Every token is now aliased to a `--pl-*` name whose fallback is
   the identical `base.css` literal.

3. **The obvious alias idiom is a CSS cycle.** `--ink-0: var(--ink-0, #000)`
   reads like the natural way to write that fallback and is a self-dependency,
   so the property goes guaranteed-invalid. Verified in a browser rather than
   argued: a probe width computed as `auto` (1264px) and a height as 0 — worse
   than doing nothing, and broken in **both** the `base.css`-present and
   `-absent` cases.

4. **A pre-existing touch-floor violation.** `.pl-icon-btn` — the Back and Menu
   controls on every landing — shipped at 38×38, under the app's 44pt floor.
   Verified identical on the parent; raised to 44. Same family as the
   `.mc-surprise-btn` / `.inst-header-link` shortfall recorded elsewhere as
   caught by no gate: `check-journey.js` measures session-shell controls only,
   and no landing is in its table.

`cat-custom.html` has no hero by design (custom programs fall through to
`#heroCard` per `F0` decision 4) — confirmed absent on the parent, so the probe
was corrected rather than the page.

### `P3` — Session surface ✅ **shipped 2026-08-25** (PR #310)

**The finding that defines this phase: tokens only reach code that asks for
them.** `P1` unified the two neutral families at the token layer, but the
session surface asked for slate *by literal*, so it never moved — **46
hardcoded slate hexes and 12 slate `rgba()` tints** across `base.css`,
`mc-setlog.css`, `mc-summary.css` and `mc-card-actions.css`. The app's chrome
had gone warm while the screen the athlete actually spends the session on
stayed blue: the resting-card chevron rendered `rgb(100,116,139)` — Tailwind
slate-500 — against a true-black warm ground, and `.a-rep`'s rep numerals were
`#3a4661`, a blue that exists nowhere else in the design system.

**Mapped by luminance, not by eye**, because nothing in CI would catch a
dark-mode contrast regression — `check-contrast.js` is a light-mode ratchet.
On `#000`:

| slate | before | warm | after | |
|---|--:|---|--:|---|
| `#f1f5f9` | 19.17 | `--ink-11` | 19.63 | improves |
| `#e2e8f0` | 17.03 | `--ink-11` | 19.63 | improves |
| `#e6e9ee` | 17.25 | `--ink-11` | 19.63 | improves |
| `#cbd5e1` | 14.14 | `--ink-8` | 12.76 | nearest step |
| `#94a3b8` | 8.19 | `--ink-8` | 12.76 | improves |
| `#64748b` | 4.41 | `--ink-7` | 5.59 | improves |
| `#475569` | 2.77 | `--ink-6` | 3.59 | improves |
| `#3a4661` | 2.23 | `--ink-5` | 2.21 | same dimness |

Seven of nine improve. The two that don't are both fine: `#cbd5e1` lands on the
nearest warm step and is still 12.76:1, far above AA; and `#8b95a4`/`#e6e9ee`
appear **only as `var(--muted, …)` / `var(--text, …)` fallbacks**, which can
never fire because both tokens are always defined on `:root` — the rendered
value is unchanged and only the literal becomes honest. `#3a4661` → `--ink-5`
is the neat one: the same dimness, warm instead of blue, which is exactly what
an upcoming rep numeral wants.

The 12 `rgba()` tints were warmed to the matching ramp triplet at identical
alpha — a warm hex on a blue-tinted background is worse than either alone.
Also applied `P1`'s weight roles: `.mc-tempo-desc`, `.mc-qp-legend` and
`.mc-sub-empty` are running prose set at 600 and dropped to `--fw-regular`; the
toolbar's elapsed timer moved off pure `#fff` onto `--ink-11`.

**What was deliberately NOT changed.** The toolbar turned out closer to the
reference than this roadmap assumed — `.mcs-timer` was already monochrome and
`.mcs-endbtn` already a 44px grey pill. Its only accent sites are
`.mcs-rest-val` and `.mcs-sumbtn.mcs-btn-open`, both genuine state signals, and
`.mcs-timer`/`.mcs-rest` are **mutually exclusive** (`body.mcs-resting` swaps
them), so at most one accent is on screen at a time and decision 4 already
held. No changes were manufactured to make the diff look bigger. The
`.a-rep.live` glow was left alone: removing it is a UX call beyond a token
phase, and it carries runtime risk `card-integration-roadmap.md` spent six
steps buying down.

**Verified against the real current `main`:** `check-journey` 9/9 clean, no
session-shell control under 44×44 (the phase's stated constraint), runtime
budget within limits on all three probe pages, and a blue-bias scan (B > R)
over rep numerals, chevron, logger toggle and strip count returning **zero**
blue-biased colours on the branch versus two on `main`.

**Two false readings caught before they became claims:** a probe compared
against a `/tmp` baseline built from a pre-`P1` HEAD, where `var(--ink-5)` is
undefined and falls back to inherited slate — it "proved" the parent was blue
for entirely the wrong reason; and that same probe returned all-null selectors
on both sides, because after `F3` these pages open as a day **list** with no
exercise card at load, so nothing was being measured at all. The real check
deep-links `?day=1` (35 rep numerals, 10 strips) and adds `pmc-back.html`.

**Cumulative ratchet movement across `P0`–`P3`:** font-weight declarations
266 → 249, off-scale radii 97 → 91, hardcoded px font-sizes 93 → 90,
component hex literals 169 → 150.

### `P4` — Ratchet re-baseline + docs 🟡 **docs half shipped; ratchet half open**

The documentation half is done: the shipped entries above, this roadmap's entry
in `CLAUDE.md`'s Active Development Plan section, and
`tools/check-design-tokens.js` added to `CLAUDE.md`'s canonical gate list — it
had been running in `verify.yml` since `P0` while the docs never mentioned it,
which is exactly the drift that list exists to prevent.

**No user-facing doc update was required** under the documentation currency
rule: `P0`–`P3` changed colour, weight, radius and spacing tokens, not a
feature a trainee has to discover or learn to use. `quick-tour.html` and the
program guides describe behaviour, and none of it changed.

**The ratchet half remains open, and cannot be closed from an agent sandbox** —
see the constraint below. Five real improvements from `P2` are still unbanked
(`pmc-s7-giant` 24 → 1 findings, `pmc-home` 14 → 0, `iron-engine` 4 → 1,
`kitchen-sink-s3` 4 → 1, `kitchen-sink` 3 → 1). Nothing is failing; the budgets
are simply looser than reality, so a regression back toward the old numbers
would pass. Closing it needs one run of
`node tools/check-contrast.js <url> --update` and
`node tools/check-visual-ratchet.js <url> --update` from CI or any environment
where `fonts.gstatic.com` resolves.

Original scope, for reference:
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
