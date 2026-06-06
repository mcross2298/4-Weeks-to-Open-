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
  function save(exId, sn, w, r) {
    var s = st(), k = ek(exId); if (!s[k]) s[k] = [];
    var d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var sess = s[k][0];
    if (!sess || sess.d !== d) { sess = { d: d, sets: {} }; s[k].unshift(sess); s[k] = s[k].slice(0, 5); }
    sess.sets[sn] = { w: w, r: r };
    try { localStorage.setItem(SK, JSON.stringify(s)); } catch (e) {}
  }
  function lsess(exId) { var s = st(); return (s[ek(exId)] || [])[0] || null; }
  function lset(exId, sn) { var sess = lsess(exId); return sess ? sess.sets[sn] || null : null; }
  function histText(exId) {
    var sess = lsess(exId); if (!sess) return '';
    var ws = Object.keys(sess.sets).map(function (k) { return parseFloat(sess.sets[k].w) || 0; }).filter(Boolean);
    return ws.length ? 'Last: ' + Math.max.apply(null, ws) + ' lb · ' + sess.d : sess.d;
  }

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

  // ---- extra-set detection (drop / cluster) -------------------------------
  // Drop and cluster sets are EXTRA sets tacked onto the working sets — they
  // must not be folded into the working-set count, and they drive the strict
  // rest rule below. Notations seen across programs:
  //   DROP:    "12,10,8,8 drop 15"  /  "… drop 4 drop 6 drop 8"  (chained)
  //            "10,10,10 + 2× Drop AMRAP"  /  "(drop set)" / "drop set" (AMRAP)
  //   CLUSTER: "20,15,15,12, 2× Cluster"  /  "12 + 6× Cluster at 12 reps"
  //            "12,10,8, 3× Cluster at 6 reps"  / name "… (Cluster)"
  // Returns {type:'drop'|'cluster'|null, count:int, reps:'AMRAP'|number|''}.
  function parseExtra(name, sets) {
    var hay = (name || '') + ' ' + (sets || '');
    if (/cluster/i.test(hay)) {
      var cm = hay.match(/(\d+)\s*[x×]\s*cluster/i);
      var cr = (hay.match(/cluster\s*(?:at\s*)?(\d+)\s*rep/i) || hay.match(/at\s*(\d+)\s*rep/i) || [])[1] || '';
      return { type: 'cluster', count: cm ? parseInt(cm[1], 10) : 1, reps: cr };
    }
    if (/drop/i.test(hay)) {
      var dm = hay.match(/(\d+)\s*[x×]\s*drop/i);                 // "2× Drop"
      if (dm) return { type: 'drop', count: parseInt(dm[1], 10),
        reps: /amrap/i.test(hay) ? 'AMRAP' : ((hay.match(/drop\s*(\d+)/i) || [])[1] || 'AMRAP') };
      var chained = hay.match(/drop\s*\d+/ig) || [];             // "drop 4 drop 6 …"
      if (chained.length) return { type: 'drop', count: chained.length,
        reps: (String(chained[0]).match(/\d+/) || [])[0] };
      if (/drop\s*set|drop\s*amrap/i.test(hay)) return { type: 'drop', count: 1, reps: 'AMRAP' };
    }
    return { type: null, count: 0, reps: '' };
  }
  // Strip any trailing drop/cluster clause so the WORKING sets parse cleanly
  // ("12,10,8,8 drop 15" → "12,10,8,8"; "20,15,15,12, 2× Cluster" → "20,15,15,12").
  function stripExtra(s) {
    return (s || '')
      .replace(/[,+ ]*\b\d+\s*[x×]\s*(?:drop|cluster)\b.*$/i, '')
      .replace(/[,+ ]*\bdrop\b.*$/i, '')
      .replace(/[,+ ]*\bcluster\b.*$/i, '')
      .replace(/[,+ ]*$/, '').trim();
  }

  // ---- rest parsing (Phase 2 state machine) ------------------------------
  // Seconds for a single token ("60 sec", "2 min", "10").
  function secOf(tok) {
    if (typeof TMR !== 'undefined' && TMR.parseSeconds) { var v = TMR.parseSeconds(tok); if (v) return v; }
    var m = String(tok).match(/(\d+)/); return m ? parseInt(m[1], 10) : 0;
  }
  // Parse an authored rest string into either an explicit per-set list, or a
  // standard value + an optional "between extras" override:
  //   "60, 60, 60, 10, 10, 60 sec" → {list:[60,60,60,10,10,60]}
  //   "60 sec / 10 b/t cluster"    → {standard:60, betweenOverride:10}
  //   "90 sec"                     → {standard:90}
  function parseRest(restStr) {
    var out = { list: null, standard: null, betweenOverride: null };
    if (!restStr) return out;
    var slash = restStr.match(/(\d+)\s*(?:sec|min)?\s*\/\s*(\d+)/i);
    if (slash) { out.standard = secOf(slash[1]); out.betweenOverride = parseInt(slash[2], 10); return out; }
    if (restStr.indexOf(',') >= 0) {
      var parts = restStr.split(',').map(function (p) { return secOf(p); }).filter(function (v) { return v > 0; });
      if (parts.length > 1) { out.list = parts; return out; }
    }
    out.standard = secOf(restStr);
    return out;
  }

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
    save(exId, sn, w ? w.value.trim() : '', r ? r.value.trim() : '');
    ck.classList.add('done'); ck.textContent = '✓'; row.classList.add('done-row');
    updateHist(card, exId);
    if (rs > 0 && typeof TMR !== 'undefined' && TMR.start) {
      var t = card.querySelector('.rest-timer');
      if (t) {
        // rs is the per-row rest computed by the state machine in build() —
        // standard rest between working sets, strict 10s (drop) / 15s (cluster)
        // after the final working set and between extra sets.
        try { (typeof buildTimerFloat === 'function') && buildTimerFloat(); } catch (e) {}
        TMR.start(t, rs, 'Rest');
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

    // Separate WORKING sets from any appended drop/cluster sets so the extras
    // are never folded into the working-set rows. Detection reads the exercise
    // name, the prescribed sets string, AND the note (e.g. "Last set: drop set
    // to failure"). See parseExtra/stripExtra.
    var nmEl = card.querySelector('.ex-name, .ss-name, .lift-name, .var-name');
    var noteEl = card.querySelector('.ex-note, .ss-note, .var-note, .lift-note');
    var hayName = (nmEl ? nmEl.textContent : '') + ' ' + (noteEl ? noteEl.textContent : '');
    var extra = parseExtra(hayName, setsStr);
    var work = extra.count ? stripExtra(setsStr) : setsStr;
    var n = setCount(work);
    var total = n + extra.count;            // appended rows are the drop/cluster sets

    // ── Per-row rest state machine ──
    // standard rest between working sets; strict 10s (drop) / 15s (cluster)
    // after the final working set and between extra sets; the final extra row
    // returns to standard rest (transition to the next exercise). An explicit
    // authored per-set rest list, or a "X / Y b/t" override, always wins.
    var tEl = card.querySelector('.rest-timer');
    var prest = parseRest((tEl && tEl.dataset && tEl.dataset.rest) || '');
    var standard = prest.standard || rs || 60;
    var strict = (extra.type === 'cluster') ? 15 : 10;
    if (prest.betweenOverride) strict = prest.betweenOverride;
    function rowRest(i) {
      if (prest.list) return prest.list[Math.min(i, prest.list.length - 1)];
      if (!extra.count) return standard;
      if (i === total - 1) return standard;   // final extra → rest before next exercise
      if (i >= n - 1) return strict;          // last working set + between extras → strict
      return standard;
    }

    var badge = extra.count
      ? (extra.type === 'cluster' ? '+ ' + extra.count + '× CLUSTER'
         : (extra.reps === 'AMRAP' ? '+ AMRAP' : '+ ' + extra.count + '× DROP'))
      : '';
    var badgeTitle = !extra.count ? '' :
      (extra.type === 'cluster'
        ? 'Cluster sets — ' + strict + 's rest after your last working set and between clusters'
        : 'Drop sets — ' + strict + 's rest after your last working set and between drops');

    var toggle = document.createElement('div');
    toggle.className = 'mcl-toggle';
    toggle.innerHTML = '<span class="mcl-chev">▾</span><span class="mcl-lbl">Log Sets</span>' +
                       (badge ? '<span class="mcl-amrap" title="' + badgeTitle + '">' + badge + '</span>' : '') +
                       '<span class="mcl-hist mcl-hist-' + cid + '">' + histText(exId) + '</span>';

    var wrap = document.createElement('div');
    wrap.className = 'mcl-wrap';
    var html = '<div class="mcl-hdr"><div class="mcl-hl">Set</div><div class="mcl-hl">Weight</div>' +
               '<div class="mcl-hl">Reps</div><div class="mcl-hl"></div></div>';
    for (var i = 0; i < total; i++) {
      var sn = i + 1, last = lset(exId, sn);
      var isExtra = extra.count > 0 && i >= n;   // appended drop/cluster row
      var pr = isExtra ? '' : repFor(work, i);
      var wPh = (last && last.w) ? (last.w + ' lb') : 'lb';
      var rPh = isExtra ? (extra.reps || 'AMRAP') : (pr || (last && last.r ? last.r : 'reps'));
      var numLbl = isExtra ? (extra.type === 'cluster' ? '⊕' : '↓') : sn;
      html += '<div class="mcl-row' + (isExtra ? ' mcl-row-amrap' : '') + '" id="mclr-' + cid + '-' + sn + '">' +
                '<div class="mcl-num">' + numLbl + '</div>' +
                '<input class="mcl-inp mcl-w" type="number" inputmode="decimal" placeholder="' + wPh + '">' +
                '<input class="mcl-inp mcl-r" type="number" inputmode="numeric" placeholder="' + rPh + '">' +
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
        var sn = parseInt(ck.dataset.sn, 10);
        onCheck(card, exId, sn, rowRest(sn - 1));
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
