#!/usr/bin/env node
'use strict';
/* Flagship audit — offline reliability with the REAL service worker.
   sw.js only acts on https://mcross2298.github.io, so this serves a copy of the
   working tree as that origin: a throwaway self-signed certificate, a local
   HTTPS server, and Chromium's host resolver pointed at it. Nothing here
   touches the repository itself — the simulated deploy edits the COPY's sw.js.

   Checks assert the expected behaviour from flagship-readiness-roadmap.md
   (phase R3). S-01..S-03 are controls that pass on the audited tree.

   Needs: git, openssl, python3, and Playwright's Chromium.
   Usage: NODE_PATH=<dir with playwright> node GO_LIVE/flagship-audit/scenarios/fa-offline-sw.js
          MC_CHROMIUM=/path/to/chrome ...   # optional browser override
*/
const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const ORIGIN = 'https://mcross2298.github.io/4-Weeks-to-Open-/';
const PORT = 8443 + Math.floor(Math.random() * 400);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'fa-sw-'));
const SITE = path.join(WORK, 'site');
const TREE = path.join(SITE, '4-Weeks-to-Open-');
const CERT = path.join(WORK, 'cert.pem');
const KEY = path.join(WORK, 'key.pem');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0, server = null;
function report(id, title, ok, expected, observed) {
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + id + ' ' + title + ' — expected: ' + expected + (ok ? '' : ' | observed: ' + observed));
}

function copyTree() {
  const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  files.forEach((f) => {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src) || fs.statSync(src).isDirectory()) return;
    const dst = path.join(TREE, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  });
}
async function up() {
  server = spawn('python3', ['-I', path.join(__dirname, 'fa-https-server.py'), SITE, String(PORT), CERT, KEY], { stdio: 'ignore' });
  await sleep(900);
}
async function down() { if (server) { server.kill('SIGKILL'); server = null; } await sleep(400); }

// A last-resort watchdog: whatever goes wrong, this script ends with a FAIL
// rather than holding a CI runner until its own timeout.
setTimeout(() => { console.log('HARNESS TIMEOUT after 8 minutes'); process.exit(2); }, 8 * 60000).unref();

(async () => {
  copyTree();
  execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout "' + KEY + '" -out "' + CERT + '" -days 2 ' +
    '-subj "/CN=mcross2298.github.io" -addext "subjectAltName=DNS:mcross2298.github.io"', { stdio: 'ignore' });

  const browser = await chromium.launch({
    executablePath: process.env.MC_CHROMIUM || undefined,
    args: ['--host-resolver-rules=MAP mcross2298.github.io 127.0.0.1:' + PORT +
      ', MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9, MAP *.supabase.co 127.0.0.1:9, MAP cdn.jsdelivr.net 127.0.0.1:9',
      '--ignore-certificate-errors'],
    // Every host this test touches is mapped above, so none of it may go
    // through a proxy. `--no-proxy-server` is not enough in every
    // environment (an agent sandbox's Chromium keeps tunnelling through the
    // ambient proxy and fails with ERR_TUNNEL_CONNECTION_FAILED), while
    // Playwright's own proxy option is honoured: the mapped hosts bypass it,
    // and anything unmapped hits a dead port, which is what this test wants.
    proxy: { server: 'http://127.0.0.1:9', bypass: 'mcross2298.github.io,fonts.googleapis.com,fonts.gstatic.com,*.supabase.co,cdn.jsdelivr.net' }
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  // Every in-page call has a deadline. page.evaluate() has none of its own, so
  // a promise that never settles (MCOfflinePrefetch.ensure() against a server
  // that is down, say) used to hang the whole CI step: on PR #369 one failed
  // check sat for 2.5 hours until the run was cancelled. A call that runs out
  // of time returns null, which the check reading it reports as a FAIL.
  const EVAL_MS = 20000;
  const safe = async (fn, arg) => {   // the SW's activation can reload the page mid-call
    for (let i = 0; i < 10; i++) {
      try {
        return await Promise.race([page.evaluate(fn, arg),
          sleep(EVAL_MS).then(() => { throw new Error('EVAL_TIMEOUT'); })]);
      } catch (e) {
        if (e.message === 'EVAL_TIMEOUT') return null;
        if (!/destroyed|navigat/i.test(e.message)) throw e;
        await sleep(800);
      }
    }
    return null;
  };
  const visit = async (p) => {
    try { await page.goto(ORIGIN + p, { timeout: 15000 }); } catch (e) { return 'navigation error'; }
    await sleep(1300);
    return safe(() => (document.title.indexOf('Offline') !== -1 ? 'offline page' : 'loaded'));
  }
  // Right after a simulated deploy the page's own update check can find the
  // new worker and reload the page at the moment the harness navigates, and
  // Chromium reports the navigation it cut off as net::ERR_ABORTED (#372 CI,
  // twice in four runs). That is the harness racing the app's update, not an
  // app failure: S-06 to S-09 assert the update itself. Retry once.
  async function gotoSettled(url) {
    try { return await page.goto(url); }
    catch (e) {
      if (!/ERR_ABORTED/.test(String(e && e.message))) throw e;
      await sleep(1000);
      return page.goto(url);
    }
  };
  const cached = () => safe(async () => {
    const out = [];
    for (const k of await caches.keys()) {
      if (k.indexOf('fonts') !== -1) continue;
      const c = await caches.open(k);
      (await c.keys()).forEach((r) => { if (/\.html(\?|$)/.test(r.url)) out.push(r.url.split('/').pop().split('?')[0]); });
    }
    return out;
  });

  try {
    await up();
    await page.goto(ORIGIN + 'dashboard.html'); await sleep(1500);
    await safe(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); await sleep(1500);
    const controlled = await safe(() => !!navigator.serviceWorker.controller);
    report('S-01', 'control: the service worker installs and controls the page', controlled, 'controlled', String(controlled));

    await safe(() => window.MCOfflinePrefetch && MCOfflinePrefetch.ensure({ id: 'mm' }));
    await page.goto(ORIGIN + 'mm-p1.html?day=1'); await sleep(1500);
    await page.goto(ORIGIN + 'dashboard.html'); await sleep(1000);

    // ---------- offline ----------
    await down(); await ctx.setOffline(true);
    const prog = [await visit('mm-p1.html?day=1'), await visit('mm-p2.html'), await visit('cat-mm.html')];
    report('S-02', 'control: the prefetched program loads offline', prog.every((x) => x === 'loaded'), 'mm-p1, mm-p2, cat-mm load', prog.join(', '));

    await visit('mm-p1.html?day=1'); await sleep(800);
    for (let s = 0; s < 2; s++) {
      const r = page.locator('.ex-card').first().locator('.mcl-row').nth(s);
      const i = r.locator('input'); await i.nth(0).fill('120'); await i.nth(1).fill('5'); await r.locator('.mcl-ck').click(); await sleep(300);
    }
    await page.locator('#mcsEnd').click(); await sleep(500);
    await safe(() => window._FW && _FW.confirm()); await sleep(2500);
    const saved = await safe(() => ((JSON.parse(localStorage.getItem('mc_workout_log_v1') || '[]')[0] || {}).sets || []).length);
    report('S-03', 'control: a workout can be logged and finished offline', saved === 2, '2 sets saved', saved + ' sets saved');

    const core = [await visit('workout-logs.html'), await visit('stats.html'), await visit('exercise-library.html')];
    report('S-04', 'History, Stats and the exercise library load offline', core.every((x) => x === 'loaded'), 'all three load', core.join(', '));

    const noise = await safe(() => (JSON.parse(localStorage.getItem('mc_errors_v1') || '[]')).filter((e) => /update a ServiceWorker/i.test(e.m || '')).length);
    report('S-05', 'going offline records no error noise', noise === 0, '0 "Failed to update a ServiceWorker" errors', noise + ' recorded');

    // ---------- simulated deploy (edits the COPY's sw.js only) ----------
    await ctx.setOffline(false);
    const swPath = path.join(TREE, 'sw.js');
    const sw = fs.readFileSync(swPath, 'utf8');
    let newCache = null;
    fs.writeFileSync(swPath, sw.replace(/mc-training-v(\d+)/, (m, n) => (newCache = 'mc-training-v' + (Number(n) + 1))));
    await up();
    await gotoSettled(ORIGIN + 'dashboard.html'); await sleep(1500);
    await safe(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    // Wait for the new worker to have ACTIVATED (its cache exists and nothing
    // is still installing or waiting) rather than for a fixed time. A flat 7s
    // was enough here and not always on a CI runner, where S-08 then went
    // offline mid-handover and saw a navigation error.
    const deadline = Date.now() + 45000;
    // Activation is page-controlled (sw.js never calls skipWaiting itself), and
    // the page's idle check does not always fire inside the window: 1 run in 3
    // here left the worker parked in `waiting` for all 45s. After 10s the
    // harness does what the "Update available" banner's tap does. S-08 to S-09
    // test the deploy's caches, not when the page chooses to apply it.
    const nudgeAt = Date.now() + 10000;
    let settled = false;
    while (!settled && Date.now() < deadline) {
      settled = await safe(async ([name, nudge]) => {
        const r = await navigator.serviceWorker.getRegistration();
        if (nudge && r && r.waiting) r.waiting.postMessage('skipWaiting');
        return !!(r && r.active && !r.installing && !r.waiting && (await caches.keys()).indexOf(name) !== -1);
      }, [newCache, Date.now() > nudgeAt]);
      if (!settled) await sleep(1000);
    }
    if (!settled) console.log('  note: the new service worker had not settled after 45s');
    await sleep(1500);

    // The two halves of the R3 fix, apart. S-08: straight after the update,
    // before the dashboard has re-prefetched anything, the SW's carry-over
    // cache is all that stands between the athlete and the offline page.
    await down(); await ctx.setOffline(true);
    const carried = await visit('mm-p2.html');
    report('S-08', 'right after a deploy, the carried copy loads offline', carried === 'loaded', 'mm-p2 loads', carried);
    await ctx.setOffline(false); await up();
    await gotoSettled(ORIGIN + 'dashboard.html'); await sleep(1500);

    await safe(() => window.MCOfflinePrefetch && MCOfflinePrefetch.ensure({ id: 'mm' })); await sleep(1500);
    // S-09: the page side re-fills the NEW deploy's own cache, so the program
    // is fresh again rather than living on the carried copy.
    const inNew = await safe(async () => {
      const app = (await caches.keys()).filter((k) => /^mc-training-/.test(k) && !/fonts|carry/.test(k));
      if (app.length !== 1) return 'app caches: ' + app.join(',');
      const c = await caches.open(app[0]);
      return !!(await c.match('mm-p2.html', { ignoreSearch: true }));
    });
    report('S-09', 'the next dashboard visit re-fills the new deploy\'s cache', inNew === true, 'mm-p2 in the new app cache', String(inNew));
    const afterDeploy = await cached();
    const claims = await safe(() => !!(window.MCOfflinePrefetch && MCOfflinePrefetch.status('mm')));
    const has = (afterDeploy || []).indexOf('mm-p2.html') !== -1;
    report('S-06', '"Available offline" matches the cache after a deploy', !claims || has, 'claim only when cached',
      'claims available=' + claims + ', mm-p2 cached=' + has);

    await down(); await ctx.setOffline(true);
    const post = [await visit('mm-p1.html?day=1'), await visit('mm-p2.html')];
    report('S-07', 'the program still loads offline after a deploy', post.every((x) => x === 'loaded'), 'both load', post.join(', '));
  } finally {
    await down();
    await browser.close();
    fs.rmSync(WORK, { recursive: true, force: true });
  }
  console.log('\n' + (pass + fail) + ' checks: ' + pass + ' pass, ' + fail + ' fail' +
    (fail ? '  (each FAIL is an open item in flagship-readiness-roadmap.md, phase R3)' : ''));
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.log('HARNESS ERROR ' + e.message); await down(); process.exit(2); });
