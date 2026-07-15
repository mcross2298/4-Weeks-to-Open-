/* ==========================================================================
   mc-input-sheet.js — bottom-sheet single-value input, replacing native
   prompt()/alert() for the app's few remaining "type one value" flows
   (bodyweight, conditioning finish time, barcode manual entry).
   --------------------------------------------------------------------------
   Native prompt()/alert() are jarring OS dialogs that block the page, can't
   be styled to match the app, and (on iOS Safari) can visibly stall camera
   preview frames underneath a scanner overlay while blocked. This gives
   every caller the same dark bottom-sheet idiom the rest of the app already
   uses, with inline validation (no separate alert() after the fact).

   MCInputSheet.prompt({
     title,                 // sheet heading, e.g. "Bodyweight"
     label,                 // optional field label above the input
     placeholder,           // input placeholder
     value,                 // optional pre-filled value
     inputMode,             // 'decimal' | 'numeric' | 'text' (default 'text')
     validate(v) -> string|null   // return an error string to block Save, or
                                  // null/undefined when v is acceptable
   }) -> Promise<string>   // resolves with the trimmed value on Save,
                            // rejects (no error payload) on Cancel/backdrop tap

   Self-contained: injects its own CSS on first use, no dependency on any
   other module or stylesheet, so pages that don't load mc-card-actions.css
   (stats.html, dashboard.html's Nutrition tab, conditioning pages) can use
   it standalone.
   ========================================================================== */
(function () {
  if (window.MCInputSheet) return;

  var overlay, titleEl, labelEl, inputEl, errEl;
  var resolveFn, rejectFn, currentValidate;

  function injectCss() {
    if (document.getElementById('mcInputSheetCss')) return;
    var st = document.createElement('style');
    st.id = 'mcInputSheetCss';
    st.textContent =
      '.mcis-overlay{position:fixed;inset:0;z-index:1400;display:none;' +
        'align-items:flex-end;padding:14px;background:rgba(0,0,0,0.6);' +
        'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}' +
      '.mcis-overlay.open{display:flex;}' +
      '.mcis-sheet{width:100%;max-width:480px;margin:0 auto;' +
        'background:#0e0e0e;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:18px;padding:18px 16px 16px;font-family:inherit;}' +
      '.mcis-title{font-size:16px;font-weight:800;color:#e2e8f0;margin-bottom:2px;}' +
      '.mcis-label{font-size:12.5px;font-weight:600;color:#94a3b8;margin-bottom:10px;}' +
      '.mcis-input{width:100%;padding:12px;border-radius:12px;' +
        'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);' +
        'color:#e2e8f0;font-size:16px;font-family:inherit;outline:none;}' +
      '.mcis-input:focus{border-color:rgba(251,191,36,0.5);}' +
      '.mcis-err{font-size:12px;font-weight:700;color:#f87171;margin-top:8px;min-height:15px;}' +
      '.mcis-btns{display:flex;gap:10px;margin-top:12px;}' +
      '.mcis-btn{flex:1;padding:13px;border-radius:12px;border:none;cursor:pointer;' +
        'font-family:inherit;font-size:14px;font-weight:800;letter-spacing:0.02em;' +
        '-webkit-tap-highlight-color:transparent;}' +
      '.mcis-cancel{background:rgba(255,255,255,0.07);color:#cbd5e1;}' +
      '.mcis-save{background:#fbbf24;color:#1a1200;}' +
      'html[data-theme="light"] .mcis-overlay{background:rgba(28,26,23,0.35);}' +
      'html[data-theme="light"] .mcis-sheet{background:#f5f2ec;border-color:rgba(28,26,23,0.1);}' +
      'html[data-theme="light"] .mcis-title{color:#1c1a17;}' +
      'html[data-theme="light"] .mcis-label{color:#6b6459;}' +
      'html[data-theme="light"] .mcis-input{background:rgba(28,26,23,0.04);border-color:rgba(28,26,23,0.14);color:#1c1a17;}' +
      'html[data-theme="light"] .mcis-cancel{background:rgba(28,26,23,0.06);color:#6b6459;}';
    document.head.appendChild(st);
  }

  function build() {
    if (overlay) return;
    injectCss();
    overlay = document.createElement('div');
    overlay.className = 'mcis-overlay';
    overlay.innerHTML =
      '<div class="mcis-sheet" role="dialog" aria-modal="true">' +
        '<div class="mcis-title" id="mcisTitle"></div>' +
        '<div class="mcis-label" id="mcisLabel"></div>' +
        '<input class="mcis-input" id="mcisInput"/>' +
        '<div class="mcis-err" id="mcisErr"></div>' +
        '<div class="mcis-btns">' +
          '<button type="button" class="mcis-btn mcis-cancel" data-act="cancel">Cancel</button>' +
          '<button type="button" class="mcis-btn mcis-save" data-act="save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    titleEl = overlay.querySelector('#mcisTitle');
    labelEl = overlay.querySelector('#mcisLabel');
    inputEl = overlay.querySelector('#mcisInput');
    errEl = overlay.querySelector('#mcisErr');

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { cancel(); return; }
      var btn = e.target.closest('[data-act]'); if (!btn) return;
      if (btn.dataset.act === 'cancel') cancel();
      else if (btn.dataset.act === 'save') trySave();
    });
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); trySave(); }
    });
  }

  function trySave() {
    var v = inputEl.value.trim();
    var err = currentValidate ? currentValidate(v) : null;
    if (err) { errEl.textContent = err; return; }
    var res = resolveFn;
    close();
    if (res) res(v);
  }
  function cancel() {
    var rej = rejectFn;
    close();
    if (rej) rej();
  }
  function close() {
    overlay.classList.remove('open');
    resolveFn = rejectFn = currentValidate = null;
  }

  function prompt(opts) {
    opts = opts || {};
    build();
    titleEl.textContent = opts.title || '';
    labelEl.textContent = opts.label || '';
    labelEl.style.display = opts.label ? '' : 'none';
    inputEl.value = opts.value != null ? opts.value : '';
    inputEl.placeholder = opts.placeholder || '';
    inputEl.setAttribute('inputmode', opts.inputMode || 'text');
    errEl.textContent = '';
    currentValidate = typeof opts.validate === 'function' ? opts.validate : null;
    overlay.classList.add('open');
    setTimeout(function () { inputEl.focus(); }, 260);
    return new Promise(function (res, rej) { resolveFn = res; rejectFn = rej; });
  }

  window.MCInputSheet = { prompt: prompt };
})();
