/* mc-surprise.js — adds a "🎲 Surprise Me" button to split program pages.
   Picks a random workout from the page's workout cards and opens it, so users
   can keep it fresh instead of always running the same day. Works on both the
   MC splits (a.wcard links) and the PMC splits (a.workout-card links, which are
   re-rendered on week switch). No-ops on pages without at least 2 workouts. */
(function () {
  function workoutLinks() {
    return Array.prototype.slice
      .call(document.querySelectorAll('a.wcard, a.workout-card'))
      .filter(function (a) {
        var href = (a.getAttribute('href') || '').toLowerCase();
        var txt = (a.textContent || '').toLowerCase();
        // Skip cardio / rest cards — they aren't "workouts" to randomize into.
        return href && !/cardio|rest/.test(href) && !/\bcardio\b|\brest\b/.test(txt);
      });
  }

  function run() {
    var content = document.querySelector('.content');
    if (!content) return;
    if (workoutLinks().length < 2) return; // nothing to randomize

    // Match the page's accent color (pulled from .eyebrow when present).
    var probe = document.querySelector('.eyebrow') || content;
    var c = getComputedStyle(probe).color || 'rgb(56,189,248)';
    var m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
    var rgb = m ? m[1] + ',' + m[2] + ',' + m[3] : '56,189,248';

    if (document.getElementById('mcSurprise')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mcSurprise';
    btn.textContent = '🎲 Surprise Me — Random Workout';
    btn.style.cssText =
      'display:block;width:calc(100% - 32px);max-width:680px;' +
      'margin:18px auto 4px;padding:14px 16px;border-radius:12px;cursor:pointer;' +
      'font-family:inherit;font-weight:900;font-size:14px;letter-spacing:0.04em;' +
      'color:rgb(' + rgb + ');background:rgba(' + rgb + ',0.14);' +
      'border:1px solid rgba(' + rgb + ',0.32);-webkit-tap-highlight-color:transparent;' +
      'transition:transform 0.12s;';
    btn.addEventListener('click', function () {
      var links = workoutLinks();
      if (!links.length) return;
      var pick = links[Math.floor(Math.random() * links.length)];
      var href = pick.getAttribute('href');
      if (href) location.href = href;
    });

    // Insert above the workout list. We place it BEFORE .content so the PMC
    // week-switch re-render (which rewrites #content.innerHTML) leaves it intact.
    content.parentNode.insertBefore(btn, content);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
