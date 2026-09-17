'use strict';
/* ==========================================================================
   cr00-render-fleet.js — QA Architect / Beta User baseline.
   Render EVERY tracked page as a phone and record what a real first-open
   would show: thrown exceptions, product console errors, duplicate element
   ids, sideways overflow, and missing local assets.

   This is the DISCOVER+INVENTORY leg of the protocol loop. It is deliberately
   not a pass/fail gate — it is the map every later agent works from.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, productErrors, structure, sleep } = require('./_harness');
const { execSync } = require('child_process');
const fs = require('fs');

(async () => {
  const pages = execSync("git ls-files '*.html'", { cwd: __dirname + '/../../..' })
    .toString().trim().split('\n')
    .filter(p => !p.endsWith('.dc.html'));            // design comps are stripped from the deploy

  const b = await browser();
  const c = await ctx(b);
  const rows = [];
  for (const p of pages) {
    const sink = newSink();
    const page = await c.newPage();
    attach(page, sink);
    let nav = 'ok';
    try {
      const r = await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (!r || r.status() >= 400) nav = 'HTTP ' + (r ? r.status() : 'null');
      await sleep(600);                                // let boot scripts + MC_SCAN settle
    } catch (e) { nav = 'NAV FAIL: ' + String(e.message).split('\n')[0]; }
    let st = {};
    try { st = await structure(page); } catch (e) { st = { err: String(e.message).split('\n')[0] }; }
    const pe = productErrors(sink);
    /* Local 404s are product defects (a missing module or stylesheet); remote
       ones are the sandbox's network policy and are counted separately. */
    const local404 = sink.http.filter(h => !/^\d+ https?:\/\//.test(h));
    rows.push({ page: p, nav, thrown: pe.thrown, consoleErr: pe.console, local404,
                dupeIds: st.dupeIds || [], overflowX: st.overflowX, nodes: st.nodes,
                lang: st.lang, viewportMeta: st.viewportMeta, title: st.title, h1: st.h1 });
    await page.close();
  }
  await b.close();

  fs.writeFileSync(__dirname + '/../../evidence/cr/cr00-render-fleet.json', JSON.stringify(rows, null, 1));

  const bad = r => r.nav !== 'ok' || r.thrown.length || r.consoleErr.length || r.local404.length || r.dupeIds.length || r.overflowX > 0;
  const fails = rows.filter(bad);
  console.log(`cr00 RENDER FLEET — ${rows.length} pages`);
  console.log(`  nav failures     : ${rows.filter(r => r.nav !== 'ok').length}`);
  console.log(`  thrown exceptions: ${rows.filter(r => r.thrown.length).length}`);
  console.log(`  console errors   : ${rows.filter(r => r.consoleErr.length).length}`);
  console.log(`  local 404s       : ${rows.filter(r => r.local404.length).length}`);
  console.log(`  duplicate ids    : ${rows.filter(r => r.dupeIds.length).length}`);
  console.log(`  overflow @390    : ${rows.filter(r => r.overflowX > 0).length}`);
  console.log(`  missing <html lang>: ${rows.filter(r => !r.lang).length}`);
  console.log(`  no viewport-fit=cover: ${rows.filter(r => !/viewport-fit\s*=\s*cover/.test(r.viewportMeta)).length}`);
  console.log(`  total DOM nodes  : ${rows.reduce((a, r) => a + (r.nodes || 0), 0)}`);
  if (fails.length) {
    console.log(`\n--- ${fails.length} page(s) with findings ---`);
    for (const f of fails) {
      const bits = [];
      if (f.nav !== 'ok') bits.push('NAV=' + f.nav);
      if (f.thrown.length) bits.push('THROWN: ' + f.thrown.slice(0, 2).join(' | '));
      if (f.consoleErr.length) bits.push('CONSOLE: ' + f.consoleErr.slice(0, 2).join(' | '));
      if (f.local404.length) bits.push('404: ' + f.local404.slice(0, 3).join(', '));
      if (f.dupeIds.length) bits.push('DUPE-ID: ' + f.dupeIds.slice(0, 5).join(', '));
      if (f.overflowX > 0) bits.push('OVERFLOW +' + f.overflowX + 'px');
      console.log('  ' + f.page + '  ::  ' + bits.join('  ::  '));
    }
  } else console.log('\nno findings');
})();
