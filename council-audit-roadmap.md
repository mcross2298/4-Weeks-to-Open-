# Council audit — code fixes and cleanup

Opened 2026-11-21 from a read-only, multi-lens council audit of the custom
programs and the codebase. The owner chose to fix data and state bugs first and
to leave all **program content** untouched in this round: no exercise, set,
rep, rest or schedule changes. The programming findings (Modality Matrix
volume, Strength & Supersets week-6 deload, High-Volume rep ranges, pairing
practicality, notation) stay recorded in the audit and are not acted on here.

Scratch-listed (`content-manifest.json`), so it never ships to the public
Rolodex build.

## Objective

Close six code defects the audit found by reading source, each verified by a
unit test and, where it has a screen, by driving the page.

## Scope and phases

The owner pre-approved running both phases in one piece of work ("work on code
fixes now, then the clean").

### Phase A — data and state fixes

| # | Defect | Fix |
|---|---|---|
| A1 | The Modality Matrix's "Conditioning Corner" days are training positions no page can finish, so Home's cursor stalls on them every week and the adherence streak ends there. | `mc-program-progress.js` `reconcileOpen()`: a finished Conditioning Corner routine (`type: 'conditioning'` in the workout log) completes the open day owed after the furthest completion. Derived from the synced log, so it works across devices. Called on Home, in the streak inputs, and before a lift finish banks its own day. Owner decision: any routine counts. |
| A2 | Deleting a custom workout or collection only filters it out locally; `arrayByIdTs` sync is a union, so the server copy comes back on the next pull. | Deletes write a `{id, deleted:true, updatedAt}` record, the shape `mc-program-store.js` already uses and the merge already honours; readers skip records. |
| A3 | Saving a custom workout swallows a storage-full error, then clears the draft and shows "saved". | The save reports success or failure; on failure the draft and selection are kept and the athlete is told. |
| A4 | A push opened in a new installed-app window is redirected to Home by the cold-launch guard, so SP1's routing only works when the app is already open. | Windows the service worker opens carry `?from=push`; the head-boot guard lets that one launch through. |
| A5 | The 12-Week Boxing Camp saves only the open phase, so a reload mid-session starts the session over. | Persist the session's step and timer state with wall-clock times, restore on load. |

### Phase B — cleanup

| # | Item | Fix |
|---|---|---|
| B1 | Raw NUL bytes in `mc-program-progress.js` make `grep` treat the file as binary. | Written as `'\u0000'`; byte-for-byte the same string at runtime. |
| B2 | Silent clamps and defaults: the set logger caps a stated count at 12 rows; the builder turns 0 or blank sets into 3 and blank rest into 0. | Surface them rather than apply them silently. |
| B3 | Every PR notification shares one tag, so several PRs collapse into one. | One tag per PR. |
| B4 | Empty `catch {}` blocks (the audit said 405; the real count is 1,086, see B4 below). | Review; fix only the ones that hide a failure the athlete should know about; list the rest with a one-line reason. |

## Out of scope

All program content, and the programming-lens findings above.

## Phase B results

### B2 — silent clamps

- **No authored prescription states more than 12 sets** (swept every `.html`
  and `.js`), so `mc-setlog.js`'s 12-row cap is unreachable from program data.
- **The builder's sets box** said 1–12 but accepted a typed 0, 20 or blank,
  which then became 3 sets on save or 12 rows in the logger. `updSets()` now
  clamps in the box itself, so it shows the number that will be used.
- **Import** (`import.html`) clamps a shared workout's set count to 1–12, and
  its preview shows the clamped number, not the one that was sent.
- **Rest** was never silent: the builder's rest list has an explicit
  "Rest: none" choice.

### B3 — PR notifications

`mc-push-route.js` gives a `stack` type (PR) its own tag per push, so three
records in one session leave three notifications. Check-ins and streaks keep
one tag each, so the newest replaces the last, as before.

### B4 — empty `catch` blocks

**The audit's "405" was an undercount.** That grep matched one spacing style
only. Matching every form across tracked `.js` and `.html` (bundles, the
vendored SDK, `tools/` and `GO_LIVE/` excluded) finds **1,086**, now **1,077**.

| Kind | Count | Verdict |
|---|---|---|
| `JSON.parse` fallbacks | 321 | Intended. A malformed store reads as empty; shape guards are `check-log-readers.js`'s job. |
| Storage writes | 211 | 144 are the generated head boot (theme, launch flag, error ring), which must never throw before first paint. The 67 others are listed below. |
| Other (DOM, control flow, feature probes) | 412 | Mostly optional features and DOM work on elements that may not exist. Four render or recovery calls changed (below). |
| Sync pushes | 26 | Intended. `mc-sync.js` records its own failures (`netErr`, Diagnostics). |
| `sessionStorage` | 21 | Intended. Private-mode Safari throws; the flags are best-effort. |
| Haptics, audio, wake lock | 18 | Intended. Feedback is optional by design. |
| Event dispatch | 18 | Intended. |
| Error-log writes | 11 | Intended. The recorder cannot record its own failure. |
| `removeItem` | 10 | Intended. |

**Changed: failures the athlete should know about.** Each now goes through
`MC_LOG.writeStore`, which shows the storage-full banner and records the
failure in Diagnostics; on a page without `mc-log-read.js`, the old quiet
fallback stands:

- bodyweight (`mc-body.js`), wellness (`mc-vitals.js`), conditioning results
  (`mc-cond.js`), verified maxes (`mc-maxout.js`) and macros (`mc-macros.js`)
- custom programs (`mc-program-store.js`), program progress
  (`mc-program-progress.js`), collections (`mc-collections.js`), bonus
  assignment (`mc-bonus-routing.js`) and the custom-workout cluster edit
  (`run-workout.html`)
- **Quick Pump** (`mc-quick-pump.js`) and **import** (`import.html`) now stay
  on the page and say why instead of navigating away. Before, Quick Pump opened
  `run-workout.html` on an id that had never been saved, a "not found" screen
  with no reason.
- The builder's save and delete (A3) show their own message.

**Changed: recorded instead of dropped**, because a throw there leaves no
console trace (the `loadWrapped()` lesson): Home's three layout repaints
(`mc-layout.js`), the conditioning repaint (`mc-naming-paint.js`), the set-log
journal replay (`mc-setlog.js`, where a failure means crash recovery is off
for that load), and the workout-archive rollover after a pull (`mc-sync.js`).

**Left as is: the 67 remaining storage writes**, by what they hold:

- **Fallback branches of the shared writers:** `mc-session.js:41`,
  `mc-macros.js:117`, `mc-maxout.js:112`, `mc-program-progress.js:66`,
  `run-workout.html:233`. They run only where `MC_LOG` / `MCSetlogUtil` isn't
  loaded.
- **View state and seen flags.** Losing one only re-shows a hint or a
  collapsed state: phase picker, week collapse, hints, onboarding, the tour,
  push and persist "asked" flags, owner-seen, the biometric opt-out,
  appearance, personal theme, timer and voice prefs, the PM creator's intent,
  client-assignment dismissals.
- **Caches that rebuild themselves:** coach report, published programs,
  offline-prefetch record, exercise-catalog cache and pending queue,
  error-beacon sent marks, report seen marks, VAPID key record.
- **Derived from stores that are already protected:** the active-program card
  on Home (re-picked from the program list), the activity calendar (re-marked
  on the next session), the daily and session summaries, the session record
  deletion at Finish, the resume snapshot restore, and the cloud outbox
  (`mc-supabase.js`), whose sets are also in the local set log. I did not
  trace whether a lost outbox entry is re-sent; that is worth checking.
- **Small athlete edits, worth a later change rather than this one:**
  favourites, exercise swaps and replacements (`exercise-library.html`,
  `mc-card-actions.js`, `mc-swap-manager.js`, `mc-replace.js`), schedule rest
  days (`mc-schedule.js`), owner and personal page overrides
  (`program-overrides.js`, `mc-program-builder.js`), the STNDR check-off
  (`stndr-checkoff.js`), coach-assigned macro goals (`dashboard.html:2808`) and
  workout prefs from the account sheet (`mc-account.js:229`). Each would lose one
  small edit on a full device. I expect most are visible on screen at the
  time, but I have not checked each one.
- **In-page session state on three conditioning pages** (The 500, Driveway
  Demolition, Hell Week, `SKEY`). Same shape as A5; a resume for them is its
  own change.
