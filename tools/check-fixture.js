#!/usr/bin/env node
// SP4 (settings-pathways-roadmap.md): keeps the made-up athlete honest.
//
//   node tools/check-fixture.js            # static checks
//   node tools/check-fixture.js <baseUrl>  # plus: key pages render it cleanly
//
// Static: every key the fixture writes is a store store-registry.json declares;
// every value parses; the app's own log reader (mc-log-read.js, run in a vm)
// returns all of the fixture's workouts with their sets; and the same date
// always gives the same athlete. With a URL, Home, History, Stats and Settings
// are rendered with the fixture loaded (tools/fixture-harness.js) and must
// show its workouts with no page error.
//
// There is no "fixture value equals real data" check, unlike the household
// finance app's: that app keeps real figures in its repo, and this one keeps
// none (an athlete's training lives on their phone and in Supabase). Reaching
// into Supabase from CI to compare would put real data on a test path.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { athlete, WORKOUTS } = require('./fixture-athlete.js');

let failed = 0, passed = 0;
function check(name, ok, detail) {
  if (ok) passed++; else { failed++; console.error('FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

const TODAY = '2026-11-21T12:00:00Z';
const fx = athlete(TODAY);
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'store-registry.json'), 'utf8')).stores;

Object.keys(fx).forEach(k => {
  check(k + ' is a declared store', Object.prototype.hasOwnProperty.call(registry, k));
  let ok = true; try { JSON.parse(fx[k]); } catch (e) { ok = false; }
  check(k + ' is valid JSON', ok);
});
check('the same date gives the same athlete', JSON.stringify(athlete(TODAY)) === JSON.stringify(fx));

// The app's own reader, not a re-implementation of it.
const store = Object.assign({}, fx);
const sb = { console, JSON, Date, Math };
sb.window = sb;
sb.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'mc-log-read.js'), 'utf8'), sb, { filename: 'mc-log-read.js' });
const L = sb.MC_LOG;
check('mc-log-read.js publishes MC_LOG', !!L && typeof L.readAllWorkouts === 'function');
if (L) {
  const all = L.readAllWorkouts();
  check('MC_LOG reads all ' + WORKOUTS + ' workouts', all.length === WORKOUTS, 'got ' + all.length);
  check('every workout has its sets', all.every(w => L.readSets(w).length > 0));
  check('newest workout first', all.length > 1 && all[0].date > all[all.length - 1].date);
}
const body = JSON.parse(fx.mc_body_v1), mac = JSON.parse(fx.mc_macros_v1);
check('bodyweight entries carry id, date and a number', body.length > 0 && body.every(e => e.id && e.date && typeof e.w === 'number'));
check('macros carry goals and days of entries', mac.goals && mac.goals.kcal > 0 && Object.keys(mac.days).length === 7 &&
  Object.values(mac.days).every(d => Array.isArray(d.entries) && d.entries.every(e => e.per && typeof e.per.kcal === 'number')));

async function render(base) {
  const { chromium } = require('playwright');
  const { fixtureContext, openRoute } = require('./fixture-harness.js');
  const browser = await chromium.launch(process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {});
  const ctx = await fixtureContext(browser, { width: 390 });
  for (const page of ['dashboard.html', 'workout-logs.html', 'stats.html', 'workout-settings.html']) {
    let p;
    try { p = await openRoute(ctx, base, page); }
    catch (e) { check(page + ' opens with the fixture', false, e.message); continue; }
    check(page + ' renders with no page error', p.__errors.length === 0, p.__errors.join(' | '));
    if (page === 'workout-logs.html') {
      const n = await p.$$eval('.log-card', els => els.length);
      check('History lists the fixture’s workouts', n >= WORKOUTS, 'found ' + n);
      // Every fixture workout belongs to a program, including Strength &
      // Supersets, which is trained on its landing (cat-strength). Before SP4
      // History matched by id prefix only and filed those as standalone.
      const standalone = await p.evaluate(() => /Individual \/ Standalone/i.test(document.body.innerText));
      check('History files every fixture workout under its program', !standalone);
    }
    check(page + ' does not overflow sideways', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
    await p.close();
  }
  // The guard itself: a page with other saved data must be refused.
  const other = await browser.newContext({ serviceWorkers: 'block' });
  other.__fixture = fx;
  await other.addInitScript(() => { try { localStorage.setItem('mc_workout_log_v1', '[]'); } catch (e) {} });
  let refused = false;
  try { await openRoute(other, base, 'workout-logs.html', 300); } catch (e) { refused = /refusing/.test(e.message); }
  check('openRoute refuses a page whose saved log is not the fixture’s', refused);
  await browser.close();
}

(async () => {
  if (process.argv[2]) await render(process.argv[2]);
  console.log((failed ? 'FAILED' : 'OK') + '  check-fixture: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
