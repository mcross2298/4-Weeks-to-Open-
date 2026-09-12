#!/usr/bin/env node
/* ==========================================================================
   tools/check-dangling-refs.js — reach for nothing, fail the build
   --------------------------------------------------------------------------
   THE SHAPE THIS GATE EXISTS FOR. Three separate passes over this tree have
   each found a fresh instance of one defect:

     Phase 4.5   #pushChip      — the notification chip's CSS, its guard chain
                                  and its global handler all existed; the
                                  ELEMENT was authored nowhere, so
                                  getElementById returned null on every load
                                  and `if (chip)` swallowed it. The app had
                                  never once asked for notification permission.
     Phase 5.3   MC_TOAST       — the full-storage warning called MC_TOAST
                                  behind `if (window.MC_TOAST)`. No such
                                  function exists in the tree. The warning had
                                  never once been shown.
     V-02/07/08  loadWrapped()  — six element ids authored nowhere; MCSwap,
                                  a global assigned nowhere driving six call
                                  sites; one dead id read in mc-summary.js.

   Every one of them is code reaching for a thing that does not exist, behind
   a guard or an empty catch, so nothing ever throws where a person can see
   it. The feature is not broken — it is silently ABSENT, which reads exactly
   like working code in review and produces a clean console.

   NO EXISTING GATE CAN SEE IT. check-single-impl.js catches a second
   DECLARATION, not a reference to nothing. check-script-manifest.py catches a
   page loading the wrong modules, not a symbol missing from the ones it
   loads. smoke-test-pages.js counts console errors, and the guard's whole
   function is that there is no error to count.

   PASS A — element ids. Every literal getElementById('x') / querySelector('#x')
   must have some author of id "x" somewhere in the tree: a literal id=
   attribute, an el.id / setAttribute('id', ...) assignment, or a COMPOSED
   author — `id="log-' + st.key + '"` authors the prefix "log-", so a read of
   'log-su' is satisfied. That last case is not a convenience: boxing-routine
   builds every one of its inputs that way, and a gate without it reports two
   live, working ids as dangling.

   PASS B — globals. Every window.X read must have an assignment somewhere,
   unless X is a platform API, assigned outside this tree, or a DOCUMENTED
   page hook whose unset case is the designed default. Those three lists are
   explicit and named, for the reason check-design-tokens.js gives for its
   own: a count ratchet would let a DIFFERENT dangling global be swapped in
   for one already there and still pass.

   COMMENTS ARE STRIPPED FIRST, and that is load-bearing: MC_TOAST survives in
   this tree only inside the comment that records its removal, and a gate that
   counted it would report a defect that was already fixed. The stripper is
   verified rather than trusted — see selfTest() below, which re-parses every
   stripped .js file and fails the run if stripping broke one.

   Usage:  node tools/check-dangling-refs.js          # the gate
           node tools/check-dangling-refs.js --list   # everything it found
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* ── Host globals ─────────────────────────────────────────────────────────
   Browser and platform APIs. Read through `window.` on purpose, because that
   is how you feature-detect one without a ReferenceError. Each is a real
   platform symbol, not a thing this repo was supposed to build. */
const HOST_GLOBALS = new Set([
  // feature detection of optional platform APIs
  'AudioContext', 'webkitAudioContext',       // the conditioning timers' beeps
  'SpeechRecognition', 'webkitSpeechRecognition', // mc-voice.js
  'PublicKeyCredential',                      // mc-biometric.js (Face ID)
  'BarcodeDetector',                          // mc-barcode.js native path
  'Worker',                                   // supabase-vendor.js
  'ethereum', 'solana',                       // wallet probes in the vendor bundle
  // always-present window members, read qualified for clarity or in a guard
  'addEventListener', 'removeEventListener', 'matchMedia', 'navigator',
  'confirm', 'innerWidth', 'innerHeight', 'scrollX', 'scrollY',
  'scrollTo', 'scrollBy',
]);

/* ── Foreign globals ──────────────────────────────────────────────────────
   Assigned outside this tree — the other repo, or a CDN script — and read
   here by design, so no assignment can ever appear in this repository. */
const FOREIGN_GLOBALS = new Map([
  ['RECIPES', 'Mike\'s Cookbook\'s recipe data — read by the same-origin bridge (mc-bridge.js), never assigned here'],
  ['ZXing', 'the barcode-decoder library, loaded from a CDN by mc-barcode.js at scan time'],
]);

/* ── Optional page hooks ──────────────────────────────────────────────────
   A DIFFERENT thing from a dangling reference, and the distinction is the
   whole point of this gate: a hook is a documented extension point whose
   absent case is the designed default, so no page setting it today is the
   expected state — not a feature that silently went missing. Each entry names
   the module that documents it and what happens when it is unset. An entry
   whose "when unset" is "nothing happens" does not belong here; that is the
   defect this gate is for. */
const OPTIONAL_HOOKS = new Map([
  ['MC_WEEK', 'program-overrides.js — a page may declare its current week; unset falls back to the ?w=N query parameter'],
  ['MC_TEMPO_OPTIONS', 'mc-card-actions.js — a page may replace the Add Tempo menu; unset uses the module\'s own eight-entry default'],
]);

/* ── Ids authored outside this tree ───────────────────────────────────────
   Same idea as FOREIGN_GLOBALS, for elements. Empty today; kept so the next
   real case is recorded with its reason rather than silencing the pass. */
const FOREIGN_IDS = new Map([]);

/* ── comment stripping ────────────────────────────────────────────────────
   A character walk, not a regex. It tracks string, template and REGEX-literal
   state, because this tree really does contain /'/ and /["']/ inside
   .replace() calls (mc-timer.js's apostrophe escaping), and a stripper that
   mistook the quote inside a regex literal for the start of a string would
   run off the end of the file swallowing real code.

   A '/' opens a regex literal only where an expression cannot already have
   ended. Punctuation is the easy half; the other half is a KEYWORD, because
   `return/re/.test(x)` is regex and `n/re/` is division, and the character
   before the slash is a letter in both. */
const REGEX_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'case', 'do', 'else', 'yield', 'await', 'throw',
]);

function stripJsComments(src) {
  let out = '';
  let i = 0;
  let prevSig = '';                       // last significant char emitted
  let prevWord = '';                      // last identifier/keyword emitted
  const PUNCT_BEFORE_REGEX = '(,=:[!&|?{};+-*%~^<>';

  /* A template literal is not a flat string: `${ ... }` re-enters real code,
     which may contain another template. A single "consume to the next
     backtick" pass closes the OUTER template on the FIRST inner one and then
     reads the rest of the file in the wrong state — which is exactly how the
     first version of this walker ate 16KB of the vendored Supabase bundle and
     reported a syntax error. So contexts are a stack. */
  const stack = [{ kind: 'code', braces: 0 }];
  const top = () => stack[stack.length - 1];

  while (i < src.length) {
    if (top().kind === 'tmpl') {
      if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
      if (src[i] === '`') { out += '`'; i++; stack.pop(); prevSig = '`'; prevWord = ''; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        out += '${'; i += 2; stack.push({ kind: 'code', braces: 0 });
        prevSig = '{'; prevWord = ''; continue;
      }
      out += src[i]; i++; continue;
    }

    const c = src[i], d = src[i + 1];

    if (c === '/' && d === '/') {         // line comment
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {         // block comment
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n'; // keep line numbers honest
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {         // string
      out += c; i++;
      while (i < src.length) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === c) { i++; break; }
        i++;
      }
      prevSig = c; prevWord = '';
      continue;
    }
    if (c === '`') { out += c; i++; stack.push({ kind: 'tmpl' }); continue; }
    if (c === '{') { top().braces++; out += c; prevSig = c; prevWord = ''; i++; continue; }
    if (c === '}') {
      if (top().braces === 0 && stack.length > 1) {   // closes a ${ … }
        out += c; i++; stack.pop(); prevSig = '}'; prevWord = '';
        continue;
      }
      if (top().braces > 0) top().braces--;
      out += c; prevSig = c; prevWord = ''; i++;
      continue;
    }
    if (c === '/' && (PUNCT_BEFORE_REGEX.indexOf(prevSig) !== -1 || prevSig === '' ||
                      REGEX_KEYWORDS.has(prevWord))) {
      let j = i + 1, inClass = false, closed = false;
      while (j < src.length) {
        const e = src[j];
        if (e === '\\') { j += 2; continue; }
        if (e === '\n') break;                   // unterminated — not a regex
        if (e === '[') inClass = true;
        else if (e === ']') inClass = false;
        else if (e === '/' && !inClass) { closed = true; j++; break; }
        j++;
      }
      if (closed) {
        while (j < src.length && /[a-z]/.test(src[j])) j++;   // flags
        out += src.slice(i, j); i = j; prevSig = '/'; prevWord = '';
        continue;
      }
    }

    out += c;
    if (!/\s/.test(c)) prevSig = c;
    if (/[A-Za-z_$]/.test(c)) prevWord = /[\w$]/.test(src[i - 1] || '') ? prevWord + c : c;
    else if (!/[\w$]/.test(c)) prevWord = '';
    i++;
  }
  return out;
}

function stripHtmlComments(src) {
  // Blank the body, keep the newlines, so reported line numbers stay right.
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

/* An .html file is markup plus <script> bodies. Strip HTML comments from the
   whole thing, then JS comments from each script body only — running the JS
   stripper over markup would treat an unquoted attribute's '/' as a regex. */
function decomment(file, src) {
  if (file.endsWith('.js')) return stripJsComments(src);
  let s = stripHtmlComments(src);
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let out = '', last = 0, m;
  while ((m = re.exec(s))) {
    const bodyStart = m.index + m[0].indexOf('>') + 1;
    out += s.slice(last, bodyStart) + stripJsComments(m[1]);
    last = bodyStart + m[1].length;
  }
  return out + s.slice(last);
}

/* ── the scan ─────────────────────────────────────────────────────────── */

const ID_AUTHOR = [
  /\bid\s*=\s*(?:\\?["'])([A-Za-z_][\w:.-]*)/g,                  // markup, and markup inside a JS string
  /(?:\.id\s*=\s*|setAttribute\(\s*['"]id['"]\s*,\s*)['"`]([A-Za-z_][\w:.-]*)['"`]/g,
];
/* `id="log-' + key + '"` / `id="log-${key}"` — authors every id with that
   prefix, so record the prefix. Two chars minimum with a trailing separator,
   or four without, so a one-character stub cannot blanket the tree. */
const ID_PREFIX = /\bid\s*=\s*(?:\\?["'`])([A-Za-z_][\w:.-]*)(?:\$\{|'\s*\+|"\s*\+|\\"\s*\+|`\s*\+)/g;
const ID_READ = [
  /getElementById\(\s*['"]([A-Za-z_][\w:.-]*)['"]\s*\)/g,
  /querySelector(?:All)?\(\s*['"]#([A-Za-z_][\w:.-]*)['"]\s*\)/g,
];

const G_ASSIGN = [
  /window\.([A-Za-z_$][\w$]*)\s*=(?!=)/g,
  /window\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]\s*=/g,
  /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g,
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
  /\bclass\s+([A-Za-z_$][\w$]*)\b/g,
];
const G_READ = /window\.([A-Za-z_$][\w$]*)/g;

function trackedFiles() {
  return execSync("git ls-files '*.js' '*.html'", { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
}

function lineOf(src, index) { return src.slice(0, index).split('\n').length; }

/* Vendored third-party bundles. Their EXPORTS are real — app code reads them
   through window. — but their internals are not this repo's contract, and
   policing them would mean allowlisting a wallet probe and a Worker feature
   detection that belong to somebody else's code. So a vendored file
   contributes assignments and never reads. */
function isVendored(file, raw) {
  return /(^|\/)[\w.-]*vendor[\w.-]*\.js$/i.test(file) ||
         raw.slice(0, 400).includes('Vendored third-party');
}

function scan() {
  const files = trackedFiles();
  const ids = { authored: new Set(), prefixes: new Set(), read: new Map() };
  const globals = { assigned: new Set(), read: new Map() };
  const stripped = new Map();
  const vendored = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (isVendored(f, raw)) {
      vendored.push(f);
      // raw, not stripped: an extra assignment picked up out of a license
      // header can only make this gate more permissive, never less.
      for (const re of G_ASSIGN) { re.lastIndex = 0; let v; while ((v = re.exec(raw))) globals.assigned.add(v[1]); }
      for (const re of ID_AUTHOR) { re.lastIndex = 0; let v; while ((v = re.exec(raw))) ids.authored.add(v[1]); }
      continue;
    }
    const src = decomment(f, raw);
    stripped.set(f, src);
    let m;

    for (const re of ID_AUTHOR) { re.lastIndex = 0; while ((m = re.exec(src))) ids.authored.add(m[1]); }
    ID_PREFIX.lastIndex = 0;
    while ((m = ID_PREFIX.exec(src))) {
      const p = m[1];
      if (/[-_]$/.test(p) ? p.length >= 2 : p.length >= 4) ids.prefixes.add(p);
    }
    for (const re of ID_READ) {
      re.lastIndex = 0;
      while ((m = re.exec(src))) {
        if (!ids.read.has(m[1])) ids.read.set(m[1], []);
        ids.read.get(m[1]).push(`${f}:${lineOf(src, m.index)}`);
      }
    }

    for (const re of G_ASSIGN) { re.lastIndex = 0; while ((m = re.exec(src))) globals.assigned.add(m[1]); }
    G_READ.lastIndex = 0;
    while ((m = G_READ.exec(src))) {
      if (!globals.read.has(m[1])) globals.read.set(m[1], []);
      globals.read.get(m[1]).push(`${f}:${lineOf(src, m.index)}`);
    }
  }
  return { files, ids, globals, stripped, vendored };
}

/* ── self-test ────────────────────────────────────────────────────────────
   A comment stripper that ate a string literal would silence this gate
   wholesale and look like a clean run. So every stripped .js file is re-parsed
   here; if stripping broke one, the run fails as a TOOL fault, named as such,
   rather than reporting the tree clean. */
function selfTest(stripped) {
  const broken = [];
  for (const [f, src] of stripped) {
    if (!f.endsWith('.js')) continue;
    try { new vm.Script(src, { filename: f }); }
    catch (e) { broken.push(`${f}: ${e.message}`); }
  }
  return broken;
}

/* ── report ───────────────────────────────────────────────────────────── */

function main() {
  const list = process.argv.includes('--list');
  const { files, ids, globals, stripped, vendored } = scan();

  const broken = selfTest(stripped);
  if (broken.length) {
    console.error('check-dangling-refs: TOOL FAULT — comment stripping broke these files:');
    broken.forEach((b) => console.error('  ' + b));
    console.error('\nThe scan below would be unreliable, so nothing is reported clean.');
    process.exit(2);
  }

  const prefixes = [...ids.prefixes];
  const danglingIds = [...ids.read.keys()].filter((k) =>
    !ids.authored.has(k) &&
    !FOREIGN_IDS.has(k) &&
    !prefixes.some((p) => k !== p && k.startsWith(p))
  ).sort();

  const danglingGlobals = [...globals.read.keys()].filter((k) =>
    !globals.assigned.has(k) &&
    !HOST_GLOBALS.has(k) &&
    !FOREIGN_GLOBALS.has(k) &&
    !OPTIONAL_HOOKS.has(k)
  ).sort();

  if (list) {
    console.log(`scanned ${files.length} files (${vendored.length} vendored: assignments only — ${vendored.join(', ') || 'none'})`);
    console.log(`ids: ${ids.authored.size} authored, ${prefixes.length} composed prefixes, ${ids.read.size} read`);
    console.log(`globals: ${globals.assigned.size} assigned, ${globals.read.size} read through window.`);
    console.log('composed id prefixes: ' + prefixes.sort().join(' '));
  }

  let fail = false;

  if (danglingIds.length) {
    fail = true;
    console.error(`\ncheck-dangling-refs: ${danglingIds.length} element id(s) read but authored nowhere\n`);
    for (const id of danglingIds) {
      console.error(`  #${id}`);
      ids.read.get(id).forEach((site) => console.error(`      read at ${site}`));
    }
    console.error(`
  Nothing authors these ids, so every read returns null. If a guard follows,
  the feature is silently absent (Phase 4.5's #pushChip); if none does, the
  page throws where an empty catch will eat it (V-02). Author the element, or
  delete the code that reaches for it.`);
  }

  if (danglingGlobals.length) {
    fail = true;
    console.error(`\ncheck-dangling-refs: ${danglingGlobals.length} global(s) read but assigned nowhere\n`);
    for (const g of danglingGlobals) {
      console.error(`  window.${g}`);
      globals.read.get(g).forEach((site) => console.error(`      read at ${site}`));
    }
    console.error(`
  Nothing assigns these, so \`if (window.X)\` is always false and the branch
  behind it is dead (Phase 5.3's MC_TOAST, V-07's MCSwap). Build it, load the
  module that provides it, or delete the branch. A real platform API belongs
  in HOST_GLOBALS, a genuinely external one in FOREIGN_GLOBALS, and a
  DOCUMENTED page hook whose unset case is the designed default in
  OPTIONAL_HOOKS — each with the reason written next to it.`);
  }

  if (fail) process.exit(1);
  console.log(`check-dangling-refs: OK — ${ids.read.size} element ids and ${globals.read.size} globals all resolve (${files.length} files)`);
}

main();
