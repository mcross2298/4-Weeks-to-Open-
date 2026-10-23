# Flagship audit — health, program engines, gym readiness

Three audit phases run with the owner on 2026-10-23 against `main @ 27fc096`.
**The plan built from them is [`flagship-readiness-roadmap.md`](../../flagship-readiness-roadmap.md)**:
the locked decisions, the 40-item defect register with `file:line` root causes,
and the phases that fix them. Start there; this folder is the evidence behind it.

| File | What it holds |
|---|---|
| [`phase1-health-audit.html`](phase1-health-audit.html) | Phase 1 — codebase health, VOC/VOA journeys, top pain points, design recommendations. Published as https://claude.ai/artifact/4fdtxhosnkwn7rJspwuDgs |
| [`phase2-master-audit.html`](phase2-master-audit.html) | Phase 2 — health index, parameter verification matrix (splits, formulas, progression, rest, RPE), tab-by-tab compliance, master roadmap. Published as https://claude.ai/artifact/EVshNAH1dQB3bnTAQfp7qb (version 2, carrying the increment correction) |
| [`phase3-gym-readiness.html`](phase3-gym-readiness.html) | Phase 3 — readiness rating, session resiliency, in-gym flow and ergonomics, data mobility, flagship polish action plan. Published as https://claude.ai/artifact/6ZMwVdJcpnM4KnzkjCQtda |
| `scenarios/` | Runnable reproductions. Every check asserts the **decided** behavior |
| `evidence/` | Each scenario's output as captured on the audited tree |

The HTML files are copies of the published reports with only a document
skeleton added. Each page's leading comment names the artifact it was copied
from. The published pages are the reviewed originals.

## The scenarios are acceptance tests, not CI gates

Each check states the behavior the owner chose, so **on the audited tree the
open defects print as FAIL**. A FAIL is an open roadmap item, not a broken
harness. Each check should flip to PASS when its roadmap step ships, and that
is the moment to wire it into `verify.yml`. They are not wired in now on
purpose: a gate that is red from birth gets turned off (`W-I1`).

Controls guard against a harness that fails for its own reasons. C-01/C-02 and
S-01–S-03 exercise behavior that already works, and they pass on the audited
tree. If a control fails, look at the harness or the environment before the app.

| Scenario | How to run | On `main @ 27fc096` |
|---|---|---|
| `fa-engines.js` | `node GO_LIVE/flagship-audit/scenarios/fa-engines.js` — Node only, loads the real `mc-suggest`/`mc-log-read`/`mc-classify`/`mc-setlog`/`mc-sync` | 14 checks: 3 pass, 11 fail |
| `fa-repro.js` | `python3 -m http.server 8080` from the repo root, then `NODE_PATH=<dir with playwright> node GO_LIVE/flagship-audit/scenarios/fa-repro.js http://localhost:8080` | 23 checks: 2 controls pass, 21 fail |
| `fa-offline-sw.js` | `NODE_PATH=<dir with playwright> node GO_LIVE/flagship-audit/scenarios/fa-offline-sw.js` — needs `git`, `openssl` and `python3`; serves a copy of the tree as the production origin over a throwaway self-signed certificate | 7 checks: 3 controls pass, 4 fail |
| `fa-kill-window.js` | `NODE_PATH=<dir with playwright> node GO_LIVE/flagship-audit/scenarios/fa-kill-window.js http://localhost:8080` — Linux only (`pkill`); a measurement, not pass/fail | lost at 0.3 s and 1.5 s, kept at 3 s and 6 s |

`fa-https-server.py` is `fa-offline-sw.js`'s helper and isn't run directly.
Set `MC_CHROMIUM=/path/to/chrome` to use a specific browser build. The three
pass/fail scenarios exit 1 when any check fails, so each can become a CI step
unchanged once it's green.

**Why `fa-offline-sw.js` mirrors the production origin.** `sw.js` acts only on
`https://mcross2298.github.io`, so on `localhost` the service worker never
controls the page and offline behavior can't be observed. The scenario points
Chromium's host resolver at a local HTTPS server holding a copy of the tree. It
simulates a deploy by bumping `CACHE_NAME` in that copy. The repository itself
is never modified.

## What these runs can't show

All browser results come from one sandbox Chromium build (141). They don't
cover real devices or the installed PWA, iOS audio, vibration, storage
eviction, a live sign-in, two-device sync, or a real weak-signal network.
Simulated backgrounding doesn't suspend timers the way a phone does. The
kill-window timings are one trial per delay. The roadmap's device test matrix
lists what only a phone can confirm.

Everything in this folder is scratch-listed through the `GO_LIVE` entry in
`content-manifest.json`, so it ships to neither the GitHub Pages deploy nor the
public Rolodex build.
