#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-push-chain.js — the notification opt-in chain must be intact
   --------------------------------------------------------------------------
   Roadmap Phase 1 step 1 (audit P2-01/EN-3). Every link in this chain is
   written as an OPTIONAL guard, which is correct defensive style and means
   the whole feature can break without a single error anywhere:

     dashboard.html   if(!window.MC_PUSH) return;              <- silent
     mc-finish.js     loadPushModule().then(...).catch(fn(){}) <- silent
     mc-push.js       if (window.MC_SB && MC_SB.savePush...)   <- silent
     mc-supabase.js   .catch(function(){})  (best-effort)      <- silent

   So a renamed file, a dropped <script> tag or a renamed export produces an
   athlete who taps "Notify me" and gets nothing, with a clean console. That
   is the same defect SHAPE this repo has now met four times — #pushChip
   (Phase 4.5), MC_TOAST (Phase 5.3), MCSwap and loadWrapped() (the
   verification pass) — and check-dangling-refs.js cannot see this one,
   because window.MC_PUSH IS assigned in mc-push.js. The question it does not
   ask is whether the PAGE THAT CALLS IT ever loads that file.

   It matters more here than the count of call sites suggests: the push
   pipeline has never delivered a notification (push_subscriptions read 0 rows
   on 2026-09-19, and the weekly check-in has failed every scheduled run since
   12 July), so there is no working behaviour anyone would notice losing.

   Deliberately explicit assertions, not a count ratchet: a ratchet seeded at
   today's numbers would let a DIFFERENT link be broken and swapped in for one
   already counted, and still pass.

   Run: node tools/check-push-chain.js
   ========================================================================== */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fail = [];
const note = [];

function read(f) {
  try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; }
}

// Comments quote and explain this machinery all over the tree (this file
// included), so a scan that counts them reports links that are not there.
// Spaces preserve every offset, matching check-design-tokens.js's decomment().
function decomment(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g,
    (m, pre) => (pre || '') + ' '.repeat(m.length - (pre || '').length));
}

// ---------------------------------------------------------------------------
// 1. The module itself exists and publishes the entry point.
// ---------------------------------------------------------------------------
const pushSrc = read('mc-push.js');
if (!pushSrc) {
  fail.push('mc-push.js is missing — the entire opt-in chain is dead');
} else {
  const p = decomment(pushSrc);
  if (!/window\.MC_PUSH\s*=/.test(p)) fail.push('mc-push.js no longer assigns window.MC_PUSH');
  for (const fn of ['requestAndSubscribe', 'isSupported', 'getState']) {
    if (!new RegExp('\\b' + fn + '\\b').test(p)) fail.push('mc-push.js no longer defines ' + fn + '()');
  }
  // The one hop that actually reaches the database. The open paren is required
  // on purpose: this file also GUARDS on the same name
  // (`if (window.MC_SB && MC_SB.savePushSubscription)`), so a check for the
  // bare name passes while the call beneath it has been renamed to something
  // that does not exist. Proven — that exact regression slipped through the
  // first version of this gate.
  if (!/MC_SB\.savePushSubscription\s*\(/.test(p)) {
    fail.push('mc-push.js never CALLS MC_SB.savePushSubscription(...) — a granted permission would be stored nowhere');
  }
}

// ---------------------------------------------------------------------------
// 2. The database writer exists and is exported.
//
// A subscription that is created in the browser and never persisted means the
// Edge Function has nobody to send to, which is exactly the state the live
// table is in.
// ---------------------------------------------------------------------------
const sbSrc = read('mc-supabase.js');
if (!sbSrc) {
  fail.push('mc-supabase.js is missing');
} else {
  const s = decomment(sbSrc);
  for (const fn of ['savePushSubscription', 'deletePushSubscription']) {
    if (!new RegExp('function\\s+' + fn + '\\s*\\(').test(s)) fail.push('mc-supabase.js no longer defines ' + fn + '()');
    if (!new RegExp(fn + '\\s*:\\s*' + fn).test(s)) fail.push('mc-supabase.js no longer EXPORTS ' + fn + ' on MC_SB');
  }
  if (!/from\(['"]push_subscriptions['"]\)/.test(s)) {
    fail.push('mc-supabase.js never touches the push_subscriptions table');
  }
}

// ---------------------------------------------------------------------------
// 3. Every caller can actually reach the module.
//
// Two legitimate ways to reach it, and both are checked rather than assumed:
//   - a plain <script src="mc-push.js"> tag on the page, or
//   - a lazy loader whose hardcoded path resolves to a real file.
// A JS module that calls MC_PUSH without either is relying on some OTHER file
// having loaded it, which is the coupling that breaks silently.
// ---------------------------------------------------------------------------
const files = execSync('git ls-files "*.js" "*.html"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter(f => !f.startsWith('tools/') && !f.startsWith('GO_LIVE/') && f !== 'mc-push.js');

let callers = 0;
for (const f of files) {
  const raw = read(f);
  if (raw === null) continue;
  const src = decomment(raw);
  // Bare \bMC_PUSH\b, NOT `MC_PUSH\s*\.` — mc-finish.js reaches the module as
  // a VALUE (`window.MC_PUSH ? res(window.MC_PUSH) : rej()`) and then calls
  // through a local alias (`P.requestAndSubscribe()`), so a dot-access pattern
  // misses the one file whose path string most needs checking. Proven: with
  // the narrower pattern this gate counted 1 caller and passed a renamed
  // lazy-load path.
  if (!/\bMC_PUSH\b/.test(src)) continue;
  callers++;

  const hasTag = /<script[^>]+src=["'][^"']*mc-push\.js["']/.test(src);
  // A loader assigns the path to a .src — catch it whichever way it is written.
  const loaderPaths = [];
  const LOADER = /\.src\s*=\s*['"]([^'"]*mc-push\.js)['"]/g;
  let m;
  while ((m = LOADER.exec(src))) loaderPaths.push(m[1]);

  if (!hasTag && !loaderPaths.length) {
    fail.push(f + ' calls MC_PUSH.* but neither loads mc-push.js nor lazy-loads it');
  }
  // A lazy loader's path is a STRING: nothing resolves it until a real athlete
  // taps the button, and the failure lands in an empty catch.
  for (const p of loaderPaths) {
    const target = path.resolve(ROOT, path.dirname(f), p);
    if (!fs.existsSync(target)) {
      fail.push(f + ' lazy-loads "' + p + '", which does not resolve to a file');
    }
  }
}
if (!callers) fail.push('nothing in the tree calls MC_PUSH.* — the opt-in has no trigger at all');

// ---------------------------------------------------------------------------
// 4. The service worker can receive what the server sends.
//
// A push with no 'push' listener is delivered and dropped; no listener, no
// notification, no error.
// ---------------------------------------------------------------------------
const swSrc = read('sw.js');
if (!swSrc) {
  fail.push('sw.js is missing');
} else {
  const s = decomment(swSrc);
  if (!/addEventListener\(\s*['"]push['"]/.test(s)) fail.push("sw.js has no 'push' listener — a delivered push would be dropped silently");
  if (!/addEventListener\(\s*['"]notificationclick['"]/.test(s)) fail.push("sw.js has no 'notificationclick' listener — tapping a notification would do nothing");
}

// ---------------------------------------------------------------------------
// 5. The VAPID key is a real P-256 point.
//
// Checked because a malformed key fails at pushManager.subscribe() on every
// real device and is invisible to every other gate — and, in a headless
// browser, produces the SAME "Registration failed" message as simply having
// no push service, so it cannot be told apart by driving the page here.
// ---------------------------------------------------------------------------
if (pushSrc) {
  const k = /VAPID_PUBLIC_KEY\s*=\s*['"]([A-Za-z0-9_-]+)['"]/.exec(decomment(pushSrc));
  if (!k) {
    fail.push('mc-push.js has no VAPID_PUBLIC_KEY literal');
  } else {
    const b64 = k[1] + '='.repeat((4 - k[1].length % 4) % 4);
    const raw = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (raw.length !== 65) fail.push('VAPID public key decodes to ' + raw.length + ' bytes, expected 65');
    else if (raw[0] !== 4) fail.push('VAPID public key starts 0x' + raw[0].toString(16) + ', expected 0x04 (uncompressed point)');
    else note.push('VAPID key 65 bytes, 0x04');
  }
}

// ---------------------------------------------------------------------------
if (fail.length) {
  console.error('::error::The push notification chain is broken. Every link is behind an');
  console.error('optional guard, so this fails silently at runtime — no console error.');
  fail.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('check-push-chain: OK — module, ' + callers + ' caller(s), DB writer, SW listeners, ' + note.join('; '));
