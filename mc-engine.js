/**
 * mc-engine.js — Shared renderer for the MC split fleet (roadmap 3.5).
 * Reads a page record from MC_SPLITS (mc-data.js) and renders the day page:
 * header, optional warmup card, exercise list, workout summary, next-workout
 * link. Ported verbatim from the 23 previously hand-cloned mc-s*.html pages
 * (their render/badge/superset logic was byte-identical) plus the summary
 * block, which was hand-typed per page and is now driven by data.
 *
 *   MC.init(pageId)  -> renders everything for that page
 */
'use strict';

function makeRestTimer(restStr, exerciseName) {
  const secs = TMR.parseSeconds(restStr);
  if (!secs) return '<span class="ex-sets" style="opacity:0.5">⏱️ ' + restStr + '</span>';
  const label = restStr;
  return '<span class="rest-timer idle" data-rest="' + restStr + '" data-label="' + label + '" ' +
    'onclick="buildTimerFloat();TMR.toggle(this,' + secs + ',\'' + exerciseName.replace(/'/g,"\'").substring(0,30) + '...\')" ' +
    'title="Tap to start rest timer">' +
    '<span class="rest-timer-icon">⏱️</span>' +
    '<span class="rest-timer-label">' + label + '</span>' +
    '</span>';
}
buildTimerFloat();

let activeWeek=parseInt(new URLSearchParams(location.search).get('w'))||1;

const checkState={};
function B(arr){
  const L={'tb-pyramid':'📈 Pyramid','tb-lowrep':'🏋️ Low Rep','tb-tempo':'⏱️ Tempo',
    'tb-highrep':'🔥 High Rep','tb-midset':'💪 Mid Set','tb-drop':'↘️ Drop Set',
    'tb-amrap':'💀 AMRAP','tb-highset':'⚡ High Set','tb-superset':'⚡ Superset'};
  return arr.map(b=>'<span class="type-badge '+b+'">'+L[b]+'</span>').join('');
}
function rS(ex,wk){
  const id=wk+'-s-'+ex.num,ck=checkState[id]?'checked':'';
  var rest=ex.rest||'60 sec';
  var bh=B(ex.b||[]);
  return '<div class="ex-card a-card '+ck+'" data-id="'+id+'" data-type="single">'+
    '<div class="ex-body">'+
    '<div class="a-top"><div class="a-idx">'+ex.num+'</div>'+
    '<div class="a-head"><div class="ex-name a-name">'+ex.name+'</div>'+
    (bh?'<div class="a-badges">'+bh+'</div>':'')+'</div></div>'+
    '<div class="a-reps">'+aReps(ex.sets)+'</div>'+
    '<div class="a-strip"><div class="a-cell"><span class="k">Sets</span><span class="v"><span data-field="sets">'+ex.sets+'</span></span></div>'+
    '<div class="a-cell"><span class="k">Rest</span><span class="v">'+rest+'</span></div></div>'+
    '<div class="a-timerbar">'+makeRestTimer(rest,ex.name)+'</div>'+
    (ex.note?'<div class="a-notes">📝 '+ex.note+'</div>':'')+
    '</div></div>';
}
function rSS(ex,wk){
  const ia=wk+'-ss-'+ex.num+'a',ib=wk+'-ss-'+ex.num+'b';
  const ca=checkState[ia]?'checked':'',cb=checkState[ib]?'checked':'';
  function leg(side,who,idv,ckv){
    var note=who.note?'<div class="ex-note">'+who.note+'</div>':'';
    var rest=side==='B'?'<div class="ex-rest">'+makeRestTimer('120 sec',who.name)+'</div>':'';
    var bh=B(who.b||[]);
    return '<div class="ss-ex '+ckv+'" data-id="'+idv+'" data-type="ssex">'+
      '<div class="ss-num">'+side+'</div><div class="ss-content">'+
      '<div class="ss-name">'+who.name+'</div>'+
      '<div class="a-ss-reps">'+aReps(who.sets)+'</div>'+
      '<span class="ex-sets a-ss-sets-hidden">'+who.sets+'</span>'+
      (bh?'<div class="a-badges">'+bh+'</div>':'')+
      note+rest+'</div></div>';
  }
  return '<div class="ss-card a-ss">'+
    '<div class="ss-header"><span class="ss-label">⚡ Superset #'+ex.num+'</span></div>'+
    leg('A',ex.a,ia,ca)+
    '<div class="ss-divider"><span class="ss-x">× SUPERSET ×</span></div>'+
    leg('B',ex.b,ib,cb)+
    '</div>';
}
function rEx(ex,wk){return ex.type==='ss'?rSS(ex,wk):rS(ex,wk);}
function attachEv(){
  document.querySelectorAll('[data-type="single"]').forEach(c=>
    c.addEventListener('click',()=>{const id=c.dataset.id;checkState[id]=!checkState[id];c.classList.toggle('checked');}));
  document.querySelectorAll('[data-type="ssex"]').forEach(c=>
    c.addEventListener('click',e=>{e.stopPropagation();const id=c.dataset.id;checkState[id]=!checkState[id];c.classList.toggle('checked');}));
}

function render(rec){
  var wm='';
  if(rec.warmup){
    wm='<div class="warmup-card"><div style="font-size:20px;margin-top:1px;flex-shrink:0;">'+rec.warmup.icon+'</div><div><div class="wu-text">'+rec.warmup.text+'</div><div class="wu-sub" style="color:rgba('+rec.accentRgb+',0.8);font-size:11px;margin-top:3px;">'+rec.warmup.sub+'</div></div></div>';
  }
  const ex=rec.data[activeWeek]||rec.data[1];
  document.getElementById('app').innerHTML=
    '<div class="header"><a href="'+rec.backHref+'" class="back-link">← Back</a>'+
    '<div class="header-inner"><div class="eyebrow">'+rec.eyebrow+'</div>'+
    '<div class="title">'+rec.pageTitle+'</div>'+
    '<div><span class="week-badge">Week '+activeWeek+'</span></div></div></div>'+

    '<div class="content"><div class="tap-hint">Tap to check off</div>'+wm+
    ex.map(e=>rEx(e,activeWeek)).join('')+'</div>';
  attachEv();
}

function renderSummary(rec){
  const s=rec.summary;
  const accent=rec.accent, rgb=rec.accentRgb;
  const rowsHtml=s.rows.map(r=>
    '<div class="sum-row" style="border-bottom-color:rgba('+rgb+',0.08);">'+
      '<span class="sum-icon">'+r.icon+'</span>'+
      '<span class="sum-name">'+r.name+'</span>'+
      '<div class="sum-detail">'+
        '<span class="sum-sets" style="color:'+accent+';">'+r.sets+'</span>'+
        '<span class="sum-reps" style="color:'+accent+';">'+r.reps+'</span>'+
      '</div>'+
    '</div>'
  ).join('');
  const totalsHtml=s.totals.map(t=>
    '<div class="sum-total-card" style="background:rgba('+rgb+',0.08);border:1px solid rgba('+rgb+',0.15);">'+
      '<div class="sum-total-val" style="color:'+accent+';">'+t.val+'</div>'+
      '<div class="sum-total-label" style="color:'+accent+';">'+t.label+'</div>'+
    '</div>'
  ).join('');
  var html='<div style="max-width:680px;margin:0 auto;padding:0 16px;">'+
    '<div class="summary-section">'+
      '<div class="sum-head" style="color:'+accent+';">📊 Workout Summary '+
        '<span style="flex:1;height:1px;background:linear-gradient(90deg,rgba('+rgb+',0.3),transparent);display:block;"></span>'+
      '</div>'+
      '<div class="sum-card" style="background:#0f0f0f;border:1px solid rgba('+rgb+',0.2);">'+
        '<div class="sum-subtitle" style="color:'+accent+';">'+s.subtitle+'</div>'+
        rowsHtml+
        '<div class="sum-divider" style="background:rgba('+rgb+',0.15);"></div>'+
        '<div class="sum-totals">'+totalsHtml+'</div>'+
      '</div>'+
    '</div></div>';
  if(rec.nextWorkout){
    const nw=rec.nextWorkout;
    html+='<a href="'+nw.href+'" class="next-workout"><div class="next-workout-label">'+nw.label+'</div>'+
      '<div class="next-workout-row"><div class="next-workout-dot" style="background:'+nw.dotColor+';box-shadow:0 0 6px '+nw.dotColor+'66;"></div>'+
      '<div class="next-workout-name">'+nw.name+'</div><div class="next-workout-arrow">→</div></div></a>';
  }
  document.getElementById('mcSummary').innerHTML=html;
}

function init(pageId){
  const rec=MC_SPLITS[pageId];
  if(!rec){ console.error('MC.init: unknown pageId', pageId); return; }
  document.title=rec.titleTag;
  render(rec);
  if(typeof updateProgress!=="undefined")updateProgress();
  renderSummary(rec);
}

window.MC={ init };
