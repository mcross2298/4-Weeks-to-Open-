'use strict';
/* ==========================================================================
   cr03-pwa-mobile.js — PWA & Mobile Engineer.
   Protocol §1 "PWA/offline/mobile". Installability, the service worker and its
   update path, offline operation, safe-area handling, small screens and touch.

   One constraint is stated rather than worked around: sw.js's fetch handler is
   gated to the production origin, so on localhost it is inert and a true
   offline RELOAD cannot be observed here. That is recorded as an unverified
   axis, not reported as a pass. What CAN be verified locally is asserted:
   the registration, the precache manifest, the update lifecycle, and — the
   part that actually protects an athlete's work — that logging survives with
   the network genuinely cut.
   ========================================================================== */
const { BASE, browser, ctx, attach, newSink, sleep } = require('./_harness');
const D = require('./_drive');
const fs = require('fs');

let pass = 0, fail = 0, unver = 0; const rows = [];
function chk(id, label, got, want, note) {
  const okv = JSON.stringify(got) === JSON.stringify(want);
  okv ? pass++ : fail++;
  rows.push({ id, label, ok: okv, got, want, note: note || '' });
  console.log(`  ${okv ? 'ok  ' : 'FAIL'}  [${id}] ${label}` + (okv ? '' : `  -> want ${JSON.stringify(want)} got ${JSON.stringify(got)}`));
}
function unverified(id, label, why) {
  unver++; rows.push({ id, label, ok: null, unverified: why });
  console.log(`  ----  [${id}] ${label}\n          UNVERIFIED: ${why}`);
}

(async () => {
  const b = await browser();

  /* ---- manifest + install meta ---------------------------------------- */
  {
    const c = await ctx(b); const page = await c.newPage();
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' }); await sleep(700);
    const m = await page.evaluate(async () => {
      const link = document.querySelector('link[rel=manifest]');
      if (!link) return { missing: true };
      const r = await fetch(link.href); const j = await r.json();
      return { href: link.getAttribute('href'), name: j.name, short: j.short_name,
               display: j.display, start: j.start_url, scope: j.scope,
               icons: (j.icons || []).map(i => i.sizes + ' ' + (i.purpose || '')),
               themeMeta: (document.querySelector('meta[name=theme-color]') || {}).content,
               appleCapable: (document.querySelector('meta[name="apple-mobile-web-app-capable"]') || {}).content,
               viewport: (document.querySelector('meta[name=viewport]') || {}).content };
    });
    chk('P-01', 'a web app manifest is linked and parses', !m.missing, true);
    chk('P-02', 'display is standalone (launches without a browser bar)', m.display, 'standalone');
    chk('P-03', 'the manifest names the app', !!m.name, true, m.name);
    chk('P-04', 'a maskable icon is declared (Android adaptive icons)',
        (m.icons || []).some(i => /maskable/.test(i)), true, JSON.stringify(m.icons));
    chk('P-05', 'a 512px icon is declared (install prompt + splash)',
        (m.icons || []).some(i => /512/.test(i)), true);
    chk('P-06', 'theme-color is set (status bar tint in standalone)', !!m.themeMeta, true, m.themeMeta);
    chk('P-07', 'viewport-fit=cover is set (notch/safe-area opt-in)',
        /viewport-fit\s*=\s*cover/.test(m.viewport || ''), true);
    await c.close();
  }

  /* ---- service worker registration + precache -------------------------- */
  {
    const c = await ctx(b); const page = await c.newPage();
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'load' });
    await sleep(2500);
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { unsupported: true };
      const regs = await navigator.serviceWorker.getRegistrations();
      const names = await caches.keys();
      let entries = 0;
      for (const n of names) entries += (await (await caches.open(n)).keys()).length;
      return { regs: regs.length, scope: regs[0] && regs[0].scope, caches: names, entries };
    });
    chk('P-08', 'the service worker registers', (sw.regs || 0) >= 1, true, JSON.stringify(sw.scope));
    chk('P-09', 'a cache is populated on first visit', (sw.entries || 0) > 0, true, `${sw.entries} entries in ${(sw.caches || []).length} cache(s)`);
    // The committed precache list is the app shell; verify it matches sw.js.
    const declared = (fs.readFileSync(__dirname + '/../../../sw.js', 'utf8').match(/['"][^'"]+\.(html|js|css|json|png|svg)['"]/g) || []).length;
    chk('P-10', 'sw.js declares a non-trivial app-shell precache', declared > 50, true, `${declared} URLs referenced`);
    await c.close();
  }

  /* ---- offline: the part that actually protects the athlete ------------ */
  {
    const c = await ctx(b); const page = await c.newPage(); const sink = newSink(); attach(page, sink);
    await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'load' }); await sleep(1200);
    await D.openDay(page, 0); await D.openLogger(page, 0);
    await D.logSet(page, 0, 100, 8);
    await sleep(400);
    const before = D.countSets(await D.readStore(page, 'mc_setlog_v1'));

    await c.setOffline(true);                        // signal genuinely cut
    const r2 = await D.logSet(page, 1, 105, 8);
    const r3 = await D.logSet(page, 2, 110, 8);
    await sleep(600);
    const during = D.countSets(await D.readStore(page, 'mc_setlog_v1'));
    chk('P-11', 'sets log with the signal cut (dead gym, offline-first claim)',
        during, before + 2, `checked=${!!(r2 && r2.checked)}/${!!(r3 && r3.checked)}`);

    const fin = await page.evaluate(() => { if (window._FW && window._FW.confirm) { window._FW.confirm(); return true; } return false; });
    await sleep(900);
    const log = await D.readStore(page, 'mc_workout_log_v1');
    chk('P-12', 'a workout can be FINISHED and banked while offline',
        Array.isArray(log) && log.length >= 1, true, `finish reachable=${fin}`);

    await c.setOffline(false); await sleep(600);
    chk('P-13', 'reconnecting does not drop the offline work',
        D.countSets(await D.readStore(page, 'mc_setlog_v1')), during);
    await c.close();
  }

  /* ---- offline RELOAD: the axis this environment cannot observe --------- */
  {
    const swSrc = fs.readFileSync(__dirname + '/../../../sw.js', 'utf8');
    const gated = /mcross2298\.github\.io/.test(swSrc);
    unverified('P-14', 'offline RELOAD of a cached page',
      gated
        ? "sw.js's fetch handler is gated to https://mcross2298.github.io, so on localhost it never intercepts. A true offline reload is only observable on the deployed origin. One offline reload there closes this."
        : 'not reproducible in this environment');
  }

  /* ---- SW update lifecycle --------------------------------------------- */
  {
    const c = await ctx(b); const page = await c.newPage();
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'load' }); await sleep(2000);
    const upd = await page.evaluate(() => ({
      hasUpdateModule: !!document.querySelector('script[src*="mc-sw-update"]'),
      controller: !!navigator.serviceWorker.controller,
    }));
    chk('P-15', 'the SW update module is loaded (new-version prompt path)', upd.hasUpdateModule, true);
    chk('P-16', 'the page is controlled by the service worker after first load', upd.controller, true);
    await c.close();
  }

  /* ---- safe-area + small screens + touch -------------------------------- */
  {
    for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
      const c = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
      const page = await c.newPage();
      await page.goto(`${BASE}/mm-p1.html`, { waitUntil: 'domcontentloaded' }); await sleep(900);
      await D.openDay(page, 0); await sleep(700);
      const geo = await page.evaluate(() => {
        const de = document.documentElement;
        const over = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;
        // Every control the athlete must be able to hit mid-set.
        const sel = '.mcl-ck, .rest-timer, .mc-day-back, .mcl-strip, .mc-meatball';
        const small = [...document.querySelectorAll(sel)].filter(e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
        }).map(e => (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        return { over, small: [...new Set(small)].slice(0, 6), measured: document.querySelectorAll(sel).length };
      });
      chk(`P-17@${vp.width}`, `no sideways overflow at ${vp.width}px`, geo.over <= 0, true, `+${geo.over}px`);
      chk(`P-18@${vp.width}`, `every in-session control clears the 44px touch floor at ${vp.width}px`,
          geo.small.length, 0, geo.small.join(' | ') || `${geo.measured} controls measured`);
      await c.close();
    }
  }

  await b.close();
  fs.writeFileSync(__dirname + '/../../evidence/cr/cr03-pwa-mobile.json', JSON.stringify(rows, null, 1));
  console.log(`\ncr03 PWA & MOBILE — ${pass + fail} checks   PASS ${pass}   FAIL ${fail}   UNVERIFIED ${unver}`);
})();
