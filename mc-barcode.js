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
        '<div class="bc-hint">Line up the product barcode inside the box' +
          '<br><button class="bc-manual">Enter code manually</button></div>');
      document.body.appendChild(ov);

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
          return video.play().catch(function () {});
        })
        .then(function () {
          if ('BarcodeDetector' in window) return runNative();
          return loadZXing().then(runZXing);
        })
        .catch(function (err) {
          fail(new Error(err && err.name === 'NotAllowedError'
            ? 'Camera permission denied.'
            : (err && err.message) || 'Could not start the camera.'));
        });

      // ---- engine: native BarcodeDetector ----
      function runNative() {
        var formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
        var detector;
        try { detector = new window.BarcodeDetector({ formats: formats }); }
        catch (e) { detector = new window.BarcodeDetector(); }
        var tick = function () {
          if (done) return;
          // Wait for real frames — detecting on a 0×0 / not-yet-playing video is
          // why scans never "registered": detect() on an empty frame yields
          // nothing and (pre-guard) could even reject. Spin cheaply until ready.
          if (video.readyState < 2 || !video.videoWidth) { raf = requestAnimationFrame(tick); return; }
          detector.detect(video).then(function (codes) {
            if (done) return;
            if (codes && codes.length && codes[0].rawValue) { finish(String(codes[0].rawValue).replace(/\D/g, '')); return; }
            raf = requestAnimationFrame(tick);
          }).catch(function () { if (!done) raf = requestAnimationFrame(tick); });
        };
        raf = requestAnimationFrame(tick);
      }

      // ---- engine: ZXing fallback ----
      function runZXing() {
        try {
          zxingReader = new window.ZXing.BrowserMultiFormatReader();
          zxingReader.decodeFromVideoElement(video, function (result, err) {
            if (done) return;
            if (result && result.getText) finish(String(result.getText()).replace(/\D/g, ''));
          });
        } catch (e) {
          fail(new Error('Scanner could not start.'));
        }
      }
    });
  }

  window.MCBarcode = { scan: scan, supported: supported };
})();
