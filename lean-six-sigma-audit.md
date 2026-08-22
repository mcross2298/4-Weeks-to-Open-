# 📊 Lean Six Sigma Codebase & UX Roadmap Artifact

**Executive Gemba Walk — 2026-08-20** · Walked by the combined CTO / Director of
UI-UX / VP of CX audit team, against the real source on `main` (post-S5c-0,
commit `5dc53cc`). Scratch-listed in `content-manifest.json` — never ships to
the public Rolodex build.

**Standing on prior work, not repeating it.** This walk was taken *after* the
card-integration chain S0–S5c landed. The runtime-waste storm those steps
closed (mutation records 2983.8/s → 15/s, `querySelectorAll` −73%, storage
reads −99%, resting card −74% height, full day −57%) is treated here as the
new baseline — findings below are what is **still open on top of it**, each
verified against source this session, with file:line evidence. Finding IDs are
`G-##` (Gemba) to stay distinct from the earlier `A-*`/`R*`/`D-*`/`W-*` series.

**Three rounds live in this document.** §1–§5 are the operational walk
(`G-01…G-11`). §6 adds the design-lens track (`DG-1…DG-10`, proposed). §7 is
the Voice-of-the-Customer round taken by **driving a real demo session in a
browser** (`VOC-A1…C2`). **§8 merges all three into one dependency-ordered
execution sequence and is the list to work from** — the per-section phase
lists are kept for their reasoning, but §8 is what supersedes them on order.

---

## Section 1 — Executive Gemba Findings & User Interview Matrix

The demo session was walked end to end in source: cold boot →
`dashboard.html` → program card → `mm-p1.html` → open Day 1 → ghost-filled
weight → check set (`onCheck`, `mc-setlog.js:386`) → auto rest timer
(`mc-setlog.js:466-474`) → superset leg handoff (`mc-superset-hop.js`) →
finish bar → recap (`mc-finish.js`) → history (`workout-logs.html`).

| Lens | **User A — Efficiency Weightlifter** | **User B — Structured Program Follower** | **User C — Dynamic / Hybrid Athlete** |
|---|---|---|---|
| **What works (verified)** | One tap on a set-check saves, fires haptic, and auto-starts the *prescribed* rest via `TMR.parseSeconds(t.dataset.rest)` (`mc-setlog.js:466-474`); S3's handoff promotes the next unfinished exercise unprompted; superset legs promote correctly (S3 fix). | Ghosted suggested weight solidifies on first keystroke or check (S2); `histText()` shows "Last: 225 lb @8 · date" per exercise (`mc-setlog.js:103-112`); `mm-p1/2/3` week tabs derive from `WEEK_THEMES`; finish bar now counts the open day only (S5c-0). | Discard is confirmed, snapshotted to `mc_discard_snapshot_v1`, and restorable from the dashboard banner (S2); swap flow has an Undo toast; custom exercises dedup on entry (`mc-exercise-catalog.js`). |
| **Code-base friction (CTO)** | First visit to a program page on gym Wi-Fi = **33 script files, ~712KB of JS** (`mm-p1.html`; measured). All loggers still build eagerly — `A-14` (lazy build) remains open — so 172 set rows exist in DOM at boot on `mm-p1.html`. | `program-manager.js` (**100,663 bytes**) — an owner-only PM editing module — is parsed by every trainee on every program page (`mm-p1.html` script list). `A-17` (`defer` sweep) is blocked on 53 pages' bare inline bootstrap calls. | **G-01 (defect):** `mc_custom_exercises_v1` is documented in its own header as "synced across the user's own devices via mc-sync.js" (`mc-exercise-catalog.js:7`) but is in **neither** `mc-sync.js`'s `STORES` map (lines 45–58) **nor** `mc-export.js`'s backup list (lines 22–25). A hybrid athlete's custom exercise library silently does not follow them to a new phone and is absent from their own backup file. |
| **UI/UX friction (Design)** | "🏆 New PR" push fires on the **first-ever logged set of every exercise** — `prevMax === null \|\|` short-circuit at `mc-setlog.js:447` — so a new signed-in user's first session yields ~10 "your best lift ever" notifications. Notification fatigue teaches users to disable push. | `psu-strength.html` keeps its native `.set-row` logger which `mc-finish.js` has never counted — the finish bar reads **0 / 0** for the entire session (recorded in `card-integration-roadmap.md` S5b scope notes; still true). One licensed page delivers a visibly broken completion surface. | `.sl-ck` is dead markup (renders zero elements on every page probed) yet its CSS survives on ~20 pages and stays in live selectors — inventory that reads like a working feature in source. |
| **CX friction (VP CX)** | Cold gym dead-zone: `sw.js` precaches the app shell + all JS (`sw.js:7-122`) but **none of the 145 workout pages** — each caches only on first visit. Day 3's page never opened at home = "You are offline" mid-week at the squat rack. | Multi-week progression review is a page-jump (`stats.html` / `workout-logs.html`) rather than visible at the card where the decision to add weight is made — `mc-exercise-trends.js` exists and is loaded on program pages but its trend surface requires opening the meatball. | **G-02 (defect class):** training data that isn't sets doesn't travel: `mc_replacements` / `mc_replacements_global` (saved swaps), `mc_ex_notes`, `mc_ex_favs`, `mc_ex_tempo`, `mc_personal_intensifiers` are neither synced nor exported. `mc_session_summary_v1` is synced (`mc-sync.js:57`) but **not** exported — the backup file a user downloads is missing data the app itself considers worth syncing. |

---

## Section 2 — Lean Six Sigma Waste & Friction Audit

### Waste register (8 Wastes of Muda)

| # | Waste | Finding | Evidence | Severity |
|---|---|---|---|---|
| G-01 | **Defects** | `mc_custom_exercises_v1` documented as synced; absent from both `STORES` and the export list — data loss on device switch, silent backup gap | `mc-exercise-catalog.js:7` vs `mc-sync.js:45-58`, `mc-export.js:22-25` | **High** |
| G-02 | **Defects** | Store-coverage drift across three hand-maintained lists: ~54 `mc_*` keys tree-wide; sync covers 13, export covers 12, and the two disagree (`mc_session_summary_v1` synced-not-exported; swaps/notes/favs/tempo in neither) | key inventory grep; `mc-sync.js`; `mc-export.js` | **High** |
| G-03 | **Extra-processing** | First-set-of-exercise PR push (`prevMax === null \|\|`) — celebration debased to noise on session one | `mc-setlog.js:443-453` | Medium |
| G-04 | **Defects** | `psu-strength.html` finish bar reads 0/0 all session (native `.set-row` logger never counted) | `card-integration-roadmap.md` S5b notes; unchanged on `main` | Medium |
| G-05 | **Inventory / Waiting** | Offline gap: app shell precached, workout pages first-visit-only; no "take my program offline" action exists | `sw.js:7-122`, fetch handler `sw.js:210-223` | **High** (CX) |
| G-06 | **Overproduction** | Owner-only PM tooling (`program-manager.js`, 100KB) parsed by every trainee on every program page; total program-page payload 33 files / ~712KB | `mm-p1.html` script manifest | Medium |
| G-07 | **Waiting** | `A-14` open: every logger builds eagerly at boot (172 rows on `mm-p1.html`); `A-17` blocked: no `defer` on any module because 53 pages carry bare top-level inline calls | `card-integration-roadmap.md`; CLAUDE.md A-17 note | Medium |
| G-08 | **Transportation** | Per-exercise multi-week trend lives behind meatball → trends sheet or a jump to `stats.html`, not at the point of the load decision | `mc-exercise-trends.js`, `stats.html` | Low-Med |
| G-09 | **Inventory** | Dead `.sl-ck` selector + CSS residue on ~20 pages; `index.html` triple redirect mechanism (meta refresh + `location.replace` + canonical) | roadmap S5b notes; `index.html:6,28-31` | Low |
| G-10 | **Motion** | *(Largely retired by S1/S3/S5b — touch floor, auto-handoff, one-expanded-card. Verified, not re-flagged.)* Remaining: out-of-order logging costs one strip tap; acceptable by design. | `mc-setlog.js:504-521` | Info |
| G-11 | **Non-utilized talent** | Readiness, strain, cues, voice, wrapped, muscle-map modules all load on program pages, but the Quick Tour is the only discovery surface; no in-context "first time here" affordance ties them to the moment they'd matter | script manifests; `quick-tour.html` | Low-Med |

### 5 Whys — the three operational root causes

**RC-1: Custom training data doesn't travel (G-01/G-02).**
1. Why did custom exercises fail to appear on the new phone? — `mc_custom_exercises_v1` is never pushed or pulled by `mc-sync.js`.
2. Why isn't it in the sync map? — the `STORES` map is a hand-maintained list, edited when someone remembers.
3. Why does it depend on remembering? — there is no single registry of stores; every consumer (sync, export, discard-snapshot, bridge) keeps a private list.
4. Why do private lists persist in a repo with 15+ CI gates? — no gate compares store lists against the keys the code actually uses; the drift is invisible to CI.
5. Why was no gate built? — stores accreted one feature at a time (~54 keys now) and the third consumer (`CONSUME`) only arrived with B0; the coordination cost was never re-paid. **Countermeasure:** a declared store registry + `tools/check-store-coverage.js` CI gate (the house pattern — same shape as `check-single-impl.js`).

**RC-2: The gym dead-zone failure (G-05).**
1. Why did Day 3 fail offline? — its HTML was never cached.
2. Why not? — `sw.js` precaches only the shell; pages cache on first visit by design.
3. Why first-visit-only? — precaching all 145 pages was (correctly) rejected as cache bloat.
4. Why is there no middle path? — no signal connects "this trainee runs program X" (`mc_active_prog` exists!) to the SW cache.
5. Why not? — the SW predates program-selection state. **Countermeasure:** on program selection, prefetch that program's split pages once (a `fetch()` loop is enough — the SW's fetch handler caches them); no SW change required.

**RC-3: PR celebration debased on day one (G-03).**
1. Why ten PR pushes in session one? — every first set has no historical max, and `null` counts as beaten.
2. Why does `null` count? — the guard was written for the steady-state lifter with history.
3. Why wasn't the cold-start path noticed? — PR push was added alongside the max-cache (A-9) and tested against accounts with history.
4. Why no first-log distinction? — `getMaxWeight` can't distinguish "no history" from "new exercise"; both return null.
5. Why does that matter? — the *first* log is a baseline, not a record. **Countermeasure:** suppress the push when `prevMax === null` (or send a one-time "baseline set" toast instead).

---

## Section 3 — SIPOC: Active Set-Logging Process

| Stage | Content |
|---|---|
| **Suppliers** | Program data files (`mm-data.js`, inline `DAYS`, 5 card engines); `exercise-catalog.js` + `mc-exercise-catalog.js` (custom/published); Supabase (`program_overrides`, `workout_logs`, push); prior sessions (`mc_setlog_v1`); the athlete |
| **Inputs** | Tap on set-check `<button role="checkbox">`; weight (`inputmode="decimal"`), reps (`numeric`), RPE; ghosted suggestion from `mc-suggest.js`; prescribed rest on `data-rest` |
| **Process** | `onCheck()` (`mc-setlog.js:386`): read row → `save()` to `mc_setlog_v1` → clear `mc_setlog_pending_v1` draft → fire-and-forget `MC_SB.logSet()` (+cached PR check, `localMaxP`) → haptic → `updateHist()` / `updateCount()` (write-on-change) → `TMR.start()` at prescribed rest → on all-done: 600ms auto-collapse → `nextIncompleteUnit()` promote + scroll |
| **Outputs** | Strip badge `n/m Sets` + rebuilt `aria-label`; day-scoped finish bar (`mc-finish.js`); running rest timer + float; on Finish: `mc_workout_log_v1` entry, `mc_session_summary_v1`, strain/refuel readouts, Supabase `workout_logs` rows |
| **Customers** | The athlete mid-set (timer, next-card promotion); the athlete next week (`histText`, suggestions, trends); coach/PM (publish/override layer); Mike's Cookbook (`mc-bridge.js` `likelyTrainingDays()`); the athlete's other devices (`mc-sync.js` — **where G-01/G-02 currently break the chain**) |

The process core is healthy post-S-chain: single write path, write-on-change
discipline, no blocking network on the hot path. The defects cluster at the
**output boundary** (what persists, syncs, and exports), not in the loop.

---

## Section 4 — Prioritization Matrix (Impact × Effort)

| | **Low Effort** | **High Effort** |
|---|---|---|
| **High Impact** | **Quick Wins:** G-01 add `mc_custom_exercises_v1` to sync + export · G-02 store registry + `tools/check-store-coverage.js` CI gate; reconcile export vs sync (add `mc_session_summary_v1`, swaps, notes, favs, tempo where owner decides they're user data) · G-03 suppress first-log PR push · G-05 active-program page prefetch on selection | **Strategic Investments:** G-07a `A-14` lazy logger build + restore-on-build (S5c, already scoped) · G-07b inline-bootstrap `DOMContentLoaded` wrap on 53 pages, then the `A-17` defer sweep · G-04 migrate `psu-strength.html` onto `mc-setlog.js` · S6 items (`A-15` CI perf budget, `A-16` delta sync, `A-12` vendored SDKs) |
| **Low Impact** | **Fill-ins:** G-09 `.sl-ck` CSS/selector sweep · `index.html` redirect consolidation · G-08 surface last-3-session micro-trend on the card header (data already local) | **Thankless Tasks (do not do):** consolidating 5 card engines into 1 (headers/strips already shared via `.a-hdr`/S4; full merge risks 39 pages for no visible gain) · any framework/bundler migration (recorded architecture decision; the no-build constraint is working) · G-06 splitting `program-manager.js` behind a dynamic import (SW cache + one-time parse make the real-world gain small; revisit only if `A-15`'s budget flags it on target hardware) |

---

## Section 5 — Phased Kaizen Implementation Roadmap

> **Ordering superseded by §8.** The phases below hold their scope and
> reasoning, but §8's integrated sequence is what accounts for the collisions
> with §6 and §7 and is the order to execute in.

Serial-chain discipline carries over from the card roadmap: anything touching
`mc-setlog.js` / `mc-sync.js` lands one PR at a time, measured with
`tools/measure-session.js` before/after (0% runtime-delta rule), gates green
before push. Per the planning rule, this artifact authorizes implementation;
the phase boundaries below still get their `AskUserQuestion` check-in.

### Phase 1 — Immediate Stabilization & Defect Removal (Sprint 1–2)
1. **K-1.1 (G-02/RC-1): Store registry + CI gate.** One declared map of every
   `mc_*` store (key → owner module, synced?, exported?, device-local-by-design?).
   `tools/check-store-coverage.js` fails CI when a key used in code is missing
   from the registry or a registry flag disagrees with `mc-sync.js`/`mc-export.js`.
   This is the countermeasure that keeps every later fix fixed.
2. **K-1.2 (G-01): Custom exercises travel.** Add `mc_custom_exercises_v1` to
   `STORES` (arrayById-family merge) and the export list; correct or honor the
   header claim in `mc-exercise-catalog.js`. Verify with a
   `tools/test-mc-sync-merge.js` fixture.
3. **K-1.3 (G-02): Reconcile export vs sync.** Owner decision per key
   (AskUserQuestion): which of swaps/notes/favs/tempo/personal-intensifiers are
   user data (sync + export) vs device preference (registry-flagged local).
   `mc_session_summary_v1` joins the export either way.
4. **K-1.4 (G-03): First-log PR guard.** `prevMax === null` → no push.
5. **K-1.5 (G-04): PSU finish bar.** Migrate `psu-strength.html`'s native
   `.set-row` logger onto `mc-setlog.js`, retiring the last page `mc-finish.js`
   cannot count (0/0 → real).

### Phase 2 — Flow Optimization & Friction Elimination (Sprint 3–4)
1. **K-2.1 (G-05/RC-2): Active-program offline prefetch.** On program
   selection (and on `mc_active_prog` change), fetch that program's split pages
   once so the SW caches them; a one-line "Available offline ✓" confirmation on
   the program card. Quick Tour gains its entry (documentation currency rule —
   this one is user-facing).
2. **K-2.2 (G-07a): Land `A-14`** — lazy logger build gated on
   `plannedSetCount()` totals (already proven in S5c-0) plus restore-on-build
   for `restoreSets()`'s `getElementById` dependency.
3. **K-2.3 (G-07b): Unblock and land `A-17`** — wrap the 53 bare inline
   bootstrap calls in `DOMContentLoaded`, then the fleet-wide `defer` sweep,
   measured on the three probe pages.
4. **K-2.4 (G-09): Fill-ins batch.** `.sl-ck` sweep; `index.html` single
   redirect path.

### Phase 3 — Strategic Feature Enhancements & Value Creation (Sprint 5+)
1. **K-3.1 (S6 / `A-15`): CI performance budget** — `measure-session.js`
   thresholds enforced in `verify.yml` so the −99.5% runtime win can never
   silently regress (the S5c-0 feedback-loop incident is the proof it can).
2. **K-3.2 (S6 / `A-16`): Delta sync** — push changed keys, not whole stores,
   now that the registry (K-1.1) knows every store's shape.
3. **K-3.3 (G-08): Progression at the point of decision** — last-3-session
   micro-trend (↑/→/↓ + weight) on the card header from data already in
   `mc_setlog_v1`; the full sheet stays where it is.
4. **K-3.4 (G-11): Contextual feature discovery** — one-time inline hints
   tying readiness/strain/cues to their first natural moment of use.
5. **K-3.5 (carried from B5):** the owner-side real-device QA matrix (iOS
   Safari, Android Chrome, installed PWA, two-device Supabase reconciliation)
   remains the standing gate before L6/launch can be called done.

---

### Walk verdict

The production line is in the best shape it has ever been — the S-chain
removed the runtime waste an order of magnitude harder than anything found
today, and the logging loop itself is tight: one tap logs, times, and advances.
What this walk found is that the waste has moved **downstream of the rep**:
data that should follow the athlete doesn't (G-01/G-02), the offline promise
breaks exactly where a gym app needs it (G-05), and the celebration layer
cries wolf on day one (G-03). All three are cheap to fix and two of them are
one CI gate away from being impossible to reintroduce. Phase 1 is a week of
work that converts "the app tracked my workout" into "the app keeps my
training history, everywhere, provably."


---

## Section 6 — Addendum: Design Continuous-Improvement Track (proposed, post-K-3)

Second pass by the same executive team, this time through a **design mindset**:
visual identity, layout system, theming, motion, and the build conventions
that carry them. **Status: proposed — queued behind the K-phase trajectory.**
Each D-phase gets its own roadmap entry when its turn comes, per the planning
rule. Evidence standard unchanged: every finding verified in source.

**Where the design system already stands.** `base.css` is further along than
most no-build codebases: a real token block (accent, the L1-unified semantic
state tokens, macro palette), a *documented type-scale ramp* (`--fs-3xs`…,
written so adoption is a 1:1 `var()` swap), a density scale
(`html[data-density="compact"]` → `--density:0.82`), and CI gates that already
treat design as law (`check-program-colors.js`, `check-day-colors.js`, the
light-mode contrast ratchet). The D-track finishes what that system started.

| ID | Area | Finding | Evidence | Severity |
|---|---|---|---|---|
| DG-1 | Typography | **Silent display-face fallback in production.** The PM "athletic" typography theme sets `'Bebas Neue'`, but no page in the tree loads that font (no `@font-face`, no Google Fonts link for it) — every device silently renders Arial Narrow / system. The theme option never delivers its face | `base.css:78-82`; font-loader grep: zero | Medium |
| DG-2 | Typography | **Two type identities in one app.** The `cat-*` program-landing pages load Archivo + Manrope from Google Fonts; dashboard and every workout page run `'Segoe UI', system-ui`. The brand face is also not precached, so an offline landing page loses its identity while the rest of the app keeps its (system) one | `cat-mc.html:270` et al. vs `base.css:141`; `sw.js` precache list | Medium |
| DG-3 | Type scale | **The documented ramp is not yet adopted.** The `--fs-*` scale exists precisely so "page titles, card names, labels and body text stop drifting page-to-page" — the swap it was designed for has not been run, so the drift it names is still live | `base.css` type-scale comment block | Medium |
| DG-4 | Theming | **Light theme is a 28 KB parallel rule file** (`mc-light.css`) rather than a token re-declaration — every new component must be styled twice, the drift class the contrast ratchet exists to catch | `mc-light.css` (28,347 B) | Medium |
| DG-5 | Build | **Per-program card CSS is hand-written** — ~101 `.cat-card.<id>` / `.rail-card.<id>` references in `dashboard.html`, kept honest only by `check-program-colors.js`. Generating them from `mc-pm-data.js` `color` (generate-and-verify, house pattern) deletes the drift class the gate guards — revives W-18 | `dashboard.html`: 101 refs | Low-Med |
| DG-6 | Motion | **No motion tokens.** Durations/easings are scattered literals; `prefers-reduced-motion` appears 4× in `base.css` and 0× in `mc-setlog.css` (the set-log's scroll respects it only via JS) | grep counts; `mc-setlog.js:540` | Low |
| DG-7 | Offline UX | **The offline fallback page is unthemed** — hardcoded hex, inline styles, no light-mode variant, no brand type. The one screen a trainee sees at the worst moment is the least designed in the app | `sw.js:159-174` | Low-Med |
| DG-8 | Process | **Four redesign comps sit dormant** — `Dashboard Redesign.dc.html`, `Programs Redesign.dc.html`, `Conditioning Redesign.dc.html`, `Program Landing.dc.html` (stripped from deploys, never shipped or killed). Un-decided design intent is inventory | `*.dc.html`; `pages.yml` strip step | Low-Med |
| DG-9 | Governance | **The kitchen-sink family is a de-facto component gallery without teeth.** Promote it: a screenshot-diff visual ratchet in CI (the contrast ratchet's sibling) so an unintended visual change fails a PR the way a color mismatch already does | `kitchen-sink*.html`; `verify.yml` | Low-Med |
| DG-10 | Layout | **No stacking contract for the fixed bottom layer.** `.timer-float` (64 px, z-100), `.fw-bar` (z-40) and `.fw-auto-banner` each pin themselves independently; only `.fw-bar` pads for `safe-area-inset-bottom`. Codify one spec: reserved heights, a z-index token scale, safe-area everywhere, co-visibility rules | `base.css:384,440,483` | Medium |

**Three principles govern the track**, all extensions of what the repo already
believes: **one identity** — a single type and color voice from install screen
to offline page, loaded everywhere it claims to apply (DG-1/2/7); **tokens are
law** — a value that matters is a named custom property, and a component that
bypasses the token sheet is drift, not style (DG-3/4/6/10); **gates over
vigilance** — every design rule worth keeping gets a generate-and-verify tool
or a ratchet, because this repo's own history shows hand-maintained visual
consistency decays (DG-5/9).

**Phase D-1 — One Type Identity** (DG-1, DG-2, DG-3): decide the app's display
face once (owner call: the Archivo/Manrope pair the landing pages already use,
the athletic Bebas direction, or a committed system stack), self-host and
precache it so offline keeps the brand, fix or retire the "athletic" option so
the picker's promise matches the render, then run the 1:1 `--fs-*` swap and add
a type-scale check beside the color gates.

**Phase D-2 — Tokens & Themes Consolidated** (DG-4, DG-5, DG-7): collapse
`mc-light.css` toward a token re-declaration with the contrast ratchet holding
the line during migration; generate per-program card CSS from `mc-pm-data.js`
(tool + `--check`) and delete the hand-written blocks; ship a themed, branded
offline page from the SW.

**Phase D-3 — Motion, Layers & Governance** (DG-6, DG-8, DG-9, DG-10): motion
tokens plus a fleet-wide `prefers-reduced-motion` audit; the bottom-layer spec;
a ship / fold-in / retire verdict on each of the four `.dc.html` comps; and the
kitchen-sink visual ratchet in `verify.yml`.

---

## Section 7 — Voice of the Customer: live demo-session interviews

The same three users, re-interviewed after a **real demo workout session driven
in headless Chromium against the live source** (localhost, 390×844 mobile
viewport): day opened, weights typed, sets checked, rest timers fired, session
reloaded mid-workout, meatball tools enumerated, builder visited. Every claim
below is from an executed interaction, not source-reading. Environment caveat:
the sandbox proxy blocks the Supabase CDN, so cloud paths ran in their offline
fallback; everything local-first was exercised for real. Console otherwise clean.

**What the demo confirmed working, live.** The S-chain holds up under real
hands: 3 taps from cold page to first logged set (day header → strip → check);
checking a set with `135` typed auto-starts the prescribed rest and
**ghost-carries 135 into set 2** (`value:"135", ghost:true`); the timer float
carries a full control set (−15s/+15s/✓ Done/presets/sound/vibrate/10s cue); a
mid-session reload restores the `2/5` badge, the `LAST: 185 LB · AUG 20`
history line, re-opens the day, and the finish bar reads `2 / 43 sets` —
day-scoped, exactly as S5c-0 promised; W1–W5 week tabs render from
`WEEK_THEMES`; target reps sit in-row as placeholders with the `5×5`
prescription on the card header.

### User A — The Efficiency Weightlifter

**VOC-A1 — "Don't kill my rest clock just because I touched the screen."**
*The round's headline defect, and a new one.* While rest runs in the default
List view, `#timerOverlay` (`mc-timer.js:608` — `position:fixed; inset:0;
z-index:99`, invisible) covers the entire page and its only behavior is
`TMR.stop()`. The experiment: rest running → real tap on set 2's weight field →
**tap 1 stopped the timer and did not focus the field; tap 2 was required to
type.** For a superset athlete — who is *supposed* to work during the other
movement's rest — every mid-rest interaction costs a wasted tap and silently
cancels the countdown. Fix: scope tap-to-dismiss to the timer float itself (or
make the overlay `pointer-events:none` and keep dismissal on ✕/Done).
Contained to `mc-timer.js`.

**VOC-A2 — "Land me on today's first unfinished exercise, not on a closed
day."** A fresh visit needs two structural taps (day header, then the R3 strip)
before the first check is reachable. S3 already restores
`mc_session_v1.activeCard` across reloads, so mid-session return is one-tap-zero
— the gap is only the *fresh* session. Fix: extend the S3 restore path to cold
starts, reusing `nextIncompleteUnit()` and the simulated-header-click mechanism.

**VOC-A3 — "No ads for other programs while I'm under a bar."** The primary nav
rendered a promo tile mid-session — `SUGGESTED — NEW FOR YOU · The 500 →` —
between Programs and Conditioning, on an active workout page. Fix: suppress
suggestion tiles while a session is live; resurface on dashboard and post-recap.

### User B — The Structured Program Follower

**VOC-B1 — "Show me my trend where I pick the weight."** Zero trend/sparkline
elements visible on any card (probe count: 0); the 📈 Exercise-progress surface
exists but only behind the ⋯ meatball, and the history line is one session deep.
Validates **G-08 / K-3.3** exactly as scoped, upgrading its evidence from
"page-jump friction" to "confirmed absent at the decision point."

**VOC-B2 — "When I switch week tabs, tell me what actually changed."** The
W1–W5 tabs switch schemes correctly, but nothing summarizes the delta — the
athlete diffs `5×5` against last week's memory. Fix: a one-line "this week"
note on the day header when the theme changes the 4 feature lifts (the data
already knows which positions are themed).

**VOC-B3 — "This reload continuity — I want it when I switch phones, too."**
The same-device round trip is excellent; that experience is exactly what
G-01/G-02 break *across* devices. No new work — this is the user's-voice case
for K-1 staying first in the queue.

### User C — The Dynamic / Hybrid Athlete

**VOC-C1 — "I found eight power tools behind that ⋯ button."** The meatball menu
carries 📈 progress, 🔁 replace, ↕️ reorder, ⏱️ tempo, 📝 notes, ↘️ drop set,
🧩 cluster set, ⚡ make-superset — the whole hybrid toolkit, uniformly hidden
behind one unlabeled control per card. Validates **G-11 / K-3.4** with a sharper
shape: a one-time first-use hint, and consider promoting the two session-flow
actions (⚡ superset, ↘️ drop set) to visible card affordances during a session.

**VOC-C2 — "Let me bail to a different workout without fearing for my sets."**
"Exit & discard" exists inside the finish flow (deliberate, with the S2
snapshot/restore net behind it). What is missing is the complement: navigating
away mid-session works and the session survives in stores, but nothing *says
so*. Fix: a one-line "Session saved — resume from the dashboard" toast leaning
on `mc-resume.js`'s existing banner. Copy plus one hook, no new state.

### Round-2 register

| ID | Type | Disposition | Severity |
|---|---|---|---|
| VOC-A1 | New defect (Motion / Extra-processing) | Insert as **K-2.0** — one-file `mc-timer.js` change, high felt impact | High (felt) |
| VOC-A2 | New improvement | Extend S3 restore to cold starts — joins the card-build chain | Medium |
| VOC-A3 | New improvement (CX) | Session-aware promo suppression | Low-Med |
| VOC-B1 | Validates G-08 | Evidence upgraded; K-3.3 unchanged | Low-Med |
| VOC-B2 | New improvement | Week-delta note on day header | Low |
| VOC-B3 | Validates G-01/G-02 | User's-voice case for K-1 first | High |
| VOC-C1 | Validates G-11 | K-3.4 sharpened: hint + promote 2 session actions | Low-Med |
| VOC-C2 | New improvement (CX) | "Session saved" reassurance on mid-session nav | Low |

Net of the round: the logging loop earned the users' trust under real hands.
The asks cluster where the loop meets the **clock** (VOC-A1 — the one place a
tap does something the athlete didn't intend) and where it meets **confidence**
(B3, C2 — the data is safe, but only the code knows it).

---

## Section 8 — Integrated execution sequence (supersedes the per-section phase lists)

Three finding series now exist against one codebase: `G-01…G-11` (§2),
`DG-1…DG-10` (§6), `VOC-A1…C2` (§7). Shipped as three independent plans they
would collide — **11 of the items touch a file another item also touches**, and
two of those files (`mc-setlog.js`, `mc-sync.js`) are the repo's declared
serial-chain files. This section is the merge: one order, derived from real
dependencies rather than from which section found the item.

### The collision map

| Shared surface | Items that touch it | Consequence |
|---|---|---|
| `mc-setlog.js` | K-1.4, K-2.2 (`A-14`), VOC-A2, K-3.3 | **The binding constraint.** Four items, one file, one PR at a time — this chain sets the calendar for everything downstream of it |
| `mc-sync.js` / `mc-export.js` | K-1.1, K-1.2, K-1.3, K-3.2 | Hard prerequisite: the registry (K-1.1) is what makes 1.2/1.3 verifiable **and** what delta sync (K-3.2) needs to know each store's shape |
| The rest-clock / fixed-layer surface | VOC-A1 (`mc-timer.js`), DG-10 (`base.css`) | Same defect class at two altitudes: A-1 is the live bug, DG-10 is the contract that stops it recurring |
| `sw.js` + offline | G-05 / K-2.1, DG-7 | One user-visible story: the program is *there* offline, and when something isn't cached the page still looks like the app |
| `verify.yml` | K-1.1, K-3.1, DG-9, DG-5 | Four ratchets, one workflow file — batch them rather than editing it four times |
| Card header (`.a-hdr`) | K-3.3 (trend), DG-3 (type scale) | Style the header once: the scale swap must land **before** the trend is added, or the new element is restyled immediately |
| Fleet-wide page rewrites | K-2.3 (`A-17` defer), D-1/D-2 CSS work, DG-5 | Never concurrent — S4b's lesson is that a transformer over 15+ pages needs exclusive ownership of the tree |

### Two lanes that can run in parallel

The backlog splits cleanly into a **data/logic lane** (`mc-setlog.js`,
`mc-sync.js`, `mc-export.js`, `sw.js`, `mc-timer.js`) and a **presentation
lane** (`base.css`, `mc-light.css`, `dashboard.html`, fonts). They share
exactly one seam — the card header (K-3.3 × DG-3) — so with one seam respected
the two lanes can proceed independently. Everything inside a lane is serial.

### The sequence

**Wave 0 — Two one-file fixes, first** *(highest felt impact per line in the
whole backlog; no dependencies at all)*
1. **K-2.0 / VOC-A1** — scope the rest-timer overlay so a mid-rest tap reaches
   the field instead of killing the clock. `mc-timer.js` only.
2. **K-1.4 / G-03** — suppress the PR push when `prevMax === null`, so a new
   user's first session doesn't fire ten "best lift ever" notifications.
   `mc-setlog.js` — and it opens the serial chain, so it goes first there.

**Wave 1 — Make the data provable** *(strict internal order; the whole reason
K-1 leads the roadmap, and VOC-B3 is the user asking for it)*
3. **K-1.1** store registry + `tools/check-store-coverage.js` — first, because
   it is what makes the next two verifiable and permanent.
4. **K-1.2** custom exercises into sync + export (fixture in
   `test-mc-sync-merge.js`), then **K-1.3** reconcile export vs sync
   (`AskUserQuestion` on which keys are user data vs device preference).

**Wave 2 — Offline as one story** *(presentation-lane-independent; can run
alongside Wave 1)*
5. **K-2.1 + DG-7 together** — prefetch the active program's pages on selection
   (no SW change needed; the fetch handler caches them) **and** ship the themed,
   branded, both-theme offline page. Quick Tour entry per the documentation rule.

**Wave 3 — The card-build chain** *(serial on `mc-setlog.js`, in this order)*
6. **K-2.2 / `A-14`** lazy logger build + restore-on-build for `restoreSets()`.
7. **VOC-A2** cold-start auto-open of today's first unfinished exercise —
   **after** A-14, because lazy building changes what "the next card" even is.
8. **K-1.5 / G-04** migrate `psu-strength.html` onto `mc-setlog.js` (0/0 → real)
   — same chain, lands once the build path is settled.

**Wave 4 — One visual identity** *(presentation lane, strict order; do not
overlap Wave 5)*
9. **DG-1 → DG-2 → DG-3** choose the face, load and precache it everywhere,
   then run the `--fs-*` swap. **DG-4** (light theme onto tokens) follows the
   scale, never precedes it — otherwise the same rules migrate twice.
10. **DG-5** generate per-program card CSS; **DG-10** the bottom-layer stacking
    contract, closing the surface VOC-A1 exposed at the point-fix level.

**Wave 5 — Boot weight** *(needs exclusive ownership of the tree)*
11. **K-2.3 / `A-17`** — **investigated in full and DROPPED (2026-08-21).**
    The 53-page bare-call estimate undercounted the true hazard surface
    (multi-owner functions, namespace calls: 66 pages / 72 sites, mechanically
    re-derived) and, worse, the "wrap the bare calls, then sweep" plan turned
    out to miss three further hazard shapes only visible once `defer` was
    actually applied and pages live-tested: transitive calls through a
    page-local wrapper function, top-level declarations that read a deferred
    module's export into a binding, and config-overwrite ordering flips
    (`window.MC_SURPRISE` reassigned by both a page and its owning module —
    deferring the module would let it silently clobber the page's config on
    every load). Full writeup, all five hazard shapes, and the decision
    rationale: `card-integration-roadmap.md`'s "`A-17` — investigated in full
    ... and DROPPED" section. All exploratory edits from the investigation
    were reverted; nothing partial shipped. **G-06** (the 100 KB PM module)
    is still open and gets re-evaluated in Wave 6 against its own budget,
    independent of this decision.

**Wave 6 — Ratchets, then payoff features** *(the CI batch first, so everything
after it is protected)*
12. **One `verify.yml` PR:** K-3.1 perf budget + DG-9 kitchen-sink visual
    ratchet + DG-5's `--check`, alongside the store gate already landed in W1.
    — **shipped (2026-08-22).** DG-5's `--check` had already landed in Wave 4;
    this closed the remaining two. **K-3.1**: `tools/measure-session.js`
    gained a `--check`/`--update-check` mode (budgets in
    `tools/perf-budgets.json`, `BUDGET_MULT` 1.5×) against 3 probe pages —
    `pmc-back.html` (S1's original third page) was swapped for
    `psu-strength.html` after live testing found its rest-timer chips sit
    inside a `.ss-ex.mcl-collapsed` superset layer the tool's `enterSession()`
    doesn't know to expand, so no `.rest-timer` ever becomes visible there —
    a real, separate defect worth its own fix later, not blocking this gate.
    Baselines re-measured twice to confirm stability before locking them in
    (mm-p1.html: 301.8 vs 301.9 QSA/s across two runs, everything else
    identical). **DG-9**: `tools/check-visual-ratchet.js` is new —
    full-page, dark-mode-only screenshots (light mode stays
    `check-contrast.js`'s job) of the 5 `kitchen-sink*.html` pages at
    390×844/DPR1, diffed via `pixelmatch` (its v6+ ESM-only export needed a
    CJS interop shim) against committed baselines in
    `tools/visual-baselines/`, 0.5% mismatch budget. Verified both
    directions live: a clean re-screenshot diffs at 0.000% on all 5 pages,
    and an injected `body{background:#ff00ff}` regression was caught at
    40–44% on every page before being reverted. Both new checks wired into
    `verify.yml`'s existing smoke-test job (same Playwright install now also
    pulls `pixelmatch`+`pngjs`), gated behind the render smoke test and
    contrast ratchet passing first so a boot-breaking change fails fast.
13. Then, in any order: **K-3.3** card-header micro-trend (after DG-3),
    **K-3.2** delta sync (after K-1.1), **K-3.4 / VOC-C1** discovery hints,
    **VOC-A3** promo suppression, **VOC-B2** week-delta note, **VOC-C2**
    session-saved toast, **DG-6** motion tokens, **DG-8** comp triage,
    **K-2.4** fill-ins (`.sl-ck` sweep, `index.html` redirect).
    — **K-2.4 shipped (2026-08-22).** `.sl-ck` (mc-superset-hop.js's
    page-native checkbox fallback for a logger that no longer exists —
    `mc-setlog.js`'s `.mcl-ck`/`.set-check` is the only one left) confirmed
    fully dead fleet-wide via `class="X"`/className/string-literal grep, not
    just a hit count, then removed from `mc-superset-hop.js`, `mc-finish.js`
    (6 selector strings + 1 classList check), `mc-group-split.js`,
    `mc-sw-update.js`, `base.css` (dark + light theme rule pairs), and 11
    program HTML pages carrying the identical dead CSS pair. Sibling
    selectors (`.setlog-toggle`/`.setlog-wrap`/`.sl-row`/`.sl-inp`) were
    left untouched — not confirmed dead and outside this ticket's scope.
    `index.html` also carried a `<meta http-equiv="refresh">` racing the
    existing query/hash-preserving JS redirect (G-09) — being blind to
    `?query`/`#hash`, it could win the race and silently drop a deep link;
    removed, leaving the JS redirect + visible fallback link as the single
    path.
    — **DG-8 shipped (2026-08-22) — owner decision: Retire.** Read all four
    comps end-to-end first: a coherent "Onyx" (dark + refined-gold,
    Archivo/Manrope) redesign series, Dashboard → Programs → Conditioning →
    Program Landing, each explicitly continuing the last. Actually shipping
    or formally backlogging it would be a visual-identity-scale decision on
    par with DG-1/DG-2's font choice (which had its own sign-off gate), so
    this was put to the owner via `AskUserQuestion` rather than decided
    unilaterally; **Retire** was chosen. All four `.dc.html` files deleted
    (recoverable via git history). One wrinkle found mid-execution:
    `program-landing-handoff.md`, the Program Landing comp's companion brief,
    documents that the design was **partially already shipped** —
    `mc-program-hero.js`/`mc-program-hero.css` implement its hero and are
    wired into `cat-pmc.html`/`cat-strength.html` — so unlike the other
    three, this doc was kept (status note updated to record the comp's
    retirement) as the living reference for finishing that rollout, rather
    than deleted with its comp. `markup-snippets.md` (the Conditioning
    comp's companion — no shipped descendant) was deleted alongside its
    comp. `content-manifest.json`'s scratch-list, which had `.dc.html`
    entries for only 2 of the 4 comps to begin with (belt-and-suspenders on
    top of `pages.yml`'s blanket `*.dc.html` strip, never fully applied),
    had its now-dangling `Programs Redesign.dc.html` / `Conditioning
    Redesign.dc.html` / `markup-snippets.md` entries removed;
    `program-landing-handoff.md` stayed listed. `tools/build-market.py
    --check` reconfirmed clean after the edit.
    — **DG-6 shipped (2026-08-22) — narrower than scoped.** `base.css`
    gained a `--duration-*`/`--ease-*` token block and every one of its 12
    scattered transition/animation literals was swapped to reference it, a
    strict 1:1 value substitution (e.g. `0.15s` → `var(--duration-fast)`)
    verified live to be zero visual delta: computed `transitionDuration` on
    `.ex-card`/`.rest-timer`/`.next-workout`/`.day-card` matches the
    pre-refactor literal exactly, on real pages, not just by inspection.
    The second half of this ticket — "close the `prefers-reduced-motion`
    gap in `mc-setlog.js`/`mc-setlog.css`" — **turned out not to be a real
    gap** on investigation: `base.css` already carries a blanket
    `@media(prefers-reduced-motion:reduce){*,*::before,*::after{
    animation:none!important;transition:none!important;
    scroll-behavior:auto!important;}}` (shipped 2026-07-15, predating this
    ticket), which `!important`-overrides every transition/animation
    anywhere in the document regardless of file or specificity — confirmed
    live with `page.emulateMedia({reducedMotion:'reduce'})` against
    `mm-p1.html` (`.rest-timer`/`.mcl-toggle .mcl-chev`/`.day-card` all
    collapse to ~0s). `mc-setlog.js`'s own `matchMedia` check
    (`next.scrollIntoView(...)`) isn't redundant with that CSS rule despite
    first appearances: `scrollIntoView({behavior:'smooth'})` requests smooth
    scrolling explicitly, which per spec overrides the page's CSS
    `scroll-behavior` — only `behavior:'auto'` defers to it — so a JS-level
    check is the only way to respect the preference for that one call.
    `mc-setlog.css`'s own transitions carry no `!important`, so the
    blanket rule already wins there too. No code change was needed for
    this half; the CLAUDE.md entry that motivated it undersold what was
    already shipped.

**Standing gate, unchanged:** the owner-side real-device QA matrix (iOS Safari,
Android Chrome, installed PWA, two-device Supabase reconciliation) carried from
B5 — still the last thing between this app and calling L6 done.

### If only one thing ships this week

**Wave 0.** Two files, two small diffs, and they remove the only two moments in
the demo where the app did something the athlete did not ask for: a tap that
cancels their rest clock, and a celebration that means nothing. Everything else
in this document is a system improvement; Wave 0 is the one the user feels on
their next set.


---
---

# HISTORICAL RECORD — 2026-07-21 audit (W-series → LS-1…LS-5, closed)

> Kept verbatim below as the record of the previous Lean Six Sigma pass.
> Its LS-1–LS-5 phases shipped (see Implementation status inside); the
> 2026-08-20 walk above is the current, governing audit.

# Lean Six Sigma Waste Audit — MC Training × Mike's Cookbook

**Date:** 2026-07-21 · **Method:** DOWNTIME 8-waste framework, full-repo static
analysis (reference tracing, cross-repo byte-diffing, payload measurement,
journey walking). **No application code was created or modified by this audit.**
Interactive version (with value stream maps):
https://claude.ai/code/artifact/ac490f90-1349-42ae-9b62-37b7eef44970

## Verdict

The system is leaner than most — prior work (precache trim, module extraction,
one-writer-per-store sync) already removed the easy waste. What remains
clusters into: **dead assets still shipping to every phone**, **hand-maintained
duplication with no drift guard** (the biggest pre-launch defect risk), and
**legacy navigation paths that double the program-landing experience**.
23 findings: 5 high (close before launch), 10 medium, 8 low.

## Baseline (measured, not estimated)

| Metric | MC Training | Mike's Cookbook |
|---|---|---|
| HTML pages / JS modules | 144 / 93 (~24.9k lines) | 5 / 24 |
| Deployable payload | 4.91 MB | ~2.3 MB |
| SW first-install precache | 109 entries · 1.99 MB | 29 entries · 1.75 MB |
| Inline JS in HTML | 1.59 MB (22 pages carry own engines) | minimal |
| Script tags per workout page | 23–27 (38 on dashboard), ≥10 list variants | 16, one shell |
| Synced stores (owned + consumed) | 14 + 1 | 8 + 2 |
| CI gates | 8 (1 report-only) | 4 |

Shared code: 4 byte-identical hand-copied files (verified identical today, no
CI guard), 3 generated tracker copies (`sync-nutrition-modules.py --check`
exists, wired into neither CI), 4 deliberate forks (`mc-supabase/sync/account/export`).

## High findings (close before launch)

- **W-01 — No byte-identity CI guard** for `mc-bridge.js` / `mc-install.js` /
  `mc-backup-status.js`. A drifted copy passes both repos' tests. Fix: `cmp`
  step against the sibling repo in both `pages.yml` files.
- **W-02 — `sync-nutrition-modules.py --check` never runs in CI**, recreating
  the exact drift condition it was built to prevent. Fix: one CI step per repo.
- **W-03 — `mcdb.js` is dead** (zero pages load it) yet precached to every
  device, and its stores `mc_history` + `mc_replace_log` are still in
  `mc-sync.js`'s whitelist and `mc-export.js` — synced forever, written never.
  Fix: delete file, remove both store entries, regen SW.
- **W-04 — Two parallel program landings.** Dashboard routes to
  `cat-mc.html`/`cat-pmc.html`, but split/day/cardio/instructions pages link
  *back* to legacy `mc-home.html`/`pmc-home.html` (no resume banner, older UX).
  Fix: repoint ~20 pages' hrefs; convert legacy pages to redirects.
- **W-05 — 23–27 hand-listed script tags × ~100 pages, ≥10 fingerprint
  variants** (e.g. `mc-summary.js` position differs on pmc pages; `?v=` params
  on only 2 of 25 tags). A missing tag silently drops a feature. Fix: a
  `tools/check-script-manifest.py` CI gate (generate-and-verify, no bundling).

## Medium findings

- **W-06** — 3 orphaned `onyx-*.css` files (28 KB, zero references) precached.
- **W-07** — `faint-instructions.html` unreachable (no `faint` id in
  `mc-pm-data.js`); `cat-ie.html` (Iron Engine) reachable only via a
  `cat-ks.html` cross-link. Register or retire.
- **W-09** — Three engine generations coexist; 22 pages carry inline engines
  (cat-pmc 116 KB, pmc-workout 101 KB, cat-strength 72 KB, kitchen-sink family
  ~278 KB combined). Phased consolidation, kitchen-sink first.
- **W-10** — Two full macro-tracker UIs (~1,744 + ~1,700 lines) over the same
  `mc_macros_v1` store. Post-launch: extract a shared tracker core.
- **W-12** — SW network-first HTML with 2.5 s timeout = up to 2.5 s per page
  hop on gym Wi-Fi with a valid cache present. Flip to stale-while-revalidate;
  the update toast keeps freshness. Highest-leverage *felt* UX change.
- **W-13** — Cookbook boots by parsing 1.07 MB `recipes-data.js`. Measure boot
  cost first; split per collection only if >~150 ms on a mid-range phone.
- **W-15** — Shared-module transport is manual hand-copying. Generalize
  `sync-nutrition-modules.py` into `sync-shared-modules.py` covering all 7
  copied files, `--check` in both CIs.

## Low findings (batched)

W-08 design comps (`*.dc.html`, `stndr-card-concepts.html`) deploy to the
production origin · W-11 accept + document the 4-module fork · W-14 dashboard
147 KB / 38 scripts (extract opportunistically) · W-16 add store-size telemetry
to backup status · W-17 browse path is 4 taps but the 1-tap hero shortcut
already covers the daily loop · W-18 generate per-program CSS from
`mc-pm-data.js` colors (deletes the drift the color-checker exists to catch) ·
W-19 promote the smoke test from report-only to blocking · W-20 cookbook-side
market exclusion needed only when a licensed collection ships · W-21 stray
`?v=` params, `gainz-dark.css` triple theme cascade, historical plans bloating
CLAUDE.md sessions, `tools/` shipping in the Pages artifact · W-22
`mc_daily_v1`/`mc_plan_targets_v1` are live (suspicion resolved — only the two
mcdb stores are dead) · W-23 icon PNGs ≈170 KB, one lossless pass shrinks 60–80 %.

## Cross-app bridge assessment

The bridge is the best-engineered part of the system: one writer per store,
denormalized meal snapshots (workout app never loads recipes-data.js),
single-sourced macro goals, same-origin session sharing, merge logic tested in
both CIs. Its **entire residual risk is process**: the hand-copy transport with
no drift guard (W-01/02/15).

## Prioritized fix roadmap

Each phase gets its own executive summary + approval before code, per house rules.

| Phase | Contents | Closes | Effort | Risk |
|---|---|---|---|---|
| **LS-1 Stop the bleeding** | Byte-identity CI both repos; wire nutrition `--check`; generalize to `sync-shared-modules.py`; promote smoke test | W-01/02/15/19 | 1 session | None (zero app code) |
| **LS-2 Clear dead stock** | Delete mcdb.js + 2 store entries; delete onyx CSS; icon optimization; mc-home/pmc-home redirects; register/retire FAINT + Iron Engine; comps out of deploy | W-03/04/06/07/08/23 | 1–2 sessions | Low |
| **LS-3 Drift-proof the fleet** | `check-script-manifest.py` CI gate; normalize variants | W-05, W-21(part) | 1–2 sessions | Low |
| **LS-4 Feel of the app** | Stale-while-revalidate HTML; measure cookbook boot, split data only if warranted | W-12/13 | 1–2 sessions + device QA | Medium (rides the open B5 device matrix) |
| **LS-5 Consolidate engines** | Kitchen-sink family → shared engine; then iron-engine/hv-block; then pmc pair; CSS generation; optional tracker core | W-09/10/18 | 3–5 sessions phased | Medium |

LS-1 + LS-2 belong before launch; LS-3+ are post-launch lean work.

## Verified lean — do not "fix"

App-shell precache split · lazy-loaded modules (mc-guided, mc-voice,
mc-naming*, PM editors — all deliberate, not dead) · 1-tap hero resume +
36 h resume banner · denormalized meal snapshots · manifest-driven market
extraction · the no-build-step rule (every fix above is generate-and-verify,
never bundle).

## Implementation status

**LS-1 shipped (merged to main).** `tools/sync-shared-modules.py` (all 7
cross-repo copies) + blocking drift check in both repos' CI (W-01/W-02/W-15);
smoke test promoted to blocking after fixing `exercise-library.html`'s legacy
inline SW updater (W-19). Guards immediately caught real drift in
`tracker-barcode.js` (canonical `mc-barcode.js` now capability-checks
`MCInputSheet` with a `window.prompt` fallback).

**LS-2 shipped.** Dead stock cleared: `mcdb.js` deleted + its `mc_history`/
`mc_replace_log` removed from `mc-sync.js` and `mc-export.js` (W-03); 3
orphaned `onyx-*.css` deleted (W-06); all 20 split/day/instructions/cardio
pages repointed from legacy `mc-home.html`/`pmc-home.html` to
`cat-mc.html`/`cat-pmc.html`, the two legacy hubs converted to redirect stubs
so bookmarks survive (W-04); design comps (`*.dc.html`, `stndr-card-concepts`)
stripped from the Pages deploy artifact while kept in-repo (W-08); icon PNGs
losslessly optimized via oxipng, 133 KB → 41 KB (W-23); `faint-instructions.html`
surfaced with a guide link on `cat-faint.html` (W-07 FAINT). **W-07 Iron
Engine resolved to no-change:** owner confirmed it was folded from a standalone
program into a Kitchen Sink split — it is wired into `cat-ks.html` as "Split 2"
in two places, so it is reachable by design, not orphaned. SW precache 109 → 105
entries; net −784 lines.

**LS-3 shipped.** `tools/check-script-manifest.py` (W-05): a CI gate that keys
clone pages by filename role (4 declared families — mc-day ×23, pmc/s3/s4-day
×11, split-index ×12, instructions ×10 = 56 pages) and fails the build if any
family member's ordered `<script src>` list drifts from its siblings — the same
generate-and-verify pattern as `build-sw.py --check`. Grouping is by filename,
not by module set (which would be circular and would wrongly rope in pages like
`cat-pump-new4.html` that only coincidentally share a set while legitimately
interleaving inline config between tags). Real drift fixed to make the gate
green: the 11-page pmc/s3/s4-day family had accidentally shuffled its tail
script block into 3 orders (independent IIFEs, so it drifted invisibly) — all
normalized to one canonical order. The redundant per-file `?v=` cache-bust
params (`?v=45`/`?v=46` on ~90 pages, a manual version that was already
drifting and is moot under the SW's network-first JS strategy) were dropped
fleet-wide (W-21 part). Verified end-to-end: an injected stray param is caught
with an exact diff; all 33 smoke-test pages still render clean.

**LS-4 shipped (session-verifiable half; on-device offline check is the
owner's gate).** W-12: both apps' service workers now use
**stale-while-revalidate** — the cached page/asset is served instantly and the
cache refreshes behind it, so repeat navigations (and the ~25 module loads per
workout page) feel instant on flaky gym/kitchen Wi-Fi instead of waiting up to
2.5–3 s on the network. Cache-first is provably correct here because content
only changes on a deploy, which bumps `CACHE_NAME` (its `activate` purges the
old cache and the page reloads on `controllerchange`), so a new build still
reaches the user via the SW-version path. The strategy logic is unit-tested
against the real `sw.js` in both repos via vm sandbox (`tools/test-mc-sw.js`,
`tools/test-sw-strategy.js` — 4 cases each: cache hit, miss+net-ok,
miss+net-fail→offline, hit+net-fail), now blocking CI steps. **Still the
owner's to close:** true offline-reload behavior on the real deployed origin
(the workout `sw.js` has a pre-existing production-origin guard, so SWR can't
be exercised on localhost) and the real-device QA matrix — same gate B5 left
open. W-13: the cookbook's 1 MB `recipes-data.js` was **measured, not split** —
it's 142 KB gzipped (what mobile downloads) and parses+evals in ~3.5 ms in V8
(~20–35 ms even scaled to a mid-range phone), far under the audit's 150 ms
split threshold, and the SWR change now serves it instantly on repeat visits.
Splitting it would have been effort spent on a non-problem.

**LS-5 in progress (Kitchen Sink family consolidated; other engine targets
deferred).** W-09: the 5 `kitchen-sink*.html` pages each carried their own
inline render engine (~18 KB each) that had **drifted at every layer** — timer,
renderer, badge keywords (`REVERSE PYRAMID` vs `MECHANICAL DROP`), the
conditioning-day branch, and hardcoded-vs-parameterized schedule/eyebrow config
— exactly the "fix it five times" waste W-09 names. All five now load one shared
`ks-engine.js` (a superset built on the most-parameterized variant: schedule +
eyebrow come from a per-page `window.KS_CFG`, both badge keywords are handled,
and the conditioning branch is dormant where a page's data doesn't use it), each
page keeping only its `window.DATA`. **Proven safe, not assumed:** a DOM-parity
harness (`tools/ks-parity.js`) captured each page's rendered `#app` before the
change; after the change all five are **byte-identical** to that baseline. The
smoke test now includes `kitchen-sink.html` so a future break in the shared
engine fails CI. Remaining LS-5 targets — the `iron-engine`/`hv-block` inline
engines, the `cat-pmc`/`pmc-workout` pair, CSS-from-`mc-pm-data.js` generation
(W-18), and the two-tracker-UI dedup (W-10) — are deferred to their own
sub-phases, each to be gated the same way by `tools/ks-parity.js`.
