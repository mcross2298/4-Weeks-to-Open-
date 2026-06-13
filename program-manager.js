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
     • a fixed PM bar offers Publish (one-tap upsert to Supabase — live for all
       users), Export (download the program-overrides.json fallback), Import,
       Discard local edits, and Lock.

   Edits write to the localStorage working copy and preview instantly via
   MC_PO.refresh(); Publish pushes them to Supabase so every user sees them
   within ~1 minute (no redeploy).
   ========================================================================== */
(function () {
  if (window.__mcProgramManager) return;   // guard against double-include
  window.__mcProgramManager = true;

  var ACTIVE_KEY = 'mc_pm_active';    // sessionStorage: '1' while unlocked this session
  var NAME_SEL   = '.ex-name, .lift-name, .var-name, .ss-name';

  var bar = null, editorOverlay = null, editorCard = null;

  // ---- unlock state -------------------------------------------------------
  function isActive() { try { return sessionStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) { return false; } }
  function setActive(on) {
    try { on ? sessionStorage.setItem(ACTIVE_KEY, '1') : sessionStorage.removeItem(ACTIVE_KEY); } catch (e) {}
    renderBar();
    // reveal/hide the owner-only item in any already-built meatball menu
    var pmBtn = document.querySelector('[data-act="pm"]');
    if (pmBtn) pmBtn.style.display = on ? '' : 'none';
  }

  // one-button info dialog (iOS-safe custom modal, not native alert)
  function msg(title, body) { showModal({ title: title, body: body || '', buttons: [{ label: 'OK', cb: function () {} }] }); }

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


  // ---- PM bar (visible only while unlocked) --------------------------------
  function localEditCount() {
    if (!window.MC_PO) return 0;
    var pages = (MC_PO.local() || {}).pages || {}, n = 0, pid, nm;
    for (pid in pages) for (nm in pages[pid]) n++;
    if (window.MC_EXCATALOG) n += MC_EXCATALOG.getPending().length;
    return n;
  }

  function renderBar() {
    if (!isActive()) { if (bar) bar.remove(); bar = null; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'mc-pm-bar';
      bar.innerHTML =
        '<span class="mc-pm-tag">🛠️ PM</span>' +
        '<span class="mc-pm-count"></span>' +
        '<button class="mc-pm-publish" data-act="publish">Publish</button>' +
        '<button data-act="export">Export</button>' +
        '<button data-act="import">Import</button>' +
        '<button data-act="discard">Discard</button>' +
        '<button data-act="lock">Lock</button>';
      document.body.appendChild(bar);
      bar.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var act = b.dataset.act;
        if (act === 'publish') doPublish();
        else if (act === 'export') doExport();
        else if (act === 'import') doImport();
        else if (act === 'discard') doDiscard();
        else if (act === 'lock') setActive(false);
      });
    }
    var n = localEditCount();
    bar.querySelector('.mc-pm-count').textContent = n ? n + ' unpublished edit' + (n === 1 ? '' : 's') : 'no local edits';
    var pub = bar.querySelector('.mc-pm-publish');
    if (pub) pub.disabled = !n || !(window.MC_SB && MC_SB.configured);
  }

  // one-tap publish: push the local working copy to Supabase (upsert edits,
  // delete resets), then clear local so it folds into the live published set.
  // Writes are owner-only — RLS rejects anything else server-side.
  function doPublish() {
    if (!window.MC_PO) { msg('Not loaded', 'Override layer not loaded on this page.'); return; }
    if (!window.MC_SB || !MC_SB.configured) { msg('No backend', 'Supabase is not configured — use Export instead.'); return; }
    var pages = (MC_PO.local() || {}).pages || {};
    var ops = [], pid, nm;
    for (pid in pages) for (nm in pages[pid]) {
      var patch = pages[pid][nm];
      ops.push((patch && patch.reset) ? MC_SB.remove(pid, nm) : MC_SB.upsert(pid, nm, patch));
    }
    if (window.MC_EXCATALOG && MC_EXCATALOG.getPending().length) {
      ops.push(MC_EXCATALOG.publishPending());
    }
    if (!ops.length) { msg('Nothing to publish', 'No local edits to publish.'); return; }
    var btn = bar && bar.querySelector('.mc-pm-publish');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    Promise.all(ops).then(function () {
      MC_PO.setLocal({ pages: {} });        // local edits are now published
      if (btn) btn.textContent = 'Publish';
      renderBar();
      MC_PO.refresh();
      msg('Published', 'Live for all users within ~1 minute.');
    }).catch(function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Publish'; }
      var detail = (e && e.message) ? e.message : 'unknown error';
      msg('Publish failed', detail + ' — if this is a permission error, your account is not in the admins table yet.');
    });
  }

  function doExport() {
    if (!window.MC_PO) { alert('Override layer not loaded on this page.'); return; }
    var data = MC_PO.exportData();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'program-overrides.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    alert('Exported program-overrides.json.\nCommit it to the repo root to publish these edits to all users.');
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
          MC_PO.setLocal({ pages: data.pages });
          renderBar();
          alert('Imported overrides as local working copy.');
        } catch (e) { alert('Could not read that file as an overrides JSON.'); }
      };
      rd.readAsText(f);
    });
    inp.click();
  }

  function doDiscard() {
    if (!window.MC_PO) return;
    if (!confirm('Discard ALL unpublished local edits?\nPublished overrides (committed JSON) are unaffected.')) return;
    MC_PO.setLocal({ pages: {} });
    renderBar();
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
    if (!window.MC_PO) { alert('Override layer not loaded on this page.'); return; }
    if (!editorOverlay) buildEditor();
    editorCard = card;
    var orig = cardOrigName(card);
    var entry = ((MC_PO.local().pages || {})[MC_PO.pageId] || {})[orig] ||
                ((MC_PO.published().pages || {})[MC_PO.pageId] || {})[orig] || {};
    if (entry.reset) entry = {};
    document.getElementById('mcPmOrig').textContent = orig;
    document.getElementById('mcPmName').value  = entry.name  || '';
    document.getElementById('mcPmSets').value  = entry.sets  || '';
    document.getElementById('mcPmRest').value  = entry.rest  || '';
    document.getElementById('mcPmNote').value  = entry.note  || '';
    document.getElementById('mcPmTempo').value = entry.tempo || '';
    togglePicker(false);
    document.getElementById('mcPmSearch').value = '';
    editorOverlay.classList.add('open');
  }

  function closeEditor() { editorOverlay.classList.remove('open'); editorCard = null; }

  function saveEditor(reset) {
    var orig = cardOrigName(editorCard);
    if (!orig) { closeEditor(); return; }
    var data = MC_PO.local();
    if (!data.pages) data.pages = {};
    var page = data.pages[MC_PO.pageId] || (data.pages[MC_PO.pageId] = {});
    var publishedHas = !!(((MC_PO.published().pages || {})[MC_PO.pageId] || {})[orig]);

    if (reset) {
      // shadow a published override so the original renders; if nothing is
      // published for this card, just drop the local entry
      if (publishedHas) page[orig] = { reset: true };
      else delete page[orig];
    } else {
      var entry = {};
      var v;
      if ((v = document.getElementById('mcPmName').value.trim()))  entry.name  = v;
      if ((v = document.getElementById('mcPmSets').value.trim()))  entry.sets  = v;
      if ((v = document.getElementById('mcPmRest').value.trim()))  entry.rest  = v;
      if ((v = document.getElementById('mcPmNote').value.trim()))  entry.note  = v;
      if ((v = document.getElementById('mcPmTempo').value.trim())) entry.tempo = v;
      if (Object.keys(entry).length) page[orig] = entry;
      else if (publishedHas) page[orig] = { reset: true };
      else delete page[orig];
    }
    if (!Object.keys(page).length) delete data.pages[MC_PO.pageId];
    MC_PO.setLocal(data);
    renderBar();
    closeEditor();
  }

  // ---- styles ---------------------------------------------------------------
  function injectStyles() {
    var css =
      '.mc-pm-bar{position:fixed;left:10px;right:10px;bottom:76px;z-index:1300;' +
        'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;' +
        'background:rgba(8,20,35,0.95);border:1px solid rgba(34,211,238,0.4);' +
        'box-shadow:0 6px 24px rgba(0,0,0,0.5);font-size:12px;color:#94a3b8;}' +
      '.mc-pm-bar .mc-pm-tag{font-weight:900;color:#22d3ee;}' +
      '.mc-pm-bar .mc-pm-count{flex:1;font-weight:600;}' +
      '.mc-pm-bar button{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);' +
        'color:#cbd5e1;font-size:11px;font-weight:800;border-radius:8px;padding:6px 9px;cursor:pointer;}' +
      '.mc-pm-bar .mc-pm-publish{background:#22d3ee;border-color:#22d3ee;color:#03222b;}' +
      '.mc-pm-bar .mc-pm-publish:disabled{background:rgba(34,211,238,0.25);border-color:transparent;color:#7dd3e8;cursor:default;}' +
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
      '.mc-pm-save{background:#22d3ee;color:#03222b;}';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- public API (mc-card-actions.js menu hook) ----------------------------
  window.MC_PM = {
    active: isActive,
    openEditor: openEditor,
    unlock: unlockFlow
  };

  function init() {
    injectStyles();
    attachLongPress();        // ?pm=1 trigger
    renderBar();
    // reveal the PM menu item if we're already unlocked this session
    if (isActive()) {
      var btn = document.querySelector('[data-act="pm"]');
      if (btn) btn.style.display = '';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
