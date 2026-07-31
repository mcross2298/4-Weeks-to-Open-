#!/usr/bin/env node
'use strict';
/* ==========================================================================
   dom-parity.js — semantic render-equivalence harness (audit G5)
   --------------------------------------------------------------------------
   ks-parity.js captures raw #app innerHTML and diffs it byte-for-byte. That
   worked for the Kitchen Sink consolidation because those five pages were true
   clones: identical templates, so identical output whitespace.

   It does NOT work for the remaining clone families. Their templates have
   drifted in FORMATTING as well as behaviour — one page writes

       <div class="ex-sets-row"><span class="ex-sets">${sets}</span></div>

   and its sibling writes the same markup across four indented lines. Both
   render identically in a browser; their innerHTML strings differ by dozens of
   whitespace-only lines. Byte-identity is therefore unattainable by
   construction for exactly the pages that most need consolidating — the
   formatting drift IS the problem being fixed.

   This harness compares what a user actually gets: element structure, tag
   names, attributes (class lists set-compared, since order is not meaningful),
   and collapsed text content. Whitespace BETWEEN elements is ignored;
   whitespace WITHIN text is collapsed but not dropped, so a missing word or a
   changed rest interval still fails.

   Anything that changes rendered meaning — a lost note, a dropped badge, a
   different exercise name, a changed data-id — still fails the diff.

   Workflow:
     python3 -m http.server 8080 &
     node tools/dom-parity.js http://localhost:8080 /tmp/before page.html ...
     # refactor, then:
     node tools/dom-parity.js http://localhost:8080 /tmp/after  page.html ...
     diff -r /tmp/before /tmp/after     # empty == semantically identical
   ========================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2];
const outdir = process.argv[3];
const pages = process.argv.slice(4);
if (!base || !outdir || !pages.length) {
  console.error('usage: node tools/dom-parity.js <baseUrl> <outDir> <page.html> [page.html ...]');
  process.exit(1);
}

// Serialised in the browser. Emits one line per element: depth, tag, sorted
// attributes, and this element's own text (not descendants', so text is
// attributed to the element that actually owns it).
const SNAPSHOT = () => {
  const root = document.querySelector('#app');
  if (!root) return '<<NO #app>>';
  const lines = [];
  const walk = (el, depth) => {
    const attrs = [...el.attributes]
      .map(a => {
        // class order is not meaningful and varies with how a template
        // interpolates empty modifier slots; compare as a set.
        if (a.name === 'class') {
          const cls = a.value.split(/\s+/).filter(Boolean).sort().join(' ');
          return cls ? 'class=' + cls : null;
        }
        return a.name + '=' + a.value.replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean)
      .sort()
      .join('|');
    const own = [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    lines.push(`${depth}\t${el.tagName.toLowerCase()}\t${attrs}\t${own}`);
    for (const c of el.children) walk(c, depth + 1);
  };
  for (const c of root.children) walk(c, 0);
  return lines.join('\n');
};

(async () => {
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch();
  let failed = 0;
  for (const p of pages) {
    const ctx = await browser.newContext();          // fresh localStorage per page
    const pg = await ctx.newPage();
    await ctx.route('**://cdn.jsdelivr.net/**', r => r.abort());
    await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
    const errors = [];
    pg.on('pageerror', e => errors.push(e.message));
    await pg.goto(base.replace(/\/$/, '') + '/' + p, { waitUntil: 'networkidle', timeout: 30000 });
    await pg.waitForTimeout(1500);                   // let engine + modules settle
    const snap = await pg.evaluate(SNAPSHOT);
    if (snap === '<<NO #app>>' || !snap.length) failed++;
    fs.writeFileSync(path.join(outdir, p), snap);
    const note = errors.length ? `  ⚠ ${errors.length} page error(s): ${errors[0].slice(0, 60)}` : '';
    console.log(`${p}: ${snap.split('\n').length} elements${note}`);
    if (errors.length) failed++;
    await ctx.close();
  }
  await browser.close();
  if (failed) {
    console.error(`\n${failed} page(s) failed to render cleanly — snapshot is not trustworthy.`);
    process.exit(1);
  }
})().catch(e => { console.error('dom-parity crashed — ' + e.message); process.exit(1); });
