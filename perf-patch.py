#!/usr/bin/env python3
"""
Performance Batch (P1-P4) patcher.

P1 — Timer 500ms → 1000ms  (TMR.start and TMR.setTime intervals)
P2 — Remove setInterval(updateProgress,10000) polling
P3 — Remove dead duplicate CSS setlog block (collapsed by default … WAVE3-SETLOG)
P4 — Prune mc_setlog_v1 to 5 sessions (mc-setlog.js only)
"""
import os
import re

HTML_DIR = '/home/user/4-Weeks-to-Open-'

# ── counters ──────────────────────────────────────────────────────────────────
counts = {'p1_start': 0, 'p1_settime': 0, 'p2': 0, 'p3': 0, 'files': 0}

# ── P3 regex — remove block from "collapsed by default" up to WAVE3-SETLOG ──
# Captures everything between the two markers (inclusive of leading newline).
P3_RE = re.compile(
    r'\n/\* ── WEIGHT NOTES ── \*/\n/\* collapsed by default \*/.*?(?=\n/\* — WAVE3-SETLOG — \*/)',
    re.DOTALL
)

# Alternate form: some pages omit the WEIGHT NOTES comment; target the block
# starting with the standalone "collapsed by default" comment.
P3_RE_ALT = re.compile(
    r'\n/\* collapsed by default \*/.*?(?=\n/\* — WAVE3-SETLOG — \*/)',
    re.DOTALL
)

def patch_html(path):
    with open(path, encoding='utf-8') as f:
        src = f.read()

    original = src

    # P1a — TMR.start() setInterval — spaced closing:  "    }, 500);"
    # This line only appears as the closing of the 500ms timer tick callback.
    new_src, n = re.subn(r'(    \}, )500(\);)', r'\g<1>1000\2', src)
    counts['p1_start'] += n
    src = new_src

    # P1b — TMR.setTime() setInterval — minified closing: "    },500);"
    new_src, n = re.subn(r'(    \},)500(\);)', r'\g<1>1000\2', src)
    counts['p1_settime'] += n
    src = new_src

    # P2 — remove the polling setInterval line (with optional preceding comment)
    new_src, n = re.subn(
        r'    // Update every 10s for dynamic pages\n    setInterval\(updateProgress,10000\);\n',
        '',
        src
    )
    counts['p2'] += n
    src = new_src
    # Fallback: line without the comment
    new_src, n = re.subn(
        r'    setInterval\(updateProgress,10000\);\n',
        '',
        src
    )
    counts['p2'] += n
    src = new_src

    # P3 — remove dead first-block setlog CSS
    new_src, n = P3_RE.subn('', src)
    if n == 0:
        new_src, n = P3_RE_ALT.subn('', src)
    counts['p3'] += n
    src = new_src

    if src != original:
        counts['files'] += 1
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
        return True
    return False


changed = []
for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    fpath = os.path.join(HTML_DIR, fname)
    if patch_html(fpath):
        changed.append(fname)

print(f"Files modified : {counts['files']}")
print(f"P1 start fixes : {counts['p1_start']}")
print(f"P1 settime fixes: {counts['p1_settime']}")
print(f"P2 poll removed: {counts['p2']}")
print(f"P3 CSS cleaned : {counts['p3']}")
print(f"\nChanged files ({len(changed)}):")
for f in changed:
    print(' ', f)
