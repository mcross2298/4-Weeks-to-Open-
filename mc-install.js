/* ==========================================================================
   mc-install.js  —  shared "Add to Home Screen" capture
   --------------------------------------------------------------------------
   Roadmap B4 (cookbook<->workout bridge) — byte-identical shared module in
   both repos, same convention as mc-bridge.js: edit in one, copy to the
   other. Fully app-agnostic (no MC_SB/tracker/workout dependency), so this
   is a straight port, not a bridge-data read.

   Android/Chromium fires `beforeinstallprompt` at most once per session and
   only if a listener was already attached when it fires — so this has to run
   as an early page-load script (before the account sheet is ever opened),
   not lazily inside mc-account.js's openSheet(). It stashes the event and
   exposes a small API for mc-account.js's Install section to consume:

     MC_INSTALL.platform       — 'ios' | 'android' | 'other'
     MC_INSTALL.isInstalled()  — already running standalone (same check as
                                  mc-nav.js's cold-launch detector)
     MC_INSTALL.canPrompt()    — true once a real native prompt is stashed
     MC_INSTALL.prompt()       — shows the native prompt; resolves 'accepted' |
                                  'dismissed' | 'unavailable'
     MC_INSTALL.onChange(fn)   — fn() called if canPrompt()/isInstalled() state
                                  changes after the sheet is already open
   ========================================================================== */
(function () {
  if (window.MC_INSTALL) return;

  var deferredPrompt = null;
  var listeners = [];

  function notify() {
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    notify();
  });

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      // iPadOS 13+ reports as 'MacIntel' but has touch, unlike a real Mac.
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isInstalled() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  window.MC_INSTALL = {
    platform: isIOS() ? 'ios' : (('onbeforeinstallprompt' in window) ? 'android' : 'other'),
    isInstalled: isInstalled,
    canPrompt: function () { return !!deferredPrompt; },
    prompt: function () {
      if (!deferredPrompt) return Promise.resolve('unavailable');
      var p = deferredPrompt;
      deferredPrompt = null;
      p.prompt();
      return p.userChoice.then(function (choice) {
        notify();
        return choice.outcome; // 'accepted' | 'dismissed'
      });
    },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };
})();
