/* Where a tapped push opens, decided from its `type`. One copy, loaded by the
   service worker (importScripts in sw.js) and by tools/test-mc-push-route.js,
   so the routing the test checks is the routing a phone gets
   (settings-pathways-roadmap.md, SP1).

   An unknown type, or none, opens Home: that is what every push did before
   types existed, so a push from an Edge Function not yet redeployed behaves
   exactly as it always has. A PR fires mid-session, so its tap focuses a
   window that is already open rather than navigating it away from the
   workout. */
(function (root) {
  'use strict';
  var HOME = 'dashboard.html';
  var ROUTES = {
    pr: { url: 'workout-logs.html', keepOpen: true, stack: true },
    checkin: { url: 'stats.html' },
    streak: { url: HOME }
  };

  function route(payload) {
    var p = payload && typeof payload === 'object' ? payload : {};
    var r = typeof p.type === 'string' && Object.prototype.hasOwnProperty.call(ROUTES, p.type) ? ROUTES[p.type] : null;
    return r ? { type: p.type, url: r.url, keepOpen: !!r.keepOpen } : { type: null, url: HOME, keepOpen: false };
  }

  // A notification with the same tag REPLACES the one before it. That is right
  // for a check-in or a streak (only the newest matters) and wrong for records:
  // three PRs in one session used to leave one notification. A `stack` type
  // gets a tag of its own per push (council audit cleanup).
  var seq = 0;
  function tag(payload) {
    var t = route(payload).type;
    if (!t) return 'mc-milestone';
    if (ROUTES[t].stack) return 'mc-' + t + '-' + Date.now().toString(36) + '-' + (seq++);
    return 'mc-' + t;
  }

  root.MC_PUSH_ROUTE = { route: route, tag: tag, TYPES: Object.keys(ROUTES) };
})(typeof self !== 'undefined' ? self : this);
