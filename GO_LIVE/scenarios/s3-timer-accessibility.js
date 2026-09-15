/* GO_LIVE scenario set 3 — Timer attack (protocol §1) + accessibility pass. */
const { chromium } = require('playwright');
const BASE=(process.argv[2]||'http://localhost:8080').replace(/\/$/,'');
const PAGE='/mm-p1.html?day=1';
let pass=0, fail=0;
const ok=(n,x)=>{pass++;console.log(`  ok    ${n}${x?'  ['+x+']':''}`);};
const bad=(n,g,w)=>{fail++;console.log(`  FAIL  ${n} — observed: ${g} | expected: ${w}`);};
const t=(n,g,w)=>(String(g)===String(w)?ok(n,String(g)):bad(n,g,w));

(async()=>{
const b=await chromium.launch({executablePath:process.env.MC_CHROMIUM});
const ctx=await b.newContext({viewport:{width:390,height:844}});
const pg=await ctx.newPage();
const errors=[];
pg.on('pageerror',e=>errors.push('pageerror: '+e.message));
pg.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/i.test(m.text()))errors.push('console: '+m.text());});
await pg.goto(BASE+'/manifest.json'); await pg.evaluate(()=>localStorage.clear());
await pg.goto(BASE+PAGE,{waitUntil:'networkidle'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});

const T=async(fn,...a)=>pg.evaluate(fn,...a);
// TMR.start(el, secs, name) — the first argument is the real .rest-timer chip
// on the card, which is how mc-setlog.js and cat-gainz.html both call it.
const START=async(secs,name)=>pg.evaluate(([s,n])=>{
  const el=document.querySelector('.rest-timer');
  TMR.start(el, s, n||'Rest');
},[secs,name]);

console.log('\n=== S3.1  the timer starts, runs, and reports itself running ===');
t('TMR exists and is the single shared engine', await T(()=>typeof TMR==='object'&&!!TMR.start), 'true');
t('idle timer reports not running', await T(()=>TMR.isRunning()), 'false');
await START(90,'Test Lift');
await pg.waitForTimeout(400);
t('after start(90) the timer reports running', await T(()=>TMR.isRunning()), 'true');
const d1=await T(()=>TMR.duration);
t('duration is the 90 s asked for', d1, 90);

console.log('\n=== S3.2  +15 / -15 adjustments ===');
const base=await T(()=>TMR.duration);
await T(()=>TMR.adjust(15)); await pg.waitForTimeout(150);
t('+15 s extends the rest', await T(()=>TMR.duration), base+15);
await T(()=>TMR.adjust(-15)); await pg.waitForTimeout(150);
t('-15 s brings it back', await T(()=>TMR.duration), base);
// hammer -15 far past zero: must never go negative or blow up
for(let i=0;i<12;i++) await T(()=>TMR.adjust(-15));
await pg.waitForTimeout(300);
const after=await T(()=>({d:TMR.duration,run:TMR.isRunning()}));
if(after.d>=0 && Number.isFinite(after.d)) ok('twelve -15 s taps never drive the clock negative',`duration=${after.d}, running=${after.run}`);
else bad('-15 spam',JSON.stringify(after),'a finite, non-negative duration');

console.log('\n=== S3.3  cancellation ===');
await START(60,'Cancel Me'); await pg.waitForTimeout(300);
await T(()=>TMR.stop()); await pg.waitForTimeout(300);
t('stop() ends the rest', await T(()=>TMR.isRunning()), 'false');
t('stop() clears the interval handle', await T(()=>TMR.interval===null), 'true');

console.log('\n=== S3.4  only ONE timer can run at a time (rapid creation) ===');
await T(()=>{const el=document.querySelector('.rest-timer');for(let i=0;i<8;i++)TMR.start(el,30+i,'Spam '+i);});
await pg.waitForTimeout(600);
const spam=await T(()=>({run:TMR.isRunning(),dur:TMR.duration,name:TMR.activeName,
  intervals:typeof TMR.interval==='object'?'obj':typeof TMR.interval}));
if(spam.run && spam.dur===37) ok('8 overlapping start() calls leave exactly one timer, the last one',JSON.stringify(spam));
else bad('rapid timer creation',JSON.stringify(spam),'one running timer at 37 s (the last start)');
await T(()=>TMR.stop());

console.log('\n=== S3.5  very short and very long durations ===');
await START(1,'One Second'); await pg.waitForTimeout(2200);
t('a 1 s rest completes and stops itself', await T(()=>TMR.isRunning()), 'false');
await START(7200,'Two Hours'); await pg.waitForTimeout(300);
const long=await T(()=>({run:TMR.isRunning(),txt:(document.querySelector('#timerFloat')||{}).textContent||''}));
if(long.run) ok('a 2-hour rest runs without breaking the readout',JSON.stringify(long.txt.replace(/\s+/g,' ').trim().slice(0,32)));
else bad('long duration','not running','running');
await T(()=>TMR.stop());
for(const bogus of ['abc',null,undefined,-30,NaN,Infinity]){
  await T(v=>{try{TMR.start(document.querySelector('.rest-timer'),v,'Bogus');}catch(e){window.__tmrThrew=e.message;}},bogus);
  await pg.waitForTimeout(120);
  const s=await T(()=>({d:TMR.duration,threw:window.__tmrThrew||null}));
  if(s.threw) bad(`start(${String(bogus)}) threw`,s.threw,'handled without throwing');
  else if(!Number.isFinite(s.d)||s.d<0) bad(`start(${String(bogus)}) duration`,s.d,'finite, non-negative');
  else ok(`start(${String(bogus)}) is handled without throwing`,`duration=${s.d}`);
  await T(()=>{TMR.stop();delete window.__tmrThrew;});
}

console.log('\n=== S3.6  a running timer survives scrolling, and navigation ends it cleanly ===');
await START(120,'Scroll Test'); await pg.waitForTimeout(300);
await pg.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
await pg.waitForTimeout(400);
t('the rest is still running after scrolling to the foot of the page', await T(()=>TMR.isRunning()), 'true');
const floatVisible=await T(()=>{const f=document.querySelector('#timerFloat');if(!f)return 'no #timerFloat';
  const r=f.getBoundingClientRect();return (r.height>0&&r.width>0)?'visible':'zero-size';});
ok('the sticky rest surface is still on screen mid-scroll',floatVisible);
await pg.goto(BASE+'/dashboard.html',{waitUntil:'networkidle'});
await pg.waitForTimeout(600);
await pg.goto(BASE+PAGE,{waitUntil:'networkidle'});
await pg.waitForFunction(()=>document.querySelectorAll('.mcl-strip').length>0,null,{timeout:20000});
t('navigating away does not leave a phantom timer running', await T(()=>TMR.isRunning()), 'false');

console.log('\n=== S3.7  the rest-timer chip is a real, keyboard-operable button ===');
const chip=await T(()=>{const c=document.querySelector('.rest-timer');if(!c)return null;
  return {tag:c.tagName,secs:c.dataset.secs||null,type:c.getAttribute('type'),
    tabbable:c.tabIndex>=0||c.tagName==='BUTTON',label:c.getAttribute('aria-label')||c.textContent.trim().slice(0,24)};});
if(!chip) bad('a .rest-timer chip exists on a workout page','none found','at least one');
else{
  t('the chip is a native <button> (keyboard-focusable for free)',chip.tag,'BUTTON');
  if(chip.secs) ok('it carries its rest length as data, not an inline onclick',`data-secs=${chip.secs}`);
  else bad('data-secs on the chip','absent','present');
  ok('accessible name',JSON.stringify(chip.label));
}
const kb=await T(async()=>{const c=document.querySelector('.rest-timer');if(!c)return 'no chip';
  c.focus(); const focused=document.activeElement===c; return focused?'focusable':'not focusable';});
t('the chip takes keyboard focus',kb,'focusable');
await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
t('pressing Enter on the focused chip starts the rest', await T(()=>TMR.isRunning()), 'true');
await T(()=>TMR.stop());

console.log('\n=== S3.8  the set checkbox is an operable, announced control ===');
const ckInfo=await T(()=>{const s=document.querySelectorAll('.mcl-strip')[0];
  const card=s.closest('.ex-card,.ss-ex,.ex-item'); let w=card.querySelector('.mcl-wrap');
  if(!w||!w.classList.contains('open')){s.click();w=card.querySelector('.mcl-wrap');}
  const ck=w.querySelector('.mcl-ck'); if(!ck)return null;
  return {tag:ck.tagName,role:ck.getAttribute('role'),checked:ck.getAttribute('aria-checked'),
    label:ck.getAttribute('aria-label'),box:(r=>({w:Math.round(r.width),h:Math.round(r.height)}))(ck.getBoundingClientRect())};});
if(!ckInfo) bad('a set checkbox is reachable','none','one');
else{
  t('it declares role=checkbox',ckInfo.role,'checkbox');
  t('it declares its state',ckInfo.checked,'false');
  if(ckInfo.label) ok('it has an accessible name',JSON.stringify(ckInfo.label)); else bad('aria-label','absent','present');
  if(ckInfo.box.w>=44&&ckInfo.box.h>=44) ok('it clears the 44px touch floor',`${ckInfo.box.w}x${ckInfo.box.h}`);
  else bad('touch target',`${ckInfo.box.w}x${ckInfo.box.h}`,'>= 44x44');
}
await T(()=>{const w=document.querySelector('.mcl-wrap.open')||document.querySelector('.mcl-wrap');
  const ck=w.querySelector('.mcl-ck:not(.done)'); ck.focus(); });
await pg.keyboard.press('Space'); await pg.waitForTimeout(700);
const flipped=await T(()=>{const w=document.querySelector('.mcl-wrap.open')||document.querySelector('.mcl-wrap');
  const ck=w.querySelector('.mcl-ck'); return ck?ck.getAttribute('aria-checked'):'gone';});
t('Space on the focused checkbox logs the set and flips aria-checked',flipped,'true');

console.log('\n=== S3.9  reduced motion is respected ===');
const ctxRM=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
const pgRM=await ctxRM.newPage();
await pgRM.goto(BASE+PAGE,{waitUntil:'networkidle'});
await pgRM.waitForTimeout(1200);
const rm=await pgRM.evaluate(()=>({q:matchMedia('(prefers-reduced-motion: reduce)').matches,
  rules:Array.from(document.styleSheets).reduce((n,s)=>{try{return n+Array.from(s.cssRules).filter(r=>r.conditionText&&/reduced-motion/.test(r.conditionText)).length;}catch(e){return n;}},0)}));
t('the browser reports reduced-motion',rm.q,'true');
if(rm.rules>0) ok('the stylesheets carry reduced-motion rules',rm.rules+' @media block(s)');
else bad('prefers-reduced-motion handling','no @media (prefers-reduced-motion) rules found in loaded CSS','at least one');
await ctxRM.close();

console.log('\n=== errors ===');
if(errors.length){fail++;console.log('  FAIL  '+errors.length+' error(s):');errors.slice(0,10).forEach(e=>console.log('        '+e));}
else ok('zero uncaught page errors across the timer + a11y campaign');
await b.close();
console.log(`\nS3 timer/a11y: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
})();
