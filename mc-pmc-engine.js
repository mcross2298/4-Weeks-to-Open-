/* ==========================================================================
   mc-pmc-engine.js — renderers for the five Project Muscle Confusion pages (audit G5)
   --------------------------------------------------------------------------
   Lifted verbatim out of the pages that used to carry byte-identical copies of
   it. Behaviour is unchanged: these are the same function bodies, now stored
   once. Each page keeps its own render(), which is genuinely per-page — it
   names that page's data and sections.

   Reads page-level state (activeIdx, checkState, the page's workout data) and
   TMR from mc-timer.js. Classic scripts share one global lexical environment,
   so those resolve at call time; load this after mc-timer.js and before the
   page's inline script.
   ========================================================================== */

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

function badges(arr){
  const LBL={'tb-pyramid':'📈 Pyramid','tb-lowrep':'🏋️ Low Rep','tb-tempo':'⏱️ Tempo',
    'tb-highrep12':'🔥 12–15 Reps','tb-highrep20':'🔥 20–30 Reps','tb-drop':'↘️ Drop Set',
    'tb-amrap':'💀 AMRAP','tb-minrest':'⚡ 20s Rest','tb-optional':'⭐ Optional',
    'tb-finisher':'🏁 Finisher','tb-superset':'⚡ Superset'};
  return arr.map(function(b){return '<span class="type-badge '+b+'">'+LBL[b]+'</span>';}).join('');
}

function leg(side,who,idv,ckv){
  var tempo=who.tempo?'<div class="ex-note a-ss-tempo">⏱ '+who.tempo+'</div>':'';
  var note=who.note?'<div class="ex-note">'+who.note+'</div>':'';
  var rest=side==='B'?'<div class="ex-rest">'+makeRestTimer('120 sec',who.name)+'</div>':'';
  var bh=badges(who.badges);
  return '<div class="ss-ex '+ckv+'" data-id="'+idv+'" data-type="ssex">'+
    '<div class="ss-num">'+side+'</div><div class="ss-content">'+
    '<div class="ss-name">'+who.name+'</div>'+
    '<div class="a-ss-reps">'+aReps(who.sets)+'</div>'+
    '<span class="ex-sets a-ss-sets-hidden">'+who.sets+'</span>'+
    (bh?'<div class="a-badges">'+bh+'</div>':'')+
    tempo+note+rest+'</div></div>';
}

function renderSingle(ex,wk){
  var id=wk+'-s-'+ex.num; var ck=checkState[id]?'checked':'';
  var rest=ex.rest||'60 sec';
  var bh=badges(ex.badges)+(ex.tempo?'<span class="a-pill tempo">⏱ '+ex.tempo+'</span>':'');
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

function renderSS(ex,wk){
  var ida=wk+'-ss-'+ex.num+'a', idb=wk+'-ss-'+ex.num+'b';
  var cka=checkState[ida]?'checked':'', ckb=checkState[idb]?'checked':'';
  function leg(side,who,idv,ckv){
    var tempo=who.tempo?'<div class="ex-note a-ss-tempo">⏱ '+who.tempo+'</div>':'';
    var note=who.note?'<div class="ex-note">'+who.note+'</div>':'';
    var rest=side==='B'?'<div class="ex-rest">'+makeRestTimer('120 sec',who.name)+'</div>':'';
    var bh=badges(who.badges);
    return '<div class="ss-ex '+ckv+'" data-id="'+idv+'" data-type="ssex">'+
      '<div class="ss-num">'+side+'</div><div class="ss-content">'+
      '<div class="ss-name">'+who.name+'</div>'+
      '<div class="a-ss-reps">'+aReps(who.sets)+'</div>'+
      '<span class="ex-sets a-ss-sets-hidden">'+who.sets+'</span>'+
      (bh?'<div class="a-badges">'+bh+'</div>':'')+
      tempo+note+rest+'</div></div>';
  }
  return '<div class="ss-card a-ss">'+
    '<div class="ss-header"><span class="ss-label">⚡ Superset #'+ex.num+'</span></div>'+
    leg('A',ex.a,ida,cka)+
    '<div class="ss-divider"><span class="ss-x">× SUPERSET ×</span></div>'+
    leg('B',ex.b,idb,ckb)+
    '</div>';
}

function renderEx(ex,wk){return ex.type==='superset'?renderSS(ex,wk):renderSingle(ex,wk);}

function attachEvents(){
  document.querySelectorAll('[data-type="single"]').forEach(function(c){
    c.addEventListener('click',function(e){if(e.target.closest('.setlog-toggle,.setlog-wrap,.set-check,.set-input'))return;var id=c.dataset.id;checkState[id]=!checkState[id];c.classList.toggle('checked');});
  });
  document.querySelectorAll('[data-type="ssex"]').forEach(function(c){
    c.addEventListener('click',function(e){e.stopPropagation();var id=c.dataset.id;checkState[id]=!checkState[id];c.classList.toggle('checked');});
  });
  document.querySelectorAll('.wtab').forEach(function(b){
    b.addEventListener('click',function(){activeWeek=parseInt(b.dataset.w);render();});
  });
}
