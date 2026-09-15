// Independent validation of the nutrition goal calculator. Expected values are
// computed from the PUBLISHED Mifflin-St Jeor / Atwater formulas, not by
// calling the app's own function and agreeing with it.
const fs = require('fs'), vm = require('vm');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('/home/user/4-Weeks-to-Open-/mc-macrocalc.js','utf8'), sandbox);
const C = sandbox.window.MCMacroCalc;
let pass=0, fail=0;
const t=(n,g,w)=>{ if(g===w){pass++;} else {fail++; console.log(`  FAIL ${n}: got ${g} want ${w}`);} };
const near=(n,g,w,tol)=>{ if(Math.abs(g-w)<=tol){pass++;} else {fail++; console.log(`  FAIL ${n}: got ${g} want ~${w}`);} };

// Mifflin-St Jeor, as published:
//   male   BMR = 10*kg + 6.25*cm - 5*age + 5
//   female BMR = 10*kg + 6.25*cm - 5*age - 161
const KG = 2.2046226218;
const msj = (lb, cm, age, sex) => 10*(lb/KG) + 6.25*cm - 5*age + (sex==='female' ? -161 : 5);
const MULT = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, athlete:1.9 };
const ADJ  = { cut:-0.20, maintain:0, bulk:0.15 };
const PPL  = { cut:1.10, maintain:1.00, bulk:0.90 };

console.log('--- BMR vs published Mifflin-St Jeor ---');
const people = [
  ['M 200lb 180cm 30', {sex:'male',   age:30, heightCm:180, weightLb:200}],
  ['F 140lb 165cm 28', {sex:'female', age:28, heightCm:165, weightLb:140}],
  ['M 250lb 190cm 45', {sex:'male',   age:45, heightCm:190, weightLb:250}],
  ['F 110lb 155cm 60', {sex:'female', age:60, heightCm:155, weightLb:110}],
];
for (const [label,p] of people) {
  near(`bmr ${label}`, C.bmr(p), msj(p.weightLb,p.heightCm,p.age,p.sex), 0.51);
  console.log(`  ${label.padEnd(20)} app BMR ${Math.round(C.bmr(p))} | published ${Math.round(msj(p.weightLb,p.heightCm,p.age,p.sex))}`);
}
console.log('--- TDEE = BMR x activity multiplier ---');
for (const [label,p] of people) for (const act of Object.keys(MULT)) {
  near(`tdee ${label}/${act}`, C.tdee({...p,activity:act}), msj(p.weightLb,p.heightCm,p.age,p.sex)*MULT[act], 0.51);
}
console.log('--- target kcal = TDEE x (1+goal adjust), rounded to 10 ---');
for (const [label,p] of people) for (const act of ['sedentary','moderate','athlete']) for (const g of Object.keys(ADJ)) {
  const want = Math.round((msj(p.weightLb,p.heightCm,p.age,p.sex)*MULT[act]*(1+ADJ[g]))/10)*10;
  t(`kcal ${label}/${act}/${g}`, C.recommend({...p,activity:act,goal:g}).kcal, want);
}
console.log('--- macro split: protein & fat anchored to bodyweight, carbs fill ---');
for (const [label,p] of people) for (const g of Object.keys(ADJ)) {
  const r = C.recommend({...p,activity:'moderate',goal:g});
  t(`protein ${label}/${g}`, r.p, Math.round(p.weightLb*PPL[g]));
  t(`fat ${label}/${g}`,     r.f, Math.round(p.weightLb*0.35));
  const carbKcal = r.kcal - r.p*4 - r.f*9;
  t(`carbs ${label}/${g}`,   r.c, Math.max(0, Math.round(carbKcal/4)));
  // Atwater closure: the split must re-derive the target within rounding.
  near(`atwater closes ${label}/${g}`, r.p*4 + r.f*9 + r.c*4, r.kcal, 3);
}
console.log('--- Atwater 4/4/9 ---');
t('kcalFromMacros(200p,70f,300c)', C.kcalFromMacros(200,70,300), 200*4+300*4+70*9);
t('percents sum ~100', (()=>{const q=C.macroPercents(200,70,300); return Math.abs(q.p+q.f+q.c-100)<=2;})(), true);

console.log('--- boundary / garbage handling ---');
t('zero weight -> no negative protein', C.splitFromCalories(2000,0,'cut').p, 0);
t('carbs never negative', C.splitFromCalories(100,250,'cut').c, 0);
for (const bad of [NaN, Infinity, -Infinity, 'abc', null, undefined]) {
  const r = C.recommend({sex:'male',age:30,heightCm:180,weightLb:bad,activity:'moderate',goal:'cut'});
  const ok = [r.kcal,r.p,r.f,r.c].every(v => Number.isFinite(v) && v >= 0);
  t(`weightLb=${String(bad)} finite & non-negative`, ok, true);
}
const unknown = C.recommend({sex:'male',age:30,heightCm:180,weightLb:200,activity:'nonsense',goal:'nonsense'});
t('unknown activity/goal falls back, stays finite', Number.isFinite(unknown.kcal) && unknown.kcal>0, true);
console.log(`\nindep-macro: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
