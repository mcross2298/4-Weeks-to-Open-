/* ==========================================================================
   mc-account.js  —  user-facing account UI (sign in / sign out) for sync
   --------------------------------------------------------------------------
   Phase 3: lets invited users sign in so their training data syncs across
   devices (auth + per-user sync already exist). Invite-only — there is NO
   public sign-up form; the owner provisions accounts in Supabase. Sessions
   persist (Supabase autoRefresh), so a user signs in once per device and
   stays signed in until they sign out.

   Quiet entry point: the dashboard avatar. Signed out it reads "MC" and opens
   a Sign-in sheet; signed in it shows the user's initials and opens an Account
   sheet with Sign out. Regular users are not admins, so this is fully separate
   from the owner Program Manager unlock (?pm=1).
   ========================================================================== */
(function () {
  if (window.__mcAccount) return;
  window.__mcAccount = true;
  if (!window.MC_SB || !MC_SB.configured) return;

  var overlay = null, currentUserObj = null;

  function initials(email) {
    var p = (email || '').split('@')[0].replace(/[^a-z0-9]/gi, '');
    return (p.slice(0, 2) || '?').toUpperCase();
  }

  function injectStyles() {
    var css =
      '.acct-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);' +
        'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);' +
        'display:none;align-items:flex-end;justify-content:center;z-index:1200;}' +
      '.acct-overlay.open{display:flex;}' +
      // Phase S1: the sheet had no height limit, so once it grew past the
      // screen its top (the title and Sign out) was pushed off a phone with
      // no way to scroll back to it. It scrolls inside itself now.
      '.acct-sheet{width:100%;max-width:520px;background:#0e0e0e;' +
        'border-top:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;' +
        'max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);' +
        'overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;box-sizing:border-box;' +
        'padding:18px 18px calc(28px + env(safe-area-inset-bottom));color:#ede7d9;}' +
      '.acct-handle{width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 16px;}' +
      '.acct-title{font-size:19px;font-weight:900;letter-spacing:-0.01em;margin-bottom:4px;}' +
      '.acct-sub{font-size:13px;color:#a8a196;margin-bottom:16px;line-height:1.5;}' +
      '.acct-sub b{color:#ede7d9;}' +
      '.acct-sheet input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);' +
        'border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:13px 14px;margin-bottom:10px;' +
        'color:#ede7d9;font-size:15px;font-weight:600;outline:none;font-family:inherit;}' +
      // Phase S1: every control in the sheet meets the 48px / 8px standard
      // (flagship readiness R6). Buttons were ~46px, swatches 32px, the
      // density chips ~33px.
      '.acct-btn{width:100%;min-height:48px;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:800;' +
        'cursor:pointer;font-family:inherit;margin-top:8px;}' +
      '.acct-primary{background:#d4af37;color:#1a1200;}' +
      '.acct-primary:disabled{opacity:0.5;cursor:default;}' +
      '.acct-secondary{background:rgba(255,255,255,0.07);color:#d9d3c8;border:1px solid rgba(255,255,255,0.14);}' +
      '.acct-note{font-size:12px;color:#a8a196;margin-top:14px;line-height:1.5;text-align:center;}' +
      '.acct-info{font-size:13px;color:#86efac;background:rgba(34,197,94,0.08);' +
        'border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:11px 12px;margin-bottom:16px;line-height:1.5;}' +
      '.acct-err{font-size:13px;color:#fca5a5;margin-top:10px;min-height:18px;text-align:center;}' +
      '.avatar.acct-on{box-shadow:0 0 0 2px rgba(34,197,94,0.6);}' +
      '.acct-swatches{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}' +
      '.acct-swatch{width:48px;height:48px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;}' +
      '.acct-swatch.on{border-color:#ede7d9;}' +
      '.acct-density{display:flex;gap:8px;margin-bottom:4px;}' +
      '.acct-density-opt{flex:1;min-height:48px;border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:9px;' +
        'background:rgba(255,255,255,0.04);color:#a8a196;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.acct-density-opt.on{background:rgba(212,175,55,0.15);border-color:rgba(212,175,55,0.5);color:#ede7d9;}' +
      '.acct-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:48px;' +
        'border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px 14px;background:rgba(255,255,255,0.04);' +
        'color:#ede7d9;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;text-align:left;}' +
      '.acct-toggle-state{flex-shrink:0;font-size:12px;font-weight:800;color:#a8a196;}' +
      '.acct-toggle[aria-checked="true"] .acct-toggle-state{color:#34d399;}' +
      '.acct-toggles{display:flex;flex-direction:column;gap:8px;}' +
      '.acct-toggle-sub{display:block;font-size:13px;font-weight:600;color:#a8a196;margin-top:2px;}' +
      // Phase S5: the Diagnostics drawer.
      '.acct-diag-meta{font-size:13px;color:#a8a196;line-height:1.6;margin:8px 0;word-break:break-word;}' +
      '.acct-diag-meta b{color:#ede7d9;font-weight:700;}' +
      '.acct-err-list{display:flex;flex-direction:column;gap:8px;margin-top:8px;}' +
      '.acct-err-item{border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;' +
        'background:rgba(255,255,255,0.03);font-size:13px;line-height:1.45;}' +
      '.acct-err-head{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;color:#a8a196;}' +
      '.acct-err-kind{font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:#fca5a5;}' +
      '.acct-err-kind.k-storage{color:#fbbf24;}.acct-err-kind.k-network{color:#93c5fd;}' +
      '.acct-err-msg{color:#ede7d9;font-weight:700;margin-top:4px;word-break:break-word;}' +
      '.acct-err-where{color:#a8a196;margin-top:2px;word-break:break-all;}' +
      '.acct-err-item summary{min-height:48px;display:flex;align-items:center;cursor:pointer;color:#d9d3c8;font-weight:700;}' +
      '.acct-err-item pre{white-space:pre-wrap;word-break:break-all;font-size:13px;color:#d9d3c8;margin:0;' +
        'max-height:220px;overflow:auto;background:rgba(0,0,0,0.35);border-radius:8px;padding:8px;}' +
      '.acct-row{display:flex;gap:8px;}.acct-row .acct-btn{flex:1;}' +
      '.acct-danger{background:rgba(248,113,113,0.1);color:#fca5a5;border:1px solid rgba(248,113,113,0.35);}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  function close() { if (overlay) overlay.classList.remove('open'); }

  function render() {
    var body = overlay.querySelector('#acctBody');
    if (currentUserObj) {
      body.innerHTML =
        '<div class="acct-title">Account</div>' +
        '<div class="acct-sub">Signed in as <b>' + (currentUserObj.email || 'your account') + '</b></div>' +
        '<div class="acct-info">✓ Your workouts, set logs and streak sync across your devices — and your macro tracker reconciles with Mike’s Cookbook if you use both. You’ll stay signed in on this device.</div>' +
        '<button class="acct-btn acct-secondary" id="acctSignout">Sign out</button>';
      body.querySelector('#acctSignout').addEventListener('click', doSignOut);
    } else if (MC_SB.sdkLoadFailed) {
      // W2-2 (VOC/VOA Kaizen audit): the sign-in SDK loads from a CDN sw.js
      // can't precache, so a cold offline launch used to fail the sign-in
      // form silently (console.warn only) with a misleading "Supabase not
      // configured" error. Say what's actually true instead.
      body.innerHTML =
        '<div class="acct-title">Sign in</div>' +
        '<div class="acct-sub">Sign-in needs an internet connection, and this device is currently offline. Everything else — your workouts, set logs and streak — keeps working normally offline; come back here once you’re back online.</div>' +
        '<div class="acct-note">Accounts are provided by the app owner — ask for an invite to get one.</div>';
    } else {
      body.innerHTML =
        '<div class="acct-title">Sign in</div>' +
        '<div class="acct-sub">Sign in to sync your workouts, set logs and streak across all your devices — the same account works in Mike’s Cookbook too.</div>' +
        '<input id="acctEmail" type="email" autocomplete="email" placeholder="Email"/>' +
        '<input id="acctPw" type="password" autocomplete="current-password" placeholder="Password"/>' +
        '<button class="acct-btn acct-primary" id="acctSignin">Sign in</button>' +
        '<div class="acct-err" id="acctErr"></div>' +
        '<div class="acct-note">Accounts are provided by the app owner — ask for an invite to get one.</div>';
      body.querySelector('#acctSignin').addEventListener('click', doSignIn);
      body.querySelector('#acctPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSignIn(); });
    }
    appendAppearanceSection(body);
    appendWorkoutSection(body);
    appendInstallSection(body);
    appendBackupSection(body);
    appendDiagnosticsSection(body);
  }

  // Add to Home Screen (L2 Sub-Phase B) — mc-install.js captures the native
  // Android prompt at page load (it only fires once per session, so it can't
  // be captured lazily here); this just renders whatever state it stashed.
  function appendInstallSection(body) {
    if (!window.MC_INSTALL) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:18px 0 14px;"></div>' +
      '<div class="acct-sub">Install — add MC Training to your home screen for a full-screen, app-like experience.</div>' +
      '<div id="acctInstallBody"></div>';
    body.appendChild(wrap);
    renderInstallBody(wrap.querySelector('#acctInstallBody'));
    MC_INSTALL.onChange(function () {
      var slot = wrap.querySelector('#acctInstallBody');
      if (slot) renderInstallBody(slot);
    });
  }

  function renderInstallBody(slot) {
    if (MC_INSTALL.isInstalled()) {
      slot.innerHTML = '<div class="acct-info">✓ Already installed on this device.</div>';
      return;
    }
    if (MC_INSTALL.platform === 'ios') {
      slot.innerHTML =
        '<div class="acct-sub" style="margin-bottom:0;line-height:1.7;">' +
        '1. Tap the <b>Share</b> icon in Safari’s toolbar<br>' +
        '2. Scroll down and tap <b>Add to Home Screen</b><br>' +
        '3. Tap <b>Add</b> — MC Training now opens full-screen, just like an app</div>';
      return;
    }
    if (MC_INSTALL.canPrompt()) {
      slot.innerHTML = '<button type="button" class="acct-btn acct-secondary" id="acctInstall">Install app</button>';
      slot.querySelector('#acctInstall').addEventListener('click', function () {
        MC_INSTALL.prompt();
      });
      return;
    }
    slot.innerHTML = '<div class="acct-sub" style="margin-bottom:0;">Look for <b>Install app</b> or <b>Add to Home Screen</b> in your browser’s menu.</div>';
  }

  // Personal accent + density (Phase 2.5) — device-local, no PM/owner unlock
  // needed, layered ahead of the owner's published theme via MC_THEME.personal.
  function appendAppearanceSection(body) {
    if (!window.MC_THEME || !MC_THEME.personal) return;
    var personal = MC_THEME.personal.get() || {};
    var swatches = Object.keys(MC_THEME.presets).map(function (k) {
      var p = MC_THEME.presets[k];
      var on = personal.accent === p.accent;
      return '<button type="button" class="acct-swatch' + (on ? ' on' : '') + '" data-accent="' + p.accent +
        '" style="background:' + p.accent + '" title="' + p.name + '" aria-label="' + p.name + '"></button>';
    }).join('');
    var densities = [{ id: '', label: 'Default' }, { id: 'compact', label: 'Compact' }, { id: 'spacious', label: 'Spacious' }]
      .map(function (d) {
        var on = (personal.density || '') === d.id;
        return '<button type="button" class="acct-density-opt' + (on ? ' on' : '') + '" data-density="' + d.id + '">' + d.label + '</button>';
      }).join('');

    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:18px 0 14px;"></div>' +
      '<div class="acct-sub">Appearance — your own accent color and layout density, just on this device.</div>' +
      '<div class="acct-swatches">' + swatches + '</div>' +
      '<div class="acct-density">' + densities + '</div>' +
      '<button type="button" class="acct-btn acct-secondary" id="acctApptReset" style="margin-top:8px;">Reset to app default</button>';
    body.appendChild(wrap);

    Array.prototype.forEach.call(wrap.querySelectorAll('.acct-swatch'), function (btn) {
      btn.addEventListener('click', function () { MC_THEME.personal.set({ accent: btn.dataset.accent }); render(); });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('.acct-density-opt'), function (btn) {
      btn.addEventListener('click', function () { MC_THEME.personal.set({ density: btn.dataset.density || null }); render(); });
    });
    wrap.querySelector('#acctApptReset').addEventListener('click', function () {
      MC_THEME.personal.set({ accent: null, density: null });
      render();
    });
  }

  // Flagship readiness R2 / step 4: "Keep screen on during workouts" (default
  // on). It lives here because this is the one settings surface every athlete
  // can reach: the timer's own gear tray sits inside the rest float, which is
  // hidden on every page with set rows (M3b), so a switch only there would be
  // unreachable during a normal session. The tray carries it too.
  //
  // This page does not load mc-timer.js, so MC_PREFS is not here; the store is
  // read and written with the same merge-one-key rule MC_PREFS.set() applies,
  // and mc-live-tracker.js reads the key at call time on the workout page.
  function readPrefs() {
    try { return JSON.parse(localStorage.getItem('mc_prefs_v1') || '{}') || {}; } catch (e) { return {}; }
  }
  function writePref(k, v) {
    var p = readPrefs();
    p[k] = v;
    try { localStorage.setItem('mc_prefs_v1', JSON.stringify(p)); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('mc:prefs-changed', { detail: { key: k, value: v } })); } catch (e) {}
  }
  function prefValue(k, dflt) {
    var v = readPrefs()[k];
    return v === undefined ? dflt : v === true;
  }
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // One switch, applied on tap like every other control in this sheet. Used
  // only by Diagnostics now; the workout switches moved to their own staged
  // page (workout-settings.html).
  function toggleHtml(d) {
    var on = prefValue(d.k, d.dflt);
    return '<button type="button" class="acct-toggle" data-pref="' + d.k + '" data-dflt="' + (d.dflt ? 1 : 0) +
      '" role="switch" aria-checked="' + on + '">' +
      '<span>' + d.label + (d.sub ? '<span class="acct-toggle-sub">' + d.sub + '</span>' : '') + '</span>' +
      '<span class="acct-toggle-state">' + (on ? 'On' : 'Off') + '</span></button>';
  }
  function wireToggles(wrap) {
    Array.prototype.forEach.call(wrap.querySelectorAll('.acct-toggle[data-pref]'), function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.pref;
        var on = !prefValue(k, b.dataset.dflt === '1');
        writePref(k, on);
        b.setAttribute('aria-checked', String(on));
        b.querySelector('.acct-toggle-state').textContent = on ? 'On' : 'Off';
      });
    });
  }
  // The workout switches live on their own page now, workout-settings.html —
  // the owner's reference screen (2026-10-25): grouped cards, staged Cancel /
  // Save changes. This sheet keeps one row into it, so the one settings
  // surface every athlete can reach still leads there.
  function appendWorkoutSection(body) {
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:18px 0 14px;"></div>' +
      '<a class="acct-toggle" id="acctWorkoutSettings" href="workout-settings.html" style="text-decoration:none;">' +
        '<span>Workout settings<span class="acct-toggle-sub">Rest timer, sounds, auto move, screen on, max weight.</span></span>' +
        '<span class="acct-toggle-state" aria-hidden="true">\u203a</span></a>';
    body.appendChild(wrap);
  }

  // ---- Phase S5: Diagnostics — the on-device error log ---------------------
  // Reads mc_errors_v1, the ring buffer every page's head boot writes (runtime
  // errors, unhandled rejections, and — via MC_ERRLOG.rec — refused storage
  // writes and failed sync requests). Collapsed behind one button so it never
  // crowds the settings an athlete actually uses.
  var diagOpen = false;
  function readErrors() {
    try { var a = JSON.parse(localStorage.getItem('mc_errors_v1') || '[]'); return Array.isArray(a) ? a.filter(function (e) { return e && typeof e === 'object'; }) : []; }
    catch (e) { return []; }
  }
  function fileOf(src) { return String(src || '').split('?')[0].split('#')[0].split('/').pop(); }
  function errorItemHtml(e) {
    var when = typeof e.t === 'number' ? new Date(e.t).toLocaleString() : '—';
    var kind = String(e.k || 'error');
    var where = [e.p ? 'on ' + e.p : '', e.s ? fileOf(e.s) + (e.l ? ':' + e.l : '') : ''].filter(Boolean).join(' · ');
    return '<div class="acct-err-item">' +
      '<div class="acct-err-head"><span class="acct-err-kind k-' + esc(kind.replace(/[^a-z]/gi, '')) + '">' + esc(kind) + '</span>' +
        '<span>' + esc(when) + '</span></div>' +
      '<div class="acct-err-msg">' + esc(e.m || 'Unknown error') + '</div>' +
      (where ? '<div class="acct-err-where">' + esc(where) + '</div>' : '') +
      (e.x ? '<details><summary>Stack trace</summary><pre>' + esc(e.x) + '</pre></details>' : '') +
    '</div>';
  }
  function diagReport(meta) {
    return JSON.stringify({ app: 'MC Training', at: new Date().toISOString(), meta: meta,
      userAgent: navigator.userAgent, errors: readErrors() }, null, 2);
  }
  function appendDiagnosticsSection(body) {
    var errs = readErrors();
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:18px 0 14px;"></div>' +
      // FB1: a person's report, beside what the app caught by itself.
      (window.MC_REPORT ? '<button type="button" class="acct-btn acct-secondary" id="acctReport" style="margin-bottom:8px;">Report a problem</button>' : '') +
      '<button type="button" class="acct-btn acct-secondary" id="acctDiagBtn" aria-expanded="' + diagOpen + '" aria-controls="acctDiag">' +
        'Diagnostics' + (errs.length ? ' (' + errs.length + ' logged)' : '') + '</button>' +
      '<div id="acctDiag"' + (diagOpen ? '' : ' hidden') + '></div>';
    body.appendChild(wrap);
    var panel = wrap.querySelector('#acctDiag');
    var rep = wrap.querySelector('#acctReport');
    if (rep) rep.addEventListener('click', function () { close(); MC_REPORT.open(); });
    // FB6: the Field log (every report and crash type) is owner-only, so the
    // link appears only once MC_SB.isOwner() says so.
    try {
      if (window.MC_SB && MC_SB.isOwner) MC_SB.isOwner().then(function (owner) {
        if (!owner || wrap.querySelector('#acctFieldLog')) return;
        var a = document.createElement('a');
        a.id = 'acctFieldLog';
        a.className = 'acct-btn acct-secondary';
        a.href = 'field-log.html';
        a.textContent = 'Field log (owner)';
        a.style.cssText = 'display:flex;align-items:center;justify-content:center;text-decoration:none;box-sizing:border-box;margin-bottom:8px;';
        var anchor = wrap.querySelector('#acctDiagBtn');
        if (anchor) anchor.parentNode.insertBefore(a, anchor);
      }).catch(function () {});
    } catch (e) {}
    wrap.querySelector('#acctDiagBtn').addEventListener('click', function () {
      diagOpen = !diagOpen;
      this.setAttribute('aria-expanded', String(diagOpen));
      panel.hidden = !diagOpen;
      if (diagOpen) renderDiagnostics(panel);
    });
    if (diagOpen) renderDiagnostics(panel);
  }
  function renderDiagnostics(panel) {
    var errs = readErrors();
    var meta = { online: navigator.onLine, controlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller) };
    panel.innerHTML =
      // FB4: what happened to this account's reports
      (window.MC_REPORT ? '<div class="acct-sub" style="margin:12px 0 0;"><b>Your reports</b></div><div id="acctReports"></div>' : '') +
      '<div class="acct-toggles" style="margin-top:8px;">' + toggleHtml({ k: 'telemetry', dflt: false,
        label: 'Send error reports',
        sub: currentUserObj
          ? 'Off by default. Sends what is listed below — message, file, line, stack — never your workouts.'
          : 'Only sent while signed in. Off by default.' }) + '</div>' +
      '<div class="acct-diag-meta" id="acctDiagMeta">Online: <b>' + (meta.online ? 'yes' : 'no') + '</b> · ' +
        'Offline cache: <b>' + (meta.controlled ? 'active' : 'not active') + '</b></div>' +
      '<div class="acct-row"><button type="button" class="acct-btn acct-secondary" id="acctDiagCopy">Copy report</button>' +
        '<button type="button" class="acct-btn acct-secondary" id="acctDiagClear"' + (errs.length ? '' : ' disabled') + '>Clear log</button></div>' +
      '<div class="acct-err" id="acctDiagMsg" role="status"></div>' +
      '<div class="acct-err-list">' + (errs.length ? errs.map(errorItemHtml).join('')
        : '<div class="acct-diag-meta">No errors logged on this device.</div>') + '</div>' +
      '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:18px 0 14px;"></div>' +
      '<div class="acct-sub">Repair this device — clears the offline copy of the app and its screen memory, then reloads. ' +
        'Your workouts, set logs, macros, settings and sign-in are not touched. Needs a connection.</div>' +
      '<button type="button" class="acct-btn acct-danger" id="acctRepair">Repair this device</button>';
    wireToggles(panel);
    if (window.MC_REPORT) MC_REPORT.renderList(panel.querySelector('#acctReports'));
    // Which build is cached, read from the Cache API (the cache name carries
    // the deploy's version, so this is what a support check compares).
    try {
      if (window.caches && caches.keys) caches.keys().then(function (keys) {
        meta.caches = keys;
        var el = panel.querySelector('#acctDiagMeta');
        var app = keys.filter(function (k) { return /^mc-training/.test(k) && !/carry|fonts/.test(k); });
        if (el && app.length) el.insertAdjacentHTML('beforeend', '<br>Build: <b>' + esc(app.join(', ')) + '</b>');
      }).catch(function () {});
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (est) {
        meta.storage = est && { usage: est.usage, quota: est.quota };
        var el = panel.querySelector('#acctDiagMeta');
        if (el && est && est.quota) el.insertAdjacentHTML('beforeend', '<br>Storage used: <b>' +
          (est.usage / 1048576).toFixed(1) + ' MB of ' + (est.quota / 1048576).toFixed(0) + ' MB</b>');
      }).catch(function () {});
    } catch (e) {}
    var msg = panel.querySelector('#acctDiagMsg');
    panel.querySelector('#acctDiagCopy').addEventListener('click', function () {
      var text = diagReport(meta);
      var done = function () { msg.style.color = '#86efac'; msg.textContent = 'Report copied.'; };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text) ? done() : (msg.textContent = 'Could not copy.'); });
        } else if (fallbackCopy(text)) done(); else msg.textContent = 'Could not copy.';
      } catch (e) { msg.textContent = 'Could not copy.'; }
    });
    panel.querySelector('#acctDiagClear').addEventListener('click', function () {
      try { localStorage.removeItem('mc_errors_v1'); } catch (e) {}
      renderDiagnostics(panel);
      var b = document.getElementById('acctDiagBtn'); if (b) b.textContent = 'Diagnostics';
    });
    panel.querySelector('#acctRepair').addEventListener('click', function () { repairDevice(msg); });
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  // ---- Phase S7: Repair this device ----------------------------------------
  // Owner decision 2026-10-25: caches and UI state ONLY. An explicit allowlist,
  // deliberately not "everything store-registry.json marks unsynced": that
  // set includes the live session (mc_session_v1), typed drafts, the cloud
  // outbox and the discard snapshot — all of them the athlete's data.
  //   * every Cache Storage cache (the service worker refills on reload);
  //   * derived, re-fetchable caches in localStorage (below);
  //   * every mc_* key in sessionStorage (screen memory: tabs, filters).
  // Refused offline: with the caches gone and no network, the reload has
  // nothing to load — the one way this button could leave a blank screen.
  var REPAIR_LOCAL_KEYS = ['mc_foodapi_cache_v1', 'mc_offline_prefetch_v1', 'mc_coach_report_v1', 'mc_published_programs_v1'];
  function repairDevice(msg) {
    if ('onLine' in navigator && !navigator.onLine) {
      msg.style.color = ''; msg.textContent = 'You are offline. Repair needs a connection to download the app again.';
      return;
    }
    var ask = window.MC_SHEET && MC_SHEET.confirm
      ? MC_SHEET.confirm('Repair this device? The offline copy of the app is cleared and downloaded again. Your workouts, logs and sign-in stay.', { ok: 'Repair', cancel: 'Cancel', danger: true })
      : Promise.resolve(window.confirm('Repair this device? Your workouts, logs and sign-in stay.'));
    ask.then(function (yes) {
      if (!yes) return;
      msg.style.color = '#86efac'; msg.textContent = 'Repairing…';
      REPAIR_LOCAL_KEYS.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      try {
        for (var i = sessionStorage.length - 1; i >= 0; i--) {
          var k = sessionStorage.key(i);
          if (k && k.indexOf('mc_') === 0) sessionStorage.removeItem(k);
        }
      } catch (e) {}
      var wipe = (window.caches && caches.keys)
        ? caches.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
        : Promise.resolve();
      try { if (window.MC_ERRLOG) MC_ERRLOG.rec('note', 'Repair this device run'); } catch (e) {}
      wipe.catch(function () {}).then(function () { location.reload(); });
    });
  }

  // Manual backup — available whether signed in or not. Symmetric with
  // Mikes-Cookbook's mc-account.js (Phase 1.3 durability).
  // Flagship readiness R7 / D-36: when this device last saved a backup, and
  // whether the browser has agreed to keep this site's data. mc-finish.js
  // asks for persistent storage after a first finished workout; nothing ever
  // said whether it was granted, and a refusal is exactly when a backup file
  // matters most.
  function appendBackupSection(body) {
    if (!window.MCExport) return;
    var wrap = document.createElement('div');
    var last = MCExport.lastBackupLabel ? MCExport.lastBackupLabel() : null;
    wrap.innerHTML =
      '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:18px 0 14px;"></div>' +
      '<div class="acct-sub">Back up your data as a file, or restore from one — works whether you’re signed in or not.</div>' +
      (last ? '<div class="acct-sub" id="acctLastBackup" style="margin-top:6px;">Last backup on this device: <b>' + last + '</b></div>' : '') +
      '<div class="acct-sub" id="acctPersist" style="margin-top:6px;display:none;"></div>' +
      '<button class="acct-btn acct-secondary" id="acctExport" style="margin-top:8px;">Export data</button>' +
      '<button class="acct-btn acct-secondary" id="acctImport" style="margin-top:8px;">Import data</button>' +
      (MCExport.exportCSV ? '<button class="acct-btn acct-secondary" id="acctCsv" style="margin-top:8px;">Export sets as CSV (spreadsheet)</button>' : '') +
      '<input type="file" id="acctImportFile" accept="application/json" style="display:none">' +
      '<div class="acct-err" id="acctBackupMsg"></div>';
    body.appendChild(wrap);
    try {
      if (navigator.storage && navigator.storage.persisted) {
        navigator.storage.persisted().then(function (on) {
          var el = wrap.querySelector('#acctPersist');
          if (!el) return;
          el.textContent = on
            ? 'This browser keeps this app’s data, even when the phone is low on space.'
            : 'This browser may clear this app’s data if the phone runs low on space. A backup file keeps it safe.';
          el.style.display = '';
        }).catch(function () {});
      }
    } catch (e) {}
    wrap.querySelector('#acctExport').addEventListener('click', function () {
      MCExport.exportJSON();
      var lb = wrap.querySelector('#acctLastBackup b');
      if (lb && MCExport.lastBackupLabel) lb.textContent = MCExport.lastBackupLabel();
    });
    var csvBtn = wrap.querySelector('#acctCsv');
    if (csvBtn) csvBtn.addEventListener('click', function () {
      var msg = wrap.querySelector('#acctBackupMsg');
      MCExport.exportCSV().then(function (how) {
        if (how === 'downloaded') msg.textContent = '';
      }).catch(function () { msg.textContent = 'Could not export the CSV.'; });
    });
    var fileInput = wrap.querySelector('#acctImportFile');
    wrap.querySelector('#acctImport').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var msg = wrap.querySelector('#acctBackupMsg');
      MCExport.importJSON(file).then(function () {
        location.reload();
      }).catch(function (e) {
        msg.textContent = (e && e.message) || 'Import failed.';
      });
    });
  }

  function openSheet() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'acct-overlay';
      overlay.innerHTML = '<div class="acct-sheet"><div class="acct-handle"></div><div id="acctBody"></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    }
    render();
    overlay.classList.add('open');
  }

  function doSignIn() {
    var email = (document.getElementById('acctEmail').value || '').trim();
    var pw = document.getElementById('acctPw').value || '';
    var err = document.getElementById('acctErr');
    var btn = document.getElementById('acctSignin');
    if (!email || !pw) { err.textContent = 'Enter your email and password.'; return; }
    btn.disabled = true; btn.textContent = 'Signing in…'; err.textContent = '';
    MC_SB.signInPassword(email, pw).then(function () {
      return MC_SB.currentUser();
    }).then(function (u) {
      currentUserObj = u;
      updateAvatar(u);
      close();
      if (window.MC_SYNC && MC_SYNC.kick) MC_SYNC.kick();   // start syncing now
    }).catch(function (e) {
      var m = (e && e.message) ? e.message : 'Sign-in failed.';
      // W2-2: covers the race where the sheet opened (and the form still
      // rendered) before MC_SB.ready settled -- by the time this rejects,
      // the SDK-load outcome is known, so re-check rather than surface the
      // raw "Supabase not configured" throw.
      if (MC_SB.sdkLoadFailed) m = 'Sign-in needs an internet connection — you’re currently offline. Try again once you’re back online.';
      else if (/invalid login/i.test(m)) m = 'Wrong email or password.';
      else if (/email not confirmed/i.test(m)) m = 'Please confirm your email (check your inbox) before signing in.';
      err.textContent = m;
      btn.disabled = false; btn.textContent = 'Sign in';
    });
  }

  function doSignOut() {
    MC_SB.signOut().then(function () {
      // full reload gives a clean signed-out state and stops the sync loop
      try { sessionStorage.removeItem('mc_sync_reloaded'); } catch (e) {}
      location.reload();
    }).catch(function () { location.reload(); });
  }

  function updateAvatar(user) {
    var av = document.querySelector('.avatar');
    if (!av) return;
    av.style.cursor = 'pointer';
    av.onclick = openSheet;
    if (user) { av.textContent = initials(user.email); av.classList.add('acct-on'); }
    else { av.textContent = 'MC'; av.classList.remove('acct-on'); }
  }

  function init() {
    injectStyles();
    updateAvatar(null);   // make the avatar tappable immediately
    MC_SB.ready
      .then(function (c) { return c ? MC_SB.currentUser() : null; })
      .then(function (u) { currentUserObj = u; updateAvatar(u); })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
