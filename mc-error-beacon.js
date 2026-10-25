/* ==========================================================================
   mc-error-beacon.js — field errors leave the device (flagship readiness E)
   --------------------------------------------------------------------------
   D-35: every page's head-boot script (tools/apply-head-contract.py) keeps the
   last 20 window 'error' / 'unhandledrejection' events in localStorage
   mc_errors_v1, and nothing ever read them off the phone. A crash an athlete
   hit at the gym was invisible to everyone but them.

   Owner's decision: a Supabase table, signed-in athletes only
   (supabase/phase14-client-errors.sql). This module runs on Home, which every
   athlete returns to, and sends whatever is new:

     * at most once every 10 minutes, and only when someone is signed in;
     * each entry once: what was sent is remembered in mc_errors_sent_v1 by
       time + message, and the table ignores a duplicate anyway
       (unique user_id, fingerprint, occurred_at);
     * trimmed to the table's limits, the source reduced to its file name
       (no origin, no query string) so nothing beyond the error itself
       leaves the phone;
     * silently: a failed send (offline, or the table not created yet) is
       retried on a later visit and never surfaces to the athlete.

   Phase S5 (owner decision 2026-10-25): sending is OPT-IN and off by
   default — mc_prefs_v1.telemetry, the "Send error reports" switch in the
   account sheet. Off, nothing is sent and nothing is marked sent, so turning
   it on later sends what is still in the buffer. The stack (x, ≤1200 chars)
   and the storage / network kinds ride along.

   Exposed as window.MC_ERROR_BEACON = { flush() } for tests.
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_ERROR_BEACON) return;

  var LOG_KEY = 'mc_errors_v1';
  var SENT_KEY = 'mc_errors_sent_v1';   // { at: ms, keys: ['t|m', ...] }
  var EVERY_MS = 10 * 60 * 1000;
  var KEEP_KEYS = 60;

  function read(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function entryKey(e) { return String(e.t) + '|' + String(e.m || '').slice(0, 80); }
  // djb2, hex: groups the same error across devices and times
  function fingerprint(e) {
    var s = (e.k || '') + '|' + (e.m || '') + '|' + fileOf(e.s) + '|' + (e.l || 0), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function fileOf(src) {
    src = String(src || '');
    return src.split('?')[0].split('#')[0].split('/').pop().slice(0, 300);
  }
  function platform() {
    var ua = navigator.userAgent || '';
    var os = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'windows' : 'other';
    var standalone = navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return os + (standalone ? '-pwa' : '-web');
  }

  function pending() {
    var log = read(LOG_KEY, []);
    if (!Array.isArray(log)) return [];
    var sent = read(SENT_KEY, {});
    var seen = {};
    (Array.isArray(sent.keys) ? sent.keys : []).forEach(function (k) { seen[k] = 1; });
    return log.filter(function (e) {
      return e && typeof e === 'object' && typeof e.t === 'number' && !seen[entryKey(e)];
    });
  }

  var KINDS = { error: 1, unhandledrejection: 1, storage: 1, network: 1, note: 1 };
  function optedIn() {
    var p = read('mc_prefs_v1', {});
    return !!(p && typeof p === 'object' && p.telemetry === true);
  }
  function toRow(e) {
    return {
      occurred_at: new Date(e.t).toISOString(),
      kind: KINDS[e.k] ? e.k : 'error',
      stack: e.x ? String(e.x).slice(0, 1200) : null,
      message: String(e.m || 'Unknown error').slice(0, 500),
      source: fileOf(e.s) || null,
      line: typeof e.l === 'number' ? e.l : null,
      page: String(e.p || '').slice(0, 120) || null,
      platform: platform(),
      fingerprint: fingerprint(e)
    };
  }

  function markSent(entries) {
    var sent = read(SENT_KEY, {});
    var keys = (Array.isArray(sent.keys) ? sent.keys : []).concat(entries.map(entryKey));
    try { localStorage.setItem(SENT_KEY, JSON.stringify({ at: Date.now(), keys: keys.slice(-KEEP_KEYS) })); } catch (e) {}
  }
  function markTried() {
    var sent = read(SENT_KEY, {});
    sent.at = Date.now();
    try { localStorage.setItem(SENT_KEY, JSON.stringify(sent)); } catch (e) {}
  }

  // force: skip the 10-minute spacing (tests, or a manual call)
  function flush(force) {
    var SB = window.MC_SB;
    if (!optedIn()) return Promise.resolve('opted-out');
    if (!SB || !SB.configured || !SB.currentUser) return Promise.resolve('no-backend');
    var sent = read(SENT_KEY, {});
    if (!force && typeof sent.at === 'number' && Date.now() - sent.at < EVERY_MS) return Promise.resolve('throttled');
    var todo = pending();
    if (!todo.length) return Promise.resolve('nothing');
    return SB.currentUser().then(function (u) {
      if (!u) return 'signed-out';
      var c = SB.client;
      if (!c) return 'no-client';
      markTried();
      return c.from('client_errors')
        .upsert(todo.map(toRow), { onConflict: 'user_id,fingerprint,occurred_at', ignoreDuplicates: true })
        .then(function (r) {
          if (r && r.error) return 'failed';
          markSent(todo);
          return 'sent ' + todo.length;
        });
    }).catch(function () { return 'failed'; });
  }

  window.MC_ERROR_BEACON = { flush: flush, optedIn: optedIn, _pending: pending, _toRow: toRow };

  // A few seconds after Home settles, off the critical path.
  function later() { setTimeout(function () { flush(false); }, 4000); }
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later);
})();
