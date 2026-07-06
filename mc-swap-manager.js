/* ==========================================================================
   mc-swap-manager.js — "My Substitutions" list (stats.html)
   --------------------------------------------------------------------------
   mc-card-actions.js's substitute picker writes swaps into mc_replacements_global
   (applies on every program page) or a page-scoped mc_replacements|<pageId>
   (only when that exercise already had a page-specific override). Until now
   the only trace of an active swap was a small "REPLACED" badge on the card
   itself — no list of what's currently swapped, and no way to undo one once
   the picker's few-second Undo toast has passed. This renders that list and
   lets the user revert any entry, from either store, at any time.

   Also clears the matching mc_swap_accept_v1 learned-ranking entry on revert
   (mc-biomech.js reads it to rank a previously-picked substitute first) so an
   undone swap stops being treated as a preference.
   ========================================================================== */
(function () {
  var GLOBAL_KEY = 'mc_replacements_global';
  var ACCEPT_KEY = 'mc_swap_accept_v1';

  function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; } }
  function writeJSON(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // page-scoped keys look like 'mc_replacements|cat-strength.html'
  function pageScopedKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('mc_replacements|') === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  function programNameForPage(pageId) {
    try {
      var p = window.MC_PM_DATA && MC_PM_DATA.programs.filter(function (x) { return x.href === pageId; })[0];
      if (p) return p.name;
    } catch (e) {}
    return pageId.replace(/\.html$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function allEntries() {
    var out = [];
    var g = readJSON(GLOBAL_KEY);
    Object.keys(g).forEach(function (orig) {
      out.push({ scope: 'global', key: GLOBAL_KEY, orig: orig, replacement: g[orig] });
    });
    pageScopedKeys().forEach(function (storeKey) {
      var pageId = storeKey.slice('mc_replacements|'.length);
      var m = readJSON(storeKey);
      Object.keys(m).forEach(function (orig) {
        out.push({ scope: 'page', key: storeKey, pageId: pageId, orig: orig, replacement: m[orig] });
      });
    });
    return out;
  }

  function revert(entry) {
    var store = readJSON(entry.key);
    delete store[entry.orig];
    writeJSON(entry.key, store);

    // an undone swap shouldn't keep ranking first in the picker
    var accept = readJSON(ACCEPT_KEY);
    var bucket = accept[entry.orig];
    if (bucket) {
      delete bucket[entry.replacement.toLowerCase()];
      if (Object.keys(bucket).length) accept[entry.orig] = bucket; else delete accept[entry.orig];
      writeJSON(ACCEPT_KEY, accept);
    }
    render();
  }

  function titleCase(s) { return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  function render() {
    var card = document.getElementById('subsCard');
    if (!card) return;
    var entries = allEntries();
    if (!entries.length) {
      card.innerHTML = '<div class="empty">No active substitutions — swap an exercise from its menu on any workout page.</div>';
      return;
    }
    entries.sort(function (a, b) { return a.orig.localeCompare(b.orig); });
    card.innerHTML = '<div class="subs-list">' + entries.map(function (e, i) {
      var scopeLabel = e.scope === 'global' ? 'Everywhere' : 'On ' + esc(programNameForPage(e.pageId));
      return '<div class="subs-row">' +
        '<div class="subs-row-main">' +
          '<div class="subs-row-names">' + esc(titleCase(e.orig)) + ' <span class="subs-arrow">&rarr;</span> ' + esc(e.replacement) + '</div>' +
          '<div class="subs-row-scope">' + scopeLabel + '</div>' +
        '</div>' +
        '<button class="subs-revert" type="button" data-idx="' + i + '">Revert</button>' +
      '</div>';
    }).join('') + '</div>';
    card.querySelectorAll('.subs-revert').forEach(function (btn) {
      btn.addEventListener('click', function () { revert(entries[parseInt(btn.dataset.idx, 10)]); });
    });
  }

  function injectCSS() {
    if (document.getElementById('swapMgrCss')) return;
    var st = document.createElement('style');
    st.id = 'swapMgrCss';
    st.textContent =
      '.subs-list{display:flex;flex-direction:column;gap:8px;}' +
      '.subs-row{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,0.06);}' +
      '.subs-row:last-child{border-bottom:none;}' +
      '.subs-row-main{flex:1;min-width:0;}' +
      '.subs-row-names{font-size:13.5px;font-weight:700;color:#f1f5f9;overflow-wrap:break-word;}' +
      '.subs-arrow{color:#64748b;}' +
      '.subs-row-scope{font-size:11px;font-weight:700;color:#94a3b8;margin-top:2px;letter-spacing:0.02em;}' +
      '.subs-revert{flex-shrink:0;font-size:12px;font-weight:800;color:#22d3ee;background:rgba(34,211,238,0.1);' +
        'border:1px solid rgba(34,211,238,0.25);border-radius:8px;padding:7px 12px;cursor:pointer;font-family:inherit;}' +
      '.subs-revert:active{background:rgba(34,211,238,0.2);}';
    document.head.appendChild(st);
  }

  function init() { injectCSS(); render(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
