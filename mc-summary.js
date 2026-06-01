/* ==========================================================================
   mc-summary.js  —  live Workout Summary + daily session tracking
   --------------------------------------------------------------------------
   Turns the previously STATIC "Workout Summary" card (hard-coded totals like
   "32 sets / ~390 reps") into a LIVE readout driven by what the lifter actually
   checks off during the workout:
     • Sets   → completed / planned
     • Reps   → completed (best-effort from the prescribed rep scheme)
     • %      → exercises complete
   Plus a live progress bar, completed-row strikethrough, and a compact
   "📊 Summary" jump button injected into the Finish-Workout bar.

   Phase 1 (universal deployment):
   - If a page has workout cards but NO static `.sum-section`, this module now
     AUTO-BUILDS a self-contained summary card (styled by mc-summary.css), so the
     summary is universal across every workout page regardless of template.
   - DAILY SESSION TRACKING: every time progress changes, today's session for
     this program is persisted to `mc_daily_v1` (keyed YYYY-MM-DD|pid), giving a
     real per-day session history that workout-logs.html (and the card's "Today"
     line) can read back.

   Pure DOM; recomputes on every check-off via a class MutationObserver.
   Self-contained IIFE.
   ========================================================================== */
(function () {
  if (window.__mcSummary) return;
  window.__mcSummary = true;

  var CARD_SEL = '.ex-card, .ss-ex, .ex-item, .lift-card';
  var NAME_SEL = '.ex-name, .ss-name, .lift-name';
  // Two summary markups exist in the app:
  //   .sum-section    — Phase-3 live card (+ the auto-built card below)
  //   .summary-section — MC-favorite / PMC gold card (rich static breakdown)
  // We enhance BOTH into the same hybrid: rich breakdown + live progress bar.
  var SUMSEC_SEL = '.sum-section, .summary-section';
  var ROWNAME_SEL = '.sum-nm, .sum-name';
  var DAILY_KEY = 'mc_daily_v1';
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html', '') || 'workout');

  function programName() {
    var h = document.querySelector('.workout-title, .wk-title, .topbar-title, h1');
    var t = (h && h.textContent || document.title || '').trim();
    return t.replace(/\s*[—-]\s*MC Training.*$/i, '').slice(0, 60) || PID;
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

  function cardSetsReps(card) {
    var el = card.querySelector('.ex-sets, .lift-meta, [data-field="sets"]');
    return parseSetsReps(el ? el.textContent : '');
  }
  function cardName(card) {
    var el = card.querySelector(NAME_SEL);
    return (el ? el.textContent : '').trim();
  }

  // ---- compute planned + completed totals --------------------------------
  function totals() {
    var cards = document.querySelectorAll(CARD_SEL);
    var t = { planSets: 0, planReps: 0, doneSets: 0, doneReps: 0, exTotal: 0, exDone: 0, doneNames: {} };
    Array.prototype.forEach.call(cards, function (c) {
      var sr = cardSetsReps(c);
      t.planSets += sr.sets; t.planReps += sr.reps; t.exTotal++;
      if (c.classList.contains('checked')) {
        t.doneSets += sr.sets; t.doneReps += sr.reps; t.exDone++;
        var nm = cardName(c); if (nm) t.doneNames[nm] = true;
      }
    });
    return t;
  }

  // ---- daily session persistence -----------------------------------------
  function saveDaily(t, pct) {
    if (!t.doneSets && !t.exDone) return;              // nothing logged yet today — don't create empty rows
    var store;
    try { store = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { store = {}; }
    var k = todayKey() + '|' + PID;
    store[k] = {
      date: todayKey(), pid: PID, program: programName(),
      planSets: t.planSets, doneSets: t.doneSets, doneReps: t.doneReps,
      exTotal: t.exTotal, exDone: t.exDone, pct: pct, ts: Date.now()
    };
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(store)); } catch (e) {}
  }
  function todayEntry() {
    var store;
    try { store = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); } catch (e) { return null; }
    return store[todayKey() + '|' + PID] || null;
  }

  // ---- render ------------------------------------------------------------
  var sumSection, sumCard, bar, fill, label, tvs, tls, todayLine;

  // Build a self-contained summary card when a page ships none (Phase 1).
  function autoBuild() {
    if (document.querySelector(SUMSEC_SEL)) return;            // a static/live card already exists
    if (!document.querySelectorAll(CARD_SEL).length) return;   // not a workout page
    var sec = document.createElement('section');
    sec.className = 'sum-section mcs-auto';
    sec.innerHTML =
      '<div class="sum-hd">📊 Workout Summary</div>' +
      '<div class="sum-card">' +
        '<div class="sum-grid">' +
          '<div class="sum-tot"><div class="sum-tv">0 / 0</div><div class="sum-tl">Sets Done</div></div>' +
          '<div class="sum-tot"><div class="sum-tv">0</div><div class="sum-tl">Reps Done</div></div>' +
          '<div class="sum-tot"><div class="sum-tv">0%</div><div class="sum-tl">Complete</div></div>' +
        '</div>' +
        '<div class="mcs-today" id="mcsToday"></div>' +
      '</div>';
    var fw = document.querySelector('.fw-bar');
    var main = document.querySelector('main, .content, .workout-wrap, #app') || document.body;
    if (fw && fw.parentNode) fw.parentNode.insertBefore(sec, fw);
    else main.appendChild(sec);
  }

  function ensureChrome() {
    sumSection = document.querySelector(SUMSEC_SEL);
    if (!sumSection) return false;
    sumCard = sumSection.querySelector('.sum-card') || sumSection;
    if (!bar) {
      var wrap = document.createElement('div');
      wrap.className = 'mcs-progress';
      wrap.innerHTML = '<div class="mcs-progress-top"><span class="mcs-progress-label">Live progress</span>' +
                       '<span class="mcs-progress-pct" id="mcsPct">0%</span></div>' +
                       '<div class="mcs-progress-track"><div class="mcs-progress-fill" id="mcsFill"></div></div>';
      sumCard.insertBefore(wrap, sumCard.firstChild);
      bar = wrap;
      fill = wrap.querySelector('#mcsFill');
      label = wrap.querySelector('#mcsPct');
    }
    tvs = sumSection.querySelectorAll('.sum-tv');
    tls = sumSection.querySelectorAll('.sum-tl');
    todayLine = sumSection.querySelector('.mcs-today');
    if (!todayLine) {
      todayLine = document.createElement('div');
      todayLine.className = 'mcs-today';
      sumCard.appendChild(todayLine);
    }
    return true;
  }

  function recompute() {
    autoBuild();
    if (!ensureChrome()) return;
    injectSummaryButton();   // the .fw-bar may be rendered late by the page's own JS
    var t = totals();
    var pct = t.exTotal ? Math.round((t.exDone / t.exTotal) * 100) : 0;

    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
    sumSection.classList.toggle('mcs-complete', pct === 100 && t.exTotal > 0);

    if (tvs && tvs.length >= 3) {
      tvs[0].textContent = t.doneSets + ' / ' + t.planSets;
      tvs[1].textContent = String(t.doneReps);
      tvs[2].textContent = pct + '%';
    }
    if (tls && tls.length >= 3) {
      tls[0].textContent = 'Sets Done';
      tls[1].textContent = 'Reps Done';
      tls[2].textContent = 'Complete';
    }

    // persist today's session + reflect it on the card
    saveDaily(t, pct);
    if (todayLine) {
      var e = todayEntry();
      todayLine.textContent = e
        ? '✅ Saved today · ' + e.doneSets + ' sets · ' + e.doneReps + ' reps logged'
        : '';
      todayLine.style.display = e ? '' : 'none';
    }

    // strike-through completed exercises in the summary list (match by name)
    Array.prototype.forEach.call(sumSection.querySelectorAll('.sum-row'), function (row) {
      var nm = row.querySelector(ROWNAME_SEL);
      var done = nm && t.doneNames[nm.textContent.trim()];
      row.classList.toggle('mcs-row-done', !!done);
    });
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
      if (sumSection) sumSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    fwbar.insertBefore(btn, fwbar.firstChild);
  }

  // ---- init --------------------------------------------------------------
  var t = null;
  function schedule() { clearTimeout(t); t = setTimeout(recompute, 150); }

  function init() {
    autoBuild();
    ensureChrome();
    injectSummaryButton();
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
