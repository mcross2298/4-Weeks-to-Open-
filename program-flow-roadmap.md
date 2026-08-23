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
- **`gainz` / `ks` are two** — `cat-gainz.html` → `bro-split.html`, which
  holds all five days in one accordion. After `F3` that page renders one day,
  so its structure converges on `mc`'s without gaining a file.
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
| 7 | 55–106 | the five `kitchen-sink*.html` |
| 6 | — | `2on-1off`, `mens-lean-bulk`, `mens-shred` |
| 4 | 5 | `mm-p1/p2/p3.html` |

**Four of the 23 are licensed STNDR content** (`legacy-prep`,
`arnold-legacy`, `push-pull-legs`, `weeks-to-open`) — including the two
largest. Accordion work touches the market-stripped set, so
`tools/build-market.py --check` is a gate on this phase, not an afterthought.

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

### `F2` — instructions absorbed into Overview

Fold each `<id>-instructions.html` into its program's Overview tab. The
standalone pages stay as deep-link targets (they are referenced from
`program-guide.html` and the fleet's header links) but stop being the *only*
home for that content.

Governed by the documentation currency rule: whichever surface is canonical,
both must agree after this phase.

### `F3` — one workout, one screen (drop the accordion)

The large one. A training day becomes its own screen; no page renders a second
day's exercises behind it.

**What this phase does NOT touch** (decision 8, explicit owner constraint):
`.ex-card` / `.a-hdr` / `.mcl-*` markup, the five card engines' rendering of an
individual exercise, the set logger, the rest timer, or the meatball menu. A
workout, once opened, looks exactly as it does today. The only change is that
the page renders **one day's** cards rather than every day in the block — and
it does so in the same file, so no new pages are added. The correct
finish-bar denominator (`0 / 30` rather than `0 / 172`) falls out of that for
free.

Sequencing, cheapest-risk first:

1. **`mm-p1/p2/p3`** (4 days, 5 set rows) — small, shared engine, three pages
   fixed by one engine change.
2. **The five `kitchen-sink*`** (7 days) — shared `ks-engine.js`, and they are
   the `check-visual-ratchet` baseline pages, so regressions are caught.
3. **The `freq-split` family** (`2on-1off`, `5on-2off`, `mens-*`,
   `every-*-day`, `lets-get-shredded`, `3on-1off-high-freq`) — one
   `mc-freq-engine.js` change covers eight pages.
4. **`bro-split`, `hv-block`, `iron-engine`** — individually.
5. **The four licensed STNDR pages last**, including the 26- and 21-day
   monsters, with `build-market.py --check` green before and after.

**This phase needs its own `AskUserQuestion` gate before it starts.** It
changes how a session is entered on 23 pages, and `check-journey.js` covers
only 6 of them.

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
