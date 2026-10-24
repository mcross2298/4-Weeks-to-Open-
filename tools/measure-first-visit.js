#!/usr/bin/env node
/* tools/measure-first-visit.js — flagship readiness J (D-40)

   What a FIRST visit to a page costs on a slow phone connection: how many
   script requests it makes, how many bytes cross the wire, and when the page
   first paints, finishes parsing (DOMContentLoaded) and finishes loading.

   Served the way GitHub Pages serves it, because the answer depends on it:
     * HTTP/2 over TLS (a throwaway self-signed certificate), so requests
       multiplex on one connection. Over HTTP/1.1 Chromium opens six
       connections per host and queues the rest, which would overstate what
       fewer files buys.
     * gzip on every text response, so byte counts are transfer sizes rather
       than file sizes.
   Throttled with the Chrome DevTools "Slow 3G" preset (2000 ms latency,
   ~400 kbit/s down, ~400 kbit/s up) through CDP. Service workers are blocked,
   so the run measures the page itself and not the precache that would
   compete with it on a real first visit; HTTP cache is disabled.

   A measurement, not a gate: the numbers depend on this machine's CPU and
   this Chromium build. Each page is loaded RUNS times and the median kept.

   usage: node tools/measure-first-visit.js [page.html ...]
          (default: three pages, one per card-engine family)
          MC_CHROMIUM=/path/to/chromium overrides the browser.
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http2 = require('http2');
const zlib = require('zlib');
const { execSync } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/tmp/pw-ci/node_modules/playwright')); }

const ROOT = path.resolve(__dirname, '..');
const RUNS = 3;
const PAGES = process.argv.slice(2).length ? process.argv.slice(2)
  : ['mc-s1-back.html', 'mm-p1.html', 'kitchen-sink-s3.html'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2' };

function median(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

(async () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-fv-'));
  const key = path.join(work, 'k.pem'), cert = path.join(work, 'c.pem');
  execSync('openssl req -x509 -newkey rsa:2048 -nodes -keyout "' + key + '" -out "' + cert +
    '" -days 1 -subj "/CN=localhost" 2>/dev/null');
  const gz = new Map();
  const server = http2.createSecureServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) });
  server.on('stream', (stream, headers) => {
    const url = decodeURIComponent((headers[':path'] || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      stream.respond({ ':status': 404 }); return stream.end();
    }
    const ext = path.extname(file);
    const type = TYPES[ext] || 'application/octet-stream';
    let body = fs.readFileSync(file);
    const h = { ':status': 200, 'content-type': type, 'cache-control': 'no-cache' };
    if (/^text|json|svg/.test(type) && /gzip/.test(headers['accept-encoding'] || '')) {
      if (!gz.has(file)) gz.set(file, zlib.gzipSync(body, { level: 6 }));
      body = gz.get(file); h['content-encoding'] = 'gzip';
    }
    stream.respond(h); stream.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'https://localhost:' + server.address().port + '/';

  const browser = await chromium.launch(Object.assign({ args: ['--ignore-certificate-errors'] },
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}));
  const rows = [];
  for (const page of PAGES) {
    const samples = [];
    for (let i = 0; i < RUNS; i++) {
      const ctx = await browser.newContext({ serviceWorkers: 'block', ignoreHTTPSErrors: true });
      const p = await ctx.newPage();
      // Fonts and the backend are third-party and unreachable from a sandbox;
      // leaving them out keeps the number about this repository's own files.
      await p.route(/fonts\.(googleapis|gstatic)\.com|supabase\.co|jsdelivr\.net/, (r) => r.abort());
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000,
        downloadThroughput: 500 * 1024 / 8 * 0.8, uploadThroughput: 500 * 1024 / 8 * 0.8 });
      const sizes = new Map(), kinds = new Map();
      cdp.on('Network.responseReceived', (e) => kinds.set(e.requestId, e.type));
      cdp.on('Network.loadingFinished', (e) => sizes.set(e.requestId, e.encodedDataLength));
      await p.goto(origin + page, { waitUntil: 'load', timeout: 180000 });
      const t = await p.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return { fcp: fcp ? fcp.startTime : null, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd };
      });
      let scripts = 0, scriptBytes = 0, bytes = 0, requests = 0;
      for (const [id, n] of sizes) {
        requests++; bytes += n;
        if (kinds.get(id) === 'Script') { scripts++; scriptBytes += n; }
      }
      samples.push(Object.assign(t, { scripts, scriptBytes, bytes, requests }));
      await ctx.close();
    }
    const m = (k) => median(samples.map((s) => s[k]));
    rows.push({ page, requests: m('requests'), scripts: m('scripts'),
      scriptKB: Math.round(m('scriptBytes') / 1024), totalKB: Math.round(m('bytes') / 1024),
      fcp: Math.round(m('fcp')), dcl: Math.round(m('dcl')), load: Math.round(m('load')) });
  }
  await browser.close();
  server.close();
  console.log('first visit, HTTP/2 + gzip, Slow 3G, median of ' + RUNS + ':');
  console.table(rows);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
