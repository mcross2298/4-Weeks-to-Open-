#!/usr/bin/env node
'use strict';
/* tools/test-mc-crash-journal.js — flagship readiness R1 step 9 (Phase T2.2)

   localStorage reaches the disk on the browser's schedule. Measured with
   GO_LIVE/flagship-audit/scenarios/fa-kill-window.js, a set ticked 0.3 s or
   1.5 s before the process was SIGKILLed was gone after the relaunch, and a
   signed-out athlete has no cloud copy to get it back from. mc-setlog.js now
   journals every tick and untick to IndexedDB with durability 'strict' and
   replays what the set log is missing on the next load.

   Each journey runs on its own persistent profile, kills every process on it
   with SIGKILL (no unload, no flush), relaunches and opens the page again:
     TICK    a set ticked 300 ms before the kill is in the store and ticked on
             screen after reopening.
     UNTICK  a set ticked long before the kill and unticked 300 ms before it
             is NOT back after reopening.
     ONCE    reopening a second time changes nothing (the replay is a no-op on
             a store that already reflects the journal).
     DISCARD a discarded workout is not put back on the next load.
   Plus a CONTROL that the kill really lost the write from localStorage, so a
   browser build that happens to flush in time cannot make this pass vacuously.
   The control is reported, not required: when it does not reproduce, the
   journeys still have to pass.

   Linux only (pkill). Usage:
     MC_CHROMIUM=/path/to/chromium node tools/test-mc-crash-journal.js http://localhost:8080
*/
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const EXE = process.env.MC_CHROMIUM || undefined;
const BLOCK = /fonts\.(googleapis|gstatic)\.com|supabase\.co|jsdelivr/;
const PAGE = '/mm-p1.html?day=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(ok, name, detail) {
  if (ok) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}

async function launch(profile) {
  const c = await chromium.launchPersistentContext(profile,
    Object.assign({ viewport: { width: 390, height: 844 } }, EXE ? { executablePath: EXE } : {}));
  await c.route(BLOCK, (r) => r.abort());
  return c;
}
function kill(profile) { try { execSync('pkill -9 -f "' + profile + '"'); } catch (e) {} }
const firstRow = (p) => p.locator('.ex-card').first().locator('.mcl-row').first();
async function tick(p) {
  const row = firstRow(p), inp = row.locator('input');
  await inp.nth(0).fill('135'); await inp.nth(1).fill('5');
  await row.locator('.mcl-ck').click();
}
const setCount = (p) => p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
  return Object.keys(s).reduce((n, k) => n + (s[k] || []).reduce((m, x) => m + (x && x.sets ? Object.keys(x.sets).length : 0), 0), 0);
});
const onScreen = (p) => p.evaluate(() => document.querySelectorAll('.mcl-ck.done').length);

async function reopen(profile) {
  const c = await launch(profile);
  const p = c.pages()[0] || await c.newPage();
  await p.goto(BASE + '/manifest.json');
  const raw = await setCount(p);                     // what localStorage alone kept
  await p.goto(BASE + PAGE); await sleep(2500);
  return { c, p, raw, sets: await setCount(p), ticked: await onScreen(p) };
}

(async () => {
  console.log('test-mc-crash-journal against ' + BASE + '\n');
  let controlLost = 0;

  // TICK + ONCE
  {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-journal-'));
    let c = await launch(profile);
    let p = c.pages()[0] || await c.newPage();
    await p.goto(BASE + PAGE); await sleep(1800);
    await tick(p); await sleep(300);
    kill(profile); await sleep(800);
    let r = await reopen(profile);
    if (r.raw === 0) controlLost++;
    check(r.sets === 1 && r.ticked === 1, 'TICK a set ticked 300 ms before a hard kill is back after reopening',
      JSON.stringify({ raw: r.raw, sets: r.sets, ticked: r.ticked }));
    await r.c.close();
    c = await launch(profile); p = c.pages()[0] || await c.newPage();
    await p.goto(BASE + PAGE); await sleep(2500);
    check((await setCount(p)) === 1 && (await onScreen(p)) === 1, 'ONCE reopening again changes nothing');
    await c.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  // UNTICK
  {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-journal-'));
    let c = await launch(profile);
    let p = c.pages()[0] || await c.newPage();
    await p.goto(BASE + PAGE); await sleep(1800);
    await tick(p); await sleep(4000);                 // long enough to reach the disk
    await firstRow(p).locator('.mcl-ck').click(); await sleep(300);
    kill(profile); await sleep(800);
    const r = await reopen(profile);
    if (r.raw === 1) controlLost++;
    check(r.sets === 0 && r.ticked === 0, 'UNTICK a set unticked 300 ms before a hard kill stays unticked',
      JSON.stringify({ raw: r.raw, sets: r.sets, ticked: r.ticked }));
    await r.c.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  // DISCARD: a discarded workout stays discarded. The journal holds the same
  // sets, so a discard that cleared only mc_setlog_v1 had them put back on
  // the next load (caught by test-mc-setlog-concurrency.js's clean-setup check).
  {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-journal-'));
    const c = await launch(profile);
    const p = c.pages()[0] || await c.newPage();
    await p.goto(BASE + PAGE); await sleep(1800);
    await tick(p); await sleep(1500);
    await p.evaluate(() => window._FW._discardNow());
    await sleep(2500);                                // it navigates to the dashboard
    await p.goto(BASE + PAGE); await sleep(2500);
    const sets = await setCount(p), ticked = await onScreen(p);
    check(sets === 0 && ticked === 0, 'DISCARD a discarded workout is not replayed by the journal', JSON.stringify({ sets, ticked }));
    await c.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }

  console.log('\n  control: the kill lost the localStorage write in ' + controlLost + ' of 2 journeys' +
    (controlLost ? '' : ' (this build flushed in time, so the journeys above passed without needing the journal)'));
  console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
