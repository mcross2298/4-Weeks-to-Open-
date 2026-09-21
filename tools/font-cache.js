'use strict';
/* ==========================================================================
   font-cache.js — make the browser gates render in the REAL webfonts,
   in any environment, deterministically.
   --------------------------------------------------------------------------
   THE CONSTRAINT THIS RETIRES. Four separate passes recorded, as immovable,
   that a ratchet baseline "cannot be generated from an agent sandbox":
   premium-design-roadmap.md's P4, W-I3's dark-budget note, the
   post-implementation verification pass, and check-visual-ratchet.js's own
   seed entry. Every one of them is describing the same measurement:

     curl https://fonts.googleapis.com/...  -> 200
     headless Chromium, same URL            -> fails, document.fonts.size 0

   The conclusion drawn was "the network is blocked". It is not. NODE can
   reach that host; only the BROWSER's request fails. So the fix is not to
   avoid baselining, it is to fetch the files out-of-band and hand them to the
   browser through a Playwright route. Measured on dashboard.html:

     without   fonts.size 0   Archivo 247.58  Manrope 247.58  fallback 247.58
     with      fonts.size 45  Archivo 219.22  Manrope 215.38  fallback 247.58

   Three distinct widths instead of one, and the page's own height moves
   1546 -> 1522. That is the real face rendering, not the system fallback.

   WHY THIS IS ALSO RIGHT FOR CI, not just for a sandbox. CI reaches Google
   today, so nothing is broken there — but it means every ratchet run depends
   on a third-party CDN being up and serving the same bytes. Routing from a
   local cache makes the numbers a function of the repository instead, so a
   Google outage or a font revision cannot move a budget under anyone's feet.
   The cache is fetched once per run and reused.

   WHAT THIS IS NOT FOR. Fonts make a gate's input the real typeface; they do
   not make a RASTERISED measurement portable. A count (how many elements fail
   a contrast ratio) survives a change of browser build; the measured width of
   rendered text does not -- shaping and hinting differ between Chromium
   builds by fractions of a pixel. check-journey.js was wired to this module
   so its two text-derived width budgets could finally be filled in; every
   local gate went green and CI then failed, because CI installs its own
   Playwright Chromium and this sandbox runs /opt/pw-browsers/chromium, while
   that gate's CHROME_EPSILON is 0.3. The wiring was reverted. Use this module
   for gates whose baseline is a count or a colour, not for one whose baseline
   is pixels -- that includes check-visual-ratchet.js, which deliberately takes
   no font wiring either.

   FAIL-OPEN BY DESIGN. If the fetch cannot happen (no network at all), the
   handler installs nothing and the page renders exactly as it does today.
   A gate that cannot get fonts still runs; it simply measures what it always
   measured. Callers can ask whether fonts are active via the returned flag
   and say so in their output, so a run is never silently the weaker kind.

   INSTALL LAST. Playwright matches routes LAST-REGISTERED-FIRST, and every
   gate in this tree already aborts fonts.googleapis.com because it was
   unreachable. So an install() called above that abort is silently overridden
   and the run measures the system fallback while reporting that fonts are on.
   That is not hypothetical -- it is how this module was first wired into
   check-journey.js, and the giveaway was that the "with fonts" run came back
   byte-identical to the run without. Measured both orderings on the same page:

     install() then abort()   -> document.fonts.size 0
     abort() then install()   -> document.fonts.size 45

   Keep the aborts (they are what makes the fail-open path degrade instead of
   hang) and call install() after them.

   Usage:
     const fontCache = require('./font-cache');
     const fonts = await fontCache.prepare();        // fetch/reuse the cache
     await ctx.route('**://fonts.googleapis.com/**', r => r.abort());  // if any
     await fonts.install(context);                   // Playwright BrowserContext
     if (!fonts.active) console.log('  (system fallback fonts)');
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

// Outside the repo on purpose: these are third-party binaries, they are not
// ours to commit, and build-sw.py/build-market.py would both have to learn
// about them if they lived in the tree.
const CACHE_DIR = process.env.MC_FONT_CACHE || path.join(os.tmpdir(), 'mc-font-cache');

// The one stylesheet every page in this tree requests. Read from the source
// rather than retyped, so a change to the families cannot drift from this.
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Manrope:wght@400;500;600;700;800&display=swap';

// Google serves woff2 only to a UA it recognises; with Node's default UA it
// returns the much larger, differently-metricked TTF set. Asking for what the
// real browser would get is the whole point.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const keyFor = u => crypto.createHash('md5').update(u).digest('hex').slice(0, 16) + '.woff2';

function get(url, asBuffer) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA }, timeout: 15000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function prepare() {
  const cssPath = path.join(CACHE_DIR, 'fonts.css');
  let css = null;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : null;
    if (!css) { css = await get(CSS_URL, false); fs.writeFileSync(cssPath, css); }

    const urls = [...new Set((css.match(/https:\/\/fonts\.gstatic\.com[^)]*/g) || []))];
    if (!urls.length) throw new Error('stylesheet named no font files');
    for (const u of urls) {
      const f = path.join(CACHE_DIR, keyFor(u));
      if (!fs.existsSync(f)) fs.writeFileSync(f, await get(u, true));
    }
    return {
      active: true,
      files: urls.length,
      async install(context) {
        await context.route('https://fonts.googleapis.com/**', r =>
          r.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: css }));
        await context.route('https://fonts.gstatic.com/**', r => {
          const f = path.join(CACHE_DIR, keyFor(r.request().url()));
          // A url the cached stylesheet never named: let it try the network
          // rather than abort, so an unexpected face degrades to today's
          // behaviour instead of rendering as a missing glyph.
          if (!fs.existsSync(f)) return r.continue();
          r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) });
        });
      }
    };
  } catch (e) {
    return { active: false, reason: e.message, files: 0, async install() { /* fail open */ } };
  }
}

module.exports = { prepare, CACHE_DIR, CSS_URL };
