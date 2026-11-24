/* ==========================================================================
   mc-recovery-sheet.js — what a Recovery figure is made of
   --------------------------------------------------------------------------
   command-center-roadmap.md PR 2. Two sheets, kept apart the way H3 kept the
   two figures apart:
     muscle(id)  per-muscle recovery from logged sets (MC_READY.explain)
     vitals()    the Recovery ring from sleep and readiness (MC_VITALS.explain)
   Each is labelled an estimate: the owner accepted Recovery % as a model, not
   a measurement, so the sheet explains the model and never claims more.
   A lift row opens that lift's history (MCTrends), the second and last level.

   window.MC_RECOVERY_SHEET: { muscle(id), vitals() }
   ========================================================================== */
(function () {
  'use strict';
  if (window.MC_RECOVERY_SHEET) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function injectCss() {
    if (document.getElementById('mcRecsCss')) return;
    var st = document.createElement('style');
    st.id = 'mcRecsCss';
    st.textContent =
      '.mcrs-ov{position:fixed;inset:0;z-index:var(--z-modal,175);background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;' +
        'padding:16px;padding-top:calc(16px + env(safe-area-inset-top));padding-bottom:calc(16px + env(safe-area-inset-bottom));}' +
      '.mcrs-card{width:100%;max-width:480px;max-height:100%;overflow:auto;background:var(--surface-bg,var(--ink-1));color:var(--text);' +
        'border:1px solid var(--hairline);border-radius:var(--r-lg);padding:16px;}' +
      '.mcrs-head{display:flex;align-items:center;gap:12px;}' +
      '.mcrs-head h2{flex:1;margin:0;font-size:var(--fs-2xl);font-weight:var(--fw-bold);}' +
      '.mcrs-close{min-width:48px;min-height:48px;border:0;background:transparent;color:var(--text);font-size:var(--fs-3xl);cursor:pointer;}' +
      '.mcrs-big{font-size:var(--fs-hero);font-weight:var(--fw-bold);margin:4px 0 0;}' +
      '.mcrs-tag{font-size:var(--fs-sm);color:var(--muted);margin:0 0 12px;}' +
      '.mcrs-rows{border-top:1px solid var(--hairline);margin:0 0 12px;}' +
      '.mcrs-row{display:flex;align-items:center;gap:12px;min-height:48px;padding:8px 0;border-bottom:1px solid var(--hairline);' +
        'font-size:var(--fs-md);width:100%;background:transparent;border-left:0;border-right:0;border-top:0;color:var(--text);font-family:inherit;text-align:left;}' +
      'button.mcrs-row{cursor:pointer;}' +
      '.mcrs-row span:first-child{flex:1;min-width:0;}' +
      '.mcrs-row b{font-weight:var(--fw-bold);white-space:nowrap;}' +
      '.mcrs-note{font-size:var(--fs-sm);color:var(--muted);line-height:1.5;margin:0;}';
    document.head.appendChild(st);
  }

  function open(title, bodyHtml, onRow) {
    injectCss();
    var ov = document.createElement('div');
    ov.className = 'mcrs-ov';
    ov.setAttribute('data-mc-sheet', '');
    ov.setAttribute('aria-label', title);
    ov.innerHTML = '<div class="mcrs-card"><div class="mcrs-head"><h2>' + esc(title) + '</h2>' +
      '<button type="button" class="mcrs-close" aria-label="Close">×</button></div>' + bodyHtml + '</div>';
    function close() { ov.remove(); if (window.MC_SHEET) MC_SHEET.check(); }
    ov.addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('[data-lift],[data-log]') : null;
      if (row) { close(); onRow && onRow(row); return; }
      if (e.target === ov || (e.target.closest && e.target.closest('.mcrs-close'))) close();
    });
    document.body.appendChild(ov);
    if (window.MC_SHEET) MC_SHEET.check();
    return ov;
  }

  function when(hours) {
    if (hours < 1) return 'less than an hour';
    if (hours < 36) return 'about ' + hours + ' h';
    return 'about ' + Math.round(hours / 24) + ' days';
  }
  function dayOf(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  var STATUS = { fresh: 'Fresh', accumulating: 'Still recovering', overreached: 'Worked hard recently' };

  function muscle(id) {
    if (!window.MC_READY || !MC_READY.explain) return;
    var g = (window.MC_MUSCLES && MC_MUSCLES.groups || []).filter(function (x) { return x.id === id; })[0];
    var label = g ? g.label : id;
    var x = MC_READY.explain(id);
    var fresh = MC_READY.FRESH_MIN || 70;
    var body;
    if (!x.trained) {
      body = '<p class="mcrs-big">100%</p><p class="mcrs-tag">Estimate · nothing logged for ' + esc(label.toLowerCase()) + ' yet</p>' +
        '<p class="mcrs-note">With no finished workout that trains it, there is nothing to recover from, so it reads fully fresh.</p>';
    } else {
      body = '<p class="mcrs-big">' + x.pct + '%</p>' +
        '<p class="mcrs-tag">Estimate · ' + STATUS[x.status] + '</p>' +
        '<div class="mcrs-rows">' +
          (x.logId
            ? '<button type="button" class="mcrs-row" data-log="' + esc(x.logId) + '"><span>Last trained · ' + esc(dayOf(x.date)) +
              (x.workoutName ? ' · ' + esc(x.workoutName) : '') + '</span><b>' + x.hoursSince + ' h ago ›</b></button>'
            : '<div class="mcrs-row"><span>Last trained · ' + esc(dayOf(x.date)) + '</span><b>' + x.hoursSince + ' h ago</b></div>') +
          '<div class="mcrs-row"><span>Sets for ' + esc(label.toLowerCase()) + ' that day</span><b>' + x.sets + '</b></div>' +
          (x.nearFailureSets ? '<div class="mcrs-row"><span>Of those, to failure or RPE 9.5+</span><b>' + x.nearFailureSets + '</b></div>' : '') +
          '<div class="mcrs-row"><span>' + (x.freshInHours ? 'Reads fresh (' + fresh + '%) in' : 'Reads fresh (' + fresh + '%+)') + '</span><b>' +
            (x.freshInHours ? when(x.freshInHours) : 'now') + '</b></div>' +
          x.lifts.map(function (l) {
            return '<button type="button" class="mcrs-row" data-lift="' + esc(l.name) + '"><span>' + esc(l.name) + '</span><b>' +
              l.sets + (l.sets === 1 ? ' set' : ' sets') + ' ›</b></button>';
          }).join('') +
        '</div>' +
        '<p class="mcrs-note">How it’s worked out: from the last workout that trained ' + esc(label.toLowerCase()) +
          ', recovery climbs on a curve over the hours since. More sets stretch the curve, and a set taken to failure stretches it a quarter more. ' +
          'It’s a model of recovery, not a measurement, and it doesn’t read sleep or soreness.</p>';
    }
    open(label + ' recovery', body, function (row) {
      var lift = row.getAttribute('data-lift'), log = row.getAttribute('data-log');
      if (lift && window.MCTrends) MCTrends.open(lift);
      else if (log) location.href = 'workout-detail.html?id=' + encodeURIComponent(log);
    });
  }

  function vitals() {
    if (!window.MC_VITALS || !MC_VITALS.explain) return;
    var x = MC_VITALS.explain();
    if (!x) return;
    var body = '<p class="mcrs-big">' + x.score + '%</p><p class="mcrs-tag">Estimate · from your entry on ' + esc(dayOf(x.date)) + '</p>' +
      '<div class="mcrs-rows">' + x.parts.map(function (p) {
        var eff = p.info ? 'not counted' : p.base ? 'starts at ' + p.effect : (p.effect >= 0 ? '+' : '−') + Math.abs(p.effect);
        return '<div class="mcrs-row"><span>' + esc(p.label) + ' · ' + esc(p.value) + '</span><b>' + eff + '</b></div>';
      }).join('') + '</div>' +
      '<p class="mcrs-note">How it’s worked out: your readiness answer sets the start (each point is 20), and sleep moves it up to 15 either way around 8 hours. ' +
      'Resting heart rate is shown but not counted until there’s a history to compare it with. This ring is separate from the per-muscle recovery on Stats.</p>';
    open('Recovery score', body);
  }

  window.MC_RECOVERY_SHEET = { muscle: muscle, vitals: vitals };
})();
