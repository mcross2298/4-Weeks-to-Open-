#!/usr/bin/env node
// SP4 (settings-pathways-roadmap.md): render the app with the made-up athlete
// (tools/fixture-athlete.js) loaded, for screenshots and browser gates.
//
//   node tools/fixture-harness.js <baseUrl> <page> [--width 390] [--out shot.png]
//
// The fixture is written to localStorage before any page script runs, the
// service worker is blocked (it would serve a cached page from another state)
// and every other host is aborted, so the app reads the fixture and nothing
// else. openRoute() refuses a page whose saved log is not the fixture's, so a
// screenshot can never quietly show someone's real training.
'use strict';
const { athlete } = require('./fixture-athlete.js');

const OUTSIDE = /supabase\.co|fonts\.googleapis|fonts\.gstatic|jsdelivr|esm\.sh|unpkg|cdnjs/;

async function fixtureContext(browser, opts) {
  const o = opts || {};
  const data = athlete(o.today);
  const ctx = await browser.newContext({ viewport: { width: o.width || 390, height: o.height || 844 }, serviceWorkers: 'block' });
  await ctx.route(OUTSIDE, r => r.abort());
  await ctx.addInitScript(d => {
    try { Object.keys(d).forEach(k => localStorage.setItem(k, d[k])); sessionStorage.setItem('mc_launched', '1'); } catch (e) {}
  }, data);
  ctx.__fixture = data;
  return ctx;
}

async function openRoute(ctx, base, page, waitMs) {
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(base.replace(/\/$/, '') + '/' + page.replace(/^\//, ''));
  await p.waitForTimeout(waitMs == null ? 900 : waitMs);
  const log = await p.evaluate(() => localStorage.getItem('mc_workout_log_v1'));
  if (log !== ctx.__fixture.mc_workout_log_v1) {
    await p.close();
    throw new Error('refusing ' + page + ': its saved workout log is not the fixture’s');
  }
  p.__errors = errors;
  return p;
}

module.exports = { fixtureContext, openRoute };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const base = args[0], page = args[1];
    if (!base || !page) { console.error('usage: node tools/fixture-harness.js <baseUrl> <page> [--width 390] [--out shot.png]'); process.exit(2); }
    const at = f => { const i = args.indexOf(f); return i > 0 ? args[i + 1] : null; };
    const { chromium } = require('playwright');
    const browser = await chromium.launch(process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {});
    const ctx = await fixtureContext(browser, { width: +(at('--width') || 390) });
    const p = await openRoute(ctx, base, page);
    const out = at('--out') || 'fixture-' + page.replace(/[^a-z0-9]+/gi, '-') + '.png';
    await p.screenshot({ path: out, fullPage: true });
    console.log('wrote ' + out + (p.__errors.length ? ' (' + p.__errors.length + ' page error(s))' : ''));
    await browser.close();
    process.exit(p.__errors.length ? 1 : 0);
  })().catch(e => { console.error(e.message); process.exit(1); });
}
