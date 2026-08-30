#!/usr/bin/env node
/* tools/check-deploy-artifact.js — R-I2 (VOC/VOA Kaizen audit).

   MC-Training-Rolodex is force-pushed by market-deploy.yml with ZERO
   verification of the thing a user actually loads: no `.github/workflows`
   directory exists there at all, so nothing checks the deployed artifact —
   a defect introduced by the EXTRACTION (build-market.py, the strip step,
   GitHub Pages propagation itself) rather than the source would reach
   real users unopposed, and 4-Weeks-to-Open-'s own green CI proves nothing
   about it.

   This is a minimal post-deploy smoke test, run as a job in
   market-deploy.yml AFTER the force-push: the shell boots (a real browser,
   not just an HTTP status), zero console errors, a real precached asset
   resolves, and a leak re-scan against content-manifest.json's own
   'scratch' + 'licensed' lists — re-verified against the LIVE deployed
   artifact, not the local extraction build-market.py --check already
   proved clean before the push.

   Usage:
     node tools/check-deploy-artifact.js <baseUrl> [--timeout-ms N] [--poll-ms N]

   Exit code is 0 only if every check passes. */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const baseUrl = (argv[0] || '').replace(/\/$/, '');
if (!baseUrl || baseUrl.startsWith('--')) {
  console.error('usage: node tools/check-deploy-artifact.js <baseUrl> [--timeout-ms N] [--poll-ms N]');
  process.exit(1);
}
function opt(name, dflt) {
  const i = argv.indexOf('--' + name);
  return i === -1 || i === argv.length - 1 ? dflt : argv[i + 1];
}
// GitHub Pages propagation after a force-push isn't instant — poll rather
// than assume a fixed sleep is either long enough or not wastefully long.
const TIMEOUT_MS = parseInt(opt('timeout-ms', '300000'), 10);
const POLL_MS = parseInt(opt('poll-ms', '10000'), 10);

const ROOT = path.join(__dirname, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'content-manifest.json'), 'utf8'));
const SCRATCH = MANIFEST.scratch || [];
const LICENSED = Object.values(MANIFEST.licensed || {}).flatMap((s) => s.files || []);
// build-market.py's own extract() WRITES a market-facing README.md into the
// output (see its docstring point 6) — a same-named but different-content
// file it generates itself, even though the source repo's README.md is
// separately scratch-listed. A blind 404 check on every scratch name would
// permanently fail here on a file that's SUPPOSED to be live. Found by
// actually running this against a real extraction, not by reading the code.
const REGENERATED_BY_EXTRACT = new Set(['README.md']);

async function fetchStatus(url) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    return res.status;
  } catch (e) {
    return null; // network error — treated like "not up yet" by the caller
  }
}

async function waitUntilLive(url, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await fetchStatus(url);
    if (last === 200) return;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `${url} never returned 200 within ${timeoutMs}ms (last status: ${last === null ? 'network error' : last})`
  );
}

async function main() {
  const failures = [];
  const dashboardUrl = baseUrl + '/dashboard.html';

  console.log('waiting for ' + dashboardUrl + ' to go live...');
  await waitUntilLive(dashboardUrl, TIMEOUT_MS, POLL_MS);
  console.log('  live.');

  /* ---- shell boots, zero console errors, in a real browser ------------- */
  const browser = await chromium.launch(
    process.env.MC_CHROMIUM ? { executablePath: process.env.MC_CHROMIUM } : {}
  );
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(dashboardUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const booted = await page.evaluate(() => !!document.querySelector('.topbar, #scr-dashboard'));
  if (!booted) failures.push('dashboard.html loaded but the shell never rendered (.topbar/#scr-dashboard missing)');
  if (errors.length) failures.push('console/page errors on load:\n    ' + errors.join('\n    '));

  await browser.close();

  /* ---- a real precached asset resolves ---------------------------------- */
  const swUrl = baseUrl + '/sw.js';
  const swRes = await fetch(swUrl);
  if (swRes.status !== 200) {
    failures.push(`${swUrl} returned ${swRes.status}, expected 200`);
  } else {
    const swText = await swRes.text();
    const block = swText.split('AUTOGEN:URLS START')[1];
    const urls = block ? Array.from(block.matchAll(/'([^']+)'/g)).map((m) => m[1]) : [];
    const sample = urls.filter((u) => u !== './').slice(0, 5);
    if (!sample.length) {
      failures.push(`${swUrl} has no parseable precache URLs between the AUTOGEN markers`);
    } else {
      for (const u of sample) {
        const assetUrl = baseUrl + '/' + u.replace(/^\.\//, '');
        const status = await fetchStatus(assetUrl);
        if (status !== 200) failures.push(`precached asset 404s on the live site: ${assetUrl} (${status})`);
      }
    }
  }

  /* ---- leak re-scan against the LIVE artifact --------------------------- */
  // build-market.py --check already proved the local extraction clean before
  // the push landed — this re-checks the thing that's actually reachable now,
  // catching a defect the extraction step or Pages propagation itself could
  // introduce (a stale cache serving a pre-strip commit, a strip regression).
  const mustBeAbsent = [...new Set([...SCRATCH, ...LICENSED])]
    .filter((f) => !f.includes('/') && !REGENERATED_BY_EXTRACT.has(f));
  for (const f of mustBeAbsent) {
    const status = await fetchStatus(baseUrl + '/' + f);
    if (status !== 404 && status !== null) {
      failures.push(`${f} is reachable on the live Rolodex site (status ${status}) — should be scratch/licensed-excluded`);
    }
  }

  if (failures.length) {
    console.error('\nFAILURES (' + failures.length + '):');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  console.log(`\nOK — shell boots clean, ${mustBeAbsent.length} scratch/licensed files confirmed unreachable, precache sample resolves.`);
}

main().catch((e) => {
  console.error('check-deploy-artifact.js crashed: ' + (e && e.stack || e));
  process.exit(1);
});
