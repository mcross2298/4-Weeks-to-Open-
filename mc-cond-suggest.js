/* mc-cond-suggest.js — surfaces a "Suggested for you" chip on program pages'
   Day 5/6/7 conditioning cards, based on real completion history instead of
   a plain static "Browse Conditioning Corner" link with zero recommendation
   logic. Reuses mc-cond.js's existing 'mc_cond_log_v1' store (the same
   append-only result log the routine pages' "🏁 Log result" button writes
   to) rather than inventing a second, competing history store.

   Portable by design: targets any dashboard.html?tab=conditioning link
   regardless of a program page's own day-card markup (three different
   shapes exist across program pages today), so it needs no changes to each
   page's own renderDay function. Requires conditioning-data.js (CONDITIONING)
   and mc-cond.js (window.MCCond) to be loaded first. */
(function () {
  if (window.__mcCondSuggest) return;
  window.__mcCondSuggest = true;

  function flatRoutines() {
    var out = [];
    try {
      (CONDITIONING.subcategories || []).forEach(function (sub) {
        if (sub.type !== 'routines') return;
        (sub.routines || []).forEach(function (r) { out.push({ id: r.id, name: r.name, href: r.href }); });
      });
    } catch (e) {}
    return out;
  }

  // Last-done ISO date per routine (from MCCond.all), or null if never done.
  function lastDoneDate(routineId) {
    var entries = window.MCCond.all(routineId);
    var latest = null;
    entries.forEach(function (e) {
      if (!latest || e.date > latest) latest = e.date;
    });
    return latest;
  }

  // Suggest the routine never done, else the one done longest ago.
  function suggest(routines) {
    if (!routines.length) return null;
    var never = routines.filter(function (r) { return !lastDoneDate(r.id); });
    if (never.length) return { routine: never[0], date: null };
    var best = routines[0], bestDate = lastDoneDate(best.id) || '';
    routines.forEach(function (r) {
      var d = lastDoneDate(r.id) || '';
      if (d < bestDate) { best = r; bestDate = d; }
    });
    return { routine: best, date: bestDate || null };
  }

  function injectCss() {
    if (document.getElementById('mcCondSuggestCss')) return;
    var st = document.createElement('style');
    st.id = 'mcCondSuggestCss';
    st.textContent =
      '.mc-cond-suggest-chip{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
        'background:rgba(217,119,6,0.14);border:1px solid rgba(217,119,6,0.4);border-radius:12px;' +
        'padding:12px 16px;margin:6px 0;text-decoration:none;}' +
      '.mc-cond-suggest-txt{min-width:0;}' +
      '.mc-cond-suggest-lbl{display:block;font-size:10px;font-weight:900;letter-spacing:0.1em;' +
        'text-transform:uppercase;color:#fbbf24;}' +
      '.mc-cond-suggest-name{display:block;font-size:14px;font-weight:800;color:#fff;margin-top:2px;' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mc-cond-suggest-ico{font-size:18px;color:#fbbf24;flex-shrink:0;}';
    document.head.appendChild(st);
  }

  function inject() {
    if (typeof CONDITIONING === 'undefined' || !window.MCCond) return;
    var routines = flatRoutines();
    if (!routines.length) return;
    var pick = suggest(routines);
    if (!pick) return;

    var links = document.querySelectorAll('a[href^="dashboard.html?tab=conditioning"]');
    if (!links.length) return;
    injectCss();
    Array.prototype.forEach.call(links, function (a) {
      if (a.dataset.mcCondChip) return;
      a.dataset.mcCondChip = '1';
      var chip = document.createElement('a');
      chip.href = pick.routine.href;
      chip.className = 'mc-cond-suggest-chip';
      chip.innerHTML =
        '<div class="mc-cond-suggest-txt">' +
          '<span class="mc-cond-suggest-lbl">' + (pick.date ? 'Suggested — haven’t done this one in a while' : 'Suggested — new for you') + '</span>' +
          '<span class="mc-cond-suggest-name">' + pick.routine.name + '</span>' +
        '</div>' +
        '<span class="mc-cond-suggest-ico">→</span>';
      a.parentNode.insertBefore(chip, a);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
  // Some program pages render day cards asynchronously after DOMContentLoaded.
  setTimeout(inject, 500);
  setTimeout(inject, 1500);
})();
