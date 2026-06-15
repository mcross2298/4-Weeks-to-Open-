/* ==========================================================================
   mc-pm-inline.js  —  localized inline editing for Program Manager
   --------------------------------------------------------------------------
   Owner-only. Lazy-loaded by program-manager.js when PM mode unlocks, and
   torn down when it locks, so normal users never pay for it.

   Goal: edit elements RIGHT WHERE THEY LIVE instead of through a distant
   settings sheet. While PM is unlocked, a small ✎ pencil appears next to each
   editable surface. Tapping it opens a compact popover anchored to that exact
   spot with:
     • the relevant field(s) — text, and color swatches where applicable,
     • REAL-TIME preview: every keystroke / swatch writes the local working
       copy and repaints in place via the existing override engine (MC_PO /
       mc-naming-paint / mc-layout / mc-theme), so the change renders live in
       context,
     • a localized PUBLISH / SCRAP action state:
         – Publish: pushes ONLY this element straight to Supabase (live for
           everyone), optimistically folds it into the published layer, and
           clears it from the working copy — other pending edits are untouched.
         – Scrap:   discards this element's unpublished edit and reverts live.

   Surfaces (v1):
     • Exercise label   .ex-card/.lift-card  → pages[pageId][cardKey]
     • Badge chip       lb-… / tb-… chips    → badges[progId|badgeId] (label+color)
     • Split header      .hero .title         → splits[progId|origSplit]
     • Program name      #heroName (dashboard)→ programs[progId]
     • Conditioning card .cond-card           → pages['cond'][routineId] (name/tag/meta)
     • Layout & theme    #flagGrid / workout  → layouts[scope] / themes.global
                         + Conditioning Corner → layouts['conditioning']

   The pencil is always inserted as a SIBLING of the text element, never a
   child, so the paint layer's data-mc-orig-* textContent capture stays clean.

     window.MC_PM_INLINE.enable() / .disable()
   ========================================================================== */
(function () {
  if (window.MC_PM_INLINE) return;

  var active = false;
  var pop = null;            // the open popover element (only one at a time)
  var styled = false;
  var ownObserver = null;    // fallback observer when MC_SCAN is unavailable

  // accent palette offered for badge color + theme accent (teal included).
  var ACCENTS = ['#14b8a6', '#d4af37', '#e11d48', '#7F77DD', '#f97316',
                 '#38bdf8', '#34d399', '#f43f5e', '#a855f7', '#eab308'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---- styles --------------------------------------------------------------
  function injectStyles() {
    if (styled) return; styled = true;
    var css =
      '.mcpi-pencil{display:inline-flex;align-items:center;justify-content:center;' +
        'vertical-align:middle;width:22px;height:22px;margin:0 0 0 6px;padding:0;' +
        'border:1px solid rgba(34,211,238,0.45);border-radius:7px;background:rgba(34,211,238,0.12);' +
        'color:#22d3ee;font-size:12px;line-height:1;cursor:pointer;font-family:inherit;' +
        'flex:0 0 auto;-webkit-tap-highlight-color:transparent;position:relative;}' +
      '.mcpi-pencil:hover{background:rgba(34,211,238,0.22);}' +
      '.mcpi-pencil.has-edit{border-color:#f59e0b;background:rgba(245,158,11,0.16);color:#f59e0b;}' +
      '.mcpi-pencil.has-edit::after{content:"";position:absolute;top:-3px;right:-3px;width:7px;height:7px;' +
        'border-radius:50%;background:#f59e0b;border:1px solid #0d1117;}' +
      '.mcpi-chip{display:inline-flex;align-items:center;gap:6px;margin:6px 0;padding:6px 11px;' +
        'border:1px solid rgba(34,211,238,0.45);border-radius:9px;background:rgba(34,211,238,0.1);' +
        'color:#22d3ee;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.mcpi-back{position:fixed;inset:0;z-index:99990;background:transparent;}' +
      '.mcpi-pop{position:fixed;z-index:99991;width:min(290px,92vw);background:#15181d;' +
        'border:1px solid #2c3340;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,0.6);' +
        'color:#e2e8f0;font-family:"Segoe UI",system-ui,sans-serif;overflow:hidden;}' +
      '.mcpi-hd{display:flex;align-items:center;gap:8px;padding:13px 14px 9px;}' +
      '.mcpi-hd .t{flex:1;font-size:13px;font-weight:900;color:#fff;}' +
      '.mcpi-hd .x{background:none;border:none;color:#94a3b8;font-size:17px;cursor:pointer;padding:0 2px;}' +
      '.mcpi-orig{font-size:11px;color:#7b8595;padding:0 14px 8px;line-height:1.4;}' +
      '.mcpi-orig b{color:#cbd5e1;font-weight:700;}' +
      '.mcpi-bd{padding:0 14px 10px;max-height:48vh;overflow-y:auto;-webkit-overflow-scrolling:touch;}' +
      '.mcpi-lbl{display:block;font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;' +
        'color:#7b8595;margin:9px 0 4px;}' +
      '.mcpi-in{width:100%;box-sizing:border-box;background:#0c0f13;border:1px solid #2c3340;border-radius:8px;' +
        'padding:9px 11px;color:#fff;font-size:14px;outline:none;font-family:inherit;}' +
      '.mcpi-in:focus{border-color:#22d3ee;}' +
      'textarea.mcpi-in{resize:vertical;min-height:54px;}' +
      '.mcpi-sw-row{display:flex;flex-wrap:wrap;gap:7px;}' +
      '.mcpi-sw{width:28px;height:28px;border-radius:8px;border:2px solid rgba(255,255,255,0.18);cursor:pointer;padding:0;}' +
      '.mcpi-sw.on{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,0.35);}' +
      '.mcpi-sw.auto{background:#0c0f13;color:#94a3b8;font-size:9px;font-weight:800;}' +
      '.mcpi-opt{padding:7px 11px;border-radius:9px;border:1px solid #2c3340;background:#0c0f13;color:#cbd5e1;' +
        'font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.mcpi-opt.on{background:#22d3ee;border-color:#22d3ee;color:#04222b;}' +
      '.mcpi-grp{font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#7b8595;margin:10px 0 5px;}' +
      '.mcpi-ft{display:flex;align-items:center;gap:8px;padding:10px 14px calc(11px + env(safe-area-inset-bottom));' +
        'border-top:1px solid #232a33;background:#11141a;}' +
      '.mcpi-reset{background:none;border:none;color:#7b8595;font-size:11px;font-weight:700;cursor:pointer;' +
        'padding:0;text-decoration:underline;font-family:inherit;}' +
      '.mcpi-ft .sp{flex:1;}' +
      '.mcpi-scrap,.mcpi-pub{padding:9px 14px;border-radius:10px;border:none;font-size:13px;font-weight:800;' +
        'cursor:pointer;font-family:inherit;}' +
      '.mcpi-scrap{background:#2a2f38;color:#f87171;}' +
      '.mcpi-pub{background:#22d3ee;color:#04222b;}' +
      '.mcpi-pub:disabled{opacity:0.5;cursor:default;}' +
      '.mcpi-toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:99993;' +
        'background:#0c0f13;border:1px solid #2c3340;border-radius:10px;padding:10px 16px;color:#e2e8f0;' +
        'font-family:"Segoe UI",system-ui,sans-serif;font-size:13px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.5);' +
        'opacity:0;transition:opacity .2s;}' +
      '.mcpi-toast.on{opacity:1;}' +
      '.mcpi-toast.ok{border-color:rgba(34,211,238,0.5);}' +
      '.mcpi-toast.err{border-color:rgba(248,113,113,0.5);color:#fca5a5;}';
    var st = document.createElement('style'); st.id = 'mcpi-styles'; st.textContent = css;
    document.head.appendChild(st);
  }

  function toast(text, kind) {
    var t = document.createElement('div');
    t.className = 'mcpi-toast' + (kind ? ' ' + kind : '');
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 250); }, 2200);
  }

  // ---- small shared helpers ------------------------------------------------
  function badgeIdOf(el) {
    var cls = el.className || '';
    if (typeof cls !== 'string') cls = cls.baseVal || '';
    var m = cls.match(/\b((?:lb|tb)-[a-z0-9]+)\b/);
    return m ? m[1] : null;
  }
  function pid() { return window.MC_PO ? MC_PO.pageId : ''; }
  function localDoc() { return (window.MC_PO && MC_PO.local()) || {}; }
  function sbReady() { return !!(window.MC_SB && MC_SB.configured); }
  function logOne(section, scopeId, patch, prev) {
    if (!window.MC_SB || typeof MC_SB.logPublish !== 'function') return;
    try {
      MC_SB.logPublish([{ section: section, scope_id: scopeId,
        action: (patch == null) ? 'remove' : 'upsert',
        patch: patch, prev: prev || null }]).catch(function () {});
    } catch (e) {}
  }
  // nudge program-manager's edit-count pill (it listens to mc:names-changed)
  function nudgeBar() { try { document.dispatchEvent(new CustomEvent('mc:names-changed')); } catch (e) {} }

  // ==========================================================================
  //  Surface specs — each returns an editSpec the popover renders + drives.
  //  An editSpec implements: title, origLabel, fields[], customBody?, preview,
  //  publish, scrap, reset, isPending.
  // ==========================================================================

  // ---- A. exercise label (page tier) --------------------------------------
  function exSpec(card, nameEl) {
    var key = (MC_PO.cardKey ? MC_PO.cardKey(card) : '') || '';
    var orig = card.getAttribute('data-mc-orig-name') || (nameEl.textContent || '').trim();
    function curEntry() { return ((localDoc().pages || {})[pid()] || {})[key] || null; }
    function pubEntry() { return (((MC_PO.published().pages || {})[pid()]) || {})[key] || null; }
    function pubHas() { return !!pubEntry(); }
    var seed = curEntry() || pubEntry() || {};
    if (seed.reset) seed = {};
    return {
      title: 'Edit exercise',
      origLabel: 'Original: <b>' + esc(orig) + '</b>',
      fields: [
        { id: 'name', label: 'Name', type: 'text', value: seed.name || '', placeholder: '(unchanged)' },
        { id: 'sets', label: 'Sets / reps', type: 'text', value: seed.sets || '', placeholder: 'e.g. 4 x 8-10' },
        { id: 'rest', label: 'Rest', type: 'text', value: seed.rest || '', placeholder: 'e.g. 90 sec' },
        { id: 'note', label: 'Note', type: 'textarea', value: seed.note || '', placeholder: '(none)' },
        { id: 'tempo', label: 'Tempo', type: 'text', value: seed.tempo || '', placeholder: 'e.g. 3:0:1:0' }
      ],
      isPending: function () { return !!curEntry(); },
      preview: function (v, doReset) {
        var data = MC_PO.local();
        data.pages = data.pages || {};
        var pg = data.pages[pid()] || (data.pages[pid()] = {});
        if (doReset) {
          if (pubHas()) pg[key] = { reset: true }; else delete pg[key];
        } else {
          var e = {};
          if (v.name) e.name = v.name;
          if (v.sets) e.sets = v.sets;
          if (v.rest) e.rest = v.rest;
          if (v.note) e.note = v.note;
          if (v.tempo) e.tempo = v.tempo;
          if (Object.keys(e).length) pg[key] = e;
          else if (pubHas()) pg[key] = { reset: true };
          else delete pg[key];
        }
        if (!Object.keys(pg).length) delete data.pages[pid()];
        MC_PO.setLocal(data);
      },
      scrap: function () {
        var data = MC_PO.local();
        if (data.pages && data.pages[pid()]) {
          delete data.pages[pid()][key];
          if (!Object.keys(data.pages[pid()]).length) delete data.pages[pid()];
        }
        MC_PO.setLocal(data);
      },
      publish: function () {
        var entry = curEntry();
        var prev = pubEntry();
        var patch = (entry && !entry.reset) ? entry : null;
        var op = patch ? MC_SB.upsert(pid(), key, patch) : MC_SB.remove(pid(), key);
        return op.then(function () {
          var pub = MC_PO.published(); pub.pages = pub.pages || {};
          pub.pages[pid()] = pub.pages[pid()] || {};
          if (patch) pub.pages[pid()][key] = patch; else delete pub.pages[pid()][key];
          this_scrapLocal();
          logOne('pages', pid() + '|' + key, patch, prev);
        });
        function this_scrapLocal() {
          var data = MC_PO.local();
          if (data.pages && data.pages[pid()]) {
            delete data.pages[pid()][key];
            if (!Object.keys(data.pages[pid()]).length) delete data.pages[pid()];
          }
          MC_PO.setLocal(data);
        }
      }
    };
  }

  // ---- A2. conditioning card (Conditioning Corner) ------------------------
  // Reuses the page-override pipeline under a synthetic 'cond' page so no new
  // Supabase section is needed: scope_id = routine id. Fields: name/tag/meta.
  var COND_PAGE = 'cond';
  function condSpec(card, nameEl) {
    var key = card.getAttribute('data-cond-id') || '';
    if (!key) return null;
    var origName = card.getAttribute('data-mc-orig-name') || (nameEl.textContent || '').trim();
    var origTag  = card.getAttribute('data-mc-orig-tag')  || '';
    var origMeta = card.getAttribute('data-mc-orig-meta') || '';
    function curEntry() { return ((localDoc().pages || {})[COND_PAGE] || {})[key] || null; }
    function pubEntry() { return (((MC_PO.published().pages || {})[COND_PAGE]) || {})[key] || null; }
    function pubHas() { return !!pubEntry(); }
    var seed = curEntry() || pubEntry() || {};
    if (seed.reset) seed = {};
    function scrapLocal() {
      var data = MC_PO.local();
      if (data.pages && data.pages[COND_PAGE]) {
        delete data.pages[COND_PAGE][key];
        if (!Object.keys(data.pages[COND_PAGE]).length) delete data.pages[COND_PAGE];
      }
      MC_PO.setLocal(data);
    }
    return {
      title: 'Edit conditioning',
      origLabel: 'Original: <b>' + esc(origName) + '</b>',
      fields: [
        { id: 'name', label: 'Name', type: 'text', value: seed.name || '', placeholder: origName },
        { id: 'tag', label: 'Tag', type: 'text', value: seed.tag || '', placeholder: origTag || '(none)' },
        { id: 'meta', label: 'Description', type: 'textarea', value: seed.meta || '', placeholder: origMeta || '(none)' }
      ],
      isPending: function () { return !!curEntry(); },
      preview: function (v, doReset) {
        var data = MC_PO.local();
        data.pages = data.pages || {};
        var pg = data.pages[COND_PAGE] || (data.pages[COND_PAGE] = {});
        if (doReset) {
          if (pubHas()) pg[key] = { reset: true }; else delete pg[key];
        } else {
          var e = {};
          if (v.name) e.name = v.name;
          if (v.tag) e.tag = v.tag;
          if (v.meta) e.meta = v.meta;
          if (Object.keys(e).length) pg[key] = e;
          else if (pubHas()) pg[key] = { reset: true };
          else delete pg[key];
        }
        if (!Object.keys(pg).length) delete data.pages[COND_PAGE];
        MC_PO.setLocal(data);
      },
      scrap: scrapLocal,
      publish: function () {
        var entry = curEntry();
        var prev = pubEntry();
        var patch = (entry && !entry.reset) ? entry : null;
        var op = patch ? MC_SB.upsert(COND_PAGE, key, patch) : MC_SB.remove(COND_PAGE, key);
        return op.then(function () {
          var pub = MC_PO.published(); pub.pages = pub.pages || {};
          pub.pages[COND_PAGE] = pub.pages[COND_PAGE] || {};
          if (patch) pub.pages[COND_PAGE][key] = patch; else delete pub.pages[COND_PAGE][key];
          scrapLocal();
          logOne('pages', COND_PAGE + '|' + key, patch, prev);
        });
      }
    };
  }

  // ---- generic v2-naming spec (badge / split / program) -------------------
  // section: 'badges'|'splits'|'programs'; scope: supabase scope string.
  // key/subKey address the working-copy doc; scopeId addresses supabase.
  function namingSpec(cfg) {
    // cfg: { section, scope, key, subKey, scopeId, title, orig, fields, build }
    function curEntry() {
      var sec = localDoc()[cfg.section] || {};
      return cfg.subKey !== undefined ? ((sec[cfg.key] || {})[cfg.subKey] || null) : (sec[cfg.key] || null);
    }
    function pubEntry() {
      var sec = (MC_PO.published() || {})[cfg.section] || {};
      return cfg.subKey !== undefined ? ((sec[cfg.key] || {})[cfg.subKey] || null) : (sec[cfg.key] || null);
    }
    function pubHas() { return !!pubEntry(); }
    function writeLocal(patch) {
      if (patch) MC_NAMES.setLocal(cfg.section, cfg.key, patch, cfg.subKey);
      else if (pubHas()) MC_NAMES.setLocal(cfg.section, cfg.key, { reset: true }, cfg.subKey);
      else MC_NAMES.clearLocal(cfg.section, cfg.key, cfg.subKey);
    }
    return {
      title: cfg.title,
      origLabel: cfg.orig,
      fields: cfg.fields,
      isPending: function () { return !!curEntry(); },
      preview: function (v, doReset) {
        if (doReset) { writeLocal(null); if (pubHas()) MC_NAMES.setLocal(cfg.section, cfg.key, { reset: true }, cfg.subKey); return; }
        writeLocal(cfg.build(v));
      },
      scrap: function () { MC_NAMES.clearLocal(cfg.section, cfg.key, cfg.subKey); },
      publish: function () {
        var entry = curEntry();
        var prev = pubEntry();
        var patch = (entry && !entry.reset) ? entry : null;
        var op = patch ? MC_SB.upsertNaming(cfg.scope, cfg.scopeId, patch)
                       : MC_SB.removeNaming(cfg.scope, cfg.scopeId);
        return op.then(function () {
          var pub = MC_PO.published(); var sec = pub[cfg.section] = pub[cfg.section] || {};
          if (cfg.subKey !== undefined) {
            sec[cfg.key] = sec[cfg.key] || {};
            if (patch) sec[cfg.key][cfg.subKey] = patch; else delete sec[cfg.key][cfg.subKey];
          } else {
            if (patch) sec[cfg.key] = patch; else delete sec[cfg.key];
          }
          MC_NAMES.clearLocal(cfg.section, cfg.key, cfg.subKey);
          logOne(cfg.section, cfg.scopeId, patch, prev);
        });
      }
    };
  }

  function badgeSpec(el) {
    var badgeId = badgeIdOf(el);
    var progId = (window.MC_NAMES && MC_NAMES.progOf(pid())) || 'global';
    var orig = el.getAttribute('data-mc-orig-badge') || (el.textContent || '').trim();
    var resolved = (window.MC_NAMES && MC_NAMES.badge(MC_NAMES.progOf(pid()), badgeId)) || {};
    var spec = namingSpec({
      section: 'badges', scope: 'badge', key: progId, subKey: badgeId,
      scopeId: progId + '|' + badgeId,
      title: 'Edit badge',
      orig: 'Original: <b>' + esc(orig) + '</b>',
      fields: [
        { id: 'label', label: 'Label', type: 'text', value: resolved.label || '', placeholder: orig },
        { id: 'color', label: 'Color', type: 'color', value: resolved.color || '' }
      ],
      build: function (v) {
        var p = {};
        if (v.label) p.label = v.label;
        if (v.color) p.color = v.color;
        return Object.keys(p).length ? p : null;
      }
    });
    return spec;
  }

  function splitSpec(titleEl) {
    var progId = MC_NAMES.progOf(pid());
    var canon = MC_NAMES.splitOf(pid());
    var orig = titleEl.getAttribute('data-mc-orig-split') || (titleEl.textContent || '').trim();
    var resolved = MC_NAMES.split(progId, canon) || '';
    return namingSpec({
      section: 'splits', scope: 'split', key: progId, subKey: canon,
      scopeId: progId + '|' + canon,
      title: 'Rename split',
      orig: 'Original: <b>' + esc(orig) + '</b>',
      fields: [
        { id: 'name', label: 'Split name', type: 'text', value: resolved, placeholder: orig }
      ],
      build: function (v) { return v.name ? { name: v.name } : null; }
    });
  }

  function programSpec(heroEl) {
    var progId = window.activeProg && activeProg.id;
    if (!progId) return null;
    var meta = (MC_NAMES.programMeta && MC_NAMES.programMeta(progId)) || {};
    var orig = heroEl.getAttribute('data-mcpi-orig') || (heroEl.textContent || '').trim();
    if (!heroEl.getAttribute('data-mcpi-orig')) heroEl.setAttribute('data-mcpi-orig', orig);
    var descEl = document.getElementById('heroDesc');
    return namingSpec({
      section: 'programs', scope: 'program', key: progId,
      scopeId: progId,
      title: 'Rename program',
      orig: 'Original: <b>' + esc(orig) + '</b>',
      fields: [
        { id: 'name', label: 'Program name', type: 'text', value: meta.name || '', placeholder: orig },
        { id: 'desc', label: 'Description', type: 'textarea', value: meta.desc || '',
          placeholder: descEl ? (descEl.textContent || '').trim() : '(none)' }
      ],
      build: function (v) {
        var p = {};
        if (v.name) p.name = v.name;
        if (v.desc) p.desc = v.desc;
        return Object.keys(p).length ? p : null;
      }
    });
  }

  // ---- E. layout & theme (global-ish surface) -----------------------------
  function layoutViews() {
    var views = [];
    if (!window.MC_LAYOUT) return views;
    var PAGE = pid();
    if (document.getElementById('flagGrid')) {
      views.push({ view: 'program-cards', id: '', scope: 'program-cards', label: 'Program cards' });
    }
    if (document.querySelector('.ex-card, .ss-card, .a-card')) {
      views.push({ view: 'workout', id: PAGE, scope: 'workout:' + PAGE, label: 'Workout' });
    }
    (window.MC_VIEW_SCOPES || []).forEach(function (s) {
      if (s && s.view && s.id) views.push({ view: s.view, id: s.id, scope: s.view + ':' + s.id, label: s.label || s.view });
    });
    return views;
  }
  function rawTheme() {
    try {
      var t = (localDoc().themes || {}).global;
      if (t && !t.reset) return JSON.parse(JSON.stringify(t));
    } catch (e) {}
    return {};
  }
  function writeTheme(cfg) {
    var clean = {}; ['preset', 'accent', 'typography', 'density', 'motion'].forEach(function (f) { if (cfg[f]) clean[f] = cfg[f]; });
    if (window.MC_PO && MC_PO.setThemeLocal) MC_PO.setThemeLocal('global', Object.keys(clean).length ? clean : null);
  }
  function layoutSpec(viewsArg) {
    var views = viewsArg || layoutViews();
    return {
      title: 'Layout & theme',
      origLabel: 'Changes preview live on this page.',
      fields: [],
      isPending: function () {
        var d = localDoc();
        return !!(Object.keys(d.layouts || {}).length || Object.keys(d.themes || {}).length);
      },
      customBody: function (body) {
        // structural layout per detected view
        views.forEach(function (vw) {
          var cur = MC_LAYOUT.styleFor(vw.view, vw.id);
          body.appendChild(optGroup(vw.label + ' layout',
            (MC_LAYOUT.OPTIONS[vw.view] || []).map(function (s) { return { val: s, label: s.replace('-', ' ') }; }),
            cur, function (v) {
              MC_PO.setLayoutLocal(vw.scope, v);
              if (window.MC_LAYOUT) MC_LAYOUT.repaint();
              try { document.dispatchEvent(new CustomEvent('mc:layout-changed')); } catch (e) {}
              refreshPendingDots();
            }));
        });
        if (window.MC_THEME) {
          var theme = rawTheme();
          // accent swatches
          var g = document.createElement('div');
          var h = document.createElement('div'); h.className = 'mcpi-grp'; h.textContent = 'Accent color'; g.appendChild(h);
          var row = document.createElement('div'); row.className = 'mcpi-sw-row';
          var auto = document.createElement('button'); auto.className = 'mcpi-sw auto' + (!theme.accent ? ' on' : ''); auto.textContent = 'Auto';
          auto.onclick = function () { theme.accent = ''; writeTheme(theme); markSw(row, auto); refreshPendingDots(); };
          row.appendChild(auto);
          ACCENTS.forEach(function (hex) {
            var sw = document.createElement('button');
            sw.className = 'mcpi-sw' + (theme.accent === hex ? ' on' : ''); sw.style.background = hex;
            sw.onclick = function () { theme.accent = hex; writeTheme(theme); markSw(row, sw); refreshPendingDots(); };
            row.appendChild(sw);
          });
          g.appendChild(row); body.appendChild(g);
          // density
          body.appendChild(optGroup('Density', [
            { val: '', label: 'Default' }, { val: 'compact', label: 'Compact' }, { val: 'spacious', label: 'Spacious' }
          ], theme.density || '', function (v) { theme.density = v; writeTheme(theme); refreshPendingDots(); }));
        }
        if (!views.length && !window.MC_THEME) {
          var no = document.createElement('div'); no.className = 'mcpi-orig';
          no.style.padding = '6px 0'; no.textContent = 'No layout views on this page.';
          body.appendChild(no);
        }
      },
      preview: function () {},   // handled live inside customBody controls
      scrap: function () {
        var data = MC_PO.local();
        data.layouts = {}; data.themes = {};
        MC_PO.setLocal(data);
        if (window.MC_THEME && MC_THEME.apply) MC_THEME.apply();
        if (window.MC_LAYOUT) MC_LAYOUT.repaint();
      },
      publish: function () {
        var d = MC_PO.local();
        var pub = MC_PO.published();
        var ops = [];
        var lay = d.layouts || {};
        Object.keys(lay).forEach(function (scope) {
          var p = lay[scope];
          var prev = (pub.layouts || {})[scope] || null;
          var patch = (p && !p.reset) ? p : null;
          ops.push((patch ? MC_SB.upsertNaming('layout', scope, patch) : MC_SB.removeNaming('layout', scope))
            .then(function () { pub.layouts = pub.layouts || {}; if (patch) pub.layouts[scope] = patch; else delete pub.layouts[scope];
              logOne('layouts', scope, patch, prev); }));
        });
        var thm = d.themes || {};
        Object.keys(thm).forEach(function (scope) {
          var p = thm[scope];
          var prev = (pub.themes || {})[scope] || null;
          var patch = (p && !p.reset) ? p : null;
          ops.push((patch ? MC_SB.upsertNaming('theme', scope, patch) : MC_SB.removeNaming('theme', scope))
            .then(function () { pub.themes = pub.themes || {}; if (patch) pub.themes[scope] = patch; else delete pub.themes[scope];
              logOne('themes', scope, patch, prev); }));
        });
        if (!ops.length) return Promise.reject(new Error('Nothing to publish'));
        return Promise.all(ops).then(function () {
          var data = MC_PO.local(); data.layouts = {}; data.themes = {}; MC_PO.setLocal(data);
        });
      }
    };
  }

  function optGroup(label, opts, current, onPick) {
    var wrap = document.createElement('div');
    var h = document.createElement('div'); h.className = 'mcpi-grp'; h.textContent = label; wrap.appendChild(h);
    var row = document.createElement('div'); row.className = 'mcpi-sw-row';
    opts.forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'mcpi-opt' + (o.val === current ? ' on' : '');
      b.textContent = o.label;
      b.onclick = function () {
        row.querySelectorAll('.mcpi-opt').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); onPick(o.val);
      };
      row.appendChild(b);
    });
    wrap.appendChild(row); return wrap;
  }
  function markSw(row, on) { row.querySelectorAll('.mcpi-sw').forEach(function (x) { x.classList.remove('on'); }); on.classList.add('on'); }

  // ==========================================================================
  //  Popover — renders an editSpec anchored to a rect, drives live preview.
  // ==========================================================================
  function closePop() {
    if (!pop) return;
    if (pop._back) pop._back.remove();
    pop.remove(); pop = null;
    refreshPendingDots();
  }

  function openPop(spec, anchorRect) {
    closePop();
    var back = document.createElement('div'); back.className = 'mcpi-back';
    back.addEventListener('click', closePop);
    document.body.appendChild(back);

    var el = document.createElement('div'); el.className = 'mcpi-pop';
    var html = '<div class="mcpi-hd"><span class="t">' + esc(spec.title) + '</span>' +
               '<button class="x" data-x="1" aria-label="Close">✕</button></div>';
    if (spec.origLabel) html += '<div class="mcpi-orig">' + spec.origLabel + '</div>';
    html += '<div class="mcpi-bd"></div>' +
            '<div class="mcpi-ft">' +
              '<button class="mcpi-reset" data-reset="1">Reset to original</button>' +
              '<span class="sp"></span>' +
              '<button class="mcpi-scrap" data-scrap="1">Scrap</button>' +
              '<button class="mcpi-pub" data-pub="1">Publish</button>' +
            '</div>';
    el.innerHTML = html;
    var body = el.querySelector('.mcpi-bd');

    var inputs = {};
    (spec.fields || []).forEach(function (f) {
      var lbl = document.createElement('label'); lbl.className = 'mcpi-lbl'; lbl.textContent = f.label; body.appendChild(lbl);
      if (f.type === 'color') {
        var row = document.createElement('div'); row.className = 'mcpi-sw-row';
        var auto = document.createElement('button'); auto.type = 'button';
        auto.className = 'mcpi-sw auto' + (!f.value ? ' on' : ''); auto.textContent = 'Auto';
        auto.addEventListener('click', function () { inputs[f.id] = ''; markSw(row, auto); schedulePreview(); });
        row.appendChild(auto);
        ACCENTS.forEach(function (hex) {
          var sw = document.createElement('button'); sw.type = 'button';
          sw.className = 'mcpi-sw' + (f.value === hex ? ' on' : ''); sw.style.background = hex;
          sw.addEventListener('click', function () { inputs[f.id] = hex; markSw(row, sw); schedulePreview(); });
          row.appendChild(sw);
        });
        body.appendChild(row);
        inputs[f.id] = f.value || '';
      } else if (f.type === 'textarea') {
        var ta = document.createElement('textarea'); ta.className = 'mcpi-in'; ta.value = f.value || '';
        if (f.placeholder) ta.placeholder = f.placeholder;
        ta.addEventListener('input', schedulePreview); body.appendChild(ta); inputs[f.id] = ta;
      } else {
        var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'mcpi-in'; inp.value = f.value || '';
        if (f.placeholder) inp.placeholder = f.placeholder;
        inp.addEventListener('input', schedulePreview); body.appendChild(inp); inputs[f.id] = inp;
      }
    });
    if (spec.customBody) spec.customBody(body);
    // "Reset to original" only applies to field-based specs (text/color)
    if (!spec.fields || !spec.fields.length) {
      var rb = el.querySelector('[data-reset]'); if (rb) rb.style.display = 'none';
    }

    function readValues() {
      var v = {};
      (spec.fields || []).forEach(function (f) {
        v[f.id] = (typeof inputs[f.id] === 'string') ? inputs[f.id] : (inputs[f.id] ? inputs[f.id].value.trim() : '');
      });
      return v;
    }
    var t = null;
    function schedulePreview() { clearTimeout(t); t = setTimeout(function () { try { spec.preview(readValues()); } catch (e) {} }, 140); }

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-x]')) { closePop(); return; }
      if (e.target.closest('[data-reset]')) {
        clearTimeout(t);
        try { spec.preview(readValues(), true); } catch (e2) {}
        (spec.fields || []).forEach(function (f) {
          if (typeof inputs[f.id] !== 'string') inputs[f.id].value = '';
          else inputs[f.id] = '';
        });
        el.querySelectorAll('.mcpi-sw').forEach(function (x) { x.classList.remove('on'); });
        var autoSw = el.querySelector('.mcpi-sw.auto'); if (autoSw) autoSw.classList.add('on');
        toast('Reset — Publish to make it live', 'ok');
        return;
      }
      if (e.target.closest('[data-scrap]')) {
        clearTimeout(t);
        try { spec.scrap(); } catch (e3) {}
        closePop(); toast('Scrapped — reverted'); return;
      }
      if (e.target.closest('[data-pub]')) {
        clearTimeout(t);
        try { spec.preview(readValues()); } catch (e4) {}
        if (!sbReady()) { toast('Supabase not configured — kept as pending edit', 'err'); return; }
        var btn = el.querySelector('[data-pub]'); btn.disabled = true; btn.textContent = 'Publishing…';
        var p;
        try { p = spec.publish(); } catch (e5) { p = Promise.reject(e5); }
        Promise.resolve(p).then(function () {
          closePop(); toast('Published — live for everyone', 'ok');
        }).catch(function (err) {
          btn.disabled = false; btn.textContent = 'Publish';
          var m = (err && err.message) ? err.message : 'unknown error';
          toast('Publish failed: ' + m, 'err');
        });
      }
    });

    document.body.appendChild(el);
    positionPop(el, anchorRect);
    var first = el.querySelector('.mcpi-in');
    if (first && first.focus) setTimeout(function () { try { first.focus(); } catch (e) {} }, 30);
    pop = el; pop._back = back;
  }

  function positionPop(el, r) {
    var w = el.offsetWidth, h = el.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight, m = 8;
    var left = Math.min(Math.max(m, r.left), vw - w - m);
    var top = r.bottom + 8;
    if (top + h > vh - m) top = Math.max(m, r.top - h - 8);   // flip above when no room below
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }

  // ==========================================================================
  //  Pencils — attach as SIBLINGS of editable elements; rescan on DOM change.
  // ==========================================================================
  function makePencil(specFactory) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mcpi-pencil'; btn.innerHTML = '✎';
    btn.setAttribute('aria-label', 'Edit');
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var spec; try { spec = specFactory(); } catch (err) { spec = null; }
      if (!spec) { toast('Cannot edit this element', 'err'); return; }
      var r = btn.getBoundingClientRect();
      openPop(spec, r);
    });
    btn._pending = function () {
      try { var s = specFactory(); return s && s.isPending && s.isPending(); } catch (e) { return false; }
    };
    return btn;
  }

  // insert pencil right after `target` (sibling), guarded by data-mcpi
  function attachAfter(target, specFactory) {
    if (!target || target.getAttribute('data-mcpi') === '1') return;
    target.setAttribute('data-mcpi', '1');
    var btn = makePencil(specFactory);
    if (target.nextSibling) target.parentNode.insertBefore(btn, target.nextSibling);
    else target.parentNode.appendChild(btn);
  }

  // insert a labeled chip before `target` (for the layout/theme surface)
  function attachChipBefore(target, label, specFactory) {
    if (!target || target.getAttribute('data-mcpi-chip') === '1') return;
    target.setAttribute('data-mcpi-chip', '1');
    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'mcpi-chip'; chip.innerHTML = '🎨 <span>' + label + '</span>';
    chip.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var spec; try { spec = specFactory(); } catch (err) { spec = null; }
      if (!spec) return;
      openPop(spec, chip.getBoundingClientRect());
    });
    target.parentNode.insertBefore(chip, target);
  }

  // insert a labeled chip as the first child of `container` (a "line" at the
  // top of a section, e.g. the Conditioning Corner)
  function attachChipFirst(container, label, specFactory) {
    if (!container || container.getAttribute('data-mcpi-chip') === '1') return;
    container.setAttribute('data-mcpi-chip', '1');
    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'mcpi-chip'; chip.innerHTML = '🎨 <span>' + label + '</span>';
    chip.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var spec; try { spec = specFactory(); } catch (err) { spec = null; }
      if (!spec) return;
      openPop(spec, chip.getBoundingClientRect());
    });
    if (container.firstChild) container.insertBefore(chip, container.firstChild);
    else container.appendChild(chip);
  }

  function scan() {
    if (!active) return;
    try {
      // A. exercise labels — top-level workout cards only
      document.querySelectorAll('.ex-card, .lift-card').forEach(function (card) {
        var nameEl = card.querySelector('.ex-name, .lift-name, .var-name');
        if (!nameEl) return;
        attachAfter(nameEl, function () { return exSpec(card, nameEl); });
      });
      // B. badge chips
      document.querySelectorAll('[class*="lb-"],[class*="tb-"]').forEach(function (el) {
        if (!badgeIdOf(el)) return;
        attachAfter(el, function () { return badgeSpec(el); });
      });
      // C. split header (split hub pages)
      if (window.MC_NAMES && MC_NAMES.splitOf(pid())) {
        var titleEl = document.querySelector('.hero .title, .hero-inner .title, .hero h1.title');
        if (titleEl) attachAfter(titleEl, function () { return splitSpec(titleEl); });
      }
      // D. program name (dashboard hero)
      var hero = document.getElementById('heroName');
      if (hero && window.activeProg && activeProg.id && (hero.textContent || '').trim()) {
        attachAfter(hero, function () { return programSpec(hero); });
      }
      // E. layout & theme surface
      if (window.MC_LAYOUT && layoutViews().length) {
        var grid = document.getElementById('flagGrid');
        var anchor = grid || document.querySelector('.ex-card, .ss-card, .a-card');
        if (anchor) attachChipBefore(anchor, 'Layout & Theme', function () { return layoutSpec(); });
      }
      // F. conditioning cards (Conditioning Corner — direct inline text edits)
      document.querySelectorAll('.cond-card[data-cond-id]').forEach(function (card) {
        var nameEl = card.querySelector('.cond-name');
        if (!nameEl) return;
        attachAfter(nameEl, function () { return condSpec(card, nameEl); });
      });
      // G. conditioning layout & theme line (scoped to the Conditioning view)
      var condBody = document.getElementById('condBody');
      if (window.MC_LAYOUT && condBody && condBody.querySelector('.cond-card[data-cond-id]')) {
        attachChipFirst(condBody, 'Layout & Theme', function () {
          return layoutSpec([{ view: 'conditioning', id: '', scope: 'conditioning', label: 'Conditioning' }]);
        });
      }
      refreshPendingDots();
    } catch (e) { /* never break the page */ }
  }

  function refreshPendingDots() {
    document.querySelectorAll('.mcpi-pencil').forEach(function (btn) {
      var on = false; try { on = !!(btn._pending && btn._pending()); } catch (e) {}
      btn.classList.toggle('has-edit', on);
    });
  }

  // ==========================================================================
  //  enable / disable
  // ==========================================================================
  function enable() {
    if (active) return; active = true;
    injectStyles();
    if (window.MC_SCAN && MC_SCAN.subscribe) {
      MC_SCAN.subscribe(scan); MC_SCAN.start();
    } else if (!ownObserver) {
      var t; ownObserver = new MutationObserver(function () { clearTimeout(t); t = setTimeout(scan, 100); });
      ownObserver.observe(document.body, { childList: true, subtree: true });
    }
    scan();
    [200, 600, 1400].forEach(function (d) { setTimeout(scan, d); });
  }

  function disable() {
    active = false;
    closePop();
    document.querySelectorAll('.mcpi-pencil').forEach(function (b) { b.remove(); });
    document.querySelectorAll('.mcpi-chip').forEach(function (b) { b.remove(); });
    document.querySelectorAll('[data-mcpi]').forEach(function (e) { e.removeAttribute('data-mcpi'); });
    document.querySelectorAll('[data-mcpi-chip]').forEach(function (e) { e.removeAttribute('data-mcpi-chip'); });
    if (ownObserver) { ownObserver.disconnect(); ownObserver = null; }
  }

  // keep pending dots fresh when other PM flows change the working copy
  document.addEventListener('mc:names-changed', function () { if (active) refreshPendingDots(); });

  window.MC_PM_INLINE = { enable: enable, disable: disable };
})();
