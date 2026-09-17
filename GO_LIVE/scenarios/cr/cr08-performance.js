'use strict';
/* ==========================================================================
   cr08-performance.js — Performance Engineer.
   Protocol §0: "loading, large datasets, repeated actions, long sessions,
   timers, and resource-heavy workflows."

   The committed budget gate (tools/measure-session.js --check) already guards
   three probe pages against regression. This adds what it does not measure:
   a LONG session (many sets over many minutes of wall-clock activity), a
   HEAVY dataset (a full year of history), and the repeated-action path that
   this repo's own audits found amplifying — write -> observe -> write.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, sleep } = require('./_harness');
const D = require('./_drive');
const fs = require('fs');

let pass = 0, fail = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = want === true ? got === true : JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (note ? `\n          ${note}` : ''));
}

/* Count the work the app's OWN observers are handed, the way
   tools/measure-session.js does — a raw MutationObserver in the harness would
   measure the harness. */
async function instrument(page) {
  await page.addInitScript(() => {
    window.__perf = { qsa: 0, gets: 0, sets: 0, records: 0 };
    const qsa = Document.prototype.querySelectorAll;
    Document.prototype.querySelectorAll = function () { window.__perf.qsa++; return qsa.apply(this, arguments); };
    const g = Storage.prototype.getItem, s = Storage.prototype.setItem;
    Storage.prototype.getItem = function () { window.__perf.gets++; return g.apply(this, arguments); };
    Storage.prototype.setItem = function () { window.__perf.sets++; return s.apply(this, arguments); };
    const MO = window.MutationObserver;
    window.MutationObserver = function (cb) {
      return new MO(function (recs, obs) { window.__perf.records += recs.length; return cb(recs, obs); });
    };
    window.MutationObserver.prototype = MO.prototype;
  });
}
const read = page => page.evaluate(() => ({ ...window.__perf,
  nodes: document.querySelectorAll('*').length,
  heap: (performance.memory && performance.memory.usedJSHeapSize) || null }));

(async () => {
  const b = await browser();

  /* ---- P-01 a LONG session: 30 sets, with a timer running --------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await instrument(page);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(1200);
    await D.openDay(page, 0); await D.openLogger(page, 0);
    const boot = await read(page);

    // Start a rest timer and leave it running for the whole session — the
    // condition under which this repo measured 2983 mutation records/second
    // before the S1 work.
    const rt = page.locator('.rest-timer[data-secs]').first();
    if (await rt.count()) { await rt.scrollIntoViewIfNeeded().catch(() => {}); await rt.click({ timeout: 4000 }).catch(() => {}); }

    let logged = 0;
    for (let round = 0; round < 6; round++) {
      const n = await page.locator('.mcl-row').filter({ visible: true }).count();
      for (let i = 0; i < n && logged < 30; i++) {
        const r = await D.logSet(page, i, 135 + logged, 8);
        if (r && r.checked) logged++;
      }
      // move to the next exercise the way the athlete does
      const strips = page.locator('.mcl-strip').filter({ visible: true });
      if (await strips.count()) { await strips.first().scrollIntoViewIfNeeded().catch(() => {}); await strips.first().click({ timeout: 3000 }).catch(() => {}); await sleep(350); }
    }
    await sleep(3000);                       // let the timer tick through
    const after = await read(page);

    const store = await D.readStore(page, 'mc_setlog_v1');
    chk('PF-01', `a long session logs and keeps every set (${logged} logged)`,
        D.countSets(store) >= logged && logged >= 10, true,
        `store holds ${D.countSets(store)} of ${logged} logged`);

    const perSet = {
      qsa: Math.round((after.qsa - boot.qsa) / Math.max(1, logged)),
      gets: Math.round((after.gets - boot.gets) / Math.max(1, logged)),
      sets: Math.round((after.sets - boot.sets) / Math.max(1, logged)),
      records: Math.round((after.records - boot.records) / Math.max(1, logged)),
    };
    /* Budgets stated as orders of magnitude, not fitted numbers: the point is
       that cost per set is BOUNDED, i.e. the write -> observe -> write storm
       this repo removed has not returned. */
    chk('PF-02', 'querySelectorAll per logged set stays bounded', perSet.qsa < 400, true, `${perSet.qsa}/set`);
    chk('PF-03', 'localStorage reads per logged set stay bounded', perSet.gets < 200, true, `${perSet.gets}/set`);
    chk('PF-04', 'localStorage writes per logged set stay bounded', perSet.sets < 60, true, `${perSet.sets}/set`);
    chk('PF-05', 'mutation records delivered per logged set stay bounded', perSet.records < 600, true, `${perSet.records}/set`);
    chk('PF-06', 'the DOM does not grow without bound during a session',
        after.nodes - boot.nodes < 4000, true, `${boot.nodes} -> ${after.nodes} nodes`);
    if (boot.heap && after.heap) {
      chk('PF-07', 'JS heap growth over a 30-set session stays under 40 MB',
          (after.heap - boot.heap) < 40 * 1024 * 1024, true,
          `${(boot.heap / 1048576).toFixed(1)} -> ${(after.heap / 1048576).toFixed(1)} MB`);
    }
    await c.close();
  }

  /* ---- P-08 a HEAVY dataset: a year of history ------------------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' }); await sleep(600);
    const seeded = await page.evaluate(() => {
      const log = [];
      for (let d = 0; d < 300; d++) {
        const ts = Date.now() - d * 864e5;
        const sets = [];
        for (let i = 0; i < 30; i++) sets.push({ name: 'x-lift-' + (i % 10), setNum: (i % 5) + 1, weight: String(100 + i), reps: '8', pr: false });
        log.push({ id: 'w' + d, ts, date: new Date(ts).toISOString().slice(0, 10),
                   workoutName: 'Session ' + d, duration: '62 min', sets, totalSets: sets.length });
      }
      localStorage.setItem('mc_workout_log_v1', JSON.stringify(log));
      return { workouts: log.length, sets: log.length * 30 };
    });
    const t0 = Date.now();
    await page.goto(`${BASE}/workout-logs.html`, { waitUntil: 'domcontentloaded' });
    await sleep(200);
    await page.waitForFunction(() => document.body && (document.body.innerText || '').length > 200, { timeout: 25000 }).catch(() => {});
    const renderMs = Date.now() - t0;
    const st = await read(page);
    chk('PF-08', `history renders with ${seeded.workouts} workouts / ${seeded.sets} sets seeded`,
        renderMs < 15000, true, `${renderMs} ms to first meaningful paint`);
    chk('PF-09', 'a year of history does not explode the DOM', st.nodes < 40000, true, `${st.nodes} nodes`);
    const errs = sink.thrown.filter(e => !/supabase|fonts\./i.test(e));
    chk('PF-10', 'a heavy dataset throws nothing', errs.length, 0, errs.join(' | '));

    const t1 = Date.now();
    await page.goto(`${BASE}/stats.html`, { waitUntil: 'domcontentloaded' }); await sleep(2500);
    chk('PF-11', 'the stats page survives the same dataset', Date.now() - t1 < 20000, true, `${Date.now() - t1} ms`);
    const errs2 = sink.thrown.filter(e => !/supabase|fonts\./i.test(e));
    chk('PF-12', 'stats throws nothing on a heavy dataset', errs2.length, 0, errs2.join(' | '));
    await c.close();
  }

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr08-performance.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr08 PERFORMANCE — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}`);
})();
