/* ==========================================================================
   mc-barcode.js — camera barcode scanner for the Nutrition tab (Phase 2)
   --------------------------------------------------------------------------
   Opens a full-screen camera overlay, reads a product barcode (UPC/EAN), and
   hands the digits back to the caller (mc-macros.js then looks it up via
   Open Food Facts). Two engines, picked at runtime:

     • native BarcodeDetector  — Chrome / Android (fast, zero download)
     • ZXing (lazy CDN load)   — fallback for Safari / iOS, which still lacks
                                  BarcodeDetector

   Usage:
     MCBarcode.scan().then(code => …).catch(err => …)
       resolves with the barcode string, or null if the user cancels.
       rejects only on a hard failure (no camera / permission denied).
     MCBarcode.supported()  -> bool (is any engine usable: getUserMedia present)

   Camera access requires HTTPS (GitHub Pages / Netlify both satisfy this).
   The stream and any RAF/interval loops are always torn down on close.
   ========================================================================== */
(function () {
  if (window.MCBarcode) return;

  var ZXING_SRC = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  function loadZXing() {
    if (window.ZXing && window.ZXing.BrowserMultiFormatReader) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ZXING_SRC; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('scanner library failed to load')); };
      document.head.appendChild(s);
    });
  }

  // ---- styles (injected once) ---------------------------------------------
  function injectStyles() {
    if (document.getElementById('bc-styles')) return;
    var css =
      '.bc-overlay{position:fixed;inset:0;background:#000;z-index:1400;display:flex;flex-direction:column;}' +
      '.bc-video{flex:1;width:100%;object-fit:cover;background:#000;}' +
      '.bc-frame{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
        'width:74%;max-width:360px;height:160px;border:2px solid rgba(255,255,255,0.9);border-radius:16px;' +
        'box-shadow:0 0 0 9999px rgba(0,0,0,0.45);}' +
      '.bc-laser{position:absolute;left:6%;right:6%;height:2px;background:#d4af37;top:50%;' +
        'box-shadow:0 0 8px 1px rgba(212,175,55,0.8);animation:bcScan 1.8s ease-in-out infinite;}' +
      '@keyframes bcScan{0%,100%{transform:translateY(-70px);}50%{transform:translateY(70px);}}' +
      '.bc-top{position:absolute;top:0;left:0;right:0;padding:calc(14px + env(safe-area-inset-top)) 18px 14px;' +
        'display:flex;align-items:center;justify-content:space-between;color:#fff;' +
        'background:linear-gradient(to bottom,rgba(0,0,0,0.6),transparent);}' +
      '.bc-title{font-size:16px;font-weight:800;}' +
      '.bc-close{background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.3);color:#fff;' +
        'width:40px;height:40px;border-radius:50%;font-size:20px;cursor:pointer;font-family:inherit;line-height:1;}' +
      '.bc-hint{position:absolute;bottom:calc(28px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;' +
        'color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,0.8);padding:0 24px;}' +
      '.bc-manual{margin-top:12px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.3);' +
        'color:#fff;padding:10px 18px;border-radius:11px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;}' +
      '.bc-diag{position:absolute;left:0;right:0;top:calc(64px + env(safe-area-inset-top));text-align:center;' +
        'color:rgba(255,255,255,0.5);font-size:11px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;' +
        'text-shadow:0 1px 2px rgba(0,0,0,0.8);pointer-events:none;}' +
      '@media (prefers-reduced-motion: reduce){.bc-laser{animation:none;}}';
    var st = document.createElement('style');
    st.id = 'bc-styles'; st.textContent = css;
    document.head.appendChild(st);
  }

  // ---- main entry ----------------------------------------------------------
  function scan() {
    if (!supported()) return Promise.reject(new Error('Camera not available on this device/browser.'));
    injectStyles();

    return new Promise(function (resolve, reject) {
      var stream = null, raf = null, zxingReader = null, done = false;

      // build UI
      var ov = document.createElement('div');
      ov.className = 'bc-overlay';
      var video = document.createElement('video');
      video.className = 'bc-video';
      video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.muted = true;
      ov.appendChild(video);
      ov.insertAdjacentHTML('beforeend',
        '<div class="bc-frame"><div class="bc-laser"></div></div>' +
        '<div class="bc-top"><div class="bc-title">Scan barcode</div>' +
          '<button class="bc-close" aria-label="Close">×</button></div>' +
        '<div class="bc-diag" id="bcDiag"></div>' +
        '<div class="bc-hint">Line up the product barcode inside the box' +
          '<br><button class="bc-manual">Enter code manually</button></div>');
      document.body.appendChild(ov);

      // Live status line (audit: "scans but never registers" reports on
      // real devices, with nothing on-screen distinguishing "no camera
      // frame yet" from "camera's reading frames but nothing decodes" from
      // "the engine never actually started" — this makes that visible
      // without needing devtools on a phone).
      var diagEl = ov.querySelector('#bcDiag');
      function setDiag(text) { if (diagEl) diagEl.textContent = text; }
      setDiag('requesting camera…');

      function cleanup() {
        if (done) return; done = true;
        if (raf) cancelAnimationFrame(raf);
        try { if (zxingReader && zxingReader.reset) zxingReader.reset(); } catch (e) {}
        try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        ov.remove();
      }
      function finish(code) { cleanup(); resolve(code || null); }
      function fail(err) { cleanup(); reject(err); }

      ov.querySelector('.bc-close').onclick = function () { finish(null); };
      ov.querySelector('.bc-manual').onclick = function () {
        // Shared module: also runs in Mike's Cookbook, which doesn't load
        // mc-input-sheet.js — use the sheet when present, plain prompt otherwise.
        if (window.MCInputSheet && MCInputSheet.prompt) {
          MCInputSheet.prompt({
            title: 'Enter barcode',
            label: 'The UPC/EAN number printed under the barcode',
            placeholder: 'Barcode number',
            inputMode: 'numeric',
            validate: function (v) { return v.replace(/\D/g, '') ? null : 'Enter the barcode’s digits.'; }
          }).then(function (v) { finish(v.replace(/\D/g, '')); }, function () {});
        } else {
          var v = window.prompt('Enter the barcode number:');
          if (v && v.replace(/\D/g, '')) finish(v.replace(/\D/g, ''));
        }
      };

      // start the camera, then attach whichever engine is available
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then(function (s) {
          stream = s; video.srcObject = s;
          if ('BarcodeDetector' in window) return video.play().catch(function () {}).then(runNative);
          // ZXing's decodeFromVideoElementContinuously() internally waits for
          // the video element's native 'playing' event before it ever enters
          // its decode loop (playVideoOnLoad -> tryPlayVideo). If *we* already
          // called and awaited video.play() before handing the element off —
          // which the native-engine branch above needs — that event already
          // fired in the past; ZXing's own play attempt then sees the video
          // already playing, no-ops, and no new 'playing' event ever comes.
          // The wait promise just hangs forever and decodeContinuously() is
          // never reached, no matter how long the camera points at a code.
          // Leaving the video unplayed here lets ZXing's own play call be the
          // one that actually fires the event it's listening for.
          setDiag('loading zxing fallback…');
          return loadZXing().then(runZXing, function (err) {
            setDiag('zxing library failed to load: ' + (err && err.message || err));
            throw err;
          });
        })
        .catch(function (err) {
          fail(new Error(err && err.name === 'NotAllowedError'
            ? 'Camera permission denied.'
            : (err && err.message) || 'Could not start the camera.'));
        });

      // ---- engine: native BarcodeDetector ----
      function runNative() {
        // Retail product barcodes only. code_128/code_39 are logistics/shelf-tag
        // symbologies with no built-in checksum matching a retail code — on
        // packaging that carries one (a lot code, a price-gun label) the
        // detector would lock onto it instead, hand back digits that don't
        // match anything in a food database, and read to the user as "it
        // scans but never finds the food." EAN/UPC formats carry a real check
        // digit, so restricting to them is itself most of the false-read fix.
        var formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
        var detector, restricted = true;
        try { detector = new window.BarcodeDetector({ formats: formats }); }
        catch (e) { detector = new window.BarcodeDetector(); restricted = false; }
        var frames = 0, misses = 0;
        setDiag('native · ' + (restricted ? 'ean/upc only' : 'unrestricted (formats rejected)'));
        var tick = function () {
          if (done) return;
          // Wait for real frames — detecting on a 0×0 / not-yet-playing video is
          // why scans never "registered": detect() on an empty frame yields
          // nothing and (pre-guard) could even reject. Spin cheaply until ready.
          if (video.readyState < 2 || !video.videoWidth) { raf = requestAnimationFrame(tick); return; }
          frames++;
          detector.detect(video).then(function (codes) {
            if (done) return;
            if (codes && codes.length && codes[0].rawValue) { finish(String(codes[0].rawValue).replace(/\D/g, '')); return; }
            misses++;
            if (misses % 15 === 0) setDiag('native · ' + frames + ' frames · no code found yet');
            raf = requestAnimationFrame(tick);
          }).catch(function (e) {
            setDiag('native · detect() error: ' + (e && e.name || e));
            if (!done) raf = requestAnimationFrame(tick);
          });
        };
        raf = requestAnimationFrame(tick);
      }

      // ---- engine: ZXing fallback ----
      function runZXing() {
        try {
          // Same restriction as the native engine above, and for the same
          // reason: an unhinted BrowserMultiFormatReader decodes *any*
          // symbology in frame (QR, code_128/39, PDF417…), so on iOS — where
          // this is the only engine, since Safari lacks BarcodeDetector — an
          // unrelated code on the packaging could win the race and hand back
          // digits no food database has ever heard of.
          var hints = new Map(), restricted = true;
          try {
            hints.set(window.ZXing.DecodeHintType.POSSIBLE_FORMATS, [
              window.ZXing.BarcodeFormat.EAN_13, window.ZXing.BarcodeFormat.EAN_8,
              window.ZXing.BarcodeFormat.UPC_A, window.ZXing.BarcodeFormat.UPC_E
            ]);
          } catch (e) { restricted = false; }
          var frames = 0, misses = 0;
          setDiag('zxing · ' + (restricted ? 'ean/upc only' : 'unrestricted (hint setup failed)'));
          // decodeFromVideoElement(source) — no callback param — does ONE
          // decode attempt tied to the video's 'loadedmetadata'/'playing'
          // event and returns a Promise that this code never awaited, so the
          // single result (successful or not) was silently discarded and no
          // further attempts ever ran: on any device that reaches this engine
          // (iOS/Safari, which lacks BarcodeDetector), the scanner never
          // registered a barcode, full stop. decodeFromVideoElementContinuously
          // is the actual callback-driven API — it loops decode attempts on a
          // timer until reset() is called.
          zxingReader = new window.ZXing.BrowserMultiFormatReader(hints);
          zxingReader.decodeFromVideoElementContinuously(video, function (result, err) {
            if (done) return;
            frames++;
            if (result && result.getText) { finish(String(result.getText()).replace(/\D/g, '')); return; }
            misses++;
            if (misses % 15 === 0) {
              setDiag('zxing · ' + frames + ' frames · ' + ((err && err.name) || 'no code found yet'));
            }
          });
        } catch (e) {
          setDiag('zxing · failed to start: ' + (e && e.message || e));
          fail(new Error('Scanner could not start.'));
        }
      }
    });
  }

  window.MCBarcode = { scan: scan, supported: supported };
})();
