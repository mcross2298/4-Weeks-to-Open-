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

(async () => {
  copyTree();
  execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout "' + KEY + '" -out "' + CERT + '" -days 2 ' +
    '-subj "/CN=mcross2298.github.io" -addext "subjectAltName=DNS:mcross2298.github.io"', { stdio: 'ignore' });

  const browser = await chromium.launch({
    executablePath: process.env.MC_CHROMIUM || undefined,
    args: ['--host-resolver-rules=MAP mcross2298.github.io 127.0.0.1:' + PORT +
      ', MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9, MAP *.supabase.co 127.0.0.1:9, MAP cdn.jsdelivr.net 127.0.0.1:9',
      '--ignore-certificate-errors', '--no-proxy-server']
  });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await ctx.newPage();
  const safe = async (fn, arg) => {   // the SW's activation can reload the page mid-call
    for (let i = 0; i < 10; i++) {
      try { return await page.evaluate(fn, arg); }
      catch (e) { if (!/destroyed|navigat/i.test(e.message)) throw e; await sleep(800); }
    }
    return null;
  };
  const visit = async (p) => {
    try { await page.goto(ORIGIN + p, { timeout: 15000 }); } catch (e) { return 'navigation error'; }
    await sleep(1300);
    return safe(() => (document.title.indexOf('Offline') !== -1 ? 'offline page' : 'loaded'));
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
    fs.writeFileSync(swPath, sw.replace(/mc-training-v(\d+)/, (m, n) => 'mc-training-v' + (Number(n) + 1)));
    await up();
    await page.goto(ORIGIN + 'dashboard.html'); await sleep(1500);
    await safe(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await sleep(7000);
    await safe(() => window.MCOfflinePrefetch && MCOfflinePrefetch.ensure({ id: 'mm' })); await sleep(1500);
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
