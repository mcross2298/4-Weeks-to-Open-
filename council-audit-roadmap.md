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
| B4 | 405 empty `catch {}` blocks across 95 files. | Review; fix only the ones that hide a failure the athlete should know about; list the rest with a one-line reason. |

## Out of scope

All program content, and the programming-lens findings above.
