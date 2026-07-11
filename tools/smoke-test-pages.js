#!/usr/bin/env node
'use strict';
/* ==========================================================================
   smoke-test-pages.js — headless render smoke test (Phase 3.4)
   --------------------------------------------------------------------------
   Loads a sample of pages spanning every distinct render engine in the app
   (the plain-HTML shell, the mc-pm-data.js-backed catalog pages touched in
   Phase 3.3, the mm-engine.js pages data-driven in Phase 3.2, and a few
   others) in a real headless browser and asserts each one produces zero
   console errors. This is intentionally a SAMPLE, not exhaustive coverage
   of the ~160+ HTML pages in the repo — it exists to catch the class of
   bug none of the other CI checks can (a page that fails to render at all,
   a script that throws on load), not to replace per-feature testing.

   CI-only tooling: Playwright is not a repo dependency (no package.json
   here, deliberately — see CLAUDE.md's "no build step" philosophy for the
   app itself). The workflow step installs it into a scratch prefix outside
   the repo and points NODE_PATH at it; this script just requires('playwright')
   and trusts it's resolvable.

   Usage: node tools/smoke-test-pages.js <baseUrl>
     e.g. node tools/smoke-test-pages.js http://localhost:8080
   Exit code 1 if any sampled page threw a console/page error.
   ========================================================================== */
const { chromium } = require('playwright');

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('::error::usage: node tools/smoke-test-pages.js <baseUrl>');
  process.exit(1);
}

// One representative page per distinct render engine/pattern, plus the
// core shell — not every catalog/workout page (168 total; see Phase 3.5,
// deferred, for whether the wider fleet is worth data-driving at all).
const PAGES = [
  'index.html',
  'dashboard.html',
  'dashboard.html?tab=conditioning',
  'exercise-library.html',
  'program-guide.html',
  'stats.html',
  'quick-tour.html',
  'quick-tour-overview.html',
  // mc-pm-data.js-backed catalog pages (Phase 3.3)
  'cat-strength.html',
  'cat-pmc.html',
  'cat-mc.html',
  'cat-ks.html',
  'cat-mm.html',
  'cat-hv.html',
  'pmc-workout.html',
  // mm-engine.js / mm-data.js pages (Phase 3.2)
  'mm-p1.html',
  'mm-p2.html',
  'mm-p3.html'
];

async function checkPage(context, path) {
  const page = await context.newPage();
  const errors = [];
  // pageerror (an uncaught exception) is always a real bug. console 'error'
  // is noisier — the browser logs every failed resource fetch that way too
  // (a blocked CDN/font route, a missing optional asset), which isn't what
  // this check is for, so only count console errors that don't look like a
  // bare resource-load failure.
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (/Failed to load resource/i.test(msg.text())) return;
    errors.push('console: ' + msg.text());
  });

  // Disabling serviceWorker registration avoids a known first-load reload
  // race (a fresh SW registration in a clean browser context can activate
  // and reload the page mid-check). mc-sw-update.js's own truthy guard
  // (`if (!navigator.serviceWorker) return;`, fixed in this same phase —
  // it used to be `!('serviceWorker' in navigator)`, which doesn't catch
  // a defined-but-undefined property) makes this a clean no-op rather than
  // a thrown error.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
  });

  let navError = null;
  try {
    await page.goto(baseUrl.replace(/\/$/, '') + '/' + path, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(500);
  } catch (e) {
    navError = e.message;
  }

  await page.close();
  return { path, errors, navError };
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Third-party requests aren't reachable in CI and aren't the point of
  // this check — block them so they don't register as noise.
  await context.route('**://fonts.googleapis.com/**', (r) => r.abort());
  await context.route('**://cdn.jsdelivr.net/**', (r) => r.abort());

  let anyFailed = false;
  for (const path of PAGES) {
    const result = await checkPage(context, path);
    if (result.navError) {
      console.error('::error::' + path + ': failed to load — ' + result.navError);
      anyFailed = true;
    } else if (result.errors.length) {
      result.errors.forEach((e) => console.error('::error::' + path + ': ' + e));
      anyFailed = true;
    } else {
      console.log(path + ': OK');
    }
  }

  await browser.close();

  if (anyFailed) {
    console.error('\nsmoke-test-pages.js: one or more sampled pages had console/page errors');
    process.exit(1);
  }
  console.log('\nsmoke-test-pages.js: all ' + PAGES.length + ' sampled pages rendered with zero console errors');
})().catch((e) => { console.error('::error::smoke-test-pages.js crashed — ' + e.message); process.exit(1); });
