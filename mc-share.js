/* ==========================================================================
   mc-share.js — share custom programs & workouts as links (Horizon 3)
   --------------------------------------------------------------------------
   The whole payload travels IN the link (base64url JSON in the URL hash), so
   sharing needs no server, works offline-to-offline, and nothing is ever
   uploaded: send the link over any channel, the receiver opens import.html
   which previews and imports it on their device.

     MCShare.shareProgram(prog)   from cat-custom.html
     MCShare.shareWorkout(wk)     from build-workout.html
     MCShare.decode(hash)         used by import.html

   Uses the native share sheet when available, clipboard otherwise.
   ========================================================================== */
(function () {
  if (window.MCShare) return;

  var VERSION = 1;

  // unicode-safe base64url
  function b64e(s) {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  function importUrl(type, data) {
    var payload = b64e(JSON.stringify({ t: type, v: VERSION, d: data }));
    var dir = location.href.split('#')[0].replace(/[^/]*$/, '');
    return dir + 'import.html#' + payload;
  }

  function decode(hash) {
    try {
      var o = JSON.parse(b64d(String(hash || '').replace(/^#/, '')));
      if (!o || o.v !== VERSION || (o.t !== 'program' && o.t !== 'workout') || !o.d) return null;
      return o;
    } catch (e) { return null; }
  }

  function deliver(url, title) {
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    var done = function () { alert('🔗 Link copied — send it to anyone with the app.\nThey open it and tap Import.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { prompt('Copy this link:', url); });
    } else {
      prompt('Copy this link:', url);
    }
  }

  window.MCShare = {
    decode: decode,
    shareProgram: function (p) {
      // strip volatile fields — the receiver gets a fresh identity on import
      var d = { name: p.name, icon: p.icon, color: p.color, weeks: p.weeks, days: p.days };
      deliver(importUrl('program', d), 'MC Training program: ' + p.name);
    },
    shareWorkout: function (w) {
      var d = { name: w.name, exercises: w.exercises };
      deliver(importUrl('workout', d), 'MC Training workout: ' + w.name);
    }
  };
})();
