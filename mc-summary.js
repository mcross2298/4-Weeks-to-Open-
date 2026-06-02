/* ==========================================================================
   mc-summary.js  —  live Workout Summary + daily session tracking
   --------------------------------------------------------------------------
   Universal, session-specific "Workout Summary" card across EVERY program.

   The MC Splits card is the gold standard: a per-lift breakdown
   (icon · name · sets/reps) inside a themed card, plus a live progress bar
   and three live totals (Exercises / Sets Done / Reps Done).

   This module makes every other program (PMC, STNDR, Daily Gainz, Daily Pump,
   Faint, PSU, …) match that look:

   PATH A — pages that ship the rich MC `.summary-section` (MC Splits):
     keep their hand-authored gold breakdown; only overlay the live progress
     bar + rewrite the three totals to live session metrics.

   PATH B — every other workout page (static `.sum-section` OR pages that ship
     no summary at all):
     (RE)BUILD the entire card from the exercise cards CURRENTLY VISIBLE on the
     page — i.e. the current day / current week — so the breakdown always
     reflects today's actual workout instead of a static whole-program split.
     Each program keeps its own accent colour (read from its `.sum-hd` theme).

   DAILY SESSION TRACKING: every progress change persists today's session for
   this program to `mc_daily_v1` (keyed YYYY-MM-DD|pid) for workout-logs.html.

   Pure DOM, recomputes on every check-off via a class/childList
   MutationObserver. Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__mcSummary) return;
  window.__mcSummary = true;

  var CARD_SEL = '.ex-card, .ss-ex, .ex-item, .lift-card';
  var NAME_SEL = '.ex-name, .ss-name, .lift-name';
  var SETS_SEL = '.ex-sets, .lift-meta, [data-field="sets"]';
  // Two summary markups exist in the app:
  //   .summary-section — MC gold card (rich hand-authored breakdown)  → PATH A
  //   .sum-section     — every other program's card / auto-built card → PATH B
  var SUMSEC_SEL = '.sum-section, .summary-section';
  var DAILY_KEY = 'mc_daily_v1';
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html', '') || 'workout');

  var GOLD = { r: 245, g: 200, b: 66 };

  // ---- small utils -------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }
  function programName() {
    var h = document.querySelector('.workout-title, .wk-title, .topbar-title, h1');
    var t = (h && h.textContent || document.title || '').trim();
    return t.replace(/\s*[—-]\s*MC Training.*$/i, '').slice(0, 60) || PID;
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---- visible exercise cards (current day / current week only) ----------
  function cards() {
    return Array.prototype.filter.call(document.querySelectorAll(CARD_SEL), isVisible);
  }

  // ---- parse a "sets" string into {sets, reps} ---------------------------
  // Handles: "12, 10, 8, 6" (4 sets / 36 reps), "5 × 5" (5 sets / 25 reps),
  // "10, 10, 10 / 10, 10, 10" (superset groups), "AMRAP in 2 min" (1 set / 0),
  // "100 reps as quick as possible" (1 set / 100 reps).
  function parseSetsReps(txt) {
    txt = (txt || '').replace(/⏱️[^]*$/, '').trim();   // drop any trailing timer pill text
    if (!txt) return { sets: 0, reps: 0 };
    var mx = txt.match(/(\d+)\s*[×x]\s*(\d+)/);
    if (mx) { var s = +mx[1]; return { sets: s, reps: s * (+mx[2]) }; }
    var tokens = txt.split(/[,/]/).map(function (t) { return t.trim(); }).filter(Boolean);
    var setTokens = tokens.filter(function (t) { return /\d/.test(t) || /amrap|max|failure/i.test(t); });
    var reps = 0;
    setTokens.forEach(function (t) {
      if (/amrap|max|failure/i.test(t)) return;        // unknown rep count
      var n = t.match(/\d+/); if (n) reps += +n[0];
    });
    var sets = setTokens.length || 1;
    return { sets: sets, reps: reps };
  }

  function cardSetsText(card) {
    var els = card.querySelectorAll(SETS_SEL);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.classList && el.classList.contains('rest-timer')) continue;
      var txt = (el.textContent || '').trim();
      if (txt && /\d/.test(txt) && !/^⏱️/.test(txt)) return txt;
    }
    return els.length ? (els[0].textContent || '').trim() : '';
  }
  function cardSetsReps(card) { return parseSetsReps(cardSetsText(card)); }
  function cardName(card) {
    var el = card.querySelector(NAME_SEL);
    return (el ? el.textContent : '').trim();
  }
  function cleanScheme(txt) {
    return (txt || '').replace(/⏱️[^]*$/, '').replace(/\s+/g, ' ').trim().slice(0, 42);
  }

  // ---- per-lift icon (cosmetic, keeps the MC "by-lift" feel) -------------
  function iconFor(name, scheme) {
    var n = ((name || '') + ' ' + (scheme || '')).toLowerCase();
    if (/amrap|to failure|\bfailure\b/.test(n)) return '💀';
    if (/calf|calves/.test(n)) return '🦶';
    if (/shoulder|delt|lateral raise|overhead press|military|arnold|upright row|face pull/.test(n)) return '🏔️';
    if (/squat|leg press|lunge|hack|leg extension|hip thrust|leg curl|hamstring|\bham\b|rdl|romanian|deadlift|good morning|glute|step.?up/.test(n)) return '🦵';
    if (/tricep|pushdown|skull|kickback|overhead extension|\bdip\b/.test(n)) return '💪';
    if (/back|\brow\b|pull-?up|pull-?down|chin|\blat\b|shrug|\btrap/.test(n)) return '🪝';
    if (/bench|chest|\bfly\b|flye|incline|decline|\bpec\b|push-?up|press/.test(n)) return '🫷';
    if (/\babs?\b|core|crunch|plank|knee raise|sit-?up|leg raise|hollow/.test(n)) return '🔥';
    if (/bicep|curl|preacher|hammer/.test(n)) return '💪';
    return '🏋️';
  }

  // ---- accent colour (each program keeps its own theme) ------------------
  function parseRgb(s) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s || '');
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  }
  function isGray(c) { return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 20; }
  function rgb(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }
  function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
  // Reads the page's own `.sum-hd { color: … }` theme via a throwaway probe so
  // PMC stays cyan, STNDR blue, Pump green, etc. Falls back to MC gold.
  function accentOf() {
    var probe = document.createElement('div');
    probe.className = 'sum-hd';
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;height:0;overflow:hidden;';
    document.body.appendChild(probe);
    var c = parseRgb(getComputedStyle(probe).color);
    if (probe.parentNode) probe.parentNode.removeChild(probe);
    if (!c || isGray(c)) return GOLD;
    return c;
  }

  // ---- compute live session totals (visible cards only) ------------------
  function totals() {
    var t = { doneSets: 0, doneReps: 0, exTotal: 0, exDone: 0, doneNames: {} };
    cards().forEach(function (c) {
      var sr = cardSetsReps(c); t.exTotal++;
      if (c.classList.contains('checked')) {
        t.doneSets += sr.sets; t.doneReps += sr.reps; t.exDone++;
        var nm = cardName(c); if (nm) t.doneNames[nm] = true;
      }
    });
    return t;
  }

  // ---- daily session persistence -----------------------------------------
  function saveDaily(t, pct) {
    if (!t.doneSets && !t.exDone) return;              // nothing logged yet today
    var store;
    try { store = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { store = {}; }
    var k = todayKey() + '|' + PID;
    store[k] = {
      date: todayKey(), pid: PID, program: programName(),
      doneSets: t.doneSets, doneReps: t.doneReps,
      exTotal: t.exTotal, exDone: t.exDone, pct: pct, ts: Date.now()
    };
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(store)); } catch (e) {}
  }
  function todayEntry() {
    var store;
    try { store = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { return null; }
    return store[todayKey() + '|' + PID] || null;
  }
  function todayLineText() {
    var e = todayEntry();
    return e ? '✅ Saved today · ' + e.doneSets + ' sets · ' + e.doneReps + ' reps logged' : '';
  }

  // ---- a session subtitle (muscle groups / day title) --------------------
  function subtitle() {
    var el = document.querySelector('.sum-subtitle, .title, .workout-title, .day-session');
    var s = el ? (el.textContent || '').trim() : '';
    s = s.replace(/\s*[—-]\s*MC Training.*$/i, '').trim();
    return s.slice(0, 60);
  }

  // =========================================================================
  // PATH A — MC gold standard `.summary-section`: keep static breakdown,
  //          overlay live progress bar + rewrite the three totals.
  // =========================================================================
  function renderMC(host) {
    var card = host.querySelector('.sum-card') || host;
    if (!host.querySelector('.mcs-progress')) {
      var wrap = document.createElement('div');
      wrap.className = 'mcs-progress';
      wrap.innerHTML = '<div class="mcs-progress-top"><span class="mcs-progress-label">Live progress</span>' +
                       '<span class="mcs-progress-pct" id="mcsPct">0%</span></div>' +
                       '<div class="mcs-progress-track"><div class="mcs-progress-fill" id="mcsFill"></div></div>';
      card.insertBefore(wrap, card.firstChild);
    }
    var t = totals();
    var pct = t.exTotal ? Math.round((t.exDone / t.exTotal) * 100) : 0;
    var fill = host.querySelector('#mcsFill'), label = host.querySelector('#mcsPct');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
    host.classList.toggle('mcs-complete', pct === 100 && t.exTotal > 0);

    var tvs = host.querySelectorAll('.sum-total-val');
    var tls = host.querySelectorAll('.sum-total-label');
    if (tvs.length >= 3) {
      tvs[0].textContent = t.exDone + ' / ' + t.exTotal;
      tvs[1].textContent = String(t.doneSets);
      tvs[2].textContent = String(t.doneReps);
    }
    if (tls.length >= 3) {
      tls[0].textContent = 'Exercises'; tls[1].textContent = 'Sets Done'; tls[2].textContent = 'Reps Done';
    }

    saveDaily(t, pct);
    var tl = host.querySelector('.mcs-today');
    if (!tl) { tl = document.createElement('div'); tl.className = 'mcs-today'; card.appendChild(tl); }
    tl.textContent = todayLineText();
    tl.style.display = tl.textContent ? '' : 'none';

    Array.prototype.forEach.call(host.querySelectorAll('.sum-row'), function (row) {
      var nm = row.querySelector('.sum-name, .sum-nm');
      var done = nm && t.doneNames[nm.textContent.trim()];
      row.classList.toggle('mcs-row-done', !!done);
    });
  }

  // =========================================================================
  // PATH B — every other program: (re)build the whole card from the exercise
  //          cards currently visible (current day / week), themed per program.
  // =========================================================================
  function totCard(val, lbl, acc) {
    return '<div class="sum-tot" style="background:' + rgba(acc, 0.08) + ';border:1px solid ' + rgba(acc, 0.16) + ';">' +
             '<div class="sum-tv" style="color:' + rgb(acc) + ';">' + esc(val) + '</div>' +
             '<div class="sum-tl" style="color:' + rgb(acc) + ';">' + esc(lbl) + '</div>' +
           '</div>';
  }
  function rowsHTML(acc) {
    var html = '';
    cards().forEach(function (c) {
      var nm = cardName(c); if (!nm) return;
      var setsTxt = cardSetsText(c);
      var sr = parseSetsReps(setsTxt);
      var done = c.classList.contains('checked');
      var setLabel = sr.sets ? (sr.sets + ' set' + (sr.sets > 1 ? 's' : '')) : '—';
      var repLabel = cleanScheme(setsTxt);
      html += '<div class="sum-row' + (done ? ' mcs-row-done' : '') + '" style="border-bottom-color:' + rgba(acc, 0.13) + ';">' +
                '<span class="sum-ico">' + iconFor(nm, setsTxt) + '</span>' +
                '<span class="sum-nm">' + esc(nm) + '</span>' +
                '<div class="sum-dt">' +
                  '<span class="sum-st" style="color:' + rgb(acc) + ';">' + setLabel + '</span>' +
                  (repLabel ? '<span class="sum-rp" style="color:' + rgb(acc) + ';">' + esc(repLabel) + '</span>' : '') +
                '</div>' +
              '</div>';
    });
    return html;
  }
  function buildGenerated(host) {
    var acc = accentOf();
    var t = totals();
    var pct = t.exTotal ? Math.round((t.exDone / t.exTotal) * 100) : 0;
    // signature so we only touch the DOM when the visible workout/state changes
    var sig = pct + '|' + cards().map(function (c) {
      return cardName(c) + (c.classList.contains('checked') ? '1' : '0');
    }).join('~') + '|' + todayLineText();
    if (host.__mcsSig === sig) return;
    host.__mcsSig = sig;

    var sub = subtitle();
    var today = todayLineText();
    host.innerHTML =
      '<div class="sum-hd" style="color:' + rgb(acc) + ';">📊 Workout Summary' +
        '<span style="flex:1;height:1px;background:linear-gradient(90deg,' + rgba(acc, 0.3) + ',transparent);display:block;margin-left:8px;"></span>' +
      '</div>' +
      // dark base card (readable on both dark- and light-themed programs),
      // matching the MC / static cards, with the program's accent border.
      '<div class="sum-card" style="background:rgba(10,14,24,0.92);border:1px solid ' + rgba(acc, 0.28) + ';">' +
        '<div class="mcs-progress">' +
          '<div class="mcs-progress-top"><span class="mcs-progress-label">Live progress</span>' +
          '<span class="mcs-progress-pct" style="color:' + rgb(acc) + ';">' + pct + '%</span></div>' +
          '<div class="mcs-progress-track"><div class="mcs-progress-fill" style="width:' + pct + '%;background:' + rgb(acc) + ';"></div></div>' +
        '</div>' +
        (sub ? '<div class="sum-sub" style="color:' + rgb(acc) + ';">' + esc(sub) + '</div>' : '') +
        '<div class="mcs-rows">' + rowsHTML(acc) + '</div>' +
        '<div class="sum-div" style="background:' + rgba(acc, 0.18) + ';"></div>' +
        '<div class="sum-grid">' +
          totCard(t.exDone + ' / ' + t.exTotal, 'Exercises', acc) +
          totCard(String(t.doneSets), 'Sets Done', acc) +
          totCard(String(t.doneReps), 'Reps Done', acc) +
        '</div>' +
        (today ? '<div class="mcs-today">' + esc(today) + '</div>' : '') +
      '</div>';
    host.classList.toggle('mcs-complete', pct === 100 && t.exTotal > 0);
    saveDaily(t, pct);
  }

  // ---- auto-build an empty host when a page ships no summary at all -------
  function autoBuild() {
    if (document.querySelector(SUMSEC_SEL)) return;            // a card already exists
    if (!cards().length) return;                               // not a workout page
    var sec = document.createElement('section');
    sec.className = 'sum-section mcs-auto';
    var fw = document.querySelector('.fw-bar');
    var main = document.querySelector('main, .content, .workout-wrap, #app') || document.body;
    if (fw && fw.parentNode) fw.parentNode.insertBefore(sec, fw);
    else main.appendChild(sec);
  }

  // ---- "Summary" jump button in the Finish-Workout bar -------------------
  function injectSummaryButton() {
    var fwbar = document.querySelector('.fw-bar');
    if (!fwbar || fwbar.querySelector('.mcs-sumbtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mcs-sumbtn';
    btn.innerHTML = '📊<span>Summary</span>';
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var host = document.querySelector(SUMSEC_SEL);
      if (host) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    fwbar.insertBefore(btn, fwbar.firstChild);
  }

  // ---- main recompute ----------------------------------------------------
  var writing = false;
  function recompute() {
    writing = true;
    try {
      autoBuild();
      injectSummaryButton();
      var host = document.querySelector(SUMSEC_SEL);
      if (!host) return;
      if (host.classList.contains('summary-section')) {
        renderMC(host);                 // PATH A — MC gold standard
      } else if (cards().length) {
        buildGenerated(host);           // PATH B — regenerate from today's lifts
      }
      // else: a static `.sum-section` on a page with no standard exercise
      // cards (e.g. conditioning rounds/steps/cardio) — leave it untouched.
    } finally {
      setTimeout(function () { writing = false; }, 0);
    }
  }

  var tId = null;
  function schedule() { if (writing) return; clearTimeout(tId); tId = setTimeout(recompute, 150); }

  function init() {
    recompute();
    var mo = new MutationObserver(schedule);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
    setTimeout(recompute, 400);   // catch late render()/setTimeout pages
    setTimeout(recompute, 1000);
    setTimeout(recompute, 2200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // expose the daily store for workout-logs.html
  window.mcDailySessions = function () {
    try { return JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { return {}; }
  };
})();
