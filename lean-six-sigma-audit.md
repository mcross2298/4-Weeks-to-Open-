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
