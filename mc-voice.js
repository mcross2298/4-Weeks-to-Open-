/* ==========================================================================
   mc-voice.js — opt-in voice control for workout pages (roadmap 4.4)
   --------------------------------------------------------------------------
   Off by default — a trainee has to tap the floating 🎙️ button once to grant
   mic permission and start listening. Lazily injected by mc-card-actions.js
   on every workout page (same pattern as mc-biomech.js/exercise-catalog.js),
   so there's zero per-page HTML to hand-write.

   Small, fixed command grammar rather than free-form parsing — this needs to
   work instantly and offline mid-set, not round-trip an LLM:
     "log <N> reps"          -> fills + checks off the next open set
     "start timer" / "start rest" -> starts the next idle rest timer
     "stop timer" / "skip rest" / "done resting" -> TMR.stop()

   Reuses the EXISTING DOM/click paths (mc-setlog.js's checkbox handler,
   makeRestTimer's onclick, mc-timer.js's TMR) instead of duplicating any
   logging/timer logic — this file only finds the right element and either
   dispatches real input/click events on it or calls the already-global TMR.

   Exposes window.MCVoice:
     isSupported()  -> bool
     getState()     -> 'unsupported' | 'off' | 'listening'
     toggle()       -> flips on/off (persisted in mc_voice_v1)
   ========================================================================== */
(function () {
  'use strict';
  if (window.MCVoice) return;

  var KEY = 'mc_voice_v1';
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function isSupported() { return !!SR; }

  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writePrefs(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {}
  }

  var recognition = null;
  var listening = false;
  var userStopped = false; // true once the trainee taps off — stops auto-restart

  // ---- toast (small confirmation bubble, mirrors mc-macros.js's pattern) ---
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('mcVoiceToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mcVoiceToast';
      t.className = 'mc-voice-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // ---- command handlers ------------------------------------------------
  // Prefer the actively-focused card (setActiveCard in mc-setlog.js marks
  // .active); fall back to the first open set on the page.
  function nextOpenSetCheckbox() {
    return document.querySelector('.ex-card.active .mcl-ck:not(.done), .ss-ex.active .mcl-ck:not(.done)') ||
      document.querySelector('.mcl-ck:not(.done)');
  }
  function logReps(n) {
    var ck = nextOpenSetCheckbox();
    if (!ck) { toast('No open set to log'); return; }
    var row = ck.closest('.mcl-row');
    var r = row && row.querySelector('.mcl-r');
    if (r) {
      r.value = String(n);
      r.dispatchEvent(new Event('input', { bubbles: true }));
    }
    ck.click(); // reuses mc-setlog.js's real check handler — same as a tap
    toast('Logged ' + n + ' rep' + (n === 1 ? '' : 's'));
  }

  function nextIdleTimer() {
    return document.querySelector('.ex-card.active .rest-timer.idle, .ss-ex.active .rest-timer.idle') ||
      document.querySelector('.rest-timer.idle');
  }
  function startTimer() {
    var el = nextIdleTimer();
    if (!el) { toast('No rest timer to start'); return; }
    el.click(); // reuses makeRestTimer's own onclick (buildTimerFloat + TMR.toggle)
    toast('Rest timer started');
  }

  function stopTimer() {
    if (typeof TMR === 'undefined' || TMR.startTime == null) { toast('No timer running'); return; }
    TMR.stop();
    toast('Rest timer stopped');
  }

  var COMMANDS = [
    { re: /\blog\s+(\d+)\s*reps?\b/i, run: function (m) { logReps(parseInt(m[1], 10)); } },
    { re: /\b(start|begin)\s+(the\s+)?(rest\s+)?timer\b|\bstart\s+rest\b/i, run: function () { startTimer(); } },
    { re: /\b(stop|skip|cancel|done)\s+(the\s+)?(rest\s+)?(timer|resting)\b|\bskip\s+rest\b/i, run: function () { stopTimer(); } }
  ];

  function handleTranscript(text) {
    text = (text || '').trim();
    if (!text) return;
    for (var i = 0; i < COMMANDS.length; i++) {
      var m = text.match(COMMANDS[i].re);
      if (m) { COMMANDS[i].run(m); return; }
    }
    // Unrecognized — stay silent rather than nagging on every ambient phrase.
  }

  // ---- recognition lifecycle --------------------------------------------
  function buildRecognition() {
    var r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.lang = 'en-US';
    r.onresult = function (ev) {
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) handleTranscript(ev.results[i][0].transcript);
      }
    };
    r.onerror = function (ev) {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        userStopped = true;
        setListening(false);
        toast('Microphone permission denied');
      }
      // other errors (no-speech, network) are transient — onend restarts below
    };
    r.onend = function () {
      if (!userStopped) {
        try { r.start(); } catch (e) {} // continuous mode still drops on mobile Safari; just resume
      } else {
        setListening(false);
      }
    };
    return r;
  }

  function setListening(on) {
    listening = on;
    var btn = document.getElementById('mcVoiceBtn');
    if (btn) btn.classList.toggle('listening', on);
  }

  function start() {
    if (!isSupported()) return;
    userStopped = false;
    if (!recognition) recognition = buildRecognition();
    try { recognition.start(); setListening(true); toast('Voice control on'); }
    catch (e) { /* already started — ignore */ }
  }
  function stop() {
    userStopped = true;
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    setListening(false);
    toast('Voice control off');
  }

  function toggle() {
    var p = readPrefs();
    if (listening) { stop(); p.enabled = false; }
    else { start(); p.enabled = true; }
    writePrefs(p);
  }

  function getState() {
    if (!isSupported()) return 'unsupported';
    return listening ? 'listening' : 'off';
  }

  // ---- floating toggle button --------------------------------------------
  function mountButton() {
    if (!isSupported() || document.getElementById('mcVoiceBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'mcVoiceBtn';
    btn.className = 'mc-voice-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle voice control');
    btn.title = 'Voice control — try "log 10 reps", "start timer", "skip rest"';
    btn.textContent = '🎙️';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);

    var st = document.createElement('style');
    st.textContent =
      '.mc-voice-btn{position:fixed;right:16px;bottom:calc(90px + env(safe-area-inset-bottom));' +
        'width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,0.14);' +
        'background:rgba(20,20,20,0.92);backdrop-filter:blur(10px);color:#fff;font-size:20px;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:98;' +
        'box-shadow:0 4px 16px rgba(0,0,0,0.4);transition:box-shadow 0.2s,border-color 0.2s;}' +
      '.mc-voice-btn.listening{border-color:rgba(248,113,113,0.6);box-shadow:0 0 0 4px rgba(248,113,113,0.15),0 4px 16px rgba(0,0,0,0.4);}' +
      '.mc-voice-toast{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));' +
        'transform:translate(-50%,10px);background:#0e0e0e;color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:12px;padding:10px 16px;font-size:13px;font-weight:700;z-index:99;' +
        'opacity:0;pointer-events:none;transition:opacity 200ms,transform 200ms;white-space:nowrap;}' +
      '.mc-voice-toast.show{opacity:1;transform:translate(-50%,0);}' +
      '@media (prefers-reduced-motion: reduce){.mc-voice-btn,.mc-voice-toast{transition:none;}}';
    document.head.appendChild(st);
  }

  document.addEventListener('DOMContentLoaded', function () {
    mountButton();
    if (readPrefs().enabled) start(); // resume across page navigations if left on
  });
  if (document.readyState !== 'loading') { mountButton(); if (readPrefs().enabled) start(); }

  window.MCVoice = { isSupported: isSupported, getState: getState, toggle: toggle };
})();
