#!/usr/bin/env python3
"""
Program Manager rollout patcher.

Wires the permanent-override layer into every page that renders exercise
cards (identified by the mc-card-actions.js include):

  • program-overrides.js  BEFORE mc-card-actions.js   (loader — all users)
  • program-manager.js    AFTER  mc-card-actions.js   (owner UI, passcode-gated)

Also adds program-manager.js to dashboard.html (long-press unlock entry point).
Idempotent: skips files already patched.
"""
import os

HTML_DIR = os.path.dirname(os.path.abspath(__file__))

OLD = '<script src="mc-card-actions.js"></script>'
NEW = ('<script src="program-overrides.js"></script>\n'
       '<script src="mc-card-actions.js"></script>\n'
       '<script src="program-manager.js"></script>')

DASH_OLD = '<script src="mc-sw-update.js?v=45"></script>'
DASH_NEW = ('<script src="program-overrides.js"></script>\n'
            '<script src="program-manager.js"></script>\n'
            '<script src="mc-sw-update.js?v=45"></script>')

patched, skipped = [], []
for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    path = os.path.join(HTML_DIR, fname)
    with open(path, encoding='utf-8') as f:
        src = f.read()
    if 'program-overrides.js' in src:
        skipped.append(fname)
        continue
    out = src
    if fname == 'dashboard.html':
        if DASH_OLD in out:
            out = out.replace(DASH_OLD, DASH_NEW, 1)
    elif OLD in out:
        out = out.replace(OLD, NEW, 1)
    if out != src:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(out)
        patched.append(fname)

print(f"Patched : {len(patched)} files")
print(f"Skipped (already patched): {len(skipped)}")
for f in patched:
    print(' ', f)
