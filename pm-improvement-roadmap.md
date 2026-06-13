# PM Mode — Efficiency & Continuous-Improvement Roadmap

Status: **PLANNING — ranked backlog, no code yet**
Scope: the owner-only Program Manager surface (`program-manager.js`,
`program-overrides.js`, `mc-naming.js`, `mc-naming-paint.js`,
`mc-supabase.js`) and its build/release path (`tools/build-market.py`).
Repos: `4-Weeks-to-Open-` (master) · `MC-Training-Rolodex` (generated build).

**Explicitly out of scope (by direction):** usage telemetry / analytics /
metrics. This roadmap optimizes the *owner's* editing loop, the *safety* of
changes, *code health*, and the *release process* — not measurement of end-user
behavior. If that changes, a feedback-loop module can be added later.

---

## Module 0 — Where PM Mode stands today

Shipped (Phases 0–3):

- **Override layer** (`program-overrides.js`): a v2 paint-on-top document with
  five sections — `pages`, `exercises`, `programs`, `splits`, `badges` —
  merged published-over-local via `effective()`. Original names are keys;
  renames are paint (invariants G1–G3 of `pm-rename-design.md`).
- **Resolver** (`mc-naming.js`): `MC_NAMES.exercise/program/programMeta/split/
  badge/progOf/splitOf` + `setLocal/clearLocal` + edit counter.
- **Painters** (`mc-naming-paint.js` + `applyToCard`): cards, badge chips,
  split-hub headers, dashboard hero/cards.
- **Editor UI** (`program-manager.js`): the exercise modal (with the new
  global-rename checkbox + tier indicator) and the **Rename Center**
  (programs / splits / badges), all flowing through one Publish/Discard
  pipeline and Supabase `naming_overrides`.

Release architecture (discovered during the Phase 3 review and central to this
roadmap): **`MC-Training-Rolodex` is not a hand-maintained mirror — it is a
generated build.** `tools/build-market.py` extracts a clean public tree from
the master, driven by `content-manifest.json`: it drops `licensed`/`scratch`
files, strips `MARKET:STRIP` regions, filters licensed program tags, and
**leak-scans** the result (`--check` exits 1 on any licensed-file reference or
brand-term mention). Hand-editing Rolodex bypasses this guarantee.

> **Lesson already paid for:** Phase 3 hard-coded all eight program
> names/descriptions into `PROG_DEFAULTS` and the `progOf` regexes, embedding
> licensed brand terms into shipped engine files, and the modules were
> hand-copied into Rolodex — so the leak reached the public repo. It was fixed
> with `MARKET:STRIP` markers + a proper rebuild.
>
> **Verified afterward:** the deploy pipeline already hard-gates on the leak
> check. `.github/workflows/market-deploy.yml` runs `build-market.py --check`
> as a **"Leak check (hard gate)"** step before extract/push, and
> `.github/workflows/market-check.yml` runs it on every PR. Run `27466636487`
> (the leaked `ee8fab9`) confirms it: the gate step **failed** and the Extract
> and Push steps were **skipped** — nothing deployed. The leak reached Rolodex
> *only* because it was hand-pushed, bypassing CI. So the guardrail gap is not
> the leak check (it works) — it is that **nothing prevents a human from
> pushing directly to the generated repo** (see G2/G6 below).

---

## Module 1 — Priority matrix

Effort: **S** ≈ <½ day · **M** ≈ 1–2 days · **L** ≈ 3+ days.
Tiers: **Done** (shipped/verified) · **Now** (ship first) · **Next** · **Later**.

| ID | Item | Area | Impact | Effort | Tier |
| --- | --- | --- | --- | --- | --- |
| B1 | iOS-safe Discard/Export/Import dialogs | Safety (bug) | High | S | ✅ Done |
| G1a | CI leak check (`build-market.py --check`) on PR + deploy hard-gate | Guardrails | High | — | ✅ Done |
| G2a | Auto-deploy: pipeline force-pushes the clean build to Rolodex | Guardrails | High | — | ✅ Done |
| B2 | `progOf()` resolves catalog (`cat-*`) pages | Code health (bug) | Med-High | S | Now |
| G6 | Branch-protect Rolodex `main` (deploy bot only) | Guardrails | High | S | Now |
| G1b | CI: add `node --check` on changed `*.js` | Guardrails | Med | S | Now |
| G3 | Resolver/precedence unit tests | Guardrails | High | M | Next |
| C1 | Single source of truth for program/split/badge/page maps | Code health | High | M-L | Next |
| W1 | "Global exercise renames" list in the Rename Center | Workflow | High | M | Next |
| S1 | Pre-publish review/diff sheet | Safety | High | S-M | Next |
| W2 | "Find exercise" jump from the PM bar | Workflow | High | M | Next |
| S2 | "Preview as user" toggle (published-only) | Safety | Med-High | M | Next |
| W3 | Rename Center search/filter + remembered program | Workflow | Med | S | Next |
| W4 | Selective publish / discard (per section or row) | Workflow | Med | M | Later |
| S3 | Collision & validation warnings | Safety | Med | S-M | Later |
| S4 | Session undo / "recently changed" tray | Safety | Med | M | Later |
| G4 | JSON-schema validation of `program-overrides.json` | Guardrails | Med | S | Later |
| G5 | Coverage test (every prog/badge resolves) | Guardrails | Med | S-M | Later |
| C2 | Consolidate paint observers into one scheduler | Code health | Med | M | Later |
| H1 | Published-state version history + revert | Process | Med-High | M-L | Later |
| H2 | Auto-changelog on Publish | Process | Med | S-M | Later |
| H3 | PM operator playbook doc | Process | Med | S | Later |
| R1 | Draft vs live status on overrides | Staged rollout | Med | M-L | Later |
| R2 | Canary audience (subset rollout) | Staged rollout | Med | L | Later |

---

## Module 2 — Done / verified (shipped this cycle)

### B1 — iOS-PWA-safe Discard/Export/Import dialogs ✅
Native `prompt/alert/confirm` are suppressed in standalone iOS PWAs, so
`doDiscard()`'s `confirm()` silently no-opped and Export/Import gave no
feedback. **Shipped:** added `confirmModal()` and routed Discard through it,
with Export/Import/`openEditor` notices through the `showModal`-based `msg()`.
No native dialogs remain in `program-manager.js`.

### G1a — CI leak check ✅ (already in place, verified)
`.github/workflows/market-check.yml` runs `build-market.py --check` on every
PR; `market-deploy.yml` runs it as a **"Leak check (hard gate)"** before any
extract/push. Verified against run `27466636487`: on the leaked `ee8fab9` the
gate **failed** and Extract + Push were **skipped**. No action needed.

### G2a — Auto-deploy to Rolodex ✅ (already in place, verified)
`market-deploy.yml` (on push to `main`) extracts the clean tree and
**force-pushes it to `MC-Training-Rolodex` as a single fresh commit**
(`mc-market-bot`, message `Clean build from 4-Weeks-to-Open- @ <sha>`).
Rolodex is therefore purely generated — the "parity gate" originally proposed
in G2 is moot; it is already rebuilt-from-source on every deploy.

---

## Module 2b — Now (correctness + the *real* guardrail gap)

### B2 — `progOf()` resolves catalog pages *(bug)*
**Problem.** `mc-naming.js#progOf()` matches *content* prefixes (`pmc-`, `mc-`,
…) but the catalog pages are `cat-pmc.html`, `cat-mc.html`, `cat-bobw.html`,
etc. Only `cat-strength` is special-cased (→`ss`). So every other `cat-*` page
resolves to `null`, and **program-scoped badge/split overrides never paint on a
program's main catalog page** (global-scoped badges still show via fallback).
**Proposal.** Add explicit `cat-*` → progId entries derived from the PROGS
`href` map (`cat-pmc→pmc`, `cat-mc→mc`, `cat-bobw→bobw`, …). Fold into C1 so the
map has one source. Wrap licensed entries in `MARKET:STRIP`.
**Risk.** Low; additive lookups. *(S · Med-High)*

### G6 — Branch-protect Rolodex `main` (the actual root cause)
**Problem.** The pipeline is sound (G1a/G2a), yet the leak still reached the
public repo — because a human (me) **force-pushed directly to Rolodex `main`**,
bypassing CI entirely. The deploy bot is the only thing that should ever write
there.
**Proposal.** Enable branch protection on `MC-Training-Rolodex` `main`:
restrict pushes to the deploy identity (`mc-market-bot` / the
`ROLODEX_DEPLOY_TOKEN` actor) and block direct human pushes and force-pushes
from anyone else. Document "never commit to Rolodex; edit master, let the
pipeline deploy." This is the single change that would have prevented the
incident.
**Risk.** Low (repo setting). Confirm the deploy token's force-push still
satisfies the protection rule (allow the bot, or use a deploy-key bypass).
*(S · High)*

### G1b — Add `node --check` to CI
**Problem.** CI runs only the Python leak check; a JS syntax error in an engine
module (`program-manager.js`, `mc-naming*.js`, …) would still pass CI and
deploy.
**Proposal.** Add a step to `market-check.yml` (and ideally the deploy
pre-gate) that runs `node --check` on every shipped `*.js`. Cheap insurance.
**Risk.** None. *(S · Med)*

---

## Module 3 — Next (resolver integrity, source of truth, top owner wins)

### G3 — Resolver / precedence unit tests
**Problem.** `effective()` and the `MC_NAMES` resolvers encode the precedence
table (`pm-rename-design.md` §1.4) but are untested; a regression would
silently mispaint.
**Proposal.** Node tests (no DOM) covering: exercise `page > global > original`;
program/split/badge fallbacks incl. `badges.global`; `reset` shadowing;
tolerant `trim().toLowerCase()` lookup; export filtering of `reset` entries.
These functions are pure and trivially testable. *(M · High)*

### C1 — Single source of truth for program/split/badge/page maps
**Problem.** The same data is hand-duplicated in ≥4 places: `PROG_DEFAULTS` +
`PROG_ORDER` (`program-manager.js`), `PAGE_PROG`/`PAGE_SPLIT_MAP` (`mc-naming.js`),
`BADGE_DEFAULTS` (here), `BADGE_LABELS` (`cat-*.html`), and the dashboard
`PROGS` array. Each copy needs its own `MARKET:STRIP` markers — which is exactly
what made the leak easy to introduce, and what makes B2 drift-prone.
**Proposal.** Generate one `mc-pm-data.js` (or JSON) at build time from
`dashboard.html` `PROGS` + the cat-page badge maps + `content-manifest.json`
(which already knows licensed vs original). The dashboard and PM Mode both
consume it; `MARKET:STRIP`/tag-filtering happens once, in the generator.
**Risk.** Medium (build-step change); removes a whole class of duplication and
leak risk. *(M-L · High)*

### W1 — "Global exercise renames" list in the Rename Center
**Problem.** The `exercises` (global) tier can only be created/edited from a
card's meatball modal — there is no central place to *review* or manage global
renames. The Rename Center covers programs/splits/badges but not exercises.
**Proposal.** Add an "Exercises (all programs)" section listing every global
override with inline edit + per-row reset + a count, plus a way to add one by
catalog search (reuses the existing picker). Closes the obvious gap in the
panel. *(M · High)*

### S1 — Pre-publish review sheet
**Problem.** `doPublish()` fires immediately; the owner can't see what's about
to go live to everyone.
**Proposal.** Before pushing, show a summary sheet — "N changes: 2 programs,
3 splits, 1 badge, 4 exercises, 5 cards" with the specifics expandable — and a
confirm. Pairs naturally with W4 (selective publish). *(S-M · High)*

### W2 — "Find exercise" jump from the PM bar
**Problem.** To rename an exercise globally you must first navigate to *some*
page that shows it, then open its card menu.
**Proposal.** A search box (PM bar) that finds an exercise in the catalog by
name and opens the global editor directly — no page hunt. *(M · High)*

### S2 — "Preview as user" toggle
**Problem.** The owner always sees their local working copy painted; there's no
quick way to see exactly what published users see.
**Proposal.** A PM-bar toggle that temporarily renders with the published layer
only (`effective()` already separates the two). *(M · Med-High)*

### W3 — Rename Center quality-of-life
Search/filter for the long badge & split lists, remember the last-selected
program across opens, collapsible sections. *(S · Med)*

---

## Module 4 — Later (depth: safety, process, staged rollout, perf)

### W4 — Selective publish / discard
Publish or discard a single section (or row) rather than the whole working
copy. Builds on S1's diff. *(M · Med)*

### S3 — Collision & validation warnings
Per `pm-rename-design.md` §3.4: warn when a global rename makes two distinct
catalog entries display identically, and on empty / over-long names. *(S-M · Med)*

### S4 — Session undo / "recently changed" tray
A small list of the last edits with one-tap revert, instead of all-or-nothing
Discard. *(M · Med)*

### G4 — JSON-schema validation
Validate `program-overrides.json` (v2 shape) in CI and on Import. *(S · Med)*

### G5 — Resolution coverage test
Assert every `PROGS` id resolves through `progOf` for its cat page + split
hubs, and every badge id in the data map exists on ≥1 page. Catches B2-style
gaps automatically. *(S-M · Med)*

### C2 — Consolidate paint observers
`program-overrides.js`, `mc-card-actions.js`, and `mc-naming-paint.js` each run
their own `MutationObserver`/scan. Share one debounced scheduler to cut
redundant scans and reflows. *(M · Med)*

### H1 — Published-state version history + revert
`naming_overrides` keeps only the current row. Add an append-only history
(snapshot or audit rows: scope/scope_id/patch/at/by) and a "Revert to previous
published state" action. *(M-L · Med-High)*

### H2 — Auto-changelog on Publish
On each Publish, record a human-readable diff (what changed, by whom, when) to
a log table or a committed file. *(S-M · Med)*

### H3 — PM operator playbook
A short doc: unlock flow, rename scopes & precedence, publish/rollback, and the
master→`build-market`→Rolodex relationship (so no one hand-edits the build).
*(S · Med)*

### R1 — Draft vs live status
Add `status` (`draft`|`live`) to `naming_overrides`; "Save draft" persists
server-side (syncs across the owner's devices) without going live; "Promote"
flips to live. *(M-L · Med)*

### R2 — Canary audience
An `audience` field (e.g. admins/testers) plus an RLS read filter so a subset
sees changes before everyone. Larger backend change; do after R1. *(L · Med)*

---

## Module 5 — Suggested sequencing

0. **Done this cycle:** B1 (iOS dialogs); verified G1a (CI leak hard-gate) and
   G2a (auto-deploy) are already in place.
1. **3.1 — Close the real gap (Now):** G6 (branch-protect Rolodex `main` — the
   one change that would have prevented the incident), B2 (`cat-*` resolution),
   G1b (`node --check` in CI). Small, high-safety.
2. **3.2 — Trustworthy core (Next):** G3 (tests), C1 (one data source — also
   resolves B2 permanently and shrinks the `MARKET:STRIP` surface).
3. **3.3 — Owner velocity (Next):** W1, W2, S1, W3.
4. **3.4 — Confidence (Later):** S2, S3, S4, W4.
5. **3.5 — Process (Later):** H1, H2, H3.
6. **3.6 — Staged rollout (Later):** R1, then R2.

Each step is independently shippable and leaves `build-market.py --check`
green. Telemetry remains intentionally excluded; revisit only if measuring
adoption becomes a goal.
