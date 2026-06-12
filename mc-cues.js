/* ==========================================================================
   mc-cues.js — form cue card sheet (Horizon 2)
   --------------------------------------------------------------------------
   window.MCCues.open(exerciseName) renders a bottom sheet with the written
   cues + common mistakes for that movement, matched against MC_CUES
   (mc-cues-data.js) by name pattern — first match wins. Opened from the
   ⋮ menu ("Form cues", wired in mc-card-actions.js). Fully offline.
   ========================================================================== */
(function () {
  if (window.MCCues) return;

  var overlay = null;

  function find(name) {
    var n = ' ' + String(name || '').toLowerCase() + ' ';
    var list = window.MC_CUES || [];
    for (var i = 0; i < list.length; i++) {
      for (var j = 0; j < list[i].match.length; j++) {
        if (n.indexOf(list[i].match[j]) !== -1) return list[i];
      }
    }
    return null;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/</g, '&lt;'); }

  function build() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'mcq-overlay';
    overlay.innerHTML =
      '<div class="mcq-sheet">' +
        '<div class="mcq-handle"></div>' +
        '<div class="mcq-title" id="mcqTitle"></div>' +
        '<div id="mcqBody"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    var st = document.createElement('style');
    st.textContent =
      '.mcq-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;display:none;' +
        'align-items:flex-end;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);}' +
      '.mcq-overlay.open{display:flex;}' +
      '.mcq-sheet{width:100%;max-width:680px;margin:0 auto;max-height:75vh;overflow-y:auto;' +
        '-webkit-overflow-scrolling:touch;background:#101010;border-radius:18px 18px 0 0;' +
        'border:1px solid rgba(255,255,255,0.1);border-bottom:0;' +
        'padding:10px 18px calc(22px + env(safe-area-inset-bottom));}' +
      '.mcq-handle{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,0.18);margin:2px auto 12px;}' +
      '.mcq-title{font-size:15px;font-weight:900;color:#e2e8f0;margin-bottom:12px;}' +
      '.mcq-lbl{font-size:11px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;' +
        'color:#94a3b8;margin:14px 0 8px;}' +
      '.mcq-cue{display:flex;gap:9px;padding:7px 0;font-size:13px;font-weight:600;color:#e2e8f0;line-height:1.45;}' +
      '.mcq-cue .b{color:#34d399;flex-shrink:0;}' +
      '.mcq-cue.bad .b{color:#f87171;}' +
      '.mcq-empty{padding:18px 0 8px;font-size:13px;font-weight:700;color:#64748b;line-height:1.5;text-align:center;}';
    document.head.appendChild(st);
  }

  function open(name) {
    if (!name) return;
    build();
    document.getElementById('mcqTitle').textContent = '📖 ' + name;
    var c = find(name);
    var body = document.getElementById('mcqBody');
    if (!c) {
      body.innerHTML = '<div class="mcq-empty">No cue card for this movement yet.<br>' +
        'Cards are rolling out muscle group by muscle group.</div>';
    } else {
      body.innerHTML =
        '<div class="mcq-lbl">Form cues</div>' +
        c.cues.map(function (t) {
          return '<div class="mcq-cue"><span class="b">✓</span><span>' + esc(t) + '</span></div>';
        }).join('') +
        '<div class="mcq-lbl">Common mistakes</div>' +
        c.mistakes.map(function (t) {
          return '<div class="mcq-cue bad"><span class="b">✗</span><span>' + esc(t) + '</span></div>';
        }).join('');
    }
    overlay.classList.add('open');
  }

  window.MCCues = { open: open, find: find };
})();
