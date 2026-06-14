/* ==========================================================================
   program-manager.js  —  owner-only Program Manager (permanent edits)
   --------------------------------------------------------------------------
   Owner-authenticated editor for PERMANENT program changes, layered on
   program-overrides.js (window.MC_PO). Normal users never see any of this UI.

   Entry: navigate to any page with ?pm=1 (reliable across PWA shells). Unlock
   is two layers:
     1. Supabase email + password login (MC_SB) — establishes the owner
        identity and persists across visits. Writes are owner-only, enforced
        server-side by Row-Level Security (the real security boundary).
     2. Face ID / Touch ID (MC_BIO, WebAuthn) — a per-session local biometric
        gate. Unlock lasts the browser session (sessionStorage).
   All dialogs use the custom showModal (native prompt/alert are suppressed in
   iOS PWAs).

   While unlocked:
     • every exercise meatball (⋮) menu gains "Program Manager edit", which
       opens an editor to permanently replace the exercise (picker backed by
       exercise-catalog.js) or edit sets / rest / note / tempo, or reset
       the card back to the original program.
     • a compact top control pill always offers Publish (one-tap upsert to
       Supabase — live for all users) and nothing else.
     • all other tools open from the dashboard "PM Mode" module, which opens a
       hub (Edit Layout, Rename Center, Create, Find, Preview, History, Drafts,
       Export, Import, Guide, Discard, Lock).

   Edits write to the localStorage working copy and preview instantly via
   MC_PO.refresh(); Publish pushes them to Supabase so every user sees them
   within ~1 minute (no redeploy).
   ========================================================================== */
(function () {
  if (window.__mcProgramManager) return;   // guard against double-include
  window.__mcProgramManager = true;

  var ACTIVE_KEY = 'mc_pm_active';    // sessionStorage: '1' while unlocked this session
  var OWNER_SEEN_KEY = 'mc_pm_owner_seen'; // localStorage: '1' once this device confirmed owner
  var NAME_SEL   = '.ex-name, .lift-name, .var-name, .ss-name';

  var bar = null, editorOverlay = null, editorCard = null, rcOverlay = null, hOverlay = null, dOverlay = null;
  var hubOv = null;                 // tools hub bottom sheet
  var openHubAfterUnlock = false;   // open the hub once unlock completes

  // ---- shared program / badge data (single source: mc-pm-data.js) ---------
  // window.MC_PM_DATA is the one place this data lives — also consumed by the
  // dashboard's PROGS. Loaded via the program-overrides.js dynamic chain and
  // read lazily here (only when the Rename Center opens). Licensed programs are
  // MARKET:STRIP'd in mc-pm-data.js, so nothing brand-named lives in this file.
  function pmProgram(id) { return window.MC_PM_DATA ? MC_PM_DATA.program(id) : null; }
  function pmOrder()     { return window.MC_PM_DATA ? MC_PM_DATA.programOrder : []; }
  function pmBadges()    { return (window.MC_PM_DATA && MC_PM_DATA.badges) || { card: {}, legend: {} }; }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ---- unlock state -------------------------------------------------------
  function isActive() { try { return sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) { return false; } }
  function setActive(on) {
    try { on ? sessionStorage.setItem(ACTIVE_KEY, '1') : sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {}
    // leaving PM mode: drop preview so the next unlock shows the working copy
    if (!on && window.MC_PO && typeof MC_PO.setPreview === 'function' && MC_PO.isPreview()) MC_PO.setPreview(false);
    renderBar();
    // reveal/hide the owner-only item in any already-built meatball menu
    var pmBtn = document.querySelector('[data-act="pm"]');
    if (pmBtn) pmBtn.style.display = on ? '' : 'none';
    if (on) { markOwnerSeen(); showDashboardEntry(); }
    if (on && openHubAfterUnlock) { openHubAfterUnlock = false; openHub(); }
  }

  // PM "Preview as user": toggle painting of the published layer only, so the
  // owner sees exactly what users see. The working copy is untouched.
  function togglePreview() {
    if (!window.MC_PO || typeof MC_PO.setPreview !== 'function') { msg('Unavailable', 'Preview needs the override layer on this page.'); return; }
    MC_PO.setPreview(!MC_PO.isPreview());
  }

  // one-button info dialog (iOS-safe custom modal, not native alert)
  function msg(title, body) { showModal({ title: title, body: body || '', buttons: [{ label: 'OK', cb: function () {} }] }); }

  // two-button confirm dialog (iOS-safe; native confirm() is suppressed in PWAs)
  function confirmModal(title, body, onConfirm, confirmLabel) {
    showModal({
      title: title, body: body || '',
      buttons: [
        { label: 'Cancel', cb: function () {} },
        { label: confirmLabel || 'OK', primary: true, cb: function () { onConfirm(); } }
      ]
    });
  }

  // ---- custom modal (replaces prompt/alert which are suppressed in iOS PWA) --
  function showModal(cfg) {
    // cfg: { title, body, fields:[{id,label,type}], buttons:[{label,primary,cb}] }
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    var card = document.createElement('div');
    card.style.cssText = 'background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:24px;width:100%;max-width:320px;font-family:sans-serif;';
    var html = '<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:8px;">' + cfg.title + '</div>';
    if (cfg.body) html += '<div style="font-size:13px;color:#aaa;margin-bottom:16px;">' + cfg.body + '</div>';
    (cfg.fields || []).forEach(function(f) {
      html += '<div style="margin-bottom:12px;"><label style="font-size:12px;color:#888;display:block;margin-bottom:4px;">' + f.label + '</label>'
            + '<input id="pm-modal-' + f.id + '" type="' + (f.type||'text') + '" style="width:100%;box-sizing:border-box;background:#0d0d0d;border:1px solid #444;border-radius:8px;padding:10px 12px;color:#fff;font-size:15px;outline:none;" /></div>';
    });
    html += '<div style="display:flex;gap:8px;margin-top:4px;">';
    (cfg.buttons || []).forEach(function(b, i) {
      html += '<button id="pm-modal-btn-' + i + '" style="flex:1;padding:11px;border-radius:10px;border:none;font-size:14px;font-weight:600;cursor:pointer;background:' + (b.primary ? '#d4af37' : '#2a2a2a') + ';color:' + (b.primary ? '#000' : '#fff') + ';">' + b.label + '</button>';
    });
    html += '</div>';
    card.innerHTML = html;
    ov.appendChild(card);
    document.body.appendChild(ov);
    var inputs = {};
    (cfg.fields || []).forEach(function(f) {
      inputs[f.id] = card.querySelector('#pm-modal-' + f.id);
    });
    if (cfg.fields && cfg.fields.length) card.querySelector('#pm-modal-' + cfg.fields[0].id).focus();
    (cfg.buttons || []).forEach(function(b, i) {
      card.querySelector('#pm-modal-btn-' + i).addEventListener('click', function() {
        var vals = {};
        (cfg.fields || []).forEach(function(f) { vals[f.id] = inputs[f.id] ? inputs[f.id].value : ''; });
        document.body.removeChild(ov);
        b.cb(vals);
      });
    });
  }

  // Face ID gate: enroll on first use, then require a live biometric to unlock.
  // Optional by design — if the device can't set it up (no sensor, or the
  // passkey provider rejects it), we don't lock the owner out: the password
  // login is the real boundary. A successful skip/failure is remembered so we
  // stop nagging on this device.
  function biometricGate() {
    if (!window.MC_BIO || !MC_BIO.supported()) return Promise.resolve(true);
    try { if (localStorage.getItem('mc_bio_optout') === '1') return Promise.resolve(true); } catch (e) {}
    return MC_BIO.platformAvailable().then(function (has) {
      if (!has) return true;                       // no sensor → rely on login alone
      if (MC_BIO.isRegistered()) return MC_BIO.verify();
      return new Promise(function (resolve) {
        showModal({
          title: 'Enable Face ID',
          body: 'Use Face ID / Touch ID to protect Program Manager on this device? Optional — you can skip and just use your password.',
          buttons: [
            { label: 'Skip', cb: function () { try { localStorage.setItem('mc_bio_optout', '1'); } catch (e) {} resolve(true); } },
            { label: 'Enable', primary: true, cb: function () {
              MC_BIO.register('owner')
                .then(function () { return MC_BIO.verify(); })
                .then(function (ok) { resolve(ok); })
                .catch(function () {
                  // device can't enroll a platform biometric — don't lock out
                  try { localStorage.setItem('mc_bio_optout', '1'); } catch (e) {}
                  msg('Face ID unavailable', 'This device could not set up Face ID for the app, so Program Manager will rely on your password login. You are unlocked.');
                  resolve(true);
                });
            } }
          ]
        });
      });
    });
  }

  // owner unlock: already-an-admin → Face ID; otherwise email + password →
  // verify admin → Face ID. Then setActive. All via the iOS-safe modal.
  function gateThenActivate() {
    biometricGate().then(function (ok) {
      if (ok) setActive(true);
      else msg('Locked', 'Face ID check failed or was cancelled.');
    });
  }

  function unlockFlow() {
    if (!window.MC_SB || !MC_SB.configured) {
      msg('Not configured', 'Owner login is not set up yet (missing Supabase keys).');
      return;
    }
    MC_SB.isOwner().then(function (owner) {
      if (owner) { gateThenActivate(); return; }
      showModal({
        title: 'Owner sign-in',
        body: 'Sign in with your owner email and password.',
        fields: [
          { id: 'email', label: 'Email', type: 'email' },
          { id: 'pw', label: 'Password', type: 'password' }
        ],
        buttons: [
          { label: 'Cancel', cb: function () {} },
          { label: 'Sign in', primary: true, cb: function (v) {
            if (!v.email || !v.pw) return;
            MC_SB.signInPassword(v.email.trim(), v.pw)
              .then(function () {
                return MC_SB.isOwner().then(function (owner2) {
                  if (owner2) gateThenActivate();
                  else msg('Not an admin', 'That account is signed in but is not an admin.');
                });
              })
              .catch(function (e) {
                var m = (e && e.message) ? e.message : 'unknown error';
                msg('Sign-in failed', /invalid login/i.test(m) ? 'Wrong email or password.' : m);
              });
          } }
        ]
      });
    });
  }

  // ---- entry points -------------------------------------------------------
  function attachLongPress() {
    // URL param activation: navigate to dashboard.html?pm=1 to trigger unlock
    if (/[?&]pm=1/.test(location.search)) {
      // Clean the param from the URL without reloading
      var clean = location.pathname + location.hash;
      history.replaceState(null, '', clean);
      if (!isActive()) unlockFlow();
    }
  }


  // ---- inline "Edit Layout" editor (PM Phase 3) ----------------------------
  // The structural-layout + ThemeConfig sidebar lives in its own module
  // (mc-pm-layout-editor.js). Lazy-load it on first use so normal pages never
  // pay for it; it's owner-gated by virtue of living behind this PM bar.
  function openLayoutEditor() {
    if (window.MC_PM_LAYOUT) { MC_PM_LAYOUT.open(); return; }
    var s = document.createElement('script');
    s.src = 'mc-pm-layout-editor.js';
    s.onload = function () { if (window.MC_PM_LAYOUT) MC_PM_LAYOUT.open(); };
    s.onerror = function () { msg('Unavailable', 'Could not load the layout editor on this page.'); };
    document.head.appendChild(s);
  }

  // "+" Master Content & Template Creator (PM Phase 3b). Lazy-loaded like the
  // layout editor; owner-gated behind this PM bar.
  function openCreator() {
    if (window.MC_PM_CREATOR) { MC_PM_CREATOR.open(); return; }
    var s = document.createElement('script');
    s.src = 'mc-pm-creator.js';
    s.onload = function () { if (window.MC_PM_CREATOR) MC_PM_CREATOR.open(); };
    s.onerror = function () { msg('Unavailable', 'Could not load the creator on this page.'); };
    document.head.appendChild(s);
  }

  // ---- PM bar (visible only while unlocked) --------------------------------
  function localEditCount() {
    if (!window.MC_PO) return 0;
    var local = MC_PO.local() || {};
    var pages = local.pages || {}, n = 0, pid, nm, k;
    for (pid in pages) for (nm in pages[pid]) n++;
    // layouts + themes (PM Phase 2/3) — 1-level sections
    var lay = local.layouts || {}; for (k in lay) n++;
    var thm = local.themes || {};  for (k in thm) n++;
    if (window.MC_EXCATALOG) n += MC_EXCATALOG.getPending().length;
    if (window.MC_NAMES) n += MC_NAMES.localNamingEditCount();
    return n;
  }

  // central action dispatch — shared by the top pill and the tools hub
  function runAct(act) {
    if (act === 'publish') doPublish();
    else if (act === 'tools') openHub();
    else if (act === 'names') openRenameCenter();
    else if (act === 'layout') openLayoutEditor();
    else if (act === 'create') openCreator();
    else if (act === 'find') findExercise();
    else if (act === 'preview') togglePreview();
    else if (act === 'export') doExport();
    else if (act === 'import') doImport();
    else if (act === 'history') openHistory();
    else if (act === 'drafts') openDrafts();
    else if (act === 'guide') location.href = 'pm-mode-overview.html';
    else if (act === 'discard') doDiscard();
    else if (act === 'lock') setActive(false);
  }

  // Top control pill: a compact, always-visible "🛠️ PM · N edits · Publish" so
  // the owner can publish from any page. It is Publish-only — every other tool
  // opens from the dashboard "PM Mode" module (which opens the hub).
  function renderBar() {
    if (!isActive()) { if (bar) { bar.remove(); bar = null; } closeHub(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'mc-pm-top';
      bar.innerHTML =
        '<span class="mc-pm-tag">🛠️ PM</span>' +
        '<span class="mc-pm-count"></span>' +
        '<button class="mc-pm-publish" data-act="publish">Publish</button>';
      document.body.appendChild(bar);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        runAct(b.dataset.act);
      });
    }
    var n = localEditCount();
    bar.querySelector('.mc-pm-count').textContent = n ? (n + ' edit' + (n === 1 ? '' : 's')) : 'saved';
    var pub = bar.querySelector('.mc-pm-publish');
    if (pub) pub.disabled = !n || !(window.MC_SB && MC_SB.configured);
  }

  // The tools hub — a bottom sheet exposing every PM action, replacing the old
  // 13-button bar. Opened from the top pill and the dashboard "PM Mode" module.
  var HUB_GROUPS = [
    { t: 'Edit & create', items: [
      ['layout', '✏️', 'Edit Layout'], ['names', '🏷️', 'Rename Center'],
      ['create', '＋', 'Create New'],  ['find', '🔍', 'Find Exercise'] ] },
    { t: 'Review & publish', items: [
      ['publish', '☁️', 'Publish'],    ['preview', '👁️', 'Preview as user'],
      ['history', '🕘', 'History'],     ['drafts', '🗂️', 'Drafts'] ] },
    { t: 'Data & help', items: [
      ['export', '⬇️', 'Export'],       ['import', '⬆️', 'Import'],
      ['guide', '📖', 'PM Guide'] ] },
    { t: 'Session', items: [
      ['discard', '🗑️', 'Discard edits'], ['lock', '🔒', 'Lock PM Mode'] ] }
  ];
  function openHub() {
    if (!isActive()) { unlockFlow(); return; }
    closeHub();
    var previewing = !!(window.MC_PO && MC_PO.isPreview && MC_PO.isPreview());
    var n = localEditCount();
    var html = '<div class="mc-pm-hub" role="dialog" aria-label="Program Manager tools">' +
      '<div class="mc-pm-hub-hd"><div class="mc-pm-hub-ttl">🛠️ Program Manager</div>' +
        '<button class="mc-pm-hub-x" data-act="hub-close" aria-label="Close">✕</button></div>' +
      '<div class="mc-pm-hub-sub">' + (n ? (n + ' unpublished edit' + (n === 1 ? '' : 's')) : 'All changes published') + '</div>';
    HUB_GROUPS.forEach(function (g) {
      html += '<div class="mc-pm-hub-grp">' + g.t + '</div><div class="mc-pm-hub-grid">';
      g.items.forEach(function (it) {
        var act = it[0];
        var cls = 'mc-pm-tile' + (act === 'preview' && previewing ? ' on' : '') +
                  (act === 'discard' || act === 'lock' ? ' danger' : '');
        var label = (act === 'preview' && previewing) ? 'Previewing — exit' : it[2];
        html += '<button class="' + cls + '" data-tile="' + act + '"><span class="ti">' + it[1] + '</span><span>' + label + '</span></button>';
      });
      html += '</div>';
    });
    html += '</div>';
    hubOv = document.createElement('div');
    hubOv.className = 'mc-pm-hub-bd';
    hubOv.innerHTML = html;
    document.body.appendChild(hubOv);
    hubOv.addEventListener('click', function (e) {
      if (e.target === hubOv || e.target.closest('[data-act="hub-close"]')) { closeHub(); return; }
      var t = e.target.closest('[data-tile]'); if (!t) return;
      var act = t.dataset.tile;
      if (act === 'preview') { togglePreview(); openHub(); return; }  // re-render to reflect state
      closeHub();
      runAct(act);
    });
  }
  function closeHub() { if (hubOv) { hubOv.remove(); hubOv = null; } }

  // Entry from the dashboard "PM Mode" module: unlock if needed, then open hub.
  function enterPM() {
    if (isActive()) { openHub(); return; }
    openHubAfterUnlock = true;
    unlockFlow();
  }

  // one-tap publish: push the local working copy to Supabase (upsert edits,
  // delete resets), then clear local so it folds into the live published set.
  // Writes are owner-only — RLS rejects anything else server-side.
  function doPublish() {
    if (!window.MC_PO) { msg('Not loaded', 'Override layer not loaded on this page.'); return; }
    if (!window.MC_SB || !MC_SB.configured) { msg('No backend', 'Supabase is not configured — use Export instead.'); return; }
    var summary = summarizePublish();
    var canarySupported = (typeof MC_SB.listCanary === 'function');
    // find out if a canary set is live (so we can offer Promote), then review
    var probe = canarySupported ? MC_SB.listCanary().catch(function () { return []; }) : Promise.resolve([]);
    probe.then(function (canaryRows) {
      var nCanary = (canaryRows || []).length;
      if (!summary.count && !nCanary) { msg('Nothing to publish', 'No local edits to publish.'); return; }
      var buttons = [{ label: 'Cancel', cb: function () {} }];
      if (summary.count && canarySupported) buttons.push({ label: 'To testers', cb: function () { executePublish('canary'); } });
      if (summary.count) buttons.push({ label: 'Publish', primary: true, cb: function () { executePublish('live'); } });
      if (nCanary) buttons.push({ label: 'Promote (' + nCanary + ')', primary: !summary.count, cb: function () { promoteCanary(); } });
      var body = (summary.count ? 'Publish goes live for everyone (~1 min). “To testers” shows it to canary testers only.' : '')
               + (nCanary ? '<div class="mc-pp-grp">Live to testers (' + nCanary + ') — Promote to send to everyone.</div>' : '')
               + (summary.html || '');
      showModal({
        title: summary.count ? ('Publish ' + summary.count + ' change' + (summary.count === 1 ? '' : 's') + '?') : 'Promote testers → live?',
        body: body,
        buttons: buttons
      });
    });
  }

  // promote the canary set to live: copy each canary row into the live naming
  // table, then clear canary. Confirmed first.
  function promoteCanary() {
    if (typeof MC_SB.listCanary !== 'function') { msg('Unavailable', 'This build has no canary support.'); return; }
    confirmModal('Promote to everyone?', 'Copy all canary (testers-only) rename changes to live for all users, then clear the canary set?', function () {
      MC_SB.listCanary().then(function (rows) {
        if (!rows || !rows.length) { msg('Nothing to promote', 'There are no canary changes.'); return; }
        var ops = rows.map(function (r) {
          return MC_SB.upsertNaming(r.scope, r.scope_id, r.patch)
            .then(function () { return MC_SB.removeCanaryNaming(r.scope, r.scope_id); });
        });
        Promise.all(ops).then(function () {
          MC_PO.refresh();
          msg('Promoted', rows.length + ' change' + (rows.length === 1 ? '' : 's') + ' now live for everyone.');
        }).catch(function (e) {
          msg('Promote failed', (e && e.message) ? e.message : 'unknown error');
        });
      }).catch(function (e) { msg('Promote failed', (e && e.message) ? e.message : 'unknown error'); });
    }, 'Promote');
  }

  // build a human-readable diff of the working copy for the review sheet
  function summarizePublish() {
    var local = MC_PO.local() || {};
    var groups = [], n = 0, k;
    function act(p) {
      if (!p) return 'edited';
      if (p.reset) return 'reset to original';
      if (p.name) return '→ “' + p.name + '”';
      if (p.label) return '→ “' + p.label + '”' + (p.color ? ' (' + p.color + ')' : '');
      var bits = [];
      ['icon', 'desc', 'sets', 'rest', 'note', 'tempo', 'color'].forEach(function (f) { if (p[f]) bits.push(f); });
      return bits.length ? ('edited: ' + bits.join(', ')) : 'edited';
    }
    function ctx(s) { return ' <span class="mc-pp-ctx">(' + esc(s) + ')</span>'; }

    var pages = local.pages || {}, pItems = [], pid, nm;
    for (pid in pages) for (nm in pages[pid]) { pItems.push(esc(nm + ' — ' + act(pages[pid][nm])) + ctx(pid)); n++; }
    if (pItems.length) groups.push({ t: 'Split-level exercise edits', items: pItems });

    var exs = local.exercises || {}, eItems = [];
    for (k in exs) { eItems.push(esc(k + ' — ' + act(exs[k]))); n++; }
    if (eItems.length) groups.push({ t: 'Global exercise renames', items: eItems });

    var progs = local.programs || {}, prItems = [];
    for (k in progs) { prItems.push(esc(k + ' — ' + act(progs[k]))); n++; }
    if (prItems.length) groups.push({ t: 'Programs', items: prItems });

    var spl = local.splits || {}, sItems = [], sp, sn;
    for (sp in spl) for (sn in spl[sp]) { sItems.push(esc(sn + ' — ' + act(spl[sp][sn])) + ctx(sp)); n++; }
    if (sItems.length) groups.push({ t: 'Splits', items: sItems });

    var bdg = local.badges || {}, bItems = [], bp, bid;
    for (bp in bdg) for (bid in bdg[bp]) { bItems.push(esc(bid + ' — ' + act(bdg[bp][bid])) + ctx(bp)); n++; }
    if (bItems.length) groups.push({ t: 'Badges', items: bItems });

    // PM Phase 2/3 — layout + theme edits (publish live via the naming table).
    var lay = local.layouts || {}, lItems = [], lk;
    for (lk in lay) { lItems.push(esc(lk + ' — layout “' + (lay[lk] && lay[lk].style || '') + '”')); n++; }
    if (lItems.length) groups.push({ t: 'Layouts', items: lItems });
    var thm = local.themes || {}, tItems = [], tk;
    for (tk in thm) {
      var tc = thm[tk] || {}, bits = [];
      ['preset', 'accent', 'typography', 'density', 'motion'].forEach(function (f) { if (tc[f]) bits.push(f + ':' + tc[f]); });
      tItems.push(esc(tk + ' — ' + (bits.join(', ') || 'theme')));
      n++;
    }
    if (tItems.length) groups.push({ t: 'Theme', items: tItems });

    if (window.MC_EXCATALOG && MC_EXCATALOG.getPending().length) {
      var c = MC_EXCATALOG.getPending().length;
      groups.push({ t: 'New catalog exercises', items: [c + ' new exercise' + (c === 1 ? '' : 's')] });
      n += c;
    }

    var html = '<div class="mc-pp-list">';
    groups.forEach(function (g) {
      html += '<div class="mc-pp-grp">' + esc(g.t) + ' (' + g.items.length + ')</div>';
      g.items.forEach(function (it) { html += '<div class="mc-pp-item">' + it + '</div>'; });
    });
    html += '</div>';
    return { count: n, html: html };
  }

  // push the working copy to Supabase. target 'live' (default) writes the live
  // tables (everyone) and logs to history; target 'canary' writes the v2 naming
  // sections to the testers-only canary table (no pages/catalog, no history).
  // On success, clears the published sections from the working copy.
  function executePublish(target) {
    var canaryMode = (target === 'canary');
    if (canaryMode && typeof MC_SB.upsertCanaryNaming !== 'function') { msg('Unavailable', 'This build has no canary support.'); return; }
    var local = MC_PO.local() || {};
    var pub = (MC_PO.published && MC_PO.published()) || {};
    var pages = local.pages || {};
    var ops = [], entries = [], pid, nm, p;
    var upN = canaryMode ? MC_SB.upsertCanaryNaming : MC_SB.upsertNaming;
    var rmN = canaryMode ? MC_SB.removeCanaryNaming : MC_SB.removeNaming;
    // capture a changelog/restore entry alongside each live op (prev = value
    // published before this op overwrites it, for H1 restore). Canary isn't logged.
    function rec(section, scopeId, patch, prev) {
      if (canaryMode) return;
      entries.push({ section: section, scope_id: scopeId,
        action: (patch && patch.reset) ? 'remove' : 'upsert',
        patch: (patch && patch.reset) ? null : patch, prev: prev || null });
    }
    // page-level overrides — live only (pages are not canaried in this version)
    if (!canaryMode) {
      for (pid in pages) for (nm in pages[pid]) {
        p = pages[pid][nm];
        ops.push((p && p.reset) ? MC_SB.remove(pid, nm) : MC_SB.upsert(pid, nm, p));
        rec('pages', pid + '|' + nm, p, ((pub.pages || {})[pid] || {})[nm]);
      }
    }
    // v2 naming sections (→ live or canary tables depending on target)
    if (typeof upN === 'function') {
      // 1-level: exercises, programs
      ['exercises', 'programs'].forEach(function (sec) {
        var scope = sec.slice(0, -1);
        var section = local[sec] || {};
        for (var kk in section) {
          var pp = section[kk];
          ops.push((pp && pp.reset) ? rmN(scope, kk) : upN(scope, kk, pp));
          rec(sec, kk, pp, (pub[sec] || {})[kk]);
        }
      });
      // 2-level: splits (scopeId = "progId|origSplit")
      var splitsSec = local.splits || {};
      var spid, sname, sid;
      for (spid in splitsSec) {
        for (sname in splitsSec[spid]) {
          p = splitsSec[spid][sname];
          sid = spid + '|' + sname;
          ops.push((p && p.reset) ? rmN('split', sid) : upN('split', sid, p));
          rec('splits', sid, p, ((pub.splits || {})[spid] || {})[sname]);
        }
      }
      // 2-level: badges (scopeId = "progId|badgeId" or "global|badgeId")
      var badgesSec = local.badges || {};
      var bpid, bid, bsid;
      for (bpid in badgesSec) {
        for (bid in badgesSec[bpid]) {
          p = badgesSec[bpid][bid];
          bsid = bpid + '|' + bid;
          ops.push((p && p.reset) ? rmN('badge', bsid) : upN('badge', bsid, p));
          rec('badges', bsid, p, ((pub.badges || {})[bpid] || {})[bid]);
        }
      }
      // layouts + themes (PM Phase 2/3) — 1-level, live only (not canaried).
      // Ride the scope-agnostic naming_overrides table via scope 'layout'/'theme'.
      if (!canaryMode) {
        var layoutsSec = local.layouts || {}, lk;
        for (lk in layoutsSec) {
          p = layoutsSec[lk];
          ops.push((p && p.reset) ? rmN('layout', lk) : upN('layout', lk, p));
          rec('layouts', lk, p, (pub.layouts || {})[lk]);
        }
        var themesSec = local.themes || {}, tk;
        for (tk in themesSec) {
          p = themesSec[tk];
          ops.push((p && p.reset) ? rmN('theme', tk) : upN('theme', tk, p));
          rec('themes', tk, p, (pub.themes || {})[tk]);
        }
      }
    }
    // exercise catalog pending additions — live only
    if (!canaryMode && window.MC_EXCATALOG && MC_EXCATALOG.getPending().length) {
      ops.push(MC_EXCATALOG.publishPending());
    }
    if (!ops.length) { msg('Nothing to publish', canaryMode ? 'No rename edits to send to testers (pages/catalog publish live only).' : 'No local edits to publish.'); return; }
    var btn = bar && bar.querySelector('.mc-pm-publish');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    Promise.all(ops).then(function () {
      // best-effort changelog/history write — never fail a publish on logging
      if (!canaryMode && typeof MC_SB.logPublish === 'function') { try { MC_SB.logPublish(entries).catch(function () {}); } catch (e) {} }
      var cur = MC_PO.local() || {};
      // live publish pushes every section (incl. layouts/themes via the
      // scope-agnostic naming table) and clears the working copy; canary only
      // sends the naming sections to testers.
      if (canaryMode) { cur.exercises = {}; cur.programs = {}; cur.splits = {}; cur.badges = {}; }
      else cur = { pages: {}, exercises: {}, programs: {}, splits: {}, badges: {}, layouts: {}, themes: {} };
      MC_PO.setLocal(cur);
      if (btn) btn.textContent = 'Publish';
      renderBar();
      MC_PO.refresh();
      msg(canaryMode ? 'Sent to testers' : 'Published',
          canaryMode ? 'Rename changes are now live for testers only. Use “Promote testers → live” when ready for everyone.'
                     : 'Live for all users within ~1 minute.');
    }).catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Publish'; }
      var detail = (e && e.message) ? e.message : 'unknown error';
      msg('Publish failed', detail + ' — if this is a permission error, your account is not in the admins table yet.');
    });
  }

  function doExport() {
    if (!window.MC_PO) { msg('Not loaded', 'Override layer not loaded on this page.'); return; }
    var data = MC_PO.exportData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'program-overrides.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    msg('Exported', 'Saved <b>program-overrides.json</b>.<br>Commit it to the repo root to publish these edits to all users.');
  }

  function doImport() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'application/json,.json';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var data = JSON.parse(rd.result);
          if (!data || typeof data.pages !== 'object') throw new Error('bad shape');
          MC_PO.setLocal({
            pages:     data.pages     || {},
            exercises: data.exercises || {},
            programs:  data.programs  || {},
            splits:    data.splits    || {},
            badges:    data.badges    || {}
          });
          renderBar();
          msg('Imported', 'Imported overrides as your local working copy.');
        } catch (e) { msg('Import failed', 'Could not read that file as an overrides JSON.'); }
      };
      rd.readAsText(f);
    });
    inp.click();
  }

  function doDiscard() {
    if (!window.MC_PO) return;
    confirmModal('Discard local edits?',
      'Discard ALL unpublished local edits? Published overrides are unaffected.',
      function () {
        MC_PO.setLocal({ pages: {}, exercises: {}, programs: {}, splits: {}, badges: {}, layouts: {}, themes: {} });
        renderBar();
      },
      'Discard');
  }

  // ---- editor modal --------------------------------------------------------
  function buildEditor() {
    editorOverlay = document.createElement('div');
    editorOverlay.className = 'mc-pm-overlay';
    editorOverlay.innerHTML =
      '<div class="mc-pm-modal">' +
        '<div class="mc-pm-title">Program Manager — permanent edit</div>' +
        '<div class="mc-pm-orig">Original: <b id="mcPmOrig"></b></div>' +
        '<label>Exercise name</label>' +
        '<div class="mc-pm-row">' +
          '<input type="text" id="mcPmName" placeholder="(unchanged)"/>' +
          '<button type="button" class="mc-pm-pickbtn" id="mcPmPick">📚</button>' +
        '</div>' +
        '<div class="mc-pm-picker" id="mcPmPicker" style="display:none">' +
          '<input type="text" id="mcPmSearch" placeholder="Search exercise catalog…"/>' +
          '<div class="mc-pm-list" id="mcPmList"></div>' +
        '</div>' +
        '<label class="mc-pm-checkrow"><input type="checkbox" id="mcPmGlobal"/>' +
          '<span>Rename in ALL programs &amp; splits</span></label>' +
        '<div class="mc-pm-tier" id="mcPmTier">Showing the original name</div>' +
        '<label>Sets / reps</label>' +
        '<input type="text" id="mcPmSets" placeholder="(unchanged) e.g. 4 x 8-10"/>' +
        '<label>Rest</label>' +
        '<input type="text" id="mcPmRest" placeholder="(unchanged) e.g. 90 sec"/>' +
        '<label>Default note</label>' +
        '<textarea id="mcPmNote" placeholder="(none)"></textarea>' +
        '<label>Tempo</label>' +
        '<input type="text" id="mcPmTempo" placeholder="(none) e.g. 3:0:1:0"/>' +
        '<div class="mc-pm-btns">' +
          '<button class="mc-pm-reset" data-act="reset">Reset to original</button>' +
          '<span style="flex:1"></span>' +
          '<button class="mc-pm-cancel" data-act="cancel">Cancel</button>' +
          '<button class="mc-pm-save" data-act="save">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(editorOverlay);

    editorOverlay.addEventListener('click', function (e) {
      if (e.target === editorOverlay) { closeEditor(); return; }
      var b = e.target.closest('button[data-act]');
      if (b) {
        var act = b.dataset.act;
        if (act === 'cancel') closeEditor();
        else if (act === 'save') saveEditor(false);
        else if (act === 'reset') saveEditor(true);
        return;
      }
      if (e.target.closest('#mcPmPick')) togglePicker();
      var opt = e.target.closest('.mc-pm-opt');
      if (opt) {
        document.getElementById('mcPmName').value = opt.dataset.name;
        togglePicker(false);
      }
    });
    editorOverlay.querySelector('#mcPmSearch').addEventListener('input', renderPickerList);
    editorOverlay.querySelector('#mcPmName').addEventListener('input', updateTierIndicator);
    editorOverlay.querySelector('#mcPmGlobal').addEventListener('change', updateTierIndicator);
  }

  // Reflects which tier currently supplies (or will supply) the visible name,
  // so the rename scope is never ambiguous in the editor.
  function updateTierIndicator() {
    var ind = document.getElementById('mcPmTier');
    if (!ind || !editorCard) return;
    var orig = cardOrigName(editorCard);
    var key  = MC_PO.cardKey ? MC_PO.cardKey(editorCard) : orig;
    var isGlobal = document.getElementById('mcPmGlobal').checked;
    var nameVal = document.getElementById('mcPmName').value.trim();
    var globalName = MC_PO.globalExerciseName(orig);
    var pageEntry = ((MC_PO.local().pages || {})[MC_PO.pageId] || {})[key] ||
                    ((MC_PO.published().pages || {})[MC_PO.pageId] || {})[key] || {};
    var pageName = (pageEntry && !pageEntry.reset) ? pageEntry.name : '';
    var txt, cls = '';
    if (nameVal && isGlobal)       { txt = '🌐 Renames in ALL programs & splits'; cls = 'g'; }
    else if (nameVal && !isGlobal) { txt = '✏️ Renames in this split only';        cls = 'p'; }
    else if (pageName)             { txt = '✏️ Currently renamed in this split';    cls = 'p'; }
    else if (globalName)           { txt = '🌐 Currently renamed in all programs';  cls = 'g'; }
    else                           { txt = 'Showing the original name'; }
    ind.textContent = txt;
    ind.className = 'mc-pm-tier' + (cls ? ' mc-pm-tier-' + cls : '');
  }

  function togglePicker(force) {
    var p = document.getElementById('mcPmPicker');
    var show = (typeof force === 'boolean') ? force : p.style.display === 'none';
    p.style.display = show ? '' : 'none';
    if (show) {
      ensureCatalog(renderPickerList);
      setTimeout(function () { document.getElementById('mcPmSearch').focus(); }, 50);
    }
  }

  // exercise-catalog.js is ~500 entries; load it only when the picker opens
  function ensureCatalog(cb) {
    if (window.EXERCISES) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'exercise-catalog.js';
    s.onload = cb;
    s.onerror = function () {
      document.getElementById('mcPmList').innerHTML = '<div class="mc-pm-empty">Could not load exercise catalog.</div>';
    };
    document.head.appendChild(s);
  }

  function renderPickerList() {
    var list = document.getElementById('mcPmList');
    if (!window.EXERCISES) { list.innerHTML = '<div class="mc-pm-empty">Loading catalog…</div>'; return; }
    var q = (document.getElementById('mcPmSearch').value || '').toLowerCase().trim();
    var hits = [];
    for (var i = 0; i < EXERCISES.length && hits.length < 60; i++) {
      var ex = EXERCISES[i];
      if (!q || ex.name.toLowerCase().indexOf(q) !== -1 || (ex.muscle || '').toLowerCase().indexOf(q) !== -1) hits.push(ex);
    }
    list.innerHTML = hits.map(function (ex) {
      return '<button type="button" class="mc-pm-opt" data-name="' + ex.name.replace(/"/g, '&quot;') + '">' +
               '<span class="mc-pm-opt-name">' + ex.name + '</span>' +
               '<span class="mc-pm-opt-muscle">' + (ex.muscle || '') + '</span>' +
             '</button>';
    }).join('') || '<div class="mc-pm-empty">No matches.</div>';
  }

  function cardOrigName(card) {
    var attr = card.getAttribute('data-mc-orig-name');
    if (attr) return attr;
    var el = card.querySelector(NAME_SEL);
    return el ? el.textContent.trim() : '';
  }

  function openEditor(card) {
    if (!window.MC_PO) { msg('Not loaded', 'Override layer not loaded on this page.'); return; }
    if (!editorOverlay) buildEditor();
    editorCard = card;
    var orig = cardOrigName(card);
    var key  = MC_PO.cardKey ? MC_PO.cardKey(card) : orig;
    var entry = ((MC_PO.local().pages || {})[MC_PO.pageId] || {})[key] ||
                ((MC_PO.published().pages || {})[MC_PO.pageId] || {})[key] || {};
    if (entry.reset) entry = {};
    var pageName   = entry.name || '';
    var globalName = MC_PO.globalExerciseName(orig);
    // default to the global tier only when there's no split-level name and a
    // global rename is the source of the visible name (precedence: page > global)
    var isGlobal = (!pageName && !!globalName);
    document.getElementById('mcPmOrig').textContent = orig;
    document.getElementById('mcPmGlobal').checked = isGlobal;
    document.getElementById('mcPmName').value  = pageName || globalName || '';
    document.getElementById('mcPmSets').value  = entry.sets  || '';
    document.getElementById('mcPmRest').value  = entry.rest  || '';
    document.getElementById('mcPmNote').value  = entry.note  || '';
    document.getElementById('mcPmTempo').value = entry.tempo || '';
    updateTierIndicator();
    togglePicker(false);
    document.getElementById('mcPmSearch').value = '';
    editorOverlay.classList.add('open');
  }

  function closeEditor() { editorOverlay.classList.remove('open'); editorCard = null; }

  function saveEditor(reset) {
    var orig = cardOrigName(editorCard);
    if (!orig) { closeEditor(); return; }
    // page tier is keyed per-card (orig + occurrence) so duplicate-named cards
    // edit independently; the global tier stays keyed by the plain orig name so
    // a global rename still applies to every copy.
    var key  = MC_PO.cardKey ? MC_PO.cardKey(editorCard) : orig;
    var data = MC_PO.local();
    if (!data.pages) data.pages = {};
    if (!data.exercises) data.exercises = {};
    var page = data.pages[MC_PO.pageId] || (data.pages[MC_PO.pageId] = {});
    var publishedHas       = !!(((MC_PO.published().pages || {})[MC_PO.pageId] || {})[key]);
    var publishedGlobalHas = !!((MC_PO.published().exercises || {})[orig]);

    // drop a local global rename, shadowing a published one so the original shows
    function clearGlobal() {
      if (publishedGlobalHas) data.exercises[orig] = { reset: true };
      else delete data.exercises[orig];
    }

    if (reset) {
      // reset clears BOTH tiers so the original name renders everywhere; shadow
      // published entries, otherwise just drop the local entry
      if (publishedHas) page[key] = { reset: true };
      else delete page[key];
      clearGlobal();
    } else {
      var isGlobal = document.getElementById('mcPmGlobal').checked;
      var nameVal  = document.getElementById('mcPmName').value.trim();
      var entry = {};
      var v;
      // sets/rest/note/tempo stay split-specific (page tier) regardless of scope
      if (!isGlobal && nameVal) entry.name = nameVal;
      if ((v = document.getElementById('mcPmSets').value.trim()))  entry.sets  = v;
      if ((v = document.getElementById('mcPmRest').value.trim()))  entry.rest  = v;
      if ((v = document.getElementById('mcPmNote').value.trim()))  entry.note  = v;
      if ((v = document.getElementById('mcPmTempo').value.trim())) entry.tempo = v;
      if (Object.keys(entry).length) page[key] = entry;
      else if (publishedHas) page[key] = { reset: true };
      else delete page[key];

      // global tier: only touched when the global box is checked
      if (isGlobal) {
        if (nameVal) data.exercises[orig] = { name: nameVal };
        else clearGlobal();
      }
    }
    if (!Object.keys(page).length) delete data.pages[MC_PO.pageId];
    if (!Object.keys(data.exercises).length) delete data.exercises;
    MC_PO.setLocal(data);
    renderBar();
    closeEditor();
  }

  // ---- Rename Center -------------------------------------------------------
  // PM-bar "Names" panel: rename a program (name/icon/desc), its splits, and
  // its badges (program-scoped or app-wide). Writes flow through the same v2
  // working copy + Publish pipeline as exercise renames.
  var rcProgId = null, rcBadgeScope = 'prog', rcLastProg = null;

  // effective (published+local) override for a key, null when absent/reset
  function rcOvr(section, key, subKey) {
    var eff = MC_PO.effective() || {};
    var sec = eff[section] || {};
    var e = (subKey !== undefined) ? ((sec[key] || {})[subKey]) : sec[key];
    return (e && !e.reset) ? e : null;
  }
  // does the PUBLISHED layer carry this key? (decides reset-vs-delete on clear)
  function rcPubHas(section, key, subKey) {
    var pub = MC_PO.published() || {};
    var sec = pub[section] || {};
    if (subKey !== undefined) return !!((sec[key] || {})[subKey]);
    return !!sec[key];
  }

  function buildRenameCenter() {
    rcOverlay = document.createElement('div');
    rcOverlay.className = 'mc-pm-overlay';
    rcOverlay.innerHTML =
      '<div class="mc-pm-modal mc-rc-modal">' +
        '<div class="mc-pm-title">🏷️ Rename Center</div>' +
        '<div class="mc-pm-orig">Edits preview instantly — use Publish to go live for everyone.</div>' +
        '<label>Program</label>' +
        '<select id="mcRcProg" class="mc-rc-select"></select>' +
        '<input type="text" id="mcRcFilter" class="mc-rc-select mc-rc-filter" placeholder="Filter splits, badges, exercises…"/>' +
        '<div id="mcRcBody"></div>' +
        '<div class="mc-pm-btns"><span style="flex:1"></span>' +
          '<button class="mc-pm-save" data-act="rc-done">Done</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(rcOverlay);

    var sel = rcOverlay.querySelector('#mcRcProg');
    sel.innerHTML = pmOrder().map(function (id) {
      var p = pmProgram(id);
      return '<option value="' + id + '">' + esc(p ? p.name : id) + '</option>';
    }).join('');
    sel.addEventListener('change', function () { rcProgId = sel.value; rcLastProg = sel.value; renderRcBody(); });
    var filt = rcOverlay.querySelector('#mcRcFilter');
    filt.addEventListener('input', function () { filterRc(filt.value); });

    rcOverlay.addEventListener('click', function (e) {
      if (e.target === rcOverlay) { closeRenameCenter(); return; }
      var opt = e.target.closest('.mc-rc-exopt');
      if (opt) { addExerciseRow(opt.dataset.name); return; }
      var b = e.target.closest('button[data-act]');
      if (!b) return;
      var act = b.dataset.act;
      if (act === 'rc-done') closeRenameCenter();
      else if (act === 'rc-reset-prog') resetProgram();
      else if (act === 'rc-reset-split') resetSplit(b.dataset.split);
      else if (act === 'rc-reset-badge') resetBadge(b.dataset.badge);
      else if (act === 'rc-reset-ex') resetExercise(b.dataset.orig);
      else if (act === 'rc-add-ex') toggleExPicker();
      else if (act === 'rc-scope') { rcBadgeScope = b.dataset.scope; renderRcBody(); }
    });
  }

  // ---- global exercise renames (Rename Center "Exercises — all programs") --
  function commitExercise(orig, value) {
    if (value) MC_NAMES.setLocal('exercises', orig, { name: value });
    else if (rcPubHas('exercises', orig)) MC_NAMES.setLocal('exercises', orig, { reset: true });
    else MC_NAMES.clearLocal('exercises', orig);
    renderBar();
  }
  function resetExercise(orig) {
    var inp = rcOverlay.querySelector('.mc-rc-exname[data-orig="' + orig.replace(/"/g, '\\"') + '"]');
    if (inp) inp.value = '';
    commitExercise(orig, '');
  }
  function toggleExPicker(force) {
    var p = rcOverlay.querySelector('#mcRcExPicker');
    if (!p) return;
    var show = (typeof force === 'boolean') ? force : (p.style.display === 'none');
    p.style.display = show ? '' : 'none';
    if (show) {
      ensureCatalog(renderExPickerList);
      setTimeout(function () { var s = rcOverlay.querySelector('#mcRcExSearch'); if (s) s.focus(); }, 50);
    }
  }
  function renderExPickerList() {
    var list = rcOverlay.querySelector('#mcRcExList');
    if (!list) return;
    if (!window.EXERCISES) { list.innerHTML = '<div class="mc-pm-empty">Loading catalog…</div>'; return; }
    var q = ((rcOverlay.querySelector('#mcRcExSearch') || {}).value || '').toLowerCase().trim();
    var hits = [];
    for (var i = 0; i < EXERCISES.length && hits.length < 50; i++) {
      var ex = EXERCISES[i];
      if (!q || ex.name.toLowerCase().indexOf(q) !== -1 || (ex.muscle || '').toLowerCase().indexOf(q) !== -1) hits.push(ex);
    }
    list.innerHTML = hits.map(function (ex) {
      return '<button type="button" class="mc-rc-exopt" data-name="' + esc(ex.name) + '">' + esc(ex.name) + '</button>';
    }).join('') || '<div class="mc-pm-empty">No matches.</div>';
  }
  function addExerciseRow(orig) {
    toggleExPicker(false);
    var existing = rcOverlay.querySelector('.mc-rc-exname[data-orig="' + orig.replace(/"/g, '\\"') + '"]');
    if (existing) { existing.focus(); return; }
    var picker = rcOverlay.querySelector('#mcRcExPicker');
    var sec = picker.parentNode;
    var empty = sec.querySelector('.mc-pm-empty');
    if (empty) empty.remove();
    var row = document.createElement('div');
    row.className = 'mc-rc-row mc-rc-exrow';
    row.innerHTML =
      '<div class="mc-rc-exlabel" title="' + esc(orig) + '">' + esc(orig) + '</div>' +
      '<input type="text" class="mc-rc-exname" data-orig="' + esc(orig) + '" placeholder="(original)" value=""/>' +
      '<button class="mc-rc-reset sm" data-act="rc-reset-ex" data-orig="' + esc(orig) + '" title="Reset">↺</button>';
    sec.insertBefore(row, rcOverlay.querySelector('[data-act="rc-add-ex"]'));
    var inp = row.querySelector('.mc-rc-exname');
    inp.addEventListener('change', function () { commitExercise(orig, inp.value.trim()); });
    inp.focus();
  }

  function renderRcBody() {
    var body = rcOverlay.querySelector('#mcRcBody');
    var prog = pmProgram(rcProgId);
    if (!prog) { body.innerHTML = ''; return; }
    var pOvr = rcOvr('programs', rcProgId) || {};
    var html = '';

    // program block
    html += '<div class="mc-rc-sec"><div class="mc-rc-h">Program</div>' +
      '<label>Name</label><input type="text" id="mcRcProgName" placeholder="' + esc(prog.name) + '" value="' + esc(pOvr.name || '') + '"/>' +
      '<label>Icon</label><input type="text" id="mcRcProgIcon" class="mc-rc-icon" placeholder="' + esc(prog.icon) + '" value="' + esc(pOvr.icon || '') + '"/>' +
      '<label>Description</label><textarea id="mcRcProgDesc" placeholder="' + esc(prog.desc) + '">' + esc(pOvr.desc || '') + '</textarea>' +
      '<button class="mc-rc-reset" data-act="rc-reset-prog">Reset program</button></div>';

    // splits block
    html += '<div class="mc-rc-sec"><div class="mc-rc-h">Splits</div>';
    prog.splits.forEach(function (s) {
      var sv = rcOvr('splits', rcProgId, s);
      html += '<div class="mc-rc-row">' +
        '<input type="text" class="mc-rc-split" data-split="' + esc(s) + '" placeholder="' + esc(s) + '" value="' + esc(sv ? (sv.name || '') : '') + '"/>' +
        '<button class="mc-rc-reset sm" data-act="rc-reset-split" data-split="' + esc(s) + '" title="Reset">↺</button>' +
        '</div>';
    });
    html += '</div>';

    // badges block
    var scopeKey = (rcBadgeScope === 'global') ? 'global' : rcProgId;
    html += '<div class="mc-rc-sec"><div class="mc-rc-h">Badges</div>' +
      '<div class="mc-rc-scope">' +
        '<button class="' + (rcBadgeScope === 'prog'   ? 'on' : '') + '" data-act="rc-scope" data-scope="prog">This program</button>' +
        '<button class="' + (rcBadgeScope === 'global' ? 'on' : '') + '" data-act="rc-scope" data-scope="global">All programs</button>' +
      '</div>';
    ['card', 'legend'].forEach(function (grp) {
      var map = pmBadges()[grp];
      html += '<div class="mc-rc-sub">' + (grp === 'card' ? 'Workout-card badges' : 'Legend-key badges') + '</div>';
      Object.keys(map).forEach(function (bid) {
        var bv = rcOvr('badges', scopeKey, bid);
        var hasColor = !!(bv && bv.color);
        html += '<div class="mc-rc-row mc-rc-badge">' +
          '<input type="text" class="mc-rc-blabel" data-badge="' + bid + '" placeholder="' + esc(map[bid]) + '" value="' + esc(bv ? (bv.label || '') : '') + '"/>' +
          '<input type="color" class="mc-rc-bcolor" data-badge="' + bid + '" data-touched="' + (hasColor ? '1' : '') + '" value="' + (hasColor ? esc(bv.color) : '#22d3ee') + '"/>' +
          '<button class="mc-rc-reset sm" data-act="rc-reset-badge" data-badge="' + bid + '" title="Reset">↺</button>' +
          '</div>';
      });
    });
    html += '</div>';

    // global exercise renames block (program-independent — applies everywhere)
    html += '<div class="mc-rc-sec"><div class="mc-rc-h">Exercises — all programs</div>';
    var exMap = (MC_PO.effective().exercises) || {};
    var exKeys = Object.keys(exMap).filter(function (k) { return exMap[k] && !exMap[k].reset && exMap[k].name; }).sort();
    if (!exKeys.length) html += '<div class="mc-pm-empty">No global exercise renames yet.</div>';
    exKeys.forEach(function (orig) {
      html += '<div class="mc-rc-row mc-rc-exrow">' +
        '<div class="mc-rc-exlabel" title="' + esc(orig) + '">' + esc(orig) + '</div>' +
        '<input type="text" class="mc-rc-exname" data-orig="' + esc(orig) + '" placeholder="(original)" value="' + esc(exMap[orig].name || '') + '"/>' +
        '<button class="mc-rc-reset sm" data-act="rc-reset-ex" data-orig="' + esc(orig) + '" title="Reset">↺</button>' +
        '</div>';
    });
    html += '<button class="mc-rc-add" data-act="rc-add-ex">+ Add a global rename</button>' +
      '<div class="mc-rc-expicker" id="mcRcExPicker" style="display:none">' +
        '<input type="text" id="mcRcExSearch" placeholder="Search exercise catalog…"/>' +
        '<div class="mc-rc-exlist" id="mcRcExList"></div>' +
      '</div></div>';

    body.innerHTML = html;

    body.querySelector('#mcRcProgName').addEventListener('change', commitProgram);
    body.querySelector('#mcRcProgIcon').addEventListener('change', commitProgram);
    body.querySelector('#mcRcProgDesc').addEventListener('change', commitProgram);
    Array.prototype.forEach.call(body.querySelectorAll('.mc-rc-split'), function (inp) {
      inp.addEventListener('change', function () { commitSplit(inp.dataset.split, inp.value.trim()); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.mc-rc-blabel'), function (inp) {
      inp.addEventListener('change', function () { commitBadge(inp.dataset.badge); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.mc-rc-bcolor'), function (inp) {
      inp.addEventListener('change', function () { inp.setAttribute('data-touched', '1'); commitBadge(inp.dataset.badge); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('.mc-rc-exname'), function (inp) {
      inp.addEventListener('change', function () { commitExercise(inp.dataset.orig, inp.value.trim()); });
    });
    var exSearch = body.querySelector('#mcRcExSearch');
    if (exSearch) exSearch.addEventListener('input', renderExPickerList);

    // keep any active filter applied across program switches / re-renders
    var filt = rcOverlay.querySelector('#mcRcFilter');
    if (filt && filt.value) filterRc(filt.value);
  }

  // filter the splits / badges / exercises rows by free text
  function filterRc(q) {
    q = (q || '').toLowerCase().trim();
    var body = rcOverlay.querySelector('#mcRcBody');
    if (!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.mc-rc-row'), function (row) {
      if (!q) { row.style.display = ''; return; }
      var hay = row.textContent || '';
      var inp = row.querySelector('input');
      if (inp) {
        hay += ' ' + (inp.getAttribute('placeholder') || '') + ' ' + (inp.value || '') +
               ' ' + (inp.getAttribute('data-badge') || '') + ' ' + (inp.getAttribute('data-split') || '') +
               ' ' + (inp.getAttribute('data-orig') || '');
      }
      row.style.display = (hay.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
    });
  }

  function commitProgram() {
    var body = rcOverlay.querySelector('#mcRcBody');
    var name = body.querySelector('#mcRcProgName').value.trim();
    var icon = body.querySelector('#mcRcProgIcon').value.trim();
    var desc = body.querySelector('#mcRcProgDesc').value.trim();
    var patch = {};
    if (name) patch.name = name;
    if (icon) patch.icon = icon;
    if (desc) patch.desc = desc;
    if (Object.keys(patch).length) MC_NAMES.setLocal('programs', rcProgId, patch);
    else if (rcPubHas('programs', rcProgId)) MC_NAMES.setLocal('programs', rcProgId, { reset: true });
    else MC_NAMES.clearLocal('programs', rcProgId);
    renderBar();
  }
  function resetProgram() {
    var body = rcOverlay.querySelector('#mcRcBody');
    body.querySelector('#mcRcProgName').value = '';
    body.querySelector('#mcRcProgIcon').value = '';
    body.querySelector('#mcRcProgDesc').value = '';
    commitProgram();
  }

  function commitSplit(origSplit, value) {
    if (value) MC_NAMES.setLocal('splits', rcProgId, { name: value }, origSplit);
    else if (rcPubHas('splits', rcProgId, origSplit)) MC_NAMES.setLocal('splits', rcProgId, { reset: true }, origSplit);
    else MC_NAMES.clearLocal('splits', rcProgId, origSplit);
    renderBar();
  }
  function resetSplit(origSplit) {
    var inp = rcOverlay.querySelector('.mc-rc-split[data-split="' + origSplit.replace(/"/g, '\\"') + '"]');
    if (inp) inp.value = '';
    commitSplit(origSplit, '');
  }

  function commitBadge(badgeId) {
    var scopeKey = (rcBadgeScope === 'global') ? 'global' : rcProgId;
    var body = rcOverlay.querySelector('#mcRcBody');
    var labelInp = body.querySelector('.mc-rc-blabel[data-badge="' + badgeId + '"]');
    var colorInp = body.querySelector('.mc-rc-bcolor[data-badge="' + badgeId + '"]');
    var label = labelInp ? labelInp.value.trim() : '';
    var useColor = colorInp && colorInp.getAttribute('data-touched') === '1' && colorInp.value;
    var patch = {};
    if (label) patch.label = label;
    if (useColor) patch.color = colorInp.value;
    if (Object.keys(patch).length) MC_NAMES.setLocal('badges', scopeKey, patch, badgeId);
    else if (rcPubHas('badges', scopeKey, badgeId)) MC_NAMES.setLocal('badges', scopeKey, { reset: true }, badgeId);
    else MC_NAMES.clearLocal('badges', scopeKey, badgeId);
    renderBar();
  }
  function resetBadge(badgeId) {
    var body = rcOverlay.querySelector('#mcRcBody');
    var labelInp = body.querySelector('.mc-rc-blabel[data-badge="' + badgeId + '"]');
    var colorInp = body.querySelector('.mc-rc-bcolor[data-badge="' + badgeId + '"]');
    if (labelInp) labelInp.value = '';
    if (colorInp) colorInp.setAttribute('data-touched', '');
    commitBadge(badgeId);
  }

  function openRenameCenter() {
    if (!window.MC_PO || !window.MC_NAMES) { msg('Not loaded', 'The naming layer is not loaded on this page.'); return; }
    if (!window.MC_PM_DATA || !pmOrder().length) { msg('One moment', 'Program data is still loading — try again in a moment.'); return; }
    if (!rcOverlay) buildRenameCenter();
    // remember the last program chosen this session; else the current page's
    var cur = rcLastProg || MC_NAMES.progOf(MC_PO.pageId);
    if (!cur || !pmProgram(cur)) cur = pmOrder()[0];
    rcProgId = cur;
    rcLastProg = cur;
    rcBadgeScope = 'prog';
    rcOverlay.querySelector('#mcRcProg').value = cur;
    renderRcBody();
    rcOverlay.classList.add('open');
  }
  function closeRenameCenter() { if (rcOverlay) rcOverlay.classList.remove('open'); }

  // Find: jump straight into the global-exercise catalog search from the PM bar,
  // so an exercise can be renamed everywhere without hunting for a page that
  // shows it. Opens the Rename Center and surfaces its catalog picker.
  function findExercise() {
    openRenameCenter();
    if (rcOverlay && rcOverlay.classList.contains('open')) toggleExPicker(true);
  }

  // ---- Publish history (changelog + restore) -------------------------------
  function histWhen(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso || ''; } }
  function histWhat(r) {
    if (r.action === 'remove') return 'reset to original';
    if (r.patch && (r.patch.name || r.patch.label)) return '→ “' + (r.patch.name || r.patch.label) + '”';
    return 'edited';
  }

  function buildHistory() {
    hOverlay = document.createElement('div');
    hOverlay.className = 'mc-pm-overlay';
    hOverlay.innerHTML =
      '<div class="mc-pm-modal">' +
        '<div class="mc-pm-title">🕘 Publish history</div>' +
        '<div class="mc-pm-orig">Recent published changes. Restore stages the prior value as a local edit to review &amp; re-publish.</div>' +
        '<div class="mc-pp-list" id="mcHistBody"></div>' +
        '<div class="mc-pm-btns"><span style="flex:1"></span>' +
          '<button class="mc-pm-save" data-act="hist-done">Done</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(hOverlay);
    hOverlay.addEventListener('click', function (e) {
      if (e.target === hOverlay) { hOverlay.classList.remove('open'); return; }
      if (e.target.closest('[data-act="hist-done"]')) { hOverlay.classList.remove('open'); return; }
      var rb = e.target.closest('.mc-hist-restore');
      if (rb) {
        var id = parseInt(rb.getAttribute('data-id'), 10);
        var rows = hOverlay._rows || [], row = null;
        for (var i = 0; i < rows.length; i++) { if (rows[i].id === id) { row = rows[i]; break; } }
        if (row) restoreFromLog(row);
      }
    });
  }

  function openHistory() {
    if (!window.MC_SB || !MC_SB.configured) { msg('No backend', 'Publish history needs Supabase.'); return; }
    if (typeof MC_SB.getPublishLog !== 'function') { msg('Unavailable', 'This build has no publish log.'); return; }
    if (!hOverlay) buildHistory();
    var body = hOverlay.querySelector('#mcHistBody');
    body.innerHTML = '<div class="mc-pm-empty">Loading…</div>';
    hOverlay.classList.add('open');
    MC_SB.getPublishLog(100).then(function (rows) {
      hOverlay._rows = rows || [];
      if (!rows || !rows.length) { body.innerHTML = '<div class="mc-pm-empty">No published changes recorded yet.</div>'; return; }
      body.innerHTML = rows.map(function (r) {
        return '<div class="mc-hist-row">' +
          '<div class="mc-hist-main">' +
            '<span class="mc-hist-sec">' + esc(r.section) + '</span> ' +
            '<span class="mc-hist-key">' + esc(r.scope_id) + '</span> ' +
            '<span class="mc-hist-act">' + esc(histWhat(r)) + '</span>' +
          '</div>' +
          '<div class="mc-hist-meta">' + esc(histWhen(r.at)) + '</div>' +
          '<button class="mc-hist-restore" data-id="' + r.id + '">Restore</button>' +
        '</div>';
      }).join('');
    }).catch(function (e) {
      body.innerHTML = '<div class="mc-pm-empty">Could not load history' + (e && e.message ? ': ' + esc(e.message) : '') + '.</div>';
    });
  }

  // stage a log entry's prior value back into the working copy (owner reviews
  // and re-publishes — restore never silently re-publishes).
  function restoreFromLog(row) {
    var data = MC_PO.local(), sec = row.section, sid = row.scope_id;
    var staged = row.prev ? row.prev : { reset: true };  // prev value, or reset if it was a creation
    if (sec === 'exercises' || sec === 'programs') {
      if (!data[sec]) data[sec] = {};
      data[sec][sid] = staged;
    } else if (sec === 'pages' || sec === 'splits' || sec === 'badges') {
      var idx = sid.indexOf('|');
      if (idx < 0) { msg('Cannot restore', 'That entry is malformed.'); return; }
      var outer = sid.slice(0, idx), inner = sid.slice(idx + 1);
      if (!data[sec]) data[sec] = {};
      if (!data[sec][outer]) data[sec][outer] = {};
      data[sec][outer][inner] = staged;
    } else {
      msg('Cannot restore', 'This entry type can’t be restored automatically.');
      return;
    }
    MC_PO.setLocal(data);
    renderBar();
    hOverlay.classList.remove('open');
    msg('Staged for review', 'The prior value is now a local edit. Review it, then Publish to apply.');
  }

  // ---- Drafts (Staged rollout R1: server-side draft → load → promote) ------
  function draftWhen(iso) { try { return new Date(iso).toLocaleString(); } catch (e) { return iso || ''; } }

  function buildDrafts() {
    dOverlay = document.createElement('div');
    dOverlay.className = 'mc-pm-overlay';
    dOverlay.innerHTML =
      '<div class="mc-pm-modal">' +
        '<div class="mc-pm-title">🗂️ Drafts</div>' +
        '<div class="mc-pm-orig">Save the current working copy to the cloud (synced across your devices), then load &amp; Publish it when ready. Drafts are never visible to users.</div>' +
        '<button class="mc-rc-add" data-act="draft-save">＋ Save current edits as a draft</button>' +
        '<div class="mc-pp-list" id="mcDraftBody"></div>' +
        '<div class="mc-pm-btns"><span style="flex:1"></span>' +
          '<button class="mc-pm-save" data-act="draft-done">Done</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dOverlay);
    dOverlay.addEventListener('click', function (e) {
      if (e.target === dOverlay) { dOverlay.classList.remove('open'); return; }
      if (e.target.closest('[data-act="draft-done"]')) { dOverlay.classList.remove('open'); return; }
      if (e.target.closest('[data-act="draft-save"]')) { saveDraftFlow(); return; }
      var id, b;
      if ((b = e.target.closest('.mc-draft-load')))   { id = +b.getAttribute('data-id'); loadDraft(id, false); return; }
      if ((b = e.target.closest('.mc-draft-promote'))) { id = +b.getAttribute('data-id'); loadDraft(id, true); return; }
      if ((b = e.target.closest('.mc-draft-del')))     { id = +b.getAttribute('data-id'); removeDraft(id); return; }
    });
  }

  function openDrafts() {
    if (!window.MC_SB || !MC_SB.configured) { msg('No backend', 'Drafts need Supabase.'); return; }
    if (typeof MC_SB.listDrafts !== 'function') { msg('Unavailable', 'This build has no drafts support.'); return; }
    if (!dOverlay) buildDrafts();
    refreshDraftList();
    dOverlay.classList.add('open');
  }

  function refreshDraftList() {
    var body = dOverlay.querySelector('#mcDraftBody');
    body.innerHTML = '<div class="mc-pm-empty">Loading…</div>';
    MC_SB.listDrafts().then(function (rows) {
      if (!rows || !rows.length) { body.innerHTML = '<div class="mc-pm-empty">No saved drafts yet.</div>'; return; }
      body.innerHTML = rows.map(function (r) {
        return '<div class="mc-draft-row">' +
          '<div class="mc-draft-main"><span class="mc-hist-key">' + esc(r.name) + '</span>' +
            '<div class="mc-hist-meta">' + esc(draftWhen(r.updated_at)) + '</div></div>' +
          '<button class="mc-draft-load" data-id="' + r.id + '">Load</button>' +
          '<button class="mc-draft-promote" data-id="' + r.id + '">Promote</button>' +
          '<button class="mc-draft-del mc-rc-reset sm" data-id="' + r.id + '" title="Delete">🗑</button>' +
        '</div>';
      }).join('');
    }).catch(function (e) {
      body.innerHTML = '<div class="mc-pm-empty">Could not load drafts' + (e && e.message ? ': ' + esc(e.message) : '') + '.</div>';
    });
  }

  function saveDraftFlow() {
    var doc = MC_PO.local() || {};
    var has = JSON.stringify(doc) !== JSON.stringify({ pages: {}, exercises: {}, programs: {}, splits: {}, badges: {} });
    if (!has && !localEditCount()) { msg('Nothing to save', 'There are no local edits to save as a draft.'); return; }
    showModal({
      title: 'Save draft',
      body: 'Name this draft so you can find it later.',
      fields: [{ id: 'name', label: 'Draft name', type: 'text' }],
      buttons: [
        { label: 'Cancel', cb: function () {} },
        { label: 'Save', primary: true, cb: function (v) {
          var name = (v.name || '').trim() || ('Draft ' + new Date().toLocaleString());
          MC_SB.saveDraft(name, doc).then(function () {
            refreshDraftList();
            msg('Draft saved', 'Saved to the cloud. Load it on any of your devices, then Publish to go live.');
          }).catch(function (e) {
            msg('Save failed', (e && e.message) ? e.message : 'unknown error');
          });
        } }
      ]
    });
  }

  // load a draft into the working copy; if promote, open the Publish sheet after
  function loadDraft(id, promote) {
    MC_SB.getDraft(id).then(function (d) {
      if (!d || !d.doc) { msg('Not found', 'That draft could not be loaded.'); return; }
      var doc = d.doc;
      MC_PO.setLocal({
        pages: doc.pages || {}, exercises: doc.exercises || {},
        programs: doc.programs || {}, splits: doc.splits || {}, badges: doc.badges || {}
      });
      renderBar();
      dOverlay.classList.remove('open');
      if (promote) doPublish();
      else msg('Draft loaded', 'Loaded as your working copy (preview). Review, then Publish when ready.');
    }).catch(function (e) {
      msg('Load failed', (e && e.message) ? e.message : 'unknown error');
    });
  }

  function removeDraft(id) {
    confirmModal('Delete draft?', 'Remove this saved draft? Your current working copy is unaffected.', function () {
      MC_SB.deleteDraft(id).then(refreshDraftList).catch(function (e) {
        msg('Delete failed', (e && e.message) ? e.message : 'unknown error');
      });
    }, 'Delete');
  }

  // ---- styles ---------------------------------------------------------------
  function injectStyles() {
    var css =
      // top control pill — Publish only; all tools open from the dashboard module
      '.mc-pm-top{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;z-index:1350;' +
        'display:flex;align-items:center;gap:10px;padding:6px 6px 6px 13px;border-radius:999px;' +
        'background:rgba(8,20,35,0.96);border:1px solid rgba(34,211,238,0.45);' +
        'box-shadow:0 6px 20px rgba(0,0,0,0.5);color:#94a3b8;}' +
      '.mc-pm-top .mc-pm-tag{color:#22d3ee;font-weight:900;font-size:12px;white-space:nowrap;}' +
      '.mc-pm-top .mc-pm-count{font-weight:700;color:#94a3b8;font-size:11px;white-space:nowrap;}' +
      '.mc-pm-top .mc-pm-publish{background:#22d3ee;border:none;color:#03222b;font-size:11px;font-weight:900;' +
        'border-radius:999px;padding:7px 15px;cursor:pointer;font-family:inherit;}' +
      '.mc-pm-top .mc-pm-publish:disabled{background:rgba(34,211,238,0.25);color:#7dd3e8;cursor:default;}' +
      // tools hub bottom sheet
      '.mc-pm-hub-bd{position:fixed;inset:0;z-index:1500;background:rgba(0,0,0,0.6);' +
        'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;}' +
      '.mc-pm-hub{width:100%;max-width:480px;background:#0b1626;border:1px solid rgba(34,211,238,0.3);' +
        'border-radius:18px 18px 0 0;padding:18px 16px calc(env(safe-area-inset-bottom,0px) + 20px);max-height:88vh;overflow-y:auto;}' +
      '.mc-pm-hub-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}' +
      '.mc-pm-hub-ttl{font-size:17px;font-weight:900;color:#22d3ee;}' +
      '.mc-pm-hub-x{background:rgba(255,255,255,0.08);border:none;color:#cbd5e1;width:30px;height:30px;' +
        'border-radius:50%;font-size:14px;cursor:pointer;font-family:inherit;}' +
      '.mc-pm-hub-sub{font-size:12px;color:#94a3b8;margin-bottom:8px;}' +
      '.mc-pm-hub-grp{font-size:10px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin:14px 0 8px;}' +
      '.mc-pm-hub-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;}' +
      '.mc-pm-tile{display:flex;align-items:center;gap:10px;text-align:left;background:rgba(255,255,255,0.05);' +
        'border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:12px;color:#e2e8f0;font-size:13px;' +
        'font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.mc-pm-tile:active{background:rgba(34,211,238,0.12);}' +
      '.mc-pm-tile .ti{font-size:18px;flex-shrink:0;}' +
      '.mc-pm-tile.on{border-color:#facc15;color:#facc15;}' +
      '.mc-pm-tile.danger{color:#f87171;border-color:rgba(248,113,113,0.3);}' +
      '.mc-pm-overlay{position:fixed;inset:0;z-index:1400;display:none;align-items:center;' +
        'justify-content:center;padding:16px;background:rgba(0,0,0,0.65);' +
        'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);}' +
      '.mc-pm-overlay.open{display:flex;}' +
      '.mc-pm-modal{width:100%;max-width:420px;max-height:86vh;overflow-y:auto;' +
        'background:#0b1626;border:1px solid rgba(255,255,255,0.12);border-radius:16px;' +
        'padding:16px;color:#e2e8f0;}' +
      '.mc-pm-title{font-size:15px;font-weight:900;margin-bottom:4px;color:#22d3ee;}' +
      '.mc-pm-orig{font-size:12px;color:#94a3b8;margin-bottom:12px;}' +
      '.mc-pm-modal label{display:block;font-size:11px;font-weight:800;color:#94a3b8;' +
        'text-transform:uppercase;letter-spacing:0.06em;margin:10px 0 4px;}' +
      '.mc-pm-modal input,.mc-pm-modal textarea{width:100%;box-sizing:border-box;' +
        'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:10px;' +
        'padding:10px 12px;color:#e2e8f0;font-size:14px;font-weight:600;outline:none;font-family:inherit;}' +
      '.mc-pm-modal textarea{min-height:64px;resize:vertical;}' +
      '.mc-pm-row{display:flex;gap:8px;}' +
      '.mc-pm-row input{flex:1;}' +
      '.mc-pm-pickbtn{width:44px;border-radius:10px;border:1px solid rgba(34,211,238,0.4);' +
        'background:rgba(34,211,238,0.1);font-size:17px;cursor:pointer;}' +
      '.mc-pm-picker input{margin-bottom:6px;}' +
      '.mc-pm-picker{margin-top:6px;}' +
      '.mc-pm-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;}' +
      '.mc-pm-opt{display:flex;justify-content:space-between;gap:8px;text-align:left;width:100%;' +
        'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;' +
        'padding:8px 10px;color:#e2e8f0;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}' +
      '.mc-pm-opt-muscle{color:#64748b;font-size:11px;flex-shrink:0;}' +
      '.mc-pm-empty{padding:10px;font-size:12px;color:#64748b;}' +
      '.mc-pm-btns{display:flex;gap:8px;margin-top:16px;align-items:center;}' +
      '.mc-pm-btns button{border:none;border-radius:10px;padding:10px 14px;font-size:13px;' +
        'font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.mc-pm-reset{background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3)!important;}' +
      '.mc-pm-cancel{background:rgba(255,255,255,0.07);color:#cbd5e1;}' +
      '.mc-pm-save{background:#22d3ee;color:#03222b;}' +
      // exercise-modal global-rename checkbox + tier indicator
      '.mc-pm-checkrow{display:flex!important;align-items:center;gap:8px;text-transform:none!important;' +
        'letter-spacing:0;font-size:13px!important;font-weight:700!important;color:#e2e8f0!important;' +
        'cursor:pointer;margin-top:12px!important;}' +
      '.mc-pm-checkrow input{width:18px!important;height:18px;flex:0 0 auto;accent-color:#22d3ee;cursor:pointer;}' +
      '.mc-pm-tier{font-size:11px;font-weight:700;margin:6px 0 2px;color:#64748b;}' +
      '.mc-pm-tier-g{color:#22d3ee;}' +
      '.mc-pm-tier-p{color:#facc15;}' +
      // Rename Center
      '.mc-rc-modal{max-width:460px;}' +
      '.mc-rc-select{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);' +
        'border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:10px 12px;color:#e2e8f0;' +
        'font-size:14px;font-weight:700;outline:none;}' +
      '.mc-rc-filter{margin-top:8px;font-weight:600;}' +
      '.mc-rc-sec{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);}' +
      '.mc-rc-h{font-size:13px;font-weight:900;color:#22d3ee;text-transform:uppercase;' +
        'letter-spacing:0.06em;margin-bottom:6px;}' +
      '.mc-rc-sub{font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;' +
        'letter-spacing:0.06em;margin:12px 0 6px;}' +
      '.mc-rc-icon{max-width:90px;}' +
      '.mc-rc-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;}' +
      '.mc-rc-row input[type=text]{flex:1;min-width:0;}' +
      '.mc-rc-badge input[type=color]{flex:0 0 auto;width:38px;height:38px;padding:2px;cursor:pointer;' +
        'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:10px;}' +
      '.mc-rc-reset{background:rgba(248,113,113,0.12);color:#f87171;border:1px solid rgba(248,113,113,0.3);' +
        'border-radius:10px;padding:9px 12px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:8px;}' +
      '.mc-rc-reset.sm{flex:0 0 auto;width:38px;height:38px;padding:0;margin-top:0;font-size:15px;}' +
      '.mc-rc-scope{display:flex;gap:6px;margin-bottom:8px;}' +
      '.mc-rc-scope button{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);' +
        'color:#cbd5e1;font-size:11px;font-weight:800;border-radius:8px;padding:7px;cursor:pointer;font-family:inherit;}' +
      '.mc-rc-scope button.on{background:#22d3ee;border-color:#22d3ee;color:#03222b;}' +
      '.mc-rc-exlabel{flex:1;min-width:0;font-size:12px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.mc-rc-add{margin-top:8px;width:100%;background:rgba(34,211,238,0.1);border:1px dashed rgba(34,211,238,0.4);' +
        'color:#67e8f9;font-size:12px;font-weight:800;border-radius:8px;padding:9px;cursor:pointer;font-family:inherit;}' +
      '.mc-rc-expicker{margin-top:8px;}' +
      '.mc-rc-exlist{max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;}' +
      '.mc-rc-exopt{text-align:left;width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
        'border-radius:8px;padding:8px 10px;color:#e2e8f0;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}' +
      // pre-publish review sheet (inside showModal)
      '.mc-pp-list{margin-top:12px;max-height:38vh;overflow-y:auto;text-align:left;' +
        'border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;}' +
      '.mc-pp-grp{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#22d3ee;margin:8px 0 4px;}' +
      '.mc-pp-item{font-size:12px;color:#cbd5e1;padding:3px 0;line-height:1.35;word-break:break-word;}' +
      '.mc-pp-ctx{color:#64748b;}' +
      // Publish history sheet
      '.mc-hist-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);}' +
      '.mc-hist-main{flex:1;min-width:0;font-size:12px;color:#cbd5e1;word-break:break-word;}' +
      '.mc-hist-sec{font-size:10px;font-weight:800;text-transform:uppercase;color:#22d3ee;}' +
      '.mc-hist-key{color:#e2e8f0;font-weight:700;}' +
      '.mc-hist-act{color:#94a3b8;}' +
      '.mc-hist-meta{font-size:10px;color:#64748b;width:100%;}' +
      '.mc-hist-restore{flex:0 0 auto;background:rgba(34,211,238,0.12);color:#67e8f9;' +
        'border:1px solid rgba(34,211,238,0.4);border-radius:8px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      // Drafts sheet
      '.mc-draft-row{display:flex;align-items:center;gap:6px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);}' +
      '.mc-draft-main{flex:1;min-width:0;word-break:break-word;}' +
      '.mc-draft-load,.mc-draft-promote{flex:0 0 auto;background:rgba(34,211,238,0.12);color:#67e8f9;' +
        'border:1px solid rgba(34,211,238,0.4);border-radius:8px;padding:5px 9px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.mc-draft-promote{background:#22d3ee;color:#03222b;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- public API (mc-card-actions.js menu hook) ----------------------------
  window.MC_PM = {
    active: isActive,
    openEditor: openEditor,
    unlock: unlockFlow,
    openHub: openHub,
    enter: enterPM
  };

  // Wire + reveal the dashboard "PM Mode" module. It's hidden for everyone but
  // the owner. To survive PWA relaunches (which drop the session) and a possibly
  // dropped Supabase session, we remember once this device has been the owner in
  // a persistent flag and reveal instantly on later loads; we still confirm via
  // Supabase (covers a fresh device where the owner is signed in) and reveal the
  // moment PM mode is unlocked.
  function ownerSeen() { try { return localStorage.getItem(OWNER_SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markOwnerSeen() { try { localStorage.setItem(OWNER_SEEN_KEY, '1'); } catch (e) {} }
  function showDashboardEntry() {
    var card = document.getElementById('pmModeCard');
    if (card) card.style.display = 'block';
  }
  function buildPmCard() {
    var a = document.createElement('a');
    a.id = 'pmModeCard'; a.href = '#'; a.className = 'cat-card';
    a.style.cssText = 'border-style:dashed;border-color:rgba(34,211,238,0.5);text-align:center;padding:22px 16px;display:none;';
    a.innerHTML = '<span class="cat-icon">🛠️</span>' +
      '<div class="cat-name">PM Mode</div>' +
      '<div class="cat-meta">Owner control room — rename, restyle, create, and publish your app.</div>' +
      '<div class="cat-count" style="color:#22d3ee;">Open Tools →</div>';
    return a;
  }
  function revealDashboardEntry() {
    var card = document.getElementById('pmModeCard');
    if (!card) {
      // The static element is missing (e.g. a cached older dashboard.html that
      // predates the card). Inject it next to the dashboard's utility cards so
      // the module appears wherever this (fresh) script runs. Only on the
      // dashboard — those .cat-card anchors don't exist elsewhere.
      var anchor = document.querySelector('a.cat-card[href="collections.html"], a.cat-card[href="build-program.html"]');
      if (!anchor || !anchor.parentNode) return;
      card = buildPmCard();
      anchor.parentNode.appendChild(card);
    }
    card.addEventListener('click', function (e) { e.preventDefault(); enterPM(); });
    // reveal immediately if we already know this is the owner's device, or if
    // the URL is explicitly entering PM mode
    if (isActive() || ownerSeen() || /[?&]pm=1/.test(location.search)) { showDashboardEntry(); }
    if (window.MC_SB && MC_SB.configured && typeof MC_SB.isOwner === 'function') {
      MC_SB.isOwner().then(function (owner) { if (owner) { markOwnerSeen(); showDashboardEntry(); } }).catch(function () {});
    }
  }

  // minimal publish hook for the Edit Layout sidebar (reuses the review sheet)
  window.MC_PM_PUBLISH = function () { doPublish(); };

  function init() {
    injectStyles();
    attachLongPress();        // ?pm=1 trigger
    renderBar();
    revealDashboardEntry();   // owner-only dashboard "PM Mode" module
    // keep the unpublished-edit count live while the Edit Layout sidebar writes
    // layout/theme edits to the working copy
    document.addEventListener('mc:layout-changed', function () { renderBar(); });
    // reveal the PM menu item if we're already unlocked this session
    if (isActive()) {
      var btn = document.querySelector('[data-act="pm"]');
      if (btn) btn.style.display = '';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
