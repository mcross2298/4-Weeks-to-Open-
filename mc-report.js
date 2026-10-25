/* ==========================================================================
   mc-report.js — "Report a problem" (field-feedback-roadmap.md FB1)
   --------------------------------------------------------------------------
   client_errors (phase 14) holds what the app caught by itself. This is the
   other half: what a PERSON noticed. An athlete or the owner picks what kind
   of problem it is, how much it got in the way, and says what happened.

   What rides along, automatically and listed on the sheet so nothing is a
   surprise: the page, the workout page they came from, the active program,
   the cached build, the platform, and the fingerprints (not the messages) of
   the last three errors this phone logged. Never workouts, sets or macros.

   Sending: it is an explicit act, so it does NOT wait for the "Send error
   reports" switch. The report goes into a device outbox first
   (mc_reports_outbox_v1) and is sent from there, so a report written in a
   basement, or signed out, is not lost: it goes the next time this module
   loads with a connection and a signed-in account (Home loads it).
   supabase/phase15-client-reports.sql ignores a duplicate (user, client_id),
   so a resend is harmless.

   The athlete's words stay in Supabase. GitHub issues (FB2) carry only the
   category, severity, page, build and a report number, because the
   repository is public.

   window.MC_REPORT:
     open({ from })   show the sheet; `from` names the page the problem was on
     flush()          send whatever is queued -> Promise<'sent N'|reason>
     queued()         the outbox, for Diagnostics and tests
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_REPORT) return;

  var OUTBOX = 'mc_reports_outbox_v1';
  var MAX_QUEUED = 20;
  var MAX_MSG = 2000;

  var CATEGORIES = [
    { v: 'bug', label: 'Something broke' },
    { v: 'friction', label: 'Hard to use' },
    { v: 'idea', label: 'Idea' }
  ];
  var SEVERITIES = [
    { v: 'blocker', label: 'Stopped me' },
    { v: 'annoying', label: 'Slowed me down' },
    { v: 'minor', label: 'Minor' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function read(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function queued() {
    var q = read(OUTBOX, []);
    return Array.isArray(q) ? q.filter(function (r) { return r && typeof r === 'object' && r.client_id; }) : [];
  }
  function writeQueue(q) {
    try { localStorage.setItem(OUTBOX, JSON.stringify(q.slice(-MAX_QUEUED))); return true; }
    catch (e) { return false; }
  }

  // ---- context ---------------------------------------------------------------
  function fileOf(src) {
    return String(src || '').split('?')[0].split('#')[0].split('/').pop();
  }
  function pageNow() { return fileOf(location.pathname) || 'index.html'; }
  // The workout page the problem was on: an explicit `from`, else the page that
  // linked here (same origin only), else the most recent live session.
  function workoutPage(from) {
    if (from) return fileOf(from);
    try {
      if (document.referrer) {
        var r = new URL(document.referrer);
        if (r.origin === location.origin && fileOf(r.pathname) !== pageNow()) return fileOf(r.pathname);
      }
    } catch (e) {}
    var sess = read('mc_session_v1', {}), best = null, bestTs = 0;
    if (sess && typeof sess === 'object') Object.keys(sess).forEach(function (k) {
      var ts = sess[k] && sess[k].lastTs;
      if (typeof ts === 'number' && ts > bestTs && Date.now() - ts < 12 * 3600 * 1000) { best = k; bestTs = ts; }
    });
    return best ? best + '.html' : '';
  }
  function program() {
    try { var p = localStorage.getItem('mc_active_prog'); return p ? String(p).replace(/^"|"$/g, '').slice(0, 40) : ''; }
    catch (e) { return ''; }
  }
  // Same rule as mc-error-beacon.js's platform(); kept here because this module
  // also runs on pages that do not load the beacon.
  function platform() {
    var ua = navigator.userAgent || '';
    var os = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : /Mac/.test(ua) ? 'mac' : /Win/.test(ua) ? 'windows' : 'other';
    var standalone = navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return os + (standalone ? '-pwa' : '-web');
  }
  // Same djb2 as mc-error-beacon.js's fingerprint(), so a report's error_fps
  // match client_errors.fingerprint row for row. tools/test-mc-report.js holds
  // the two to the same output.
  function fingerprint(e) {
    var s = (e.k || '') + '|' + (e.m || '') + '|' + fileOf(e.s).slice(0, 300) + '|' + (e.l || 0), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function recentErrorFps() {
    var log = read('mc_errors_v1', []);
    if (!Array.isArray(log)) return [];
    var out = [];
    for (var i = 0; i < log.length && out.length < 3; i++) {
      var e = log[i];
      if (!e || typeof e !== 'object' || e.k === 'note') continue;
      var fp = fingerprint(e);
      if (out.indexOf(fp) < 0) out.push(fp);
    }
    return out;
  }
  var cachedBuild = '';
  function readBuild() {
    try {
      if (window.caches && caches.keys) return caches.keys().then(function (keys) {
        var app = keys.filter(function (k) { return /^mc-training/.test(k) && !/carry/.test(k); });
        cachedBuild = app.join(',').slice(0, 80);
        return cachedBuild;
      }).catch(function () { return ''; });
    } catch (e) {}
    return Promise.resolve('');
  }
  function clientId() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function buildRow(input) {
    var cat = CATEGORIES.some(function (c) { return c.v === input.category; }) ? input.category : 'bug';
    var sev = SEVERITIES.some(function (s) { return s.v === input.severity; }) ? input.severity : 'annoying';
    return {
      client_id: clientId(),
      created_at: new Date().toISOString(),
      category: cat,
      severity: sev,
      message: String(input.message || '').trim().slice(0, MAX_MSG),
      page: pageNow().slice(0, 120),
      workout_page: (workoutPage(input.from) || '').slice(0, 120) || null,
      program: program() || null,
      build: cachedBuild || null,
      platform: platform(),
      error_fps: recentErrorFps()
    };
  }

  // ---- send ------------------------------------------------------------------
  var flushing = null;
  function flush() {
    if (flushing) return flushing;
    var todo = queued();
    if (!todo.length) return Promise.resolve('nothing');
    if ('onLine' in navigator && !navigator.onLine) return Promise.resolve('offline');
    var SB = window.MC_SB;
    if (!SB || !SB.configured || !SB.currentUser) return Promise.resolve('no-backend');
    flushing = SB.currentUser().then(function (u) {
      if (!u) return 'signed-out';
      var c = SB.client;
      if (!c) return 'no-client';
      return c.from('client_reports')
        .upsert(todo, { onConflict: 'user_id,client_id', ignoreDuplicates: true })
        .then(function (r) {
          if (r && r.error) {
            try { if (window.MC_ERRLOG) MC_ERRLOG.rec('network', 'Report send failed: ' + String(r.error.message || r.error).slice(0, 200)); } catch (e) {}
            return 'failed';
          }
          var sent = {};
          todo.forEach(function (t) { sent[t.client_id] = 1; });
          writeQueue(queued().filter(function (t) { return !sent[t.client_id]; }));
          return 'sent ' + todo.length;
        });
    }).catch(function () { return 'failed'; }).then(function (r) { flushing = null; return r; });
    return flushing;
  }

  // ---- the sheet -------------------------------------------------------------
  var STYLE_ID = 'mcr-style';
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent =
      '.mcr-overlay{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.78);display:flex;align-items:flex-end;justify-content:center;}' +
      '.mcr-sheet{width:100%;max-width:520px;max-height:calc(100dvh - 24px);overflow-y:auto;overscroll-behavior:contain;' +
        'background:var(--card-bg,#121110);color:var(--text,#ede7d9);border:1px solid var(--hairline,rgba(255,255,255,0.12));' +
        'border-bottom:none;border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom));font-family:var(--font-ui,inherit);}' +
      '.mcr-title{font-size:19px;font-weight:900;margin:0 0 4px;}' +
      '.mcr-sub{font-size:13px;color:var(--muted,#a8a196);line-height:1.5;margin:0 0 16px;}' +
      '.mcr-label{font-size:13px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted,#a8a196);margin:16px 0 8px;}' +
      '.mcr-chips{display:flex;flex-wrap:wrap;gap:8px;}' +
      '.mcr-chip{flex:1 1 30%;min-height:48px;padding:8px 10px;border-radius:12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;' +
        'background:transparent;color:var(--text,#ede7d9);border:1px solid var(--hairline,rgba(255,255,255,0.16));}' +
      '.mcr-chip[aria-checked="true"]{background:rgba(212,175,55,0.16);border-color:var(--accent,#d4af37);}' +
      '.mcr-chip:focus-visible,.mcr-btn:focus-visible,.mcr-text:focus-visible{outline:2px solid var(--accent,#d4af37);outline-offset:2px;}' +
      '.mcr-text{width:100%;box-sizing:border-box;min-height:120px;resize:vertical;padding:12px;border-radius:12px;font:inherit;font-size:16px;line-height:1.45;' +
        'background:rgba(255,255,255,0.05);color:var(--text,#ede7d9);border:1px solid var(--hairline,rgba(255,255,255,0.16));}' +
      '.mcr-count{font-size:13px;color:var(--muted,#a8a196);text-align:right;margin-top:4px;}' +
      '.mcr-attach{font-size:13px;color:var(--muted,#a8a196);line-height:1.55;margin:14px 0 0;}' +
      '.mcr-attach b{color:var(--text,#ede7d9);font-weight:700;}' +
      '.mcr-row{display:flex;gap:8px;margin-top:18px;}' +
      '.mcr-btn{flex:1;min-height:52px;border-radius:12px;font:inherit;font-size:15px;font-weight:800;cursor:pointer;border:1px solid var(--hairline,rgba(255,255,255,0.16));}' +
      '.mcr-cancel{background:transparent;color:var(--text,#ede7d9);}' +
      '.mcr-send{background:var(--accent,#d4af37);color:#1a1200;border-color:transparent;}' +
      '.mcr-send:disabled{opacity:0.5;cursor:default;}' +
      '.mcr-msg{font-size:14px;min-height:20px;margin-top:12px;text-align:center;color:var(--muted,#a8a196);}' +
      '.mcr-msg.ok{color:#86efac;}' +
      'html[data-theme="light"] .mcr-text{background:rgba(0,0,0,0.04);}' +
      'html[data-theme="light"] .mcr-msg.ok{color:#15803d;}';
    document.head.appendChild(st);
  }

  function chipsHtml(name, opts, value) {
    return '<div class="mcr-chips" role="radiogroup" aria-label="' + esc(name) + '">' +
      opts.map(function (o) {
        return '<button type="button" class="mcr-chip" role="radio" data-v="' + esc(o.v) + '" aria-checked="' + (o.v === value) + '">' + esc(o.label) + '</button>';
      }).join('') + '</div>';
  }

  var openEl = null;
  function close() {
    if (!openEl) return;
    var el = openEl; openEl = null;
    try { el.remove(); } catch (e) {}
  }

  function open(opts) {
    opts = opts || {};
    if (openEl) return;
    injectStyle();
    readBuild();
    var state = { category: opts.category || 'bug', severity: 'annoying' };
    var wp = workoutPage(opts.from);
    var prog = program();
    var fps = recentErrorFps();
    var ov = document.createElement('div');
    ov.className = 'mcr-overlay';
    ov.setAttribute('data-mc-sheet', '');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'mcrTitle');
    ov.innerHTML =
      '<div class="mcr-sheet">' +
        '<h2 class="mcr-title" id="mcrTitle">Report a problem</h2>' +
        '<p class="mcr-sub">Tell us what happened. Every report is read, and you’ll see here when it’s fixed.</p>' +
        '<div class="mcr-label" id="mcrCatL">What kind</div>' + chipsHtml('What kind', CATEGORIES, state.category) +
        '<div class="mcr-label" id="mcrSevL">How much did it get in the way</div>' + chipsHtml('How much did it get in the way', SEVERITIES, state.severity) +
        '<div class="mcr-label"><label for="mcrText">What happened</label></div>' +
        '<textarea class="mcr-text" id="mcrText" maxlength="' + MAX_MSG + '" ' +
          'placeholder="e.g. On the rest timer, the beep didn’t play with my phone on silent."></textarea>' +
        '<div class="mcr-count" id="mcrCount" aria-live="polite">0 / ' + MAX_MSG + '</div>' +
        '<p class="mcr-attach">Sent with it: <b>' + esc(pageNow()) + '</b>' +
          (wp ? ', the workout page <b>' + esc(wp) + '</b>' : '') +
          (prog ? ', your program (<b>' + esc(prog) + '</b>)' : '') +
          ', the app version and your phone type' +
          (fps.length ? ', and a code for the last ' + fps.length + ' error' + (fps.length > 1 ? 's' : '') + ' this phone logged' : '') +
          '. Never your workouts, sets or macros.</p>' +
        '<div class="mcr-row"><button type="button" class="mcr-btn mcr-cancel" data-mc-sheet-cancel>Cancel</button>' +
          '<button type="button" class="mcr-btn mcr-send" id="mcrSend" disabled>Send report</button></div>' +
        '<div class="mcr-msg" id="mcrMsg" role="status"></div>' +
      '</div>';
    document.body.appendChild(ov);
    openEl = ov;
    var text = ov.querySelector('#mcrText');
    var send = ov.querySelector('#mcrSend');
    var msg = ov.querySelector('#mcrMsg');
    var count = ov.querySelector('#mcrCount');
    var sent = false;

    ov.addEventListener('click', function (e) {
      if (e.target === ov || e.target.closest('[data-mc-sheet-cancel]')) { close(); return; }
      var chip = e.target.closest('.mcr-chip');
      if (chip) {
        var group = chip.parentNode;
        group.querySelectorAll('.mcr-chip').forEach(function (c) { c.setAttribute('aria-checked', String(c === chip)); });
        if (group === ov.querySelectorAll('.mcr-chips')[0]) state.category = chip.getAttribute('data-v');
        else state.severity = chip.getAttribute('data-v');
      }
    });
    text.addEventListener('input', function () {
      count.textContent = text.value.length + ' / ' + MAX_MSG;
      send.disabled = sent || !text.value.trim();
    });
    send.addEventListener('click', function () {
      if (sent || !text.value.trim()) return;
      sent = true;
      send.disabled = true;
      var row = buildRow({ category: state.category, severity: state.severity, message: text.value, from: opts.from });
      var q = queued(); q.push(row);
      if (!writeQueue(q)) { sent = false; send.disabled = false; msg.className = 'mcr-msg'; msg.textContent = 'This phone’s storage is full, so the report could not be saved.'; return; }
      msg.className = 'mcr-msg'; msg.textContent = 'Sending…';
      flush().then(function (r) {
        msg.className = 'mcr-msg ok';
        msg.textContent = /^sent/.test(r)
          ? 'Sent — thank you.'
          : (r === 'signed-out' || r === 'no-backend'
            ? 'Saved on this phone. It sends once you’re signed in and open Home.'
            : 'Saved on this phone. It sends next time you’re online.');
        var cancel = ov.querySelector('.mcr-cancel');
        if (cancel) { cancel.textContent = 'Done'; try { cancel.focus({ preventScroll: true }); } catch (e) {} }
        send.hidden = true;
      });
    });
    try { if (window.MC_SHEET && MC_SHEET.check) MC_SHEET.check(); } catch (e) {}
    setTimeout(function () { try { text.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }

  window.MC_REPORT = {
    open: open, flush: flush, queued: queued,
    _buildRow: buildRow, _fingerprint: fingerprint, _workoutPage: workoutPage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.MC_REPORT;

  // Send anything a basement or a signed-out session left behind.
  function later() { setTimeout(function () { flush(); }, 5000); }
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later);
  window.addEventListener('online', function () { flush(); });
})();
