/* ==========================================================================
   mc-live-tracker.js  —  Phase 2 shared module
   --------------------------------------------------------------------------
   Two responsibilities, both decoupled from each page's own data model so the
   module is portable across every workout page (and harmless on others):

   1) LIVE TRACKER (keep-awake + alert)
      • Holds a screen Wake Lock while a rest timer is running (detected via the
        page's #timerFloat.visible), so the screen never locks mid-rest and the
        page's existing buzz/countdown keeps ticking. Re-acquired on tab return
        (wake locks auto-release when a page is hidden).
      • Catch-up alert: if the rest interval elapsed while the tab was hidden
        (so the page's 0-tick buzz was throttled/missed), fire a single
        vibrate + beep when the user returns. No double-buzz: this only fires
        for the hidden-across-zero case the page can't cover.

   2) ACTIVITY LOG (data source for the dashboard's Daily Gainz card)
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
  var CARD_SEL = '.ex-card, .ss-ex, .lift-card';
  var DONE_SEL = '.ex-card.checked, .ss-ex.checked, .lift-card.checked';
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
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]); } catch (e) {}
    beep();
  }

  // ====================================================================== //
  //  WAKE LOCK                                                             //
  // ====================================================================== //
  var wakeLock = null, wantLock = false, acquiring = false;

  function timerRunning() {
    var f = document.getElementById('timerFloat');
    return !!(f && f.classList.contains('visible'));
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
  function syncLock() {
    if (timerRunning()) { wantLock = true; acquire(); }
    else { wantLock = false; release(); }
  }

  // ====================================================================== //
  //  CATCH-UP ALERT                                                        //
  // ====================================================================== //
  // remaining seconds parsed from the page's #timerFloat readout
  function currentRemaining() {
    var t = document.getElementById('timerFloatTime');
    if (!t) return null;
    var s = (t.textContent || '').trim();
    if (/done/i.test(s)) return 0;
    var neg = s.charAt(0) === '+';
    s = s.replace('+', '');
    var secs;
    if (s.indexOf(':') !== -1) {
      var p = s.split(':'); secs = (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    } else {
      secs = parseInt(s, 10);
    }
    if (isNaN(secs)) return null;
    return neg ? -secs : secs;
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
      if (hideSnap.rem > 0 && elapsed >= hideSnap.rem) buzz();   // ended while away
      hideSnap = null;
    }
    if (wantLock && timerRunning()) acquire();
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
  function progress() {
    return { done: document.querySelectorAll(DONE_SEL).length,
             total: document.querySelectorAll(CARD_SEL).length };
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

  // public read API for the dashboard card
  function computeStreak(days) {
    if (!days) return 0;
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
      return { last: isResumable(a.last) ? a.last : null,
               streak: computeStreak(a.days), trainedToday: !!(a.days && a.days[dayKey()]) };
    }
  };

  // ====================================================================== //
  //  INIT                                                                  //
  // ====================================================================== //
  function init() {
    if (isWorkoutPage()) {
      // any tap primes/unlocks audio so the catch-up beep can play (the rest-timer tap counts)
      document.addEventListener('pointerdown', primeAudio, { passive: true });
      // Watch #timerFloat.visible via MutationObserver (event-driven, replaces
      // the former 1s setInterval poll). A 250ms debounce absorbs any rapid
      // class mutations during the countdown without missing the visible toggle.
      var _syncDbt = null;
      function debounceSync() { clearTimeout(_syncDbt); _syncDbt = setTimeout(syncLock, 250); }
      function watchFloat() {
        var f = document.getElementById('timerFloat');
        if (f) {
          new MutationObserver(debounceSync).observe(f, { attributes: true, attributeFilter: ['class'] });
        } else {
          var ins = new MutationObserver(function () {
            var el = document.getElementById('timerFloat');
            if (!el) return;
            ins.disconnect();
            new MutationObserver(debounceSync).observe(el, { attributes: true, attributeFilter: ['class'] });
            syncLock();
          });
          ins.observe(document.body, { childList: true, subtree: true });
        }
      }
      watchFloat();
      syncLock();
      window.addEventListener('pagehide', logSession);
      document.addEventListener('visibilitychange', function () { document.hidden ? onHide() : onShow(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
