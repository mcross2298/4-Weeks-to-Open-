/* ks-engine.js — shared render engine for the Kitchen Sink program family
   (audit LS-5, W-09). Consolidates the near-duplicate inline engines that had
   drifted across kitchen-sink*.html. Each page defines window.DATA and
   window.KS_CFG ({sched, eyebrow}) BEFORE loading this file; the engine renders
   into #app, exactly as the old inline copies did. Runs at top-level global
   scope (NOT an IIFE) on purpose: TMR/buildTimerFloat are referenced by inline
   onclick handlers in the rendered HTML.

   TMR / buildTimerFloat come from the shared mc-timer.js (loaded before this
   file on every Kitchen Sink page, same as every other program) — this file
   used to carry its own stripped-down duplicate of both, which had drifted
   behind mc-timer.js's feature set (no Up Next cue, no sound/haptics prefs,
   no 10s warning cue). makeRestTimer stays per-page/per-engine by convention
   (see mc-timer.js's own header comment). */

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

// ── TRI-SET / SUPERSET station grouping ──
// TRI-SET (3 members) and SUPERSET (2 members) exercises used to render as
// flat, independent .ex-cards with only a text banner above them — so none of
// the app's grouped-exercise tooling (mc-superset-hop.js's A→B→A→B hop,
// mc-guided.js treating the whole block as one step, mc-setlog.js's rest-timer
// consolidation onto the final member) ever engaged, even though the banner
// text promised "no rest between, rest after the full round." This wraps a
// same-tag run in the same .ss-card/.ss-ex structure every other program's
// grouped exercises use (Concept-A styling via .a-ss, per base.css) so that
// tooling actually applies. The per-exercise DATA is unchanged — only the
// rendered markup shape changes, same as mc-group-split.js does for its
// combined-name cards.
const GROUP_SIZE = { 'TRI-SET': 3, 'SUPERSET': 2 };
function letter(i){ return String.fromCharCode(65+i); }

function renderSSMember(ex,dIdx,eIdx,idx,isLast){
  const badges=[];
  if(ex.tempo)badges.push(`<span class="a-pill tempo">⏱ ${escapeHtml(ex.tempo)}</span>`);
  if(ex.notes&&ex.notes.includes('REVERSE PYRAMID'))badges.push(`<span class="a-pill rp">▼ REV PYRAMID</span>`);
  if(ex.notes&&ex.notes.includes('MECHANICAL DROP'))badges.push(`<span class="a-pill rp">⚡ MECH DROP</span>`);
  const badgeHtml=badges.length?`<div class="a-badges">${badges.join('')}</div>`:'';
  const notesHtml=ex.notes?`<div class="a-notes">📝 ${escapeHtml(ex.notes)}</div>`:'';
  // One rest timer, on the final member only — carries the real "after the
  // full round" rest (the DATA already puts '—' on every member but the
  // last, so this just doesn't render a badge for the '—' members at all,
  // same as makeRestTimer already does for a non-interactive '—' string).
  const restHtml=isLast?`<div class="ex-rest">${makeRestTimer(ex.rest||'90 sec',ex.name)}</div>`:'';
  return`<div class="ss-ex" data-id="ssex-${dIdx}-${eIdx}">
    <div class="ss-num">${letter(idx)}</div>
    <div class="ss-content">
      <div class="ss-name"><span class="editable" data-field="name" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.name)}</span></div>
      ${badgeHtml}
      <div class="a-ss-reps">${renderReps(ex.sets)}</div>
      <div class="a-ss-sets-hidden"><span class="ex-sets"><span class="editable" data-field="sets" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.sets)}</span></span></div>
      ${notesHtml}
      ${restHtml}
    </div>
  </div>`;
}

function renderSSCard(members,dIdx,startEIdx,tag){
  const tri=tag==='TRI-SET';
  const label=tri?'⚡ Tri-Set':'⚡ Superset';
  const rowsHtml=members.map((ex,i)=>{
    const eIdx=startEIdx+i;
    const isLast=i===members.length-1;
    const divider=isLast?'':`<div class="ss-divider"><span class="ss-x">${tri?'× TRI-SET ×':'× SUPERSET ×'}</span></div>`;
    return renderSSMember(ex,dIdx,eIdx,i,isLast)+divider;
  }).join('');
  return`<div class="ss-card a-ss${tri?' is-tri':''}">
    <div class="ss-header"><span class="ss-label">${label}</span></div>
    ${rowsHtml}
  </div>`;
}

// Walks a day's exercises, grouping consecutive same-tag TRI-SET/SUPERSET
// runs into a single .ss-card block; everything else (compounds, CLUSTER,
// DROP SET, FINISHER — all single-station, single-exercise intensifiers, not
// multi-exercise groups) stays a flat .ex-card exactly as before. A run
// shorter than its tag's group size (irregular data) falls through to flat
// rendering rather than forcing a broken group.
function renderExerciseBlocks(exercises,dIdx){
  const blocks=[];
  let lastBannerTag=null;
  let i=0;
  while(i<exercises.length){
    const tag=exercises[i].tag;
    const size=GROUP_SIZE[tag];
    const run=size && exercises.slice(i,i+size).every(e=>e.tag===tag) && (exercises.length-i)>=size;
    const banner=tag!==lastBannerTag?groupBanner(tag):'';
    lastBannerTag=tag;
    if(run){
      blocks.push(banner+renderSSCard(exercises.slice(i,i+size),dIdx,i,tag));
      i+=size;
    }else{
      blocks.push(banner+renderExercise(exercises[i],dIdx,i));
      i+=1;
    }
  }
  return blocks.join('');
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
  const exHtml=renderExerciseBlocks(day.exercises,dIdx);
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

