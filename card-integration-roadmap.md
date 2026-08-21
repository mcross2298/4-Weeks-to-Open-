# Card Integration Roadmap — S0–S6

**Status:** in progress · **Opened:** 2026-08-19

Governs the merged execution of two audits taken on the same day against the
same page (`mm-p1.html`), which turned out to be the same subject measured on
two different axes:

- **the runtime waste audit** — TIMWOODS, 16 findings, 17 actions `A-1…A-17`,
  measuring *work per second* during an active session;
- **the card UX council report** — 5 recommendations `R1…R5`, 4 phases,
  measuring *pixels per exercise* on real iPhone viewports.

Full integration review, interaction register and per-item apply order:
<https://claude.ai/code/artifact/82d23f33-d8ee-4722-bcc0-b6b5cffbde9b>

Per the planning rule at the top of `CLAUDE.md`, that artifact plus this entry
are sufficient direction to implement S0–S3; S4 carries an `AskUserQuestion`
gate and S5 needs explicit owner sign-off.

---

## Why they had to be merged

Seven proposals collide. The three that changed the plan:

1. **`R4` deletes `.a-reps`** — the container of the `.a-rep` spans whose
   no-op class writes were `A-1`'s target, and a live set-by-set progress
   indicator (`.a-rep.live`, with its own reduced-motion rule and light-theme
   palette) that the UX report assessed as a static restatement of "5×5"
   because at rest that is what it looks like. Emitted by `mm-engine.js` and
   `mc-pmc-engine.js`, so the blast radius is fleet-wide, not per-page.
2. **`A-7` gates `R3`.** `restoreSets()` writes `.done` classes without
   calling `updateCount()`, and `updateCount()` is the only writer of the
   collapsed strip's set count. Today that is cosmetic — the strip only
   appears on finished cards. Under `R3` the strip becomes the resting state
   of every card, so a mid-session reload would leave nine of ten cards
   reading `0/5 Sets`.
3. **`R3` and `A-14` are one change.** `R3` hides siblings in CSS, so it buys
   the height win and none of the runtime win; `A-14` defers the build, so it
   buys the runtime win and no height change for the open day. Fused: *a
   collapsed card is a card whose logger has not been built yet.*

## Decisions (locked 2026-08-19)

| # | Question | Decision |
|---|----------|----------|
| 1 | Does `.a-reps` stay? | **Keep it, shrunk** — collapse into the header pill's slot rather than delete, so the live glow survives at a smaller size. Take `A-1`'s guard regardless; it also serves `.ss-ex` superset units. |
| 2 | Reverse the no-accordion decision (`base.css`)? | **Yes** — but only fused with `A-14`, and only after S2. The original call was made when a card was ~150 px; it is 328 px now. |
| 3 | Which store is authoritative for set history? | **Keep the `workout_logs` rows; drop `mc_setlog_v1` from the sync whitelist.** Rows already carry per-set granularity, and localStorage stays the system of record either way. |
| 4 | Ghost prefill vs the light-mode contrast ratchet | **Carry the ghost state on the dashed underline and italic**, opacity no lower than the ratchet's floor. A prefill the athlete cannot read is worse than no prefill. |

## Sequence

`mc-setlog.js` is edited in five of the six code steps, and `mc-setlog.css`,
`mc-rep-progress.js` and `mc-session.js` in three each — so this runs as one
serial chain, one PR at a time. The only contention-free items (`A-6`, `A-9`,
`A-5`, `A-12`) can float.

| Step | Contents | Gate | State |
|------|----------|------|-------|
| **S0** | `tools/measure-session.js` + committed baseline | none | ✅ shipped |
| **S1** | `A-1` `A-2` `A-3` `A-4` `A-6` + `R1` `R5` | none | ✅ shipped |
| **S2** | `A-7` `A-10`+§3.3 `A-5` `A-8` `A-9` | none — **gates S5** | ✅ shipped |
| **S3** | `R2` + the self-opening logger (`A-11`/`M-1`/§3.4) | none | ✅ shipped |
| **S4a** | `R4` header, shared component + all 5 engines (39 pages) | `AskUserQuestion` | ✅ shipped |
| **S4b** | `R4` on the 17 hand-written pages; old `.a-top` deleted | none — S4a's gate covers it | ✅ shipped |
| **S4c** | `A-17` `defer` sweep — investigated in full, **DROPPED** | owner decision, 2026-08-21 | ❌ dropped |
| **S5a** | `A-13` render signal — migrate onto `MC_SCAN` | signed off | ✅ shipped |
| **S5b** | `R3` collapse-by-default (`A-14` split out) | signed off | ✅ shipped |
| **S5c-0** | completion accounting off DOM counts — **live bug fix**, unblocks `A-14` | none | ✅ shipped |
| **S5c** | `A-14` lazy build — blocked until S5c-0 lands | needs S5c-0 | blocked |
| **S6** | `A-15` CI budget, `A-12` vendored SDKs, `A-16` delta sync | none | |

### Ordering rules this encodes

1. **Delete before you optimise.** `R1` removes a per-card injection from the
   same loop `A-4` memoises.
2. **Measure between `A-1` and `A-2`.** They attack the same feedback loop from
   opposite ends; landed together, neither can be attributed, and `A-15`'s
   thresholds depend on knowing.
3. **Persistence before presentation.** `A-10` defines the stored shape;
   §3.3's ghost is a state that must never reach it.
4. **Budgets last, seeded from measurement.** A gate seeded from ambition
   fails on the first honest PR and gets disabled.

### Naming

`A-13` is the **render signal** (`mc:cards-rendered`), *not* "the render
contract" — that name already belongs to the completed Volume II Phase 4
initiative that collapsed six `makeRestTimer` bodies onto one implementation
(commit `242c9f5`). Reusing it would make the history unreadable.

---

## S0 shipped (2026-08-19)

`tools/measure-session.js` — one harness for both audits' questions, because
they share a page load, an interaction script and (at S6) a CI budget.
Counts mutation records **as delivered to the app's own observers** rather
than as emitted by the DOM: one attribute write reaching eleven body-scoped
observers is eleven units of work, and that ratio is what this sequence
attacks. Sampled in an explicit window with an idle control window on the
same page, so boot cost never leaks into a steady-state number.

Reproduced both audits' published figures before any change: 3,607 elements
and 172 set rows built at load with zero cards visible; a 595.9 px active card
(71% of 390×844, 89% of the 375×667 SE floor); the five sub-44 pt controls.

## S1 shipped (2026-08-19)

| per second, rest timer running | before | after | |
|---|---:|---:|---|
| mutation records delivered | 2983.8 | **35** | −99% |
| observer callbacks | 55.4 | **14** | −75% |
| `querySelectorAll` | 1061.6 | **289.9** | −73% |
| `localStorage` reads | 1927.3 | **26** | −99% |
| controls under 44 pt | 5 | **0** | |
| elements at load | 3607 | **3327** | −280 |

`A-1` landed and was measured alone first: **−98% of records on its own**,
confirming the feedback-loop diagnosis rather than assuming it. `A-2` took a
further −37% of what remained.

`A-3` rewrote two persistence-key functions, so the new and old algorithms
were compared card-by-card in a browser before landing — **identical output on
216 cards across 9 pages**.

**Honest cost:** the active card grew 595.9 → 624 px and the inactive card
328 → 341.6 px. `R5` spends height by design; S3/S4/S5 repay it. An
accessibility defect does not wait for a density win.

**Still open, as expected at this stage:** typed weights remain volatile until
the checkbox is tapped (`D-5`) — reproduced during verification, fixed in S2.

## S2 shipped (2026-08-20)

`restoreSets()` wrote `.done` classes directly and never called `updateCount()`
— after a reload, checkmarks were right and every derived readout (badge,
collapsed-strip count, the `.checked` mirror) was stuck at the pre-reload
value. Fixed by exposing `window.MCSetlogUtil.updateCountByCard()` from
`mc-setlog.js` and calling it per touched card from `restoreSets()`.
**Verified live**, not just read: logged 2 of 5 sets, reloaded — badge read
`2/5` (was `0/5` before the fix), rows and strip count all correct.

`A-10` + the §3.3 ghost prefill shipped as one change, in the order the
sequence specified — persistence before presentation, so the ghost state
could be verified as never reaching the pending store. A typed-but-unchecked
value now persists to a new `mc_setlog_pending_v1` store on blur and restores
on reload as a real value; a suggested-but-untouched value renders as the
input's actual value (not just a placeholder) styled `.mcl-ghost` — muted
color, italic, dashed border, chosen over literal opacity because opacity
would have refaded the touch target R5 just enlarged. Checking a still-
ghosted row solidifies it without requiring a keystroke, per spec. Unchecking
re-arms the pending snapshot from whatever is actually in the fields.
**Verified live**: an untouched ghost blurs with zero pending writes; a typed
edit clears the ghost class on the first keystroke and persists on blur;
after a reload the typed value returns as a real, non-ghost value.

`A-5` gave "Exit & discard" — previously zero-confirmation, no-undo, and the
single most destructive control in the app (D-2) — a `confirm()` naming the
exact set count, plus a recoverable path. The interaction register's call
was correct: `discard()` ends by navigating to `dashboard.html`, so an
in-memory Undo toast (`applySwap()`'s pattern) cannot survive it. Instead
`mc-finish.js` snapshots the removed `mc_session_v1`/`mc_setlog_v1` slices to
`mc_discard_snapshot_v1` before wiping, and `mc-resume.js` (already the
dashboard's session-banner module) offers a "Restore discarded workout"
banner from it — dropped silently if a newer session already exists for that
page, so a stale snapshot can never clobber real progress. **Verified live,
full round trip**: 3 sets logged → discard cancelled leaves everything
untouched → discard confirmed wipes both stores and writes the snapshot →
dashboard shows the banner with the right name and count → Restore navigates
back and both stores return byte-identical to what was removed → the
snapshot clears. The local/cloud divergence D-2 also named — checked sets
write to Supabase `workout_logs` independently of Finish/discard, so a
discarded workout used to leave server-side rows for local history that no
longer existed — is closed with a new `MC_SB.deleteSessionLog()`, scoped to
exactly the discarding page-load's session id.

`A-8` rekeyed `mc-live-tracker.js`'s wake lock off a new `TMR.isRunning()`
(`startTime != null`) instead of probing `#timerFloat`'s `.visible` CSS
class — that class is only ever set under the List rest view
(`applyRestView()`), so Video view's screen never stayed awake and its
catch-up alert never armed, despite a rest genuinely running. **Verified
live**: `TMR.isRunning()` now correctly reports true for the duration of a
started timer regardless of which rest surface is shown.

`A-9` pointed `currentUser()` at `auth.getSession()` (local, already used by
four other call sites in the file) with a network-validating `getUser()`
fallback only when no session is cached — benefiting all ~17 call sites that
route through it without touching each one. `getMaxWeight()`'s PR check
became a local high-water mark (`_prCache`, page-lifetime only, seeded once
per exercise per page load): the first checked set of an exercise still
consults the server once, every later checked set of the same exercise that
session is a synchronous cache read. **Verified live**: `currentUser()`
resolves cleanly to `null` when signed out with no throw, confirming the
fallback chain holds with no cached session.

Runtime numbers hold at S1's post-fix level (0% delta on all four counters) —
S2 is entirely a correctness/data-integrity step, touching none of the
mutation/scan/storage paths S1 fixed.

## S3 shipped (2026-08-20)

R2 dropped `.mcl-row` padding 6px→1px and deleted the `.mcl-hdr` column-
header row entirely (SET/WEIGHT/REPS/RPE — 23px on every card). Neither the
44px inputs nor the checkbox shrank; the row numbers, the RPE chip's own
title attribute, and the weight/reps inputs' own placeholder text already
did the labeling job the header duplicated. **Measured:** active card
624px → 551px (−73px, −12%); runtime holds at 0% delta on all four counters
— this step touches presentation only.

The self-opening logger fused A-11, M-1, R5's toggle-removal intent, and
§3.4's card handoff into one mechanism, per interaction 06's spec:
`setActiveCard()` now opens the card's own `.mcl-wrap` the moment it becomes
active (every existing caller already implied an open wrap — focusing an
input or tapping a checkbox requires seeing them first — so this only
changes behavior for the one caller that doesn't: the handoff itself). The
existing 600ms auto-collapse timer was extended to find the next
not-yet-finished exercise and activate it — collapse, promote, scroll into
view (`prefers-reduced-motion` respected), no tap required. The open card's
id now persists in `mc_session_v1.activeCard`; on restore, since day-cards
start collapsed on every one of the ~9 rendering engines and there is no
single shared "open this day" function across them (some wire `onclick=`,
some `addEventListener`), `mc-session.js` dispatches a real click on the
day-header — works regardless of which mechanism a given page uses, because
both listen for the same event a real tap produces.

**A real bug was caught by live verification, not just written and trusted:**
the first implementation of the handoff always walked straight to the next
top-level exercise, skipping the check for whether the unit fromCard just
finished had another leg of its own — so finishing leg A of a superset
jumped straight past leg B instead of promoting it. Caught by testing the
superset case specifically (not just the common single-exercise case),
fixed by checking the current top-level unit's own legs before walking
forward. Re-verified after the fix: leg A finishes → leg B auto-opens and
scrolls in (still inside the same superset) → leg B finishes → the next
*top-level* exercise auto-opens, only then leaving the superset. The
single-card case, the reload-restore round trip, and S2's full A-5/A-7/A-8/
A-9 verification suite were all re-run after this fix and stayed green —
including one incidental confirmation that `activeCard` composes correctly
through A-5's discard/restore snapshot with no extra code, since it just
serializes as part of the same session object.

Docs: `quick-tour.html` and `quick-tour-overview.html` both described only
the manual "tap Log Sets" path; both gained a clause noting the logger now
also opens itself when an exercise is finished, per the documentation
currency rule.

## S4 split into S4a / S4b (2026-08-20)

S4 was gated, and the owner chose to split the engines from the hand-written
pages rather than land ~80 page edits in one PR. Auditing the actual surface
to scope that split corrected a roadmap assumption:

- **5 engines**, not 2 — `mm-engine.js`, `mc-pmc-engine.js`, `mc-engine.js`
  (28 pages on its own), `mc-s3-engine.js`, `ks-engine.js` — covering
  **39 pages** between them.
- **17 pages** hand-write `.a-top`, with **zero overlap** with the engine set.

So the hand-written surface is 17 pages, not the "~80" the plan carried. That
number came from counting pages that load `mc-card-actions.js`, which is a
larger and different set — it includes pages with no `.a-top` header at all.

## S4a shipped (2026-08-20)

The consolidated header, as a shared component plus all five engines. Old
`.a-top` rules are untouched, so the 17 unmigrated pages render exactly as
before; the new markup opts in via an `.a-hdr-card` marker class.

**R4's wireframe did not survive contact with the real data, and the harness
is what caught it.** The report put the prescription inline on row 1 as a
compact pill (`4×10`). This app's prescriptions are `12·10·8·8→∞·∞` (102px
measured) and several programs carry two structural pills; reserving a fixed
right-hand column for those starved `.a-head` so badly that names and badges
stacked into a **320px header** on `kitchen-sink.html`. The prescription got
its own row instead — still one header block, still far shorter than the
three bands it replaces, and robust to a long scheme or an extra pill.

A second layout bug came out of the same measurement pass: `.a-head` at
`flex-basis:auto` filled row 1 by itself and pushed ⓘ onto a third line
(123px header), because flexbox breaks lines on *hypothetical* main size
before shrinking. Fixed with `flex:1 1 0` and by floating ⓘ out of flow
beside the ⋯ meatball, so a 44px control no longer sets the height of a 30px
row. Final headers measure **68–78px across all four engines tested**.

`.a-reps` was kept and shrunk rather than deleted, per decision 1 — verified
by repainting it through `window.aReps()` the way `program-overrides.js` does
on an override change, then confirming `mc-rep-progress.js` still finds and
drives the new spans.

**Also fixed: a live regression S1 introduced.** `.mc-meatball` went 36→44px
in S1 for the touch floor, but `.a-top`'s `padding-right:calc(42px *
var(--density))` was never updated with it — at `--density:0.82` (compact)
that resolves to 34px against a 44px control at `right:6px`, so the meatball
overlapped the exercise name by ~16px. Both the old `.a-top` and the new
`.a-hdr` now use a fixed 54px, not density-scaled, because they are clearing
a fixed-size element.

**Measured on `mm-p1.html`:**

| | S3 | S4a | |
|---|---:|---:|---|
| active card | 551px | **470px** | −81px |
| inactive card | 341.6px | **272.5px** | −69px |
| full training day | 3868px | **3165px** | −703px |
| share of 390×844 | 65% | **56%** | |
| share of 375×667 (SE) | 83% | **73%** | |

Runtime holds at 0% delta on all four counters — presentation only.
Cumulative since the original baseline: active card 595.9 → 470px (−21%).

S2's and S3's full verification suites were re-run against the new markup and
stayed green, as did the four `program-overrides.js` PM inline-edit
integration points (`.a-head`, `.a-reps`, and both `data-field` spans), which
is why those class names were deliberately left unchanged.

## S4b shipped (2026-08-20)

All 17 hand-written pages migrated onto the `.a-hdr` markup S4a introduced,
and the old `.a-top` rule deleted — there is now **one** card header in the
tree, not two. Five distinct template syntaxes were involved (multiline
template literal, compact template literal, two string-concat dialects, and
single-line template literal), so the migration ran as a structural
transformer over 15 pages with the two string-concat pages hand-edited: in
concat form the captured `.a-reps` fragment has to be re-entered into string
context, which the transformer got wrong, and shipping that would have
produced a syntax error rather than a layout bug.

Verified in a real browser on **all 17 pages**, not sampled. Five of them do
not render cards on a bare load and needed driving into the state where they
do — `run-program.html` and `run-workout.html` want a custom program/workout
seeded into localStorage, and `cat-pmc.html`, `cat-strength.html` and
`pmc-workout.html` are pickers that need a split and workout selected first.
Headers measure **53–92px** across the set (`stndr-card-concepts.html` is
120px, but it is a design-comp page carrying four concept variants, stripped
from the deploy artifact). Zero console errors anywhere; no meatball overlap
anywhere. All 45 inline scripts across the 17 pages re-parsed clean.

Runtime holds at 0% delta; layout numbers are unchanged from S4a, since
`mm-p1.html` is engine-rendered and was already migrated there.

## `A-17` — investigated in full (K-2.3, 2026-08-21) and DROPPED

The plan paired the `defer` sweep with `R4` because both were "fleet-wide
sweeps". That rationale dissolved once S4a showed `R4`'s hand-written surface
is 17 pages while `A-17` touches **137**. They are not the same sweep, so
`A-17` was pulled out — and then found to be unsafe as specified.

`A-17` reasons that "the `mc-*.js` modules are order-dependent but all
self-initialise on `DOMContentLoaded`, so `defer` preserves execution order
while unblocking the parser." That is true of module-to-module ordering and
**ignores inline scripts**, which are never deferred and therefore jump ahead
of every deferred module. The audit cited 53 pages carrying a bare top-level
call as the shape to fix; the original "wrap those calls, then sweep" plan
(option 1 below) was attempted in full at K-2.3 and the real surface turned
out much larger and structurally harder than a bare-call count suggested —
recorded here so a future attempt doesn't re-discover the same five traps
from zero.

**What K-2.3 actually found, mechanically re-derived rather than
estimated:** a corrected scanner (multi-owner map, namespace-call support,
transitive-call resolution to a fixed point, paren/brace-depth-aware
statement splitting — each fix landed only after live-testing caught a
class of hazard the previous version silently missed) found **66 pages / 72
bare top-level call-sites**, not 53 — both under-counted (multi-owner
functions like `renderDay`, declared in both `ks-engine.js` and
`mc-freq-engine.js`, were dropped by a naive "first file wins" ownership
model) and over-the-audit's-frame (namespace calls like `MM.init('p1')`,
`MC.init('s1-back')`, `MCProgramHero.mount(el,{...})` are exactly as unsafe
as a bare function call but a different shape). Wrapping those calls in
`DOMContentLoaded` was completed and verified safe (zero behavior change
without `defer`). But three FURTHER hazard shapes surfaced only once the
`defer` attribute itself was actually applied and every page live-tested,
none of them a "bare call" at all:

1. **Transitive calls** — `render();` is a safe, page-local, non-hazard
   call by name, but its OWN body calls `makeRestTimer()` (mc-timer.js) deep
   inside a template literal. Resolved via a fixed-point closure scan (any
   page-local function whose body — at any depth — mentions a hazard name,
   or calls another function already known to be hazardous, is itself
   hazardous), but this class alone roughly doubled the true hazard count
   the audit's "bare call" framing never anticipated.
2. **Declaration reads** — `const BADGE_LABELS = window.MC_PM_DATA.badges.card;`
   (cat-pmc.html, cat-strength.html, pmc-workout.html) and
   `const PROGS = window.MC_PM_DATA.programs;` (dashboard.html) read a
   deferred module's export into a top-level BINDING, not just a call.
   Wrapping the whole declaration in `DOMContentLoaded` is unsafe — later
   top-level code or a later-defined function could read that binding before
   the wrapper ever runs — so each needs a hand-verified `let NAME;` +
   deferred-assignment rewrite, not a mechanical sweep.
3. **Config-overwrite ordering** — `window.MC_SURPRISE = { sel: '.plan-card' }`
   (8 `cat-*.html` pages) REPLACES the object a shared module
   (`mc-surprise.js`) also assigns to `window.MC_SURPRISE`. Today the page's
   inline assignment runs after the module (classic scripts execute in
   document order). Deferring the module would flip that: the module's
   assignment — now the LATER one — would silently clobber the page's own
   config on every load. Not a crash, not visible in a console-error sweep;
   only caught by reading the ownership semantics of the assignment, not by
   testing for exceptions. Likely not the last shape of its kind — a
   from-scratch audit of every top-level statement touching a shared
   global's namespace, not just the call-shaped ones, would be needed to
   have real confidence there isn't a fourth.

**Decision (owner, 2026-08-21):** drop `A-17` per option 3 below rather than
keep excavating. The service worker already makes repeat visits cheap, and
the audit rated this item *medium* — its lowest severity — so the
demonstrated cost (a fifth investigation pass turning up a new hazard shape
each time, three of them found only after live-testing an actually-deferred
page, not by static reading) outweighs the win. All exploratory HTML edits
from the K-2.3 investigation were reverted; nothing partial or
un-verified shipped. The detection tooling built along the way
(multi-owner map, fixed-point transitive-call resolution, paren-aware
statement splitter) was not committed — it existed to answer "how big is
this, really", not as infrastructure for a sweep that isn't happening.

The three original options, for the record:
1. Wrap the top-level calls in `DOMContentLoaded` handlers first, then
   sweep — attempted at K-2.3; the "then sweep" half is what turned out
   unsafe, not the wrap half.
2. Defer only the modules no inline script calls at parse time — partial
   win, and a rule that silently rots the next time someone adds an
   inline call.
3. **Drop `A-17`.** ← chosen.


## S5a shipped (2026-08-20)

Owner signed off on S5 (decision 2 — reversing the no-accordion call). S5 runs
strictly serially, so `A-13` landed and was verified alone before `A-14`/`R3`
touch build timing — the same discipline that made `A-1`'s contribution
measurable in S1.

**`A-13` turned out not to need a new contract.** The audit proposed inventing
`mc:cards-rendered`: engines dispatch it, consumers subscribe, the nine retry
ladders get deleted. But `program-overrides.js` already publishes exactly that
signal — `MC_SCAN`, one shared debounced body observer with `subscribe()` /
`schedule()` / `withoutObserver()` — and three modules (`mc-layout`,
`mc-pm-inline`, `mc-card-actions`) were already on it, each with a graceful
fallback. So A-13 was a *migration onto existing infrastructure*, not new
infrastructure: no new module, no fleet-wide `<script>` churn, no manifest
change, and it removes observers rather than adding a seventeenth.
`MC_SCAN.schedule()` **is** the explicit "cards just rendered" announcement
`A-14` will make, so no redundant API was added either.

Six card-dependent modules moved off (private body observer + retry ladder)
and onto `MC_SCAN`: `mc-setlog`, `mc-rep-progress`, `mc-suggest`,
`mc-readiness`, `mc-group-split`, `mc-guided`, plus a redundant ladder removed
from `mc-pm-inline` (already subscribed). Seven of the nine ladders are gone;
the two left (`mc-cond`, `mc-nav`) wait on the finish bar, not on cards, and
were deliberately left alone.

Two refinements the migration forced, both real:

- **`mc-rep-progress`'s observer was doing two unrelated jobs** through one
  subscription — "a `.set-check` toggled, re-evaluate that card instantly" and
  "new cards appeared, rebuild". Only the second is the render signal. The
  childList half moved to `MC_SCAN`; the attribute half stays local because it
  must fire on the same frame as the tap, and is now narrowed to
  attributes-only instead of watching both.
- **`mc-readiness`'s observer had no debounce at all** (audit O-6) — every body
  mutation recomputed `byMuscle()` over the whole workout log. Subscribing to
  `MC_SCAN` fixes the missing debounce as a side effect of the migration.

**Measured — boot cost, the thing the ladders were actually spending:**

| page | before | after | |
|---|---:|---:|---|
| `mm-p1.html` | 1235 QSA | **722** | −42% |
| `pmc-back.html` | 696 QSA | **567** | −19% |
| `bro-split.html` | 1315 QSA | **845** | −36% |

**And an unbudgeted steady-state win:** removing six private body observers
means each mutation record is delivered to fewer subscribers, so rest-timer
records fell 35/s → **15/s (−57%)** and observer callbacks 14/s → **6/s
(−57%)**. Cumulative since the original baseline: **2983.8 → 15 records/s,
−99.5%**.

### A silent bug from S4b, found and fixed here

`.a-hdr-card .a-notes{display:none}` hides the coaching cue so ⓘ can reveal
it — but **five pages rendered `.a-notes` with no ⓘ at all**, making the cue
permanently unreachable: `cat-pmc`, `cat-strength`, `pmc-workout`,
`run-program`, `run-workout`. S4b's transformer detected the note by looking
for a named `noteHtml`/`notesHtml` variable, and these five render it inline
(`${ex.note?...}`) or via a `clusterNote(ex)` helper, so it reported "no note"
and skipped the button. No error, no console warning — the content simply
stopped existing on screen. Worse on `run-workout`, where the cluster note
carries an `onclick` that opens the cluster editor, so an editing affordance
went with it.

Fixed on all five, gated on the same condition their note uses, and **verified
live rather than by inspection**: on `run-workout.html` with a seeded cluster
workout, the note computes `display:none` before the ⓘ tap and `display:block`
after.

The superset legs (`.ss-ex`) were never affected — the `.a-hdr-card` marker
only lands on `.ex-card`, so `.ss-card` notes were never hidden. Checked
rather than assumed.

Also verified: **the `MC_SCAN`-absent fallback branch is real and works.**
`run-program.html` renders exercise cards but does not load
`program-overrides.js`, so `MC_SCAN` genuinely is undefined there. Seeded with
a real custom program it renders 3 cards, 3 loggers, 3 headers, 10 set rows
and its suggest hints, with zero console errors.

S2's, S3's and S4a's full verification suites were re-run and stayed green.

---

## S5b shipped (2026-08-20) — `R3` only; `A-14` split out to S5c

S5b was planned as `A-14` (build loggers lazily) *then* `R3` (collapse by
default). Scoping `A-14` first showed the two are not a sequence — `A-14` is
blocked and `R3` is not — so `R3` shipped alone.

### `A-14` is blocked by DOM-derived completion accounting

`mc-finish.js` decides whether the workout is finished by counting checkboxes
**in the DOM**:

```js
function getTotalSets(){ return document.querySelectorAll('.sl-ck,.set-check').length; }
var isComplete = total > 0 && done >= total;   // auto-opens the Finish modal
```

Build loggers lazily and that denominator stops describing the workout. On
`mm-p1.html` the count collapses from **172 to 5** — measured, not inferred:
removing the unbuilt loggers and re-reading `getTotalSets()` returns 5 while
the day really contains 172 sets. (The first attempt at that measurement was
undone by the observer rebuilding the loggers it had just removed — the
`5 / 172` pair is what proves the rebuild happened.) The consequence follows
from the source above: with `total` reading 5, the first exercise finished
satisfies `done >= total` and the **Finish Workout modal fires one exercise
into the session.**

So `A-14` needs completion accounting moved off DOM counts and onto the
prescription data first. That is its own step (**S5c**), not a line in this
one, and it is why `R3` was not held behind it.

### What `R3` actually changed

`.mcl-strip` already existed — the 48px summary row a card collapsed to once
every set was logged. `R3` makes it the **resting state of every card**, so a
training day reads as a list of exercises and exactly one is expanded: the one
being performed.

That inverts the strip's meaning, and the three details that followed from it
are the whole change:

- **It was green.** The strip's palette said "done" because a strip only ever
  appeared on a finished card. Left alone, every unstarted exercise would have
  read as already logged. The green treatment moved behind `.is-done`, which
  `updateCount()` toggles; the resting palette is neutral.
- **Its dot was a hard-coded `✓`.** It now carries the exercise's position
  (`1`, `2`, `3`…) and `updateCount()` swaps in the `✓` on completion.
- **Its `aria-label` overrode its own text.** A label wins over element
  content for assistive tech, so the `2/5 Sets` span inside the button was
  never announced — harmless while the strip only meant "finished", but under
  `R3` progress is the entire point of it. The label is now rebuilt on every
  `updateCount()` and carries the count: *"Expand Flat DB Press, 2 of 5 sets
  logged"*.

Two behavioural edges, both found by testing rather than by reading:

- `setActiveCard()` collapses every other unit, so promoting an exercise —
  by tap, or by S3's automatic handoff — is what closes the previous one.
- `updateCount()`'s existing "not all done → expand" branch had to be narrowed
  to the **done → not-done transition** (`wasDone && !allDone`). Unguarded, it
  re-expanded all ten collapsed cards on every pass, since under `R3` "not
  finished" is now the normal resting condition rather than a signal. The
  branch still exists for its real purpose: unchecking a set on a finished
  card has to bring the checkboxes back.

A freshly built card collapses behind a `__mclR3Init` guard — first build
only, so a later re-render pass never folds a card the athlete is mid-set on.

### Measured

| | S4b | S5b | |
|---|---:|---:|---|
| resting card | 272.5px | **71.2px** | −74% |
| full training day | 3165px | **1353px** | −57% |
| active card | 470px | **470px** | unchanged |

Runtime is **0% delta on all four counters** — `R3` is presentation-only, and
every logger is still built, which is exactly the property that separates it
from `A-14`.

`totalSetsInDom` stays **172** through all five verification checkpoints (rest
→ tap → re-tap → finish/handoff → uncheck). That is the assertion that proves
completion accounting is untouched, and it is why `R3` was safe to ship while
`A-14` is not.

S2's, S3's and S4a's verification suites were re-run and stayed green;
headers still measure 68–73px on every engine. Superset legs (`.ss-ex`) carry
no `.a-hdr` — pre-existing since S4a, checked rather than assumed.


---

## S5c-0 — completion accounting off DOM counts (opened 2026-08-20)

### Objective

Derive the Finish bar's `done / total` from the **prescription data**, scoped
to the day the athlete is actually training, instead of from a document-wide
count of rendered checkboxes.

### Why this is not just an `A-14` prerequisite

Scoping `A-14` (S5b's shipped record) established that lazy-building loggers
collapses `getTotalSets()` from 172 to 5 on `mm-p1.html`. Re-measuring that on
`main` to size the fix surfaced something the audits had not: **the count is
already wrong today, on every multi-day page.**

`mc-finish.js` counts `.sl-ck,.set-check` across the whole document, and every
day of a block is in the DOM at once. Measured on `mm-p1.html` — open Day 1,
check all 43 of its sets:

```
[after checking ALL of day1]  {"fw":"43 / 172 sets","done":43,"total":172}
finish modal open? false
```

A finished training day reads **25% complete**, and the auto-open Finish modal
is unreachable without completing all four days in one session. Across the 78
pages that load `mc-finish.js`, **23 render more than one day** and are
affected. Worst cases: `legacy-prep.html` (26 days, 767 sets in the DOM — a
finished 33-set day reads `33 / 767`) and `arnold-legacy.html` (649).

Single-day pages compute correctly today, which is why this survived: the
pages that get spot-checked are the ones that were never wrong.

### Scope

Two functions in `mc-finish.js`, plus one helper exported from `mc-setlog.js`.

1. **`MCSetlogUtil.plannedSetCount(card)`** — the row count a logger *would*
   build for a card, from `setsOf()` + `parseDrop`/`stripDrop`/`setCount`.
   `build()` is refactored to call it, so the planned count and the built
   count cannot drift apart. Cluster schemes add reps bubbles inside a row,
   not extra rows, so they do not affect the count.
2. **Scope = the open day(s)** — `.day-card.open`, summed (most engines allow
   two days open at once; `legacy-prep` is a true accordion). A page with no
   `.day-card` at all scopes to the document, which is what single-day pages
   already do correctly.
3. **`done` stays DOM-derived**, narrowed to the same scope.

### Deliberately not in scope

- **`done` from `mc_setlog_v1`.** Considered and rejected on contact with the
  code: `save()` is called on check but *not* cleared on uncheck, so a
  store-derived `done` would over-count every unchecked set. Making uncheck
  delete the stored entry is a persistence-semantics change that would also
  drop the set from suggestion history — its own decision, not a rider on a
  bug fix.
- **Restore-on-build.** Under `A-14`, a mid-session reload leaves unopened
  cards unbuilt, so `mc-session.js`'s `restoreSets()` (which finds rows by
  `getElementById`) silently drops their check-marks. That is real, but it is
  `A-14`'s to solve in S5c and does not exist today.
- **The discard/reset paths** stay document-wide — "exit & discard" means the
  whole session, not the open day.
- **PSU (`psu-strength.html`)** keeps its native `.set-row` logger, which
  `mc-finish.js` has never counted; it reads `0 / 0` today and still will.
  Pre-existing, separate, not made worse.
- **`.sl-ck` is dead markup.** It renders zero elements on every page probed
  (its CSS survives on ~20 pages); it stays in the selectors as a no-op rather
  than being swept in this PR.

### Gate

None. Verified by measurement on the affected pages before and after, plus the
standing local gate list.

### S5c-0 shipped (2026-08-20)

`MCSetlogUtil.plannedSetCount(card)` is the row count `build()` will render,
from the prescription alone; `build()` was refactored onto the same `planFor()`
so the planned and built counts are one expression. Verified equal on **751
cards across 14 pages, zero mismatches**, before anything depended on it.

`mc-finish.js` now scopes to the open day(s). Measured before → after on 13
multi-day pages, all passing: a finished Day 1 on `mm-p1.html` goes
`43 / 172` → `43 / 43`, and the completion recap — which **never fired
before** — now opens. The four single-day pages are byte-for-byte unchanged in
behavior.

Two things were found by measuring rather than by reading:

1. **Not every page opens a day by toggling a class.** The attribute observer
   caught it on `mm-p1.html` and saw *nothing* on a page that re-renders its
   day cards on open — the node carrying `.open` there is brand new, so no
   attribute record is ever delivered and the bar sat at `0 / 0`. Picked up
   from `MC_SCAN` instead, the shared debounced observer S5a moved six modules
   onto; no new observer.
2. **That subscription immediately re-created the feedback loop this whole
   roadmap exists to remove.** `updateProgress()` wrote `textContent`
   unconditionally; `MC_SCAN` watches `childList` on body; the write scheduled
   the scan that caused the write. Steady-state went **15 → 53.9 records/s
   (+259%)** and `querySelectorAll` **291.7 → 927.1 (+218%)** — caught by
   `tools/measure-session.js`, not by review. Fixed with A-2's write-on-change
   rule. Final delta vs the S5b baseline: records **0%**, observer callbacks
   **0%**, storage reads **0%**, `querySelectorAll` **+3%**, layout unchanged.

Also fixed while scoping: with every day collapsed but sets logged, the bar
falls back to the days containing checked sets rather than reading `0 / 0` and
appearing to have lost the session.

A comment naming a licensed page inside shared `mc-finish.js` was caught by
`tools/build-market.py --check` — reworded generically. That gate earning its
keep on a comment is worth recording.

**`A-14` (S5c) is now unblocked on the total.** It still needs restore-on-build
before it is safe: `mc-session.js`'s `restoreSets()` finds rows by
`getElementById`, so an unbuilt card's check-marks are silently dropped on a
mid-session reload.
