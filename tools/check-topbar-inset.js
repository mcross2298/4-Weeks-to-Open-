#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-topbar-inset.js — a page's TOPMOST bar must paint the notch band
   --------------------------------------------------------------------------
   The bug this exists to stop coming back.

   base.css's PWA safe-area block pins sticky chrome below the notch with
   `top:env(safe-area-inset-top)`. That is right for a SECONDARY bar (.tabs-bar,
   .week-tabs, .week-selector, .phase-tabs) — something else is painted above
   it, so the offset lands it against real chrome. `.topbar` was in that group
   too, and `.topbar` is the TOPMOST bar on its page: pinning it at the inset
   put its top edge at y=59 on a notched device with NOTHING above it, so the
   status-bar band was left unpainted and page content scrolled through it in
   plain sight. dashboard.html compounded it, because it ALSO pads its own
   content down by the inset — the bar was inset twice and its title sat ~118px
   down the screen. The comment above that group asserted the dashboard "carries
   its own — none are touched here, so the dashboard shell can't double-inset";
   the bare `.topbar` in the selector list is exactly what made that false, and
   the comment also said ONE page declares a sticky .topbar when seven do.

   Separately, every one of those seven painted itself with
   `linear-gradient(<bg> 80%, transparent)` — a fade INSIDE the bar, so the
   bottom fifth of the header was see-through and scrolling content read
   straight through the chrome. That band scales with the bar, so it grew from
   15px to 27px once the inset padded the bar taller.

   Neither half is visible to any other gate: check-journey.js measures session
   chrome on 9 pages (none of these seven), the contrast and visual ratchets
   sample at scroll-top where nothing is under the bar yet, and env() resolves
   to 0 headlessly, so both defects are invisible in a normal browser tab. This
   is a SOURCE check for the same reason check-journey.js's safe-area pass is.

   Asserts:
     1. base.css never puts `.topbar` back in a `top:env(safe-area-inset-top)`
        selector group.
     2. Every page declaring a sticky/fixed `.topbar` pins it at `top:0`.
     3. ...and absorbs the inset as `padding-top`, so its background paints the
        band.
     4. ...and paints an OPAQUE background — no fade to `transparent` inside the
        bar. A soft edge belongs on a `::after` scrim hanging below it.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const fail = [];

/* ── 1. base.css must not offset .topbar ───────────────────────────────── */
// strip CSS comments first — this file's own explanation of the bug names
// `.topbar` repeatedly, and a comment is not a selector.
const stripCss = css => css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const base = stripCss(fs.readFileSync(path.join(ROOT, 'base.css'), 'utf8'));
// every `... {top:env(safe-area-inset-top)...}` rule, with its full selector list
const topGroup = /([^{}]*)\{[^{}]*top:\s*env\(safe-area-inset-top\)[^{}]*\}/g;
let g;
while ((g = topGroup.exec(base)) !== null) {
  const sel = g[1];
  if (/(^|[\s,>+~])\.topbar(?![-\w])/.test(sel)) {
    fail.push(
      'base.css: `.topbar` is back in a `top:env(safe-area-inset-top)` group.\n' +
      '    A .topbar is the TOPMOST bar on its page — offsetting it leaves the\n' +
      '    status-bar band unpainted and page content scrolls through it.\n' +
      '    Pin it at top:0 and absorb the inset as padding-top instead.\n' +
      '    selector: ' + sel.trim().replace(/\s+/g, ' ')
    );
  }
}

/* ── 2-4. every page declaring a sticky/fixed .topbar ──────────────────── */
const htmlFiles = execSync('git ls-files "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean);

// the `.topbar{...}` rule bodies a page declares itself (not .topbar-title etc.)
const RULE = /(^|[\s,}])\.topbar\s*\{([^}]*)\}/g;

let checked = 0;
for (const f of htmlFiles) {
  const src = stripCss(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  let m, bodies = [];
  RULE.lastIndex = 0;
  while ((m = RULE.exec(src)) !== null) bodies.push(m[2]);
  if (!bodies.length) continue;

  // the positioned declaration, if any
  const posBody = bodies.find(b => /position:\s*(sticky|fixed)/.test(b));
  if (!posBody) continue;          // static .topbar — `top` is inert, skip
  checked++;

  const all = bodies.join(';');

  // 2. pinned at the top
  const top = /(^|;)\s*top:\s*([^;]+)/.exec(posBody);
  if (!top || !/^0(px)?$/.test(top[2].trim())) {
    fail.push(`${f}: sticky .topbar must pin at \`top:0\` (found \`top:${top ? top[2].trim() : 'unset'}\`).`);
  }

  // 3. inset absorbed as padding-top
  if (!/padding-top:\s*calc\([^)]*env\(safe-area-inset-top\)/.test(src)) {
    fail.push(
      `${f}: sticky .topbar has no safe-area padding-top.\n` +
      '    Add `@supports (padding: env(safe-area-inset-top)) { .topbar{\n' +
      '    padding-top:calc(<its own padding> + env(safe-area-inset-top)); } }`\n' +
      '    or its title sits under the status bar on a notched device.'
    );
  }

  // 4. opaque — no fade to transparent inside the bar
  const bg = /background(?:-image)?:\s*([^;]+)/.exec(posBody);
  if (bg && /transparent|rgba\([^)]*,\s*0\s*\)/.test(bg[1])) {
    fail.push(
      `${f}: sticky .topbar fades to transparent — content reads through the bar.\n` +
      `    found: background:${bg[1].trim()}\n` +
      '    Paint the bar opaque and hang the soft edge on a `.topbar::after`\n' +
      '    scrim below it, where there is no chrome to read through.'
    );
  }
}

if (fail.length) {
  console.error('check-topbar-inset: FAIL\n');
  fail.forEach(f => console.error('  * ' + f + '\n'));
  process.exit(1);
}
console.log(`check-topbar-inset: OK — ${checked} sticky .topbar page(s) pin at top:0, ` +
            'absorb the inset as padding, and paint opaque.');
