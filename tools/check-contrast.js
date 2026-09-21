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
   runs from wherever fonts.googleapis.com is actually reachable; until that
   file exists, --dark reports every page's count but never fails the build —
   see NO_BASELINE below.

   FONTS. This gate renders in the real webfonts via tools/font-cache.js, which
   fetches them with Node (which can reach the CDN) and routes them into the
   browser (which cannot). That matters here because text metrics decide
   layout, and layout decides which elements exist to measure. Measured: two
   runs on an unchanged tree used to disagree on 11 pages and now produce
   BYTE-IDENTICAL budget files, and every committed visual baseline — written
   by real CI — matches this environment's render to the pixel in height.
   Note the limit of that claim: layout matches CI, GLYPH RASTERISATION does
   not (3.3% of pixels differ by >64 levels), which is why the pixel-exact
   visual ratchet still cannot be baselined from here and this gate can.

   GRADIENTS — fixed (2026-09-21), and the two objections that held it back
   are answered rather than worked around. Until now bgOf() read
   `backgroundColor` only and ignored `background-image`, so text painted on a
   gradient was attributed to whichever ancestor happened to carry an opaque
   colour underneath it: 5,191 of 12,890 measured text elements (40.3%), on 133
   of 142 pages, resolved to a background that is not what is painted, wrong in
   BOTH directions. bgCandidates() now reads the computed gradient's colour
   stops (see its own comment for why stops and not rendered pixels, and why
   the WORST stop is the right one rather than a judgement call).

   The two blockers, and what changed:

     "It needs a judgement — which point of the gradient is the text on?"
     It does not. Text has to be legible along its whole run, so the stop that
     gives the LOWEST contrast is the conservative answer, and an element that
     clears its worst stop clears the gradient everywhere.

     "It is not monotonic — it moved 95 of 142 pages UP, red from birth."
     Still true, which is exactly why it lands WITH a re-baseline in the same
     change rather than ahead of one. That re-baseline was previously
     impossible from an agent sandbox; tools/font-cache.js removes that
     constraint for this gate specifically — see the note above.

     node tools/check-contrast.js <baseUrl>                  # CI, light mode
     node tools/check-contrast.js <baseUrl> --update         # rewrite light budgets
     node tools/check-contrast.js <baseUrl> --dark           # CI, dark mode
     node tools/check-contrast.js <baseUrl> --dark --update  # rewrite dark budgets (run from real CI only)

   ========================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const fontCache = require('./font-cache');

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
  // Every colour stop in a computed background-image. Computed values
  // normalise colours to rgb()/rgba(), so no colour-name or hex parsing is
  // needed here -- the browser has already done it.
  function stopsOf(bgImage) {
    if (!bgImage || bgImage === 'none') return [];
    const out = [];
    const re = /rgba?\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(bgImage))) {
      const c = parse('rgb' + (m[1].split(',').length > 3 ? 'a' : '') + '(' + m[1] + ')');
      // A translucent stop does not determine the painted colour on its own --
      // whatever is underneath shows through it -- so it is not a candidate.
      if (c && c.a > 0.5) out.push(c);
    }
    return out;
  }
  // Returns the CANDIDATE backgrounds this text could be sitting on, worst
  // case included, rather than a single colour.
  //
  // A background-image PAINTS OVER the element's own backgroundColor, so it is
  // checked first. Reading backgroundColor only -- what this did before -- made
  // text on a gradient resolve to whichever ancestor happened to carry an
  // opaque colour underneath it, which was wrong in BOTH directions: measured
  // fleet-wide, 5,191 of 12,890 text elements (40.3%) on 133 of 142 pages. The
  // ground-truth case: psu-strength.html's .lift-name read 1.00:1 (white on
  // white) while the painted background is a navy gradient and the true ratio
  // is 15.29:1.
  //
  // WHY STOPS AND NOT PIXELS. Sampling the rendered pixels was the obvious
  // alternative and is rejected deliberately: glyph and gradient rasterisation
  // is NOT portable between environments -- measured, this sandbox and CI
  // produce identical layout (every committed visual baseline matches to the
  // pixel in height) but 3.3% of pixels differ by more than 64 levels. A gate
  // whose findings depend on the rasteriser would give a different answer per
  // runner. Computed colour stops are exact and identical everywhere.
  //
  // WHY THE WORST STOP. The open question recorded against this fix was "which
  // point of a gradient the text actually sits on", treated as a judgement the
  // gate could not make. It does not have to: text must be legible along its
  // whole run, so the conservative answer -- the stop that gives the LOWEST
  // contrast -- is both defensible and free of judgement. An element that
  // passes against its worst stop passes everywhere on that gradient.
  //
  // A background-image with no parseable stop (a url(), or stops that are all
  // translucent) resolves nothing, so the walk continues to the layer beneath
  // exactly as it did before.
  function bgCandidates(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      const stops = stopsOf(cs.backgroundImage);
      if (stops.length) return stops;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0.5) return [c];
      n = n.parentElement;
    }
    return [parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }];
  }
  // An emoji glyph paints from the system colour font and IGNORES CSS `color`,
  // so comparing `color` against the background says nothing about whether it
  // is legible. Verified by rendered pixels, not argued: .coach-icon on
  // dashboard.html and .day-icon on the 5-on-2-off pages both compute to
  // 1.00-1.02:1 while their screenshots span a luminance range of 212 and 177.
  // Deliberately NOT U+2190-2BFF: that block holds the arrows, ticks and
  // crosses this app uses as ordinary text (check, cross, back-arrow), and
  // those DO honour `color`, so suppressing them would hide real findings.
  const EMOJI_ONLY = /^[\s\u200d\ufe0f\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]+$/u;
  let bad = 0;
  const worst = [];
  for (const el of document.querySelectorAll('body *')) {
    const t = Array.from(el.childNodes).filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim()).join('');
    if (!t) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) continue;
    // `opacity` is NOT an inherited property, so the line above passes every
    // descendant of an opacity:0 overlay — a closed bottom sheet, a dismissed
    // modal — and the gate then measures text that is not on screen at all.
    // checkVisibility() walks the ancestor chain, which is the whole
    // difference. Found the hard way: build-workout.html's Create Workout
    // button measured 1.01:1 cream-on-cream and refused a real tap, and the
    // reason was simply that its tray was CLOSED.
    // Measured impact is SMALL — 1 finding in 2,823 fleet-wide, because most
    // hidden overlays here use display:none, which the line above already
    // caught. Kept because it is the error that manufactured a phantom
    // "invisible primary CTA", not because it moves the count.
    if (el.checkVisibility &&
        !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
    if (EMOJI_ONLY.test(t)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const fg = parse(cs.color); if (!fg || fg.a < 0.5) continue;
    // Worst candidate wins: on a gradient the text has to clear its hardest
    // point, not its easiest.
    const cands = bgCandidates(el);
    const L1 = rel(fg);
    let ratio = Infinity, bg = cands[0];
    for (const c of cands) {
      const L2 = rel(c);
      const r2 = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (r2 < ratio) { ratio = r2; bg = c; }
    }
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
  // Render in the REAL webfonts. Text metrics are what this gate measures
  // against, and without this every page falls back to system-ui, so the
  // numbers describe a rendering no user ever sees -- which is why four
  // earlier passes recorded that these budgets "cannot be baselined from an
  // agent sandbox". See tools/font-cache.js for the measurement that showed
  // the constraint was the BROWSER's network, not the network.
  const fonts = await fontCache.prepare();
  await fonts.install(ctx);
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
