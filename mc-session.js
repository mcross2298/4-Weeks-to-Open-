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
  // Phase 5.3: the in-progress session snapshot is what restores a reload and
  // what the dashboard's resume banner reads, so a silent quota failure here
  // loses the workout the athlete is standing in. Routed through
  // MCSetlogUtil.writeStore() — resolved at CALL time, since mc-setlog.js's
  // tag is not guaranteed to have run when this file parses.
  function writeAll(s) {
    var v; try { v = JSON.stringify(s); } catch (e) { return; }
    if (window.MCSetlogUtil && MCSetlogUtil.writeStore) { MCSetlogUtil.writeStore(KEY, v); return; }
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
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
      if (endedRows && endedRows[row.id]) return;   // banked or discarded already
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

  // DEF-CR-02: restore must survive a RE-RENDER, and an empty DOM is not
  // evidence that nothing is in progress.
  //
  // Measured on the largest multi-day page in the tree (26 days, 199 cards,
  // 112 rows): log three sets, reload, and mc_session_v1 is {} within a second
  // and never comes back -- still {} and zero ticks twelve seconds later.
  // mc_setlog_v1 keeps the sets, so no history is lost, but the page reads as
  // untouched and the athlete cannot see what they have already done.
  // (The page is named in tools/test-mc-restore-fidelity.js, which does not
  // ship; a shared module must not name a licensed page -- build-market.py's
  // leak scan rejects it, correctly.)
  //
  // The first guess was that save() beat restore to an empty DOM. It did not:
  // window.MCSession.startedTs was set, so init() found the record and
  // restoreSets() ran and SUCCEEDED. What happens is worse and more specific --
  // this engine REBUILDS its day cards after that first paint. The rows restore
  // ticked are then thrown away with the old DOM, restoreSets() has already
  // latched as done and never runs again, and save(), firing on the rebuild's
  // own mutations, reads the fresh tick-free DOM as "nothing in progress" and
  // deletes the record. So the state is not merely un-painted; it is destroyed,
  // and no later restore can recover it.
  //
  // Two things are therefore needed, and neither alone is sufficient:
  //   1. restore re-applies whenever cards are re-rendered. MC_SCAN is the
  //      shared "cards just rendered" signal (S5a) that this file already uses
  //      to defer init() on a day-list page, so restore subscribes to it too.
  //   2. the destructive branch is disabled while a restore is outstanding, so
  //      the window between a rebuild and its re-restore cannot delete the
  //      record. It stays disabled if restore ran out of retries without
  //      succeeding: a record whose rows never rendered is still the only
  //      pointer to what was ticked. Records still expire through prune()'s
  //      MAX_AGE, and finishing a workout clears its own record explicitly.
  var restoreSettled = true;   // no stored session -> nothing to wait for

  // Flagship readiness R1 / D-01: a week, phase or cycle tab round trip
  // deleted the live session on all seven tabbed engines. DEF-CR-02 above
  // fixed the rebuild for a page that ALREADY had a record at load; a session
  // started on this page load never got the re-restore subscription, so the
  // tab's rebuild produced a tick-free DOM and save() read that as "nothing
  // in progress" and deleted the record.
  //
  // Wiring the subscription unconditionally (init() below) is half of it.
  // The other half is that save() must stop inferring an UNTICK from the
  // DOM. A tab, the day list, a lazily-built card and a re-render all remove
  // ticked rows from view without unticking anything, and every one of them
  // looked identical to an untick here. So the stored list is now only ever
  // REDUCED by the three things that really end a set or a session:
  //   - an untick, which mc-setlog.js announces as 'mc:set-unchecked';
  //   - Finish, announced as 'mc:workout-finished';
  //   - Discard, which deletes the record itself and leaves _FW.finished set.
  // Everything else is a union of what was stored and what is ticked now.
  // Records still expire through prune()'s MAX_AGE.
  var endedRows = null;        // { rowId: 1 } ticked when the session ended

  function mergedSets(snapSets) {
    var out = [], seen = {};
    function add(e) {
      var id = typeof e === 'string' ? e : (e && e.id);
      if (!id || seen[id] || (endedRows && endedRows[id])) return;
      seen[id] = 1; out.push(e);
    }
    snapSets.forEach(add);                         // live owner keys win
    ((session && session.sets) || []).forEach(add);
    return out;
  }

  // Belt and braces for the delete branch: today's committed sets for this
  // page are the durable record of a session in progress, so while
  // mc_setlog_v1 holds any, "nothing ticked on screen" is never enough to
  // drop the pointer to them.
  function setlogHasToday() {
    try {
      var all = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      if (!all || typeof all !== 'object') return false;
      var L = window.MC_LOG;
      var today = L && L.dayKey ? L.dayKey() : null;
      if (!today) return false;
      var pre = PID + '|';
      return Object.keys(all).some(function (k) {
        if (k.indexOf(pre) !== 0 || !Array.isArray(all[k])) return false;
        var list = L.normalizeSessions ? L.normalizeSessions(all[k]) : all[k];
        var top = list[0];
        return !!(top && top.d === today && top.sets && Object.keys(top.sets).length);
      });
    } catch (e) { return false; }
  }

  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      // Discard sets _FW.finished and deletes the record without an event.
      if (window._FW && window._FW.finished && !endedRows) { endSession(); return; }
      var snap = capture();
      var sets = mergedSets(snap.sets);
      var hasTimer = session && session.timer && session.timer.endTs > Date.now();
      if (!snap.cards.length && !sets.length && !hasTimer) {
        // DEF-CR-02: only "nothing in progress" once restore has settled.
        if (!restoreSettled) return;
        if (setlogHasToday() && !endedRows) return;
        // nothing in progress — drop any stale record for this page
        var s0 = prune(readAll());
        if (s0[PID]) { delete s0[PID]; writeAll(s0); }
        return;
      }
      if (!session) session = { startedTs: Date.now() };
      session.cards = snap.cards;
      session.sets = sets;
      session.activeCard = snap.activeCard;
      session.lastTs = Date.now();
      var s = prune(readAll());
      s[PID] = session;
      writeAll(s);
    }, 200);
  }

  // Finish or discard: remember which rows were ticked at that moment, so
  // the still-ticked DOM of a banked workout cannot re-create the record it
  // just cleared (a recap stays on screen after Finish, and pagehide used to
  // write the session straight back). A set ticked AFTER this counts again.
  function endSession() {
    clearTimeout(saveT);
    endedRows = {};
    Array.prototype.forEach.call(document.querySelectorAll('.mcl-ck.done'), function (ck) {
      var row = ck.closest('.mcl-row');
      if (row && row.id) endedRows[row.id] = 1;
    });
    ((session && session.sets) || []).forEach(function (e) {
      var id = typeof e === 'string' ? e : (e && e.id);
      if (id) endedRows[id] = 1;
    });
    session = null;
    var st = readAll();
    if (st[PID]) { delete st[PID]; writeAll(st); }
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
  function ownerByRowId(rowId) {
    var found = null;
    Array.prototype.forEach.call(document.querySelectorAll(CARD_SEL), function (c) {
      if (found) return;
      var pre;
      try { pre = MCSetlogUtil.rowIdPrefix(c); } catch (e) { return; }
      if (rowId.indexOf(pre) === 0 && /^\d+$/.test(rowId.slice(pre.length))) found = c;
    });
    return found;
  }
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
      // R1 / D-01: a stored owner key is positional ('i0'), and a tab that
      // re-renders a different set of cards moves it — so the owner may be
      // another card now, and the row's real owner unbuilt. The row id
      // carries the exercise identity, so find the card it belongs to.
      if (!row && window.MCSetlogUtil && MCSetlogUtil.rowIdPrefix && MCSetlogUtil.ensureRowsBuilt) {
        var real = ownerByRowId(rowId);
        if (real) { MCSetlogUtil.ensureRowsBuilt(real); row = document.getElementById(rowId); }
      }
      if (!row) { done = false; return; }
      var ck = row.querySelector('.mcl-ck');
      var wasDone = !!(ck && ck.classList.contains('done'));
      // DEF-CR-01: this used to set the tick class and text and nothing else,
      // so a restored row kept build()'s PRESCRIPTION in its inputs, ghosted —
      // an athlete who reloaded mid-session saw 205x9 come back as 205x5, and
      // unchecking/re-checking that row committed the ghost for real.
      // mc-setlog.js owns the row, the ghost contract and the count, so the
      // repaint lives there and both restore paths call the one copy.
      if (window.MCSetlogUtil && window.MCSetlogUtil.paintLoggedRow) {
        window.MCSetlogUtil.paintLoggedRow(row);
      } else if (ck && !wasDone) {
        ck.classList.add('done'); ck.textContent = '✓';
        ck.setAttribute('aria-checked', 'true');
        row.classList.add('done-row');
      }
      if (!wasDone) {
        var card = row.closest(CARD_SEL);
        if (card && touchedCards.indexOf(card) === -1) touchedCards.push(card);
      }
    });
    if (touchedCards.length && window.MCSetlogUtil && window.MCSetlogUtil.updateCountByCard) {
      touchedCards.forEach(function (c) { window.MCSetlogUtil.updateCountByCard(c); });
    }
    return done;
  }
  // DEF-CR-02: one restore attempt, polled because logger rows render
  // asynchronously (mc-setlog retries up to ~2.6s). Re-entrant: a rebuild can
  // start a fresh attempt while an older one is still polling, and the older
  // one must not clear the flag on the newer one's behalf.
  var restoreGen = 0;
  // R1: since the re-restore is wired on every page, it also runs mid-session
  // after a tab re-render. Re-painting ticks is its whole job there. It must
  // not NAVIGATE — re-opening a day the athlete just closed, or re-activating
  // a card they moved off. So restore may put the athlete back on their card
  // until it has done that once for a session found at load (navPending; a
  // DEF-CR-02 rebuild can undo the first attempt, and an athlete who taps the
  // day straight after a reload still expects to land on their card), and
  // otherwise only before they first touch the page. Bounded to 10 seconds
  // after load either way. A synthetic header.click() fires no pointerdown,
  // so restore's own navigation does not count as touching.
  var userActed = false, navPending = false, NAV_WINDOW = 10000, loadTs = Date.now();
  ['pointerdown', 'keydown'].forEach(function (t) {
    document.addEventListener(t, function () { userActed = true; }, { capture: true, once: true });
  });
  function afterRestore() {
    if ((navPending || !userActed) && Date.now() - loadTs < NAV_WINDOW) {
      if (restoreActiveCard()) navPending = false;
    }
    restoreTimer();
  }
  function runRestore() {
    restoreSettled = false;
    var gen = ++restoreGen, tries = 0;
    (function tryRestore() {
      if (gen !== restoreGen) return;               // superseded by a newer attempt
      if (restoreSets()) { restoreSettled = true; afterRestore(); return; }
      if (++tries > 12) { afterRestore(); return; }   // gave up: stay latched
      setTimeout(tryRestore, 400);
    })();
  }

  // R1 / D-04: a running rest used to come back as nothing. Two causes:
  // the record was written BEFORE the original start(), whose own first act
  // is stop() -- which this file wraps to clear the record -- so it was
  // never stored at all; and the restore went through TMR.setTime(), which
  // paints only the float, which M3b hides on any page with set rows.
  // Now the record is taken from TMR's own state after start() returns, and
  // the restore re-starts the same rest on the same card through start(),
  // so the inline row the athlete was looking at is the one that comes
  // back, counting from the original wall-clock end, not from a fresh rest.
  // Runs once, after the rows are restored, because the inline row anchors
  // to the last ticked row of its card.
  var timerRestored = false;
  function lastTickedCard() {
    var list = (session && session.sets) || [], card = null;
    for (var i = list.length - 1; i >= 0 && !card; i--) {
      var e = list[i];
      if (e && typeof e !== 'string') card = cardByKey(e.card);
      if (!card) {
        var row = document.getElementById(typeof e === 'string' ? e : (e && e.id));
        card = row ? row.closest(CARD_SEL) : null;
      }
    }
    return card;
  }
  function restoreTimer() {
    if (timerRestored) return;
    timerRestored = true;
    if (!session || !session.timer || typeof TMR === 'undefined') return;
    if (TMR.isRunning && TMR.isRunning()) return;   // a live rest is the truth
    var t = session.timer;
    var remainMs = (t.endTs || 0) - Date.now();
    if (!(remainMs > 1000)) { session.timer = null; return; }
    var rest = t.rest > 0 ? t.rest : Math.ceil(remainMs / 1000);
    TMR.__mcsRestoring = true;
    try {
      if (typeof buildTimerFloat === 'function') buildTimerFloat();
      var card = t.kind === 'preset' ? null : (cardByKey(t.card) || lastTickedCard());
      if (card && TMR.start) {
        TMR.start(card.querySelector('.rest-timer') || card, rest, t.label || 'Rest');
      } else if (TMR.setTime) {
        TMR.setTime(rest, t.label || 'REST');
      }
      TMR.startTime = t.endTs - rest * 1000;   // the original rest, not a new one
    } catch (e) {}
    TMR.__mcsRestoring = false;
    noteTimer(t.label, t.kind);   // start()'s own stop() cleared the record
  }

  // §3.4: re-open the exact card the athlete was on. window.MCSetlogUtil
  // .activateCard() marks it active and opens its logger; day-cards start
  // collapsed on every engine and there is no single shared "open this day"
  // function across the ~9 page families (each engine wires its own, some
  // inline-onclick, some addEventListener) — dispatching a real click on the
  // day-header works regardless of which mechanism a given page uses,
  // because both listen for the same event a real tap would produce.
  function restoreActiveCard() {
    if (!session || !session.activeCard) return false;
    if (!window.MCSetlogUtil || !MCSetlogUtil.activateCard) return false;
    var all = document.querySelectorAll(CARD_SEL), card = null;
    Array.prototype.forEach.call(all, function (c) {
      if (!card && cardKey(c, all) === session.activeCard) card = c;
    });
    if (!card) return false;
    var day = card.closest('.day-card');
    if (day && !day.classList.contains('open')) {
      var header = day.querySelector('.day-header');
      if (header) header.click();
    }
    MCSetlogUtil.activateCard(card);
    return true;
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
    var oStart = TMR.start, oSetTime = TMR.setTime, oStop = TMR.stop, oAdjust = TMR.adjust;
    // Each records AFTER the original runs: start() and setTime() both begin
    // with this.stop(), which is the wrapper below and clears the record.
    if (oStart) TMR.start = function (el, secs, name) {
      var r = oStart.call(TMR, el, secs, name);
      if (!TMR.__mcsRestoring) noteTimer(name);
      return r;
    };
    if (oSetTime) TMR.setTime = function (secs, label) {
      var r = oSetTime.call(TMR, secs, label);
      if (!TMR.__mcsRestoring) noteTimer(label, 'preset');
      return r;
    };
    if (oStop) TMR.stop = function () {
      if (session && session.timer) { session.timer = null; save(); }
      return oStop.call(TMR);
    };
    // ±15s moves the end time; the stored record has to move with it.
    if (oAdjust) TMR.adjust = function (delta) {
      var r = oAdjust.call(TMR, delta);
      if (session && session.timer) noteTimer(session.timer.label, session.timer.kind);
      return r;
    };
  }
  function noteTimer(label, kind) {
    if (typeof TMR === 'undefined' || TMR.startTime == null || !(TMR.duration > 0)) return;
    if (!session) session = { startedTs: Date.now() };
    var owner = TMR.activeEl && TMR.activeEl.closest ? TMR.activeEl.closest(CARD_SEL) : null;
    var prev = session.timer || {};
    session.timer = {
      endTs: TMR.startTime + TMR.duration * 1000,
      rest: TMR.duration,
      label: label || prev.label || 'REST',
      kind: kind || prev.kind || (TMR.activeEl ? 'rest' : 'preset'),
      card: owner ? cardKey(owner, document.querySelectorAll(CARD_SEL)) : (prev.card || null)
    };
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

    // DEF-CR-02: some engines rebuild their day cards after the first paint,
    // discarding the rows restore just ticked. MC_SCAN is the shared signal
    // that cards have just rendered, so re-apply on every one of them. The
    // work is idempotent -- restoreSets() skips a row already marked done --
    // so a scan on an unchanged DOM costs a query and nothing else.
    // R1 / D-01: wired whether or not a record existed at load. A session
    // STARTED on this page load is rebuilt by a week tab exactly like a
    // restored one, and the callback reads `session` at call time.
    if (window.MC_SCAN && MC_SCAN.subscribe) {
      MC_SCAN.subscribe(function () {
        if (!session || !session.sets || !session.sets.length) return;
        var painted = document.querySelectorAll('.mcl-ck.done').length;
        if (painted >= session.sets.length) return;   // already whole
        runRestore();
      });
      if (MC_SCAN.start) MC_SCAN.start();
    }

    // Only a session that existed at load has a rest to restore. One started
    // on this page load already has its timer running, and a re-restore after
    // a tab re-render must not restart it.
    if (!session) timerRestored = true;
    navPending = !!session;

    if (session) {
      restoreCards();
      runRestore();
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
      if (window._FW && window._FW.finished && !endedRows) { endSession(); return; }
      // synchronous final write
      var snap = capture();
      var sets = mergedSets(snap.sets);
      if (!snap.cards.length && !sets.length) return;
      if (!session) session = { startedTs: Date.now() };
      session.cards = snap.cards; session.sets = sets; session.lastTs = Date.now();
      var st = prune(readAll()); st[PID] = session; writeAll(st);
    });

    // R1 / D-01: an untick is the one thing that removes a single set from
    // the stored list. mc-setlog.js owns the row and announces it.
    document.addEventListener('mc:set-unchecked', function (e) {
      var id = e && e.detail && e.detail.rowId;
      if (!id || !session || !session.sets) return;
      session.sets = session.sets.filter(function (x) {
        return (typeof x === 'string' ? x : (x && x.id)) !== id;
      });
      save();
    });

    // finishing a workout ends the session — stop resuming it. The event
    // covers a programmatic _FW.confirm() too, which the click never saw.
    document.addEventListener('mc:workout-finished', endSession);
    document.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('fw-confirm')) endSession();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
