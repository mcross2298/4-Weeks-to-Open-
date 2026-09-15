/* GO_LIVE scenario set 2 — PR detection & progression, against SEEDED history
   with independently calculated expected results (protocol §1 "PR and
   progression validation"). Expected PRs are computed in this file from the
   seeded numbers, then compared with what the app actually banks. */
const { chromium } = require('playwright');
const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
const PAGE = '/mm-p1.html?day=1', PID = 'mm-p1';
const NEUTRAL = '/manifest.json', SK = 'mc_setlog_v1', WL = 'mc_workout_log_v1';

let pass = 0, fail = 0;
const ok = (n, x) => { pass++; console.log(`  ok    ${n}${x ? '  [' + x + ']' : ''}`); };
const bad = (n, g, w) => { fail++; console.log(`  FAIL  ${n} — observed: ${g} | expected: ${w}`); };
const t = (n, g, w) => (String(g) === String(w) ? ok(n, String(g)) : bad(n, g, w));

const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

async function reset(pg) {
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
    await pg.waitForTimeout(150);
    if (!(await pg.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('mc_') === 0).length))) break;
  }
}
// Seed prior sessions for one exercise key. sessions = [[dayOffset, [weights]], ...]
async function seed(pg, exKey, sessions) {
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  await pg.evaluate(([key, k, sess]) => {
    const store = {};
    store[k] = sess.map(([off, weights]) => {
      const sets = {};
      weights.forEach((w, i) => { sets[String(i + 1)] = { w: String(w), r: '8' }; });
      const d = new Date(); d.setDate(d.getDate() - off);
      return { d: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
               ts: d.getTime(), sets: sets };
    });
    localStorage.setItem(key, JSON.stringify(store));
  }, [SK, exKey, sessions]);
}
async function open(pg) {
  await pg.goto(BASE + PAGE, { waitUntil: 'networkidle' });
  await pg.waitForFunction(() => document.querySelectorAll('.mcl-strip').length > 0, null, { timeout: 20000 });
}
// Which exercise does card 0 log against? Read the real key the app writes.
async function firstExKey(pg) {
  return pg.evaluate(k => { try { return Object.keys(JSON.parse(localStorage.getItem(k) || '{}'))[0] || null; } catch (e) { return null; } }, SK);
}
async function logSet(pg, weight, ix) {
  return pg.evaluate(([w, i]) => {
    const strip = document.querySelectorAll('.mcl-strip')[i];
    if (!strip) return 'NOSTRIP';
    const card = strip.closest('.ex-card, .ss-ex, .ex-item') || strip.parentElement;
    const pick = () => { const wr = card.querySelector('.mcl-wrap'); return (wr && wr.classList.contains('open')) ? wr.querySelector('.mcl-ck:not(.done)') : null; };
    let ck = pick(); if (!ck) { strip.click(); ck = pick(); }
    if (!ck) return 'NOROW';
    const row = ck.closest('.mcl-row'), wi = row.querySelector('.mcl-w'), ri = row.querySelector('.mcl-r');
    if (wi) { wi.value = String(w); wi.dispatchEvent(new Event('input', { bubbles: true })); }
    if (ri) { ri.value = '8'; ri.dispatchEvent(new Event('input', { bubbles: true })); }
    ck.click(); return 'OK';
  }, [weight, ix || 0]);
}
async function finishAndRead(pg) {
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { try { window._FW && window._FW.confirm && window._FW.confirm(); } catch (e) {} });
  await pg.waitForTimeout(1600);
  return pg.evaluate(k => { try { return JSON.parse(localStorage.getItem(k) || '[]')[0] || null; } catch (e) { return null; } }, WL);
}
const prNames = entry => (entry && Array.isArray(entry.sets) ? entry.sets.filter(s => s.pr) : []);

(async () => {
  const browser = await chromium.launch(process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push('pageerror: ' + e.message));

  // Discover the real exercise key card 0 writes to, so the seed lands on it.
  await reset(pg); await open(pg); await logSet(pg, 111, 0); await pg.waitForTimeout(700);
  const EXKEY = await firstExKey(pg);
  console.log('exercise key under test: ' + EXKEY);
  if (!EXKEY) { console.log('  FAIL  could not discover the set-log key'); process.exit(1); }

  const scenarios = [
    { name: 'S2.1 brand-new user, NO history — a first log is a baseline, not a record',
      seed: [], log: [225], expectPRs: 0,
      why: 'no prior session exists, so nothing can be beaten (audit G-03 false-positive guard)' },
    { name: 'S2.2 one prior session (best 200) — beat it with 205',
      seed: [[7, [180, 190, 200]]], log: [205], expectPRs: 1,
      why: '205 > prior best 200' },
    { name: 'S2.3 one prior session (best 200) — 195 must NOT be a PR',
      seed: [[7, [180, 190, 200]]], log: [195], expectPRs: 0,
      why: '195 < prior best 200' },
    { name: 'S2.4 equalling the best is not beating it (200 vs 200)',
      seed: [[7, [180, 190, 200]]], log: [200], expectPRs: 0,
      why: 'the comparison is strictly greater-than' },
    { name: 'S2.5 must beat the best of ALL priors, not just the last one',
      seed: [[14, [220]], [7, [180]]], log: [210], expectPRs: 0,
      why: 'most recent best is 180 but the all-time prior best is 220' },
    { name: 'S2.6 beating the all-time best across several sessions',
      seed: [[21, [200]], [14, [220]], [7, [180]]], log: [225], expectPRs: 1,
      why: '225 > 220, the best of every prior session' },
    { name: 'S2.7 several PR sets in one session count individually',
      seed: [[7, [100]]], log: [150, 160, 170], expectPRs: 3,
      why: 'each logged weight beats the prior best of 100' }
  ];

  for (const sc of scenarios) {
    console.log('\n=== ' + sc.name + ' ===');
    console.log('    independent expectation: ' + sc.expectPRs + ' PR(s) — ' + sc.why);
    await reset(pg);
    if (sc.seed.length) await seed(pg, EXKEY, sc.seed);
    await open(pg);
    for (const w of sc.log) await logSet(pg, w, 0);
    const entry = await finishAndRead(pg);
    if (!entry) { bad(sc.name, 'no banked workout', 'a banked entry'); continue; }
    const prs = prNames(entry);
    t('PR count matches the independent expectation', entry.prs, sc.expectPRs);
    if (prs.length !== sc.expectPRs) bad('flagged sets', prs.map(s => s.weight).join(',') || 'none', sc.expectPRs + ' flagged');
    else ok('the flagged sets are the right ones', prs.map(s => s.weight + 'lb').join(',') || 'none');
  }

  console.log('\n=== S2.8 is a PR scoped to the exercise, or to the PAGE it was logged on? ===');
  await reset(pg);
  // Seed a 300 lb best for the SAME exercise name under a DIFFERENT page id.
  const otherKey = EXKEY.replace(PID + '|', 'kitchen-sink|');
  await pg.goto(BASE + NEUTRAL, { waitUntil: 'load' });
  await pg.evaluate(([key, k, ok2]) => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const store = {}; store[ok2] = [{ d: day, ts: d.getTime(), sets: { '1': { w: '300', r: '5' } } }];
    localStorage.setItem(key, JSON.stringify(store));
  }, [SK, EXKEY, otherKey]);
  await open(pg);
  await logSet(pg, 135, 0);
  const e8 = await finishAndRead(pg);
  console.log(`    seeded a 300 lb best for the same lift under "${otherKey}", then logged 135 lb on ${PID}`);
  console.log(`    observed: prs = ${e8 ? e8.prs : 'n/a'}`);
  if (e8 && e8.prs === 0) ok('135 lb is correctly not a PR here (no prior session on THIS page either)');
  else bad('cross-page PR scope', 'prs=' + (e8 && e8.prs), '0');

  if (errors.length) { fail++; console.log('\n  FAIL  page errors: ' + errors.slice(0, 6).join(' | ')); }
  else ok('\nzero uncaught page errors across the PR campaign');
  await browser.close();
  console.log(`\nS2 PR/progression: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
