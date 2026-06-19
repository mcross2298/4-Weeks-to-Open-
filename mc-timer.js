/* ==========================================================================
   mc-timer.js — shared rest-timer engine (extracted from the per-page copy)
   Globals kept: TMR, buildTimerFloat, makeRestTimer stays per-page,
   updateProgress, addTimerPresets — mc-setlog.js / superset-timers.js /
   inline onclick handlers all keep working unmodified.
   ========================================================================== */
// ── cue preferences (mc_prefs_v1) ──
const MC_PREFS = {
  KEY: 'mc_prefs_v1',
  get() {
    let p = {};
    try { p = JSON.parse(localStorage.getItem(this.KEY) || '{}') || {}; } catch (e) {}
    return { sound: p.sound !== false, haptics: p.haptics !== false, cue10s: p.cue10s !== false };
  },
  set(k, v) {
    const p = this.get(); p[k] = v;
    try { localStorage.setItem(this.KEY, JSON.stringify(p)); } catch (e) {}
  }
};

// Web Audio contexts start suspended on iOS until a user gesture; keep one
// primed singleton so cues can actually play (a fresh context mid-countdown
// stays silent on iPhone).
let _tmrCtx = null;
function _tmrPrime() {
  try {
    if (!_tmrCtx) _tmrCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_tmrCtx.state === 'suspended') _tmrCtx.resume();
  } catch (e) { _tmrCtx = null; }
}
document.addEventListener('pointerdown', _tmrPrime, { passive: true });

const TMR = {
  interval: null,
  startTime: null,
  duration: 0,
  activeEl: null,
  activeName: '',
  _autoDismiss: null,
  _cued10: false,

  parseSeconds(str) {
    if (!str || str === '—') return 0;
    str = str.toLowerCase().trim();
    // e.g. "90 sec", "2 min", "75 sec between & after", "30, 30, 30 sec"
    const minMatch = str.match(/(\d+)\s*min/);
    const secMatch = str.match(/(\d+)\s*sec/);
    let secs = 0;
    if (minMatch) secs += parseInt(minMatch[1]) * 60;
    if (secMatch) secs += parseInt(secMatch[1]);
    if (!secs) {
      // plain number
      const plain = str.match(/^(\d+)/);
      if (plain) secs = parseInt(plain[1]);
    }
    return secs;
  },

  formatTime(secs) {
    const neg = secs < 0;
    const abs = Math.abs(secs);
    const m = Math.floor(abs / 60);
    const s = abs % 60;
    return (neg ? '+' : '') + (m > 0 ? m + ':' + String(s).padStart(2,'0') : String(s) + 's');
  },

  _tones(spec) {
    // spec: [{t, hz, vol, len}] — played on the primed context (iOS-safe)
    try {
      _tmrPrime();
      const ctx = _tmrCtx || new (window.AudioContext || window.webkitAudioContext)();
      spec.forEach(s => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = s.hz;
        osc.type = 'sine';
        gain.gain.setValueAtTime(s.vol, ctx.currentTime + s.t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + s.t + s.len);
        osc.start(ctx.currentTime + s.t);
        osc.stop(ctx.currentTime + s.t + s.len);
      });
    } catch(e) {}
  },

  buzz() {
    const p = MC_PREFS.get();
    // Vibrate (no-op on iOS — audio is the only cue there, so never gate it on haptics)
    if (p.haptics && navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    if (p.sound) this._tones([
      { t: 0,   hz: 660, vol: 0.4, len: 0.25 },
      { t: 0.3, hz: 660, vol: 0.4, len: 0.25 },
      { t: 0.6, hz: 880, vol: 0.4, len: 0.25 }
    ]);
  },

  // soft 10-seconds-left warning: quieter double-beep + short tap
  cue10() {
    const p = MC_PREFS.get();
    if (!p.cue10s) return;
    if (p.haptics && navigator.vibrate) navigator.vibrate(100);
    if (p.sound) this._tones([
      { t: 0,    hz: 520, vol: 0.22, len: 0.12 },
      { t: 0.18, hz: 520, vol: 0.22, len: 0.12 }
    ]);
  },

  start(el, durationSecs, exerciseName) {
    this.stop();
    this.duration = durationSecs;
    this.startTime = Date.now();
    this.activeEl = el;
    this.activeName = exerciseName;
    this._cued10 = false;

    el.className = 'rest-timer running';
    el.querySelector('.rest-timer-label').textContent = this.formatTime(durationSecs);

    const float = document.getElementById('timerFloat');
    const floatTime = document.getElementById('timerFloatTime');
    const floatProgress = document.getElementById('timerFloatProgress');
    const floatEx = document.getElementById('timerFloatEx');
    const floatLabel = document.getElementById('timerFloatLabel');

    float.classList.add('visible');
    const _sov=document.getElementById('timerOverlay');if(_sov)_sov.style.display='block';
    // Header reads "REST · <exercise>". Suppress a generic "Rest" name so it
    // doesn't render as the redundant "REST Rest".
    floatEx.textContent = (exerciseName && !/^rest$/i.test(exerciseName.trim())) ? exerciseName : '';
    floatLabel.textContent = 'REST';
    floatTime.className = 'timer-float-time';
    floatProgress.className = 'timer-float-progress';
    floatProgress.style.width = '100%';

    this.interval = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const remaining = Math.ceil(this.duration - elapsed);

      // Update card badge
      if (el) {
        el.querySelector('.rest-timer-label').textContent = this.formatTime(remaining);
      }

      // Update float
      floatTime.textContent = this.formatTime(remaining);

      if (remaining > 0) {
        // exactly-10 check means a tick missed while backgrounded skips the
        // warning rather than firing it late
        if (remaining === 10 && this.duration > 15 && !this._cued10) {
          this._cued10 = true;
          this.cue10();
        }
        const pct = (remaining / this.duration) * 100;
        floatProgress.style.width = pct + '%';
        floatTime.className = 'timer-float-time';
        floatProgress.className = 'timer-float-progress';
        if (el) el.className = 'rest-timer running';
      } else if (remaining === 0 || remaining === -0) {
        this.buzz();
        floatTime.className = 'timer-float-time done';
        floatProgress.className = 'timer-float-progress done';
        floatProgress.style.width = '100%';
        floatLabel.textContent = 'DONE!';
        if (el) el.className = 'rest-timer done';
        if(!this._autoDismiss)this._autoDismiss=setTimeout(()=>this.stop(),4000);
      } else {
        // Overtime
        floatTime.textContent = '+' + this.formatTime(-remaining);
        floatTime.className = 'timer-float-time overtime';
        floatProgress.className = 'timer-float-progress overtime';
        floatLabel.textContent = 'OVERTIME';
        if (el) el.className = 'rest-timer overtime';
      }
    }, 1000);
  },

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    if (this.activeEl) {
      const secs = this.parseSeconds(this.activeEl.dataset.rest);
      this.activeEl.querySelector('.rest-timer-label').textContent = this.activeEl.dataset.label;
      this.activeEl.className = 'rest-timer idle';
      this.activeEl = null;
    }
    const float = document.getElementById('timerFloat');
    if (float) float.classList.remove('visible');
    const _ov=document.getElementById('timerOverlay');if(_ov)_ov.style.display='none';
    if(this._autoDismiss){clearTimeout(this._autoDismiss);this._autoDismiss=null;}
  },

  toggle(el, durationSecs, exerciseName) {
    if (this.activeEl === el && this.interval) {
      this.stop();
    } else {
      this.start(el, durationSecs, exerciseName);
    }
  },

  // Extend / trim the rest currently running without cancelling it — the
  // prescribed rest often isn't what you want that day (heavy set → +15s,
  // feeling good → −15s). Works for both the rest flow and the preset flow.
  adjust(delta) {
    if (this.startTime == null || !this.interval) return;
    this.duration = Math.max(0, this.duration + delta);
    if (this._autoDismiss) { clearTimeout(this._autoDismiss); this._autoDismiss = null; }
    const remaining = Math.ceil(this.duration - (Date.now() - this.startTime) / 1000);
    if (remaining > 10) this._cued10 = false;   // re-arm the 10s cue if we bought time back
    const ft = document.getElementById('timerFloatTime');   // snappy immediate repaint
    if (ft) {
      ft.textContent = this.formatTime(remaining);
      ft.className = 'timer-float-time' + (remaining <= 0 ? ' overtime' : '');
    }
    const p = MC_PREFS.get();   // light tick so the tap registers
    if (p.haptics && navigator.vibrate) navigator.vibrate(10);
  },
  setTime(secs,label){
    this.stop();
    if(this.interval){clearInterval(this.interval);this.interval=null;}
    this.duration=secs;this.startTime=Date.now();
    const ft=document.getElementById("timerFloat");
    if(ft){
      const tl=ft.querySelector(".timer-float-label"),tt=ft.querySelector(".timer-float-time"),tp=ft.querySelector(".timer-float-progress");
      if(tl)tl.textContent=label||(secs+"s");
      if(tt){tt.textContent=secs+"s";tt.className="timer-float-time";}
      if(tp){tp.style.width="100%";tp.className="timer-float-progress";}
      ft.classList.add("visible");
    }
    this.activeEl=null;
    this._cued10=false;
    this.interval=setInterval(()=>{
      const rem=Math.ceil(this.duration-(Date.now()-this.startTime)/1000);
      const ft2=document.getElementById("timerFloat");if(!ft2)return;
      const tt2=ft2.querySelector(".timer-float-time"),tp2=ft2.querySelector(".timer-float-progress"),tl2=ft2.querySelector(".timer-float-label");
      if(rem>0){if(rem===10&&this.duration>15&&!this._cued10){this._cued10=true;this.cue10();}if(tt2){tt2.textContent=rem+"s";tt2.className="timer-float-time";}if(tp2){tp2.style.width=Math.round((rem/this.duration)*100)+"%";tp2.className="timer-float-progress";}}
      else if(rem===0){if(tt2){tt2.textContent="DONE!";tt2.className="timer-float-time done";}if(tp2){tp2.style.width="100%";tp2.className="timer-float-progress done";}if(tl2)tl2.textContent="DONE ✓";this.buzz();if(!TMR._autoDismiss)TMR._autoDismiss=setTimeout(()=>TMR.stop(),4000);}
      else{if(tt2){tt2.textContent="+"+Math.abs(rem)+"s";tt2.className="timer-float-time overtime";}if(tp2)tp2.className="timer-float-progress overtime";}
    },1000);
  }
};

// Timer-float layout + cosmetics, injected once into <head> at runtime so they
// apply on EVERY workout page identically. The per-page inline .timer-float CSS
// is duplicated and divergent across ~11 pages (a cramped 64px single-row bar);
// a runtime <head> rule lands after those linked/inline styles in the cascade,
// so this fully re-owns the float as a clean vertical "card" without editing
// each page. The set-once controls (cue prefs + quick-timer presets) collapse
// behind a ⚙️ gear so a live rest shows only the essentials.
function injectTimerEnhCss() {
  if (document.getElementById('mcTimerEnhCss')) return;
  const st = document.createElement('style');
  st.id = 'mcTimerEnhCss';
  st.textContent =
    // ── container: bottom sheet, auto-height vertical stack, centered on wide ──
    '.timer-float{height:auto!important;width:auto!important;left:0!important;right:0!important;' +
      'flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;' +
      'gap:9px!important;max-width:480px;margin:0 auto;' +
      'padding:10px 18px calc(16px + env(safe-area-inset-bottom,0px))!important;' +
      'border-radius:20px 20px 0 0;border:1px solid rgba(255,255,255,0.1);border-bottom:none;}' +
    '.tf-grip{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,0.18);margin:0 auto 2px;flex-shrink:0;}' +
    // ── header: REST · exercise on the left, gear on the right ──
    '.tf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;}' +
    '.tf-head-text{display:flex;align-items:baseline;gap:8px;min-width:0;}' +
    '.timer-float-label{flex-shrink:0;}' +
    '.timer-float-ex{text-align:left!important;max-width:none!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.tf-head-text .timer-float-ex:not(:empty)::before{content:"· ";color:#475569;}' +
    '.tf-gear{flex-shrink:0;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,0.12);' +
      'background:rgba(255,255,255,0.05);color:#94a3b8;font-size:15px;cursor:pointer;display:flex;' +
      'align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:transform .2s;}' +
    '.tf-gear.on{color:#fbbf24;border-color:rgba(212,175,55,0.4);background:rgba(212,175,55,0.12);transform:rotate(60deg);}' +
    // ── big glanceable numerals + full-width progress ──
    '.timer-float-time{font-size:54px!important;text-align:center;width:100%;line-height:1;margin:2px 0;transition:color .25s ease;}' +
    '.timer-float-bar{width:100%!important;margin:0!important;}' +
    // ── one tidy control row: adjust group left, actions group right ──
    '.tf-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px;}' +
    '.timer-float-adjust{display:flex;gap:8px;margin:0!important;justify-content:flex-start;}' +
    '.timer-float-actions{display:flex;gap:8px;margin:0!important;}' +
    '.timer-float-adj{padding:9px 15px;border-radius:9px;border:1px solid rgba(255,255,255,0.14);' +
      'background:rgba(255,255,255,0.05);color:#cbd5e1;font-size:13px;font-weight:800;letter-spacing:0.03em;' +
      'cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;}' +
    '.timer-float-adj:active{background:rgba(212,175,55,0.16);color:#fbbf24;border-color:rgba(212,175,55,0.4);}' +
    '.timer-float-btn{padding:9px 16px!important;font-size:13px!important;}' +
    // ── collapsible tray: cue prefs + presets, hidden until the gear is tapped ──
    '.tf-tray{max-height:0;overflow:hidden;transition:max-height .25s ease;}' +
    '.tf-tray.open{max-height:200px;}' +
    '.timer-float-prefs{margin:6px 0 0!important;flex-wrap:wrap;}' +
    '.timer-presets{margin-top:8px!important;}' +
    // ── carried-over motion ──
    '@keyframes mcTmrDonePop{0%{transform:scale(.9);opacity:.65}60%{transform:scale(1.05)}100%{transform:scale(1)}}' +
    '.timer-float-time.done{animation:mcTmrDonePop .45s ease-out;}' +
    '@keyframes mcTmrSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}' +
    '.timer-float.visible{animation:mcTmrSlideUp .22s ease-out;}';
  document.head.appendChild(st);
}

function buildTimerFloat() {
  if (document.getElementById('timerFloat')) return;
  injectTimerEnhCss();
  const div = document.createElement('div');
  div.id = 'timerFloat';
  div.className = 'timer-float';
  div.innerHTML = `
    <div class="tf-grip"></div>
    <div class="tf-head">
      <div class="tf-head-text">
        <span id="timerFloatLabel" class="timer-float-label">REST</span>
        <span id="timerFloatEx" class="timer-float-ex"></span>
      </div>
      <button class="tf-gear" id="tfGear" aria-label="Timer settings">⚙️</button>
    </div>
    <div id="timerFloatTime" class="timer-float-time">0s</div>
    <div class="timer-float-bar"><div id="timerFloatProgress" class="timer-float-progress"></div></div>
    <div class="tf-controls">
      <div class="timer-float-adjust">
        <button class="timer-float-adj" onclick="TMR.adjust(-15)">−15s</button>
        <button class="timer-float-adj" onclick="TMR.adjust(15)">+15s</button>
      </div>
      <div class="timer-float-actions">
        <button class="timer-float-btn timer-float-skip" onclick="TMR.stop()">✓ Done</button>
        <button class="timer-float-btn timer-float-reset" onclick="TMR.stop()" aria-label="Cancel rest">✕</button>
      </div>
    </div>
    <div class="tf-tray" id="tfTray">
      <div class="timer-float-prefs" id="timerFloatPrefs"></div>
    </div>`;
  document.body.appendChild(div);
  renderTimerPrefs();
  // ⚙️ gear reveals/hides the set-once tray (cue prefs + quick-timer presets).
  const gear = document.getElementById('tfGear'), tray = document.getElementById('tfTray');
  if (gear && tray) {
    gear.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = tray.classList.toggle('open');
      gear.classList.toggle('on', open);
    });
  }
  if(!document.getElementById('timerOverlay')){const _tov=document.createElement('div');_tov.id='timerOverlay';_tov.style.cssText='position:fixed;inset:0;z-index:99;display:none;cursor:pointer;';_tov.addEventListener('click',function(){TMR.stop();});document.body.insertBefore(_tov,div);}
}
// ── cue preference toggles inside the timer float ──
function renderTimerPrefs() {
  const host = document.getElementById('timerFloatPrefs');
  if (!host) return;
  if (!document.getElementById('mcTimerPrefsCss')) {
    const st = document.createElement('style');
    st.id = 'mcTimerPrefsCss';
    st.textContent =
      '.timer-float-prefs{display:flex;gap:6px;margin-top:8px;justify-content:center;}' +
      '.tf-pref{padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);' +
        'background:rgba(255,255,255,0.05);color:#475569;font-size:10px;font-weight:800;' +
        'letter-spacing:0.05em;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.tf-pref.on{color:#fbbf24;border-color:rgba(212,175,55,0.4);background:rgba(212,175,55,0.12);}';
    document.head.appendChild(st);
  }
  const defs = [
    { k: 'sound',   lbl: '🔊 Sound' },
    { k: 'haptics', lbl: '📳 Vibrate' },
    { k: 'cue10s',  lbl: '⏰ 10s cue' }
  ];
  const p = MC_PREFS.get();
  host.innerHTML = '';
  defs.forEach(d => {
    const b = document.createElement('button');
    b.className = 'tf-pref' + (p[d.k] ? ' on' : '');
    b.textContent = d.lbl;
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      const cur = MC_PREFS.get();
      MC_PREFS.set(d.k, !cur[d.k]);
      b.classList.toggle('on', !cur[d.k]);
    });
    host.appendChild(b);
  });
}

buildTimerFloat();

// ── SESSION PROGRESS BAR ──
function updateProgress() {
  const all = document.querySelectorAll('.ex-card, .ss-ex');
  const done = document.querySelectorAll('.ex-card.checked, .ss-ex.checked');
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;
  const fill = document.getElementById('progFill');
  if (fill) fill.style.width = pct + '%';
}
// Observe DOM for check changes
const _progObs = new MutationObserver(updateProgress);
document.addEventListener('DOMContentLoaded', function() {
  const app = document.getElementById('app');
  if (app) _progObs.observe(app, {subtree:true, attributes:true, attributeFilter:['class']});
  updateProgress();
});

// ── TIMER PRESETS ──
function addTimerPresets() {
  const tf = document.getElementById('timerFloat');
  if (!tf || tf.querySelector('.timer-presets')) return;
  // Presets are a manual-timer convenience, not needed during an auto-rest —
  // park them in the collapsible tray (behind the ⚙️ gear) to keep the live
  // rest view clean. Fall back to the float root if the tray isn't present.
  const host = document.getElementById('tfTray') || tf;
  const presets = document.createElement('div');
  presets.className = 'timer-presets';
  presets.innerHTML = ['45s','60s','90s','2min'].map(function(l) {
    const s = l==='2min'?120:parseInt(l);
    return '<button class="timer-preset" onclick="TMR.setTime && TMR.setTime('+s+',\''+l+'\')" >' + l + '</button>';
  }).join('');
  host.appendChild(presets);
}
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(addTimerPresets, 500);
});
