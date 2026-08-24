#!/usr/bin/env python3
"""build-instructions.py — absorb each <id>-instructions.html into its program's
Overview tab (program-flow-roadmap.md, phase F2, decision 10).

WHY GENERATED RATHER THAN FETCHED OR HAND-COPIED
------------------------------------------------
Decision 10 says Overview carries the *entire* body of the guide, not a
summary. Three ways to get it there, and only one survives contact:

  * Hand-copy into each cat page. Two copies of ten guides, drifting the
    moment either is edited. The documentation currency rule exists because
    that has already happened elsewhere in this repo.
  * Fetch <id>-instructions.html at runtime. Elegant -- one source, always
    current -- but MEASURED: the instruction pages are NOT in sw.js's
    precache (the service worker precaches the app shell and caches other
    pages network-first on first visit), so the guide would be missing
    offline for anyone who had not already opened that page. A landing that
    silently loses its content offline is worse than one that links out.
  * Generate a committed artifact from the page, and gate it. That is what
    this does, and it is the pattern this repo already runs for sw.js
    (build-sw.py), the program-card CSS (gen-program-css.py) and the page
    head block (apply-head-contract.py): the source stays the one authored
    file, the artifact is committed so it ships and precaches like anything
    else, and --check fails CI the moment the two disagree.

THE COLLISION THIS EXISTS TO SOLVE
----------------------------------
The ten guides share a class vocabulary -- `card`, `card-body`, `sec`,
`rule-box`, `fav-row`, `rep-card` -- and every one of those names is also
used by the cat-*.html pages for something else entirely. Injecting the
markup raw would inherit the host page's styles and render as garbage.

So the guide's OWN stylesheet comes along with it, rewritten so every
selector is scoped under `.ovi`. That means no per-class re-implementation
(there are 56 classes across five per-program vocabularies -- `anchor-*`,
`arch-*`, `lift-*`, `ratio-*`, `week-*` and more), and a guide that gains a
new class needs no work here at all: regenerate and it is covered.

Run:  python3 tools/build-instructions.py          # write the artifacts
      python3 tools/build-instructions.py --check  # CI gate
"""
import argparse
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Selectors that belong to the standalone page's chrome, not to the guide body.
# They either sit outside .max-w (so nothing would match) or name something the
# host landing also has, where a scoped copy would still be dead weight.
DROP_SELECTORS = {
    '*', 'body', 'html', ':root',
    '.back-link', '.hero', '.hero-inner', '.eyebrow', '.title', '.subtitle',
    '.max-w',
}


def program_ids():
    """The guides that some page actually loads an embed for.

    Deliberately driven by the <script> tags rather than by the set of guide
    pages: not every guide has a converted landing (cat-faint.html still
    predates the F1 tabs), and an embed nothing loads would be a committed,
    precached copy of a page for no reader — the kind of artifact this repo
    has had to go hunting for before. Wire a landing and regenerate and the
    file appears; unwire it and --check reports the orphan.
    """
    wanted = set()
    for path in glob.glob(os.path.join(ROOT, '*.html')):
        src = open(path, encoding='utf-8', errors='ignore').read()
        for pid in re.findall(r'<script src="([a-z0-9]+)-instructions\.gen\.js"', src):
            wanted.add(pid)
    missing = [p for p in sorted(wanted)
               if not os.path.exists(os.path.join(ROOT, '%s-instructions.html' % p))]
    if missing:
        raise SystemExit('no guide page for: ' + ', '.join(missing))
    return sorted(wanted)


def orphans(ids):
    """Generated embeds on disk that no page loads any more."""
    keep = set('%s-instructions.gen.js' % p for p in ids)
    return sorted(os.path.basename(f)
                  for f in glob.glob(os.path.join(ROOT, '*-instructions.gen.js'))
                  if os.path.basename(f) not in keep)


def extract_body(src, path):
    """The inner HTML of <div class="max-w"> — the whole guide, nothing else.

    Depth-matched rather than regex-terminated: every guide nests divs several
    levels deep, so a lazy match to the first </div> would truncate all ten.
    """
    open_tag = '<div class="max-w">'
    i = src.find(open_tag)
    if i < 0:
        raise SystemExit('%s: no <div class="max-w"> to extract' % path)
    j = i + len(open_tag)
    depth = 1
    for m in re.finditer(r'<(/?)div\b', src[j:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return src[j:j + m.start()].strip()
    raise SystemExit('%s: unterminated <div class="max-w">' % path)


def strip_comments(css):
    """Drop /* ... */ before anything reads a selector.

    Not cosmetic. Every guide's stylesheet carries a `/* SAND LIGHT MODE */`
    banner immediately before its light-theme block, and a comment sitting in
    front of a selector is part of that rule's prelude as far as brace-matching
    is concerned. Left in, five of the ten guides produced
    `.ovi /* ... */ html[data-theme="light"] body {...}` — the theme-prefix
    rewrite below never fires (the prelude no longer *starts* with `html[`),
    the `body` drop never fires either, and the result is a dead selector
    instead of a dropped one. Verified against the real pages: no guide has a
    `content:` string containing `/*`, so this is safe to do blind.
    """
    return re.sub(r'/\*.*?\*/', '', css, flags=re.S)


def split_top_level(css):
    """Yield (prelude, block) pairs for top-level rules, keeping @-blocks whole."""
    out, depth, start = [], 0, 0
    for i, ch in enumerate(css):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                chunk = css[start:i + 1]
                head, _, body = chunk.partition('{')
                out.append((head.strip(), body[:-1]))
                start = i + 1
    return out


def scope_selector(sel):
    """`.card` -> `.ovi .card`, and keep a theme prefix in front of the scope.

    html[data-theme="light"] .card must become
    html[data-theme="light"] .ovi .card — putting `.ovi` first would break the
    light-mode rules, which is exactly half of every guide's stylesheet.
    """
    sel = sel.strip()
    if not sel:
        return None
    if sel in DROP_SELECTORS:
        return None
    # A selector whose FIRST simple part is dropped chrome takes the whole
    # selector with it (e.g. `.hero .title`).
    first = re.split(r'[\s>+~]', sel, 1)[0]
    if first in DROP_SELECTORS:
        return None
    m = re.match(r'^(html\[[^\]]+\]\s+)(.*)$', sel)
    if m:
        rest = m.group(2).strip()
        if not rest or rest in DROP_SELECTORS:
            return None
        if re.split(r'[\s>+~]', rest, 1)[0] in DROP_SELECTORS:
            return None
        return m.group(1) + '.ovi ' + rest
    return '.ovi ' + sel


def scope_css(css):
    lines = []
    for head, body in split_top_level(css):
        if head.startswith('@'):
            if head.startswith('@media') or head.startswith('@supports'):
                inner = scope_css(body)
                if inner.strip():
                    lines.append('%s{%s}' % (head, inner))
            else:
                # @keyframes / @font-face carry no selectors to scope.
                lines.append('%s{%s}' % (head, body))
            continue
        sels = [scope_selector(s) for s in head.split(',')]
        sels = [s for s in sels if s]
        if not sels:
            continue
        lines.append('%s{%s}' % (','.join(sels), body.strip()))
    return '\n'.join(lines)


def js_string(s):
    return (s.replace('\\', '\\\\').replace("'", "\\'")
             .replace('\r', '').replace('\n', '\\n')
             .replace('</script', "</scr' + 'ipt"))


def build_one(pid):
    path = os.path.join(ROOT, '%s-instructions.html' % pid)
    src = open(path, encoding='utf-8').read()
    body = extract_body(src, path)
    m = re.search(r'<style>(.*?)</style>', src, re.S)
    css = scope_css(strip_comments(m.group(1))) if m else ''
    return ("/* GENERATED by tools/build-instructions.py from %s-instructions.html\n"
            "   Do not edit. Edit the guide page and regenerate; CI runs --check.\n"
            "   program-flow-roadmap.md F2 -- the guide body, absorbed into the\n"
            "   Overview tab, with its own stylesheet scoped under .ovi so the\n"
            "   shared class names cannot collide with the landing's own. */\n"
            "window.MC_INSTRUCTIONS = { id: '%s', css: '%s', html: '%s' };\n"
            % (pid, pid, js_string(css), js_string(body)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true',
                    help='fail if any generated file is missing or stale')
    args = ap.parse_args()

    ids = program_ids()
    stale, total = [], 0
    for f in orphans(ids):
        if args.check:
            stale.append(f)
        else:
            os.remove(os.path.join(ROOT, f))
            print('  removed %s (no page loads it)' % f)
    for pid in ids:
        want = build_one(pid)
        out = os.path.join(ROOT, '%s-instructions.gen.js' % pid)
        have = open(out, encoding='utf-8').read() if os.path.exists(out) else None
        total += 1
        if args.check:
            if have != want:
                stale.append(os.path.basename(out))
        elif have != want:
            open(out, 'w', encoding='utf-8').write(want)
            print('  wrote %s (%.1f KB)' % (os.path.basename(out), len(want) / 1024))

    if args.check:
        if stale:
            for f in stale:
                print('::error file=%s::stale or orphaned — regenerate with '
                      'python3 tools/build-instructions.py' % f)
            print('\n%d generated guide(s) out of step with the tree.' % len(stale))
            return 1
        print('Instruction embeds OK — %d program guide(s) match their '
              'generated copy.' % total)
    else:
        print('build-instructions: %d program guide(s) up to date.' % total)
    return 0


if __name__ == '__main__':
    sys.exit(main())
