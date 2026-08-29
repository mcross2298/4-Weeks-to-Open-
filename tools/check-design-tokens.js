#!/usr/bin/env node
'use strict';
/* ==========================================================================
   check-design-tokens.js — the design system stays a system
   --------------------------------------------------------------------------
   Why this exists (premium-design-roadmap.md, P0).

   The app's tokens were measured against the real tree before the P1 refit
   and the drift was already substantial:

     * 266 font-weight declarations, 264 of them >= 600. Two at 500, zero at
       400 — the scale's lightest token WAS 600, so there was no light body
       weight anywhere in the product. Uniform boldness is what made the app
       read loud rather than premium, and nothing stopped a 15th shade of
       bold being added.
     * 21 distinct border-radius px literals (1..24 plus 999) with no radius
       token to check a new one against — six of them inside a single
       116-line component file.
     * 28 hardcoded font-size px literals ON TOP OF the 11-step --fs-* scale.
     * 171 distinct hex colors (169 of them literals inside component
       rules rather than token definitions), split across TWO incompatible neutral
       families: a blue Tailwind slate ramp in the dark theme and a warm
       stone/cream ramp in the light one, under a warm gold accent.

   font-weight is a HARD failure: every weight in the tree already sits on
   the declared scale, so the check passes today and fails the moment a new
   off-scale one appears — which is the whole job.

   The other three are RATCHETS that may only go down. 97 of the tree's
   border-radius declarations are off-scale today; failing all 97 on day one
   would mean the gate got disabled, and a disabled gate protects nothing.
   Ratcheting them means the number falls as P1-P3 migrate components and can
   never climb back — the same bargain check-contrast.js and
   check-visual-ratchet.js make.

   This is a SOURCE check, for the same reason check-topbar-inset.js and
   check-journey.js's safe-area pass are: a weight of 700 where 400 was meant
   renders perfectly, throws nothing, and looks deliberate in review. The
   only place it is visible is the source.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UPDATE = process.argv.includes('--update');

/* The declared scales. A value outside these is drift, not a contribution. */
const WEIGHTS = new Set([400, 500, 600, 700, 800, 900]);
/* Radii that map onto a --r-* token. `inherit`/`50%`/`999px` are shapes, not
   steps, and are allowed as literals. */
const RADII = new Set([4, 8, 12, 16, 24]);

/* ── cool dark neutrals ────────────────────────────────────────────────────
   A dark value whose BLUE channel exceeds its RED is either a deliberate hue
   or a cool neutral that does not belong under this app's warm gold accent.
   The P3 sweep could not find the two on the exercise card because it looked
   for the Tailwind SLATE FAMILY BY NAME, and #0d0f12 / #0a0b0d are bespoke
   near-blacks nobody ever named — they were never in the query. Nothing else
   in CI could see them either: check-contrast.js is a LIGHT-mode ratchet, so
   dark-mode colour is unmeasured end to end.

   So the test is a property of the VALUE, not of its name: dark enough to
   read as a surface, with a blue bias past the rounding noise. Everything it
   returns is then one of two things, and each gets its own list. */

/* Perceptual weight on the 0-255 scale, and the bias past which a value has
   stopped being neutral. b-r of 1 is rounding (#101011, #0f0f10, #0a0a0b) —
   2 is the first bias visible against a true-black ground. */
const COOL_LUM_MAX  = 60;
const COOL_BIAS_MIN = 2;

/* HUES doing a job. These are the app's structural grammar — the colour an
   athlete reads mid-set to tell a superset from a drop set — plus the dark
   foregrounds that sit ON those hues. They are cool because they are blue,
   green and violet, which is the point of them. Permanent. */
const COOL_SEMANTIC = new Map([
  ['#04120c', 'checked-card ground (green)'],
  ['#061a0d', 'checked-card ground (green)'],
  ['#06281d', 'success ground (green)'],
  ['#062c20', 'success ground (green)'],
  ['#08130a', 'success ground (green)'],
  ['#0a2e22', 'success ground (green)'],
  ['#04222a', 'foreground ON the cyan cluster hue #22d3ee'],
  ['#0a0810', 'superset-card ground (violet)'],
  ['#100c16', 'superset-card ground (violet)'],
]);

/* NEUTRALS that are still cool, each with the reason it has not been mapped
   onto the ink ramp yet. This list may only SHRINK. Adding to it is a
   deliberate act that has to survive review — which is the difference
   between this and a count-based ratchet, where swapping one offender for a
   different one passes silently. */
const COOL_PENDING = new Map([
  ['#2d3748', '.sl-inp::placeholder / .sl-hl (base.css) — a Tailwind slate on ' +
              'a near-black ground at roughly 1.5:1. That is a LEGIBILITY ' +
              'defect, not a warmth one: remapping it onto the ramp at equal ' +
              'luminance would keep it invisible. It needs a readable value ' +
              'chosen for it, which is its own change.'],
]);

/* Files where a literal is the point rather than drift. */
const EXEMPT = new Set([]);

const RATCHET = path.join(__dirname, 'design-token-budgets.json');

/* ── collect ───────────────────────────────────────────────────────────── */
const files = execSync('git ls-files "*.css"', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter(Boolean).filter(f => !EXEMPT.has(f));

const fail = [];
const counts = { fontSizePx: 0, hex: new Set(), weights: 0, radii: 0, offScaleRadii: 0 };
const offScaleSample = [];

/* Strip comments so a documented example never counts as a declaration.
   Blanked to same-length whitespace rather than removed, so byte offsets —
   and therefore every `file:line` this tool reports — still point at the real
   source. Deleting the text shifted them: a rule on line 428 was reported as
   252, which sends the reader to the wrong place in the file. */
const decomment = s =>
  s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));

for (const f of files) {
  const src = decomment(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const lineOf = idx => src.slice(0, idx).split('\n').length;

  /* 0. A comment closed by a token glob. A token name ending in an asterisk,
        written directly against a slash, forms a comment TERMINATOR — so the
        rest of the prose is parsed as CSS and swallows whatever rule follows
        it. Nothing throws; the browser silently drops the rule.
        (This very comment originally spelled that terminator out as a literal
        and closed itself twenty lines early, in JavaScript this time. The
        trap is not CSS-specific: it is every C-style comment there is.)

        Both known instances were real. P2 introduced one in mc-program-hero.css
        that deleted the entire .pl-hero token-alias rule — every landing
        rendered with a 16px title and an unstyled CTA. The sweep for it then
        found a PRE-EXISTING one in mc-light.css that had been eating
        `html[data-theme="light"] .mcl-toggle{...}`, confirmed absent from
        document.styleSheets, so the Log Sets toggle kept its dark colour on the
        cream ground — the exact bug that rule was written to fix.

        Read on the raw source, before comments are stripped. */
  {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    let i = 0;
    while (true) {
      const a = raw.indexOf('/*', i);
      if (a < 0) break;
      const b = raw.indexOf('*/', a + 2);
      if (b < 0) break;
      if (raw.slice(b - 1, b + 2) === '-*/') {
        fail.push(`${f}:${raw.slice(0, b).split('\n').length} — this comment is ` +
          `closed by a token glob: a name ending in an asterisk sits directly ` +
          `against the closing slash. That pair IS a comment terminator, so ` +
          `the rest of the comment is parsed as CSS and the next rule is ` +
          `silently dropped.\n    Separate the glob from the slash with a ` +
          `space, or rewrite the sentence without the slash.`);
      }
      i = b + 2;
    }
  }

  /* 1. font-weight — hard fail outside the scale */
  for (const m of src.matchAll(/font-weight:\s*(\d{3})/g)) {
    counts.weights++;
    const w = Number(m[1]);
    if (!WEIGHTS.has(w)) {
      fail.push(`${f}:${lineOf(m.index)} — font-weight:${w} is outside the ` +
                `declared scale (${[...WEIGHTS].join('/')}).`);
    }
  }

  /* 2. border-radius — hard fail on a px literal that has a --r-* token.
        Multi-value shorthands (`12px 12px 0 0`) are shape, not step. */
  for (const m of src.matchAll(/border-radius:\s*([^;}]+)/g)) {
    const val = m[1].trim();
    if (val.includes('var(')) continue;
    const px = val.match(/[\d.]+px/g) || [];
    if (px.length !== 1) continue;            // shorthand / shape
    counts.radii++;
    const n = parseFloat(px[0]);
    if (n >= 999 || n === 0) continue;         // pill / square
    if (RADII.has(n)) continue;
    counts.offScaleRadii++;
    offScaleSample.push(`${f}:${lineOf(m.index)} border-radius:${px[0]}`);
  }

  /* 3+4. ratcheted: hardcoded sizes and distinct hexes */
  counts.fontSizePx += (src.match(/font-size:\s*[\d.]+px/g) || []).length;
  /* Hexes are counted only where they are LITERALS IN COMPONENT RULES, not
     where they define a custom property. A `--ink-4:#2a2724;` declaration is
     the cure for scattered colour; a `color:#2a2724` buried in a rule is the
     disease. Counting both made the ratchet fire on the very change that
     centralises colour, which would have taught the next person that the way
     past this gate is to re-baseline it. */
  for (const line of src.split('\n')) {
    if (/^\s*--[\w-]+\s*:/.test(line)) continue;   // token definition
    for (const h of line.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []) {
      counts.hex.add(h.toLowerCase());
    }
  }

  /* 5. cool dark neutrals — hard fail outside the two declared lists.
        Token DEFINITIONS are scanned too, unlike the hex ratchet above: a new
        blue step added to the ink ramp itself is the worst version of this
        drift, not an exemption from it. */
  for (const m of src.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const hex = ('#' + m[1]).toLowerCase();
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum >= COOL_LUM_MAX || b - r < COOL_BIAS_MIN) continue;
    if (COOL_SEMANTIC.has(hex)) continue;
    if (COOL_PENDING.has(hex)) continue;
    fail.push(`${f}:${lineOf(m.index)} — ${hex} is a COOL DARK NEUTRAL ` +
      `(r${r} g${g} b${b}, blue leads red by ${b - r}) under a warm gold ` +
      `accent, on a warm ink ramp.\n    Map it onto --ink-0..--ink-11, or ` +
      `— if it is a hue doing a job — name it in COOL_SEMANTIC at the top of ` +
      `this file with the job it does.`);
  }
}

const now = {
  fontSizePx: counts.fontSizePx,
  distinctHex: counts.hex.size,
  offScaleRadii: counts.offScaleRadii,
};

/* ── ratchet ───────────────────────────────────────────────────────────── */
if (UPDATE) {
  fs.writeFileSync(RATCHET, JSON.stringify(now, null, 2) + '\n');
  console.log('check-design-tokens: ratchet updated →', JSON.stringify(now));
  process.exit(0);
}

if (fs.existsSync(RATCHET)) {
  const budget = JSON.parse(fs.readFileSync(RATCHET, 'utf8'));
  for (const k of Object.keys(now)) {
    if (now[k] > budget[k]) {
      fail.push(`ratchet ${k}: ${now[k]} > budget ${budget[k]}. This number ` +
                `may only go down.\n    Re-baseline deliberately with ` +
                `\`node tools/check-design-tokens.js --update\` if the ` +
                `increase is intended.`);
    }
  }
} else {
  console.warn('check-design-tokens: no ratchet file — run with --update to seed.');
}

/* ── report ────────────────────────────────────────────────────────────── */
if (fail.length) {
  console.error(`check-design-tokens: FAIL (${fail.length})\n`);
  fail.slice(0, 40).forEach(f => console.error('  * ' + f + '\n'));
  if (fail.length > 40) console.error(`  ...and ${fail.length - 40} more.\n`);
  process.exit(1);
}
console.log(`check-design-tokens: OK — ${counts.weights} font-weight and ` +
            `${counts.radii} single-value border-radius declarations across ` +
            `${files.length} stylesheets are on-scale; ` +
            `${now.fontSizePx} px font-sizes / ${now.distinctHex} distinct ` +
            `hexes within ratchet; every cool dark value is either a declared ` +
            `hue (${COOL_SEMANTIC.size}) or a named pending neutral ` +
            `(${COOL_PENDING.size}).`);
