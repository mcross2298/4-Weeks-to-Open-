#!/usr/bin/env python3
"""
add-pwa-meta.py — enforce the PWA / iOS-standalone head meta set across the
user-facing HTML fleet (roadmap Phase L2, findings M1 + M2).

Every page needs, to install and render app-like on iOS/Android:
  1. `viewport-fit=cover` on the viewport meta      → enables env(safe-area-inset-*)
  2. `apple-mobile-web-app-capable`                  → standalone treatment
  3. `apple-mobile-web-app-status-bar-style`         → translucent status bar
  4. `apple-mobile-web-app-title`                    → home-screen name
  5. `<link rel="apple-touch-icon">`                 → real iOS home-screen icon

The canonical block already lives in `index.html`; this script propagates it.
It is **idempotent** — a second run makes zero changes, so it doubles as the
Phase-L2 coverage gate (`--check` exits non-zero if any page is still missing
a tag). It only edits pages that already have a <head> + viewport meta; it
never touches theme-color (left to each page's own light/Sand handling).

Usage:
    python3 tools/add-pwa-meta.py            # sweep all repo-root *.html
    python3 tools/add-pwa-meta.py --check    # report gaps, change nothing
    python3 tools/add-pwa-meta.py a.html b.html   # specific files
"""
import glob
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

APPLE_TAGS = [
    ('apple-mobile-web-app-capable',
     '<meta name="apple-mobile-web-app-capable" content="yes">'),
    ('apple-mobile-web-app-status-bar-style',
     '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'),
    ('apple-mobile-web-app-title',
     '<meta name="apple-mobile-web-app-title" content="MC Training">'),
    ('rel="apple-touch-icon"',
     '<link rel="apple-touch-icon" href="apple-touch-icon.png">'),
]

VIEWPORT_RE = re.compile(
    r'(<meta\s+name=(["\'])viewport\2\s+content=)(["\'])(.*?)\3([^>]*>)',
    re.IGNORECASE,
)


def process(text):
    """Return (new_text, changes[]) for one page. Idempotent."""
    changes = []
    m = VIEWPORT_RE.search(text)
    if not m or '<head' not in text.lower():
        return text, None  # signal: not a sweepable page

    # 1. viewport-fit=cover on the viewport meta
    content_val = m.group(4)
    if 'viewport-fit' not in content_val.lower():
        new_val = content_val.rstrip() + ', viewport-fit=cover'
        new_tag = m.group(1) + m.group(3) + new_val + m.group(3) + m.group(5)
        text = text[:m.start()] + new_tag + text[m.end():]
        changes.append('viewport-fit=cover')
        m = VIEWPORT_RE.search(text)  # re-locate for insertion anchor

    # 2-5. apple standalone metas + touch icon — insert missing ones after viewport
    missing = [tag for marker, tag in APPLE_TAGS if marker not in text]
    if missing:
        indent_match = re.match(r'[ \t]*', text[text.rfind('\n', 0, m.start()) + 1:])
        indent = indent_match.group(0) if indent_match else '  '
        block = ''.join('\n' + indent + tag for tag in missing)
        insert_at = m.end()
        text = text[:insert_at] + block + text[insert_at:]
        changes.append('%d apple tag(s)' % len(missing))

    return text, changes


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    files = ([os.path.join(REPO, a) for a in args]
             if args else sorted(glob.glob(os.path.join(REPO, '*.html'))))

    changed = skipped = gaps = 0
    for path in files:
        with open(path, encoding='utf-8') as f:
            orig = f.read()
        new, changes = process(orig)
        name = os.path.basename(path)
        if changes is None:
            skipped += 1
            continue
        if changes:
            gaps += 1
            if check:
                print('GAP  %-40s needs: %s' % (name, ', '.join(changes)))
            else:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new)
                changed += 1
                print('FIX  %-40s %s' % (name, ', '.join(changes)))

    print('---')
    if check:
        print('%d page(s) still missing meta; %d skipped (no head/viewport)'
              % (gaps, skipped))
        sys.exit(1 if gaps else 0)
    print('%d page(s) updated; %d already complete; %d skipped (no head/viewport)'
          % (changed, len(files) - changed - skipped, skipped))


if __name__ == '__main__':
    main()
