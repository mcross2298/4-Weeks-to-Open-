#!/usr/bin/env node
'use strict';
/* Flagship audit — how long after a tick is a set safe from a hard crash?
   A MEASUREMENT, not a pass/fail gate: browsers flush local storage to disk
   asynchronously, so a set ticked moments before the process dies can be lost.
   For each delay this logs one set on a persistent profile, waits, SIGKILLs
   every process on that profile, relaunches it and reads the store back.
   Signed-in athletes recover lost sets from the cloud (tools/test-mc-crash-
   recovery.js); signed-out athletes have no other copy, which is why roadmap
   phase R1 lists an optional IndexedDB journal with strict durability.

   Linux only (uses pkill). One trial per delay; results vary by browser build.
   Usage: NODE_PATH=<dir with playwright> node GO_LIVE/flagship-audit/scenarios/fa-kill-window.js http://localhost:8080 [delayMs ...]
*/
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const DELAYS = process.argv.slice(3).map(Number).filter((n) => n >= 0);
const EXE = process.env.MC_CHROMIUM || undefined;
const BLOCK = /fonts\.(googleapis|gstatic)\.com|supabase\.co|jsdelivr/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(profile) {
  const c = await chromium.launchPersistentContext(profile, Object.assign({ viewport: { width: 390, height: 844 } }, EXE ? { executablePath: EXE } : {}));
  await c.route(BLOCK, (r) => r.abort());
  return c;
}

async function trial(delay) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fa-kill-'));
  let c = await launch(profile);
  let p = c.pages()[0] || await c.newPage();
  await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(1800);
  const row = p.locator('.ex-card').first().locator('.mcl-row').first();
  const inp = row.locator('input');
  await inp.nth(0).fill('135'); await inp.nth(1).fill('5');
  await row.locator('.mcl-ck').click();
  await sleep(delay);
  try { execSync('pkill -9 -f "' + profile + '"'); } catch (e) {}
  await sleep(800);
  c = await launch(profile);
  p = c.pages()[0] || await c.newPage();
  await p.goto(BASE + '/manifest.json');
  const raw = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}')).length > 0);
  // Phase T2.2: the crash journal replays on the next visit to the page, so
  // read the store again after opening it. `raw` is what localStorage alone
  // kept; `kept` is what the athlete sees.
  await p.goto(BASE + '/mm-p1.html?day=1'); await sleep(2500);
  const kept = await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
    return Object.keys(s).some((k) => (s[k] || []).some((x) => x && x.sets && Object.keys(x.sets).length));
  });
  const ticked = await p.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);
  await c.close();
  fs.rmSync(profile, { recursive: true, force: true });
  return { raw, kept, ticked };
}

(async () => {
  const delays = DELAYS.length ? DELAYS : [300, 1500, 3000, 6000];
  console.log('Flagship audit — set survival vs time between tick and hard kill (' + BASE + ')\n');
  for (const d of delays) {
    const r = await trial(d);
    console.log('  ' + String(d).padStart(6) + ' ms  →  localStorage ' + (r.raw ? 'kept' : 'LOST') +
      ' · after reopening ' + (r.kept ? 'kept' : 'LOST') + ' (' + r.ticked + ' ticked on screen)');
  }
  console.log('\nMeasurement only; one trial per delay. iOS WebKit flush timing may differ.');
})().catch((e) => { console.log('HARNESS ERROR ' + e.message); process.exit(2); });
