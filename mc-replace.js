/* mc-replace.js — renders saved exercise replacements (REPLACED badge).
   Replacement itself is triggered from the meatball menu in
   mc-card-actions.js; this module only re-applies saved swaps. */
// ── REPLACE EXERCISE ──
(function() {
  const _PAGE_ID = location.pathname.split('/').pop().split('?')[0];
  const REPLACE_KEY = 'mc_replacements|' + _PAGE_ID;
  // Option-B migration: copy any existing global entries into this page's scoped key
  (function(){
    try{
      var _old = JSON.parse(localStorage.getItem('mc_replacements')||'{}');
      if(Object.keys(_old).length){
        var _scoped = JSON.parse(localStorage.getItem(REPLACE_KEY)||'{}');
        var _merged = Object.assign({}, _old, _scoped);
        localStorage.setItem(REPLACE_KEY, JSON.stringify(_merged));
      }
    }catch(e){}
  }());
  // Swaps made from the meatball menu (mc-card-actions.js) default to a
  // global key so the same exercise substitution follows onto other program
  // pages too; a page-specific entry (this page's REPLACE_KEY) still wins
  // when both exist, so an existing per-page override keeps working.
  const GLOBAL_REPLACE_KEY = 'mc_replacements_global';
  function applyReplacements() {
    var globalReps = JSON.parse(localStorage.getItem(GLOBAL_REPLACE_KEY)||'{}');
    var pageReps = JSON.parse(localStorage.getItem(REPLACE_KEY)||'{}');
    const replacements = Object.assign({}, globalReps, pageReps);
    if (!Object.keys(replacements).length) return;
    document.querySelectorAll('.ex-card, .ex-item, .lift-card').forEach(card => {
      const nameEl = card.querySelector('.ex-name, .lift-name');
      if (!nameEl) return;
      const origName = nameEl.textContent.trim();
      const replacement = replacements[origName.toLowerCase()];
      if (replacement) {
        nameEl.textContent = replacement;
        // Cyan tint + badge styling both come from base.css's --replaced token
        // and .replaced-badge rule (single source of truth; see U4 note there).
        nameEl.style.color = 'var(--replaced)';
        if (!card.querySelector('.replaced-badge')) {
          const badge = document.createElement('span');
          badge.className = 'replaced-badge';
          badge.textContent = 'REPLACED';
          nameEl.parentNode.insertBefore(badge, nameEl.nextSibling);
        }
      }
    });
  }
  // Run after render.
  //
  // This is an ORDERING CONTRACT, not just a feature check (audit G-09): the
  // page's own engine must have defined a global `render` BEFORE this script
  // tag. If it hasn't, the wrapper below is never installed and saved
  // replacements stop re-painting when the page re-renders (switching week
  // tabs, toggling a day) — silently, with no error. The audit verified the
  // ordering holds on all 64 pages that load this module today, but nothing
  // enforced it, so a future page that loads its engine after mc-replace.js
  // would lose the behaviour with no signal.
  //
  // The DOMContentLoaded pass below still paints replacements once, so the
  // failure is partial rather than total — which is exactly what makes it easy
  // to miss. Say so out loud instead.
  if (typeof render === 'function') {
    const origRender = render;
    window.render = function() { origRender.apply(this, arguments); setTimeout(applyReplacements, 100); };
  } else if (document.querySelector('.ex-card, .ss-card')) {
    // Only a page that actually renders exercise cards is expected to have a
    // render(); a static list page (exercise-library.html) legitimately has none.
    console.warn('[mc-replace] no global render() at load time — replacement badges ' +
      'will paint once but not survive a re-render. Load the page engine before mc-replace.js.');
  }
  document.addEventListener('DOMContentLoaded', function() { setTimeout(applyReplacements, 400); });
  // NOTE: "Replace exercise" is now triggered from the meatball (⋮) menu in
  // mc-card-actions.js (Phase 1 consolidation). applyReplacements() above is
  // kept so previously saved replacements still render with their badge.
})();
