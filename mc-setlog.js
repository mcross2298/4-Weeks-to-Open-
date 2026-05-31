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
  var PID = location.pathname.split('/').pop().replace('.html', '');

  // ---- storage (shape-compatible with the Finish-Workout module) ---------
  function st() { try { return JSON.parse(localStorage.getItem(SK) || '{}'); } catch (e) { return {}; } }
  function ek(id) { return PID + '|' + id; }
  function save(exId, sn, w, r) {
    var s = st(), k = ek(exId); if (!s[k]) s[k] = [];
    var d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var sess = s[k][0];
    if (!sess || sess.d !== d) { sess = { d: d, sets: {} }; s[k].unshift(sess); s[k] = s[k].slice(0, 20); }
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
    if (rs > 0 && typeof TMR !== 'undefined') {
      var t = card.querySelector('.rest-timer');
      if (t) { try { (typeof buildTimerFloat === 'function') && buildTimerFloat(); } catch (e) {} TMR.start(t, rs, 'Rest'); }
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
    // remove any native logger so there is exactly one
    Array.prototype.forEach.call(host.querySelectorAll('.setlog-toggle, .setlog-wrap'), function (n) { n.remove(); });
    if (host.querySelector('.mcl-wrap')) return;   // ours already present

    var cid = cssId(exId), n = setCount(setsStr);

    var toggle = document.createElement('div');
    toggle.className = 'mcl-toggle';
    toggle.innerHTML = '<span class="mcl-chev">▾</span><span class="mcl-lbl">Log Sets</span>' +
                       '<span class="mcl-hist mcl-hist-' + cid + '">' + histText(exId) + '</span>';

    var wrap = document.createElement('div');
    wrap.className = 'mcl-wrap';
    var html = '<div class="mcl-hdr"><div class="mcl-hl">Set</div><div class="mcl-hl">Weight</div>' +
               '<div class="mcl-hl">Reps</div><div class="mcl-hl"></div></div>';
    for (var i = 0; i < n; i++) {
      var sn = i + 1, last = lset(exId, sn), pr = repFor(setsStr, i);
      var wPh = (last && last.w) ? (last.w + ' lb') : 'lb';
      var rPh = pr || (last && last.r ? last.r : 'reps');
      html += '<div class="mcl-row" id="mclr-' + cid + '-' + sn + '">' +
                '<div class="mcl-num">' + sn + '</div>' +
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
        onCheck(card, exId, parseInt(ck.dataset.sn, 10), rs);
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
  function setsOf(card) { var se = card.querySelector('.ex-sets'); return se ? se.textContent.trim() : ''; }
  function nameId(card) {
    var nm = card.querySelector('.ex-name, .ss-name, .lift-name');
    return 'x-' + ((nm ? nm.textContent : '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 24) || Math.random().toString(36).slice(2, 7));
  }

  function run() {
    document.querySelectorAll('.ex-card[data-id]').forEach(function (c) {
      build(c.querySelector('.ex-content') || c, c, c.dataset.id, setsOf(c), restSecs(c));
    });
    document.querySelectorAll('.ss-ex[data-id]').forEach(function (c) {
      build(c.querySelector('.ss-content') || c, c, c.dataset.id, setsOf(c), 90);
    });
    document.querySelectorAll('.ex-item').forEach(function (c) {
      build(c, c, c.dataset.id || nameId(c), setsOf(c), restSecs(c));
    });
    document.querySelectorAll('.lift-card').forEach(function (c) {
      build(c, c, liftId(c), (function () { var m = c.querySelector('.lift-meta'); return m ? m.textContent.trim() : ''; })(), restSecs(c));
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
