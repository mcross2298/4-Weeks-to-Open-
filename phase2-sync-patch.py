#!/usr/bin/env python3
"""
Phase 2 rollout patcher.

Adds mc-sync.js right after mc-supabase.js on every page that loads the
Supabase client, so the sync engine runs wherever the user is signed in.
Idempotent: skips files already patched.
"""
import os

HTML_DIR = os.path.dirname(os.path.abspath(__file__))

ANCHOR = '<script src="mc-supabase.js"></script>'
INSERT = ANCHOR + '\n<script src="mc-sync.js"></script>'

patched, skipped = [], []
for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    path = os.path.join(HTML_DIR, fname)
    with open(path, encoding='utf-8') as f:
        src = f.read()
    if 'mc-sync.js' in src:
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
