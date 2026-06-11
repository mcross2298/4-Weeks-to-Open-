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
      '.acct-sheet{width:100%;max-width:520px;background:#0e0e0e;' +
        'border-top:1px solid rgba(255,255,255,0.1);border-radius:24px 24px 0 0;' +
        'padding:18px 18px calc(28px + env(safe-area-inset-bottom));color:#e2e8f0;}' +
      '.acct-handle{width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 16px;}' +
      '.acct-title{font-size:19px;font-weight:900;letter-spacing:-0.01em;margin-bottom:4px;}' +
      '.acct-sub{font-size:13px;color:#94a3b8;margin-bottom:16px;line-height:1.5;}' +
      '.acct-sub b{color:#e2e8f0;}' +
      '.acct-sheet input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.06);' +
        'border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:13px 14px;margin-bottom:10px;' +
        'color:#e2e8f0;font-size:15px;font-weight:600;outline:none;font-family:inherit;}' +
      '.acct-btn{width:100%;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:800;' +
        'cursor:pointer;font-family:inherit;margin-top:4px;}' +
      '.acct-primary{background:#d4af37;color:#1a1200;}' +
      '.acct-primary:disabled{opacity:0.5;cursor:default;}' +
      '.acct-secondary{background:rgba(255,255,255,0.07);color:#cbd5e1;border:1px solid rgba(255,255,255,0.14);}' +
      '.acct-note{font-size:12px;color:#64748b;margin-top:14px;line-height:1.5;text-align:center;}' +
      '.acct-info{font-size:13px;color:#86efac;background:rgba(34,197,94,0.08);' +
        'border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:11px 12px;margin-bottom:16px;line-height:1.5;}' +
      '.acct-err{font-size:13px;color:#fca5a5;margin-top:10px;min-height:18px;text-align:center;}' +
      '.avatar.acct-on{box-shadow:0 0 0 2px rgba(34,197,94,0.6);}';
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
        '<div class="acct-info">✓ Your workouts, set logs and streak sync across your devices. You’ll stay signed in on this device.</div>' +
        '<button class="acct-btn acct-secondary" id="acctSignout">Sign out</button>';
      body.querySelector('#acctSignout').addEventListener('click', doSignOut);
    } else {
      body.innerHTML =
        '<div class="acct-title">Sign in</div>' +
        '<div class="acct-sub">Sign in to sync your workouts, set logs and streak across all your devices.</div>' +
        '<input id="acctEmail" type="email" autocomplete="email" placeholder="Email"/>' +
        '<input id="acctPw" type="password" autocomplete="current-password" placeholder="Password"/>' +
        '<button class="acct-btn acct-primary" id="acctSignin">Sign in</button>' +
        '<div class="acct-err" id="acctErr"></div>' +
        '<div class="acct-note">Accounts are provided by the app owner — ask for an invite to get one.</div>';
      body.querySelector('#acctSignin').addEventListener('click', doSignIn);
      body.querySelector('#acctPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doSignIn(); });
    }
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
      if (/invalid login/i.test(m)) m = 'Wrong email or password.';
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
