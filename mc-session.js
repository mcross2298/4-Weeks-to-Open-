/* ==========================================================================
   mc-session.js — smart mid-workout resume (Phase 1.4)
   --------------------------------------------------------------------------
   Persists the live session state of a workout page so a reload — including
   the forced reload the service worker performs on every deploy — restores
   exactly where the lifter was:

     • checked-off exercise cards (.ex-card/.ss-ex/.ex-item .checked)
     • checked-off logger set rows (mc-setlog.js .mcl-ck.done)
     • a still-running rest timer (re-armed from its wall-clock end time)
     • the session start time (window.MCSession.startedTs — mc-summary.js
       seeds its elapsed clock from this so duration survives reloads)

   Storage: localStorage 'mc_session_v1' = { <pid>: {startedTs, lastTs,
   cards:[ids], sets:[rowIds], timer:{endTs,rest,label}} }. Sessions older
   than 12h are pruned. Synced across devices via mc-sync.js is intentionally
   NOT done for this store — a live session is device-local by nature; the
   cross-device "resume on your other phone" path stays mc_activity/mc-resume.
   ========================================================================== */
(function () {
  if (window.__mcSession) return;
  window.__mcSession = true;

  var KEY = 'mc_session_v1';
  var MAX_AGE = 12 * 3600 * 1000;
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html', '') || 'page');
  var CARD_SEL = '.ex-card, .ss-ex, .ex-item';

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAll(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function prune(s) {
    var now = Date.now();
    Object.keys(s).forEach(function (k) {
      if (!s[k] || (now - (s[k].lastTs || 0)) > MAX_AGE) delete s[k];
    });
    return s;
  }

  // stable per-card key: data-id when present, else DOM position
  function cardKey(card, all) {
    return card.dataset.id || ('i' + Array.prototype.indexOf.call(all, card));
  }

  function capture() {
    var all = document.querySelectorAll(CARD_SEL);
    var cards = [];
    Array.prototype.forEach.call(all, function (c) {
      if (c.classList.contains('checked')) cards.push(cardKey(c, all));
    });
    var sets = [];
    Array.prototype.forEach.call(document.querySelectorAll('.mcl-ck.done'), function (ck) {
      var row = ck.closest('.mcl-row');
      if (row && row.id) sets.push(row.id);
    });
    return { cards: cards, sets: sets };
  }

  var session = null;        // live state for this PID
  var saveT = null;

  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var snap = capture();
      var hasTimer = session && session.timer && session.timer.endTs > Date.now();
      if (!snap.cards.length && !snap.sets.length && !hasTimer) {
        // nothing in progress — drop any stale record for this page
        var s0 = prune(readAll());
        if (s0[PID]) { delete s0[PID]; writeAll(s0); }
        return;
      }
      if (!session) session = { startedTs: Date.now() };
      session.cards = snap.cards;
      session.sets = snap.sets;
      session.lastTs = Date.now();
      var s = prune(readAll());
      s[PID] = session;
      writeAll(s);
    }, 200);
  }

  // ---- restore ------------------------------------------------------------
  function restoreCards() {
    if (!session || !session.cards || !session.cards.length) return;
    var all = document.querySelectorAll(CARD_SEL);
    Array.prototype.forEach.call(all, function (c) {
      if (session.cards.indexOf(cardKey(c, all)) !== -1) c.classList.add('checked');
    });
  }
  function restoreSets() {
    if (!session || !session.sets || !session.sets.length) return true;
    var done = true;
    session.sets.forEach(function (rowId) {
      var row = document.getElementById(rowId);
      if (!row) { done = false; return; }
      var ck = row.querySelector('.mcl-ck');
      if (ck && !ck.classList.contains('done')) {
        ck.classList.add('done'); ck.textContent = '✓';
        row.classList.add('done-row');
      }
    });
    return done;
  }
  function restoreTimer() {
    if (!session || !session.timer) return;
    var remain = Math.round((session.timer.endTs - Date.now()) / 1000);
    if (remain <= 0 || typeof TMR === 'undefined') { session.timer = null; return; }
    try {
      if (typeof buildTimerFloat === 'function') buildTimerFloat();
      if (TMR.setTime) TMR.setTime(remain, session.timer.label || 'REST');
    } catch (e) {}
  }

  // ---- record running rest timers (wall-clock, survives reload) -----------
  function wrapTimers() {
    if (typeof TMR === 'undefined') return;
    var oStart = TMR.start, oSetTime = TMR.setTime, oStop = TMR.stop;
    if (oStart) TMR.start = function (el, secs, name) {
      noteTimer(secs, name);
      return oStart.call(TMR, el, secs, name);
    };
    if (oSetTime) TMR.setTime = function (secs, label) {
      if (!TMR.__mcsRestoring) noteTimer(secs, label);
      return oSetTime.call(TMR, secs, label);
    };
    if (oStop) TMR.stop = function () {
      if (session && session.timer) { session.timer = null; save(); }
      return oStop.call(TMR);
    };
  }
  function noteTimer(secs, label) {
    if (!secs || secs <= 0) return;
    if (!session) session = { startedTs: Date.now() };
    session.timer = { endTs: Date.now() + secs * 1000, rest: secs, label: label || 'REST' };
    save();
  }

  // ---- init ----------------------------------------------------------------
  function init() {
    if (!document.querySelector(CARD_SEL)) return;   // not a workout page

    var s = prune(readAll());
    session = s[PID] || null;
    window.MCSession = { startedTs: session ? session.startedTs : 0 };

    wrapTimers();

    if (session) {
      restoreCards();
      // logger rows render asynchronously (mc-setlog retries up to ~2.6s)
      var tries = 0;
      (function tryRestore() {
        if (restoreSets() || ++tries > 12) return;
        setTimeout(tryRestore, 400);
      })();
      if (typeof TMR !== 'undefined') TMR.__mcsRestoring = true;
      restoreTimer();
      if (typeof TMR !== 'undefined') TMR.__mcsRestoring = false;
    }

    // event-driven capture: any check/uncheck (cards or set rows) persists
    var mo = new MutationObserver(save);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pagehide', function () {
      clearTimeout(saveT);
      // synchronous final write
      var snap = capture();
      if (!snap.cards.length && !snap.sets.length) return;
      if (!session) session = { startedTs: Date.now() };
      session.cards = snap.cards; session.sets = snap.sets; session.lastTs = Date.now();
      var st = prune(readAll()); st[PID] = session; writeAll(st);
    });

    // finishing a workout ends the session — stop resuming it
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('fw-confirm')) {
        var st = readAll();
        if (st[PID]) { delete st[PID]; writeAll(st); }
        session = null;
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
