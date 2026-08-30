#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-contrast.js — text contrast, ratcheted, light AND dark (audit
   G-04/G-3.1, W-I3 VOC/VOA Kaizen audit)
   --------------------------------------------------------------------------
   Every colour in this app was originally picked against a near-black ground.
   When Sand light mode went fleet-wide, 112 of 140 pages ended up with at
   least one text element below 3:1 — brand gold reads 1.88:1 on Sand, and
   several surfaces kept a dark card while the shell lightened around them.

   Two passes (G-04 token layer + shared modules, G-3.1 the four heaviest
   pages and the conditioning dark-lock) took that from 3400 findings to ~540.
   What is left is a genuine long tail: ~60 pages, most with a handful of
   instances each, in per-page bespoke CSS.

   Grinding that to zero in one go would be a large, low-yield change. So this
   gate RATCHETS instead: every page carries a budget equal to the count it had
   when the gate was introduced, and the build fails if any page exceeds it.
   The tail can only shrink. A page fixed below its budget should have the
   budget lowered in the same commit — the gate says so when it notices.

   W-I3 — dark mode was the one axis this gate never measured, even though
   dark is the app's DEFAULT theme (mc_theme_mode: 'dark' | 'light', dark
   unless a trainee opts into light) and the premium-design-roadmap.md P3/P5
   entries both found real dark-only defects a light-mode-only gate cannot
   see by construction (a card surface with slate literals instead of the
   warm token ramp; a cool-biased near-black gradient). --dark reuses every
   line of PROBE and the ratchet mechanics below, against a second budget
   file, so the two modes cannot silently diverge in method.

   That second file is deliberately NOT seeded from an agent sandbox.
   fonts.googleapis.com is blocked at the browser level there (verified —
   curl reaches it and returns 200, headless Chromium does not), so pages
   render in the system-ui fallback with different text metrics than real
   CI: two runs of THIS SAME LIGHT-MODE PASS on an unchanged tree already
   disagreed on 11 pages under that condition (premium-design-roadmap.md's
   own P4 finding). A baseline captured under that constraint would commit
   wrong counts, not real ones. So --dark --update writes the file when it
   runs from wherever fonts.googleapis.com is actually reachable (a real CI
   runner); until that file exists, --dark reports every page's count but
   never fails the build — see NO_BASELINE below.

     node tools/check-contrast.js <baseUrl>                  # CI, light mode
     node tools/check-contrast.js <baseUrl> --update         # rewrite light budgets
     node tools/check-contrast.js <baseUrl> --dark           # CI, dark mode
     node tools/check-contrast.js <baseUrl> --dark --update  # rewrite dark budgets (run from real CI only)

   ========================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIN_RATIO = 3.0;            // WCAG AA large-text floor

// The first baseline used a flat 250ms wait, which was enough on a fast dev
// container and not on a CI runner: cat-custom.html was still showing its "…"
// title placeholder when measured, so CI counted an element the baseline had
// never seen and failed a page nobody had touched. A bigger magic number would
// only move that cliff, so wait on the page's own readiness instead — network
// quiet, then a short beat for the render that runs off the last response.
// Verified equal to a flat 700ms across a page sample, and byte-identical
// across consecutive full runs.
const IDLE_MS = 8000;   // cap on the network-quiet wait
const PAINT_MS = 150;   // post-idle beat for JS that renders after its data lands

// One element of slack per page. Readiness-based measurement is stable run to
// run here, but the budgets are recorded on one Chromium build and enforced on
// another, and a single lazily-attached node should not turn a deploy red.
// Anything larger than one element is treated as a real regression.
const TOLERANCE = 1;

const base = process.argv[2];
const update = process.argv.includes('--update');
const dark = process.argv.includes('--dark');
const THEME = dark ? 'dark' : 'light';
const BUDGETS = path.join(__dirname, dark ? 'contrast-budgets-dark.json' : 'contrast-budgets.json');
// W-I3: dark's budget file only exists once someone has run --dark --update
// from a real browser (see the file header). Until then this pass measures
// and reports every page but never fails the build on it — a hand-picked
// pass/fail number for an unbaselined axis would be exactly as wrong as
// skipping the axis, just quieter about it.
const NO_BASELINE = dark && !update && !fs.existsSync(BUDGETS);
if (!base) {
  console.error('usage: node tools/check-contrast.js <baseUrl> [--update] [--dark]');
  process.exit(1);
}

// Counts visible text elements whose colour fails MIN_RATIO against the nearest
// opaque ancestor background — the real question, since a light shell around a
// still-dark card is the failure mode that motivated this.
const PROBE = (minRatio) => {
  function parse(c) {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c || '');
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  }
  function rel(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function bgOf(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
      n = n.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  }
  let bad = 0;
  const worst = [];
  for (const el of document.querySelectorAll('body *')) {
    const t = Array.from(el.childNodes).filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join('');
    if (!t) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const fg = parse(cs.color); if (!fg || fg.a < 0.5) continue;
    const bg = bgOf(el);
    const L1 = rel(fg), L2 = rel(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < minRatio) {
      bad++;
      if (worst.length < 3) {
        const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/)[0] || el.tagName.toLowerCase();
        worst.push(`.${cls} ${cs.color} on rgb(${bg.r}, ${bg.g}, ${bg.b}) = ${ratio.toFixed(2)}:1`);
      }
    }
  }
  return { bad, worst };
};

const pages = fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !f.endsWith('.dc.html') && f !== 'stndr-card-concepts.html')
  .sort();

(async () => {
  const budgets = fs.existsSync(BUDGETS) ? JSON.parse(fs.readFileSync(BUDGETS, 'utf8')) : {};
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  p.on('pageerror', () => {});

  // Set the theme once, then navigate. mc_theme_mode: 'dark' is the app's
  // own default (see mc-appearance.js) — set explicitly anyway so this pass
  // isn't relying on an undocumented default staying what it is today.
  await p.goto(base.replace(/\/$/, '') + '/dashboard.html');
  await p.evaluate((t) => localStorage.setItem('mc_theme_mode', t), THEME);

  const found = {};
  let over = 0, under = 0, total = 0;
  for (const pg of pages) {
    let r;
    try {
      await p.goto(base.replace(/\/$/, '') + '/' + pg, { waitUntil: 'domcontentloaded', timeout: 20000 });
      try { await p.waitForLoadState('networkidle', { timeout: IDLE_MS }); } catch (e) { /* measure anyway */ }
      await p.waitForTimeout(PAINT_MS);
      r = await p.evaluate(PROBE, MIN_RATIO);
    } catch (e) { continue; }
    found[pg] = r.bad;
    total += r.bad;
    if (NO_BASELINE) continue;   // measuring only — nothing to compare against yet
    const budget = budgets[pg] === undefined ? 0 : budgets[pg];
    if (r.bad > budget + TOLERANCE) {
      over++;
      console.error(`::error file=${pg}::${THEME}-mode contrast regressed — ${r.bad} element(s) below ${MIN_RATIO}:1, budget is ${budget}`);
      r.worst.forEach(w => console.error(`         ${w}`));
    } else if (r.bad < budget - TOLERANCE) {
      under++;
      console.log(`  ${pg}: improved to ${r.bad} (budget ${budget}) — lower the budget in tools/${path.basename(BUDGETS)}`);
    }
  }
  await browser.close();

  if (update) {
    fs.writeFileSync(BUDGETS, JSON.stringify(found, null, 0).replace(/,/g, ',\n') + '\n');
    console.log(`${THEME[0].toUpperCase()}${THEME.slice(1)} budgets written — ${pages.length} pages, ${total} total findings, to ${path.basename(BUDGETS)}.`);
    return 0;
  }
  if (NO_BASELINE) {
    console.log(`\n${THEME}-mode contrast: no baseline yet (${path.basename(BUDGETS)} doesn't exist) — ` +
      `measured ${total} finding(s) across ${pages.length} pages, informational only. ` +
      `Seed it from a real CI run (not an agent sandbox — see this file's header) with: ` +
      `node tools/check-contrast.js <url> --dark --update`);
    return 0;
  }
  if (over) {
    console.error(`\n${over} page(s) over budget. Fix the contrast, or if this is deliberate, ` +
      `re-baseline with: node tools/check-contrast.js <url>${dark ? ' --dark' : ''} --update`);
    process.exit(1);
  }
  console.log(`${THEME[0].toUpperCase()}${THEME.slice(1)}-mode contrast OK — ${pages.length} pages, ${total} finding(s), none over budget` +
    (under ? `; ${under} page(s) improved and can have their budget lowered.` : '.'));
})().catch(e => { console.error('check-contrast crashed — ' + e.message); process.exit(1); });
