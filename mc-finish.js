/* mc-finish.js — Finish-Workout module (extracted from the per-page copy).
   Contracts kept: window._FW, mc_workout_log_v1 entry shape. */
/* ── FINISH-WORKOUT MODULE ── */
(function(){
  var WL_KEY='mc_workout_log_v1';
  var SL_KEY='mc_setlog_v1';
  var startTime=Date.now();
  // MC_PID_OVERRIDE namespaces custom program/workout runners (run-program.html)
  // so each saved day keeps its own history instead of colliding on the filename
  var pageId=(window.MC_PID_OVERRIDE||location.pathname.split('/').pop().replace('.html',''));

  // Get workout name from page title
  function getWorkoutName(){
    var t=document.title||pageId;
    return t.replace(' — MC Training','').replace('MC — ','').replace('PMC — ','');
  }

  // Get duration string
  function getDuration(){
    var mins=Math.round((Date.now()-startTime)/60000);
    if(mins<1)return '<1 min';
    return mins+' min';
  }

  // Count checked sets
  function getCheckedSets(){
    return document.querySelectorAll('.sl-ck.done,.set-check.done').length;
  }
  function getTotalSets(){
    return document.querySelectorAll('.sl-ck,.set-check').length;
  }

  // Get all logged set data for this session
  function getSessionSets(){
    try{
      var store=JSON.parse(localStorage.getItem(SL_KEY)||'{}');
      var today=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'});
      var sets=[];
      Object.keys(store).forEach(function(k){
        if(!k.startsWith(pageId+'|'))return;
        var exName=k.split('|')[1]||k;
        var sess=store[k][0];
        if(sess&&sess.d===today){
          Object.keys(sess.sets).forEach(function(sn){
            var s=sess.sets[sn];
            var e={name:exName,setNum:parseInt(sn),weight:s.w,reps:s.r,pr:false};
            if(s.rpe)e.rpe=s.rpe;
            sets.push(e);
          });
        }
      });
      // Detect PRs — compare to previous sessions
      sets.forEach(function(s){
        var k=pageId+'|'+s.name;
        var history=store[k]||[];
        if(history.length<2)return;
        var prevMax=0;
        history.slice(1).forEach(function(sess){
          Object.values(sess.sets).forEach(function(set){
            if(parseFloat(set.w)>prevMax)prevMax=parseFloat(set.w);
          });
        });
        if(parseFloat(s.weight)>prevMax&&prevMax>0)s.pr=true;
      });
      return sets;
    }catch(e){return[];}
  }

  // Save to workout log
  function saveWorkout(){
    var sets=getSessionSets();
    var prs=sets.filter(function(s){return s.pr;}).length;
    var iso=new Date().toISOString();
    var entry={
      id:pageId+'|'+iso,   // dedupe key for cross-device sync (mc-sync.js)
      pageId:pageId,
      workoutName:getWorkoutName(),
      date:iso,
      time:new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),
      duration:getDuration(),
      sets:sets,
      prs:prs,
      setsChecked:getCheckedSets()
    };
    try{
      var logs=JSON.parse(localStorage.getItem(WL_KEY)||'[]');
      logs.unshift(entry);
      logs=logs.slice(0,200);// keep last 200 workouts
      localStorage.setItem(WL_KEY,JSON.stringify(logs));
    }catch(e){}
    return entry;
  }

  // Update progress display
  function updateProgress(){
    var done=getCheckedSets();
    var total=getTotalSets();
    var el=document.getElementById('fwProgress');
    if(el)el.textContent=done+' / '+total+' sets';
    // Auto-detect all sets done
    if(total>0&&done>=total){
      var banner=document.getElementById('fwAutoBanner');
      if(banner)banner.classList.add('show');
    }
  }

  // Build the bottom bar HTML
  var barHTML='<div class="fw-bar" id="fwBar">'+
    '<span class="fw-progress" id="fwProgress">0 / 0 sets</span>'+
    '<button class="fw-btn" onclick="_FW.open()">Finish Workout ✓</button>'+
    '</div>';

  // Build modal HTML
  var modalHTML='<div class="fw-modal-overlay" id="fwModal">'+
    '<div class="fw-modal">'+
      '<div class="fw-modal-title">🏆 Finish Workout?</div>'+
      '<div class="fw-modal-sub">This will save your session to Workout Logs.</div>'+
      '<div class="fw-summary" id="fwSummary"></div>'+
      '<div class="fw-modal-btns">'+
        '<button class="fw-cancel" onclick="_FW.close()">Cancel</button>'+
        '<button class="fw-confirm" onclick="_FW.confirm()">Save & Finish</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  var autoBanner='<div class="fw-auto-banner" id="fwAutoBanner" onclick="_FW.open()">'+
    '🏆 All sets complete — tap to finish workout</div>';

  // Inject UI
  function inject(){
    document.body.insertAdjacentHTML('beforeend',barHTML+modalHTML+autoBanner);
    // Watch for set check changes
    document.addEventListener('click',function(e){
      if(e.target.classList.contains('sl-ck')||
         e.target.classList.contains('set-check')||
         e.target.id==='fwAutoBanner'){
        setTimeout(updateProgress,100);
      }
    });
    updateProgress();
  }


  function getSkippedExercises(){
    var sk=[];
    document.querySelectorAll('.ex-card:not(.checked),.ss-ex:not(.checked)').forEach(function(c){
      var nm=c.querySelector('.ex-name,.ss-name');if(nm)sk.push(nm.textContent.trim());
    });
    return sk;
  }
  window._FW={
    open:function(){
      var sets=getSessionSets();
      var prs=sets.filter(function(s){return s.pr;}).length;
      var summary=document.getElementById('fwSummary');
      if(summary){
        summary.innerHTML=
          '<div class="fw-summary-row"><span class="fw-summary-label">Workout</span><span class="fw-summary-val">'+getWorkoutName()+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Duration</span><span class="fw-summary-val">'+getDuration()+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Sets checked</span><span class="fw-summary-val">'+getCheckedSets()+' / '+getTotalSets()+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Sets logged</span><span class="fw-summary-val">'+sets.length+'</span></div>'+
          (prs?'<div class="fw-summary-row"><span class="fw-summary-label">PRs set</span><span class="fw-summary-val" style="color:#d4af37;">🏆 '+prs+'</span></div>':'')+
          (function(){var sk=getSkippedExercises();return sk.length?'<div class="fw-summary-row"><span class="fw-summary-label" style="color:#f87171;">Skipped</span><span class="fw-summary-val" style="color:#f87171;font-size:11px;">'+sk.join(', ')+'</span></div>':'';}());
      }
      var m=document.getElementById('fwModal');
      if(m)m.classList.add('open');
    },
    close:function(){
      var m=document.getElementById('fwModal');
      if(m)m.classList.remove('open');
    },
    confirm:function(){
      saveWorkout();
      // back up the finished session right away (no-op when signed out)
      try{if(window.MC_SYNC&&MC_SYNC.push)MC_SYNC.push();}catch(e){}
      window._FW.close();
      // Flash confirmation
      var btn=document.querySelector('.fw-btn');
      if(btn){btn.textContent='✓ Saved!';btn.style.background='#34d399';}
      var banner=document.getElementById('fwAutoBanner');
      if(banner)banner.classList.remove('show');
      setTimeout(function(){
        if(btn){btn.textContent='Finish Workout ✓';btn.style.background='';}
      },2000);
    }
  };

  // Run after DOM ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',inject);
  }else{
    inject();
  }
})();
