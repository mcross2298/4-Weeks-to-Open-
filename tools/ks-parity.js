#!/usr/bin/env node
'use strict';
/* ==========================================================================
   ks-parity.js — DOM-equivalence harness for engine consolidations (audit LS-5).

   Behaviour-preserving refactors (extracting a page's inline render engine into
   a shared module) are only safe if the RENDERED output is provably unchanged.
   This tool captures the post-render innerHTML of a page's #app container so a
   before/after diff can prove byte-identity. It's how the Kitchen Sink family
   (kitchen-sink*.html → ks-engine.js) was verified, and it's the gate to reuse
   for the remaining consolidation targets (iron-engine, the pmc pair, etc.).

   It is a DEV tool, not a CI gate: it needs a baseline captured from the
   pre-refactor pages (which no longer exist post-merge), and it depends on
   Playwright (installed into a scratch prefix in CI, not a repo dependency —
   see .github/workflows/pages.yml and tools/smoke-test-pages.js). The shipped
   CI guard for these pages is the smoke test (kitchen-sink.html is in its list).

   Workflow:
     # 1. before touching anything, on the current branch:
     python3 -m http.server 8080 &
     NODE_PATH=<pw> node tools/ks-parity.js http://localhost:8080 /tmp/before  kitchen-sink.html ...
     # 2. do the refactor, then:
     NODE_PATH=<pw> node tools/ks-parity.js http://localhost:8080 /tmp/after   kitchen-sink.html ...
     # 3. prove identical:
     diff -r /tmp/before /tmp/after      # empty == safe to ship
   ========================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2];
const outdir = process.argv[3];
const pages = process.argv.slice(4);
if (!base || !outdir || !pages.length) {
    console.error('usage: node tools/ks-parity.js <baseUrl> <outDir> <page.html> [page.html ...]');
    process.exit(1);
}

(async () => {
    fs.mkdirSync(outdir, { recursive: true });
    const browser = await chromium.launch();
    for (const p of pages) {
        const ctx = await browser.newContext();       // fresh localStorage per page
        const pg = await ctx.newPage();
        // Third-party + SW noise isn't the point of a render-parity check.
        await ctx.route('**://cdn.jsdelivr.net/**', r => r.abort());
        await ctx.route('**://fonts.googleapis.com/**', r => r.abort());
        await pg.goto(base.replace(/\/$/, '') + '/' + p, { waitUntil: 'networkidle', timeout: 30000 });
        await pg.waitForTimeout(1500);                 // let engine + modules settle
        const html = await pg.$eval('#app', el => el.innerHTML).catch(() => '<<NO #app>>');
        fs.writeFileSync(path.join(outdir, p), html);
        console.log(`${p}: ${html.length} bytes`);
        await ctx.close();
    }
    await browser.close();
})().catch(e => { console.error('ks-parity crashed — ' + e.message); process.exit(1); });
