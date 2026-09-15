const { chromium } = require('playwright');
const BASE='http://localhost:8080';
(async()=>{
const b=await chromium.launch({executablePath:process.env.MC_CHROMIUM});

console.log('=== A. offline reload of a page the athlete HAS visited ===');
{
const ctx=await b.newContext({viewport:{width:390,height:844}});
const pg=await ctx.newPage();
await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'networkidle'});          // visit online first
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
await pg.waitForTimeout(3000);                                              // let the SW cache it
await ctx.setOffline(true);
let r='threw';
try{ await pg.reload({waitUntil:'domcontentloaded',timeout:15000}); r='loaded'; }catch(e){ r=e.message.split('\n')[0].slice(0,60); }
let cards=0, logged=-1;
if(r==='loaded'){
  try{ await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:12000});
       cards=await pg.evaluate(()=>document.querySelectorAll('.mcl-strip').length); }catch(e){}
  logged=await pg.evaluate(()=>{ const s=document.querySelectorAll('.mcl-strip')[0]; if(!s)return -2;
    const c=s.closest('.ex-card,.ss-ex,.ex-item'); let w=c.querySelector('.mcl-wrap');
    if(!w||!w.classList.contains('open')){s.click();w=c.querySelector('.mcl-wrap');}
    const ck=w&&w.querySelector('.mcl-ck:not(.done)'); if(!ck)return -3;
    const row=ck.closest('.mcl-row'); row.querySelector('.mcl-w').value='175';
    row.querySelector('.mcl-w').dispatchEvent(new Event('input',{bubbles:true})); ck.click(); return 1;});
  await pg.waitForTimeout(1200);
  const kept=await pg.evaluate(()=>{try{const s=JSON.parse(localStorage.getItem('mc_setlog_v1')||'{}');
    return Object.keys(s).reduce((n,k)=>{const e=(s[k]||[])[0];return n+(e&&e.sets?Object.keys(e.sets).length:0);},0);}catch(e){return -1;}});
  console.log(`  reload offline: ${r} | exercise cards rebuilt: ${cards} | set logged offline: ${logged===1?'yes':'no('+logged+')'} | sets in store: ${kept}`);
} else console.log('  reload offline: '+r);
// and a page NEVER visited
let never='?';
try{ await pg.goto(BASE+'/mm-p2.html',{waitUntil:'domcontentloaded',timeout:12000}); never='loaded'; }
catch(e){ never=e.message.split('\n')[0].replace('page.goto: ','').slice(0,48); }
console.log(`  a program page never opened while online, requested offline: ${never}`);
await ctx.setOffline(false); await ctx.close();
}

console.log('\n=== B. Nutrition tab: what actually renders ===');
{
const ctx=await b.newContext({viewport:{width:390,height:844}});
const pg=await ctx.newPage();
await pg.goto(BASE+'/dashboard.html?tab=nutrition',{waitUntil:'networkidle'});
await pg.waitForTimeout(3000);
const n=await pg.evaluate(()=>({
  rings:document.querySelectorAll('svg circle,[class*=ring]').length,
  gear:!!document.querySelector('#ntGear,[id*=Gear],[class*=gear]'),
  search:document.querySelectorAll('input[type=search],input[placeholder*=ood],input[placeholder*=earch]').length,
  cal:/\bcalorie|kcal|\bcal\b/i.test(document.body.innerText||''),
  words:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,260)}));
console.log('  ring elements:',n.rings,'| gear control:',n.gear,'| food search inputs:',n.search,'| mentions calories:',n.cal);
console.log('  visible text:',JSON.stringify(n.words));
await ctx.close();
}

console.log('\n=== C. storage exhaustion: did the write actually FAIL? ===');
{
const ctx=await b.newContext({viewport:{width:390,height:844}});
const pg=await ctx.newPage();
await pg.goto(BASE+'/mm-p1.html?day=1',{waitUntil:'networkidle'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
const fill=await pg.evaluate(()=>{let i=0;const blob='x'.repeat(256*1024);
  try{for(;i<400;i++)localStorage.setItem('__fill_'+i,blob);}catch(e){return {n:i,e:e.name};}return{n:i,e:null};});
console.log(`  filled: ${fill.n} x 256KB (${fill.e})`);
const probe=await pg.evaluate(()=>{
  // Can a GROWING write still land? That is the real exposure Phase 5.3 names.
  const before=localStorage.getItem('mc_setlog_v1')||'{}';
  let grewOK=null, err=null;
  try{ localStorage.setItem('mc_setlog_v1', before + ' '.repeat(50000)); grewOK=true; localStorage.setItem('mc_setlog_v1',before); }
  catch(e){ grewOK=false; err=e.name; }
  return {grewOK, err, hasGuardedWriter: !!(window.MCSetlogUtil && window.MCSetlogUtil.writeStore)};});
console.log(`  a write that GROWS the store by 50KB: ${probe.grewOK?'still succeeded':'REFUSED ('+probe.err+')'} | guarded writer present: ${probe.hasGuardedWriter}`);
// Now force the guarded writer to face a genuinely failing write and see if it warns.
const warned=await pg.evaluate(()=>{
  if(!(window.MCSetlogUtil&&window.MCSetlogUtil.writeStore)) return {no:'no guarded writer'};
  const big='y'.repeat(3*1024*1024);        // 3MB — cannot fit in a full store
  let threw=null;
  try{ window.MCSetlogUtil.writeStore('mc_setlog_probe_v1', big); }catch(e){ threw=e.name; }
  return {threw};});
await pg.waitForTimeout(1500);
const ui=await pg.evaluate(()=>{const a=document.querySelector('[role=alert]');
  return {alert:!!a, text:a?(a.innerText||'').replace(/\s+/g,' ').trim().slice(0,110):null,
    mentions:/storage|space|full|room|couldn|could not save/i.test(document.body.innerText||'')};});
console.log(`  guarded writer given a 3MB value: threw=${warned.threw||'no'} | role=alert shown: ${ui.alert} | storage copy on page: ${ui.mentions}`);
if(ui.text) console.log(`  banner text: ${JSON.stringify(ui.text)}`);
await pg.evaluate(()=>Object.keys(localStorage).filter(k=>k.indexOf('__fill_')===0).forEach(k=>localStorage.removeItem(k)));
await ctx.close();
}
await b.close();})();
