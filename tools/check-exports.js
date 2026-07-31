#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-exports.js — stop the global-namespace split from growing (audit G-09)
   --------------------------------------------------------------------------
   The audit found four conventions coexisting on `window`:

     MC_UPPER_SNAKE   31 modules   public module API
     MCPascalCase     24 modules   public module API — same job, different shape
     __mcCamelCase    21 modules   load-guard sentinel, a DIFFERENT purpose and
                                   used consistently; deliberately left alone
     unprefixed       11 names     render, aReps, allProgs, doSwUpdate, ...

   Nothing here is broken today: every consumer matches its producer. Migrating
   the 24 minority modules would mean rewriting 261 references across 55 files
   — cosmetic churn on working code, where one missed reference fails silently
   at runtime and the smoke test only renders 38 of 140 pages. That trade was
   measured and declined.

   So this gate does the Lean thing instead: it freezes the existing split as a
   grandfathered baseline and fails any NEW export that widens it. The two
   public conventions stop multiplying, unprefixed generic globals stop being
   added, and the cost is zero churn on code that already works.

   Adding a module? Export it as MC_UPPER_SNAKE and this stays quiet. Renaming
   or removing an export? Update BASELINE below in the same commit — that is
   the one manual step, and it is intentional: it makes namespace changes a
   visible decision rather than a silent accident.

   Run: node tools/check-exports.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL = /^MC_[A-Z0-9_]+$/;          // the majority convention
const GUARD = /^__[a-z][A-Za-z0-9]*$/;        // load-guard sentinels — fine, different job

// Every export present when this gate was introduced. New entries are only
// legitimate if they match CANONICAL (or are a load guard), so this list should
// shrink or stay flat over time, never grow with new shapes.
const BASELINE = {
  'conditioning-data.js': [],
  'exercise-catalog.js': ['EXERCISES'],
  'ks-engine.js': [],
  'mc-account.js': ['__mcAccount'],
  'mc-appearance.js': ['MC_APPEARANCE'],
  'mc-backup-status.js': ['MC_BACKUP_STATUS'],
  'mc-barcode.js': ['MCBarcode'],
  'mc-biomech.js': ['MCBiomech'],
  'mc-biometric.js': ['MC_BIO'],
  'mc-body.js': ['MC_BODY'],
  'mc-bonus-routing.js': ['MC_BONUS'],
  'mc-bridge.js': ['MCBridge'],
  'mc-calendar.js': ['MCCalendar'],
  'mc-card-actions.js': ['MC_PM_SUSPEND_SS', '__mcCardActions'],
  'mc-chart.js': ['MC_CHART'],
  'mc-collections.js': ['MC_COLLECTIONS'],
  'mc-cond-suggest.js': ['__mcCondSuggest'],
  'mc-cond.js': ['MCCond'],
  'mc-cues-data.js': ['MC_CUES'],
  'mc-cues.js': ['MCCues'],
  'mc-data.js': [],
  'mc-engine.js': ['MC'],
  'mc-exercise-catalog.js': ['MC_EXCATALOG'],
  'mc-exercise-trends.js': ['MCTrends'],
  'mc-export.js': ['MCExport'],
  'mc-finish.js': ['_FW'],
  'mc-foodapi.js': ['MCFoodAPI'],
  'mc-global-search.js': ['MC_GLOBAL_SEARCH'],
  'mc-group-split.js': ['__mcGroupSplit'],
  'mc-guided.js': ['MC_GUIDED'],
  'mc-input-sheet.js': ['MCInputSheet'],
  'mc-install.js': ['MC_INSTALL'],
  'mc-interval.js': [],
  'mc-layout.js': ['MC_LAYOUT'],
  'mc-live-tracker.js': ['MCActivity', '__mcLiveTracker'],
  'mc-macrocalc.js': ['MCMacroCalc'],
  'mc-macros.js': ['MCMacros'],
  'mc-maxout.js': [],
  'mc-muscle-map.js': ['MC_MUSCLES'],
  'mc-naming-paint.js': ['__mcNamingPaint', 'allProgs'],
  'mc-naming.js': ['MC_NAMES'],
  'mc-nav.js': ['__mcNav'],
  'mc-onboarding.js': ['MC_ONBOARD'],
  'mc-pm-creator.js': ['MC_PM_CREATOR'],
  'mc-pm-data.js': ['MC_PM_DATA'],
  'mc-pm-inline.js': ['MC_PM_INLINE'],
  'mc-pm-layout-editor.js': ['MC_PM_LAYOUT'],
  'mc-program-builder.js': ['MCPB'],
  'mc-program-hero.js': ['MCProgramHero'],
  'mc-program-pub.js': ['MCPub'],
  'mc-program-status.js': ['MCProgramStatus'],
  'mc-program-store.js': ['MCPrograms'],
  'mc-push.js': ['MC_PUSH'],
  'mc-quick-pump.js': ['MCQuickPump'],
  'mc-recap.js': ['MC_RECAP'],
  'mc-rep-progress.js': ['__mcRepProgress'],
  'mc-replace.js': ['render'],
  'mc-reps.js': ['aReps'],
  'mc-resume.js': ['__mcResume'],
  'mc-schedule.js': ['MCSchedule'],
  'mc-session.js': ['MCSession', '__mcSession'],
  'mc-setlog.js': ['MCSetlogUtil', '__mcSetlog'],
  'mc-share.js': ['MCShare'],
  'mc-stats.js': [],
  'mc-suggest.js': ['__mcSuggest'],
  'mc-summary.js': ['__mcSummary', 'mcDailySessions'],
  'mc-supabase.js': ['MC_SB'],
  'mc-superset-hop.js': ['__mcSSHop'],
  'mc-surprise.js': ['MC_SURPRISE', '__mcSurprise'],
  'mc-sw-update.js': ['__mcSwReloaded', '__mcSwUpdate', 'doSwUpdate'],
  'mc-swap-manager.js': [],
  'mc-sync.js': ['MC_SYNC', '__mcSync'],
  'mc-theme.js': ['MC_THEME'],
  'mc-timer.js': [],
  'mc-voice.js': ['MCVoice'],
  'mc-wrapped.js': [],
  'mm-data.js': ['MM_DATA'],
  'mm-engine.js': ['MM'],
  'pmc-data.js': [],
  'pmc-s7-data.js': ['PMC_S7'],
  'program-manager.js': ['MC_PM', 'MC_PM_PUBLISH', '__mcProgramManager'],
  'program-overrides.js': ['MC_PO', 'MC_SCAN', '__mcProgOverrides'],
  'stndr-checkoff.js': ['__stndrCheckoff'],
  'sw.js': []
};

const EXPORT_RE = /^\s*window\.([A-Za-z_][A-Za-z0-9_]*)\s*=/gm;

let problems = 0, checked = 0, newOk = 0;

for (const file of fs.readdirSync(ROOT).filter(f => f.endsWith('.js')).sort()) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const found = new Set();
  let m;
  EXPORT_RE.lastIndex = 0;
  while ((m = EXPORT_RE.exec(src))) found.add(m[1]);
  checked++;

  const grandfathered = new Set(BASELINE[file] || []);
  for (const name of found) {
    if (grandfathered.has(name)) continue;
    if (GUARD.test(name)) { newOk++; continue; }
    if (CANONICAL.test(name)) { newOk++; continue; }
    console.error(
      `::error file=${file}::new global \`window.${name}\` does not match the canonical ` +
      `MC_UPPER_SNAKE convention. Rename it (e.g. MC_${name.replace(/^MC/, '').replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}), ` +
      `or if this is a deliberate namespace change, add it to BASELINE in tools/check-exports.js.`);
    problems++;
  }

  // A baseline entry that has vanished means the file was renamed or the export
  // removed — fine, but the list should be updated so it keeps meaning something.
  for (const name of grandfathered) {
    if (!found.has(name)) {
      console.error(
        `::error file=${file}::\`window.${name}\` is in tools/check-exports.js's BASELINE ` +
        `but no longer exported. Remove it from BASELINE in the same commit.`);
      problems++;
    }
  }
}

if (problems) {
  console.error(`\n${problems} namespace problem(s).`);
  process.exit(1);
}
console.log(`Exports OK — ${checked} modules checked; baseline intact` +
  (newOk ? `, ${newOk} conforming export(s) beyond it.` : '.'));
