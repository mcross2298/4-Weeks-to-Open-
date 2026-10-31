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
     mine()           this account's sent reports with status (FB4) -> Promise<rows|null>
     renderList(el)   paint "Your reports" (queued + sent, with status) into el
     checkFixed()     show the one-time "Fixed" note for newly fixed reports
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
  // mc_active_prog holds the whole program CARD (dashboard.html's loadState),
  // not an id; the first field test sent 40 characters of that JSON. Only the
  // id is sent, and only id-shaped text, because a custom program's other
  // fields are the athlete's own words and this field reaches a public issue.
  function program() {
    var raw = null;
    try { raw = localStorage.getItem('mc_active_prog'); } catch (e) { return ''; }
    if (!raw) return '';
    var id = raw;
    try { var v = JSON.parse(raw); id = (v && typeof v === 'object') ? v.id : v; } catch (e) {}
    id = String(id == null ? '' : id);
    return /^[A-Za-z0-9_-]{1,40}$/.test(id) ? id : '';
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
  // The app's own precache only: sw.js also keeps mc-training-carry-v1 (the
  // previous deploy) and mc-training-fonts-v1, which name no build.
  function isAppCache(k) { return /^mc-training/.test(k) && !/carry|fonts/.test(k); }
  var cachedBuild = '';
  function readBuild() {
    try {
      if (window.caches && caches.keys) return caches.keys().then(function (keys) {
        var app = keys.filter(isAppCache);
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
      // FB4: the one-time "Fixed" note (above the bottom nav) and the status list
      '.mcr-fixed{position:fixed;left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:10040;max-width:520px;margin:0 auto;' +
        'display:flex;gap:8px;align-items:flex-start;padding:12px 8px 12px 14px;border-radius:14px;' +
        'background:var(--card-bg,#121110);color:var(--text,#ede7d9);border:1px solid rgba(52,211,153,0.55);box-shadow:0 8px 24px rgba(0,0,0,0.35);}' +
      '.mcr-fixed-txt{flex:1;font-size:14px;line-height:1.45;}' +
      '.mcr-fixed-txt b{display:block;color:#34d399;font-size:15px;margin-bottom:2px;}' +
      '.mcr-fixed-x{flex-shrink:0;width:48px;height:48px;border:none;background:transparent;color:var(--text,#ede7d9);font-size:24px;cursor:pointer;border-radius:12px;}' +
      '.mcr-fixed-x:focus-visible{outline:2px solid var(--accent,#d4af37);}' +
      '.mcr-li{border:1px solid var(--hairline,rgba(255,255,255,0.1));border-radius:10px;padding:10px 12px;margin-top:8px;font-size:13px;}' +
      '.mcr-li-head{display:flex;gap:8px;justify-content:space-between;color:var(--muted,#a8a196);}' +
      '.mcr-li-status{font-weight:800;color:var(--text,#ede7d9);}' +
      '.mcr-li-status.is-fixed{color:#34d399;}' +
      '.mcr-li-msg{margin-top:4px;color:var(--text,#ede7d9);word-break:break-word;}' +
      '.mcr-list-empty{font-size:13px;color:var(--muted,#a8a196);margin-top:8px;}' +
      'html[data-theme="light"] .mcr-fixed-txt b,html[data-theme="light"] .mcr-li-status.is-fixed{color:#15803d;}' +
      'html[data-theme="light"] .mcr-fixed{border-color:rgba(21,128,61,0.5);}' +
      'html[data-theme="light"] .mcr-text{background:rgba(0,0,0,0.04);}' +
      'html[data-theme="light"] .mcr-msg.ok{color:#15803d;}' +
      // QA cycle 2 (check B): the dark ink on the light theme's darker accent
      // measured 3.52:1; white on it is about 6:1.
      'html[data-theme="light"] .mcr-send{color:#fff;}';
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

  // ---- FB4: what happened to my reports ---------------------------------------
  // client_reports.status is moved by the field-reports Edge Function when the
  // report's GitHub issue is filed, closed or reopened. The athlete reads only
  // their own rows (phase 15's read-own policy).
  var SEEN = 'mc_reports_seen_v1';   // ids whose "Fixed" note was already shown
  var STATUS = {
    'new': 'Sent', filed: 'Being looked at', fixing: 'Being fixed', needs_decision: 'Being looked at',
    fixed: 'Fixed', wontfix: 'Won’t fix', duplicate: 'Already reported'
  };
  function statusLabel(s) { return STATUS[s] || 'Sent'; }

  function mine() {
    var SB = window.MC_SB;
    if (!SB || !SB.configured || !SB.currentUser) return Promise.resolve(null);
    if ('onLine' in navigator && !navigator.onLine) return Promise.resolve(null);
    return SB.currentUser().then(function (u) {
      if (!u || !SB.client) return null;
      return SB.client.from('client_reports')
        .select('id, created_at, category, severity, message, status, resolved_at')
        .order('created_at', { ascending: false })
        .limit(20)
        .then(function (r) { return r && !r.error && Array.isArray(r.data) ? r.data : null; });
    }).catch(function () { return null; });
  }

  // Fixed reports this device has not announced yet, oldest fix first.
  function newlyFixed(rows, seen) {
    var had = {};
    (Array.isArray(seen) ? seen : []).forEach(function (id) { had[id] = 1; });
    return (Array.isArray(rows) ? rows : []).filter(function (r) {
      return r && r.status === 'fixed' && r.id != null && !had[r.id];
    }).sort(function (a, b) { return String(a.resolved_at || '').localeCompare(String(b.resolved_at || '')); });
  }
  function markSeen(ids) {
    var seen = read(SEEN, []);
    if (!Array.isArray(seen)) seen = [];
    ids.forEach(function (id) { if (seen.indexOf(id) < 0) seen.push(id); });
    try { localStorage.setItem(SEEN, JSON.stringify(seen.slice(-100))); } catch (e) {}
  }
  function snippet(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function day(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }

  // The one-time note. Built here (no shared toast exists — see CLAUDE.md's
  // MC_TOAST record) and dismissed by the athlete, not by a timer, because a
  // fix to something they reported is worth reading.
  function showFixedNote(list) {
    if (!list.length || document.getElementById('mcrFixed')) return false;
    injectStyle();
    var first = list[0];
    var el = document.createElement('div');
    el.id = 'mcrFixed';
    el.className = 'mcr-fixed';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<div class="mcr-fixed-txt"><b>Fixed' + (list.length > 1 ? ' — ' + list.length + ' of your reports' : '') + '</b>' +
        '<span>Your report from ' + esc(day(first.created_at)) +
        (first.message ? ' (“' + esc(snippet(first.message, 60)) + '”)' : '') +
        (list.length > 1 ? ' and ' + (list.length - 1) + ' more' : '') +
        '. The fix arrives with the next app update. Thank you for reporting it.</span></div>' +
      '<button type="button" class="mcr-fixed-x" aria-label="Dismiss">×</button>';
    el.querySelector('.mcr-fixed-x').addEventListener('click', function () { el.remove(); });
    document.body.appendChild(el);
    markSeen(list.map(function (r) { return r.id; }));
    return true;
  }
  function checkFixed() {
    return mine().then(function (rows) {
      if (!rows) return 0;
      var list = newlyFixed(rows, read(SEEN, []));
      showFixedNote(list);
      return list.length;
    });
  }

  // For the account sheet's Diagnostics: queued reports first, then the
  // athlete's own sent reports with their status.
  function listHtml(rows) {
    var q = queued();
    var items = q.map(function (r) {
      return { when: r.created_at, msg: r.message, status: 'Waiting to send' };
    }).concat((rows || []).map(function (r) {
      return { when: r.created_at, msg: r.message, status: statusLabel(r.status), fixed: r.status === 'fixed' };
    }));
    if (!items.length) return '<div class="mcr-list-empty">No reports from this account yet.</div>';
    return items.map(function (it) {
      return '<div class="mcr-li"><div class="mcr-li-head"><span class="mcr-li-status' + (it.fixed ? ' is-fixed' : '') + '">' +
        esc(it.status) + '</span><span>' + esc(day(it.when)) + '</span></div>' +
        '<div class="mcr-li-msg">' + esc(snippet(it.msg, 120)) + '</div></div>';
    }).join('');
  }
  function renderList(container) {
    if (!container) return;
    injectStyle();
    container.innerHTML = '<div class="mcr-list-empty">Loading your reports…</div>';
    mine().then(function (rows) {
      container.innerHTML = listHtml(rows) +
        (rows ? '' : '<div class="mcr-list-empty">Sign in and go online to see what happened to sent reports.</div>');
    });
  }

  window.MC_REPORT = {
    open: open, flush: flush, queued: queued, mine: mine, checkFixed: checkFixed, renderList: renderList,
    _buildRow: buildRow, _program: program, _isAppCache: isAppCache, _fingerprint: fingerprint, _workoutPage: workoutPage,
    _newlyFixed: newlyFixed, _statusLabel: statusLabel, _listHtml: listHtml, _showFixedNote: showFixedNote
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = window.MC_REPORT;

  // Send anything a basement or a signed-out session left behind, then — on
  // Home only, which every athlete returns to — say if something they
  // reported was fixed.
  function later() {
    setTimeout(function () {
      flush().then(function () {
        if (/(^|\/)(dashboard\.html)?$/.test(location.pathname)) checkFixed();
      });
    }, 5000);
  }
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later);
  window.addEventListener('online', function () { flush(); });
})();
