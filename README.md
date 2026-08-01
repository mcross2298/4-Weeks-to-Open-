# MC Training (4-Weeks-to-Open-)

Mike Cross' training PWA — a multi-page, no-build web app of workout
programs, an exercise library, a conditioning tool, and a macros tracker,
installable as a home-screen app on iOS/Android and usable offline.

This is the **master repository**. [`MC-Training-Rolodex`](https://github.com/mcross2298/MC-Training-Rolodex)
is a generated downstream deploy target (the public/market build with
licensed influencer content stripped) — never developed on directly. See
[`CLAUDE.md`](CLAUDE.md) for the full repository relationship, deploy
pipeline, and every project convention (design system, program layout
standard, exercise-library rules, station-anchoring rules, etc.); that file
is the source of truth for contribution rules.

## What's in the app

- **10 training programs** (`mc-pm-data.js`) — 6 flagship (Strength &
  Supersets, Project Muscle Confusion, Mike Cross' Favorite Splits,
  Everything Under the Kitchen Sink, The Modality Matrix, High-Volume
  Training Template) and 4 licensed-influencer programs (STNDR, Daily Pump,
  Daily Gainz, PSU Football).
- **A 577-exercise catalog** (`exercise-catalog.js`), deduplicated to true
  mechanical variations, every entry tagged with `equipment` and `movement`
  so the substitute picker (`mc-card-actions.js` + `mc-biomech.js`) can
  suggest biomechanically close swaps.
- **Conditioning Corner** — a library of conditioning workouts
  (`conditioning-data.js`) rendered as its own dashboard tab.
- **A macros/nutrition tracker** (`mc-macros.js`) with a food-lookup API and
  a read-only bridge (`mc-bridge.js`) to a sibling PWA, Mike's Cookbook,
  for planned-meal logging and training-day-aware macro targets.
- **PM (owner) mode** — inline editing of programs and Conditioning Corner
  content, and publishing user-built programs, backed by Supabase.
- **Installable PWA** — `manifest.json` + a versioned, stale-while-revalidate
  service worker (`sw.js`) cache real offline use, not just an app-icon.

## Tech stack

Deliberately no framework and no build step:

- **Frontend:** plain multi-page HTML + `base.css` + a shared set of
  `mc-*.js` vanilla-JS modules (~90 files), one page per workout/split/tool.
  No bundler, no `package.json` — CI installs Playwright into a scratch
  prefix outside the repo only when it needs a headless browser.
- **Backend:** [Supabase](https://supabase.com) — accounts/auth, PM-mode
  publish + inline edits, backup status, food-macro lookups, and a scheduled
  Edge Function (`weekly-checkin`, fired by `.github/workflows/weekly-checkin.yml`
  every Sunday) that pushes a check-in to trainees who haven't opened the
  app that day.
- **Offline/installable:** a single service worker (`sw.js`) with a
  run-scoped cache version, precaching the app shell and caching every other
  page on first visit (network-first with cache fallback).
- **Deploy:** GitHub Pages, via `.github/workflows/pages.yml`. A second
  workflow (`market-deploy.yml`) extracts a licensed-content-free tree
  (`tools/build-market.py`, driven by `content-manifest.json`) and
  force-pushes it to `MC-Training-Rolodex` on every push to `main`.

## Running it locally

There's no build step — serve the directory statically and open it:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/index.html (redirects to dashboard.html)
```

PM (owner) mode and the macros tracker's food lookups need a configured
Supabase project (see `mc-supabase.js` for the client setup) — everything
else works fully client-side against `localStorage`.

## Tests & CI

All checks run as plain `node`/`python3` scripts against the real source —
no test framework, no compiled fixtures. See **CLAUDE.md → Build, Test & CI**
for the full command list and what each of the 5 GitHub Actions workflows
(`pr.yml`, `verify.yml`, `pages.yml`, `market-deploy.yml`,
`weekly-checkin.yml`) does. The short version: every pull request runs the
same `verify.yml` gate list the deploy runs (JS syntax, program-data/color/
naming conventions, service-worker freshness, a headless-Chromium render +
contrast smoke test), so a green PR is a green deploy.

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) first — it governs planning process (produce
an artifact/roadmap before implementing non-trivial changes), the program
layout standard, station-anchoring/equipment rules for supersets, and the
new-program creation pipeline.
