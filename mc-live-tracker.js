/* ==========================================================================
   mc-live-tracker.js  —  Phase 2 shared module
   --------------------------------------------------------------------------
   Two responsibilities, both decoupled from each page's own data model so the
   module is portable across every workout page (and harmless on others):

   1) LIVE TRACKER (keep-awake + alert)
      • Holds a screen Wake Lock for the whole session, from the first logged
        set to Finish (flagship readiness R2), and always while a rest timer is
        running. "Keep screen on during workouts" (mc_prefs_v1.keepAwake,
        default on) governs the session half; a running rest always holds it.
        Re-acquired on every return to the page (wake locks auto-release when a
        page is hidden: a call, a text, an app switch).
      • Catch-up alert: if the rest interval elapsed while the tab was hidden
        (so the page's 0-tick buzz was throttled/missed), fire a single
        vibrate + beep when the user returns. No double-buzz: this only fires
        for the hidden-across-zero case the page can't cover.

   2) ACTIVITY LOG (data source for the dashboard's live streak strip)
      • On a workout page, records the last session (page, title, progress) and
        marks the calendar day trained — purely from the DOM, written when the
        user leaves the page. Exposes window.MCActivity for the dashboard to
        read (last session + resume target + day streak).

   Storage: localStorage 'mc_activity'. Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__mcLiveTracker) return;        // guard against double-include
  window.__mcLiveTracker = true;

  var ACT_KEY  = 'mc_activity';
  var EXPIRE_MS = 36 * 3600 * 1000;          // resume window — keep identical to mc-resume.js
  // R2: .ex-item is the eight-page frequency family's unit (mc-setlog.js and
  // mc-summary.js both count it). Without it those pages were never a
  // "workout page" here, so they got no wake lock and no activity record.
  var CARD_SEL = '.ex-card, .ss-ex, .ex-item, .lift-card';
  var DONE_SEL = '.ex-card.checked, .ss-ex.checked, .ex-item.checked, .lift-card.checked';
  var PAGE_ID  = (location.pathname.split('/').pop() || 'index.html');

  // ---- storage ------------------------------------------------------------
  function readAct() {
    try { return JSON.parse(localStorage.getItem(ACT_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeAct(a) { try { localStorage.setItem(ACT_KEY, JSON.stringify(a)); } catch (e) {} }
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ====================================================================== //
  //  AUDIO  (primed on first user gesture so the catch-up beep can play)   //
  // ====================================================================== //
  var audioCtx = null;
  function primeAudio() {
    if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { audioCtx = null; }
  }
  function beep() {
    if (!audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [0, 0.3, 0.6].forEach(function (t, i) {
        var osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.value = i === 2 ? 880 : 660;
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.25);
        osc.start(audioCtx.currentTime + t);
        osc.stop(audioCtx.currentTime + t + 0.25);
      });
    } catch (e) {}
  }
  function buzz() {
    MC_HAPTICS.complete();
    beep();
  }

  // ====================================================================== //
  //  WAKE LOCK                                                             //
  // ====================================================================== //
  var wakeLock = null, wantLock = false, acquiring = false, sessionActive = false;

  // A-8: keyed on TMR's own state, not a DOM class. #timerFloat only ever
  // gets .visible when the List rest view is the active preference
  // (applyRestView() in mc-timer.js) — under restView:'video' this used to
  // report false while a rest was genuinely running, so the wake lock was
  // never requested and the catch-up alert's snapshot was never armed, in
  // exactly the rest view built to be glanced at across the gym from a
  // distance. TMR.isRunning() is true/false regardless of which surface (or
  // neither) is currently shown.
  function timerRunning() {
    return typeof TMR !== 'undefined' && !!TMR.isRunning && TMR.isRunning();
  }
  function acquire() {
    if (!('wakeLock' in navigator) || wakeLock || acquiring || document.hidden) return;
    acquiring = true;
    try {
      navigator.wakeLock.request('screen').then(function (s) {
        acquiring = false;
        wakeLock = s;
        s.addEventListener('release', function () { wakeLock = null; });
        if (!wantLock) release();   // timer ended while the request was in flight
      }).catch(function () { acquiring = false; });
    } catch (e) { acquiring = false; }
  }
  function release() {
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
  }
  // R2: the session half honours "Keep screen on during workouts". Read at
  // call time, so a change in the account sheet or the timer tray applies on
  // the next sync without a reload (mc:prefs-changed, below).
  function keepAwakePref() {
    try {
      if (typeof MC_PREFS !== 'undefined' && MC_PREFS.get) return MC_PREFS.get().keepAwake !== false;
      var p = JSON.parse(localStorage.getItem('mc_prefs_v1') || '{}') || {};
      return p.keepAwake !== false;
    } catch (e) { return true; }
  }
  function syncLock() {
    if (timerRunning() || (sessionActive && keepAwakePref())) { wantLock = true; acquire(); }
    else { wantLock = false; release(); }
  }

  // ====================================================================== //
  //  CATCH-UP ALERT                                                        //
  // ====================================================================== //
  // R2: remaining seconds from TMR's own clock. This used to parse the text
  // of #timerFloatTime — and since M3b the float is hidden on every page with
  // set rows, where the tick stops writing it, so the parse read a value
  // frozen at the rest's starting length and the catch-up decision was made
  // on a number that was never the time left.
  function currentRemaining() {
    if (typeof TMR === 'undefined' || !TMR.remaining) return null;
    var r = TMR.remaining();
    return (typeof r === 'number' && isFinite(r)) ? r : null;
  }

  var hideSnap = null;   // { rem, t } captured when the tab is hidden mid-rest

  function onHide() {
    logSession();                       // persist progress as the user leaves
    if (timerRunning()) {
      var rem = currentRemaining();
      hideSnap = (rem !== null) ? { rem: rem, t: Date.now() } : null;
    } else { hideSnap = null; }
    release();                          // (auto-released anyway; explicit for clarity)
  }
  function onShow() {
    if (hideSnap) {
      var elapsed = (Date.now() - hideSnap.t) / 1000;
      if (hideSnap.rem > 0 && elapsed >= hideSnap.rem) {          // ended while away
        buzz();
        // ...and SHOW it: a silent phone delivers neither the beep nor the
        // buzz, so the cue the athlete can count on is the visual one.
        try { if (typeof TMR !== 'undefined' && TMR.restEndCue) TMR.restEndCue(); } catch (e) {}
      }
      hideSnap = null;
    }
    // R2 / D-07: re-acquire on EVERY return while anything wants the screen
    // on — a session, not only a running rest. A call, a text or an app switch
    // releases the lock, and it used to come back only if a rest happened to
    // be running at the moment the athlete returned.
    syncLock();
  }

  // ====================================================================== //
  //  ACTIVITY LOG                                                          //
  // ====================================================================== //
  function isWorkoutPage() { return !!document.querySelector(CARD_SEL); }

  function sessionTitle() {
    var h = document.querySelector('h1, .day-session, .topbar-title');
    var t = (h && h.textContent.trim()) || (document.title || '').trim();
    return t.replace(/\s*[|–—-]\s*4.?Weeks.*$/i, '').slice(0, 48) || PAGE_ID;
  }
  // Count of exercises with a real logged set today, per the authoritative
  // 'mc_setlog_v1' store mc-setlog.js writes (weight/reps), NOT the .checked
  // class — a manual checkbox toggled independently of actual set logging
  // on some pages, so it can over- or under-count real completion.
  function loggedExerciseCountToday(pid) {
    try {
      var store = JSON.parse(localStorage.getItem('mc_setlog_v1') || '{}');
      // FIX-06 (roadmap Phase 5.1): dated session keys, upgraded on read here
      // the same way mc-finish.js and mc-suggest.js do — this is the third of
      // the three private readers of this store. Without it the live tracker
      // reports zero exercises trained for a session logged before the
      // upgrade, and the dashboard's progress ring reads empty mid-workout.
      var L = (typeof window !== 'undefined' && window.MC_LOG) ? window.MC_LOG : null;
      var today = (L && L.dayKey) ? L.dayKey()
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      var prefix = pid + '|';
      var n = 0;
      Object.keys(store).forEach(function (k) {
        if (k.indexOf(prefix) !== 0) return;
        var list = (L && L.normalizeSessions) ? L.normalizeSessions(store[k]) : store[k];
        var sess = list && list[0];
        if (sess && sess.d === today && sess.sets && Object.keys(sess.sets).length) n++;
      });
      return n;
    } catch (e) { return 0; }
  }
  function progress() {
    var total = document.querySelectorAll(CARD_SEL).length;
    // Prefer the setlog store when this page has it wired in (window.MCSetlogUtil
    // is set by mc-setlog.js); it's the actual weight/rep log, not a checkbox tap.
    // Falls back to the .checked DOM count on pages without the setlog engine.
    if (window.MCSetlogUtil) {
      var done = loggedExerciseCountToday(window.MCSetlogUtil.pid);
      return { done: Math.min(done, total), total: total };
    }
    return { done: document.querySelectorAll(DONE_SEL).length, total: total };
  }

  // same id mc-sync.js mints — lets mc-resume.js tell "this device" from
  // "your other device" when mc_activity arrives via cloud sync
  function deviceId() {
    try { return localStorage.getItem('mc_device_id') || ''; } catch (e) { return ''; }
  }

  function logSession() {
    if (!isWorkoutPage()) return;
    var p = progress();
    if (!p.total) return;
    if (p.done <= 0) return;                  // only record sessions with real progress
    var a = readAct();
    a.last = { pageId: PAGE_ID, title: sessionTitle(), done: p.done, total: p.total, ts: Date.now(), deviceId: deviceId() };
    a.days = a.days || {}; a.days[dayKey()] = true;
    writeAct(a);
  }

  // public read API for the dashboard card.
  //
  // Phase 4 step 1 (audit EN-4): the count itself lives in mc-streak.js, which
  // counts ADHERENCE — a prescribed rest day preserves the streak, a missed
  // training day ends it. This walked consecutive CALENDAR days, and every
  // program in the app rests at least one day a week, so following a
  // prescription exactly used to break the streak on its first rest day.
  //
  // Resolved lazily, never captured at parse time, the same way this file
  // already treats every other cross-module read: <script> order across ~140
  // pages does not guarantee mc-streak.js has run when this parses. Only
  // dashboard.html and stats.html read `.streak`, and both load it; a page
  // without it still gets a number rather than an exception.
  // The mode the last computeStreak() ran in, so a caller can word the label
  // correctly: 'schedule' and 'history' count WORKOUTS, 'calendar' counts days,
  // and "10-day streak" is wrong for the first two (ten prescribed training
  // days span fourteen calendar days on a 5-on 2-off block).
  var lastMode = 'calendar';
  function streakInputs() {
    var out = { days: null, rec: null, isRest: null, pattern: null };
    try {
      var prog = JSON.parse(localStorage.getItem('mc_active_prog') || 'null');
      var P = window.MC_PROGRAM_PROGRESS;
      if (prog && prog.id && !prog.cprogId && !prog.pubId && P && window.MC_PM_DATA) {
        var src = MC_PM_DATA.program(prog.id);
        var def = src && P.defFromSchedule(src.schedule);
        if (def) {
          var rec = P.get(prog.id, def);
          out.rec = rec;
          out.isRest = function (d) { return P.isRest(rec, d); };
        }
      }
    } catch (e) {}
    try { if (window.MCBridge) out.pattern = MCBridge.likelyTrainingDays(); } catch (e) {}
    return out;
  }
  function computeStreak(days) {
    if (!days) return 0;
    var S = window.MC_STREAK;
    if (S && S.compute) {
      var inp = streakInputs();
      inp.days = days;
      try { var r = S.compute(inp); lastMode = r.mode; return r.n || 0; } catch (e) {}
    }
    var cur = new Date(), n = 0;
    if (!days[dayKey(cur)]) cur.setDate(cur.getDate() - 1);   // today not done yet: don't break the streak
    while (days[dayKey(cur)]) { n++; cur.setDate(cur.getDate() - 1); }
    return n;
  }
  // resume gate — keep byte-identical to mc-resume.js's isResumable()
  function isResumable(L) {
    return !!(L && L.done > 0 && L.done < L.total && !L.dismissed &&
              (Date.now() - L.ts) <= EXPIRE_MS);
  }
  window.MCActivity = {
    get: function () {
      var a = readAct();
      var n = computeStreak(a.days);
      return { last: isResumable(a.last) ? a.last : null,
               streak: n, streakMode: lastMode, streakUnit: lastMode === 'calendar' ? 'day' : 'workout',
               trainedToday: !!(a.days && a.days[dayKey()]) };
    },
    enableSessionLock:  function () { sessionActive = true;  syncLock(); },
    releaseSessionLock: function () { sessionActive = false; syncLock(); }
  };

  // ====================================================================== //
  //  INIT                                                                  //
  // ====================================================================== //
  var inited = false;
  function init() {
    if (inited) return;
    // R2: the "cards at load" trap, a sixth time. Every F3 page opens on its
    // DAY LIST, with no exercise card in the DOM until a day is tapped, and
    // this returned on that — so a session entered the normal way got no
    // rest-time wake lock and wrote no activity record (the dashboard's
    // resume banner reads it). Deferred instead, off the shared "cards just
    // rendered" signal, exactly as mc-session.js has done since F3-1.
    if (!isWorkoutPage()) {
      if (document.querySelector('.day-card') && window.MC_SCAN && MC_SCAN.subscribe) {
        MC_SCAN.subscribe(function () { if (!inited && isWorkoutPage()) init(); });
        if (MC_SCAN.start) MC_SCAN.start();
      }
      return;
    }
    inited = true;
    {
      // any tap primes/unlocks audio so the catch-up beep can play (the rest-timer tap counts)
      document.addEventListener('pointerdown', primeAudio, { passive: true });
      // R2 / D-06: driven by TMR's own state. This watched #timerFloat's
      // .visible class, which M3b stopped setting on every page with set rows
      // (the inline rest row replaced the float there), so a rest never asked
      // for the lock on those pages — the first exercise of every session ran
      // with the screen free to sleep. mc-timer.js announces every start and
      // stop instead, and a pref change re-syncs the same way.
      document.addEventListener('mc:rest-state', syncLock);
      document.addEventListener('mc:prefs-changed', function (e) {
        if (e && e.detail && e.detail.key === 'keepAwake') syncLock();
      });
      syncLock();
      window.addEventListener('pagehide', logSession);
      document.addEventListener('visibilitychange', function () { document.hidden ? onHide() : onShow(); });

      // Record progress the instant a set is checked off, not only when the
      // tab is hidden/left — otherwise the dashboard's completion % (and any
      // other mc_activity reader) sits stale until the athlete backgrounds
      // the page. Mirrors mc-rep-progress.js's debounced .set-check observer.
      var _logDbt = null;
      function debounceLog() { clearTimeout(_logDbt); _logDbt = setTimeout(logSession, 200); }
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var t = muts[i].target;
          if (t.classList && t.classList.contains('set-check')) { debounceLog(); return; }
        }
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
