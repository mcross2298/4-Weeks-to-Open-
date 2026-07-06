/* ==========================================================================
   mc-global-search.js — global search overlay (Tier 4 Phase 4)
   --------------------------------------------------------------------------
   Searches across MC_PM_DATA.programs (mc-pm-data.js) and window.EXERCISES
   (exercise-catalog.js) from a single overlay reachable via the dashboard
   topbar's search icon. Token-based substring scoring, same shape as
   mc-macros.js's tokenFilter()/queryTokens() but tuned for this catalog:
   single-token queries ("squat") are the common case here, so — unlike
   mc-macros' short-circuit for length<=1 — a single token still filters.
   Program results link to their own page; exercise results deep-link into
   exercise-library.html?q=<name> (that page reads ?q= to pre-fill its own
   search box — see the _urlQuery read near the bottom of its inline script).
   ========================================================================== */
(function () {
  if (window.MC_GLOBAL_SEARCH) return;

  var MAX_PROGRAMS = 5;
  var MAX_EXERCISES = 15;

  function queryTokens(q) { return (q || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean); }

  function score(hay, tokens) {
    return tokens.filter(function (t) { return hay.indexOf(t) >= 0; }).length;
  }

  function threshold(tokens) { return tokens.length >= 4 ? tokens.length : Math.ceil(tokens.length / 2); }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }

  function search(q) {
    var tokens = queryTokens(q);
    if (!tokens.length) return { programs: [], exercises: [] };
    var min = threshold(tokens);

    var programs = [];
    (window.MC_PM_DATA ? MC_PM_DATA.programs : []).forEach(function (p) {
      var hay = ((p.name || '') + ' ' + (p.desc || '') + ' ' + (p.meta || '')).toLowerCase();
      var s = score(hay, tokens);
      if (s >= min) programs.push({ s: s, name: p.name, sub: p.meta, href: p.href, icon: p.icon || '🏋️' });
    });
    programs.sort(function (a, b) { return b.s - a.s || a.name.localeCompare(b.name); });

    var exercises = [];
    (window.EXERCISES || []).forEach(function (e) {
      var hay = ((e.name || '') + ' ' + (e.muscle || '') + ' ' + (e.equipment || '') + ' ' + (e.movement || '')).toLowerCase();
      var s = score(hay, tokens);
      if (s >= min) exercises.push({ s: s, name: e.name, sub: [e.muscle, e.equipment].filter(Boolean).join(' · '), href: 'exercise-library.html?q=' + encodeURIComponent(e.name) });
    });
    exercises.sort(function (a, b) { return b.s - a.s || a.name.localeCompare(b.name); });

    return { programs: programs.slice(0, MAX_PROGRAMS), exercises: exercises.slice(0, MAX_EXERCISES) };
  }

  // ---- overlay ----------------------------------------------------------
  var overlay, input, results;

  function row(icon, name, sub, href) {
    return '<a class="mcgs-row" href="' + esc(href) + '">' +
      '<span class="mcgs-row-ico">' + icon + '</span>' +
      '<span class="mcgs-row-body"><span class="mcgs-row-name">' + esc(name) + '</span>' +
      (sub ? '<span class="mcgs-row-sub">' + esc(sub) + '</span>' : '') + '</span></a>';
  }

  function renderSection(label, items, icon) {
    if (!items.length) return '';
    return '<div class="mcgs-sec-label">' + esc(label) + '</div>' +
      items.map(function (it) { return row(icon, it.name, it.sub, it.href); }).join('');
  }

  function render() {
    var q = input.value.trim();
    if (!q) {
      results.innerHTML = '<div class="mcgs-msg">Search programs and ' + ((window.EXERCISES || []).length) + ' exercises…</div>';
      return;
    }
    var r = search(q);
    if (!r.programs.length && !r.exercises.length) {
      results.innerHTML = '<div class="mcgs-msg">No exact matches — try fewer keywords.</div>';
      return;
    }
    results.innerHTML = renderSection('Programs', r.programs, '🏋️') + renderSection('Exercises', r.exercises, '💪');
  }

  function injectCSS() {
    if (document.getElementById('mcgsCss')) return;
    var st = document.createElement('style');
    st.id = 'mcgsCss';
    st.textContent =
      '.mcgs-overlay{position:fixed;inset:0;z-index:200;background:rgba(5,5,6,0.88);' +
        'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:none;flex-direction:column;}' +
      '.mcgs-overlay.open{display:flex;}' +
      '.mcgs-bar{display:flex;align-items:center;gap:10px;padding:14px 16px;' +
        'padding-top:calc(14px + env(safe-area-inset-top));border-bottom:1px solid rgba(255,255,255,0.08);}' +
      '.mcgs-input{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);' +
        'border-radius:12px;padding:12px 14px;color:#e2e8f0;font-size:16px;font-weight:600;outline:none;' +
        'font-family:inherit;}' +
      '.mcgs-input::placeholder{color:#475569;}' +
      '.mcgs-close{flex-shrink:0;width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.06);' +
        'border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;font-size:16px;display:flex;' +
        'align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.mcgs-results{flex:1;overflow-y:auto;padding:6px 10px calc(20px + env(safe-area-inset-bottom));}' +
      '.mcgs-sec-label{font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;' +
        'color:#475569;padding:14px 10px 6px;}' +
      '.mcgs-row{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:12px;' +
        'text-decoration:none;-webkit-tap-highlight-color:transparent;}' +
      '.mcgs-row:active{background:rgba(255,255,255,0.06);}' +
      '.mcgs-row-ico{font-size:18px;flex-shrink:0;width:28px;text-align:center;}' +
      '.mcgs-row-body{min-width:0;flex:1;}' +
      '.mcgs-row-name{display:block;font-size:14px;font-weight:700;color:#e2e8f0;overflow-wrap:break-word;}' +
      '.mcgs-row-sub{display:block;font-size:12px;color:#64748b;font-weight:600;margin-top:2px;}' +
      '.mcgs-msg{padding:24px 12px;color:#475569;font-size:13px;font-weight:600;text-align:center;}';
    document.head.appendChild(st);
  }

  function build() {
    injectCSS();
    overlay = document.createElement('div');
    overlay.className = 'mcgs-overlay';
    overlay.innerHTML =
      '<div class="mcgs-bar">' +
        '<input class="mcgs-input" id="mcgsInput" type="text" placeholder="Search programs &amp; exercises…" autocomplete="off"/>' +
        '<div class="mcgs-close" id="mcgsClose" role="button" aria-label="Close search" title="Close">✕</div>' +
      '</div>' +
      '<div class="mcgs-results" id="mcgsResults"></div>';
    document.body.appendChild(overlay);
    input = overlay.querySelector('#mcgsInput');
    results = overlay.querySelector('#mcgsResults');
    input.addEventListener('input', render);
    overlay.querySelector('#mcgsClose').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
  }

  function open() {
    if (!overlay) build();
    overlay.classList.add('open');
    render();
    setTimeout(function () { input.focus(); }, 60);
  }

  function close() {
    if (overlay) overlay.classList.remove('open');
  }

  window.MC_GLOBAL_SEARCH = {
    open: open,
    close: close,
    toggle: function () { if (overlay && overlay.classList.contains('open')) close(); else open(); }
  };
})();
