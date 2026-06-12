/* ==========================================================================
   mc-timer.js — shared rest-timer engine (extracted from the per-page copy)
   Globals kept: TMR, buildTimerFloat, makeRestTimer stays per-page,
   updateProgress, addTimerPresets — mc-setlog.js / superset-timers.js /
   inline onclick handlers all keep working unmodified.
   ========================================================================== */
const TMR = {
  interval: null,
  startTime: null,
  duration: 0,
  activeEl: null,
  activeName: '',
  _autoDismiss: null,

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

  buzz() {
    // Vibrate
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    // Sound — Web Audio API beep
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const times = [0, 0.3, 0.6];
      times.forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = i === 2 ? 880 : 660;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.25);
      });
    } catch(e) {}
  },

  start(el, durationSecs, exerciseName) {
    this.stop();
    this.duration = durationSecs;
    this.startTime = Date.now();
    this.activeEl = el;
    this.activeName = exerciseName;

    el.className = 'rest-timer running';
    el.querySelector('.rest-timer-label').textContent = this.formatTime(durationSecs);

    const float = document.getElementById('timerFloat');
    const floatTime = document.getElementById('timerFloatTime');
    const floatProgress = document.getElementById('timerFloatProgress');
    const floatEx = document.getElementById('timerFloatEx');
    const floatLabel = document.getElementById('timerFloatLabel');

    float.classList.add('visible');
    const _sov=document.getElementById('timerOverlay');if(_sov)_sov.style.display='block';
    floatEx.textContent = exerciseName;
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
    this.interval=setInterval(()=>{
      const rem=Math.ceil(this.duration-(Date.now()-this.startTime)/1000);
      const ft2=document.getElementById("timerFloat");if(!ft2)return;
      const tt2=ft2.querySelector(".timer-float-time"),tp2=ft2.querySelector(".timer-float-progress"),tl2=ft2.querySelector(".timer-float-label");
      if(rem>0){if(tt2){tt2.textContent=rem+"s";tt2.className="timer-float-time";}if(tp2){tp2.style.width=Math.round((rem/this.duration)*100)+"%";tp2.className="timer-float-progress";}}
      else if(rem===0){if(tt2){tt2.textContent="DONE!";tt2.className="timer-float-time done";}if(tp2){tp2.style.width="100%";tp2.className="timer-float-progress done";}if(tl2)tl2.textContent="DONE ✓";try{navigator.vibrate&&navigator.vibrate([200,100,200,100,400]);}catch(e){}if(!TMR._autoDismiss)TMR._autoDismiss=setTimeout(()=>TMR.stop(),4000);}
      else{if(tt2){tt2.textContent="+"+Math.abs(rem)+"s";tt2.className="timer-float-time overtime";}if(tp2)tp2.className="timer-float-progress overtime";}
    },1000);
  }
};

function buildTimerFloat() {
  if (document.getElementById('timerFloat')) return;
  const div = document.createElement('div');
  div.id = 'timerFloat';
  div.className = 'timer-float';
  div.innerHTML = `
    <div id="timerFloatLabel" class="timer-float-label">REST</div>
    <div id="timerFloatTime" class="timer-float-time">0s</div>
    <div id="timerFloatEx" class="timer-float-ex"></div>
    <div class="timer-float-bar"><div id="timerFloatProgress" class="timer-float-progress"></div></div>
    <div class="timer-float-actions">
      <button class="timer-float-btn timer-float-skip" onclick="TMR.stop()">✓ Done</button>
      <button class="timer-float-btn timer-float-reset" onclick="TMR.stop()">✕ Cancel</button>
    </div>`;
  document.body.appendChild(div);
  if(!document.getElementById('timerOverlay')){const _tov=document.createElement('div');_tov.id='timerOverlay';_tov.style.cssText='position:fixed;inset:0;z-index:99;display:none;cursor:pointer;';_tov.addEventListener('click',function(){TMR.stop();});document.body.insertBefore(_tov,div);}
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
  const presets = document.createElement('div');
  presets.className = 'timer-presets';
  presets.innerHTML = ['45s','60s','90s','2min'].map(function(l) {
    const s = l==='2min'?120:parseInt(l);
    return '<button class="timer-preset" onclick="TMR.setTime && TMR.setTime('+s+',\''+l+'\')" >' + l + '</button>';
  }).join('');
  tf.appendChild(presets);
}
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(addTimerPresets, 500);
});
