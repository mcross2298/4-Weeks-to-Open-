/* ==========================================================================
   mc-cond.js — conditioning results, personal bests, page decoration (4.3)
   --------------------------------------------------------------------------
   Store: localStorage 'mc_cond_log_v1' — append-only
     [{id:'<routineId>|<iso>', routineId, date, timeSec}]
   (synced across devices via mc-sync.js 'arrayById').

   Three jobs:
     • window.MCCond — log(routineId, timeSec) / best(routineId) / all(id)
     • decorate(): appends a "PB 41:32" pill to any <a> whose href points at
       a conditioning routine (dashboard cards, cat-faint cards) — re-runs on
       DOM changes since the dashboard renders its cards late
     • on a challenge page itself (filename matches a routine href): injects
       an action bar with "▶ Guided timer" (when a protocol exists) and
       "🏁 Log result" (manual mm:ss entry), plus the current PB
   Requires conditioning-data.js when decoration / the action bar should run;
   the MCCond API itself works standalone.
   ========================================================================== */
(function () {
  if (window.MCCond) return;

  var KEY = 'mc_cond_log_v1';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function fmt(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function all(routineId) {
    return read().filter(function (e) { return e.routineId === routineId; });
  }
  function best(routineId) {
    var b = null;
    all(routineId).forEach(function (e) {
      if (e.timeSec > 0 && (!b || e.timeSec < b.timeSec)) b = e;
    });
    return b;
  }
  function log(routineId, timeSec) {
    if (!routineId || !(timeSec > 0)) return null;
    var iso = new Date().toISOString();
    var entry = { id: routineId + '|' + iso, routineId: routineId, date: iso, timeSec: Math.round(timeSec) };
    var a = read();
    a.unshift(entry);
    write(a.slice(0, 500));
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
    return entry;
  }

  window.MCCond = { log: log, best: best, all: all, fmt: fmt };

  // ---- routines lookup ------------------------------------------------------
  function routines() {
    var out = [];
    if (typeof CONDITIONING === 'undefined') return out;
    CONDITIONING.subcategories.forEach(function (sub) {
      (sub.routines || []).forEach(function (r) { if (r.id) out.push(r); });
    });
    return out;
  }
  function byHref(href) {
    var base = (href || '').split('?')[0].split('/').pop();
    return routines().filter(function (r) { return r.href === base; })[0] || null;
  }

  // ---- PB pills on routine links ---------------------------------------------
  function decorate() {
    routines().forEach(function (r) {
      var b = best(r.id);
      if (!b) return;
      document.querySelectorAll('a[href="' + r.href + '"]').forEach(function (a) {
        if (a.querySelector('.mcc-pb')) return;
        var pill = document.createElement('span');
        pill.className = 'mcc-pb';
        pill.textContent = '🏆 PB ' + fmt(b.timeSec);
        a.appendChild(pill);
      });
    });
  }

  // ---- action bar on the challenge page itself --------------------------------
  function injectBar() {
    var page = (location.pathname.split('/').pop() || '');
    var r = byHref(page);
    if (!r) return;

    var bar = document.createElement('div');
    bar.className = 'mcc-bar';
    var b = best(r.id);
    bar.innerHTML =
      (r.protocol ? '<a class="mcc-btn mcc-go" href="conditioning-timer.html?id=' + r.id + '">▶ Guided timer</a>' : '') +
      '<button class="mcc-btn mcc-log" type="button">🏁 Log result</button>' +
      '<span class="mcc-best">' + (b ? '🏆 PB ' + fmt(b.timeSec) : 'No result yet') + '</span>';
    document.body.appendChild(bar);
    document.body.classList.add('mcc-has-bar');

    // some challenge pages ship their own fixed Finish bar — sit above it
    function liftAboveFw() {
      if (document.querySelector('.fw-bar')) bar.classList.add('mcc-raised');
    }
    liftAboveFw();
    [400, 1200, 2500].forEach(function (d) { setTimeout(liftAboveFw, d); });

    bar.querySelector('.mcc-log').addEventListener('click', function () {
      var v = prompt('Finish time for "' + r.name + '" (mm:ss):', '');
      if (!v) return;
      var m = v.trim().match(/^(\d+):([0-5]?\d)$/);
      var secs = m ? (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) : parseInt(v, 10) * 60;
      if (!(secs > 0)) { alert('Use mm:ss — e.g. 41:32'); return; }
      var prev = best(r.id);
      log(r.id, secs);
      alert(prev && secs < prev.timeSec
        ? '🏆 NEW PERSONAL BEST — previous: ' + fmt(prev.timeSec)
        : '🏁 Logged ' + fmt(secs) + (prev ? ' · PB stays ' + fmt(prev.timeSec) : ' — first one in the books.'));
      var el = bar.querySelector('.mcc-best');
      var nb = best(r.id);
      if (el && nb) el.textContent = '🏆 PB ' + fmt(nb.timeSec);
    });
  }

  function injectCSS() {
    if (document.getElementById('mccCss')) return;
    var st = document.createElement('style');
    st.id = 'mccCss';
    st.textContent =
      '.mcc-pb{display:inline-block;margin-top:8px;font-size:11px;font-weight:900;color:#fbbf24;' +
        'background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);border-radius:6px;' +
        'padding:2px 8px;letter-spacing:0.04em;}' +
      '.mcc-bar{position:fixed;bottom:0;left:0;right:0;z-index:60;display:flex;gap:8px;align-items:center;' +
        'padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:rgba(10,10,10,0.96);' +
        '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid rgba(255,255,255,0.08);}' +
      'body.mcc-has-bar{padding-bottom:86px;}' +
      'body.mcc-has-bar .mc-nav{display:none;}' +
      '.mcc-bar.mcc-raised{bottom:74px;border-radius:14px 14px 0 0;}' +
      '.mcc-btn{flex-shrink:0;padding:11px 14px;border-radius:11px;font-size:13px;font-weight:900;' +
        'text-decoration:none;border:none;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
      '.mcc-go{background:#E24B4A;color:#fff;box-shadow:0 2px 14px rgba(226,75,74,0.4);}' +
      '.mcc-log{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);color:#e2e8f0;}' +
      '.mcc-best{margin-left:auto;font-size:12px;font-weight:800;color:#fbbf24;white-space:nowrap;}';
    document.head.appendChild(st);
  }

  function init() {
    injectCSS();
    decorate();
    injectBar();
    // dashboard renders conditioning cards late + re-renders on tab switches
    var mo = new MutationObserver(function () {
      clearTimeout(init._t);
      init._t = setTimeout(decorate, 150);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
