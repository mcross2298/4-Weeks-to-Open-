#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-visual-ratchet.js — kitchen-sink screenshot-diff gate (audit DG-9)
   --------------------------------------------------------------------------
   The kitchen-sink family (kitchen-sink.html, -s3/-s4/-s5/-s6.html) is a
   de-facto component gallery — every card state, control, and intensifier
   tag the fleet uses, in one place. Nothing gave it teeth: an unintended
   visual change (a spacing regression, a missing icon, a broken layout)
   could land silently, the same gap DG-9 named. This is that gate — the
   contrast ratchet's sibling, but for STRUCTURE/layout rather than
   per-element color legibility, which check-contrast.js already covers
   fleet-wide in light mode. Dark mode only here on purpose: kitchen-sink is
   viewed in the app's default theme in practice, and doubling every
   screenshot for light mode as well is a scope DG-9's own severity (Low-Med)
   doesn't ask for — light-mode regressions stay check-contrast.js's job.

   Full-page screenshots at deviceScaleFactor:1 (not the app's usual 3x) —
   a retina kitchen-sink screenshot is several MB and slow to diff for no
   real gain in what a pixel-diff can catch; the components under test are
   already large UI blocks, not fine text needing high-DPI fidelity.

   Baselines are committed PNGs under tools/visual-baselines/. A small
   MISMATCH_PCT tolerance absorbs anti-aliasing/font-hinting drift between
   Chromium builds (this repo already accepts that same risk for
   check-contrast.js's numeric budgets, which also run against a freshly
   resolved `playwright@latest` on every CI run) without also absorbing a
   real layout regression, which moves far more than a fraction of a
   percent of the page's pixels.

   Usage:
     node tools/check-visual-ratchet.js <baseUrl>            # CI
     node tools/check-visual-ratchet.js <baseUrl> --update   # (re)write baselines
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
// pixelmatch v6+ ships ESM-only; required from this CJS tool it comes back
// as { default: fn } instead of the function itself.
const pixelmatch = require('pixelmatch').default || require('pixelmatch');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_DIR = path.join(__dirname, 'visual-baselines');
const MISMATCH_PCT = 0.5; // percent of pixels allowed to differ before failing

const PAGES = ['kitchen-sink.html', 'kitchen-sink-s3.html', 'kitchen-sink-s4.html',
  'kitchen-sink-s5.html', 'kitchen-sink-s6.html'];

const base = process.argv[2];
const update = process.argv.includes('--update');
if (!base) {
  console.error('usage: node tools/check-visual-ratchet.js <baseUrl> [--update]');
  process.exit(1);
}

(async () => {
  if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true });

  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  let failed = 0;
  for (const pg of PAGES) {
    await page.goto(base.replace(/\/$/, '') + '/' + pg, { waitUntil: 'domcontentloaded', timeout: 20000 });
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) { /* measure anyway */ }
    await page.waitForTimeout(300);
    const shot = await page.screenshot({ fullPage: true });
    const baselinePath = path.join(BASELINE_DIR, pg.replace('.html', '.png'));

    if (update) {
      fs.writeFileSync(baselinePath, shot);
      console.log('  ' + pg + ': wrote baseline (' + shot.length + ' bytes)');
      continue;
    }

    if (!fs.existsSync(baselinePath)) {
      console.error('::error file=' + pg + '::no visual baseline at ' + path.relative(ROOT, baselinePath) +
        ' — generate one with: node tools/check-visual-ratchet.js <url> --update');
      failed++;
      continue;
    }

    const current = PNG.sync.read(shot);
    const baseline = PNG.sync.read(fs.readFileSync(baselinePath));

    if (current.width !== baseline.width || current.height !== baseline.height) {
      console.error('::error file=' + pg + '::visual ratchet — page dimensions changed (' +
        baseline.width + 'x' + baseline.height + ' -> ' + current.width + 'x' + current.height +
        '). If deliberate, re-baseline with --update.');
      failed++;
      continue;
    }

    const { width, height } = current;
    const diff = new PNG({ width, height });
    const mismatched = pixelmatch(baseline.data, current.data, diff.data, width, height, { threshold: 0.1 });
    const pct = (mismatched / (width * height)) * 100;

    if (pct > MISMATCH_PCT) {
      const diffPath = path.join(BASELINE_DIR, pg.replace('.html', '.diff.png'));
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      console.error('::error file=' + pg + '::visual ratchet regressed — ' + mismatched +
        ' px changed (' + pct.toFixed(2) + '%, budget ' + MISMATCH_PCT +
        '%). Diff image written to ' + path.relative(ROOT, diffPath) +
        '. If deliberate, re-baseline with --update.');
      failed++;
    } else {
      console.log('  ' + pg + ': ' + mismatched + ' px changed (' + pct.toFixed(3) + '%) — within budget');
    }
  }

  await browser.close();

  if (update) {
    console.log('\n  Baselines written — ' + PAGES.length + ' page(s).');
    return;
  }
  if (failed) {
    console.error('\n' + failed + ' page(s) failed the visual ratchet.');
    process.exitCode = 1;
  } else {
    console.log('\nVisual ratchet OK — ' + PAGES.length + ' page(s), none over ' + MISMATCH_PCT + '% budget.');
  }
})().catch((e) => { console.error('check-visual-ratchet crashed — ' + e.message); process.exit(1); });
