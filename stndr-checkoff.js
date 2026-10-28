/* ==========================================================================
   stndr-checkoff.js — per-exercise check-off for the STNDR programs
   --------------------------------------------------------------------------
   The STNDR programs (weeks-to-open, bro-split, push-pull-legs, legacy-prep)
   render collapsible day-cards whose exercises had no check-off — so the live
   Workout Summary (mc-summary.js) could never move past 0%. This adds the same
   tap-to-complete behaviour every other program has:

     • tapping the card body toggles completion
     • NO checkbox glyph. This module used to prepend an inline ✓ span as the
       first child of .ex-name. It was never visible: base.css hides
       .stndr-ck on .a-card, which is what all 191 cards on these four pages
       render as — completion already reads as the struck-through name and the
       dimmed card. But mc-setlog.js takes .ex-name's textContent as the
       exercise's IDENTITY (its history key and its Supabase max-weight
       lookup), so the invisible glyph was slugged into that key
       ("x-\u2713incline-db-press") on 191 of 266 cards. Nothing may render
       inside a name element; card-header decoration belongs in .a-head, where
       program-overrides.js puts its superset leg label.
       tools/test-mc-exercise-identity.js asserts this on all four pages.
     • taps on the ⋮ menu, editable fields, rest timers, the day header and
       every logger control are ignored (they keep their own behaviour)
     • an exercise whose every logged set is ticked reads as done whatever
       this module's own tap record says
     • state is keyed by  pid | active-tab | day-index | exercise-index  so it
       survives the page's frequent re-renders (tab switch, inline edits) and
       persists across reloads via localStorage

   Toggling the `.checked` class is all mc-summary.js needs to light up the
   live progress bar and Sets/Reps-Done totals for the current day.

   Self-contained IIFE. Only loaded by the STNDR pages.
   ========================================================================== */
(function () {
  if (window.__stndrCheckoff) return;
  window.__stndrCheckoff = true;

  var LS = 'stndr_checks_v1';
  var PID = location.pathname.split('/').pop().replace('.html', '') || 'stndr';
  // clicks on these never toggle completion. The page-specific part stays
  // here; the logger's controls come from mc-setlog.js's MC_CARD_TAP_IGNORE,
  // read at click time. Without it a tap on the Log Sets strip or the
  // coaching-note button also checked the exercise off (QA collision audit).
  var IGNORE_SEL = '.mc-meatball, .mc-menu-overlay, .mc-note, .editable, .rest-timer, .day-toggle, .day-header, .tab, input, textarea, [contenteditable="true"]';
  function ignored(t) {
    return t.closest(IGNORE_SEL) ||
      t.closest(window.MC_CARD_TAP_IGNORE || 'button,a,select');
  }

  var store;
  try { store = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { store = {}; }
  function bag() { return store[PID] || (store[PID] = {}); }
  function persist() { try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {} }

  function activeTab() {
    var t = document.querySelector('.tab.active, .tab.selected');
    return t ? (t.textContent || '').trim() : '';
  }
  function keyFor(card) {
    var day = card.closest('.day-card');
    var d = day ? (day.getAttribute('data-d') || '') : '';
    var nameEl = card.querySelector('.editable[data-field="name"]');
    var e = nameEl ? (nameEl.getAttribute('data-e') || '') : '';
    if (e === '') {
      var holder = card.parentElement;
      if (holder) e = Array.prototype.indexOf.call(holder.querySelectorAll('.ex-card'), card);
    }
    return activeTab() + '|' + d + '|' + e;
  }

  function injectStyle() {
    if (document.getElementById('stndr-ck-style')) return;
    var st = document.createElement('style');
    st.id = 'stndr-ck-style';
    st.textContent =
      '.ex-card{cursor:pointer;}' +
      '.ex-card.checked{opacity:0.72;}' +
      '.ex-card.checked .ex-name .editable{text-decoration:line-through;color:#34d399;}';
    document.head.appendChild(st);
  }

  // Every set of the exercise is ticked in mc-setlog.js's logger. That module
  // mirrors it onto .checked itself; decorate() runs on every DOM mutation and
  // used to overwrite it with this module's own tap record, so finishing an
  // exercise set by set never struck it through on these pages.
  function allLogged(card) {
    var cks = card.querySelectorAll('.mcl-ck');
    return cks.length > 0 && card.querySelectorAll('.mcl-ck.done').length === cks.length;
  }

  // reflect saved state on every (re)render
  function decorate() {
    injectStyle();
    var saved = bag();
    document.querySelectorAll('.ex-card').forEach(function (card) {
      // A logger card reads its sets only: its body tap is ignored now, so a
      // mark saved before that change could never be cleared again.
      var logger = card.classList.contains('mcl-host');
      card.classList.toggle('checked', logger ? allLogged(card) : (!!saved[keyFor(card)] || allLogged(card)));
    });
  }

  document.addEventListener('click', function (e) {
    if (ignored(e.target)) return;
    var card = e.target.closest('.ex-card');
    if (!card) return;
    if (allLogged(card)) return;   // done by its sets; untick a set to reopen it
    var k = keyFor(card), saved = bag();
    if (saved[k]) { delete saved[k]; card.classList.remove('checked'); }
    else { saved[k] = 1; card.classList.add('checked'); }
    persist();
  }, true);

  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(decorate, 60); }

  function init() {
    decorate();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setTimeout(decorate, 300);
    setTimeout(decorate, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
