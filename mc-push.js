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
     MC_PUSH.enable()               -> Promise<{ok, reason?}>  (Settings switch)
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_PUSH) return;

  // Public VAPID key — safe to ship; private key lives in Supabase secrets only.
  // Rotated 2026-10-26: the old pair's private key was not recoverable, so the
  // server could not sign any push. A device subscribed under the old key is
  // moved onto this one by migrate() below.
  var VAPID_PUBLIC_KEY = 'BPWXv67jiwoE8DAGU1lqtQ5XgyblYMsIDiRaYsGi1MzIZUV3fycwdfsbHtH0DucRAbaTw5CDYQivIuhLzPMul28';
  // The key this device's subscription was made with. A subscription is bound
  // to the key it was created under, and a push signed with any other key is
  // rejected, so a device that subscribed before a rotation must resubscribe.
  // PushSubscription.options.applicationServerKey would say so directly, but
  // not every browser exposes it; recording it here works everywhere.
  var KEY_STORE = 'mc_push_key_v1';

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

  function storedKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function subscribeWith(reg) {
    return reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(function (sub) {
      try { localStorage.setItem(KEY_STORE, VAPID_PUBLIC_KEY); } catch (e) {}
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
  }
  // Drop a subscription made under another key, here and in Supabase. The
  // browser refuses a subscribe() with a new key while the old one exists.
  function dropStale(reg) {
    return reg.pushManager.getSubscription().then(function (sub) {
      if (!sub || storedKey() === VAPID_PUBLIC_KEY) return sub;
      var endpoint = sub.endpoint;
      return sub.unsubscribe().then(function () {
        if (window.MC_SB && MC_SB.deletePushSubscription) {
          MC_SB.deletePushSubscription(endpoint).catch(function () {});
        }
        return null;
      }, function () { return null; });
    });
  }

  function requestAndSubscribe() {
    if (!isSupported()) return Promise.resolve(null);
    return Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') return null;
      return navigator.serviceWorker.ready.then(function (reg) {
        return dropStale(reg).then(function (sub) { return sub || subscribeWith(reg); });
      });
    });
  }

  // A device that already granted permission and subscribed under an older
  // key is moved onto the current one without asking again: permission is
  // per-origin and survives, only the subscription is replaced. A device that
  // never subscribed is left alone.
  function migrate() {
    if (!isSupported() || Notification.permission !== 'granted') return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (!sub || storedKey() === VAPID_PUBLIC_KEY) return null;
        return dropStale(reg).then(function () { return subscribeWith(reg); });
      });
    }).catch(function () { return null; });
  }

  // The Workout Settings switch (2026-10-26). Unlike requestAndSubscribe(),
  // it WAITS for the Supabase save and says how it went, because a
  // subscription that never reached push_subscriptions looks "on" on the
  // phone while the server has nobody to send to. It also re-saves an
  // existing subscription, for a device that subscribed while signed out.
  // Resolves { ok: true } or { ok: false, reason }, reason one of
  // 'unsupported' | 'denied' | 'dismissed' | 'signed-out' | 'error'.
  function enable() {
    if (!isSupported()) return Promise.resolve({ ok: false, reason: 'unsupported' });
    return Notification.requestPermission().then(function (perm) {
      if (perm === 'denied') return { ok: false, reason: 'denied' };
      if (perm !== 'granted') return { ok: false, reason: 'dismissed' };
      return navigator.serviceWorker.ready.then(function (reg) {
        return dropStale(reg).then(function (sub) {
          if (sub) return sub;
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        });
      }).then(function (sub) {
        try { localStorage.setItem(KEY_STORE, VAPID_PUBLIC_KEY); } catch (e) {}
        if (!window.MC_SB || !MC_SB.savePushSubscription) return { ok: false, reason: 'signed-out' };
        var raw = sub.toJSON();
        return MC_SB.savePushSubscription({
          endpoint: raw.endpoint,
          p256dh: raw.keys && raw.keys.p256dh,
          auth: raw.keys && raw.keys.auth
        }).then(function (r) { return r ? { ok: true } : { ok: false, reason: 'signed-out' }; });
      });
    }).catch(function () { return { ok: false, reason: 'error' }; });
  }

  function unsubscribe() {
    if (!isSupported()) return Promise.resolve();
    return navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        if (!sub) return;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          try { localStorage.removeItem(KEY_STORE); } catch (e) {}
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
    unsubscribe: unsubscribe,
    enable: enable,
    migrate: migrate
  };
  // After sign-in has settled, so the new subscription is saved to the account.
  try { setTimeout(migrate, 4000); } catch (e) {}
})();
