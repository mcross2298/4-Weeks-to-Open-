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

  // ── recap helpers (Phase 5: Finish-Workout payoff) ──────────────────────
  function esc(s){
    return String(s).replace(/[&<>"]/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
    });
  }
  // The set store keys exercises by their synthetic id (e.g. "x-bench-press" or
  // "x-bench-press-2" for a duplicate). Reconstruct a clean display name.
  function deSlug(id){
    return String(id)
      .replace(/^x-/,'')          // synthetic id prefix
      .replace(/-\d+$/,'')        // duplicate-occurrence suffix
      .replace(/-/g,' ')
      .replace(/\b\w/g,function(c){return c.toUpperCase();})
      .trim() || String(id);
  }
  function sessionTonnage(sets){
    var t=0;
    (sets||[]).forEach(function(s){
      var w=parseFloat(s.weight)||0, r=parseInt(s.reps,10)||0;
      t+=w*r;
    });
    return t;
  }
  function fmtLb(n){ return Math.round(n).toLocaleString('en-US'); }
  // PR'd exercises with the best (heaviest) PR weight each.
  function prSpotlight(sets){
    var best={};
    (sets||[]).forEach(function(s){
      if(!s.pr)return;
      var w=parseFloat(s.weight)||0, nm=deSlug(s.name);
      if(!(nm in best)||w>best[nm])best[nm]=w;
    });
    return Object.keys(best).map(function(nm){return {name:nm,weight:best[nm]};});
  }

  // Bug: mc-summary.js's live 'daily' snapshot (mc_daily_v1, todayKey()+'|'+PID)
  // was never cleared once a workout was actually Finished and banked here,
  // so the same session could show up twice in Workout Logs — a real
  // finished card plus a stale "in progress" ghost for the same day that
  // never goes away on its own. Clear today's entry for this page the
  // moment it's superseded by a real banked log.
  var DAILY_KEY='mc_daily_v1';
  function todayKey(){
    var d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function clearTodaysDailyEntry(){
    try{
      var store=JSON.parse(localStorage.getItem(DAILY_KEY)||'{}');
      var k=todayKey()+'|'+pageId;
      if(k in store){ delete store[k]; localStorage.setItem(DAILY_KEY,JSON.stringify(store)); }
    }catch(e){}
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
    clearTodaysDailyEntry();
    return entry;
  }

  // Update progress display + auto-trigger the Finish flow the moment every
  // set is logged. Guarded on the done<total -> done>=total TRANSITION only
  // (wasComplete), so this fires once — not on every render pass while the
  // workout stays complete, and never again after the workout is saved.
  var wasComplete=false;
  function updateProgress(){
    var done=getCheckedSets();
    var total=getTotalSets();
    var el=document.getElementById('fwProgress');
    if(el)el.textContent=done+' / '+total+' sets';
    var isComplete=total>0&&done>=total;
    if(isComplete&&!wasComplete&&!window._FW.finished){
      var modal=document.getElementById('fwModal');
      var already=modal&&modal.classList.contains('open');
      if(!already)window._FW.open();
    }
    wasComplete=isComplete;
  }

  // Build the bottom bar HTML — Finish Workout is the primary action;
  // Workout Summary lives directly underneath it as the secondary one
  // (mc-summary.js appends its button into this bar right after fw-btn).
  var barHTML='<div class="fw-bar" id="fwBar">'+
    '<button class="fw-btn" onclick="_FW.open()">Finish Workout ✓</button>'+
    '<span class="fw-progress" id="fwProgress">0 / 0 sets</span>'+
    '</div>';

  // Build modal HTML — this IS the "Workout Summary" pull-up: opening it
  // (whether by tapping the bar button or via the auto-trigger above)
  // already populates #fwSummary with the full recap below.
  var modalHTML='<div class="fw-modal-overlay" id="fwModal">'+
    '<div class="fw-modal">'+
      '<div class="fw-modal-title">🏆 Finish Workout?</div>'+
      '<div class="fw-modal-sub">This will save your session to Workout Logs.</div>'+
      '<div class="fw-summary" id="fwSummary"></div>'+
      '<div class="fw-modal-btns">'+
        '<button class="fw-cancel" onclick="_FW.close()">Cancel</button>'+
        '<button class="fw-confirm" onclick="_FW.confirm()">Log Workout</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  // Celebratory "Session Complete" recap shown after Log Workout.
  var doneHTML='<div class="fw-modal-overlay" id="fwDone">'+
    '<div class="fw-modal fw-done-card">'+
      '<div class="fw-done-emoji" id="fwDoneEmoji">💪</div>'+
      '<div class="fw-done-title">Session Complete</div>'+
      '<div class="fw-done-sub" id="fwDoneSub"></div>'+
      '<div class="fw-done-grid" id="fwDoneGrid"></div>'+
      '<div class="fw-done-prs" id="fwDonePRs"></div>'+
      '<button class="fw-confirm" style="flex:none;width:100%;" onclick="_FW.doneClose()">Done</button>'+
    '</div>'+
  '</div>';

  function injectDoneCss(){
    if(document.getElementById('fwDoneCss'))return;
    var st=document.createElement('style');st.id='fwDoneCss';
    st.textContent=
      '.fw-done-card{text-align:center;}'+
      '.fw-done-emoji{font-size:46px;line-height:1;margin-bottom:6px;animation:fwPop .5s ease-out;}'+
      '@keyframes fwPop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1)}}'+
      '.fw-done-title{font-size:22px;font-weight:900;letter-spacing:-0.02em;color:#fff;}'+
      '.fw-done-sub{font-size:13px;color:#64748b;font-weight:700;margin:2px 0 16px;}'+
      '.fw-done-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px;}'+
      '.fw-done-cell{background:#141414;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:14px 8px;}'+
      '.fw-done-num{font-size:22px;font-weight:900;color:var(--accent,#d4af37);letter-spacing:-0.01em;}'+
      '.fw-done-lbl{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin-top:4px;}'+
      '.fw-done-prs:not(:empty){margin-bottom:16px;}'+
      '.fw-done-prs-title{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#d4af37;margin-bottom:8px;}'+
      '.fw-pr-chip{display:inline-block;margin:3px;padding:7px 12px;border-radius:10px;background:rgba(212,175,55,0.14);border:1px solid rgba(212,175,55,0.35);color:#f5d76e;font-size:12px;font-weight:800;}';
    document.head.appendChild(st);
  }

  function cell(val,lbl){
    return '<div class="fw-done-cell"><div class="fw-done-num">'+val+'</div><div class="fw-done-lbl">'+lbl+'</div></div>';
  }
  function showDone(entry){
    var sets=entry.sets||[];
    var prList=prSpotlight(sets);
    var grid=document.getElementById('fwDoneGrid');
    if(grid){
      grid.innerHTML=
        cell(entry.duration,'Duration')+
        cell(sets.length,'Sets')+
        cell(fmtLb(sessionTonnage(sets)),'Volume (lb)')+
        cell(prList.length?('🏆 '+prList.length):'—','PRs');
    }
    var sub=document.getElementById('fwDoneSub');
    if(sub)sub.textContent=entry.workoutName||'';
    var emoji=document.getElementById('fwDoneEmoji');
    if(emoji)emoji.textContent=prList.length?'🏆':'💪';
    var prEl=document.getElementById('fwDonePRs');
    if(prEl){
      prEl.innerHTML=prList.length
        ?('<div class="fw-done-prs-title">New Personal Records</div>'+
          prList.map(function(p){return '<div class="fw-pr-chip">🏆 '+esc(p.name)+' · '+p.weight+' lb</div>';}).join(''))
        :'';
    }
    try{
      var hp=(typeof MC_PREFS!=='undefined')?MC_PREFS.get().haptics:true;
      if(hp&&navigator.vibrate)navigator.vibrate(prList.length?[60,40,120]:30);
    }catch(e){}
    var ov=document.getElementById('fwDone');
    if(ov)ov.classList.add('open');
  }

  // Inject UI
  function inject(){
    injectDoneCss();
    document.body.insertAdjacentHTML('beforeend',barHTML+modalHTML+doneHTML);
    // Watch for set check changes. NOT a document click-delegation listener —
    // mc-setlog.js's checkbox handler calls stopPropagation() (so does its
    // .mcl-wrap click guard), so a click on .set-check never bubbles to
    // document and a delegated listener here would silently never fire.
    // A class-attribute MutationObserver (same pattern mc-rep-progress.js and
    // mc-live-tracker.js already use for the identical problem) sees the
    // .done toggle directly, regardless of where the click originated or
    // whether it bubbles.
    var _upDbt=null;
    function debounceUpdate(){ clearTimeout(_upDbt); _upDbt=setTimeout(updateProgress,100); }
    new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        var t=muts[i].target;
        if(t.classList&&(t.classList.contains('set-check')||t.classList.contains('sl-ck'))){
          debounceUpdate();
          return;
        }
      }
    }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
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
    finished:false,   // once true, updateProgress()'s auto-trigger stops firing
    open:function(){
      var sets=getSessionSets();
      var prList=prSpotlight(sets);
      var tonnage=sessionTonnage(sets);
      var summary=document.getElementById('fwSummary');
      if(summary){
        summary.innerHTML=
          '<div class="fw-summary-row"><span class="fw-summary-label">Workout</span><span class="fw-summary-val">'+esc(getWorkoutName())+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Duration</span><span class="fw-summary-val">'+getDuration()+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Sets checked</span><span class="fw-summary-val">'+getCheckedSets()+' / '+getTotalSets()+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Sets logged</span><span class="fw-summary-val">'+sets.length+'</span></div>'+
          '<div class="fw-summary-row"><span class="fw-summary-label">Volume</span><span class="fw-summary-val">'+fmtLb(tonnage)+' lb</span></div>'+
          (prList.length?prList.map(function(p){
            return '<div class="fw-summary-row"><span class="fw-summary-label" style="color:#d4af37;">🏆 PR</span>'+
                   '<span class="fw-summary-val" style="color:#d4af37;">'+esc(p.name)+' — '+p.weight+' lb</span></div>';
          }).join(''):'')+
          (function(){var sk=getSkippedExercises();return sk.length?'<div class="fw-summary-row"><span class="fw-summary-label" style="color:#f87171;">Skipped</span><span class="fw-summary-val" style="color:#f87171;font-size:11px;">'+esc(sk.join(', '))+'</span></div>':'';}());
      }
      var m=document.getElementById('fwModal');
      if(m)m.classList.add('open');
    },
    close:function(){
      var m=document.getElementById('fwModal');
      if(m)m.classList.remove('open');
    },
    confirm:function(){
      window._FW.finished=true;
      var entry=saveWorkout();
      try{if(window.MCActivity&&MCActivity.releaseSessionLock)MCActivity.releaseSessionLock();}catch(e){}
      // back up the finished session right away (no-op when signed out)
      try{if(window.MC_SYNC&&MC_SYNC.push)MC_SYNC.push();}catch(e){}
      window._FW.close();
      // Celebratory recap instead of just a button flash
      showDone(entry);
      // Flash confirmation on the bar too
      var btn=document.querySelector('.fw-btn');
      if(btn){btn.textContent='✓ Saved!';btn.style.background='#34d399';}
      setTimeout(function(){
        if(btn){btn.textContent='Finish Workout ✓';btn.style.background='';}
      },2000);
    },
    doneClose:function(){
      var ov=document.getElementById('fwDone');
      if(ov)ov.classList.remove('open');
    }
  };

  // Run after DOM ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',inject);
  }else{
    inject();
  }
})();
