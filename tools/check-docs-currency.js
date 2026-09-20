#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-docs-currency.js — the Documentation currency rule, enforced
   --------------------------------------------------------------------------
   CLAUDE.md's "Documentation currency rule" says a user-facing change updates
   the Quick Tour or the program's own guide in the same piece of work. Until
   now NOTHING checked that. Worse, CLAUDE.md spent months CLAIMING two gates
   did -- tools/check-tour-coverage.js and tour assertions inside
   tools/check-docs.js -- and `git log --all` shows neither file has ever
   existed in this repository. The claim was corrected in place (go-live
   assessment, 2026-09-15) and the hole was left open. This closes it.

   THREE PASSES, and what each is deliberately NOT.

   1. TOUR INTEGRITY -- executable, not a keyword grep.
      quick-tour-data.js's own header says data and renderer ship together
      because "a field added to one and not the other is the drift worth
      preventing". Nothing tested that either. This loads the real file in a
      vm sandbox (the technique test-mc-bridge.js and test-mc-sync-merge.js
      already use), asserts every slide carries the fields the renderer reads,
      and then RUNS slideBodyHTML() over all of them -- a renderer that throws
      or returns nothing on a real slide is the drift, and only executing it
      finds that.

   2. PROGRAM GUIDE COVERAGE -- program-guide.html builds its links at RUNTIME
      from MC_PM_DATA (`href="' + p.id + '-instructions.html"`), so there is no
      static list to compare and the only thing that can be wrong is a missing
      FILE: the page renders a link straight to a 404. Checked per program id.

      LICENSED programs are excluded, and the exclusion is DERIVED from
      content-manifest.json's own `licensed` array rather than hardcoded --
      the same reasoning tests/test_rls.py records for reading that file
      directly: a second copy of the list is free to drift from the one the
      build enforces, and a brand term written into a shared tool is what
      build-market.py --check exists to catch.

   3. NEW-MODULE TRIPWIRE -- the honest version of "is this user-facing?".
      A gate that tried to CLASSIFY all 95 mc-*.js modules would be guessing,
      and a wrong guess silently exempts a real feature forever. So it does
      not guess. It pins the module list, and a file appearing or disappearing
      fails with one instruction: decide whether it is user-facing, update the
      tour if it is, then update this list. That turns "remember to update the
      docs" into a decision somebody has to make at review time, which is the
      only part a static gate can honestly enforce.

   Run: node tools/check-docs-currency.js
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const fail = [];
const note = [];

function read(f) {
  try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { return null; }
}

// ---------------------------------------------------------------------------
// 1. Tour integrity.
// ---------------------------------------------------------------------------
// Optional by design: `tip`, `cta`, `finish` and `last` appear on some slides
// only. Everything else is read unconditionally by slideBodyHTML().
const SLIDE_REQUIRED = ['eyebrow', 'title', 'tagline', 'scene', 'narration'];

const tourSrc = read('quick-tour-data.js');
if (!tourSrc) {
  fail.push('quick-tour-data.js is missing — the Quick Tour has no content');
} else {
  const ctx = { window: {}, document: {} };
  vm.createContext(ctx);
  try {
    vm.runInContext(tourSrc, ctx, { filename: 'quick-tour-data.js' });
  } catch (e) {
    fail.push('quick-tour-data.js threw while loading: ' + e.message);
  }
  const T = ctx.window.MC_TOUR;
  if (!T) {
    fail.push('quick-tour-data.js no longer publishes window.MC_TOUR');
  } else {
    if (!Array.isArray(T.SLIDES) || !T.SLIDES.length) {
      fail.push('MC_TOUR.SLIDES is not a non-empty array');
    }
    if (typeof T.slideBodyHTML !== 'function') {
      fail.push('MC_TOUR.slideBodyHTML is not a function — the tour has data and no renderer');
    }
    if (Array.isArray(T.SLIDES) && typeof T.slideBodyHTML === 'function') {
      T.SLIDES.forEach((s, i) => {
        const where = 'slide ' + (i + 1) + (s && s.title ? ' ("' + s.title + '")' : '');
        SLIDE_REQUIRED.forEach(k => {
          if (s[k] === undefined || s[k] === null) fail.push(where + ' is missing `' + k + '`');
        });
        if (s.scene && (!s.scene.glyph || !s.scene.caption)) {
          fail.push(where + "'s scene is missing glyph or caption");
        }
        // A slide carries `steps` OR `finish` -- the closing slide is a
        // wrap-up list, not a numbered walkthrough. Neither is the drift.
        if (!Array.isArray(s.steps) && !Array.isArray(s.finish)) {
          fail.push(where + ' has neither a `steps` nor a `finish` list');
        }
        ['steps', 'finish'].forEach(k => {
          if (s[k] !== undefined && !Array.isArray(s[k])) fail.push(where + "'s `" + k + '` is not an array');
        });
        // The real drift test: run the renderer over the real slide.
        let html;
        try { html = T.slideBodyHTML(s); }
        catch (e) { fail.push(where + ' — slideBodyHTML() threw: ' + e.message); return; }
        if (typeof html !== 'string' || !html.trim()) {
          fail.push(where + ' — slideBodyHTML() returned nothing');
        }
      });
      note.push(T.SLIDES.length + ' slides render');
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Program guide coverage.
// ---------------------------------------------------------------------------
const pmSrc = read('mc-pm-data.js');
let manifest = null;
try { manifest = JSON.parse(read('content-manifest.json')); } catch (e) { /* handled below */ }

if (!pmSrc) {
  fail.push('mc-pm-data.js is missing');
} else if (!manifest || !manifest.licensed || typeof manifest.licensed !== 'object') {
  fail.push('content-manifest.json has no `licensed` block — cannot scope this pass honestly');
} else {
  const ctx = { window: {}, document: {} };
  vm.createContext(ctx);
  try { vm.runInContext(pmSrc, ctx, { filename: 'mc-pm-data.js' }); }
  catch (e) { fail.push('mc-pm-data.js threw while loading: ' + e.message); }
  const progs = (ctx.window.MC_PM_DATA && ctx.window.MC_PM_DATA.programs) || [];
  if (!progs.length) {
    fail.push('MC_PM_DATA.programs is empty — this pass would assert nothing');
  }
  // content-manifest.json's `licensed` is an OBJECT keyed by program id
  // (each value carries owner/program/files), so the ids are its keys.
  const licensed = new Set(Object.keys(manifest.licensed));
  let checked = 0, skipped = 0;
  progs.forEach(p => {
    if (!p || !p.id) return;
    if (licensed.has(String(p.id))) { skipped++; return; }
    checked++;
    const guide = p.id + '-instructions.html';
    if (!fs.existsSync(path.join(ROOT, guide))) {
      fail.push('program "' + p.id + '" has no ' + guide + ' — program-guide.html builds that href at runtime, so it renders a link to a 404');
    }
  });
  note.push(checked + ' program guides present (' + skipped + ' licensed, out of scope)');
}

// ---------------------------------------------------------------------------
// 3. New-module tripwire.
//
// Pinned, not classified. See the header for why this does not try to decide
// which modules are user-facing.
// ---------------------------------------------------------------------------
const KNOWN_MODULES = [
  'mc-account.js',
  'mc-appearance.js',
  'mc-backup-status.js',
  'mc-barcode.js',
  'mc-biomech.js',
  'mc-biometric.js',
  'mc-body.js',
  'mc-bonus-routing.js',
  'mc-bridge.js',
  'mc-calendar.js',
  'mc-card-actions.js',
  'mc-chart.js',
  'mc-classify.js',
  'mc-collections.js',
  'mc-cond-suggest.js',
  'mc-cond.js',
  'mc-cues-data.js',
  'mc-cues.js',
  'mc-data.js',
  'mc-day-hero.js',
  'mc-engine.js',
  'mc-exercise-catalog.js',
  'mc-exercise-trends.js',
  'mc-export.js',
  'mc-finish.js',
  'mc-foodapi.js',
  'mc-freq-engine.js',
  'mc-global-search.js',
  'mc-group-split.js',
  'mc-guided.js',
  'mc-haptics.js',
  'mc-hints.js',
  'mc-input-sheet.js',
  'mc-install.js',
  'mc-interval.js',
  'mc-layout.js',
  'mc-live-tracker.js',
  'mc-log-read.js',
  'mc-macrocalc.js',
  'mc-macros.js',
  'mc-maxout.js',
  'mc-muscle-map.js',
  'mc-naming-paint.js',
  'mc-naming.js',
  'mc-nav.js',
  'mc-offline-prefetch.js',
  'mc-onboarding.js',
  'mc-pdf.js',
  'mc-pm-creator.js',
  'mc-pm-data.js',
  'mc-pm-inline.js',
  'mc-pm-layout-editor.js',
  'mc-pmc-engine.js',
  'mc-program-builder.js',
  'mc-program-day.js',
  'mc-program-hero.js',
  'mc-program-menu.js',
  'mc-program-progress.js',
  'mc-program-pub.js',
  'mc-program-status.js',
  'mc-program-store.js',
  'mc-program-tabs.js',
  'mc-pump-engine.js',
  'mc-push.js',
  'mc-quick-pump.js',
  'mc-readiness-brief.js',
  'mc-readiness.js',
  'mc-recap.js',
  'mc-rep-progress.js',
  'mc-replace.js',
  'mc-reps.js',
  'mc-resume.js',
  'mc-s3-engine.js',
  'mc-schedule.js',
  'mc-session.js',
  'mc-setlog.js',
  'mc-share.js',
  'mc-stats.js',
  'mc-strain.js',
  'mc-streak.js',
  'mc-suggest.js',
  'mc-summary.js',
  'mc-supabase.js',
  'mc-superset-hop.js',
  'mc-surprise.js',
  'mc-sw-update.js',
  'mc-swap-manager.js',
  'mc-sync.js',
  'mc-theme.js',
  'mc-timer.js',
  'mc-vitals.js',
  'mc-voice.js',
  'mc-week-bar.js',
  'mc-workout-engine.js',
  'mc-wrapped.js',
];

const present = execSync('git ls-files "mc-*.js"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean).sort();
const known = new Set(KNOWN_MODULES);
const added = present.filter(f => !known.has(f));
const removed = KNOWN_MODULES.filter(f => present.indexOf(f) === -1);

if (added.length) {
  fail.push('new shared module(s) not in KNOWN_MODULES: ' + added.join(', ') +
    '\n      Decide whether each is USER-FACING. If it is, update quick-tour-data.js' +
    '\n      (and/or quick-tour-overview.html) in this same change — CLAUDE.md\'s' +
    '\n      Documentation currency rule. Then add the filename to KNOWN_MODULES.');
}
if (removed.length) {
  fail.push('module(s) in KNOWN_MODULES no longer in the tree: ' + removed.join(', ') +
    '\n      If a user-facing feature was removed, remove or correct its tour copy' +
    '\n      too rather than leaving stale instructions, then drop it from the list.');
}
note.push(present.length + ' shared modules pinned');

// ---------------------------------------------------------------------------
if (fail.length) {
  console.error('::error::The documentation-currency contract is broken.');
  fail.forEach(f => console.error('  - ' + f));
  process.exit(1);
}
console.log('check-docs-currency: OK — ' + note.join('; '));
