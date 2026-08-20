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
| **S4b** | `R4` on the 17 hand-written pages + `A-17` `defer` sweep | none — S4a's gate covers it | next |
| **S5** | `A-13` render signal → `A-14` lazy build → `R3` collapse | explicit sign-off | |
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
