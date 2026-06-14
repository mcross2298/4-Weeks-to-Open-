/* ==========================================================================
   mc-pm-creator.js — "+" Master Content & Template Creator (PM Phase 3b)
   --------------------------------------------------------------------------
   Owner-only. Lazy-loaded by program-manager.js from the PM bar's "＋ Create"
   button. Implements the spec's creation wizard with its fixed step order:

       1. Type       — New Program / New Workout / New Card Template
       2. Structure  — baseline structural layout style for the new item
       3. Skin       — ThemeConfig preset (applied live via MC_THEME)
       4. Destination— hand off to the matching builder (content + assignment)

   Structure + skin choices are persisted to localStorage 'mc_pm_create_intent';
   the builder reads them so the created item carries its chosen layout, and
   build-workout.html's "Assign to program" control is the Destination step
   (unassigned → Bonus Workouts, Phase 1). Programs route to build-program.html.
   ========================================================================== */
(function () {
  if (window.MC_PM_CREATOR) return;

  var INTENT_KEY = 'mc_pm_create_intent';
  var overlay = null, styled = false;
  var state = { type: '', structure: '', skin: '', step: 1 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var TYPES = [
    { val: 'program',  icon: '🧩', label: 'New Program',       sub: 'Multi-week program with its own landing + schedule', builder: 'build-program.html', layoutView: 'landing' },
    { val: 'workout',  icon: '🏋️', label: 'New Workout',       sub: 'Standalone session — assign it or auto-route to Bonus', builder: 'build-workout.html', layoutView: 'workout' },
    { val: 'template', icon: '🃏', label: 'New Card Template', sub: 'A reusable workout-card layout', builder: 'build-workout.html', layoutView: 'workout' }
  ];
  function typeOf(v) { return TYPES.filter(function (t) { return t.val === v; })[0] || TYPES[0]; }

  function injectStyles() {
    if (styled) return; styled = true;
    var css =
      '.mcc-ov{position:fixed;inset:0;z-index:1450;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;' +
        'padding:20px;opacity:0;transition:opacity .2s;font-family:"Segoe UI",system-ui,sans-serif;}' +
      '.mcc-ov.on{opacity:1;}' +
      '.mcc{width:100%;max-width:380px;max-height:88vh;display:flex;flex-direction:column;background:#0d1117;' +
        'border:1px solid rgba(255,255,255,0.14);border-radius:18px;color:#e2e8f0;overflow:hidden;' +
        'transform:translateY(10px) scale(.98);transition:transform .2s;}' +
      '.mcc-ov.on .mcc{transform:none;}' +
      '.mcc-hd{display:flex;align-items:center;gap:10px;padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,0.08);}' +
      '.mcc-hd .t{flex:1;font-size:16px;font-weight:900;color:#fff;}' +
      '.mcc-step{font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#22d3ee;}' +
      '.mcc-x{background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:2px 6px;}' +
      '.mcc-body{flex:1;overflow-y:auto;padding:16px 18px;}' +
      '.mcc-q{font-size:13px;font-weight:700;color:#cbd5e1;margin-bottom:12px;}' +
      '.mcc-card{display:flex;align-items:center;gap:13px;width:100%;text-align:left;padding:14px;margin-bottom:9px;border-radius:13px;' +
        'border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);cursor:pointer;font-family:inherit;color:inherit;}' +
      '.mcc-card.on{border-color:#22d3ee;background:rgba(34,211,238,0.1);}' +
      '.mcc-card .ic{font-size:24px;width:30px;text-align:center;flex-shrink:0;}' +
      '.mcc-card .nm{font-size:14px;font-weight:900;color:#fff;}' +
      '.mcc-card .sb{font-size:11px;color:#94a3b8;font-weight:600;margin-top:2px;line-height:1.4;}' +
      '.mcc-row{display:flex;flex-wrap:wrap;gap:8px;}' +
      '.mcc-opt{padding:9px 13px;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.05);' +
        'color:#cbd5e1;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.mcc-opt.on{background:#22d3ee;border-color:#22d3ee;color:#03121b;}' +
      '.mcc-hint{font-size:11px;color:#64748b;font-weight:600;line-height:1.5;margin-top:12px;}' +
      '.mcc-ft{display:flex;gap:8px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,0.08);background:#0a0e14;}' +
      '.mcc-ft button{flex:1;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;}' +
      '.mcc-ft button:disabled{opacity:0.4;cursor:not-allowed;}' +
      '.mcc-ft .next{background:#22d3ee;border-color:#22d3ee;color:#03222b;}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function render() {
    var b = overlay.querySelector('.mcc-body');
    var stepEl = overlay.querySelector('.mcc-step');
    var back = overlay.querySelector('.mcc-back');
    var next = overlay.querySelector('.mcc-next');
    stepEl.textContent = 'Step ' + state.step + ' of 4';
    b.innerHTML = '';

    if (state.step === 1) {
      b.appendChild(html('<div class="mcc-q">What are you creating?</div>'));
      TYPES.forEach(function (t) {
        var c = document.createElement('button');
        c.className = 'mcc-card' + (state.type === t.val ? ' on' : '');
        c.innerHTML = '<span class="ic">' + t.icon + '</span><span><span class="nm">' + esc(t.label) + '</span><span class="sb">' + esc(t.sub) + '</span></span>';
        c.onclick = function () { state.type = t.val; state.structure = ''; render(); };
        b.appendChild(c);
      });
      next.textContent = 'Next';
      next.disabled = !state.type;
    } else if (state.step === 2) {
      var t = typeOf(state.type);
      var opts = (window.MC_LAYOUT && MC_LAYOUT.OPTIONS[t.layoutView]) || [];
      var def = (window.MC_LAYOUT && MC_LAYOUT.styleFor(t.layoutView, '')) || (opts[0] || '');
      if (!state.structure) state.structure = def;
      b.appendChild(html('<div class="mcc-q">Pick a baseline structure for the ' + esc(t.label.replace('New ', '').toLowerCase()) + '.</div>'));
      var row = document.createElement('div'); row.className = 'mcc-row';
      opts.forEach(function (v) {
        var o = document.createElement('button');
        o.className = 'mcc-opt' + (state.structure === v ? ' on' : '');
        o.textContent = cap(v).replace('-', ' ');
        o.onclick = function () { state.structure = v; render(); };
        row.appendChild(o);
      });
      b.appendChild(row);
      b.appendChild(html('<div class="mcc-hint">Some structures (timeline, week-calendar, superset-grouped) finish rendering in the next layout release; your choice is saved with the item now.</div>'));
      next.textContent = 'Next';
      next.disabled = !state.structure;
    } else if (state.step === 3) {
      b.appendChild(html('<div class="mcc-q">Apply a color/skin (optional).</div>'));
      var prow = document.createElement('div'); prow.className = 'mcc-row';
      var presets = [{ val: '', label: 'None' }];
      var P = (window.MC_THEME && MC_THEME.presets) || {};
      Object.keys(P).forEach(function (k) { presets.push({ val: k, label: P[k].name || k }); });
      presets.forEach(function (p) {
        var o = document.createElement('button');
        o.className = 'mcc-opt' + (state.skin === p.val ? ' on' : '');
        o.textContent = p.label;
        o.onclick = function () {
          state.skin = p.val;
          if (window.MC_THEME && MC_THEME.setConfig) MC_THEME.setConfig(p.val ? { preset: p.val } : null);
          render();
        };
        prow.appendChild(o);
      });
      b.appendChild(prow);
      b.appendChild(html('<div class="mcc-hint">Skin previews live and applies to app chrome. You can fine-tune it any time from “Edit Layout”.</div>'));
      next.textContent = 'Next';
      next.disabled = false;
    } else { // step 4 — destination / create
      var t2 = typeOf(state.type);
      b.appendChild(html('<div class="mcc-q">Review &amp; open the builder.</div>'));
      b.appendChild(html(
        '<div class="mcc-card on"><span class="ic">' + t2.icon + '</span><span>' +
        '<span class="nm">' + esc(t2.label) + '</span>' +
        '<span class="sb">Structure: <b>' + esc(cap(state.structure) || '—') + '</b> · Skin: <b>' + esc(state.skin || 'none') + '</b></span>' +
        '</span></div>'));
      b.appendChild(html('<div class="mcc-hint">' + (state.type === 'program'
        ? 'Opens the Program Builder to add weeks, days and exercises, then assign a destination.'
        : 'Opens the Workout Builder for exercises and the destination (assign to a program, or leave unassigned to auto-route to <b>Bonus Workouts</b>).') + '</div>'));
      next.textContent = 'Open Builder →';
      next.disabled = false;
    }
    back.disabled = state.step === 1;
  }

  function html(s) { var d = document.createElement('div'); d.innerHTML = s; return d.firstChild; }

  function advance() {
    if (state.step < 4) { state.step++; render(); return; }
    // finish: persist intent, hand off to the builder
    var t = typeOf(state.type);
    try {
      localStorage.setItem(INTENT_KEY, JSON.stringify({
        type: state.type, structure: state.structure, skin: state.skin, ts: Date.now()
      }));
    } catch (e) {}
    location.href = t.builder;
  }

  function build() {
    injectStyles();
    state = { type: '', structure: '', skin: '', step: 1 };
    overlay = document.createElement('div'); overlay.className = 'mcc-ov';
    overlay.innerHTML =
      '<div class="mcc">' +
        '<div class="mcc-hd"><span class="t">＋ Create</span><span class="mcc-step"></span>' +
          '<button class="mcc-x">✕</button></div>' +
        '<div class="mcc-body"></div>' +
        '<div class="mcc-ft"><button class="mcc-back">Back</button><button class="mcc-next next"></button></div>' +
      '</div>';
    overlay.querySelector('.mcc-x').onclick = close;
    overlay.querySelector('.mcc-back').onclick = function () { if (state.step > 1) { state.step--; render(); } };
    overlay.querySelector('.mcc-next').onclick = advance;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    render();
    requestAnimationFrame(function () { overlay.classList.add('on'); });
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('on');
    var o = overlay; overlay = null;
    setTimeout(function () { o.remove(); }, 200);
  }
  function open() { if (overlay) return; build(); }

  window.MC_PM_CREATOR = { open: open, close: close };
})();
