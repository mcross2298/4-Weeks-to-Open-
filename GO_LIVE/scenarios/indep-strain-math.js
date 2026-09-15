global.window = global.window || {};
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k,v) => { store[k]=v; } };
const LR = require('/home/user/4-Weeks-to-Open-/mc-log-read.js');
global.window.MC_LOG = LR;
const ST = require('/home/user/4-Weeks-to-Open-/mc-strain.js');
const LB_PER_KG = 2.20462, BW = 200;
const mkSets = (n,w,r,rpe) => Array.from({length:n},()=>({weight:String(w),reps:String(r),rpe:String(rpe||7)}));
const E = (n,w,r,mins,rpe) => ({ date:new Date().toISOString(), duration: mins+' min', sets: mkSets(n,w,r,rpe) });
const expectKcal = (ton,mins,bw,nf) => {
  let met = 5.0 + (ton/mins)/25; if (nf>=2) met += 0.75;
  met = Math.max(3.5, Math.min(9.0, met));
  return Math.round(met*(bw/LB_PER_KG)*(mins/60));
};
let pass=0, fail=0;
const t=(n,g,w)=>{ if(g===w) pass++; else { fail++; console.log(`  FAIL ${n}: got ${g} want ${w}`);} };

console.log('--- tonnage = independent sum of weight x reps ---');
for (const [n,w,r] of [[10,100,10],[43,135,8],[1,45,1],[30,225,5]])
  t(`tonnage ${n}x${w}x${r}`, ST.session(E(n,w,r,60),BW).tonnage, n*w*r);
t('cluster 200x(5+5+5) summed', ST.session({date:'',duration:'60 min',sets:[{weight:'200',reps:'5+5+5',rpe:'8'}]},BW).tonnage, 3000);

console.log('--- kcal vs the physical MET formula (MET x kg x h) ---');
const cases = [
  ['very light',    E(10,50,12,60),  6000, 60],
  ['beginner',      E(20,80,10,50),  16000,50],
  ['typical hour',  E(40,135,10,60), 54000,60],
  ['heavy 75min',   E(43,225,8,75),  77400,75],
];
for (const [label,e,ton,mins] of cases) {
  const got = ST.session(e,BW);
  t(`kcal ${label}`, got.kcal, expectKcal(ton,mins,BW,0));
  const rate=ton/mins, raw=5+rate/25;
  console.log(`  ${label.padEnd(13)} ${String(ton).padStart(6)} lb / ${mins}min = ${rate.toFixed(0).padStart(4)} lb/min | raw MET ${raw.toFixed(1).padStart(5)} -> used ${Math.max(3.5,Math.min(9,raw)).toFixed(1)} | ${got.kcal} kcal${raw>9?'   <-- CLAMPED':''}`);
}
console.log('\n--- MET saturation boundary: raw MET hits the 9.0 ceiling at ---');
console.log(`  tonnage rate = (9.0 - 5.0) x 25 = ${(9-5)*25} lb/min`);
for (const mins of [30,45,60,75]) console.log(`  a ${mins}-min session saturates above ${100*mins} lb of total tonnage`);

console.log('\n--- is the near-failure RPE bonus reachable on a real session? ---');
for (const [label,e,ton,mins] of cases) {
  const plain = ST.session(e,BW).kcal;
  const hard = ST.session({...e, sets: e.sets.map((s,i)=>i<3?{...s,rpe:'F'}:s)}, BW).kcal;
  console.log(`  ${label.padEnd(13)} all RPE7 ${String(plain).padStart(4)} kcal | 3 sets to failure ${String(hard).padStart(4)} kcal | delta ${hard-plain}`);
}
console.log('\n--- does tonnage move the number at realistic volumes? (same 60 min) ---');
for (const n of [20,40,80]) {
  const s = ST.session(E(n,135,10,60),BW);
  console.log(`  ${String(n).padStart(2)} sets | tonnage ${String(s.tonnage).padStart(6)} lb | ${s.kcal} kcal`);
}
console.log('\n--- guards ---');
t('no sets -> 0', ST.session(E(0,100,10,60),BW).kcal, 0);
t('unparseable duration -> 0', ST.session({date:'',duration:'',sets:mkSets(10,100,10)},BW).kcal, 0);
t('null entry -> 0', ST.session(null,BW).kcal, 0);
t('negative inputs -> 0 tonnage', ST.session({date:'',duration:'60 min',sets:[{weight:'-500',reps:'-10'}]},BW).tonnage, 0);
t('duration capped at 8h', ST.session(E(10,100,10,100000),BW).kcal, expectKcal(10000,480,BW,0));
console.log(`\nindep-strain: ${pass} passed, ${fail} failed`);
