/* PHASE 2 / E — the remaining untested surface:
   nutrition sheets + favorites + planned meals, conditioning, Quick Pump →
   run a generated session, exercise Replace/Reorder for real, and the
   signed-OUT behaviour of every signed-in-only surface (does it degrade or
   throw?). */
const { chromium } = require('playwright');
const BASE=(process.argv[2]||'http://localhost:8080').replace(/\/$/,'');
let pass=0, fail=0; const findings=[];
const ok=(m,x)=>{pass++;console.log(`  ok    ${m}${x?'  ['+x+']':''}`);} ;
const bad=(m,g,w)=>{fail++;findings.push({m,got:g,want:w});console.log(`  FAIL  ${m}\n          observed: ${g}\n          expected: ${w}`);};
const note=(m,x)=>console.log(`  note  ${m}${x?'  ['+x+']':''}`);

(async()=>{
const b=await chromium.launch({executablePath:process.env.MC_CHROMIUM});
const ctx=await b.newContext({viewport:{width:390,height:844}});
await ctx.route('**://fonts.googleapis.com/**',r=>r.abort());
await ctx.route('**://*.supabase.co/**',r=>r.abort());
const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept());
const errs=[];
pg.on('pageerror',e=>errs.push('THROW '+e.message.split('\n')[0].slice(0,100)));
pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::ERR/i.test(m.text()))errs.push('CONSOLE '+m.text().slice(0,100));});
const fresh=async(url)=>{await pg.goto(BASE+'/manifest.json');await pg.evaluate(()=>localStorage.clear());
  await pg.goto(BASE+url,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(1800);};

console.log('\n=== E1  signed-OUT behaviour of every signed-in-only surface ===');
await fresh('/dashboard.html');
const so = await pg.evaluate(()=>{
  const ids=['coachSection','coachNote','coachBody','coachToggle'];
  const st={};
  ids.forEach(i=>{const el=document.getElementById(i);
    st[i]= !el ? 'absent' : (el.offsetParent===null ? 'hidden' : 'visible');});
  return {st, sbConfigured: !!(window.MC_SB && window.MC_SB.configured),
    bodyMentionsSignIn: /sign in/i.test(document.body.innerText||'')};
});
console.log('    coach elements: '+JSON.stringify(so.st));
console.log('    MC_SB.configured='+so.sbConfigured+'  page offers sign-in='+so.bodyMentionsSignIn);
const coachHidden = Object.values(so.st).every(v=>v!=='visible');
if (coachHidden) ok('the Coach Note card is not shown to a signed-out athlete');
else note('a coach element is visible while signed out', JSON.stringify(so.st));
if (errs.length===0) ok('the dashboard throws nothing while signed out');
else bad('signed-out dashboard clean', errs.slice(0,3).join(' | '), 'no errors');

console.log('\n=== E2  Nutrition: the food sheet, favorites, unit toggle, keypad ===');
await fresh('/dashboard.html?tab=nutrition');
const nutri = await pg.evaluate(async()=>{
  const out={};
  out.rings = document.querySelectorAll('svg circle,[class*=ring]').length;
  // the three chrome controls the Executive Summary names: ◎ search, ★ favorites, ⚙ goals
  const btns = Array.from(document.querySelectorAll('button,[role=button],a')).filter(e=>e.offsetParent!==null);
  out.chrome = btns.filter(b=>/[◎★⚙]/.test(b.textContent||'')).map(b=>({t:(b.textContent||'').trim().slice(0,3),
    w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height)}));
  // open the search sheet
  const search = btns.find(b=>/◎/.test(b.textContent||''));
  if (search) { search.click(); await new Promise(r=>setTimeout(r,900)); }
  out.afterSearch = {
    inputs: Array.from(document.querySelectorAll('input')).filter(e=>e.offsetParent!==null)
      .map(e=>({ph:e.placeholder||'',type:e.type})),
    sheetText: (document.body.innerText||'').replace(/\s+/g,' ').slice(0,150)
  };
  return out;
});
console.log('    ring elements: '+nutri.rings);
console.log('    chrome controls: '+JSON.stringify(nutri.chrome));
console.log('    after tapping ◎: '+JSON.stringify(nutri.afterSearch.inputs).slice(0,180));
if (nutri.rings>0) ok('the macro rings render', nutri.rings+' elements'); else bad('macro rings','none','ring elements');
const undersized = nutri.chrome.filter(c=>c.h>0&&c.h<44);
if (nutri.chrome.length===0) note('no ◎/★/⚙ chrome controls found by glyph — they may be icons rather than text');
else if (undersized.length) bad('nutrition chrome controls clear 44px', JSON.stringify(undersized), 'all >= 44px');
else ok('every nutrition chrome control clears the 44px floor', nutri.chrome.map(c=>c.h+'px').join(','));
if (nutri.afterSearch.inputs.some(i=>/food|search/i.test(i.ph))) ok('tapping ◎ opens a food-search field', JSON.stringify(nutri.afterSearch.inputs.find(i=>/food|search/i.test(i.ph))));
else note('tapping ◎ did not reveal a labelled food-search input', JSON.stringify(nutri.afterSearch.inputs).slice(0,120));

// favorites + a manual log, entirely local (no food API needed)
const favs = await pg.evaluate(()=>{
  const key='mc_macros_v1';
  let s={}; try{s=JSON.parse(localStorage.getItem(key)||'{}');}catch(e){}
  const d=new Date(); const day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  s.goals={kcal:2400,p:190,f:70,c:240};
  s.favorites=[{name:'Probe Chicken',kcal:330,p:62,f:7,c:0}];
  s.days=s.days||{}; s.days[day]={items:[{name:'Probe Chicken',kcal:330,p:62,f:7,c:0}]};
  localStorage.setItem(key,JSON.stringify(s));
  return day;
});
await pg.reload({waitUntil:"domcontentloaded"}); await pg.waitForTimeout(2200);
const shown = await pg.evaluate(()=>({txt:(document.body.innerText||'').replace(/\s+/g,' '),
  readBack:(()=>{try{const s=JSON.parse(localStorage.getItem('mc_macros_v1')||'{}');
    return {goals:!!s.goals,favs:(s.favorites||[]).length,dayItems:Object.values(s.days||{})[0]?.items?.length||0};}catch(e){return null;}})()}));
if (shown.readBack && shown.readBack.goals && shown.readBack.favs===1 && shown.readBack.dayItems===1)
  ok('goals, a favorite and a logged food all survive a reload', JSON.stringify(shown.readBack));
else bad('nutrition store round trip', JSON.stringify(shown.readBack), 'goals + 1 favorite + 1 logged item');
if (/330|Probe Chicken|2,?400|2400/.test(shown.txt)) ok('the logged food or goal reaches the rendered tab');
else note('seeded nutrition data did not appear in the tab text (it may render only inside a sheet)', shown.txt.slice(0,90));

console.log('\n=== E3  Conditioning Corner — open a real gauntlet ===');
await fresh('/dashboard.html?tab=conditioning');
const cond = await pg.evaluate(()=>{
  const cards=Array.from(document.querySelectorAll('.cond-card')).filter(e=>e.offsetParent!==null);
  return {n:cards.length, first:(cards[0]||{}).textContent?.replace(/\s+/g,' ').trim().slice(0,50),
    sizes:cards.slice(0,4).map(c=>Math.round(c.getBoundingClientRect().height))};
});
if (cond.n>0) ok(`the Conditioning tab renders ${cond.n} routines`, cond.first);
else bad('Conditioning Corner renders routines','0 .cond-card','at least one');
await fresh('/battle-ropes.html');
const bropes = await pg.evaluate(()=>({
  text:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,100),
  timerControls: Array.from(document.querySelectorAll('button')).filter(b=>b.offsetParent!==null&&/start|go|begin/i.test(b.textContent||''))
    .map(b=>({t:(b.textContent||'').trim().slice(0,12),h:Math.round(b.getBoundingClientRect().height)}))
}));
if (bropes.text.length>20) ok('a conditioning workout page renders', bropes.text.slice(0,60));
const smallC = bropes.timerControls.filter(c=>c.h>0&&c.h<44);
if (smallC.length) bad('conditioning run controls clear 44px', JSON.stringify(smallC), 'all >= 44px');
else if (bropes.timerControls.length) ok('conditioning run controls clear 44px', JSON.stringify(bropes.timerControls));

console.log('\n=== E4  Quick Pump → save and start → log the generated session ===');
await fresh('/quick-pump.html');
const qp = await pg.evaluate(async()=>{
  if (!window.MCQuickPump) return {mod:false};
  const g = window.MCQuickPump.generate({minutes:30,focus:'Full Body'});
  let started=null;
  try { if (window.MCQuickPump.saveAndStart) started = window.MCQuickPump.saveAndStart(g) || 'called'; } catch(e){ started='threw: '+e.message.slice(0,60); }
  return {mod:true, n:(g.exercises||[]).length, names:(g.exercises||[]).map(e=>e.name).slice(0,3),
    started, stores:Object.keys(localStorage).filter(k=>k.indexOf('mc_')===0)};
});
if (!qp.mod) bad('Quick Pump module on its page','absent','window.MCQuickPump');
else {
  ok('Quick Pump generated a session', `${qp.n} exercises: ${qp.names.join(', ')}`);
  console.log('    saveAndStart -> '+qp.started+'  | stores: '+qp.stores.join(','));
  await pg.waitForTimeout(1200);
  const url = pg.url();
  const ran = await pg.evaluate(()=>({strips:document.querySelectorAll('.mcl-strip').length,
    cards:document.querySelectorAll('.ex-card,.ss-ex,.ex-item').length}));
  if (ran.strips>0) ok('the generated session opens with a working logger', `${ran.cards} cards at ${url.split('/').pop().slice(0,40)}`);
  else note('saveAndStart did not navigate into a logger in this harness', `url=${url.split('/').pop()} strips=${ran.strips}`);
}

console.log('\n=== E5  Replace exercise — does the swap persist and repaint? ===');
await pg.goto(BASE+'/manifest.json'); await pg.evaluate(()=>localStorage.clear());
await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
await pg.waitForTimeout(700);
const swap = await pg.evaluate(()=>{
  const card=document.querySelectorAll('.ex-card,.ss-ex,.ex-item')[0];
  const orig=(card.querySelector('.ex-name,.ss-name')||{}).textContent?.trim();
  // write a replacement the way applySwap() does, then ask mc-replace to repaint
  const key='mc_replacements_global';
  const map={}; map[String(orig).toLowerCase()]='Probe Swapped Lift';
  localStorage.setItem(key,JSON.stringify(map));
  let repainted=null;
  try { if (window.MC_REPLACE && window.MC_REPLACE.apply) { window.MC_REPLACE.apply(); repainted='MC_REPLACE.apply()'; } } catch(e){ repainted='threw: '+e.message.slice(0,50); }
  const after=(document.querySelectorAll('.ex-card,.ss-ex,.ex-item')[0].querySelector('.ex-name,.ss-name')||{}).textContent?.trim();
  return {orig, after, repainted};
});
console.log('    '+JSON.stringify(swap));
if (swap.after==='Probe Swapped Lift') ok('a saved replacement repaints the card name', `${swap.orig} → ${swap.after}`);
else note('MC_REPLACE.apply() did not repaint in-place here; mc-replace.js normally repaints on reload', JSON.stringify(swap));
await pg.reload({waitUntil:'domcontentloaded'}); await pg.waitForTimeout(1800);
const afterReload = await pg.evaluate(()=>{
  const c=document.querySelectorAll('.ex-card,.ss-ex,.ex-item')[0];
  return c?(c.querySelector('.ex-name,.ss-name')||{}).textContent?.trim():null;});
if (afterReload==='Probe Swapped Lift') ok('the replacement survives a reload and repaints', afterReload);
else bad('replacement repaints after reload', String(afterReload), 'Probe Swapped Lift');

console.log('\n=== errors across E1–E5 ===');
if (errs.length) bad('zero uncaught errors', errs.slice(0,6).join(' | '), 'none');
else ok('zero uncaught page errors across the whole phase');
await b.close();
console.log(`\nPHASE E: ${pass} passed, ${fail} failed`);
if (findings.length){console.log('\n--- findings ---');findings.forEach(f=>console.log(`* ${f.m}\n    got:  ${f.got}\n    want: ${f.want}`));}
})();
