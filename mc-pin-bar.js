/* mc-pin-bar.js — Universal "Set as Active Program" persistent CTA bar
   Reads window.MC_PROG config defined on each cat-*.html page.
   Writes to mc_active_prog (same key as dashboard.html confirmProg()). */
(function () {
  'use strict';
  var STORE = 'mc_active_prog';

  function isActive(id) {
    try {
      var cur = JSON.parse(localStorage.getItem(STORE) || 'null');
      return !!(cur && cur.id === id);
    } catch (e) { return false; }
  }

  function init() {
    var cfg = window.MC_PROG;
    if (!cfg || document.getElementById('mcPinBar')) return;

    var active = isActive(cfg.id);

    var bar = document.createElement('div');
    bar.id = 'mcPinBar';
    bar.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:64px', 'z-index:90',
      'padding:10px 16px',
      'background:rgba(10,10,10,0.96)',
      'backdrop-filter:blur(18px)', '-webkit-backdrop-filter:blur(18px)',
      'border-top:1px solid rgba(255,255,255,0.07)'
    ].join(';');

    var btn = document.createElement('button');
    btn.id = 'mcPinBtn';
    btn.style.cssText = [
      'width:100%', 'padding:13px',
      'background:' + cfg.color,
      'border:none', 'border-radius:13px',
      'color:#000', 'font-size:14px', 'font-weight:900',
      'cursor:pointer', 'font-family:inherit', 'letter-spacing:0.02em',
      'transition:opacity 0.2s,transform 0.1s'
    ].join(';');

    if (active) {
      btn.textContent = '✓ Currently Active Program';
      btn.style.opacity = '0.6';
    } else {
      btn.textContent = '📌 Set as Active Program';
    }

    btn.addEventListener('click', function () {
      try {
        var prog = {
          id: cfg.id, icon: cfg.icon, name: cfg.name, meta: cfg.meta,
          color: cfg.color, desc: cfg.desc, href: cfg.href, splits: cfg.splits
        };
        localStorage.setItem(STORE, JSON.stringify(prog));
      } catch (e) {}
      btn.textContent = '✓ Active Program Set!';
      btn.style.opacity = '0.65';
      btn.style.transform = 'scale(0.98)';
      setTimeout(function () {
        btn.textContent = '✓ Currently Active Program';
        btn.style.transform = '';
      }, 1800);
    });

    bar.appendChild(btn);
    document.body.appendChild(bar);

    /* Push body content up so the pin bar + nav tab bar don't obscure it */
    var curPb = parseInt(getComputedStyle(document.body).paddingBottom, 10) || 0;
    document.body.style.paddingBottom = (curPb + 54) + 'px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
