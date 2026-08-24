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
    // A-14: each entry now carries the owning card's key alongside the row
    // id, not just the id — a lazily-built card's rows don't exist in the
    // DOM until it's activated, so restoreSets() needs to know WHICH card to
    // build before it can look a row up by id. See restoreSets()/cardByKey().
    var sets = [];
    Array.prototype.forEach.call(document.querySelectorAll('.mcl-ck.done'), function (ck) {
      var row = ck.closest('.mcl-row');
      if (!row || !row.id) return;
      var owner = row.closest(CARD_SEL);
      sets.push({ id: row.id, card: owner ? cardKey(owner, all) : null });
    });
    // §3.4: which card's logger the athlete had open, so a resume — or the
    // SW's forced deploy reload — lands them back on it instead of a fully
    // collapsed page they have to re-navigate.
    var activeEl = document.querySelector('.ex-card.active, .ss-ex.active, .ex-item.active');
    var activeCard = activeEl ? cardKey(activeEl, all) : null;
    return { cards: cards, sets: sets, activeCard: activeCard };
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
      session.activeCard = snap.activeCard;
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
  // A-14: resolve a stored card key back to its live DOM element, the same
  // way restoreCards()/restoreActiveCard() already match by key.
  function cardByKey(key) {
    if (key == null) return null;
    var all = document.querySelectorAll(CARD_SEL), found = null;
    Array.prototype.forEach.call(all, function (c) {
      if (!found && cardKey(c, all) === key) found = c;
    });
    return found;
  }

  // A-7: restoring a set row here writes .done straight onto the DOM instead
  // of going through mc-setlog.js's onCheck() — which is also the only path
  // that runs updateCount() (the collapsed-strip badge, the .checked mirror,
  // .mcl-alldone, the auto-collapse timer). Left alone, a reload mid-session
  // showed the right checkmarks with every one of those readouts stuck at
  // the pre-reload value (typically 0/N). Track which cards actually had a
  // row restored on THIS pass and run the real derivation for each of them
  // once retries settle, via the small surface mc-setlog.js exposes for
  // exactly this (window.MCSetlogUtil.updateCountByCard).
  //
  // A-14: a lazily-built card's rows may not exist yet — getElementById would
  // just never find them and the retry ladder in init() would blindly poll
  // for 4.8s before giving up. Each entry now carries its owning card's key
  // (see capture()), so the owning card gets built FIRST, synchronously,
  // right here — the row is then found on the very same pass instead of
  // however many retries it used to take. Old-shape records (a bare string,
  // saved before this change) have no owner key and fall back to the
  // original blind-retry behavior; mc_session_v1 prunes anything over 12h
  // old, so that shape ages out on its own.
  function restoreSets() {
    if (!session || !session.sets || !session.sets.length) return true;
    var done = true;
    var touchedCards = [];
    session.sets.forEach(function (entry) {
      var rowId = typeof entry === 'string' ? entry : entry.id;
      var ownerKey = typeof entry === 'string' ? null : entry.card;
      if (ownerKey != null && window.MCSetlogUtil && window.MCSetlogUtil.ensureRowsBuilt) {
        var owner = cardByKey(ownerKey);
        if (owner) window.MCSetlogUtil.ensureRowsBuilt(owner);
      }
      var row = document.getElementById(rowId);
      if (!row) { done = false; return; }
      var ck = row.querySelector('.mcl-ck');
      if (ck && !ck.classList.contains('done')) {
        ck.classList.add('done'); ck.textContent = '✓';
        row.classList.add('done-row');
        var card = row.closest(CARD_SEL);
        if (card && touchedCards.indexOf(card) === -1) touchedCards.push(card);
      }
    });
    if (touchedCards.length && window.MCSetlogUtil && window.MCSetlogUtil.updateCountByCard) {
      touchedCards.forEach(function (c) { window.MCSetlogUtil.updateCountByCard(c); });
    }
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

  // §3.4: re-open the exact card the athlete was on. window.MCSetlogUtil
  // .activateCard() marks it active and opens its logger; day-cards start
  // collapsed on every engine and there is no single shared "open this day"
  // function across the ~9 page families (each engine wires its own, some
  // inline-onclick, some addEventListener) — dispatching a real click on the
  // day-header works regardless of which mechanism a given page uses,
  // because both listen for the same event a real tap would produce.
  function restoreActiveCard() {
    if (!session || !session.activeCard) return;
    if (!window.MCSetlogUtil || !MCSetlogUtil.activateCard) return;
    var all = document.querySelectorAll(CARD_SEL), card = null;
    Array.prototype.forEach.call(all, function (c) {
      if (!card && cardKey(c, all) === session.activeCard) card = c;
    });
    if (!card) return;
    var day = card.closest('.day-card');
    if (day && !day.classList.contains('open')) {
      var header = day.querySelector('.day-header');
      if (header) header.click();
    }
    MCSetlogUtil.activateCard(card);
  }

  // VOC-A2: a genuinely fresh visit — no mc_session_v1 record for this page
  // at all, not even an empty one — used to leave every day collapsed and
  // every card resting at its 0/N strip, so reaching the very first loggable
  // set took a day-header tap plus a strip tap. Lands the athlete on the
  // first unfinished exercise directly instead, the same way
  // restoreActiveCard() above already lands a RETURNING session back where
  // it left off — same day-header-click mechanism, same
  // MCSetlogUtil.activateCard() call, just seeded from
  // MCSetlogUtil.firstIncompleteUnit() instead of a stored card key. Only
  // runs when init() found no session record (see below); an in-progress or
  // restored session's own activeCard always takes priority over this.
  //
  // mc-setlog.js's cards render synchronously on most pages but some engines
  // build them asynchronously off MC_SCAN — poll like restoreSets() does
  // rather than assuming the first pass already has them.
  function autoOpenFirstUnfinished() {
    if (!window.MCSetlogUtil || !MCSetlogUtil.activateCard || !MCSetlogUtil.firstIncompleteUnit) return;
    var tries = 0;
    (function tryOpen() {
      var card = MCSetlogUtil.firstIncompleteUnit();
      if (!card) {
        if (++tries <= 12) setTimeout(tryOpen, 400);
        return;
      }
      var day = card.closest('.day-card');
      if (day && !day.classList.contains('open')) {
        var header = day.querySelector('.day-header');
        if (header) header.click();
      }
      MCSetlogUtil.activateCard(card);
    })();
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
  var inited = false;
  function init() {
    if (inited) return;

    // Roadmap F3: a multi-day page can now open on its DAY LIST, with no
    // exercise card in the DOM until the athlete picks a day. This guard used
    // to read that as "not a workout page" and return — so the MutationObserver
    // below was never wired, save() never ran, and a whole session went
    // unrecorded: the sets landed in mc_setlog_v1 but mc_session_v1 stayed
    // empty, which also costs the dashboard its resume banner. Measured, not
    // theorised — it is the A-14 hazard S5c-0 flagged, arriving through F3's
    // door on the first page family converted.
    //
    // So a page that HAS day cards but has not rendered one yet is deferred,
    // not rejected: MC_SCAN is the shared "cards just rendered" signal (S5a),
    // and init() re-runs the moment the first card appears. Pages with neither
    // cards nor day cards still return immediately, as before.
    if (!document.querySelector(CARD_SEL)) {
      if (document.querySelector('.day-card') && window.MC_SCAN && MC_SCAN.subscribe) {
        MC_SCAN.subscribe(function () {
          if (!inited && document.querySelector(CARD_SEL)) init();
        });
        if (MC_SCAN.start) MC_SCAN.start();
      }
      return;                                        // not a workout page (yet)
    }
    inited = true;

    var s = prune(readAll());
    session = s[PID] || null;
    window.MCSession = { startedTs: session ? session.startedTs : 0 };

    wrapTimers();

    if (session) {
      restoreCards();
      // logger rows render asynchronously (mc-setlog retries up to ~2.6s)
      var tries = 0;
      (function tryRestore() {
        if (restoreSets() || ++tries > 12) { restoreActiveCard(); return; }
        setTimeout(tryRestore, 400);
      })();
      if (typeof TMR !== 'undefined') TMR.__mcsRestoring = true;
      restoreTimer();
      if (typeof TMR !== 'undefined') TMR.__mcsRestoring = false;
    } else {
      // VOC-A2: nothing to restore — this is a fresh visit, so land on the
      // first unfinished exercise instead of leaving every day closed.
      autoOpenFirstUnfinished();
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
