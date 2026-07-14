// mc-onboarding.js — first-run guided flow (roadmap Phase L3, Tasks 1 + 3)
// Skippable "pick a program → see this week → start Day 1" sheet, shown once
// to a brand-new trainee who has never pinned an active program. Reuses the
// dashboard's own .ps-* sheet styling and its startOnboardProgram() hook
// (dashboard.html) so pinning + navigating to Day 1 stays a single step.
(function(){
  var FLAG='mc_onboarded';
  var STORE='mc_active_prog';
  var picked=null;

  function programList(){
    try{ return (window.MC_PM_DATA&&MC_PM_DATA.programs)||[]; }catch(e){ return []; }
  }

  function markDone(){ try{localStorage.setItem(FLAG,'1');}catch(e){} }

  function shouldShow(){
    try{
      if(localStorage.getItem(FLAG)) return false;
      if(localStorage.getItem(STORE)) return false; // already has a pinned program
      return true;
    }catch(e){ return false; }
  }

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function renderPickStep(){
    var wrap=document.getElementById('obCards');
    if(!wrap) return;
    wrap.innerHTML=programList().map(function(p){
      return '<div class="ps-card" style="--prog-color:'+esc(p.color)+'" role="option" tabindex="0" data-id="'+esc(p.id)+'">'+
        '<div class="ps-icon">'+p.icon+'</div>'+
        '<div class="ps-info"><div class="ps-name">'+esc(p.name)+'</div><div class="ps-meta">'+esc(p.meta)+'</div></div>'+
        '</div>';
    }).join('');
    var cards=wrap.querySelectorAll('.ps-card');
    for(var i=0;i<cards.length;i++){
      (function(card){
        var id=card.getAttribute('data-id');
        card.onclick=function(){ pick(id); };
        card.onkeydown=function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(id);} };
      })(cards[i]);
    }
  }

  function pick(id){
    picked=programList().filter(function(p){return p.id===id;})[0];
    if(!picked) return;
    var sub=document.getElementById('obWeekSub');
    if(sub) sub.textContent=picked.desc||'';
    var card=document.getElementById('obWeekCard');
    if(card){
      card.innerHTML='<div class="ps-card sel" style="--prog-color:'+esc(picked.color)+'">'+
        '<div class="ps-icon">'+picked.icon+'</div>'+
        '<div class="ps-info"><div class="ps-name">'+esc(picked.name)+'</div><div class="ps-meta">'+esc(picked.meta)+'</div></div>'+
        '</div>';
    }
    document.getElementById('obStepPick').style.display='none';
    document.getElementById('obStepWeek').style.display='block';
  }

  function back(){
    document.getElementById('obStepWeek').style.display='none';
    document.getElementById('obStepPick').style.display='block';
  }

  function close(){
    var ov=document.getElementById('obOverlay');
    if(ov) ov.classList.remove('open');
  }

  function start(){
    if(!picked) return;
    markDone();
    close();
    if(typeof window.startOnboardProgram==='function') window.startOnboardProgram(picked.id);
  }

  function skip(){
    markDone();
    close();
  }

  function closeOutside(e){
    if(e.target&&e.target.id==='obOverlay') skip();
  }

  function init(){
    if(!shouldShow()){ markDone(); return; } // returning/already-set-up user — never show again
    renderPickStep();
    var ov=document.getElementById('obOverlay');
    if(ov) ov.classList.add('open');
  }

  window.MC_ONBOARD={init:init,pick:pick,back:back,start:start,skip:skip,closeOutside:closeOutside};
  init();
})();
