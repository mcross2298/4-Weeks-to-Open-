# Program Landing Rollout — roadmap (PL0–PL4)

> **This is not a new design.** The design was settled in
> [`program-landing-handoff.md`](program-landing-handoff.md) (2026-08-01, "Onyx"),
> and the component that implements it — `mc-program-hero.js` /
> `mc-program-hero.css` — is already built and shipping on two pages. This
> roadmap covers **finishing the stalled rollout** and closing the drift the
> hand-passed config has already produced.
>
> Companion documents: `program-landing-handoff.md` is the design spec of
> record. `Program Landing.dc.html` is the interactive comp it was written
> from. Neither is superseded by this file.

---

## Why this exists

The rollout stopped at 2 of 13 `cat-*.html` pages, leaving the fleet in three
incompatible states, and the config that drives the hero is hand-passed per
page rather than read from `mc-pm-data.js` — which has already caused a live
divergence.

### Current fleet state (surveyed 2026-08-10)

| State | Pages | Count |
|---|---|---|
| **Onyx hero** — loads `mc-program-hero.js` | `cat-pmc`, `cat-strength` | 2 |
| **Status strip only** — loads `mc-program-status.js` | `cat-gainz`, `cat-hv`, `cat-ks`, `cat-mc`, `cat-mm`, `cat-psu`, `cat-pump-new4`, `cat-stndr` | 8 |
| **Neither** | `cat-custom`, `cat-faint`, `cat-ie` | 3 |

`mc-program-hero.js`'s own header already asserts the target state —
"Consumed by every `cat-*.html` program entry page" — so the module is not
waiting on a decision, only on the rollout.

### Drift the hand-passed config has already produced

`cat-strength.html:1287` passes `accent: '#e11d48'`. `mc-pm-data.js` records
`color: '#c9505a'` for the same program (`ss`). The hero therefore renders a
different accent than the dashboard card for the same program.
`tools/check-program-colors.js` holds `mc-pm-data.js`, `dashboard.html` and
`mc-theme.js` in agreement but does not reach the `cat-*.html` hero mounts, so
nothing caught it. The hand-passed `tagline` on the same page has likewise
drifted from that program's `desc`.

The same class of defect appears in the split declarations, which live in
**three** places per program — `mc-pm-data.js`, the page's own program-card
anchors, and `MCProgramStatus.mount({splits:[…]})`:

| Page | `mc-pm-data.js` | Page actually has |
|---|---|---|
| `cat-stndr.html` | `meta: '4 Programs'` | 5 program cards |
| `cat-mc.html` | `meta: '5 Splits · 23 Workouts'` | 6 program links |
| `cat-gainz.html` | `splits[]` — 4 entries | 8 cards, `mount()` lists 8 |

`cat-stndr.html` was read end to end and is confirmed: Weeks to Open, Push /
Pull / Legs, Arnold Legacy, Legacy Prep, The Bro Split. Five, against a
dashboard card reading four. The other two rows are flagged by the same check
and should be confirmed individually before being treated as bugs — `splits`
and `meta` may legitimately count phases rather than programs on some entries.

### The structural point

Rolling the Onyx hero onto 11 more pages **with hand-passed config** would
reproduce `cat-strength.html`'s accent drift eleven more times. This repo has
already paid for that lesson twice — `makeRestTimer` reached 6 distinct bodies
across 21 sites, `applyReplacements` reached 5 — which is why
`tools/check-single-impl.js` exists. The config must become data-driven
**before** the rollout, not after.

---

## Scope

**In scope:** the 13 `cat-*.html` program entry pages, `mc-program-hero.js`,
`mc-pm-data.js`'s program schema, and one new CI gate.

**Out of scope:** the individual split pages (`bro-split.html`,
`weeks-to-open.html`, …). `program-landing-handoff.md` calls for the hero
there too; that is a follow-on once the `cat-*` fleet is consistent.

**Not a redesign.** No visual decisions are reopened. Onyx as specified in
`program-landing-handoff.md` is implemented as-is.

---

## Phases

### PL0 — Extend the program schema
Add the hero's five missing fields to every entry in `mc-pm-data.js`:
`weeks`, `daysPerWeek`, `level`, `scheduleLabel`, `whatsInside[]`. Values come
from each program's existing page — `cat-strength.html` and `cat-pmc.html`
already carry real ones in their mount calls and are lifted verbatim.

Existing fields already cover the rest: `color` → `accent`, `name` → `name`,
`desc` → `tagline`, `tier` → `tierLabel`, `id` → `iconKey`.

Influencer entries stay inside the `MARKET:STRIP influencer-progs` block.

*Gate:* `node tools/check-program-data.js` passes; `python3 tools/build-market.py --check` passes.

### PL1 — Make the hero read from the data file
Give `MCProgramHero.mount()` an `id` form: `mount(el, { id: 'stndr' })` looks
the program up in `MC_PM_DATA` and derives every field. The existing explicit-
config form stays supported for `cat-custom.html`, which has no data entry.

Migrate `cat-pmc.html` and `cat-strength.html` onto it first — this is what
corrects the `#e11d48` / `#c9505a` accent drift, since the accent stops being
typed on the page at all.

*Gate:* both pages render an unchanged hero apart from `cat-strength.html`'s corrected accent.

### PL2 — Roll out to the remaining 11 pages
Add `<div id="programHero">` + a one-line `mount({id})` to each. On the 8
pages currently running `mc-program-status.js`, the hero's own Start/Resume
CTA supersedes the status strip — remove the strip rather than stacking two
start affordances. `cat-custom.html`, `cat-faint.html` and `cat-ie.html` get
the hero for the first time.

Per-page inline `<style>` blocks (2,021–16,210 bytes each) are left alone in
this phase; deduping them is a separate concern and touching both at once
makes the diff unreviewable.

*Gate:* `python3 tools/check-script-manifest.py --check`, `python3 tools/apply-head-contract.py --check`, headless render smoke test.

### PL3 — CI gate
New `tools/check-program-landing.js`, wired into `verify.yml`, asserting:
1. every `cat-*.html` mounts `MCProgramHero` (allowlist for any deliberate exception),
2. no page hand-passes `accent`/`name`/`tagline` when an `id` is available,
3. each program's split count agrees across `mc-pm-data.js`, the page's cards, and any `mount({splits})`.

Check 3 is what would have caught the `cat-stndr` 4-vs-5 mismatch.

*Gate:* the gate fails against the pre-PL0 tree and passes against the post-PL2 tree.

### PL4 — Correct the counts
Fix `meta` / `splits` on the entries PL3 flags, once each is confirmed by
reading its page. `cat-stndr.html` is confirmed already: `meta` goes
`'4 Programs'` → `'5 Programs'`.

Two unrelated defects found during the survey, folded in here as they touch
the same files:
- `cat-stndr.html`'s `<title>` is mojibake — `STNDR â Programs`, a mangled em-dash.
- 10 of 13 `cat-*.html` pages load Archivo/Manrope from `fonts.googleapis.com`. For an offline-first PWA whose service worker precaches the app shell, a blocking third-party font request is a cold-start risk. Self-host or accept the system fallback.

---

## After this roadmap: STNDRD6: SHIFT

SHIFT is a **workout split under the existing `stndr` program**, not a new
program category. Once PL0–PL4 land it requires:

1. the split's own workout page, per the 7-day / station-anchoring standards in `CLAUDE.md`,
2. `python3 tools/apply-head-contract.py` to fit the canonical `<head>`,
3. one program card on `cat-stndr.html`,
4. `meta` `'5 Programs'` → `'6 Programs'` (after PL4's correction to 5).

No `mc-pm-data.js` entry, no `dashboard.html` CSS block, no `PROGRAM_ICONS`
entry — those are per-*program* and `stndr` already has them. `stndr` is
`tier: 'influencer'` inside `MARKET:STRIP influencer-progs`, and
`cat-stndr.html` / `stndr-instructions.html` / `stndr-checkoff.js` are already
in `content-manifest.json`'s `licensed` set, so SHIFT inherits the licensed-
content gating without new markers. Any new page it adds must be added to that
set.

---

## Sequencing note

PL0 and PL1 are prerequisites for PL2 — rolling out first and componentizing
after is exactly how `cat-strength.html`'s accent drifted in the first place.
PL3 should land with or before PL2 so the rollout is gated as it happens
rather than audited afterward.
