#!/usr/bin/env node
/* ==========================================================================
   check-tap-intent.js — one tap, one intent; dialogs above all fixed chrome
   --------------------------------------------------------------------------
   Usage:  node tools/check-tap-intent.js http://localhost:8080

   QA collision audit (2026-10-28, qa-collision-audit.md). Two classes of
   defect that every other gate here misses, because each needs a TAP and then
   a look at something other than the thing tapped:

   1. MULTI-INTENT TAPS. Many program pages give an exercise card (or a
      superset member, or a row) its own "tap the card to check it off"
      listener. Each kept a private ignore list that predated the set logger,
      so on 51 of 79 logging pages a tap on the rest chip, the coaching-note
      button or the Log Sets strip ALSO toggled the card's .checked — the
      struck-through, dimmed "done" state mc-summary.js counts — and a second
      tap on the chip un-did it. Every handler now reads mc-setlog.js's
      MC_CARD_TAP_IGNORE. This pass drives one page per handler FAMILY (each
      family is one implementation, so one page proves it) and taps every
      in-card control: the card's .checked must not move. It also checks that
      stndr-checkoff.js no longer overwrites the logger's own completion, and
      that a control inside a superset member never starts the hop countdown.

   2. A DIALOG UNDER FIXED CHROME. --z-modal sat at 110, under the bottom nav
      (140), and the superset hop buffer sat at a literal 1000. End workout is
      on screen before the first tick, while the nav still is, so the recap's
      Cancel / Log workout were under the nav; inside a hop they were under the
      buffer. And Session Complete did not scroll: at 320x568 its title sat
      264px above the screen. This pass hit-tests every control of the open
      dialog with elementFromPoint, which is what a finger hits.

   The exercise NAME is tapped too: a card carrying the set logger is
   completed by its sets only (owner decision, 2026-10-28; mc-setlog.js marks
   such a card .mcl-host, which MC_CARD_TAP_IGNORE names).

   Also: the End workout recap's "Total sets" must count ticked sets (it read
   0 after three were logged, and emphasised Exit & discard because of it).

   Not a ratchet: every assertion here is a hard pass/fail, and every one was
   seen failing on the pre-fix tree before this file landed.
   ========================================================================== */
'use strict';
const { chromium } = require('playwright');

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
if (!baseUrl) { console.error('usage: node tools/check-tap-intent.js <baseUrl>'); process.exit(2); }

// One page per tap-to-check handler family.
const FAMILIES = [
  { page: 'pmc-back.html?day=1',       family: 'mc-pmc-engine.js' },
  { page: 'mc-s1-back.html?day=1',     family: 'mc-engine.js' },
  { page: 'mc-s1-bis-tris.html?day=1', family: 'mc-group-split.js' },
  { page: 'chest-tri-pump.html?day=1', family: 'inline pump page handler' },
  { page: 's3-back-traps.html?day=1',  family: 'inline s3/s4 page handler' },
  { page: 'bro-split.html?day=1',      family: 'stndr-checkoff.js' },
  { page: '2on-1off.html?day=1',       family: 'mc-freq-engine.js' },
];
// In-card controls that have a job of their own, plus the exercise NAME: on a
// card that carries the set logger, ticking its sets is the only thing that
// completes it (owner decision, 2026-10-28), so the old "tap the card body"
// gesture is gone there too. .mcl-ck is not here: ticking the last set
// legitimately completes the card.
const CTRLS = ['.mcl-strip', '.mc-meatball', '.a-info', '.mcl-inp', '.rest-timer', '.mcl-rest-adj',
               '.ex-name', '.ss-name'];
const SCOPES = ['.ss-ex', '.ex-card:not(.ss-card)', '.ex-item'];

const HIT = (rootSel) => {
  const d = e => e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
    (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '') : 'null';
  const root = [...document.querySelectorAll(rootSel)].find(r => getComputedStyle(r).display !== 'none');
  if (!root) return { open: false, bad: [] };
  const bad = [];
  for (const c of root.querySelectorAll('button,a,input,select,textarea')) {
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(c).visibility === 'hidden') continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (y < 0 || y > innerHeight) continue;   // scrolled out of a scrollable sheet: reachable
    const t = document.elementFromPoint(x, y);
    if (!t || !root.contains(t)) bad.push(d(c) + ' under ' + d(t));
  }
  return { open: true, bad };
};

let failed = 0, passed = 0;
const check = (ok, msg) => { if (ok) { passed++; console.log('  ✓ ' + msg); } else { failed++; console.log('  ✗ ' + msg); } };

(async () => {
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {});
  const open = async (url, vp = { width: 390, height: 844 }) => {
    const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
    p.on('dialog', d => d.dismiss());
    await p.goto(baseUrl + '/' + url, { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    return { ctx, p };
  };
  const tick = async (p, scope, n) => {
    for (let i = 0; i < n; i++) {
      const ck = p.locator(scope + ' .mcl-ck[aria-checked="false"]:visible').first();
      if (!(await ck.count())) return i;
      await ck.scrollIntoViewIfNeeded(); await ck.tap(); await p.waitForTimeout(300);
    }
    return n;
  };

  console.log('TAP-INTENT — an in-card control never also checks the card off');
  for (const f of FAMILIES) {
    const { ctx, p } = await open(f.page);
    let tested = 0; const moved = [];
    for (const sel of CTRLS) for (const scope of SCOPES) {
      const loc = p.locator(`${scope} ${sel}:visible`).first();
      if (!(await loc.count())) continue;
      await loc.evaluate(el => { const c = el.closest('.ss-ex,.ex-card,.ex-item'); window.__c = c; window.__b = c.classList.contains('checked'); });
      try { await loc.scrollIntoViewIfNeeded({ timeout: 3000 }); await loc.tap({ timeout: 3000 }); } catch (e) { continue; }
      tested++;
      await p.waitForTimeout(300);
      if (await p.evaluate(() => window.__c.classList.contains('checked') !== window.__b)) {
        moved.push(`${scope} ${sel}`);
        await p.evaluate(() => window.__c.classList.toggle('checked'));
      }
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    }
    check(tested >= 3 && !moved.length,
      `${f.page} (${f.family}): ${tested} controls tapped` + (moved.length ? ` — toggled the card: ${moved.join(', ')}` : ''));
    await ctx.close();
  }

  console.log('HOP — a control inside a superset member never starts the hop');
  for (const sel of ['.mcl-inp', '.rest-timer', '.mc-meatball', '.ss-name']) {
    const { ctx, p } = await open('mc-s1-bis-tris.html?day=1');
    const loc = p.locator('.ss-ex ' + sel + ':visible').first();
    if (await loc.count()) {
      await loc.scrollIntoViewIfNeeded(); await loc.tap(); await p.waitForTimeout(400);
      check(!(await p.evaluate(() => !!document.querySelector('.sshop-buffer.show'))), `tap ${sel} in a superset member: no hop`);
    } else check(false, `tap ${sel} in a superset member: control not found`);
    await ctx.close();
  }

  console.log('STNDR — logging every set completes the card');
  {
    const { ctx, p } = await open('bro-split.html?day=1');
    const card = p.locator('.ex-card:not(.ss-card):visible').filter({ has: p.locator('.mcl-ck') }).first();
    const n = await card.locator('.mcl-ck').count();
    for (let i = 0; i < n; i++) {
      const ck = card.locator('.mcl-ck[aria-checked="false"]').first();
      if (!(await ck.count())) break;
      await ck.scrollIntoViewIfNeeded(); await ck.tap(); await p.waitForTimeout(300);
    }
    await p.waitForTimeout(1000);
    check(n > 0 && await card.evaluate(c => c.classList.contains('checked')),
      `bro-split.html: ${n}/${n} sets ticked -> card reads done`);
    await ctx.close();
  }

  console.log('LAYER — the open dialog is what a finger hits');
  {
    // End workout before the first tick: the bottom nav is still on screen.
    for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
      const { ctx, p } = await open('kitchen-sink.html?day=1', vp);
      const navUp = await p.evaluate(() => { const n = document.querySelector('.mc-nav'); return !!n && getComputedStyle(n).display !== 'none'; });
      await p.locator('#mcsEnd').tap(); await p.waitForTimeout(600);
      const r = await p.evaluate(HIT, '.fw-recap-overlay');
      check(navUp && r.open && !r.bad.length, `End workout with the nav up @${vp.width}: recap controls reachable` + (r.bad.length ? ' — ' + r.bad.join('; ') : ''));
      await ctx.close();
    }
    // End workout while the superset hop buffer is showing.
    {
      const { ctx, p } = await open('hv-block.html?day=1');
      // a member's logger rests collapsed to its strip unless it is the active card
      if (!(await p.locator('.ss-ex[data-type="ssex"] .mcl-ck:visible').count())) {
        const strip = p.locator('.ss-ex[data-type="ssex"] .mcl-strip:visible').first();
        await strip.scrollIntoViewIfNeeded(); await strip.tap(); await p.waitForTimeout(300);
      }
      await tick(p, '.ss-ex[data-type="ssex"]', 1);
      await p.waitForTimeout(500);
      const hop = await p.evaluate(() => !!document.querySelector('.sshop-buffer.show'));
      await p.locator('#mcsEnd').tap(); await p.waitForTimeout(600);
      const r = await p.evaluate(HIT, '.fw-recap-overlay');
      check(hop && r.open && !r.bad.length, 'End workout during a superset hop: recap controls reachable' +
        (!hop ? ' — the hop never showed' : '') + (r.bad.length ? ' — ' + r.bad.join('; ') : ''));
      await ctx.close();
    }
    // Session Complete on a small phone: inside the screen, and scrolls.
    {
      const { ctx, p } = await open('kitchen-sink.html?day=1', { width: 320, height: 568 });
      await tick(p, '', 3);
      await p.locator('#mcsEnd').tap(); await p.waitForTimeout(600);
      const recap = await p.evaluate(() => document.querySelector('.fw-recap-overlay.open .fw-stat-val:last-of-type, .fw-recap-overlay.open .fw-stats-row') ? document.querySelector('.fw-recap-overlay.open .fw-stats-row').innerText : '');
      check(/\b3 sets\b/.test(recap), `End workout recap counts ticked sets: "${recap.replace(/\s+/g, ' ').trim()}"`);
      await p.locator('#fwRecapSave').tap(); await p.waitForTimeout(1500);
      const m = await p.evaluate(() => {
        const o = document.querySelector('#fwDone.open .fw-modal, .fw-modal-overlay.open .fw-modal');
        if (!o) return null;
        const r = o.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, vh: innerHeight, scrolls: o.scrollHeight <= o.clientHeight + 1 || getComputedStyle(o).overflowY === 'auto' };
      });
      check(!!m && m.top >= 0 && m.bottom <= m.vh && m.scrolls,
        'Session Complete @320x568 fits the screen and scrolls' + (m ? ` (top ${Math.round(m.top)}, bottom ${Math.round(m.bottom)} of ${m.vh})` : ' — not found'));
      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
