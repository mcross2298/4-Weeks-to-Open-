/* mc-surprise.js — "🎲 Surprise Me" randomizer for workout programs.
   Two program-page models are supported:
     1. Link selectors (a.wcard / a.workout-card) → navigate to a random workout.
        Used by MC splits and PMC splits.
     2. In-page accordions (.day-card[data-d]) → open a random day in place.
        Used by Daily Gainz / legacy day-card programs.
   The button placement matches the MC-favorite-splits implementation (sits above
   the workout list). No-ops unless there are at least 2 workouts to choose from. */
(function () {
  function navLinks() {
    return Array.prototype.slice
      .call(document.querySelectorAll('a.wcard, a.workout-card'))
      .filter(function (a) {
        var h = (a.getAttribute('href') || '').toLowerCase();
        var t = (a.textContent || '').toLowerCase();
        // Real workout links only — skip cardio/rest and hub/landing links.
        if (!h) return false;
        if (/cardio|rest|^index|\/index|cat-|-home|instruction/.test(h)) return false;
        if (/\bcardio\b|\brest\b/.test(t)) return false;
        return true;
      });
  }
  function dayCards() {
    return Array.prototype.slice.call(document.querySelectorAll('.day-card[data-d]'));
  }

  function accent() {
    var probe = document.querySelector('.eyebrow, .program-eyebrow, .back-link') || document.body;
    var c = getComputedStyle(probe).color || 'rgb(56,189,248)';
    var m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
    return m ? m[1] + ',' + m[2] + ',' + m[3] : '56,189,248';
  }

  function run() {
    if (document.getElementById('mcSurprise')) return;

    var mode = 'nav';
    var targets = navLinks();
    if (targets.length < 2) { targets = dayCards(); mode = 'day'; }
    if (targets.length < 2) return; // nothing to randomize

    var rgb = accent();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mcSurprise';
    btn.textContent = '🎲 Surprise Me — Random Workout';
    btn.style.cssText =
      'display:block;width:calc(100% - 32px);max-width:680px;' +
      'margin:18px auto 4px;padding:14px 16px;border-radius:12px;cursor:pointer;' +
      'font-family:inherit;font-weight:900;font-size:14px;letter-spacing:0.04em;' +
      'color:rgb(' + rgb + ');background:rgba(' + rgb + ',0.14);' +
      'border:1px solid rgba(' + rgb + ',0.32);-webkit-tap-highlight-color:transparent;';

    btn.addEventListener('click', function () {
      var links = navLinks();
      if (links.length >= 2) {
        var pick = links[Math.floor(Math.random() * links.length)];
        var href = pick.getAttribute('href');
        if (href) location.href = href;
        return;
      }
      var days = dayCards();
      if (days.length < 2) return;
      var i = Math.floor(Math.random() * days.length);
      var card = days[i];
      var hdr = card.querySelector('.day-header');
      // Open via the page's own toggle (handles single-open + re-render); only
      // click when closed so we never accidentally collapse the pick.
      if (hdr && !card.classList.contains('open')) hdr.click();
      setTimeout(function () {
        var fresh = document.querySelectorAll('.day-card')[i];
        if (fresh) fresh.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });

    // Place above the workout list. For link pages keep the established spot
    // (before .content); for accordions, sit before the day-card container so a
    // re-render on toggle never wipes the button.
    var content = document.querySelector('.content');
    var anchorEl = (mode === 'nav' && content) ? content : targets[0].parentNode;
    if (anchorEl && anchorEl.parentNode) anchorEl.parentNode.insertBefore(btn, anchorEl);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
