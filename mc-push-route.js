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
    pr: { url: 'workout-logs.html', keepOpen: true },
    checkin: { url: 'stats.html' },
    streak: { url: HOME }
  };

  function route(payload) {
    var p = payload && typeof payload === 'object' ? payload : {};
    var r = typeof p.type === 'string' && Object.prototype.hasOwnProperty.call(ROUTES, p.type) ? ROUTES[p.type] : null;
    return r ? { type: p.type, url: r.url, keepOpen: !!r.keepOpen } : { type: null, url: HOME, keepOpen: false };
  }

  function tag(payload) {
    var t = route(payload).type;
    return t ? 'mc-' + t : 'mc-milestone';
  }

  root.MC_PUSH_ROUTE = { route: route, tag: tag, TYPES: Object.keys(ROUTES) };
})(typeof self !== 'undefined' ? self : this);
