/* ks-engine.js — shared render engine for the Kitchen Sink program family
   (audit LS-5, W-09). Consolidates the near-duplicate inline engines that had
   drifted across kitchen-sink*.html. Each page defines window.DATA and
   window.KS_CFG ({sched, eyebrow}) BEFORE loading this file; the engine renders
   into #app, exactly as the old inline copies did. Runs at top-level global
   scope (NOT an IIFE) on purpose: TMR/buildTimerFloat are referenced by inline
   onclick handlers in the rendered HTML. Switch-over is gated byte-for-byte by
   a headless #app-DOM diff vs the pre-consolidation baseline. */

const TMR={interval:null,startTime:null,duration:0,activeEl:null,activeName:'',_autoDismiss:null,
  parseSeconds(str){if(!str||str==='—')return 0;str=str.toLowerCase().trim();const minMatch=str.match(/(\d+)\s*min/);const secMatch=str.match(/(\d+)\s*sec/);let secs=0;if(minMatch)secs+=parseInt(minMatch[1])*60;if(secMatch)secs+=parseInt(secMatch[1]);if(!secs){const plain=str.match(/^(\d+)/);if(plain)secs=parseInt(plain[1]);}return secs;},
  formatTime(secs){const neg=secs<0;const abs=Math.abs(secs);const m=Math.floor(abs/60);const s=abs%60;return(neg?'+':'')+(m>0?m+':'+String(s).padStart(2,'0'):String(s)+'s');},
  buzz(){if(navigator.vibrate)navigator.vibrate([200,100,200,100,400]);try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const times=[0,0.3,0.6];times.forEach((t,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=i===2?880:660;osc.type='sine';gain.gain.setValueAtTime(0.4,ctx.currentTime+t);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.25);osc.start(ctx.currentTime+t);osc.stop(ctx.currentTime+t+0.25);});}catch(e){}},
  start(el,durationSecs,exerciseName){this.stop();this.duration=durationSecs;this.startTime=Date.now();this.activeEl=el;this.activeName=exerciseName;el.className='rest-timer running';el.querySelector('.rest-timer-label').textContent=this.formatTime(durationSecs);const float=document.getElementById('timerFloat');const floatTime=document.getElementById('timerFloatTime');const floatProgress=document.getElementById('timerFloatProgress');const floatEx=document.getElementById('timerFloatEx');const floatLabel=document.getElementById('timerFloatLabel');float.classList.add('visible');const _sov=document.getElementById('timerOverlay');if(_sov)_sov.style.display='block';floatEx.textContent=exerciseName;floatLabel.textContent='REST';floatTime.className='timer-float-time';floatProgress.className='timer-float-progress';floatProgress.style.width='100%';this.interval=setInterval(()=>{const elapsed=(Date.now()-this.startTime)/1000;const remaining=Math.ceil(this.duration-elapsed);if(el)el.querySelector('.rest-timer-label').textContent=this.formatTime(remaining);floatTime.textContent=this.formatTime(remaining);if(remaining>0){const pct=(remaining/this.duration)*100;floatProgress.style.width=pct+'%';floatTime.className='timer-float-time';floatProgress.className='timer-float-progress';if(el)el.className='rest-timer running';}else if(remaining===0||remaining===-0){this.buzz();floatTime.className='timer-float-time done';floatProgress.className='timer-float-progress done';floatProgress.style.width='100%';floatLabel.textContent='DONE!';if(el)el.className='rest-timer done';if(!this._autoDismiss)this._autoDismiss=setTimeout(()=>this.stop(),4000);}else{floatTime.textContent='+'+this.formatTime(-remaining);floatTime.className='timer-float-time overtime';floatProgress.className='timer-float-progress overtime';floatLabel.textContent='OVERTIME';if(el)el.className='rest-timer overtime';}},1000);},
  stop(){if(this.interval)clearInterval(this.interval);this.interval=null;if(this.activeEl){this.activeEl.querySelector('.rest-timer-label').textContent=this.activeEl.dataset.label;this.activeEl.className='rest-timer idle';this.activeEl=null;}const float=document.getElementById('timerFloat');if(float)float.classList.remove('visible');const _ov=document.getElementById('timerOverlay');if(_ov)_ov.style.display='none';if(this._autoDismiss){clearTimeout(this._autoDismiss);this._autoDismiss=null;}},
  toggle(el,durationSecs,exerciseName){if(this.activeEl===el&&this.interval){this.stop();}else{this.start(el,durationSecs,exerciseName);}}
};

function buildTimerFloat(){if(document.getElementById('timerFloat'))return;const div=document.createElement('div');div.id='timerFloat';div.className='timer-float';div.innerHTML=`<div id="timerFloatLabel" class="timer-float-label">REST</div><div id="timerFloatTime" class="timer-float-time">0s</div><div id="timerFloatEx" class="timer-float-ex"></div><div class="timer-float-bar"><div id="timerFloatProgress" class="timer-float-progress"></div></div><div class="timer-float-actions"><button class="timer-float-btn timer-float-skip" onclick="TMR.stop()">✓ Done</button><button class="timer-float-btn timer-float-reset" onclick="TMR.stop()">✕ Cancel</button></div>`;document.body.appendChild(div);if(!document.getElementById('timerOverlay')){const _tov=document.createElement('div');_tov.id='timerOverlay';_tov.style.cssText='position:fixed;inset:0;z-index:99;display:none;cursor:pointer;';_tov.addEventListener('click',function(){TMR.stop();});document.body.insertBefore(_tov,div);}}

function makeRestTimer(restStr,exerciseName){const secs=TMR.parseSeconds(restStr);if(!secs)return'<span class="ex-sets" style="opacity:0.5">⏱️ '+restStr+'</span>';const label=restStr;return'<span class="rest-timer idle" data-rest="'+restStr+'" data-label="'+label+'" onclick="buildTimerFloat();TMR.toggle(this,'+secs+',\''+exerciseName.replace(/'/g,"\'").substring(0,30)+'...\')" title="Tap to start rest timer"><span class="rest-timer-icon">⏱️</span><span class="rest-timer-label">'+label+'</span></span>';}
buildTimerFloat();

// ── PROGRAM DATA + CONFIG (per page, via window.DATA / window.KS_CFG) ──
const CFG = window.KS_CFG || {};
const SCHED = CFG.sched || '';
const DATA = window.DATA;




// ── HELPERS ──
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function hexToRgb(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return r+','+g+','+b;}

let activeWeek = "w1";

function tagClass(tag){
  if(!tag)return'';
  const t=tag.toLowerCase().replace(/\s+/g,'');
  if(t==='tri-set')return'triset';
  if(t==='superset')return'superset';
  if(t==='cluster')return'cluster';
  if(t==='drop set'||t==='dropset')return'dropset';
  if(t==='finisher')return'finisher';
  return'grp';
}

function cardClass(tag){
  if(!tag)return'';
  const t=tag.toLowerCase().replace(/\s+/g,'');
  if(t==='tri-set')return' is-triset is-ss';
  if(t==='superset')return' is-superset is-ss';
  if(t==='cluster')return' is-cluster';
  if(t==='drop set'||t==='dropset')return' is-drop';
  if(t==='finisher')return' is-finisher';
  return'';
}

// A drop set's AMRAP target renders as a bare "∞" (one per AMRAP set) —
// never a "2×∞" shorthand. Only swaps the word itself; numeric drop targets
// (e.g. "drop 15") and standalone AMRAP prescriptions (no drop) are untouched.
function amrapToInfinity(s){ return String(s).replace(/\bamrap\b/gi,'∞'); }

function renderReps(sets){
  if(!sets||sets==='—')return'<span style="color:#9ca3af;font-style:italic">—</span>';
  if(sets.includes('→')){
    const parts=sets.split('→');
    const baseHtml=renderChips(parts[0].trim(),'#fbbf24');
    const extHtml=`<span style="font-size:11px;font-weight:900;color:#94a3b8;margin:0 4px">→</span>`+renderChips(amrapToInfinity(parts[1].trim()),'#f87171');
    return`<div class="a-leg">${baseHtml}${extHtml}</div>`;
  }
  const lower=sets.toLowerCase();
  if(lower.includes('amrap')){
    return`<div style="font-size:13px;color:#c084fc;font-weight:800">${escapeHtml(sets)}</div>`;
  }
  const chips=sets.split(',').map((rep,i)=>{
    const r=rep.trim();
    const special=r.toUpperCase().includes('AMRAP')||r.includes('×');
    const cls=special?'a-rep special':(i===0?'a-rep live':'a-rep');
    const sep=i<sets.split(',').length-1?'<span class="a-sep">·</span>':'';
    return`<span class="${cls}">${escapeHtml(r)}</span>${sep}`;
  }).join('');
  return`<div class="a-leg">${chips}</div>`;
}

function renderChips(str,color){
  return str.split(',').map((r,i)=>{
    const t=r.trim();
    const sep=i<str.split(',').length-1?'<span class="a-sep">·</span>':'';
    return`<span class="a-rep" style="color:${color}">${escapeHtml(t)}</span>${sep}`;
  }).join('');
}

function renderExercise(ex,dIdx,eIdx){
  const tc=tagClass(ex.tag);
  const cc=cardClass(ex.tag);
  const badges=[];
  if(ex.tag)badges.push(`<span class="a-pill ${tc}">${escapeHtml(ex.tag)}</span>`);
  if(ex.tempo)badges.push(`<span class="a-pill tempo">⏱ ${escapeHtml(ex.tempo)}</span>`);
  if(ex.notes&&ex.notes.includes('REVERSE PYRAMID'))badges.push(`<span class="a-pill rp">▼ REV PYRAMID</span>`);
  if(ex.notes&&ex.notes.includes('MECHANICAL DROP'))badges.push(`<span class="a-pill rp">⚡ MECH DROP</span>`);
  const badgeHtml=badges.length?`<div class="a-badges">${badges.join('')}</div>`:'';
  const notesHtml=ex.notes?`<div class="a-notes">📝 ${escapeHtml(ex.notes)}</div>`:'';
  const repsHtml=renderReps(ex.sets);
  return`<div class="ex-card a-card${cc}"><div class="ex-body">
    <div class="a-top">
      <div class="a-idx">${eIdx+1}</div>
      <div class="a-head">
        <div class="ex-name a-name"><span class="editable" data-field="name" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.name)}</span></div>
        ${badgeHtml}
      </div>
    </div>
    <div class="a-reps">${repsHtml}</div>
    <div class="a-strip">
      <div class="a-cell"><span class="k">Sets</span><span class="v"><span class="editable" data-field="sets" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.sets)}</span></span></div>
      <div class="a-cell"><span class="k">Rest</span><span class="v"><span class="editable" data-field="rest" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.rest)}</span></span></div>
    </div>
    <div class="a-timerbar">${makeRestTimer(ex.rest||'90 sec',ex.name)}</div>
    ${notesHtml}
  </div></div>`;
}

function groupBanner(tag){
  const labels={
    'TRI-SET':['triset','TRI-SET · Complete all 3 exercises before resting · Rest 2-3 min after each full round'],
    'SUPERSET':['superset','SUPERSET · No rest between A & B · Rest 60 sec after both'],
    'CLUSTER':['cluster','CLUSTER SET · Base pyramid sets, then 3 micro-sets with 15 sec intra-rest'],
    'DROP SET':['dropset','DROP SET · Base pyramid sets, then 2 immediate drops to AMRAP'],
    'FINISHER':['finisher','FINISHER · 3×AMRAP · 45 sec rest between rounds · Leave nothing behind']
  };
  if(!labels[tag])return'';
  const[cls,text]=labels[tag];
  return`<div class="group-banner ${cls}">${escapeHtml(text)}</div>`;
}

function renderDay(day,dIdx){
  if(day.type==='conditioning'){
    const rgb='217,119,6';
    return`<div class="day-card" data-d="${dIdx}" style="--day-rgb:${rgb}">
      <div class="day-header">
        <div class="day-icon" style="background:#d97706;box-shadow:0 2px 10px #d9770666">⚡</div>
        <div class="day-info">
          <div class="day-session">Conditioning Day</div>
          <div class="day-meta">${escapeHtml(day.label)} · Select Workout · ${SCHED}</div>
        </div>
        <div class="day-toggle">▼</div>
      </div>
      <div class="exercises" style="border-top-color:#d9770633">
        <div style="padding:10px 4px 4px;font-size:10.5px;color:#fbbf24;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;opacity:0.65">Select a conditioning session</div>
        <a href="dashboard.html?tab=conditioning" style="display:flex;align-items:center;justify-content:space-between;background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.3);border-radius:12px;padding:14px 16px;margin:6px 0 12px;text-decoration:none;">
          <div>
            <div style="font-weight:800;font-size:14px;color:#fbbf24;">Browse Conditioning Corner →</div>
            <div style="font-size:11px;color:#92400e;margin-top:3px;">HIIT · Cardio · Circuits · Lactate Threshold</div>
          </div>
          <div style="font-size:18px;color:#fbbf24;">⚡</div>
        </a>
      </div>
    </div>`;
  }
  if(day.type==='activerest'){
    const rgb='13,148,136';
    const acts=[
      {icon:'🚶',name:'Low Intensity Cardio',desc:'20–30 min easy walk, light bike, or swim'},
      {icon:'🧘',name:'Stretching',desc:'Full-body static stretch — hold 30–60 sec per position'},
      {icon:'🔄',name:'Mobility Work',desc:'Hip circles, thoracic rotations, ankle CARs'},
    ];
    const actsHtml=acts.map(a=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(13,148,136,0.1);">
      <span style="font-size:18px;flex-shrink:0">${a.icon}</span>
      <div><div style="font-weight:800;font-size:13px;color:#2dd4bf">${a.name}</div><div style="font-size:11px;color:#0d9488;margin-top:2px">${a.desc}</div></div>
    </div>`).join('');
    return`<div class="day-card" data-d="${dIdx}" style="--day-rgb:${rgb}">
      <div class="day-header">
        <div class="day-icon" style="background:#0d9488;box-shadow:0 2px 10px #0d948866">🚶</div>
        <div class="day-info">
          <div class="day-session">Active Rest Day</div>
          <div class="day-meta">${escapeHtml(day.label)} · Recovery Plan · ${SCHED}</div>
        </div>
        <div class="day-toggle">▼</div>
      </div>
      <div class="exercises" style="border-top-color:#0d948833">
        <div style="padding:4px 4px 4px 4px">${actsHtml}</div>
      </div>
    </div>`;
  }
  if(day.type==='rest'){
    const rgb='51,65,85';
    const acts=[
      {icon:'😴',name:'Full Rest',desc:'No training, no structured activity — complete physical recovery'},
      {icon:'🌙',name:'Deep Sleep & Active Recovery',desc:'Prioritize 8–9 hrs sleep; light foam roll only if needed'},
      {icon:'🥗',name:'Optimized Nutrition / Fueling',desc:'Hit protein targets; emphasize micronutrient-dense whole foods'},
    ];
    const actsHtml=acts.map(a=>`<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(51,65,85,0.2);">
      <span style="font-size:18px;flex-shrink:0">${a.icon}</span>
      <div><div style="font-weight:800;font-size:13px;color:#94a3b8">${a.name}</div><div style="font-size:11px;color:#475569;margin-top:2px">${a.desc}</div></div>
    </div>`).join('');
    return`<div class="day-card" data-d="${dIdx}" style="--day-rgb:${rgb}">
      <div class="day-header">
        <div class="day-icon" style="background:#334155;box-shadow:0 2px 10px #33415566">😴</div>
        <div class="day-info">
          <div class="day-session">Rest Day</div>
          <div class="day-meta">${escapeHtml(day.label)} · Full Rest · ${SCHED}</div>
        </div>
        <div class="day-toggle">▼</div>
      </div>
      <div class="exercises" style="border-top-color:#33415533">
        <div style="padding:4px 4px 4px 4px">${actsHtml}</div>
      </div>
    </div>`;
  }
  let lastTag=null;
  const exHtml=day.exercises.map((ex,eIdx)=>{
    let banner='';
    if(ex.tag!==lastTag){banner=groupBanner(ex.tag);lastTag=ex.tag;}
    return banner+renderExercise(ex,dIdx,eIdx);
  }).join('');
  const rgb=hexToRgb(day.color);
  return`<div class="day-card" data-d="${dIdx}" style="--day-rgb:${rgb}">
    <div class="day-header">
      <div class="day-icon" style="background:${day.color};box-shadow:0 2px 10px ${day.color}66">${day.icon}</div>
      <div class="day-info">
        <div class="day-session">${escapeHtml(day.session)}</div>
        <div class="day-meta">${escapeHtml(day.label)} · 10 exercises · ${SCHED}</div>
      </div>
      <div class="day-toggle">▼</div>
    </div>
    <div class="exercises" style="border-top-color:${day.color}33">${exHtml}</div>
  </div>`;
}

function render(){
  const week=DATA.weeks.find(w=>w.id===activeWeek);
  const tabs=DATA.weeks.map(w=>`<button class="tab ${w.id===activeWeek?'active':''}" data-week="${w.id}">${w.label}</button>`).join('');
  const days=week.days.map((d,i)=>renderDay(d,i)).join('');
  document.getElementById('app').innerHTML=`
    <div class="header">
      <a href="cat-ks.html" class="back-link">← Everything Under the Kitchen Sink</a>
      <div class="header-inner">
        <div class="eyebrow">${CFG.eyebrow || ''}</div>
        <div class="title">${escapeHtml(DATA.name)}</div>
        <div><span class="schedule">${escapeHtml(DATA.schedule)}</span></div>
      </div>
    </div>
    <div class="tabs-bar"><div class="tabs">${tabs}</div></div>
    <div class="content">
      <div class="phase-note"><strong>${week.label}:</strong> ${week.note}</div>
      <div class="structure-legend">
        <span class="sl-item">①② <b>Compounds</b> — 90 sec rest</span>
        <span class="sl-item">③–⑤ <b>Tri-Set</b> — no rest between, 2-3 min after</span>
        <span class="sl-item">⑥⑦ <b>Superset</b> — 60 sec after</span>
        <span class="sl-item">⑧ <b>Cluster</b> — base sets + 3×micro (15 sec intra)</span>
        <span class="sl-item">⑨ <b>Drop Set</b> — base + 2×AMRAP drops</span>
        <span class="sl-item">⑩ <b>Finisher</b> — 3×AMRAP</span>
      </div>
      <div class="hint">Tap session to expand · Tap field to edit</div>
      ${days}
    </div>`;
  bindEvents(week);
}

function bindEvents(week){
  document.querySelectorAll('.tab').forEach(b=>{
    b.addEventListener('click',()=>{activeWeek=b.dataset.week;render();});
  });
  document.querySelectorAll('.day-card').forEach(card=>{
    const header=card.querySelector('.day-header');
    header.addEventListener('click',e=>{
      if(e.target.classList.contains('editable'))return;
      card.classList.toggle('open');
      const toggle=card.querySelector('.day-toggle');
      const dIdx=card.dataset.d;
      const day=week.days[dIdx];
      if(card.classList.contains('open')){
        toggle.textContent='▲';toggle.style.background=day.color;
        card.style.borderColor=day.color;card.style.boxShadow=`0 4px 18px ${day.color}33`;
        header.style.background=`${day.color}10`;
      }else{
        toggle.textContent='▼';toggle.style.background='rgba(255,255,255,0.06)';
        card.style.borderColor='rgba(255,255,255,0.06)';card.style.boxShadow='none';
        header.style.background='transparent';
      }
    });
  });
  document.querySelectorAll('.editable').forEach(el=>{
    el.addEventListener('click',e=>{
      e.stopPropagation();
      const field=el.dataset.field;const dIdx=el.dataset.d;const eIdx=el.dataset.e;
      const day=week.days[dIdx];const ex=day.exercises[eIdx];
      const input=document.createElement('input');
      input.value=ex[field];input.className='edit-input';
      el.replaceWith(input);input.focus();
      const save=()=>{ex[field]=input.value;render();};
      input.addEventListener('blur',save);
      input.addEventListener('keydown',ev=>{if(ev.key==='Enter')input.blur();});
    });
  });
}

render();

