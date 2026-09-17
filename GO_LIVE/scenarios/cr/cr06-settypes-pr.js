'use strict';
/* ==========================================================================
   cr06-settypes-pr.js — Data Integrity Engineer, part 2.
   Protocol §1 "Workout campaign" (supersets, tri-sets, drop sets, AMRAP,
   cluster sets, tempo) and "PR and progression validation".

   Every expectation here is computed independently before the app is asked.
   PR detection in particular is seeded with controlled history and the answer
   is derived by hand, because "did it flag a PR" is a claim the app cannot be
   allowed to grade for itself.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, sleep } = require('./_harness');
const D = require('./_drive');
const fs = require('fs');

let pass = 0, fail = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (okv ? '' : `  -> want ${JSON.stringify(want)} got ${JSON.stringify(got)}`) + (note ? `\n          ${note}` : ''));
}

/* Walk a page's days looking for the first one that renders a given selector,
   because the 10-position blueprint puts clusters at position 8 and drops at 9
   — they are not on whichever day happens to open first. */
/* Reveal a row TYPE that the 10-position blueprint puts deep in a day.
   Three layers hide it, and clicking blindly through all of them is slow and
   unreliable: the DAY is collapsed (F3), the CARD is collapsed to a strip (R3,
   so only the active card's rows have a layout box), and the type in question
   sits at position 8 or 9 of ten. So: open each day, ask the DOM which card
   actually contains the row type, and activate exactly that card through the
   app's own MCSetlogUtil.activateCard() — the same call mc-session.js uses to
   restore a session. Navigation uses the product's API; the assertion that
   follows is still made against the real rendered row. */
async function reveal(page, selector, maxDays = 8) {
  const list = await page.locator('.mc-day-row').count();
  const heads = await page.locator('.day-header').count();
  const n = list || heads || 1;
  for (let i = 0; i < Math.min(n, maxDays); i++) {
    await D.openDay(page, i); await sleep(600);
    const hit = await page.evaluate(sel => {
      const target = document.querySelector(sel);
      if (!target) return false;
      const card = target.closest('.ex-card, .ss-ex, .ex-item, .lift-card');
      if (!card) return false;
      if (window.MCSetlogUtil && window.MCSetlogUtil.activateCard) {
        window.MCSetlogUtil.activateCard(card);
        return true;
      }
      return false;
    }, selector);
    if (hit) {
      await sleep(600);
      if (await page.locator(selector).filter({ visible: true }).count() > 0) return i;
    }
    if (list) { const back = page.locator('.mc-day-back'); if (await back.count()) { await back.first().click().catch(() => {}); await sleep(420); } }
  }
  return -1;
}

(async () => {
  const b = await browser();

  /* ---- PR detection, against hand-computed expectations ----------------- */
  for (const scen of [
    { id: 'PR-01', prior: 200, lift: 225, expectPR: true,  why: 'a heavier top set than any previous session IS a record' },
    { id: 'PR-02', prior: 250, lift: 225, expectPR: false, why: 'a lighter set than the standing best is NOT a record' },
    { id: 'PR-03', prior: 225, lift: 225, expectPR: false, why: 'equalling the best is not beating it' },
    /* Deliberate product behaviour, not a gap: a first-ever log is a BASELINE,
       not a record. The Executive Summary's wording is "Beat a previous best
       and it's tagged", and tools/test-mc-pr-scope.js already locks this in as
       audit G-03. Asserted here so the clean-room run confirms the rule rather
       than silently assuming the opposite. */
    { id: 'PR-04', prior: null, lift: 135, expectPR: false, why: 'a first-ever set of a lift is a baseline, not a record (G-03)' },
  ]) {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(700);
    if (scen.prior != null) {
      await page.evaluate(w => {
        const past = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
        localStorage.setItem('mc_setlog_v1', JSON.stringify({
          'mm-p1|x-incline-db-press': [{ d: past, ts: Date.now() - 14 * 864e5, sets: { '1': { w: String(w), r: '5' } } }]
        }));
      }, scen.prior);
      await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1100);
    }
    await D.openDay(page, 0); await D.openLogger(page, 0);
    await D.logSet(page, 0, scen.lift, 5);
    await sleep(400);
    await page.evaluate(() => window._FW && window._FW.confirm && window._FW.confirm());
    await sleep(900);
    const log = await D.readStore(page, 'mc_workout_log_v1');
    const entry = Array.isArray(log) ? log.find(e => (e.sets || []).some(s => /incline-db-press/.test(s.name || ''))) : null;
    const flagged = entry ? (entry.sets || []).some(s => /incline-db-press/.test(s.name || '') && s.pr === true) : null;
    chk(scen.id, scen.why, flagged, scen.expectPR,
        `prior best ${scen.prior === null ? 'none' : scen.prior} lb, logged ${scen.lift} lb`);
    await c.close();
  }

  /* ---- AMRAP: a set to failure records the reps actually achieved -------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(800);
    const d = await reveal(page, '.mcl-row-amrap');
    if (d < 0) { chk('ST-01', 'an AMRAP row is reachable', false, true, 'no .mcl-row-amrap rendered on any day'); }
    else {
      const row = page.locator('.mcl-row-amrap').filter({ visible: true }).first();
      const w = row.locator('.mcl-w'), r = row.locator('.mcl-r:not(.mcl-rmini)');
      if (await w.count()) await w.fill('95');
      if (await r.count()) await r.fill('23');            // a real burnout number
      await row.locator('.mcl-ck').scrollIntoViewIfNeeded().catch(() => {});
      await row.locator('.mcl-ck').click({ timeout: 5000 }).catch(() => {});
      await sleep(600);
      const st = await D.readStore(page, 'mc_setlog_v1');
      const found = Object.values(st || {}).flat().flatMap(e => Object.values(e.sets || {}))
        .find(v => String(v.r) === '23');
      chk('ST-01', 'an AMRAP set stores the reps actually achieved, not the prescription',
          !!found, true, `stored ${JSON.stringify(found || null)}`);
      // The 1RM estimate must not run away on a 23-rep burnout (Epley cap).
      const est = await page.evaluate(() => window.MC_LOG ? window.MC_LOG.e1rm(95, 23, 'Barbell Bench Press') : null);
      const capped = Math.round(95 * (1 + 12 / 30));
      chk('ST-02', 'a 23-rep AMRAP does not inflate the 1RM estimate (Epley capped at 12)',
          est, capped, `uncapped Epley would claim ${Math.round(95 * (1 + 23 / 30))} lb`);
    }
    await c.close();
  }

  /* ---- Cluster: summed, not truncated (P2-08) --------------------------- */
  {
    /* A cluster is NOT authored in page HTML — data-mc-cluster is written only
       by program-overrides.js, i.e. by the athlete configuring one through the
       exercise's own menu. So the cluster has to be created before it can be
       tested, using the app's own MC_PO.setPersonalIntensifier (exactly the
       call the menu makes). The reload is not incidental: DEF-12 records that a
       cluster edit applies from the NEXT load, because mc-setlog.js reads
       data-mc-cluster only inside buildRows(), which returns early when the
       rows already exist. That documented limitation is asserted here too. */
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(900);
    await D.openDay(page, 0); await sleep(600);

    const configured = await page.evaluate(() => {
      const card = document.querySelector('.ex-card, .ex-item, .ss-ex');
      if (!card || !window.MC_PO || !window.MC_PO.setPersonalIntensifier) return null;
      window.MC_PO.setPersonalIntensifier(card, 'cluster', { on: 1, reps: '5+4+3', rest: '20s' });
      return window.MC_PO.cardKey(card);
    });
    chk('ST-03a', 'a cluster can be configured through the app\'s own override API',
        !!configured, true, `card key ${configured}`);

    const midSession = await page.locator('.mcl-cluster-row').count();
    chk('ST-03b', 'DEF-12 holds: the cluster does NOT repaint mid-session (documented limitation)',
        midSession, 0, 'buildRows() returns early when .mcl-wrap already exists');

    await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1300);
    const d = await reveal(page, '.mcl-cluster-row', 8);
    if (d < 0) {
      chk('ST-03c', 'the configured cluster renders on the next load', false, true,
          'no .mcl-cluster-row after reload');
    } else {
      /* Bubbles are PER WORKING SET, so a 5-set exercise with a 3-part cluster
         renders 15 of them. The assertion is per row, which is what the athlete
         actually fills in for one set. */
      const ckRow = page.locator('.mcl-row').filter({ visible: true }).filter({ has: page.locator('.mcl-rmini') }).first();
      const minis = ckRow.locator('.mcl-rmini');
      const n = await minis.count();
      const totalBubbles = await page.locator('.mcl-rmini').filter({ visible: true }).count();
      chk('ST-03c', 'each working set renders one bubble per mini-set', n, 3,
          `declared 5+4+3; ${totalBubbles} bubbles across the card (one set of 3 per working set)`);
      const parts = [5, 4, 3];
      for (let i = 0; i < Math.min(n, 3); i++) await minis.nth(i).fill(String(parts[i]));
      const wIn = ckRow.locator('.mcl-w');
      if (await wIn.count()) await wIn.fill('185');
      await ckRow.locator('.mcl-ck').scrollIntoViewIfNeeded().catch(() => {});
      await ckRow.locator('.mcl-ck').click({ timeout: 5000 }).catch(() => {});
      await sleep(700);
      const st = await D.readStore(page, 'mc_setlog_v1');
      const cl = Object.values(st || {}).flat().flatMap(e => Object.values(e.sets || {}))
        .find(v => String(v.r).includes('+'));
      chk('ST-03d', 'a cluster stores every mini-set, not just the first',
          cl ? String(cl.r) : null, '5+4+3');
    }
    /* The arithmetic itself, independent of any page: 5+4+3 is twelve reps of
       work. parseInt read 5 (P2-08), so tonnage and strain counted a third. */
    const tot = await page.evaluate(v => window.MC_LOG ? window.MC_LOG.repsTotal(v) : null, '5+4+3');
    chk('ST-04', 'cluster reps total 12, not 5 (P2-08: parseInt read a third of the work)', tot, 12);
    const top = await page.evaluate(v => window.MC_LOG ? window.MC_LOG.repsTop(v) : null, '5+4+3');
    chk('ST-04b', 'but a 1RM estimate uses the TOP mini-set (5), never the summed 12',
        top, 5, 'a cluster is rested mid-set; Epley off 12 would invent a max nobody lifted');
    await c.close();
  }

  /* ---- Superset legs keep SEPARATE histories (EN-1) --------------------- */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/kitchen-sink.html`, { waitUntil: 'domcontentloaded' }); await sleep(800);
    const d = await reveal(page, '.ss-ex .mcl-row');
    if (d < 0) chk('ST-05', 'a superset is reachable', false, true, 'no .ss-ex rendered');
    else {
      const legs = await page.evaluate(() => [...document.querySelectorAll('.ss-ex')].slice(0, 3)
        .map(e => { const n = e.querySelector('.ex-name, .ss-name'); return n ? n.textContent.trim() : ''; }));
      /* ':visible' is a Playwright pseudo-class and is not a valid CSS
         selector inside the page — visibility is decided here by layout box. */
      /* Read the keys of the SUPERSET's own legs, not of whichever card happens
         to be active — the first version of this check read the bench press
         sitting above the superset and concluded the legs shared one key. */
      const ids = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.ss-ex').forEach(leg => {
          leg.querySelectorAll('.mcl-row').forEach(r => { if (r.id) out.push(r.id.replace(/-\d+$/, '')); });
        });
        return out;
      });
      const distinct = [...new Set(ids)];
      chk('ST-05', 'each superset leg logs under its own exercise key, not a shared one',
          distinct.length >= 2, true, `legs=${JSON.stringify(legs)} keys=${JSON.stringify(distinct.slice(0, 4))}`);
    }
    await c.close();
  }

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr06-settypes-pr.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr06 SET TYPES & PR — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}`);
})();
