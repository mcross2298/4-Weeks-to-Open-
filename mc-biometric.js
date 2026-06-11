/* ==========================================================================
   mc-biometric.js  —  Face ID / Touch ID unlock gate (WebAuthn)
   --------------------------------------------------------------------------
   A device-local biometric gate for entering Program Manager edit mode.
   On Apple devices the WebAuthn platform authenticator IS Face ID / Touch ID;
   on Android it is the fingerprint / face unlock.

   This is a convenience/edit gate layered on top of the real security
   boundary (Supabase RLS, which rejects any write that isn't from an admin
   account). There is no server verifying the assertion here, so a successful
   navigator.credentials.get() ceremony — which requires the live biometric —
   is treated as a pass. If the platform has no authenticator, callers fall
   back to the Supabase login alone.

   window.MC_BIO:
     supported()        -> bool (WebAuthn present)
     platformAvailable()-> Promise<bool> (a built-in biometric sensor exists)
     isRegistered()     -> bool (a credential was enrolled on this device)
     register(label)    -> Promise (enroll Face ID on this device)
     verify()           -> Promise<bool> (prompt Face ID; resolves true on success)
   ========================================================================== */
(function () {
  if (window.MC_BIO) return;

  var CRED_KEY = 'mc_bio_cred';   // base64url of the registered credential id

  function supported() {
    return !!(window.PublicKeyCredential && navigator.credentials &&
              navigator.credentials.create && navigator.credentials.get);
  }

  function platformAvailable() {
    if (!supported() || !window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return Promise.resolve(false);
    }
    return window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }

  function rand(n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }

  function b64urlEncode(buf) {
    var bytes = new Uint8Array(buf), s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function isRegistered() { try { return !!localStorage.getItem(CRED_KEY); } catch (e) { return false; } }

  function register(label) {
    if (!supported()) return Promise.reject(new Error('WebAuthn not supported'));
    return navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: 'MC Training', id: location.hostname },
        user: { id: rand(16), name: label || 'owner', displayName: 'Program Manager' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        // Non-discoverable, device-bound credential: triggers the platform
        // biometric (Face ID / Touch ID) WITHOUT creating a saved/synced passkey,
        // so it never routes to an external passkey provider (iCloud/Microsoft).
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged', requireResidentKey: false },
        timeout: 60000,
        attestation: 'none'
      }
    }).then(function (cred) {
      try { localStorage.setItem(CRED_KEY, b64urlEncode(cred.rawId)); } catch (e) {}
      return true;
    });
  }

  function verify() {
    if (!supported() || !isRegistered()) return Promise.resolve(false);
    var id;
    try { id = b64urlDecode(localStorage.getItem(CRED_KEY)); } catch (e) { return Promise.resolve(false); }
    return navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: id, transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
        rpId: location.hostname
      }
    }).then(function (assertion) { return !!assertion; })
      .catch(function () { return false; });
  }

  window.MC_BIO = {
    supported: supported,
    platformAvailable: platformAvailable,
    isRegistered: isRegistered,
    register: register,
    verify: verify
  };
})();
