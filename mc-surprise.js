/* ==========================================================================
   mc-surprise.js — shared "Surprise Me" random-workout picker.
   --------------------------------------------------------------------------
   A page opts in by declaring, before this script loads:
     window.MC_SURPRISE = { sel: '<css selector for candidate cards/links>' };
   and dropping a button with the data-mc-surprise attribute in its markup.

   Two-level pages (a split/phase picker that reveals a workout list only
   after a first tap — e.g. cat-pmc.html) add a `group` selector:
     window.MC_SURPRISE = { group: '.split-card-sel', sel: '.workout-card' };
   fire() clicks a random group first, then a random target — this only
   works because every program here re-renders its target list synchronously
   (plain innerHTML swap, not an async fetch).

   Clicking the picked element (rather than reading its href and navigating)
   is what lets one module serve both plain `<a href>` program pages and the
   in-page `onclick="showWorkout(id)"` SPA-style pages (Strength, PMC) with
   no per-page special-casing beyond the selector itself.

   The button hides itself when there's nothing to be "surprised" by (fewer
   than 2 real destinations, or a coming-soon placeholder card).
   ========================================================================== */
(function () {
  if (window.__mcSurprise) return;
  window.__mcSurprise = true;

  function isEnabled(el) {
    if (!el) return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (/\b(soon|disabled|locked)\b/i.test(el.className || '')) return false;
    if (el.tagName === 'A') return !!el.getAttribute('href');
    // non-link cards (onclick="showWorkout(...)") — "coming soon" placeholders
    // render with no handler at all, so require one to be present.
    return el.hasAttribute('onclick') || typeof el.onclick === 'function';
  }

  function candidates(sel) {
    if (!sel) return [];
    return Array.prototype.filter.call(document.querySelectorAll(sel), isEnabled);
  }

  function pick(list) {
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function fire() {
    var cfg = window.MC_SURPRISE;
    if (!cfg || !cfg.sel) return;
    if (cfg.group) {
      var g = pick(candidates(cfg.group));
      if (!g) return;
      g.click();
    }
    var target = pick(candidates(cfg.sel));
    if (target) target.click();
  }

  function init() {
    var btn = document.querySelector('[data-mc-surprise]');
    var cfg = window.MC_SURPRISE;
    if (!btn || !cfg || !cfg.sel) { if (btn) btn.style.display = 'none'; return; }
    // group pages: the sel list doesn't exist until a group is opened, so
    // gate on having at least one group instead of counting sel up front.
    var enough = cfg.group ? candidates(cfg.group).length >= 1 : candidates(cfg.sel).length >= 2;
    if (!enough) { btn.style.display = 'none'; return; }
    btn.addEventListener('click', fire);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
