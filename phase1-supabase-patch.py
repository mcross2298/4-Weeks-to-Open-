#!/usr/bin/env python3
"""
Phase 1 rollout patcher.

Injects the Supabase client + biometric modules ahead of the override loader
on every page that already includes program-overrides.js:

  mc-supabase.js  +  mc-biometric.js   BEFORE   program-overrides.js

Idempotent: skips files already patched.
"""
import os

HTML_DIR = os.path.dirname(os.path.abspath(__file__))

ANCHOR = '<script src="program-overrides.js"></script>'
INSERT = ('<script src="mc-supabase.js"></script>\n'
          '<script src="mc-biometric.js"></script>\n'
          '<script src="program-overrides.js"></script>')

patched, skipped = [], []
for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    path = os.path.join(HTML_DIR, fname)
    with open(path, encoding='utf-8') as f:
        src = f.read()
    if 'mc-supabase.js' in src:
        skipped.append(fname)
        continue
    if ANCHOR not in src:
        continue
    out = src.replace(ANCHOR, INSERT, 1)
    if out != src:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(out)
        patched.append(fname)

print(f"Patched : {len(patched)} files")
print(f"Skipped (already patched): {len(skipped)}")
