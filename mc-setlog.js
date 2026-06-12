/* ==========================================================================
   mc-setlog.js  —  shared set/rep logger (single source of truth)
   --------------------------------------------------------------------------
   Renders the per-set WEIGHT/REPS logger under every exercise card, on every
   workout page, deterministically — replacing the per-page inline scripts that
   were rendering inconsistently. Hardened: does NOT depend on a page's #app
   watch-loop or render timing; runs on its own observer + retry passes.

   Compatibility (so nothing else breaks):
   - Persists to the SAME store ('mc_setlog_v1', keyed PID|exId, sets{sn:{w,r}})
     that the Finish-Workout module reads for history/PRs.
   - Each set's checkbox carries class .set-check and toggles .done, so the
     existing progress observer ("X / Y sets") and Finish-Workout counter pick
     it up with no change.
   - Removes any native .setlog-toggle/.setlog-wrap so there is exactly one
     logger, then renders its own (.mcl-*). Re-runs briefly to win any race
     with the late native render, which then no-ops.
   ========================================================================== */
(function () {
  if (window.__mcSetlog) return;
  window.__mcSetlog = true;

  var SK  = 'mc_setlog_v1';
  // PID namespaces persistence per program. Custom "Build Your Own" workouts run
  // through run-workout.html and set window.MC_PID_OVERRIDE so each saved workout
  // keeps its own logging history instead of colliding on the shared filename.
  var PID = (window.MC_PID_OVERRIDE || location.pathname.split('/').pop().replace('.html', ''));

  // ---- storage (shape-compatible with the Finish-Workout module) ---------
  function st() { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) { return {}; } }
  function ek(id) { return PID + '|' + id; }
  function save(exId, sn, w, r, rpe) {
    var s = st(), k = ek(exId); if (!s[k]) s[k] = [];
    var d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var sess = s[k][0];
    if (!sess || sess.d !== d) { sess = { d: d, sets: {} }; s[k].unshift(sess); s[k] = s[k].slice(0, 5); }
    var entry = { w: w, r: r };
    if (rpe) entry.rpe = rpe;          // optional — older readers ignore it
    sess.sets[sn] = entry;
    try { localStorage.setItem(SK, JSON.stringify(s)); } catch (e) {}
  }
  function lsess(exId) { var s = st(); return (s[ek(exId)] || [])[0] || null; }
  function lset(exId, sn) { var sess = lsess(exId); return sess ? sess.sets[sn] || null : null; }
  function histText(exId) {
    var sess = lsess(exId); if (!sess) return '';
    var top = null;
    Object.keys(sess.sets).forEach(function (k) {
      var w = parseFloat(sess.sets[k].w) || 0;
      if (w && (!top || w > top.w)) top = { w: w, rpe: sess.sets[k].rpe };
    });
    if (!top) return sess.d;
    return 'Last: ' + top.w + ' lb' + (top.rpe ? ' @' + top.rpe : '') + ' · ' + sess.d;
  }

  // RPE chip cycle: – → 8 → 8.5 → 9 → 9.5 → 10 → F (to failure) → –
  var RPE_STEPS = ['', '8', '8.5', '9', '9.5', '10', 'F'];

  // ---- parse the prescribed "sets" string --------------------------------
  function setCount(s) {
    if (!s) return 3;
    var x = s.match(/^(\d+)\s*[x×]/i); if (x) return Math.min(parseInt(x[1], 10), 12);
    var c = s.split(','); if (c.length > 1) return c.length;
    var n = s.match(/^(\d+)/); return n ? Math.min(parseInt(n[1], 10), 8) : 3;
  }
  function repFor(s, i) {
    if (!s) return '';
    var c = s.split(','); if (c.length > 1) return (c[i] || c[c.length - 1]).replace(/[^\d]/g, '').slice(0, 3) || '';
    var x = s.match(/[x×]\s*(\d+)/i); if (x) return x[1];
    var n = s.match(/(\d+)/); return n ? n[1] : '';
  }

  // ---- drop-set detection -------------------------------------------------
  // A drop set is an EXTRA set tacked onto the working sets — it must not be
  // folded into the working-set count. Two notations appear across programs:
  //   • open-ended "drop set"  (Daily Gainz "3×8–12, drop set" / "(drop set)")
  //       → an AMRAP drop (strip weight, reps to failure)
  //   • numeric  "… drop N"    (PMC/MC/Pump "12,10,8,8 drop 15")
  //       → a drop with a prescribed rep target (N)
  // Returns {is, reps} where reps is the numeric target or 'AMRAP'.
  // A bare "drop" with no number and no "set" (rare) is NOT treated as a drop.
  function parseDrop(name, sets) {
    var hay = (name || '') + ' ' + (sets || '');
    if (!/drop/i.test(hay)) return { is: false, reps: '' };
    var m = hay.match(/drop\s*(\d+)/i);                 // "drop 15", "drop 8"
    if (m) return { is: true, reps: m[1] };
    if (/drop\s*set/i.test(hay)) return { is: true, reps: 'AMRAP' };
    return { is: false, reps: '' };
  }
  // Strip the trailing "drop …" clause so the WORKING sets parse cleanly
  // ("12,10,8,8 drop 15" → "12,10,8,8"; no more garbled "815" rep target).
  function stripDrop(s) { return (s || '').replace(/[, ]*\bdrop\b.*$/i, '').trim(); }

  // ---- rest seconds from the card's rest timer ---------------------------
  function restSecs(card) {
    var t = card.querySelector('.rest-timer');
    if (t && t.dataset && t.dataset.rest && typeof TMR !== 'undefined' && TMR.parseSeconds)
      return TMR.parseSeconds(t.dataset.rest) || 60;
    return 60;
  }

  // ---- check handler -----------------------------------------------------
  function onCheck(card, exId, sn, rs) {
    var row = card.querySelector('#mclr-' + cssId(exId) + '-' + sn);
    if (!row) return;
    var ck = row.querySelector('.mcl-ck');
    var w = row.querySelector('.mcl-w'), r = row.querySelector('.mcl-r');
    if (ck.classList.contains('done')) {
      ck.classList.remove('done'); ck.textContent = '☐'; row.classList.remove('done-row');
      return;
    }
    var rpeEl = row.querySelector('.mcl-rpe');
    save(exId, sn, w ? w.value.trim() : '', r ? r.value.trim() : '',
         rpeEl ? (rpeEl.dataset.rpe || '') : '');
    ck.classList.add('done'); ck.textContent = '✓'; row.classList.add('done-row');
    updateHist(card, exId);
    if (rs > 0 && typeof TMR !== 'undefined' && TMR.start) {
      var t = card.querySelector('.rest-timer');
      if (t) {
        // Use the rest value carried on the timer (from the program's data),
        // so the auto-countdown matches the prescribed rest exactly.
        var secs = (TMR.parseSeconds && TMR.parseSeconds(t.dataset.rest)) || rs;
        try { (typeof buildTimerFloat === 'function') && buildTimerFloat(); } catch (e) {}
        TMR.start(t, secs, 'Rest');
      }
    }
  }
  function updateHist(card, exId) {
    var h = card.querySelector('.mcl-hist-' + cssId(exId));
    if (h) h.textContent = histText(exId);
  }
  function cssId(id) { return String(id).replace(/[^a-zA-Z0-9_-]/g, '_'); }

  // ---- render the logger onto a host element -----------------------------
  function build(host, card, exId, setsStr, rs) {
    if (!host) return;
    // Strip any OTHER wave3 logger / notes UI EVERY pass (before the early
    // return), so page-native scripts that re-add their UI after us (e.g.
    // pmc-workout's .ex-notes) don't win the race. NOTE: we deliberately do NOT
    // strip .set-row — that is PSU's native exercise content, not a stray logger.
    Array.prototype.forEach.call(
      host.querySelectorAll('.setlog-toggle, .setlog-wrap, .note-btn, .note-area, .ex-notes-toggle, .ex-notes-wrap, .log-row'),
      function (n) { n.remove(); }
    );
    if (host.querySelector('.mcl-wrap')) return;   // ours already present

    var cid = cssId(exId);

    // Separate the WORKING sets from any appended drop set so the drop is never
    // folded into (and garbling) the working-set rows. See parseDrop/stripDrop.
    var nmEl = card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
    var drop = parseDrop(nmEl ? nmEl.textContent : '', setsStr);
    var work = drop.is ? stripDrop(setsStr) : setsStr;
    var n = setCount(work);
    var total = drop.is ? n + 1 : n;   // the appended row is the drop set
    var dropAmrap = drop.reps === 'AMRAP';

    var toggle = document.createElement('div');
    toggle.className = 'mcl-toggle';
    toggle.innerHTML = '<span class="mcl-chev">▾</span><span class="mcl-lbl">Log Sets</span>' +
                       (drop.is ? '<span class="mcl-amrap" title="' +
                          (dropAmrap ? 'Drop set — extra set to failure after your working sets'
                                     : 'Drop set — strip weight after the last set, rep out (~' + drop.reps + ')') +
                          '">' + (dropAmrap ? '+ AMRAP' : '+ DROP') + '</span>' : '') +
                       '<span class="mcl-hist mcl-hist-' + cid + '">' + histText(exId) + '</span>';

    var wrap = document.createElement('div');
    wrap.className = 'mcl-wrap';
    var html = '<div class="mcl-hdr"><div class="mcl-hl">Set</div><div class="mcl-hl">Weight</div>' +
               '<div class="mcl-hl">Reps</div><div class="mcl-hl">RPE</div><div class="mcl-hl"></div></div>';
    for (var i = 0; i < total; i++) {
      var sn = i + 1, last = lset(exId, sn);
      var isDropRow = drop.is && i === total - 1;   // the appended drop set row
      var pr = isDropRow ? '' : repFor(work, i);
      var wPh = (last && last.w) ? (last.w + ' lb') : 'lb';
      var rPh = isDropRow ? drop.reps : (pr || (last && last.r ? last.r : 'reps'));
      var rpe = (last && last.rpe) || '';
      html += '<div class="mcl-row' + (isDropRow ? ' mcl-row-amrap' : '') + '" id="mclr-' + cid + '-' + sn + '">' +
                '<div class="mcl-num">' + (isDropRow ? '↓' : sn) + '</div>' +
                '<input class="mcl-inp mcl-w" type="number" inputmode="decimal" placeholder="' + wPh + '">' +
                '<input class="mcl-inp mcl-r" type="number" inputmode="numeric" placeholder="' + rPh + '">' +
                '<div class="mcl-rpe' + (rpe ? ' set' : '') + '" data-rpe="' + rpe + '" ' +
                  'title="Rate of Perceived Exertion — tap to cycle, F = to failure">' + (rpe || '–') + '</div>' +
                '<div class="mcl-ck set-check" data-sn="' + sn + '">☐</div>' +
              '</div>';
    }
    wrap.innerHTML = html;

    // wiring
    toggle.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      var open = wrap.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.querySelector('.mcl-lbl').textContent = open ? 'Hide' : 'Log Sets';
    });
    wrap.addEventListener('click', function (e) { e.stopPropagation(); });
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-ck'), function (ck) {
      ck.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        onCheck(card, exId, parseInt(ck.dataset.sn, 10), rs);
      });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.mcl-rpe'), function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation(); e.preventDefault();
        var i = RPE_STEPS.indexOf(chip.dataset.rpe || '');
        var next = RPE_STEPS[(i + 1) % RPE_STEPS.length];
        chip.dataset.rpe = next;
        chip.textContent = next || '–';
        chip.classList.toggle('set', !!next);
        // already-checked set: persist the tweak immediately
        var row = chip.closest('.mcl-row');
        var ck = row && row.querySelector('.mcl-ck');
        if (ck && ck.classList.contains('done')) {
          var w = row.querySelector('.mcl-w'), r = row.querySelector('.mcl-r');
          save(exId, parseInt(ck.dataset.sn, 10), w ? w.value.trim() : '', r ? r.value.trim() : '', next);
          updateHist(card, exId);
        }
      });
    });

    host.appendChild(toggle);
    host.appendChild(wrap);
  }

  // ---- attach to every exercise card -------------------------------------
  function liftId(card) {
    var nm = card.querySelector('.lift-name');
    return 'psu-' + ((nm ? nm.textContent : '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 20) || 'x');
  }
  // Read the prescribed scheme from whichever element a template uses:
  //   .ex-sets        (PMC/MC/Pump/Gainz chip)
  //   [data-field=sets] / .notes-row  (STNDR editable)
  //   .lift-meta      (PSU "4 × 5" scheme)
  function setsOf(card) {
    var se = card.querySelector('.ex-sets, [data-field="sets"], .notes-row, .lift-meta');
    return se ? se.textContent.trim() : '';
  }
  // Deterministic id from the exercise name (NO random fallback — that would
  // change every pass, breaking persistence and re-rendering forever).
  // Duplicate names are disambiguated by their occurrence order in the DOM.
  function nameId(card) {
    var nm = card.querySelector('.ex-name, .ss-name, .lift-name');
    var base = (nm ? nm.textContent : '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 24) || 'ex';
    var all = document.querySelectorAll('.ex-name, .ss-name, .lift-name');
    var occ = 0, mine = card.querySelector('.ex-name, .ss-name, .lift-name');
    for (var i = 0; i < all.length; i++) {
      var t = all[i].textContent.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 24) || 'ex';
      if (t === base) { if (all[i] === mine) break; occ++; }
    }
    return 'x-' + base + (occ ? '-' + occ : '');
  }

  function run() {
    // Match cards WITH OR WITHOUT data-id. Older templates (STNDR push-pull-legs,
    // PSU psu-strength, weeks-to-open, legacy-prep, s4-*, most of pmc-workout)
    // render .ex-card/.lift-card with no data-id, so a data-id-only selector
    // silently skipped them. Fall back to a stable id derived from the name.
    document.querySelectorAll('.ex-card').forEach(function (c) {
      // host varies by template: .ex-content (PMC/MC), .ex-body (STNDR), else card
      build(c.querySelector('.ex-content') || c.querySelector('.ex-body') || c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c));
    });
    document.querySelectorAll('.ss-ex').forEach(function (c) {
      // Read the prescribed rest from the exercise's own .rest-timer (data),
      // not a hardcoded value — fallback 90s. The superset normalizer below
      // then keeps a single timer on the SECOND row and parks it under the logger.
      build(c.querySelector('.ss-content') || c.querySelector('.ex-body') || c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c) || 90);
    });
    document.querySelectorAll('.ex-item').forEach(function (c) {
      build(c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c));
    });
    // NOTE: .lift-card (PSU) is intentionally NOT handled here — PSU pages ship
    // their own complete per-set logger (.set-row: Set 1/2/3 with reps+weight+
    // checkbox). Rendering a second logger there caused duplicate rows and the
    // stray strikethroughs. PSU keeps its native logger.
    normalizeSupersetTimers();
  }

  // ---- superset rest-timer normalization ---------------------------------
  // A superset is "do A then B back-to-back, THEN rest". So there must be a
  // SINGLE rest timer, and it belongs on the SECOND exercise (B) — not the
  // first. We also park it directly under the "Log Sets" dropdown, so the rest
  // auto-starts the moment B's set row is checked off (onCheck handles that).
  function normalizeSupersetTimers() {
    document.querySelectorAll('.ss-card').forEach(function (sc) {
      var exs = sc.querySelectorAll('.ss-ex');
      if (exs.length < 2) return;
      var last = exs[exs.length - 1];
      Array.prototype.forEach.call(exs, function (ex) {
        var timers = ex.querySelectorAll('.rest-timer');
        if (ex !== last) {
          // strip rest timers from every non-final superset row
          Array.prototype.forEach.call(timers, function (t) { t.remove(); });
          return;
        }
        // final row (B): keep exactly one timer, parked under the logger
        var keep = timers[0];
        for (var i = 1; i < timers.length; i++) timers[i].remove();
        if (!keep) return;
        var host = ex.querySelector('.ss-content') || ex;
        var wrap = host.querySelector('.mcl-wrap');
        if (wrap && keep.parentNode && keep.previousElementSibling !== wrap) {
          keep.classList.add('mcl-rest-under');
          wrap.parentNode.insertBefore(keep, wrap.nextSibling);
        }
      });
    });
  }

  // shared parsing helpers for mc-suggest.js (and future analytics) — avoids
  // re-implementing the prescribed-scheme parser anywhere else
  window.MCSetlogUtil = { setCount: setCount, repFor: repFor, pid: PID, histKey: ek };

  // ---- init: run now + retry passes to win any race with native render ---
  function init() {
    run();
    [250, 700, 1500, 2600].forEach(function (d) { setTimeout(run, d); });
    var mo = new MutationObserver(function () { clearTimeout(init._t); init._t = setTimeout(run, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
