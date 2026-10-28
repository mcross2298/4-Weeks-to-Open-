#!/usr/bin/env node
/* test-mc-overlay-stack.js — the three overlay collisions from the owner's
   2026-10-27 phone screenshots, driven on iron-engine.html (the page in them).

   Every other gate measures one surface at a time. These defects only exist
   when two surfaces are on screen together, which is why none of them saw it:

   1. TAP COLLISION. A tap on a collapsed superset row's body (since R3, how
      an athlete opens it) was mc-group-split.js's "tap to check off" gesture
      AND mc-superset-hop.js's fallback hop trigger: the row was marked done
      and a round rest started with no set logged. The Finish sheet then read
      "0 sets" under a "Round rest · next round" bar.
   2. Z-ORDER: the superset hop buffer was a bare z-index 1000 and covered
      the Finish sheet's Exit / Log buttons.
   3. Z-ORDER: --z-modal (110) sat under the bottom nav (140), so the nav
      covered the Session Complete card's Done button.

   Each check is a hit test at the control's centre (elementFromPoint), not a
   computed-style read: a control is reachable when the topmost element at
   the point the athlete taps is that control.

   Usage: node tools/test-mc-overlay-stack.js http://localhost:8080
*/
'use strict';
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require(path.join('/tmp/pw-ci/node_modules', 'playwright'))); }

const BASE = (process.argv[2] || 'http://localhost:8080').replace(/\/$/, '');
let fails = 0, passes = 0;
function check(ok, msg) { if (ok) { passes++; console.log('  ok   ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }

// Is the topmost element at the centre of `sel` that element (or inside it)?
async function reachable(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { ok: false, why: 'missing' };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (y < 0 || y > innerHeight) return { ok: false, why: 'off screen at y=' + Math.round(y) };
    const top = document.elementFromPoint(x, y);
    const ok = !!top && (top === el || el.contains(top));
    return { ok, why: ok ? '' : 'covered by ' + (top ? (top.className || top.tagName) : 'nothing') };
  }, sel);
}

(async () => {
  const launch = process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {};
  const browser = await chromium.launch(launch);
  for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    console.log(`\niron-engine.html @ ${vp.width}x${vp.height}`);
    const page = await browser.newPage({ viewport: vp });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com|supabase\.co/, (r) => r.abort());
    await page.goto(BASE + '/iron-engine.html?day=1');
    await page.waitForSelector('.ss-ex[data-type="ssex"] .mcl-wrap', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(600);

    // ── 1. a body tap on a collapsed superset row ──
    const row = page.locator('.ss-ex[data-type="ssex"].mcl-collapsed').first();
    const hasCollapsed = await row.count();
    check(hasCollapsed > 0, 'a superset row rests collapsed (the R3 shape the tap lands on)');
    if (hasCollapsed) {
      await row.scrollIntoViewIfNeeded();
      const bb = await row.boundingBox();
      // the far right of the row's top band: the row itself, not its strip button
      await page.mouse.click(bb.x + bb.width - 24, bb.y + 6);
      await page.waitForTimeout(500);
      const st = await page.evaluate(() => ({
        hop: !!document.querySelector('.sshop-buffer.show'),
        ticks: document.querySelectorAll('.mcl-ck.done').length,
        checked: document.querySelectorAll('.ss-ex.checked').length,
      }));
      check(!st.hop, 'a body tap starts no hop / round rest (got ' + (st.hop ? 'a hop' : 'none') + ')');
      check(st.checked === 0, 'a body tap marks no lift done with nothing logged (' + st.checked + ' marked)');
      check(st.ticks === 0, 'and logs no set (' + st.ticks + ')');
    }

    // ── 2. the hop buffer vs the Finish sheet ──
    // A real tick on a superset member is what starts a real hop.
    const ticked = await page.evaluate(() => {
      const m = document.querySelector('.ss-ex[data-type="ssex"]');
      const strip = m && m.querySelector('.mcl-strip');
      if (m && m.classList.contains('mcl-collapsed') && strip) strip.click();
      return !!m;
    });
    await page.waitForTimeout(300);
    const ck = page.locator('.ss-ex[data-type="ssex"] .mcl-ck:not(.done)').first();
    if (ticked && await ck.count()) { await ck.scrollIntoViewIfNeeded(); await ck.click(); }
    await page.waitForTimeout(700);
    const hopShown = await page.evaluate(() => !!document.querySelector('.sshop-buffer.show'));
    check(hopShown, 'ticking a superset set shows the hop buffer (precondition)');
    await page.evaluate(() => window._FW && window._FW.open());
    await page.waitForSelector('#fwRecap.open, #fwModal.open', { timeout: 5000 });
    await page.waitForTimeout(500);
    for (const sel of ['#fwRecapSave', '#fwRecapCancel']) {
      const r = await reachable(page, sel);
      check(r.ok, `Finish sheet ${sel} is tappable with the hop buffer up${r.why ? ' — ' + r.why : ''}`);
    }

    // ── 3. the bottom nav vs Session Complete ──
    await page.click('#fwRecapSave');
    await page.waitForSelector('#fwDone.open', { timeout: 5000 });
    await page.waitForTimeout(500);
    const navShown = await page.evaluate(() => {
      const n = document.querySelector('nav.mc-nav');
      return !!n && getComputedStyle(n).display !== 'none';
    });
    // Force the nav on if this run hid it: the screenshot's state (a session
    // with no ticked set never hides it) must be covered either way.
    if (!navShown) await page.evaluate(() => document.body.classList.remove('mc-in-session'));
    const r = await reachable(page, '#fwDone .fw-confirm');
    check(r.ok, `Session Complete Done is tappable over the bottom nav${r.why ? ' — ' + r.why : ''}`);

    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  await browser.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
