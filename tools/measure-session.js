#!/usr/bin/env node
'use strict';
/* ==========================================================================
   measure-session.js — active-session runtime + layout probe
   --------------------------------------------------------------------------
   One harness for the two questions the card audits asked separately:

     RUNTIME  how much work does the page do per second while a rest timer
              runs, versus while it sits idle?   (mutation records delivered
              to the app's own observers, querySelectorAll calls, localStorage
              reads, observer wake-ups)

     LAYOUT   how tall is an exercise card, and does every control clear the
              44 pt touch floor?   (measured at real iPhone viewports)

   Both were measured with throwaway scripts during the audits; this is the
   committed version, so a claim about either number can be re-checked instead
   of re-derived. It is deliberately ONE tool: the two questions share a page
   load, an interaction script, and — later — a CI budget.

   The counters only accumulate inside an explicit window (`__mcm.on`), so
   boot cost never leaks into a steady-state measurement, and an idle control
   window is always taken on the same page for bisection.

   CI-only tooling: Playwright is not a repo dependency (no package.json here,
   deliberately — see CLAUDE.md's "no build step" philosophy). The workflow
   installs it into a scratch prefix and points NODE_PATH at it. Set
   MC_CHROMIUM to an explicit chromium binary when the local Playwright build
   does not match the installed browsers.

   Usage:
     node tools/measure-session.js <baseUrl> [options]
       --page <file>        page to probe        (default mm-p1.html)
       --out <file>         write the report as JSON
       --baseline <file>    print a delta against a previous report
       --seconds <n>        length of each measurement window (default 10)

   Exit code is 0 unless the run itself failed. This tool reports; it does not
   yet judge. The budget assertions land in a later phase (A-15), which is why
   the thresholds are absent rather than guessed.
   ========================================================================== */
const fs = require('fs');
const { chromium } = require('playwright');

/* ---- args ---------------------------------------------------------------- */
const argv = process.argv.slice(2);
const baseUrl = argv[0];
if (!baseUrl || baseUrl.startsWith('--')) {
  console.error('usage: node tools/measure-session.js <baseUrl> [--page f] [--out f] [--baseline f] [--seconds n]');
  process.exit(1);
}
function opt(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i === -1 || i === argv.length - 1 ? dflt : argv[i + 1];
}
const PAGE = opt('page', 'mm-p1.html');
const OUT = opt('out', null);
const BASELINE = opt('baseline', null);
const WINDOW_S = parseInt(opt('seconds', '10'), 10);

/* Viewports: the UX report's recommendation — design to the 15/16, treat the
   SE/mini as a hard floor. Both are measured because the failure is worst
   where the screen is smallest. */
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '375x667', width: 375, height: 667 }
];

/* Controls an athlete taps mid-set, against the 44 pt floor. */
const TOUCH_TARGETS = [
  '.rest-timer', '.mcl-toggle', '.mc-qa-btn', '.a-notes',
  '.mc-meatball', '.mcl-inp', '.mcl-rpe', '.mcl-ck'
];

/* ==========================================================================
   Instrumentation — installed before any app script runs.
   ========================================================================== */
const INIT = `(() => {
  const m = { qsa: 0, getItem: 0, setItem: 0, obsCallbacks: 0, records: 0, on: false };
  window.__mcm = m;

  // querySelectorAll on every node type the app reaches for.
  for (const proto of [Document.prototype, Element.prototype, DocumentFragment.prototype]) {
    const native = proto.querySelectorAll;
    proto.querySelectorAll = function () { if (m.on) m.qsa++; return native.apply(this, arguments); };
  }

  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function () { if (m.on) m.getItem++; return getItem.apply(this, arguments); };
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function () { if (m.on) m.setItem++; return setItem.apply(this, arguments); };

  // Count records as DELIVERED TO THE APP'S OWN OBSERVERS, not as emitted by
  // the DOM. That is the metric that matters: one attribute write reaching
  // eleven body-scoped observers is eleven units of work, not one.
  const Native = window.MutationObserver;
  function Counting(cb) {
    return new Native(function (muts, obs) {
      if (m.on) { m.obsCallbacks++; m.records += muts.length; }
      return cb.call(this, muts, obs);
    });
  }
  Counting.prototype = Native.prototype;
  window.MutationObserver = Counting;
})();`;

/* ==========================================================================
   Helpers
   ========================================================================== */
async function sample(page, seconds) {
  await page.evaluate(() => {
    const m = window.__mcm;
    m.qsa = m.getItem = m.setItem = m.obsCallbacks = m.records = 0;
    m.on = true;
  });
  const t0 = Date.now();
  await page.waitForTimeout(seconds * 1000);
  const elapsed = (Date.now() - t0) / 1000;
  const raw = await page.evaluate(() => {
    const m = window.__mcm;
    m.on = false;
    return { qsa: m.qsa, getItem: m.getItem, setItem: m.setItem,
             obsCallbacks: m.obsCallbacks, records: m.records };
  });
  const per = (n) => Math.round((n / elapsed) * 10) / 10;
  return {
    seconds: Math.round(elapsed * 10) / 10,
    total: raw,
    perSecond: {
      querySelectorAll: per(raw.qsa),
      storageReads: per(raw.getItem),
      storageWrites: per(raw.setItem),
      observerCallbacks: per(raw.obsCallbacks),
      mutationRecords: per(raw.records)
    }
  };
}

/* Open the first training day, then the first card's Log Sets panel. Mirrors
   what an athlete does before their first set — the state every runtime
   number in the audits was taken in. */
async function enterSession(page) {
  await page.evaluate(() => {
    const h = document.querySelector('.day-card .day-header');
    if (h) h.click();
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const t = document.querySelector('.day-card.open .mcl-toggle, .mcl-toggle');
    if (t) t.click();
  });
  await page.waitForTimeout(800);
}

async function domCensus(page) {
  return page.evaluate(() => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const cards = Array.from(document.querySelectorAll('.ex-card'));
    return {
      elements: document.getElementsByTagName('*').length,
      exCards: cards.length,
      exCardsVisible: cards.filter(vis).length,
      setLoggers: document.querySelectorAll('.mcl-wrap').length,
      setRows: document.querySelectorAll('.mcl-row').length,
      inputs: document.querySelectorAll('.mcl-inp').length,
      repMarkers: document.querySelectorAll('.a-rep').length,
      quickActionRows: document.querySelectorAll('.mc-quick-actions').length
    };
  });
}

async function layout(page) {
  return page.evaluate((TARGETS) => {
    const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const r1 = (n) => Math.round(n * 10) / 10;

    const shown = Array.from(document.querySelectorAll('.ex-card')).filter(vis);
    const active = shown.find((c) => {
      const w = c.querySelector('.mcl-wrap');
      return w && vis(w);
    }) || null;
    const inactive = shown.filter((c) => c !== active);
    const avg = (xs) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

    const dayBody = document.querySelector('.day-card.open .exercises');

    const controls = [];
    for (const sel of TARGETS) {
      for (const el of document.querySelectorAll(sel)) {
        if (!vis(el)) continue;
        const b = el.getBoundingClientRect();
        controls.push({
          selector: sel, width: r1(b.width), height: r1(b.height),
          meets44: b.width >= 44 && b.height >= 44
        });
        break; // one representative per selector
      }
    }

    return {
      activeCardHeight: active ? r1(active.getBoundingClientRect().height) : null,
      inactiveCardHeightAvg: avg(inactive.map((c) => c.getBoundingClientRect().height)),
      inactiveCardsMeasured: inactive.length,
      trainingDayScrollHeight: dayBody ? r1(dayBody.scrollHeight) : null,
      viewportShare: null, // filled in by the caller, which knows the height
      controls
    };
  }, TOUCH_TARGETS);
}

/* ==========================================================================
   Run
   ========================================================================== */
(async () => {
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const url = baseUrl.replace(/\/$/, '') + '/' + PAGE;
  const report = { page: PAGE, url, takenAt: new Date().toISOString(), windowSeconds: WINDOW_S };

  try {
    /* ---- runtime, at the primary viewport ------------------------------- */
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);           // let the retry ladders finish

    report.domAtLoad = await domCensus(page);
    report.runtime = {};
    report.runtime.idle = await sample(page, WINDOW_S);

    await enterSession(page);
    report.domInSession = await domCensus(page);

    // Start a rest timer the way the athlete does — the delegated click
    // handler in mc-timer.js, on a real .rest-timer button.
    const started = await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('.rest-timer'))
        .find((e) => e.offsetHeight > 0);
      if (!t) return false;
      t.click();
      return true;
    });
    if (!started) throw new Error('no visible .rest-timer to start — page layout changed?');
    await page.waitForTimeout(5000);           // steady state, not the start transient

    report.runtime.rest = await sample(page, WINDOW_S);
    report.runtime.timerConfirmedRunning = await page.evaluate(
      () => !!document.querySelector('.rest-timer.running')
    );

    await page.evaluate(() => { try { TMR.stop(); } catch (e) {} });
    report.consoleErrors = errors;
    await ctx.close();

    /* ---- layout, at each viewport --------------------------------------- */
    report.layout = {};
    for (const vp of VIEWPORTS) {
      const c = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 3, hasTouch: true
      });
      const p = await c.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(3000);
      await enterSession(p);
      const l = await layout(p);
      if (l.activeCardHeight) {
        l.viewportShare = Math.round((l.activeCardHeight / vp.height) * 100) + '%';
      }
      report.layout[vp.name] = l;
      await c.close();
    }
  } finally {
    await browser.close();
  }

  /* ---- report ----------------------------------------------------------- */
  const R = report.runtime;
  const pad = (s, n) => String(s).padStart(n);
  console.log('\n  ' + report.page + '  —  ' + report.takenAt);
  console.log('  ' + '-'.repeat(64));
  console.log('  RUNTIME, per second' + pad('idle', 22) + pad('rest timer', 16));
  for (const k of ['mutationRecords', 'observerCallbacks', 'querySelectorAll', 'storageReads']) {
    console.log('    ' + k.padEnd(24) + pad(R.idle.perSecond[k], 12) + pad(R.rest.perSecond[k], 16));
  }
  console.log('  timer confirmed running: ' + report.runtime.timerConfirmedRunning);
  console.log('\n  DOM');
  for (const k of Object.keys(report.domAtLoad)) {
    console.log('    ' + k.padEnd(24) + pad(report.domAtLoad[k], 12) + pad(report.domInSession[k], 16));
  }
  console.log('\n  LAYOUT');
  for (const vp of VIEWPORTS) {
    const l = report.layout[vp.name];
    console.log('    ' + vp.name + '  active ' + l.activeCardHeight + 'px (' + l.viewportShare +
                ' of viewport) · inactive avg ' + l.inactiveCardHeightAvg +
                'px · day ' + l.trainingDayScrollHeight + 'px');
  }
  const fails = report.layout[VIEWPORTS[0].name].controls.filter((c) => !c.meets44);
  console.log('    below the 44pt floor: ' +
    (fails.length ? fails.map((c) => c.selector + ' ' + c.width + '×' + c.height).join(', ') : 'none'));
  if (report.consoleErrors.length) {
    console.log('\n  CONSOLE ERRORS (' + report.consoleErrors.length + ')');
    report.consoleErrors.slice(0, 5).forEach((e) => console.log('    ' + e));
  }

  if (BASELINE) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    console.log('\n  DELTA vs ' + BASELINE);
    for (const k of ['mutationRecords', 'observerCallbacks', 'querySelectorAll', 'storageReads']) {
      const b = base.runtime.rest.perSecond[k], n = R.rest.perSecond[k];
      const pct = b ? Math.round(((n - b) / b) * 100) : 0;
      console.log('    rest ' + k.padEnd(20) + pad(b, 10) + '  →' + pad(n, 10) +
                  '   ' + (pct > 0 ? '+' : '') + pct + '%');
    }
  }

  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
    console.log('\n  wrote ' + OUT);
  }
  console.log('');
})().catch((e) => { console.error(e); process.exit(1); });
