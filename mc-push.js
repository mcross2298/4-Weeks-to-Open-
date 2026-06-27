/* ==========================================================================
   mc-push.js — Web Push subscription manager
   --------------------------------------------------------------------------
   Handles permission request, SW push subscription creation, and
   save/remove to Supabase. Exposes window.MC_PUSH:

     MC_PUSH.isSupported()          -> bool
     MC_PUSH.getState()             -> 'unsupported'|'denied'|'granted'|'default'
     MC_PUSH.requestAndSubscribe()  -> Promise<PushSubscription|null>
     MC_PUSH.unsubscribe()          -> Promise<void>
     MC_PUSH.isSubscribed()         -> Promise<bool>
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_PUSH) return;

  // Public VAPID key — safe to ship; private key lives in Supabase secrets only.
  var VAPID_PUBLIC_KEY = 'BDAd608MCA1P97vdbSHkQmUjukDDMLa_iRiRJSMf8asAqHT3jSMTzt2GcO3kQzDwVl1SYB12C8eyI8FjIgMUSJQ';

  function urlBase64ToUint8Array(b64) {
    var padding = '='.repeat((4 - b64.length % 4) % 4);
    var base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function getState() {
    if (!isSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  function isSubscribed() {
    if (!isSupported()) return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) { return !!sub; });
    });
  }

  function requestAndSubscribe() {
    if (!isSupported()) return Promise.resolve(null);
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return null;
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        }).then(function (sub) {
          var raw = sub.toJSON();
          if (window.MC_SB && MC_SB.savePushSubscription) {
            MC_SB.savePushSubscription({
              endpoint: raw.endpoint,
              p256dh: raw.keys && raw.keys.p256dh,
              auth: raw.keys && raw.keys.auth
            }).catch(function () {});
          }
          return sub;
        });
      });
    });
  }

  function unsubscribe() {
    if (!isSupported()) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (!sub) return;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          if (window.MC_SB && MC_SB.deletePushSubscription) {
            MC_SB.deletePushSubscription(endpoint).catch(function () {});
          }
        });
      });
    });
  }

  window.MC_PUSH = {
    isSupported: isSupported,
    getState: getState,
    isSubscribed: isSubscribed,
    requestAndSubscribe: requestAndSubscribe,
    unsubscribe: unsubscribe
  };
})();
