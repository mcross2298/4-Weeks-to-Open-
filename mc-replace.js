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
  // Run after render
  if (typeof render === 'function') {
    const origRender = render;
    window.render = function() { origRender.apply(this, arguments); setTimeout(applyReplacements, 100); };
  }
  document.addEventListener('DOMContentLoaded', function() { setTimeout(applyReplacements, 400); });
  // NOTE: "Replace exercise" is now triggered from the meatball (⋮) menu in
  // mc-card-actions.js (Phase 1 consolidation). applyReplacements() above is
  // kept so previously saved replacements still render with their badge.
})();
