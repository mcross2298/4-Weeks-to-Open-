/* ==========================================================================
   mc-pm-layout-editor.js — inline "Edit Layout" sidebar (PM Phase 3)
   --------------------------------------------------------------------------
   Owner-only. Lazy-loaded by program-manager.js when the PM bar's "Edit
   Layout" button is tapped, so normal pages never pay for it.

   Toggles the live view into a draft state and exposes a config sidebar that
   (a) swaps the current view's structural layout style and (b) re-skins the
   global ThemeConfig (preset / accent / typography / density / motion) — all
   with instant preview. Every change writes ONLY the local working copy
   (MC_PO.setLayoutLocal / MC_THEME.setConfig); nothing reaches users until
   "Save & Publish" exports program-overrides.json for commit. "Discard"
   clears the layout/theme working copy and reverts live.

     window.MC_PM_LAYOUT.open() / .close()
   ========================================================================== */
(function () {
  if (window.MC_PM_LAYOUT) return;

  var panel = null, styled = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // accent palette offered in the editor (program colors + a neutral set)
  var ACCENTS = ['#d4af37', '#e11d48', '#7F77DD', '#14b8a6', '#f97316', '#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#eab308'];

  function injectStyles() {
    if (styled) return; styled = true;
    var css =
      '.mcle-back{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1390;opacity:0;transition:opacity .2s;}' +
      '.mcle-back.on{opacity:1;}' +
      '.mcle{position:fixed;top:0;right:0;bottom:0;width:min(360px,88vw);z-index:1400;background:#0d1117;' +
        'border-left:1px solid rgba(255,255,255,0.12);box-shadow:-12px 0 40px rgba(0,0,0,0.5);color:#e2e8f0;' +
        'display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);' +
        'font-family:"Segoe UI",system-ui,sans-serif;}' +
      '.mcle.on{transform:translateX(0);}' +
      '.mcle-hd{display:flex;align-items:center;gap:10px;padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.08);}' +
      '.mcle-hd .t{flex:1;font-size:15px;font-weight:900;color:#fff;}' +
      '.mcle-hd .draft{font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#22d3ee;background:rgba(34,211,238,0.14);border:1px solid rgba(34,211,238,0.3);padding:3px 8px;border-radius:6px;}' +
      '.mcle-x{background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:2px 6px;}' +
      '.mcle-body{flex:1;overflow-y:auto;padding:14px 16px 20px;-webkit-overflow-scrolling:touch;}' +
      '.mcle-sec{font-size:11px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;margin:18px 0 8px;}' +
      '.mcle-sec:first-child{margin-top:4px;}' +
      '.mcle-row{display:flex;flex-wrap:wrap;gap:8px;}' +
      '.mcle-opt{padding:9px 13px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);' +
        'color:#cbd5e1;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
      '.mcle-opt.on{background:var(--accent,#22d3ee);border-color:var(--accent,#22d3ee);color:#03121b;}' +
      '.mcle-sw{width:34px;height:34px;border-radius:9px;border:2px solid rgba(255,255,255,0.18);cursor:pointer;padding:0;}' +
      '.mcle-sw.on{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,0.4);}' +
      '.mcle-hint{font-size:11px;color:#64748b;font-weight:600;line-height:1.5;margin-top:7px;}' +
      '.mcle-ft{display:flex;gap:8px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,0.08);background:#0a0e14;}' +
      '.mcle-ft button{flex:1;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;}' +
      '.mcle-ft .pub{background:#22d3ee;border-color:#22d3ee;color:#03222b;}' +
      '.mcle-ft .disc{color:#f87171;border-color:rgba(248,113,113,0.4);}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  // --- working ThemeConfig (raw, local) ------------------------------------
  function rawTheme() {
    try {
      var doc = JSON.parse(localStorage.getItem('mc_pm_overrides') || '{}');
      var t = doc.themes && doc.themes.global;
      if (t && !t.reset) return JSON.parse(JSON.stringify(t));
    } catch (e) {}
    return {};
  }
  function writeTheme(cfg) {
    // drop empty fields so "unset" truly clears
    var clean = {}; ['preset', 'accent', 'typography', 'density', 'motion'].forEach(function (f) { if (cfg[f]) clean[f] = cfg[f]; });
    if (window.MC_THEME && MC_THEME.setConfig) MC_THEME.setConfig(Object.keys(clean).length ? clean : null);
  }

  // --- option-group helper --------------------------------------------------
  function group(label, opts, current, onPick) {
    var wrap = document.createElement('div');
    var h = document.createElement('div'); h.className = 'mcle-sec'; h.textContent = label; wrap.appendChild(h);
    var row = document.createElement('div'); row.className = 'mcle-row';
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'mcle-opt' + (o.val === current ? ' on' : '');
      b.textContent = o.label;
      b.onclick = function () {
        row.querySelectorAll('.mcle-opt').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        onPick(o.val);
      };
      row.appendChild(b);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function build() {
    injectStyles();
    var back = document.createElement('div'); back.className = 'mcle-back';
    back.onclick = close;
    panel = document.createElement('div'); panel.className = 'mcle';

    var theme = rawTheme();

    var head = document.createElement('div'); head.className = 'mcle-hd';
    head.innerHTML = '<span class="draft">Draft</span><span class="t">Edit Layout &amp; Theme</span>';
    var x = document.createElement('button'); x.className = 'mcle-x'; x.innerHTML = '✕'; x.onclick = close;
    head.appendChild(x);

    var body = document.createElement('div'); body.className = 'mcle-body';

    // 1) Structural layout for the view(s) on THIS page (context-aware).
    // Auto-detected views (program cards, workout) + any the page declares via
    // window.MC_VIEW_SCOPES (e.g. a custom program's landing + split).
    if (window.MC_LAYOUT) {
      var PAGE_ID = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
      var views = [];
      if (document.getElementById('flagGrid')) {
        views.push({ view: 'program-cards', id: '', scope: 'program-cards', label: 'Program Cards layout' });
      }
      if (document.querySelector('.ex-card, .ss-card, .a-card')) {
        views.push({ view: 'workout', id: PAGE_ID, scope: 'workout:' + PAGE_ID, label: 'Workout layout' });
      }
      (window.MC_VIEW_SCOPES || []).forEach(function (s) {
        if (s && s.view && s.id) views.push({ view: s.view, id: s.id, scope: s.view + ':' + s.id, label: s.label || (cap(s.view) + ' layout') });
      });
      views.forEach(function (vw) {
        var cur = MC_LAYOUT.styleFor(vw.view, vw.id);
        var opts = (MC_LAYOUT.OPTIONS[vw.view] || []).map(function (v) {
          return { val: v, label: cap(v).replace('-', ' ') };
        });
        body.appendChild(group(vw.label, opts, cur, function (v) {
          if (window.MC_PO && MC_PO.setLayoutLocal) MC_PO.setLayoutLocal(vw.scope, v);
          if (window.MC_LAYOUT) MC_LAYOUT.repaint();
          document.dispatchEvent(new CustomEvent('mc:layout-changed'));
          refreshBar();
        }));
      });
    }

    if (window.MC_THEME) {
      // 2) Theme preset
      var presets = [{ val: '', label: 'None' }];
      var P = MC_THEME.presets || {};
      Object.keys(P).forEach(function (k) { presets.push({ val: k, label: P[k].name || k }); });
      body.appendChild(group('Theme preset', presets, theme.preset || '', function (v) {
        theme.preset = v || ''; writeTheme(theme); refreshBar();
      }));

      // 3) Accent color
      var aSec = document.createElement('div');
      var ah = document.createElement('div'); ah.className = 'mcle-sec'; ah.textContent = 'Accent color'; aSec.appendChild(ah);
      var aRow = document.createElement('div'); aRow.className = 'mcle-row';
      var none = document.createElement('button'); none.className = 'mcle-opt' + (!theme.accent ? ' on' : ''); none.textContent = 'Auto';
      none.onclick = function () { theme.accent = ''; writeTheme(theme); rebuild(); };
      aRow.appendChild(none);
      ACCENTS.forEach(function (hex) {
        var sw = document.createElement('button');
        sw.className = 'mcle-sw' + (theme.accent === hex ? ' on' : '');
        sw.style.background = hex;
        sw.onclick = function () { theme.accent = hex; writeTheme(theme); rebuild(); };
        aRow.appendChild(sw);
      });
      aSec.appendChild(aRow);
      body.appendChild(aSec);

      // 4) Typography
      body.appendChild(group('Typography', [
        { val: '', label: 'Clean Sans' }, { val: 'athletic', label: 'Athletic Bold' }
      ], theme.typography || '', function (v) { theme.typography = v; writeTheme(theme); refreshBar(); }));

      // 5) Density
      body.appendChild(group('Density', [
        { val: '', label: 'Default' }, { val: 'compact', label: 'Compact' }, { val: 'spacious', label: 'Spacious' }
      ], theme.density || '', function (v) { theme.density = v; writeTheme(theme); refreshBar(); }));

      // 6) Motion
      body.appendChild(group('Motion', [
        { val: '', label: 'Full' }, { val: 'subtle', label: 'Subtle' }, { val: 'off', label: 'Off' }
      ], theme.motion || '', function (v) { theme.motion = v; writeTheme(theme); refreshBar(); }));

      var hint = document.createElement('div'); hint.className = 'mcle-hint';
      hint.innerHTML = 'Theme applies to app chrome globally. Surface colors come from the chosen preset.';
      body.appendChild(hint);
    } else {
      var no = document.createElement('div'); no.className = 'mcle-hint';
      no.innerHTML = 'Theme controls need the theme engine — open this from the dashboard or another shared-chrome page.';
      body.appendChild(no);
    }

    var ft = document.createElement('div'); ft.className = 'mcle-ft';
    var disc = document.createElement('button'); disc.className = 'disc'; disc.textContent = 'Discard'; disc.onclick = discard;
    var pub = document.createElement('button'); pub.className = 'pub'; pub.textContent = 'Save & Publish'; pub.onclick = publish;
    ft.appendChild(disc); ft.appendChild(pub);

    panel.appendChild(head); panel.appendChild(body); panel.appendChild(ft);
    document.body.appendChild(back); document.body.appendChild(panel);
    panel._back = back;
    requestAnimationFrame(function () { back.classList.add('on'); panel.classList.add('on'); });
  }

  function rebuild() { // re-render to reflect accent swatch selection
    var wasOpen = !!panel;
    teardown();
    if (wasOpen) build();
  }
  function refreshBar() {
    // nudge the override layer + the PM top pill's unpublished-edit count
    try { if (window.MC_PO && MC_PO.refresh) MC_PO.refresh(); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('mc:layout-changed')); } catch (e) {}
  }

  function publish() {
    // Prefer the instant Supabase publish (same review sheet as the PM bar);
    // fall back to a JSON export where Supabase isn't configured.
    if (window.MC_PM_PUBLISH && window.MC_SB && MC_SB.configured) {
      close();
      window.MC_PM_PUBLISH();
      return;
    }
    if (!window.MC_PO || !MC_PO.exportData) { alert('Override layer not loaded.'); return; }
    var data = MC_PO.exportData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'program-overrides.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    showInfo('Saved program-overrides.json', 'Commit it to the repo root to publish your layout & theme to all users.');
  }

  function discard() {
    if (window.MC_PO) {
      if (MC_PO.setLayoutLocal) MC_PO.setLayoutLocal('program-cards', null);
      if (MC_PO.setThemeLocal) MC_PO.setThemeLocal('global', null);
    }
    if (window.MC_THEME && MC_THEME.apply) MC_THEME.apply();
    if (window.MC_LAYOUT) MC_LAYOUT.repaint();
    refreshBar();
    close();
  }

  // lightweight info modal (program-manager's showModal isn't exported)
  function showInfo(title, bodyHtml) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:1500;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:24px;';
    ov.innerHTML = '<div style="max-width:340px;background:#0d1117;border:1px solid rgba(255,255,255,0.14);border-radius:16px;padding:20px;color:#e2e8f0;font-family:\'Segoe UI\',system-ui,sans-serif;">' +
      '<div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:8px;">' + esc(title) + '</div>' +
      '<div style="font-size:13px;line-height:1.5;color:#cbd5e1;margin-bottom:16px;">' + bodyHtml + '</div>' +
      '<button style="width:100%;padding:11px;border-radius:11px;border:none;background:#22d3ee;color:#03222b;font-size:14px;font-weight:900;cursor:pointer;">OK</button></div>';
    ov.querySelector('button').onclick = function () { ov.remove(); };
    document.body.appendChild(ov);
  }

  function teardown() {
    if (panel && panel._back) panel._back.remove();
    if (panel) panel.remove();
    panel = null;
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('on');
    if (panel._back) panel._back.classList.remove('on');
    var p = panel; panel = null;
    setTimeout(function () { if (p._back) p._back.remove(); p.remove(); }, 220);
  }
  function open() { if (panel) return; build(); }

  window.MC_PM_LAYOUT = { open: open, close: close };
})();
