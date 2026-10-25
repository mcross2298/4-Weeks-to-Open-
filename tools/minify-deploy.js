#!/usr/bin/env node
/* tools/minify-deploy.js — flagship readiness J, Phase T2.3

   J bundled the shared modules and measured that bytes barely moved, because
   concatenation is not minification, and bytes are what dominate a slow link.
   This minifies the DEPLOY ARTIFACT, never the repository: the committed
   source stays exactly what a contributor reads and edits, and every gate in
   verify.yml keeps reading it. There is still no package.json and no build
   step in the tree.

   Safety rules, each one because of how this app is put together:
     * Classic scripts share one global scope, so top-level names are never
       renamed (terser's default `toplevel: false`) and no global is dropped:
       one file's top-level function is another file's API.
     * Function names are kept (`keep_fnames`), and so are class names, so an
       error's stack in mc_errors_v1 and the beacon still says where it came
       from.
     * Only the syntax every target browser already runs: `ecma: 2018` output,
       no unsafe compress transforms.
     * Already-minified vendored code (supabase-vendor.js) is copied as is.
     * A file terser cannot parse FAILS the run. Shipping that file unminified
       would hide the error; failing it surfaces it.

   It is verified, not trusted: verify.yml minifies a copy of the tree with
   this script and drives the browser gates against that copy, so the code
   that deploys is the code those gates ran.

   terser is installed into a scratch prefix outside the repo, pinned, the
   way Playwright already is. Usage:
     NODE_PATH=/tmp/min-ci/node_modules node tools/minify-deploy.js <dir> [--report]
   <dir> is minified IN PLACE: pass a copy (CI) or the deploy checkout.
*/
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const REPORT = process.argv.includes('--report');
if (!DIR || !fs.existsSync(DIR)) { console.error('usage: node tools/minify-deploy.js <dir> [--report]'); process.exit(2); }

let terser;
try { terser = require('terser'); }
catch (e) { console.error('minify-deploy: terser is not installed (NODE_PATH=<prefix>/node_modules)'); process.exit(2); }

// Directories that never ship, or are not browser code.
const SKIP_DIRS = new Set(['tools', 'supabase', 'tests', 'templates', '.github', '.git', 'node_modules', 'GO_LIVE']);
// Shipped as is: already minified upstream.
const AS_IS = new Set(['supabase-vendor.js']);

const OPTIONS = {
  ecma: 2018,
  compress: { passes: 1, unsafe: false, keep_fargs: true, keep_infinity: true },
  mangle: { toplevel: false, keep_fnames: true, keep_classnames: true },
  keep_fnames: true,
  keep_classnames: true,
  toplevel: false,
  format: { comments: false, ecma: 2018 },
};

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!SKIP_DIRS.has(name) && !name.startsWith('.')) walk(p, out); }
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

(async () => {
  const files = walk(path.resolve(DIR), []);
  let before = 0, after = 0, done = 0;
  const rows = [], failures = [];
  for (const f of files) {
    const rel = path.relative(DIR, f);
    const src = fs.readFileSync(f, 'utf8');
    before += Buffer.byteLength(src);
    if (AS_IS.has(path.basename(f))) { after += Buffer.byteLength(src); continue; }
    let out;
    try { out = await terser.minify({ [rel]: src }, OPTIONS); }
    catch (e) { failures.push(rel + ': ' + (e && e.message)); continue; }
    if (!out || typeof out.code !== 'string') { failures.push(rel + ': no output'); continue; }
    // A minified copy is never allowed to grow a file.
    const code = Buffer.byteLength(out.code) < Buffer.byteLength(src) ? out.code : src;
    fs.writeFileSync(f, code);
    after += Buffer.byteLength(code);
    done++;
    rows.push([rel, Buffer.byteLength(src), Buffer.byteLength(code)]);
  }
  if (failures.length) {
    failures.forEach((m) => console.error('::error::minify-deploy: ' + m));
    process.exit(1);
  }
  if (REPORT) {
    rows.sort((a, b) => b[1] - a[1]).slice(0, 15).forEach((r) =>
      console.log('  ' + r[0].padEnd(34) + String(Math.round(r[1] / 1024)).padStart(6) + ' KB -> ' +
        String(Math.round(r[2] / 1024)).padStart(5) + ' KB'));
  }
  console.log('minify-deploy: ' + done + ' files minified, ' + Math.round(before / 1024) + ' KB -> ' +
    Math.round(after / 1024) + ' KB (' + Math.round((1 - after / before) * 100) + '% smaller)');
})();
