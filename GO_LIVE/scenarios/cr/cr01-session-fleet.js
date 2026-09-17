'use strict';
/* ==========================================================================
   cr01-session-fleet.js — Beta User + Data Integrity Engineer.
   Drive a COMPLETE session on every page that carries a set logger:

       open day -> open logger -> log 3 sets -> assert persisted
       -> reload -> assert the sets survived
       -> finish -> assert the workout banked

   The protocol's rule is "persistence survives refresh/reload/reopen". This
   asserts it per page rather than sampling, because the repo's own history
   shows the failure is page-family-shaped: F3-1 found mc-session.js never
   wiring on eight pages, F3-2 found mc-summary.js mis-scoping on three more.
   A sample would have missed both.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, productErrors, sleep } = require('./_harness');
const D = require('./_drive');
const { execSync } = require('child_process');
const fs = require('fs');

(async () => {
  const root = __dirname + '/../../..';
  const all = execSync("git ls-files '*.html'", { cwd: root }).toString().trim().split('\n');
  // A workout page is one that loads the set logger. That is the product's own
  // definition, not ours.
  const workout = all.filter(p => {
    if (p.endsWith('.dc.html')) return false;
    try { return /mc-setlog\.js/.test(fs.readFileSync(root + '/' + p, 'utf8')); } catch (e) { return false; }
  });

  /* Slice support: a 79-page drive is ~13 minutes, longer than a single
     foreground command survives. Streaming one line per page (and flushing the
     JSON every page) means a run that is interrupted still leaves evidence for
     every page it reached, instead of losing all of it. */
  const ARG = process.argv.slice(2);
  const FROM = Number((ARG.find(a => a.startsWith('--from=')) || '').split('=')[1] || 0);
  const TO   = Number((ARG.find(a => a.startsWith('--to=')) || '').split('=')[1] || workout.length);
  const OUT  = root + '/GO_LIVE/evidence/cr/cr01-session-fleet' + (FROM || TO !== workout.length ? `-${FROM}_${TO}` : '') + '.json';
  const slice = workout.slice(FROM, TO);
  console.log(`cr01 driving ${slice.length} of ${workout.length} logger-bearing pages [${FROM}..${TO})`);

  const b = await browser();
  const rows = [];
  for (const p of slice) {
    const c = await ctx(b);                     // fresh origin state per page: a clean-room athlete
    const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    const rec = { page: p, step: 'nav' };
    try {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await sleep(700);

      rec.step = 'openDay';
      const day = await D.openDay(page, 0);
      rec.dayRows = day.listed; rec.dayVia = day.via;

      rec.step = 'cards';
      rec.cards = await D.cards(page);
      if (!rec.cards) { rec.verdict = 'NO-SESSION'; rows.push(rec); await c.close(); continue; }

      rec.step = 'openLogger';
      rec.loggerOpen = await D.openLogger(page, 0);
      rec.plannedRows = await page.locator('.mcl-row').filter({ visible: true }).count();
      if (!rec.plannedRows) { rec.verdict = 'NO-LOGGER'; rows.push(rec); await c.close(); continue; }

      rec.step = 'log';
      const logged = [];
      for (let i = 0; i < Math.min(3, rec.plannedRows); i++) {
        const r = await D.logSet(page, i, 100 + i * 5, 8);
        if (r) logged.push(r);
      }
      rec.checkedOk = logged.filter(l => l.checked).length;
      rec.blocked = logged.filter(l => l.blocked).map(l => l.blocked).slice(0, 2);
      rec.keys = [...new Set(logged.map(l => (l.id || '').replace(/-\d+$/, '')))];

      rec.step = 'persist';
      const before = await D.readStore(page, 'mc_setlog_v1');
      rec.setsBefore = D.countSets(before);
      rec.sessionBefore = !!(await D.readStore(page, 'mc_session_v1'));

      rec.step = 'reload';
      await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1100);
      if (day.opened) { await D.openDay(page, 0); }
      await D.openLogger(page, 0);
      const after = await D.readStore(page, 'mc_setlog_v1');
      rec.setsAfter = D.countSets(after);
      const kk = D.setlogKeys(after);
      rec.exKeys = kk.exKeys.slice(0, 4);
      rec.dayKeys = kk.dayKeys;
      /* FIX-06: the day key must carry a year. A bare "Sep 17" collides with
         itself annually and cannot be ordered. Asserted per page, not sampled. */
      rec.dayKeysDated = kk.dayKeys.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
      /* Count restored ticks across the whole document, not only the visible
         card. On a multi-card page the card that is ACTIVE after a reload is
         not necessarily the one that was logged, so a visible-only count reads
         0 while the restore is in fact correct — a driver artefact, not a
         defect, and one worth not re-introducing. */
      rec.checkedInDom = await page.locator('.mcl-ck[aria-checked="true"]').count();

      rec.step = 'finish';
      const fin = await D.finish(page);
      rec.finishVia = fin;
      const log = await D.readStore(page, 'mc_workout_log_v1');
      rec.banked = Array.isArray(log) ? log.length : (log ? Object.keys(log).length : 0);
      const bankedSets = Array.isArray(log) && log[0] ? (log[0].totalSets ?? log[0].sets ?? null) : null;
      rec.bankedSets = bankedSets;

      const pe = productErrors(sink);
      rec.thrown = pe.thrown.slice(0, 3); rec.consoleErr = pe.console.slice(0, 3);

      rec.verdict =
        rec.checkedOk === Math.min(3, rec.plannedRows) &&
        rec.setsBefore >= rec.checkedOk &&
        rec.setsAfter >= rec.setsBefore &&
        rec.checkedInDom >= rec.checkedOk &&
        rec.banked >= 1 &&
        rec.dayKeysDated !== false &&
        !rec.thrown.length ? 'PASS' : 'FAIL';
    } catch (e) {
      rec.verdict = 'ERROR'; rec.error = String(e.message).split('\n')[0];
    }
    rows.push(rec);
    await c.close();
    console.log(`  [${rec.verdict}] ${rec.page} cards=${rec.cards ?? '-'} rows=${rec.plannedRows ?? '-'} ` +
      `ck=${rec.checkedOk ?? '-'} store=${rec.setsBefore ?? '-'}->${rec.setsAfter ?? '-'} ` +
      `dom=${rec.checkedInDom ?? '-'} bank=${rec.banked ?? '-'} via=${rec.finishVia ?? '-'} dated=${rec.dayKeysDated ?? '-'}` +
      (rec.error ? ' ERR=' + rec.error : '') + (rec.thrown && rec.thrown.length ? ' THROWN=' + rec.thrown[0] : ''));
    fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
  }
  await b.close();
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));

  const g = v => rows.filter(r => r.verdict === v).length;
  console.log(`\ncr01 SESSION FLEET — ${rows.length} pages driven`);
  console.log(`  PASS        : ${g('PASS')}`);
  console.log(`  FAIL        : ${g('FAIL')}`);
  console.log(`  ERROR       : ${g('ERROR')}`);
  console.log(`  NO-SESSION  : ${g('NO-SESSION')}   (page loads the logger but renders no exercise card)`);
  console.log(`  NO-LOGGER   : ${g('NO-LOGGER')}    (cards render but no working-set row is built)`);
  for (const r of rows.filter(r => r.verdict !== 'PASS')) {
    console.log(`  [${r.verdict}] ${r.page} :: step=${r.step} cards=${r.cards} rows=${r.plannedRows} ` +
      `checked=${r.checkedOk} store=${r.setsBefore}->${r.setsAfter} dom=${r.checkedInDom} banked=${r.banked} ` +
      `fin=${r.finishVia}${r.error ? ' ERR=' + r.error : ''}${r.thrown && r.thrown.length ? ' THROWN=' + r.thrown[0] : ''}`);
  }
})();
