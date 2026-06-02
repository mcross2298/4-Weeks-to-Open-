/* ==========================================================================
   stndr-checkoff.js — per-exercise check-off for the STNDR programs
   --------------------------------------------------------------------------
   The STNDR programs (weeks-to-open, bro-split, push-pull-legs, legacy-prep)
   render collapsible day-cards whose exercises had no check-off — so the live
   Workout Summary (mc-summary.js) could never move past 0%. This adds the same
   tap-to-complete behaviour every other program has:

     • an inline ✓ checkbox prepended to each exercise name
     • tapping the checkbox OR the card body toggles completion
     • taps on the ⋮ menu, editable fields, rest timers and the day header are
       ignored (they keep their own behaviour)
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
  // clicks on these never toggle completion
  var IGNORE_SEL = '.mc-meatball, .mc-menu-overlay, .mc-note, .editable, .rest-timer, .day-toggle, .day-header, .tab, input, textarea, [contenteditable="true"]';

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
      '.ex-card .stndr-ck{display:inline-flex;align-items:center;justify-content:center;' +
        'width:18px;height:18px;min-width:18px;border-radius:50%;margin-right:8px;vertical-align:-3px;' +
        'border:2px solid rgba(148,163,184,0.55);background:transparent;color:transparent;' +
        'font-size:11px;font-weight:900;line-height:1;transition:all .15s;-webkit-tap-highlight-color:transparent;}' +
      '.ex-card.checked{opacity:0.72;}' +
      '.ex-card.checked .stndr-ck{background:#16a34a;border-color:#16a34a;color:#fff;}' +
      '.ex-card.checked .ex-name .editable{text-decoration:line-through;color:#34d399;}';
    document.head.appendChild(st);
  }

  // add the checkbox + reflect saved state on every (re)render
  function decorate() {
    injectStyle();
    var saved = bag();
    document.querySelectorAll('.ex-card').forEach(function (card) {
      var nameEl = card.querySelector('.ex-name');
      if (nameEl && !nameEl.querySelector(':scope > .stndr-ck')) {
        var ck = document.createElement('span');
        ck.className = 'stndr-ck';
        ck.textContent = '✓';
        nameEl.insertBefore(ck, nameEl.firstChild);
      }
      card.classList.toggle('checked', !!saved[keyFor(card)]);
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest(IGNORE_SEL)) return;
    var card = e.target.closest('.ex-card');
    if (!card) return;
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
