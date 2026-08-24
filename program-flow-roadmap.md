# Program Flow roadmap — `F0–F5`

**Opened 2026-08-23.** Successor to [`program-day-view-roadmap.md`](program-day-view-roadmap.md)
(`D0–D3`, shipped). That plan built the day-by-day module and mounted it on
`cat-strength.html`. This plan corrects **where** it lives, gives the program
page a real landing, and ends the multi-day accordion.

Scratch-listed in `content-manifest.json`, so it never ships to the public
Rolodex build.

---

## Why this exists — the surface mistake

Comparing the reference app's two screen sets shows they are **two different
screens**:

| Reference screen | Contains |
|---|---|
| **Workout tab (home)** | week bar · today's day hero · Exercise library · Workout builder · On Demand |
| **Program landing** (reached via the program-name chevron) | hero art · tier badge · stats · **Overview / Program list** tabs · equipment |

`D0–D3` put the week bar + day hero on `cat-strength.html` — which is the
*landing*. To make room, the Onyx landing hero (`mc-program-hero.js`) was
removed from that page, so the program-identity content had nowhere to go.
One screen was doing two jobs and the identity half lost.

Correcting it also dissolves the rollout problem `D0–D3` left open: mounted on
the dashboard against `mc_active_prog`, the day module is instantiated **once**
instead of ten times, and per-program work collapses to supplying a record.

---

## Decisions locked (AskUserQuestion, 2026-08-23)

1. **The day module moves to `dashboard.html` Home**, driven by
   `mc_active_prog`. It is removed from `cat-strength.html`.
2. **It replaces `#heroCard`.** The day hero is a strict superset of the
   active-program card. `#heroEmpty` (no active program) is untouched.
3. **`cat-*.html` becomes a real landing** with `Overview | Program list`
   tabs. Two additions the owner specified beyond the reference:
   - **Overview must carry the program's own instructions and descriptions** —
     the content that lives in the 10 `<id>-instructions.html` pages today.
   - **Program list is tappable workouts**, per the reference screenshot:
     thumbnail, name, `Day N · NN mins`, completion tick, drag handle.
4. **Custom / owner-published active programs fall back to `#heroCard`.**
   Built-ins get the day module; `mc_custom_programs_v1` programs keep
   today's `run-program.html` route. They have no declared rest pattern and
   inventing one is out of scope.
5. **The accordion is dropped** (owner directive). A training day must be its
   own screen. Today you can be mid-leg-day, scroll, and read Thursday's
   arms workout — clutter the owner called out explicitly, and the same
   structure behind the `S5c-0` completion-count defect.

### Second round (AskUserQuestion, 2026-08-23)

6. **Program list is adaptive** — it renders whatever level a program
   actually has, and drills in only where one exists (see the shape table
   below). The row component is identical at every level (thumbnail, name,
   meta, completion tick), so it reads as one control rather than three
   screens. `cat-strength.html`'s existing, currently-unused `#view-split`
   state is the mechanism.
7. **Drilling into a split shows that split's context** — a slim header
   carrying its name, week/day count and description above the day rows,
   reusing the eyebrow/title/meta block the day hero already has. Those
   descriptions are authored in `mc-pm-data.js` and the `cat-*.html` pages
   and currently render at no level where they help.
8. **`F3` changes no exercise-card markup, and adds no files.** A page that
   holds several days keeps its file, its engine and its `.ex-card` /
   `.a-hdr` markup exactly as they are — it renders only the chosen day's
   cards instead of all of them, with the day picked on the way in from
   Program list. Explicit owner constraint: **the exercise cards are not
   being redesigned.** Only the number of days a page renders changes.
9. **No in-page day switcher.** Rejected deliberately: it would restore a
   route from inside a workout to another day, which is the thing being
   removed — behind a control instead of behind a scroll. Back returns to
   Program list.
10. **Overview carries the full instructions inline** — the entire body of
    each `<id>-instructions.html`, not a summary. `program-guide.html` is a
    fleet-wide index of all programs, so it stays a link rather than being
    duplicated into all ten Overview tabs.

### The `splits` field means three different things

Measured against `mc-pm-data.js` and the real page graph. This is why
"Program list" cannot be one fixed shape:

| Shape | Programs | Real structure |
|---|---|---|
| **Days directly** | `ss`, `pump` | program → day |
| **Sequential phases** | `mm`, `hv`, `stndr`, `psu` | program → phase page → days |
| **True splits** | `mc`, `ks`, `gainz`, `pmc` | program → split → days |

Within the third group the depth still varies, and the roadmap must not
assume otherwise:

- **`mc` is three levels** — `cat-mc.html` → `mc-split1.html` →
  `mc-s1-back.html`. The split page is itself a picker.
- **`gainz` / `ks` are two** — `cat-gainz.html` → `mens-lean-bulk.html`, which
  holds all six days in one accordion. After `F3` that page renders one day,
  so its structure converges on `mc`'s without gaining a file.
  (**Corrected 2026-08-24, F3 scoping:** this bullet named `bro-split.html` as
  `gainz`'s two-level example. It is not reachable from `cat-gainz.html` at
  all — it is linked only from `cat-stndr.html`, while `content-manifest.json`
  attributes it to the **`gainz`** licence. One of those two is wrong and it
  wants its own change; it does not affect either build, since both owners are
  stripped from the Rolodex.)
- **`pmc` inlines its split layer** on the cat page (`#view-split`), the same
  mechanism `cat-strength.html` has but does not use.

---

## Measured scope — not estimated

Run against the real tree in a headless browser (`day-card` counted **after**
render, since most pages build them from JS templates; a static grep finds
only 1 page and is wrong):

- **79 pages** load `mc-setlog.js` (the working definition of "workout page").
- **23 of them render more than one `.day-card` at runtime.** This exactly
  reproduces the count `S5c-0` recorded, from an independent measurement.
- **159 day-cards** sit across those 23 pages.
- **56 pages are already single-day** and need no accordion work at all.

Worst offenders:

| Days | Set rows | Page |
|---:|---:|---|
| 26 | 112 | `legacy-prep.html` |
| 21 | 243 | `arnold-legacy.html` |
| 5–7 | 55–106 | the five `kitchen-sink*.html` (`-s5` is 5 days, not 7) |
| 6 | — | `2on-1off`, `mens-lean-bulk`, `mens-shred` |
| 4 | 5 | `mm-p1/p2/p3.html` |

**Thirteen of the 23 are licensed** — re-measured against
`content-manifest.json` on 2026-08-24 and **not four**, as this section said
until then. Four are STNDR (`legacy-prep`, `arnold-legacy`, `push-pull-legs`,
`weeks-to-open`, including the two largest) and **nine are `gainz`**: all eight
freq-family pages plus `bro-split`. So `tools/build-market.py --check` gates
essentially every step of this phase rather than only the last one, and the
public Rolodex build only ever sees **10** of the 23 pages. The original
sequencing below was ordered on the wrong premise and has been corrected.

Other measured inputs:

- `mc_active_prog` already exists, is synced (`scalarBase`), and already holds
  a full program card — including **custom and published** programs, which is
  why decision 4 is needed.
- `dashboard.html` already has `#heroCard`, `#heroEmpty` and `renderHero()`.
- `mc-pm-data.js` already carries **`forWho`** for all 10 programs — the
  reference's "Who this is for" copy, authored and rendering nowhere.
- 10 `<id>-instructions.html` pages exist, ~136 lines each, already structured
  as `.sec-head` sections — absorbable into Overview without a rewrite.
- `exercise-catalog.js` tags equipment as **7 categories**, not a granular
  hardware list. The reference's "Equipment list (23)" is not derivable; a
  category row is.

---

## Phases

### `F0` — relocate the day module to the dashboard

Move the `mc-week-bar` / `mc-day-hero` mount from `cat-strength.html` onto
`dashboard.html`'s Home, keyed to `mc_active_prog`. `#heroCard` is replaced;
`#heroEmpty` stays. Custom/published programs fall through to `#heroCard`
(decision 4).

`Start Day N` navigates to the day's page — ordinary navigation, which is the
normal case for 10 of 12 programs rather than the awkward one.

**Risk this phase carries:** the dashboard is the app's most-opened screen and
is a `check-contrast` budget page, a `smoke-test-pages` page, and carries the
momentum strip, cross-app Today strip and program rail. Verified live in both
themes before it lands.

### `F1` — the program landing

`cat-*.html` restores `mc-program-hero.js` and gains `Overview | Program list`
tabs. Built as a fourth view state on a page that already has three
(`#view-dashboard` / `#view-split` / `#view-workout`) — same pattern, no new
page, no new architecture.

- **Overview** — `forWho` ("Who this is for"), the workout split (from
  `MC_PROGRAM_PROGRESS.weekFrom()`, already tested), the equipment category
  row, and **the full body of the program's `<id>-instructions.html`**
  (decision 10). `program-guide.html` stays a link.
- **Program list** — tappable workout rows with completion state, the reorder
  affordance that currently hides in the ☰ sheet, and **adaptive drill-in**
  for programs that have a split layer (decisions 6–7).

`cat-strength.html` first — it is the one-level case and needs no drill-in —
then the other nine, with a two-level program (`gainz`) taken early so the
drill-in is proven before the three-level `mc`.

**Split into `F1a` (the component + `cat-strength.html`) and `F1b` (the other
nine pages)**, the same way `S4` was split into engines-then-pages: the
component is one reviewable change and the rollout is nine repetitions of a
config. `F1a` builds the adaptive drill-in in full so `F1b` adds no logic.

#### `F1a` shipped (2026-08-23)

`mc-program-tabs.js` (`MC_PROGRAM_TABS`) + `mc-program-tabs.css`, mounted on
`cat-strength.html`. A pure renderer over `mc-program-progress.js`, same
contract as `mc-day-hero.js` — the caller hands over the record and the block
definition, the component owns no state beyond which group is open.

**The list is data, not markup.** `listModel(cfg, state)` is split out from
rendering and is what `tools/test-mc-program-tabs.js` asserts against (50
assertions, vm-sandboxed against the real source with
`mc-program-progress.js` loaded beside it, so day numbers come from a real
record rather than a fixture of one). Adaptive depth falls out of it: one
group renders its days with no level above them, several groups render the
group rows first and then a slim context header (decision 7) over that
group's days. `F1b` supplies groups; it adds no code.

**Three things came from driving the page, not reading it:**

1. **Reordering appeared to do nothing.** Rows were pinned to the group's
   authored order, so moving Legs down renumbered it to `Day 2` *in place* —
   the numbers changed and the list did not. Rows now follow the week's
   order; unscheduled days (a collection program holding workouts outside the
   block) sort after the scheduled ones, since they have no number to sort by.
   The unit test asserted the old behaviour and was corrected with it.
2. **The equipment row said nothing.** An unweighted set of categories came
   back as *all seven* `MCBiomech` knows — true, and useless. It is now
   ordered by how many exercises use each, with the count, so the row reads
   "Barbell 17 · Dumbbell 9 · Machine 5 …". The counts lean toward Barbell
   because that is `equipOf()`'s fallback for an unmatched name; that is the
   same inference the substitute picker already trusts app-wide, so it is not
   a new trust decision, but it is why the row shows proportions rather than
   claiming an inventory.
3. **The hero and the Overview said the same thing twice.** The full hero
   variant renders a stat strip and a 7-day schedule strip whose training days
   are just "the first N cells" — an invented pattern. Overview now carries
   both from the real record, with actual day names and completion state, so
   the hero moved to `variant:'trimmed'` and keeps only what is uniquely its:
   art, tier, name, tagline, "What's inside" and the CTA (wired to open
   Program list, rather than the trimmed default's scroll-to-next-sibling,
   which would land on the tab you are already on).

**Two things were fixed rather than worked around.** `mc-surprise.js`'s
`isEnabled()` required an `onclick` attribute, which excluded every control
wired by a delegated listener — so Surprise Me would have silently hidden
itself on this page. A real `<button>` now counts as clickable, which is how
the app's newer components are built. And `mc-program-menu.js` gained a
`view` option so the list's "Reorder days" opens straight into the reorder
sheet; reorder itself is **not** reimplemented — that sheet is already
keyboard-operable and backed by `reorderWeek()`, per the single-implementation
rule.

**A CI gap found on the way:** `tools/test-mc-program-progress.js` shipped
with `D0–D3` and was never added to a workflow, so its 68 assertions had not
run in CI once. Wired into `verify.yml` alongside the new test.

**Documentation currency:** `quick-tour.html`'s "day-by-day schedule" module
still told the athlete they land on their current day when they open the
program — `F0` moved that to Home and did not update the tour. Corrected, and
a new "The program page" module added for the tabs. `ss-instructions.html`
had the same `F0` staleness plus no mention of the landing; both fixed.

#### `F1b` shipped (2026-08-23)

The other nine landings, plus the Onyx hero rollout that has been pending
since `program-landing-handoff.md`. Every `cat-*.html` is now one pattern.

**Three decisions taken with the owner first**, because the measured shape of
the nine was not what this roadmap assumed:

1. Only `ss` has a `schedule` record, so for the other nine the list has no
   day numbers, ticks or reorder until `F5`. Shipped as a plain tappable list
   rather than held back; `F5` lights up progress with no further page edits.
2. `cat-hv` and `cat-psu` link to exactly ONE workout each, so they get
   Overview alone (`list:false`).
3. The hero rollout is taken alongside.

**The measurement that reshaped the phase:** every landing is a **flat list of
destinations** — the drill-in lives one page further in for most programs, not
on the landing. So `F1b` is mostly one group per page. Three pages do have a
real group level and use it: `cat-gainz` (its own three authored section
headings), `cat-pmc` (built from the page's own `SPLITS` data, so the two
cannot drift) and `cat-pump-new4` (five splits).

**Two accordion layers disappear as a side effect** — `cat-pump-new4`'s five
collapsible modules, and the `<details>` "other splits" drawers that hid most
of each program on `cat-gainz`/`cat-mm`/`cat-ks`/`cat-mc`/`cat-stndr`. Both
become navigation, with one level on screen at a time. That is `F3`'s
principle arriving early on the landings, not in the workout pages.

**Component:** `list:false` renders Overview with no tab bar; `mount()` builds
**no** progress record when no `def` is passed, rather than letting
`normalize()` invent a 7-day 2-rest week and render it as the program's real
schedule — the same "invented pattern" that retired the full hero variant in
`F1a`. Eight new assertions cover it (58 total).

**Caught before shipping, by assertion or by driving:**

- All four flat pages carried an `MC_SURPRISE` selector pointing at cards this
  change removes — Surprise Me would have silently hidden itself on each.
- On a list that opens at the **group** level, no `[data-mpt-day]` row is in
  the DOM until a group is opened, so the same button hid itself on
  `cat-gainz`, `cat-pmc` and `cat-pump-new4` too. `mc-surprise.js`'s existing
  `group` option is exactly for this and is now used.
- **`cat-ks` lists six splits, not five**: Split 2 is `cat-ie.html`, which a
  "not a `cat-*` page" filter silently dropped. That reconciles the page's own
  "6 Splits" badge with its links.
- `cat-psu` has no `psu-instructions.html` — the one program with no guide
  page — so it links only the fleet-wide index.
- `cat-pmc` carried BOTH the Onyx hero and its own `<h1>`, a duplication only
  visible once the whole fleet used one pattern.

**Known, not fixed here:** the pages keep their own `← Programs` back link
below the hero, which has a back chevron of its own — two back affordances.
Removing the page-level one interacts with the smart-back-nav script that
rewrites those `<a>`s, so it wants its own change rather than a drive-by.

**Known, not fixed here (pre-existing, verified against `main`):** opening a
workout on `cat-strength.html` leaves **no card active** — 8 meatballs render
and 0 are visible, because every card sits collapsed to its `.mcl-strip`
(`S5b`/`R3`) and `S3`'s auto-activate never fires on this page's engine. On
`mm-p1.html` and `pmc-back.html` exactly one card is active on load, as
intended. So the ⋯ menu is unreachable here until the athlete opens a card by
hand. Confirmed by stashing this branch and re-measuring on `main`, so it is
not an `F1` regression — `F1` touches nothing inside `#view-workout`. It wants
its own change.

**Not in `F1a`, deliberately:** decision 10 (the full `<id>-instructions.html`
body inlined into Overview) is `F2`'s phase, and Overview carries a real
entry point to the guide until then. Worth knowing before `F2` starts: all
eleven instruction pages share one class vocabulary (`sec` / `sec-head` /
`card` / `card-head` / `card-body` / `rule-box` / `fav-row` / `rep-card`),
so one prefixed stylesheet covers the fleet — but those names collide with
the vocabulary the `cat-*.html` pages already use, so the absorbed markup has
to be re-prefixed rather than injected raw.

### `F2` — instructions absorbed into Overview

Fold each `<id>-instructions.html` into its program's Overview tab. The
standalone pages stay as deep-link targets (they are referenced from
`program-guide.html` and the fleet's header links) but stop being the *only*
home for that content.

Governed by the documentation currency rule: whichever surface is canonical,
both must agree after this phase.

#### `F2` shipped (2026-08-23)

**"Both must agree" became a build gate rather than a promise.**
`tools/build-instructions.py` extracts each guide's `<div class="max-w">` body
and its `<style>`, and emits `<id>-instructions.gen.js`
(`window.MC_INSTRUCTIONS = {id, css, html}`). The guide page stays the one
authored source; the embed is a generated artifact with a `--check` gate, the
same generate-and-verify pattern as `build-sw.py`, `gen-program-css.py` and
`apply-head-contract.py`. Nine landings load it; Overview renders the body
inside `.ovi` and drops its now-redundant "Program guide →" link.

Two alternatives were **ruled out by measurement, not preference**:
hand-copying (two copies of nine guides, drifting from the first edit), and
fetching the guide at runtime — elegant, one source, except the instruction
pages are **not in `sw.js`'s precache**, so the guide would silently vanish
offline for anyone who had not already opened that page.

**The collision the generator exists to solve.** The guides and the landings
share a class vocabulary — `card`, `card-body`, `sec`, `rule-box`, `fav-row`,
`rep-card` — and mean different things by it. Injecting the markup raw would
inherit the host's styles and render as garbage. So the guide's own stylesheet
travels with it, every selector rewritten under `.ovi`. That is why a guide
gaining a new class needs no work here: regenerate and it is covered. Two
things had to be right for that rewrite to hold, and only one was obvious:
`html[data-theme="light"] .card` must become `html[...] .ovi .card`, not
`.ovi html[...] .card`; and **CSS comments are part of a rule's prelude**, so
the `/* SAND LIGHT MODE */` banner five guides carry in front of their light
block glued itself onto the selector — the theme rewrite stopped matching and
the `body` drop stopped firing, producing `.ovi /* … */ html[…] body` on five
of the nine. Caught by reading the generated output, which is why it is
committed rather than built at deploy.

**Five guides had no light mode at all, and embedding would have exposed it.**
`mc-light.css` themes the page shell fleet-wide (`body`, `.hero`, `.title`,
`.sec-head`), which is why those pages looked broadly right and nobody had
filed it — but it knows nothing of each guide's own card vocabulary. Measured
on the real pages: `.card` sat at `rgb(26,5,5)` and `.card-head` at pure white
**on a cream page**. Embedded, that is a black slab inside the landing. All
five gained a light block, their contrast budgets fell 4/10/6/4/5 → **0**, and
each rule was verified to change a real computed value before it shipped: a
first draft also restated `body`/`.hero`/`.eyebrow`/`.sec-head`/`.back-link`,
and a before-and-after computed-style diff showed every one of those losing
the cascade to `mc-light.css` — dead CSS that reads exactly like working CSS,
so they were cut.

**One real regression, found by the ratchet and fixed at the seating layer.**
`.sec-head` is in both vocabularies, and `html[data-theme="light"] .sec-head`
(0,2,1) from `mc-light.css` outranks the generated `.ovi .sec-head` (0,2,0) —
so every embedded heading rendered in the *landing's* raw accent, which on the
lime-accented program is **1.77:1 on Sand**. There is no "leave the embed
alone" option when the host is already restyling it, so `.sec-head` inside
`.ovi` now takes `--mpt-accent-text`, already darkened to clear 4.5:1.

Two smaller findings: the generated set is driven by the `<script>` tags that
load it, not by the set of guide pages — `cat-faint.html` predates the F1 tabs,
so its embed was generated, precached, and loaded by nobody until `--check`
learned to report orphans. And three guides are **licensed content**;
`build-market.py --check` caught their `.gen.js` copies leaking into the public
build before the first push, and they are now listed in `content-manifest.json`
beside their source pages.

Net effect on the landings the embed touched: five contrast budgets improved
(two from 20 to **0**), no page scrolls sideways, and no console errors on any
of the nine.

### `F3` — one workout, one screen (drop the accordion)

The large one. A training day becomes its own screen; no page renders a second
day's exercises behind it.

**What this phase does NOT touch** (decision 8, explicit owner constraint):
`.ex-card` / `.a-hdr` / `.mcl-*` markup, the five card engines' rendering of an
individual exercise, the set logger, the rest timer, or the meatball menu. A
workout, once opened, looks exactly as it does today. The only change is that
the page renders **one day's** cards rather than every day in the block — and
it does so in the same file, so no new pages are added.

~~The correct finish-bar denominator (`0 / 30` rather than `0 / 172`) falls out
of that for free.~~ **Struck 2026-08-24:** `S5c-0` already banked it by scoping
both counters to the open day — see the gate findings below. `F3` stands on the
UX and DOM-weight case alone.

#### Gate cleared (`AskUserQuestion`, 2026-08-24)

The gate this phase required is closed. Three things were decided, and the
scoping run that fed them corrected four numbers this document was carrying
(see **Measured scope** above, and the two findings below).

11. **The accordion becomes a tappable day list that drills into the exercise
    cards.** A page opens as a list of its days and nothing else; tapping a day
    renders that day's cards; Back returns to the list. `?day=N` deep-links
    straight past the list, so an entry point that already knows the day never
    pays for it. This is the same "one level on screen at a time" move `F1b`
    made on the landings, one page further in — and it needs no landing change
    and no day-name duplication, which the alternative (enumerating each page's
    days in `cat-*.html` config) would have cost on 23 pages.
12. **Sequencing is reordered by measured risk**, not by the original
    cheapest-first guess (below).
13. **`check-journey.js` is extended before any page changes**, as its own
    step, so the gate that protects a session exists before the 23 pages move.

#### What the scoping run found

- **The accordion is already one-day-at-a-time — visually.** All 23 pages share
  one DOM contract (`.day-card > .day-header`), engine-rendered and
  hand-written alike, and **every one already has exactly one day `.open` at
  load**. The defect is not that other days are *shown*; it is that they are
  fully *built*. **83% of day-card DOM belongs to days the athlete is not
  training** (47,761 nodes across the 23, 8,306 in the open day).
  `arnold-legacy` holds 243 set rows, 17 of them in the open day.
- **The "free" denominator win is already banked.** This section claimed the
  correct finish-bar count falls out of `F3`. It does not — `S5c-0` already
  scoped both counters to the open day. Measured on `main`: `mm-p1` reads
  `0/43` and the 26-day `legacy-prep` reads `0/33`, not `0/172`. **`F3` stands
  on the UX and DOM-weight case alone.**
- **Three day-opening mechanisms, not one.** The eight freq pages already
  re-render the whole page on every toggle (`openDayIdx = n; render()`) and
  carry **no set logger at all** — `.ex-item` checkbox rows, zero `.sl-ck`. The
  three `mm` pages toggle `display:none` on a prebuilt div. The remaining
  twelve toggle a CSS class only. `legacy-prep` is the re-render shape too.
- **Five hand-written pages carry near-identical toggle bodies**
  (`bro-split`, `iron-engine`, `arnold-legacy`, `push-pull-legs`,
  `weeks-to-open`) — the same clone pattern `check-single-impl.js` exists to
  catch, in markup it does not police.
- **`F3` collides with `A-14`.** Rendering one day means `mc-setlog` builds
  only that day's loggers — `A-14`'s outcome arriving through this door, and
  inheriting the restore-on-build problem `S5c-0` left open. A session resumed
  mid-day must land back on its day: `mc-session.js` already reopens a day by
  simulating a `.day-header` click (`S3`), engine-agnostically, but it finds
  the card by scanning the DOM. **The day list must therefore stay in the DOM
  as rows**, which the tappable-list design gives for free — this is a
  constraint on the design, not an afterthought.

#### Sequencing (corrected)

The original order below was "cheapest-risk first" on the belief that only the
last step touched licensed content. With 13 of 23 licensed that premise is
gone, and the genuinely cheapest step is the one it placed third.

0. **Extend `check-journey.js` first** (decision 13) — done, see below.
1. **The eight freq pages** (`mc-freq-engine.js`) — one engine, already
   re-renders on toggle, and **no set logger to break**, so a third of the
   scope carries none of the `A-14` risk. Proves the pattern before it meets a
   page with real loggers.
2. **`mm-p1/p2/p3`** — one engine change, three pages, journey-covered.
3. **The five `kitchen-sink*`** — one engine, and the `check-visual-ratchet`
   baseline pages, so regressions are caught by pixel diff as well.
4. **`iron-engine`, `hv-block`, `bro-split`** — the hand-written shapes.
5. **The four licensed STNDR pages last**, including the 26- and 21-day
   monsters, with `build-market.py --check` green before and after — as it must
   be from step 1 now, not only here.

#### `F3-0` shipped (2026-08-24) — the journey gate, extended first

`check-journey.js` drove **6** pages, of which only **3** were multi-day
(`mm-p1`, `2on-1off`, `kitchen-sink-s3`) — the other three are single-day, so
this document's "covers only 6 of them" overstated it. Combined with the five
`kitchen-sink*` visual baselines, **7 of the 23 pages had any behavioural or
visual coverage and 16 had none.**

The tool's page table now covers **shapes, not engines** — the three
hand-written day-opening mechanisms no engine represents were added:
`iron-engine.html` (the five-page clone family, and the only member of it that
is not licensed), `hv-block.html` (inline `onclick`), and `legacy-prep.html`
(re-render, and the largest page in the tree at 26 days / 163 exercise cards,
so it is where a per-day change fails first). 9/9 journeys clean.

**A real hole was found in the tool while verifying it.** The runtime
safe-area pass bails when no cards can be revealed — and bailed by returning
`skipped: null`, which the summary counts as **clean**. A page that revealed
nothing reported "inset pass clean" while asserting nothing at all. It never
went wrong in practice because the main pass fails loudly on an unrevealable
page, but `F3` changes precisely that reveal path on 23 pages, which is the
moment it would have started lying. It now bails as a named skip, and a
partial skip prints which page dropped out and why. This is the same class of
defect as the one recorded at the top of this file about the safe-area source
check testing its own override.

#### `F3-1` shipped (2026-08-24) — the eight frequency pages

The first page family converted, and the one the corrected sequencing put
first because it carries the least `A-14` risk. `mc-freq-engine.js` renders a
day **list** — tappable rows, no `.ex-item` built — and opening a day renders
that day alone with an `← All days` button. `?day=N` deep-links past the list.

**Each page's own `render()` is untouched.** It still maps every day through
`renderDay()`; `renderDay()` returns a row in list mode and `""` for days that
are not open, so the eight page files needed only two one-line edits each (the
`?day=` init, and a hint line that now has two states). New CSS went into
`gainz-dark.css`, which exactly these eight pages load and nothing else — no
new file, per decision 8.

**A correction this step forced.** The `F3` gate notes recorded that this
family "carries no set logger at all". That is wrong: `mc-setlog.js`'s unit
selector includes `.ex-item`, so it builds a `.mcl-strip` on every row here.
`.sl-ck` measured 0 only because strips render collapsed. This family did
carry the restore risk, and the sequencing rationale was weaker than stated —
though still correct on the other counts (one engine, already re-renders on
toggle).

**Two real defects, both found by driving rather than reading:**

1. **`?day=99` rendered a completely blank screen.** The guard checked only
   the lower bound, so `openDayIdx` became 98, every `renderDay()` returned
   `""`, and the page had no rows, no day and no way back — while the comment
   above it claimed it fell back to the list. Now clamped to the real day
   count, which each page has in scope as `DATA.days`.
2. **The session stopped being recorded at all.** `mc-session.js`'s `init()`
   returns early when no `.ex-card, .ss-ex, .ex-item` exists at load — "not a
   workout page". On a day list there are none, so its MutationObserver was
   never wired and `save()` never ran: sets reached `mc_setlog_v1` while
   `mc_session_v1` stayed empty, which also costs the dashboard its resume
   banner. **This is the `A-14` hazard `S5c-0` flagged, arriving through `F3`'s
   door on the very first family** — and it will recur on every remaining
   step, so it was fixed generally: a page that HAS day cards but has not
   rendered one yet is now *deferred* rather than rejected, re-running `init()`
   off `MC_SCAN` (the shared "cards just rendered" signal from `S5a`) when the
   first card appears. Pages with neither cards nor day cards still return
   immediately, so the other 70-odd pages are unaffected.

**It fixed a pre-existing bug as a side effect**, measured against `main` on
the same page: log a set and reload, and on `main` the day reopens with the set
**gone** (`0 / 38`, `.mcl-ck.done` = 0). On this branch, reopening the day
restores it correctly (`1 / 38`, the strip reads `1/5 Sets`) — because the
cards now render *after* session init rather than before it, so
`restoreSets()`'s poll actually finds the rows.

Verified on all eight pages at 320 and 390: rows ≥ 70px, the Back control
exactly 44px, no horizontal overflow, zero console errors, and per-day finish
denominators (`0/30`–`0/42`). List-mode DOM falls to ~237 nodes from ~830.
`check-journey` 9/9 clean; `2on-1off`'s at-rest chrome drops 13.4% → 6.9%
because the session toolbar correctly no longer shows on a picker screen, and
its budget is re-baselined to match. Guide updated (`gainz-instructions.html`)
and its `F2` embed regenerated.

#### `F3-2` shipped (2026-08-24) — the Modality Matrix trio

`mm-engine.js` (`mm-p1/p2/p3`) converted. Same shape as `F3-1` — a day list of
tappable rows, one workout per screen, `← All days` back — but a different
mechanism underneath: this engine toggled `display:none` on a **pre-built**
panel, and it drives real `.ex-card` markup through the full `mc-setlog`
logger rather than the lighter `.ex-item` rows.

**The Back control and row treatment moved into `base.css`.** `F3-1` put them
in the stylesheet its eight pages exclusively share, which was right for one
family and wrong for five: `F3` needs this control on 23 pages across every
engine. They are now `.mc-day-back` / `.mc-day-row`, defined once, accent-neutral
(reading `--accent`), and the first family's sheet keeps only the token
overrides that give it its own brand colour. Same reasoning
`tools/check-single-impl.js` enforces for shared JS helpers.

**Three day types, three behaviours.** A **rest** day has nothing to drill
into, so it stays the compact informational card it already was and appears in
the list only — never a destination. A **conditioning** day is a row that opens
its Conditioning Corner panel. A **training** day opens the full card stack.
Both openable types route through the same `toggleDay`/`toggleCond` the
headers' inline `onclick` already called, so there is no second code path.

**The week tabs stay on both screens**, deliberately. Decision 9 rejects an
in-page DAY switcher; the week is not another day, it is the same day's
prescription. Verified live: switching week from inside an open session
re-renders that session on the new scheme and the theme bar follows
(`Week 3 · Tempo` → `Week 5 · Superset`).

**A defect found by driving, and its cause was not where it looked.** The day
list overflowed horizontally (395px in a 390px viewport) — and the overflowing
element was PROGRAM SUMMARY, which this change never touched. `mc-summary.css`
hides `.sum-section` behind `body.mcs-stat-active`, a class `mc-summary.js`
only adds once `buildStatBar()` finds exercise cards. On a day list there are
none, so the rule never applied and the block summary rendered **fully
expanded** — a readout that on `main` is correctly tucked behind the summary
control, exposed here purely because the cards moved. It is now hidden on the
list and left entirely alone in day mode, where `mcs-stat-active` governs it as
before; `renderSummary()` re-applies the same rule, because the page calls it
after `MM.init()` and a `?day=N` deep link would otherwise land in day mode
with the summary still showing. **This is the same shape as `F3-1`'s
`mc-session.js` bug** — a module keying off "are there cards at load" — and it
is the third such module found. Any remaining `F3` step should check for a
fourth rather than assume.

`?day=N` (clamped, and rest days rejected) and `?week=N` both deep-link;
`?day=99` falls back to the list rather than the blank screen `F3-1`'s first
draft produced.

Verified on all three pages at 320/390/430: rows ≥ 70px, Back exactly 44px, no
overflow, zero page errors, `0/43` per-day denominators. Session round trip
holds — log a set, reload, reopen the day, and it restores (`1/43`, strip reads
`1/5 Sets`), on `F3-1`'s `MC_SCAN` deferral with no further change.
`check-journey` 9/9; `mm-p1`'s at-rest chrome drops 13.4% → 6.9% (session
toolbar correctly absent from a picker) and its budget is re-baselined.
**Runtime measured, not assumed:** DOM 2082 → 313 elements on the list and 761
in an open day, `querySelectorAll` 302 → 122/s — the perf budget passes with
room. Guide updated (`mm-instructions.html`) and its `F2` embed regenerated.

**Known, not fixed here (pre-existing, verified on `main`):**
`tools/measure-session.js` reports `timer confirmed running: false` on
`mm-p1.html` — its rest-timer probe does not actually start a timer on this
page, so that column measures idle rather than the timer load it names. It
reads identically on `main`, so `F3` did not cause it, but it means the perf
gate is weaker on this page than it appears and it wants its own change.

#### `F3-3` shipped (2026-08-24) — the five Kitchen Sink pages

`ks-engine.js` converted. Same day list + one-workout-per-screen shape as
`F3-1`/`F3-2`, and the third distinct mechanism: this engine already rebuilt
`#app` on every week-tab change, so the list/day split rides the render path it
already had.

**Every day type is a destination here**, unlike the Modality Matrix trio where
a rest day is a list-only card. That is a difference in the **data**, not a
change of mind: these `rest` and `activerest` days carry three authored
recovery rows each (the Weekly Layout Standard's info-card panels), so there is
something to open. A day with nothing behind it should not be tappable.

**The day-type chrome was collapsed into one table.** `renderDay()`'s four
branches each carried their own literal session name, icon, colour and rgb
triple. A row and the card it opens now both read `dayChrome(day)`, so they
cannot disagree about what a day is called or what colour it is — the same
class of drift `check-single-impl.js` exists to prevent, in markup it does not
police. Two dead `const rgb` locals fell out of that and were removed.

**The fourth "cards at load" module — found, and fixed once for the fleet.**
The `F3-2` notes above said to look for a fourth rather than assume there
wasn't one. There was, and it is `mc-summary.js` again through a different
door: all five Kitchen Sink pages carry a **pre-authored** `<div
class="sum-section">` in their HTML (the Modality Matrix builds its own at
runtime), so on the day list it rendered fully expanded and cost **631px** of
page height. Rather than patch a third engine, the rule now lives in the module
that owns the summary: `recompute()` hides `.sum-section` when there are no
exercise cards and restores it when a day opens. That covers pre-authored and
auto-built sections alike, fixes `F3-2`'s case generally, and **`F3-2`'s
engine-level workaround was deleted** — verified with no flash, sampling at
600ms as well as settled. Every remaining `F3` family gets it for free.

`?day=N` and `?week=N` deep-link, both clamped; `?day=99` falls back to the
list. The cycle tabs stay on both screens, same reasoning as `F3-2`. The
structure legend (①–⑩ position key) shows only in day mode, where the positions
it names actually exist.

Verified on all five pages at 320/390/430 — rows ≥ 70px, Back exactly 44px, no
overflow, zero page errors, `0/39`–`0/40` per-day denominators — plus every day
type opened and closed individually on `kitchen-sink.html`, and a session round
trip (log a set, reload, reopen the day, `1/40` restored, strip reads
`1/4 Sets`). An occlusion pass scrolled every row to centre and hit-tested it:
zero occluded. `check-journey` 9/9; `kitchen-sink-s3`'s at-rest chrome drops
13.4% → 6.5% and its budget is re-baselined.

**The visual ratchet re-baselined, which is the point of these five pages being
its baselines.** Page height 2973 → 1108px (`-63%`) at 390, and the same on all
five. The diff was inspected before re-baselining rather than after: the new
baseline is the day list rendering correctly, nothing else moved. Guide updated
(`ks-instructions.html`) and its `F2` embed regenerated.

### `F4` — the day-identity contract

With one workout per screen, a day page can finally name itself. Publish
`MC_PROGRAM_DAY.current() → {prog, week, position}` so
`mc-program-progress.js` can attribute a completion without the cat page being
open.

It must be a **function, not a constant**: on multi-week pages the week is live
state (`mm-engine.js` owns `currentWeek`), not a property of the file. This is
the same root cause as the `D0` finding — every `MC_PID_OVERRIDE` consumer
captures at module load, so a static declaration would be read too early.

`F4` is what unlocks the day module for programs beyond `ss`.

### `F5` — fleet rollout

Supply a progress record per program and let the dashboard module drive them
all. Per `D0–D3`'s own findings, `hv` and `mm` are genuine block programs and
fit; `mc` (5 splits, 23 workouts) and `ks` (6 splits) are **collections, not
schedules** — they keep the picker, and forcing a "Day 8" onto them would
invent a structure the program does not have.

---

## Non-goals

- **No new `prog-*.html` pages.** `cat-*.html` is already the landing; ten new
  files would duplicate it and add ten head-contract, script-manifest,
  precache and market-build entries for nothing.
- **No badge/achievement engine.** Still no data source; the hero's banner
  slot stays empty.
- **No photography.** Program-list thumbnails use the accent-art treatment
  (`--mdh-art-base`), same constraint as `D0–D3`.
- **No granular equipment list.** Categories only, until that data is authored.
