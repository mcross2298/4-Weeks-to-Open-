/* ==========================================================================
   mc-macros.js — Nutrition tab (macro tracker, Phase 1)
   --------------------------------------------------------------------------
   Renders the Nutrition tab on dashboard.html (#nutritionBody): daily macro
   goals vs. today's totals, plus a food log you build by Open Food Facts
   text search or manual entry. Owns the single localStorage store:

     mc_macros_v1 = {
       v: 1,
       ts: <ms>,                       // bumped when profile/goals change
       profile: { sex, age, heightCm, weightLb, activity, goal },
       goals:   { kcal, p, f, c },     // per-day targets
       days: { "YYYY-MM-DD": { entries: [
         { id, ts, name, source, unit, qty, per:{kcal,p,f,c} }
       ] } }
     }

   Goals are produced by the suggest-then-adjust calculator (mc-macrocalc.js):
   the engine proposes numbers from the user's profile, then increase/decrease
   steppers let them tune calories and each macro to their own levels. Weight
   is pre-filled from the existing bodyweight log (mc_body_v1) when present.

   The store is registered in mc-sync.js (strategy 'macros') so it syncs per
   user with zero extra backend. All persistence is localStorage; on a network
   miss food lookups fall back to manual entry.
   ========================================================================== */
(function () {
  if (window.MCMacros) return;
  var host = document.getElementById('nutritionBody');
  if (!host) return;

  var KEY = 'mc_macros_v1';
  var BODY_KEY = 'mc_body_v1';   // existing bodyweight log, for weight pre-fill

  // ---- styles (injected once, mirrors mc-account.js's self-contained CSS) ---
  (function injectStyles() {
    if (document.getElementById('nt-styles')) return;
    var css =
      '#nutritionBody{max-width:680px;margin:0 auto;padding:0 18px 24px;}' +
      '.nt-card{background:var(--surface);border:1px solid var(--border2);border-radius:18px;padding:18px;margin-bottom:16px;}' +
      '.nt-empty{text-align:center;padding:8px 4px 16px;}' +
      '.nt-empty-emoji{font-size:34px;margin-bottom:8px;}' +
      '.nt-empty-title{font-size:18px;font-weight:900;color:var(--text);margin-bottom:6px;}' +
      '.nt-empty-sub{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:16px;}' +
      '.nt-btn{width:100%;box-sizing:border-box;padding:14px;border-radius:13px;border:1px solid var(--border2);' +
        'background:var(--surface2);color:var(--text);font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.nt-btn-gold{background:var(--gold);border-color:var(--gold);color:#000;}' +
      '.nt-btn-danger{background:transparent;border-color:rgba(248,113,113,0.4);color:#f87171;margin-top:8px;}' +
      '.nt-link{display:block;width:100%;background:none;border:none;color:var(--muted);font-size:12px;font-weight:700;' +
        'cursor:pointer;font-family:inherit;margin-top:14px;text-align:center;}' +
      '.nt-ringwrap{display:flex;align-items:center;gap:18px;margin-bottom:18px;}' +
      '.nt-ring{width:104px;height:104px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;}' +
      '.nt-ring-hole{width:82px;height:82px;border-radius:50%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;}' +
      '.nt-ring-num{font-size:24px;font-weight:900;color:var(--text);line-height:1;}' +
      '.nt-ring-lbl{font-size:10px;color:var(--muted2);font-weight:700;margin-top:3px;}' +
      '.nt-ring-side{flex:1;}' +
      '.nt-remain{font-size:22px;font-weight:900;color:var(--gold);}' +
      '.nt-remain.over{color:#f87171;}' +
      '.nt-remain-sub{font-size:12px;color:var(--muted2);font-weight:700;margin-top:2px;}' +
      '.nt-mbar{margin-top:12px;}' +
      '.nt-mbar-top{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--text);margin-bottom:5px;}' +
      '.nt-mbar-val{color:var(--muted);font-weight:700;}' +
      '.nt-mbar-track{height:8px;border-radius:5px;background:rgba(255,255,255,0.08);overflow:hidden;}' +
      '.nt-mbar-fill{height:100%;border-radius:5px;transition:width 0.3s ease;}' +
      '.nt-actions{display:flex;gap:10px;margin-bottom:22px;}' +
      '.nt-loghead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;}' +
      '.nt-loghead-title{font-size:13px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted2);}' +
      '.nt-loghead-count{font-size:12px;color:var(--muted2);font-weight:700;}' +
      '.nt-logempty{font-size:13px;color:var(--muted2);text-align:center;padding:24px 12px;line-height:1.5;}' +
      '.nt-log{display:flex;flex-direction:column;gap:8px;}' +
      '.nt-item{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);' +
        'border-radius:13px;padding:12px 14px;cursor:pointer;}' +
      '.nt-item-main{flex:1;min-width:0;}' +
      '.nt-item-name{font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-item-qty{color:var(--gold);font-weight:800;}' +
      '.nt-item-macros{font-size:12px;color:var(--muted2);font-weight:600;margin-top:2px;}' +
      '.nt-item-kcal{font-size:16px;font-weight:900;color:var(--text);flex-shrink:0;}' +
      /* sheets */
      '.nt-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
        'display:flex;align-items:flex-end;justify-content:center;z-index:1200;opacity:0;transition:opacity 0.2s;}' +
      '.nt-overlay.open{opacity:1;}' +
      '.nt-sheet{width:100%;max-width:560px;background:#0e0e0e;border-top:1px solid var(--border2);border-radius:24px 24px 0 0;' +
        'padding:14px 18px calc(28px + env(safe-area-inset-bottom));max-height:90vh;overflow-y:auto;' +
        'transform:translateY(16px);transition:transform 0.2s;}' +
      '.nt-overlay.open .nt-sheet{transform:translateY(0);}' +
      '.nt-handle{width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 16px;}' +
      '.nt-sheet-title{font-size:19px;font-weight:900;color:var(--text);letter-spacing:-0.01em;}' +
      '.nt-sheet-sub{font-size:13px;color:var(--muted);margin:4px 0 16px;line-height:1.5;}' +
      '.nt-form{display:flex;flex-direction:column;gap:12px;margin-bottom:16px;}' +
      '.nt-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
      '.nt-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}' +
      '.nt-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:var(--muted);}' +
      '.nt-field input,.nt-field select,.nt-input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);' +
        'border:1px solid var(--border2);border-radius:11px;padding:12px;color:var(--text);font-size:15px;font-family:inherit;}' +
      '.nt-input{margin-bottom:12px;}' +
      '.nt-seg{display:flex;gap:8px;}' +
      '.nt-seg button{flex:1;padding:12px;border-radius:11px;border:1px solid var(--border2);background:rgba(255,255,255,0.04);' +
        'color:var(--muted);font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.nt-seg button.on{background:var(--gold);border-color:var(--gold);color:#000;}' +
      '.nt-results{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto;}' +
      '.nt-results-msg{font-size:13px;color:var(--muted2);text-align:center;padding:18px;}' +
      '.nt-result{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);' +
        'border-radius:12px;padding:11px 13px;cursor:pointer;}' +
      '.nt-result-main{flex:1;min-width:0;}' +
      '.nt-result-name{font-size:14px;font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-result-sub{font-size:11px;color:var(--muted2);font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.nt-result-kcal{font-size:15px;font-weight:900;color:var(--text);flex-shrink:0;text-align:center;}' +
      '.nt-result-kcal span{display:block;font-size:9px;color:var(--muted2);font-weight:700;}' +
      '.nt-adjust{margin-top:8px;}' +
      '.nt-adjust-head{font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted2);margin-bottom:10px;}' +
      '.nt-calsum{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;}' +
      '.nt-calsum-k{font-size:26px;font-weight:900;color:var(--gold);}' +
      '.nt-calsum-split{font-size:13px;font-weight:700;color:var(--muted);}' +
      '.nt-step{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid var(--border);}' +
      '.nt-step-lbl{font-size:14px;font-weight:800;color:var(--text);}' +
      '.nt-step-ctl{display:flex;align-items:center;gap:14px;}' +
      '.nt-step-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--border2);background:var(--surface2);' +
        'color:var(--text);font-size:20px;font-weight:800;cursor:pointer;font-family:inherit;line-height:1;}' +
      '.nt-step-val{min-width:54px;text-align:center;font-size:18px;font-weight:900;color:var(--text);}' +
      '@media (prefers-reduced-motion: reduce){.nt-overlay,.nt-sheet,.nt-mbar-fill{transition:none;}}';
    var st = document.createElement('style');
    st.id = 'nt-styles'; st.textContent = css;
    document.head.appendChild(st);
  })();

  // ---- tiny helpers --------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  // ---- store ---------------------------------------------------------------
  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; }
    catch (e) { return {}; }
  }
  function write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
    try { if (window.MC_SYNC && MC_SYNC.push) MC_SYNC.push(); } catch (e) {}
  }
  function getDay(obj, key) {
    obj.days = obj.days || {};
    if (!obj.days[key]) obj.days[key] = { entries: [] };
    if (!Array.isArray(obj.days[key].entries)) obj.days[key].entries = [];
    return obj.days[key];
  }
  function latestWeightLb() {
    try {
      var a = JSON.parse(localStorage.getItem(BODY_KEY) || '[]') || [];
      // mc_body_v1 is newest-first [{date,w}]; first valid wins.
      for (var i = 0; i < a.length; i++) { var w = num(a[i] && a[i].w); if (w > 0) return Math.round(w); }
    } catch (e) {}
    return 0;
  }

  function dayTotals(day) {
    var t = { kcal: 0, p: 0, f: 0, c: 0 };
    (day.entries || []).forEach(function (e) {
      var q = num(e.qty, 1), per = e.per || {};
      t.kcal += num(per.kcal) * q; t.p += num(per.p) * q;
      t.f += num(per.f) * q; t.c += num(per.c) * q;
    });
    t.kcal = Math.round(t.kcal); t.p = Math.round(t.p); t.f = Math.round(t.f); t.c = Math.round(t.c);
    return t;
  }

  // ====================================================================== //
  //  RENDER                                                                 //
  // ====================================================================== //
  function render() {
    var data = read();
    var goals = data.goals || null;
    var day = getDay(data, todayKey());
    var totals = dayTotals(day);

    host.innerHTML = '';

    // ---- goals / progress card --------------------------------------------
    var card = el('div', 'nt-card');
    if (!goals) {
      card.appendChild(el('div', 'nt-empty',
        '<div class="nt-empty-emoji">🎯</div>' +
        '<div class="nt-empty-title">Set your daily targets</div>' +
        '<div class="nt-empty-sub">Use the calculator to get suggested calories and macros from your stats — then tune them to your own levels.</div>'));
      var setBtn = el('button', 'nt-btn nt-btn-gold', 'Open macro calculator');
      setBtn.onclick = openCalculator;
      card.appendChild(setBtn);
    } else {
      var pct = Math.min(100, Math.round((totals.kcal / (goals.kcal || 1)) * 100));
      var remaining = (goals.kcal || 0) - totals.kcal;
      card.appendChild(el('div', 'nt-ringwrap',
        '<div class="nt-ring" style="background:conic-gradient(var(--gold) ' + pct + '%, rgba(255,255,255,0.08) 0)">' +
          '<div class="nt-ring-hole">' +
            '<div class="nt-ring-num">' + totals.kcal + '</div>' +
            '<div class="nt-ring-lbl">/ ' + (goals.kcal || 0) + ' kcal</div>' +
          '</div>' +
        '</div>' +
        '<div class="nt-ring-side">' +
          '<div class="nt-remain ' + (remaining < 0 ? 'over' : '') + '">' +
            (remaining < 0 ? Math.abs(remaining) + ' over' : remaining + ' left') + '</div>' +
          '<div class="nt-remain-sub">' + pct + '% of goal</div>' +
        '</div>'));

      card.appendChild(macroBar('Protein', totals.p, goals.p, '#60a5fa'));
      card.appendChild(macroBar('Fat', totals.f, goals.f, '#fbbf24'));
      card.appendChild(macroBar('Carbs', totals.c, goals.c, '#34d399'));

      var edit = el('button', 'nt-link', '⚙︎ Edit goals / recalculate');
      edit.onclick = openCalculator;
      card.appendChild(edit);
    }
    host.appendChild(card);

    // ---- add actions ------------------------------------------------------
    var actions = el('div', 'nt-actions');
    var bSearch = el('button', 'nt-btn nt-btn-gold', '🔍 Search foods');
    bSearch.onclick = openSearch;
    var bManual = el('button', 'nt-btn', '✏️ Manual entry');
    bManual.onclick = function () { openManual(); };
    actions.appendChild(bSearch); actions.appendChild(bManual);
    host.appendChild(actions);

    // ---- today's log ------------------------------------------------------
    var logHead = el('div', 'nt-loghead');
    logHead.appendChild(el('span', 'nt-loghead-title', "Today's log"));
    logHead.appendChild(el('span', 'nt-loghead-count', day.entries.length + (day.entries.length === 1 ? ' item' : ' items')));
    host.appendChild(logHead);

    if (!day.entries.length) {
      host.appendChild(el('div', 'nt-logempty', 'Nothing logged yet. Search a food or add one manually.'));
    } else {
      var list = el('div', 'nt-log');
      day.entries.slice().reverse().forEach(function (e) {
        var q = num(e.qty, 1), per = e.per || {};
        var row = el('div', 'nt-item');
        row.innerHTML =
          '<div class="nt-item-main">' +
            '<div class="nt-item-name">' + esc(e.name) + (q !== 1 ? ' <span class="nt-item-qty">×' + q + '</span>' : '') + '</div>' +
            '<div class="nt-item-macros">' +
              'P ' + Math.round(num(per.p) * q) + ' · F ' + Math.round(num(per.f) * q) + ' · C ' + Math.round(num(per.c) * q) +
            '</div>' +
          '</div>' +
          '<div class="nt-item-kcal">' + Math.round(num(per.kcal) * q) + '</div>';
        row.onclick = function () { openEdit(e.id); };
        list.appendChild(row);
      });
      host.appendChild(list);
    }
  }

  function macroBar(label, have, goal, color) {
    var pct = Math.min(100, Math.round((have / (goal || 1)) * 100));
    var wrap = el('div', 'nt-mbar');
    wrap.innerHTML =
      '<div class="nt-mbar-top"><span>' + label + '</span><span class="nt-mbar-val">' + have + ' / ' + (goal || 0) + ' g</span></div>' +
      '<div class="nt-mbar-track"><div class="nt-mbar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
    return wrap;
  }

  // ====================================================================== //
  //  SHEETS (bottom-sheet overlay)                                          //
  // ====================================================================== //
  function sheet(title, sub) {
    var ov = el('div', 'nt-overlay');
    var sh = el('div', 'nt-sheet');
    sh.appendChild(el('div', 'nt-handle'));
    sh.appendChild(el('div', 'nt-sheet-title', esc(title)));
    if (sub) sh.appendChild(el('div', 'nt-sheet-sub', esc(sub)));
    ov.appendChild(sh);
    ov.addEventListener('click', function (ev) { if (ev.target === ov) close(); });
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('open'); });
    function close() { ov.classList.remove('open'); setTimeout(function () { ov.remove(); }, 200); }
    return { ov: ov, sh: sh, close: close };
  }

  function stepper(label, value, step, min, onChange) {
    var row = el('div', 'nt-step');
    row.innerHTML = '<div class="nt-step-lbl">' + esc(label) + '</div>';
    var ctl = el('div', 'nt-step-ctl');
    var minus = el('button', 'nt-step-btn', '−');
    var val = el('div', 'nt-step-val', String(value));
    var plus = el('button', 'nt-step-btn', '+');
    function set(v) { v = Math.max(min, Math.round(v)); val.textContent = String(v); onChange(v); }
    minus.onclick = function () { set(num(val.textContent) - step); };
    plus.onclick = function () { set(num(val.textContent) + step); };
    ctl.appendChild(minus); ctl.appendChild(val); ctl.appendChild(plus);
    row.appendChild(ctl);
    row.setVal = function (v) { val.textContent = String(Math.round(v)); };
    return row;
  }

  // ---- calculator sheet ----------------------------------------------------
  function openCalculator() {
    var data = read();
    var p = data.profile || {};
    var s = sheet('Macro calculator', 'Suggested from your stats — adjust to taste.');

    var ftStart = p.heightCm ? Math.floor((p.heightCm / 2.54) / 12) : 5;
    var inStart = p.heightCm ? Math.round((p.heightCm / 2.54) % 12) : 10;

    var form = el('div', 'nt-form');
    form.innerHTML =
      '<div class="nt-seg" id="ntSex">' +
        '<button data-v="male" class="' + (p.sex !== 'female' ? 'on' : '') + '">Male</button>' +
        '<button data-v="female" class="' + (p.sex === 'female' ? 'on' : '') + '">Female</button>' +
      '</div>' +
      '<div class="nt-grid2">' +
        '<label class="nt-field"><span>Age</span><input id="ntAge" type="number" inputmode="numeric" value="' + (p.age || '') + '" placeholder="30"></label>' +
        '<label class="nt-field"><span>Weight (lb)</span><input id="ntWt" type="number" inputmode="decimal" value="' + (p.weightLb || latestWeightLb() || '') + '" placeholder="180"></label>' +
      '</div>' +
      '<div class="nt-grid2">' +
        '<label class="nt-field"><span>Height (ft)</span><input id="ntFt" type="number" inputmode="numeric" value="' + ftStart + '"></label>' +
        '<label class="nt-field"><span>Height (in)</span><input id="ntIn" type="number" inputmode="numeric" value="' + inStart + '"></label>' +
      '</div>' +
      '<label class="nt-field"><span>Activity</span><select id="ntAct">' +
        MCMacroCalc.ACTIVITY.map(function (a) { return '<option value="' + a.id + '"' + (p.activity === a.id ? ' selected' : '') + '>' + a.label + ' — ' + a.sub + '</option>'; }).join('') +
      '</select></label>' +
      '<div class="nt-seg nt-seg-3" id="ntGoal">' +
        MCMacroCalc.GOALS.map(function (g) { return '<button data-v="' + g.id + '" class="' + (p.goal === g.id ? 'on' : '') + '">' + g.label + '</button>'; }).join('') +
      '</div>';
    s.sh.appendChild(form);

    // segmented-button wiring
    function seg(id, fallback) {
      var box = $('#' + id, s.sh);
      box.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      return function () { var on = box.querySelector('button.on'); return on ? on.getAttribute('data-v') : fallback; };
    }
    var getSex = seg('ntSex', 'male');
    var getGoal = seg('ntGoal', 'maintain');

    function readProfile() {
      var ft = num($('#ntFt', s.sh).value), inch = num($('#ntIn', s.sh).value);
      return {
        sex: getSex(),
        age: num($('#ntAge', s.sh).value),
        heightCm: Math.round((ft * 12 + inch) * 2.54),
        weightLb: num($('#ntWt', s.sh).value),
        activity: $('#ntAct', s.sh).value,
        goal: getGoal()
      };
    }

    var calcBtn = el('button', 'nt-btn nt-btn-gold', 'Calculate suggested macros');
    s.sh.appendChild(calcBtn);

    // ---- adjust section (revealed after calculate) ----
    var adjust = el('div', 'nt-adjust');
    adjust.style.display = 'none';
    s.sh.appendChild(adjust);

    var cur = data.goals ? { kcal: data.goals.kcal, p: data.goals.p, f: data.goals.f, c: data.goals.c } : null;
    var profSnapshot = null;

    var kcalStep, pStep, fStep, cStep, summary;

    function buildAdjust() {
      adjust.innerHTML = '';
      adjust.appendChild(el('div', 'nt-adjust-head', 'Fine-tune your targets'));
      summary = el('div', 'nt-calsum');
      adjust.appendChild(summary);

      kcalStep = stepper('Calories', cur.kcal, 50, 0, function (v) {
        cur.kcal = v;
        // re-derive split for this calorie level (protein/fat stay anchored to
        // bodyweight, carbs absorb the change — the muscle-preserving move)
        var sp = MCMacroCalc.splitFromCalories(v, profSnapshot.weightLb, profSnapshot.goal);
        cur.p = sp.p; cur.f = sp.f; cur.c = sp.c;
        pStep.setVal(cur.p); fStep.setVal(cur.f); cStep.setVal(cur.c);
        refreshSummary();
      });
      pStep = stepper('Protein (g)', cur.p, 5, 0, function (v) { cur.p = v; cur.kcal = MCMacroCalc.kcalFromMacros(cur.p, cur.f, cur.c); kcalStep.setVal(cur.kcal); refreshSummary(); });
      fStep = stepper('Fat (g)', cur.f, 5, 0, function (v) { cur.f = v; cur.kcal = MCMacroCalc.kcalFromMacros(cur.p, cur.f, cur.c); kcalStep.setVal(cur.kcal); refreshSummary(); });
      cStep = stepper('Carbs (g)', cur.c, 5, 0, function (v) { cur.c = v; cur.kcal = MCMacroCalc.kcalFromMacros(cur.p, cur.f, cur.c); kcalStep.setVal(cur.kcal); refreshSummary(); });
      adjust.appendChild(kcalStep); adjust.appendChild(pStep); adjust.appendChild(fStep); adjust.appendChild(cStep);

      var save = el('button', 'nt-btn nt-btn-gold', 'Save as my goals');
      save.onclick = function () {
        var obj = read();
        obj.v = 1; obj.ts = Date.now();
        obj.profile = profSnapshot;
        obj.goals = { kcal: cur.kcal, p: cur.p, f: cur.f, c: cur.c };
        write(obj);
        s.close(); render();
      };
      adjust.appendChild(save);
      refreshSummary();
    }

    function refreshSummary() {
      var pc = MCMacroCalc.macroPercents(cur.p, cur.f, cur.c);
      summary.innerHTML =
        '<span class="nt-calsum-k">' + cur.kcal + ' kcal</span>' +
        '<span class="nt-calsum-split">' + pc.p + 'P / ' + pc.f + 'F / ' + pc.c + 'C</span>';
    }

    calcBtn.onclick = function () {
      profSnapshot = readProfile();
      if (!profSnapshot.weightLb || !profSnapshot.age || !profSnapshot.heightCm) {
        calcBtn.textContent = 'Enter age, height & weight first';
        setTimeout(function () { calcBtn.textContent = 'Calculate suggested macros'; }, 1800);
        return;
      }
      var rec = MCMacroCalc.recommend(profSnapshot);
      cur = { kcal: rec.kcal, p: rec.p, f: rec.f, c: rec.c };
      calcBtn.textContent = 'Recalculate';
      buildAdjust();
      adjust.style.display = 'block';
      adjust.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // if goals already exist, show the adjust section straight away
    if (cur) { profSnapshot = data.profile || readProfile(); calcBtn.textContent = 'Recalculate'; buildAdjust(); adjust.style.display = 'block'; }
  }

  // ---- search sheet --------------------------------------------------------
  function openSearch() {
    var s = sheet('Search foods', 'Powered by Open Food Facts.');
    var input = el('input', 'nt-input');
    input.type = 'search'; input.placeholder = 'e.g. "chobani yogurt", "rxbar"…';
    s.sh.appendChild(input);
    var results = el('div', 'nt-results');
    s.sh.appendChild(results);

    var timer = null;
    function run() {
      var q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      results.innerHTML = '<div class="nt-results-msg">Searching…</div>';
      MCFoodAPI.search(q).then(function (items) {
        if (!items.length) { results.innerHTML = '<div class="nt-results-msg">No matches. Try a different term or add it manually.</div>'; return; }
        results.innerHTML = '';
        items.forEach(function (it) {
          var row = el('div', 'nt-result');
          row.innerHTML =
            '<div class="nt-result-main">' +
              '<div class="nt-result-name">' + esc(it.name) + '</div>' +
              '<div class="nt-result-sub">' + (it.brand ? esc(it.brand) + ' · ' : '') + 'per ' + esc(it.servingLabel) + '</div>' +
            '</div>' +
            '<div class="nt-result-kcal">' + it.kcal + '<span>kcal</span></div>';
          row.onclick = function () {
            addEntry({ name: it.name + (it.brand ? ' (' + it.brand + ')' : ''), source: 'search', unit: it.basis, qty: 1, per: { kcal: it.kcal, p: it.p, f: it.f, c: it.c } });
            s.close(); render();
          };
          results.appendChild(row);
        });
      });
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 350); });
    setTimeout(function () { input.focus(); }, 250);
  }

  // ---- manual entry sheet --------------------------------------------------
  function openManual(prefill) {
    prefill = prefill || {};
    var s = sheet('Manual entry', 'Per serving — quantity is set below.');
    var form = el('div', 'nt-form');
    form.innerHTML =
      '<label class="nt-field"><span>Food name</span><input id="mName" type="text" value="' + esc(prefill.name || '') + '" placeholder="Ribeye steak"></label>' +
      '<div class="nt-grid2">' +
        '<label class="nt-field"><span>Calories</span><input id="mK" type="number" inputmode="numeric" value="' + (prefill.kcal != null ? esc(prefill.kcal) : '') + '"></label>' +
        '<label class="nt-field"><span>Servings</span><input id="mQ" type="number" inputmode="decimal" value="' + (prefill.qty || 1) + '"></label>' +
      '</div>' +
      '<div class="nt-grid3">' +
        '<label class="nt-field"><span>Protein g</span><input id="mP" type="number" inputmode="numeric" value="' + (prefill.p != null ? esc(prefill.p) : '') + '"></label>' +
        '<label class="nt-field"><span>Fat g</span><input id="mF" type="number" inputmode="numeric" value="' + (prefill.f != null ? esc(prefill.f) : '') + '"></label>' +
        '<label class="nt-field"><span>Carbs g</span><input id="mC" type="number" inputmode="numeric" value="' + (prefill.c != null ? esc(prefill.c) : '') + '"></label>' +
      '</div>';
    s.sh.appendChild(form);
    var add = el('button', 'nt-btn nt-btn-gold', 'Add to today');
    add.onclick = function () {
      var name = $('#mName', s.sh).value.trim();
      if (!name) { add.textContent = 'Enter a name first'; setTimeout(function () { add.textContent = 'Add to today'; }, 1500); return; }
      addEntry({
        name: name, source: 'manual', unit: 'serving', qty: num($('#mQ', s.sh).value, 1),
        per: { kcal: num($('#mK', s.sh).value), p: num($('#mP', s.sh).value), f: num($('#mF', s.sh).value), c: num($('#mC', s.sh).value) }
      });
      s.close(); render();
    };
    s.sh.appendChild(add);
  }

  // ---- edit logged entry ---------------------------------------------------
  function openEdit(id) {
    var data = read(), day = getDay(data, todayKey());
    var entry = null;
    day.entries.forEach(function (e) { if (e.id === id) entry = e; });
    if (!entry) return;
    var s = sheet(entry.name, 'Adjust quantity or remove.');
    var qWrap = el('div', 'nt-form');
    s.sh.appendChild(qWrap);
    var qStep = stepperFloat('Servings', num(entry.qty, 1));
    qWrap.appendChild(qStep);

    var save = el('button', 'nt-btn nt-btn-gold', 'Save');
    save.onclick = function () {
      var obj = read(), d = getDay(obj, todayKey());
      d.entries.forEach(function (e) { if (e.id === id) e.qty = qStep.value(); });
      write(obj); s.close(); render();
    };
    var del = el('button', 'nt-btn nt-btn-danger', 'Remove from log');
    del.onclick = function () {
      var obj = read(), d = getDay(obj, todayKey());
      d.entries = d.entries.filter(function (e) { return e.id !== id; });
      write(obj); s.close(); render();
    };
    s.sh.appendChild(save); s.sh.appendChild(del);
  }

  // a float-friendly stepper for servings (0.5 step)
  function stepperFloat(label, value) {
    var row = el('div', 'nt-step');
    row.innerHTML = '<div class="nt-step-lbl">' + esc(label) + '</div>';
    var ctl = el('div', 'nt-step-ctl');
    var minus = el('button', 'nt-step-btn', '−');
    var val = el('div', 'nt-step-val', String(value));
    var plus = el('button', 'nt-step-btn', '+');
    function set(v) { v = Math.max(0.5, Math.round(v * 2) / 2); val.textContent = String(v); }
    minus.onclick = function () { set(num(val.textContent) - 0.5); };
    plus.onclick = function () { set(num(val.textContent) + 0.5); };
    ctl.appendChild(minus); ctl.appendChild(val); ctl.appendChild(plus);
    row.appendChild(ctl);
    row.value = function () { return num(val.textContent, 1); };
    return row;
  }

  // ---- add an entry to today ----------------------------------------------
  function addEntry(e) {
    var obj = read(), day = getDay(obj, todayKey());
    e.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    e.ts = Date.now();
    day.entries.push(e);
    write(obj);
  }

  // ---- deep-link ingestion (cookbook "Log to tracker" handoff, Phase 3) ----
  // dashboard.html?tab=nutrition&log=1&name=…&kcal=…&p=…&f=…&c=…
  function consumeDeepLink() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('log') !== '1') return;
      var pre = { name: q.get('name') || '', kcal: q.get('kcal') || '', p: q.get('p') || '', f: q.get('f') || '', c: q.get('c') || '' };
      // strip the handoff params so a refresh doesn't re-open the sheet
      ['log', 'name', 'kcal', 'p', 'f', 'c'].forEach(function (k) { q.delete(k); });
      var qs = q.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      openManual(pre);
    } catch (e) {}
  }

  // re-render when another tab/device changes the store (sync pull)
  window.addEventListener('storage', function (ev) { if (ev.key === KEY) render(); });

  render();
  consumeDeepLink();
  window.MCMacros = { render: render, openCalculator: openCalculator };
})();
