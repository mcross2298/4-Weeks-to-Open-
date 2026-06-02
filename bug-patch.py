#!/usr/bin/env python3
"""
Bug Batch (Bug1 / Bug2 / Bug3) patcher.

Bug 1 — TMR.setTime() calls this.stop() first → clears stale activeEl, prevents stuck float
Bug 2 — mc_replacements scoped to page pathname + Option B migration (copy to page, leave global)
Bug 3 — sw.js: Promise.allSettled per-URL caching + bump to mc-training-v34
"""
import os
import re

HTML_DIR = '/home/user/4-Weeks-to-Open-'
counts = {'bug1': 0, 'bug2': 0, 'files': 0}

# ─────────────────────────────────────────────────────────────────────────────
# Bug 1 — add this.stop() as first line of setTime()
# ─────────────────────────────────────────────────────────────────────────────
BUG1_OLD = '  setTime(secs,label){\n    if(this.interval){clearInterval(this.interval);this.interval=null;}'
BUG1_NEW = '  setTime(secs,label){\n    this.stop();\n    if(this.interval){clearInterval(this.interval);this.interval=null;}'

# ─────────────────────────────────────────────────────────────────────────────
# Bug 2 — scope mc_replacements key + Option B migration
# ─────────────────────────────────────────────────────────────────────────────
BUG2_OLD = "  const REPLACE_KEY = 'mc_replacements';"
BUG2_NEW = (
    "  const _PAGE_ID = location.pathname.split('/').pop().split('?')[0];\n"
    "  const REPLACE_KEY = 'mc_replacements|' + _PAGE_ID;\n"
    "  // Option-B migration: copy any existing global entries into this page's scoped key\n"
    "  (function(){\n"
    "    try{\n"
    "      var _old = JSON.parse(localStorage.getItem('mc_replacements')||'{}');\n"
    "      if(Object.keys(_old).length){\n"
    "        var _scoped = JSON.parse(localStorage.getItem(REPLACE_KEY)||'{}');\n"
    "        var _merged = Object.assign({}, _old, _scoped);\n"
    "        localStorage.setItem(REPLACE_KEY, JSON.stringify(_merged));\n"
    "      }\n"
    "    }catch(e){}\n"
    "  }());"
)

def patch_html(path):
    with open(path, encoding='utf-8') as f:
        src = f.read()
    original = src
    changed = False

    # Bug 1
    if BUG1_OLD in src and 'this.stop();\n    if(this.interval)' not in src:
        src = src.replace(BUG1_OLD, BUG1_NEW, 1)
        counts['bug1'] += 1
        changed = True

    # Bug 2
    if BUG2_OLD in src and 'mc_replacements|' not in src:
        src = src.replace(BUG2_OLD, BUG2_NEW, 1)
        counts['bug2'] += 1
        changed = True

    if src != original:
        counts['files'] += 1
        with open(path, 'w', encoding='utf-8') as f:
            f.write(src)
        return True
    return False


changed_files = []
for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    if patch_html(os.path.join(HTML_DIR, fname)):
        changed_files.append(fname)

print(f"HTML files modified : {counts['files']}")
print(f"Bug 1 (setTime stop): {counts['bug1']}")
print(f"Bug 2 (scoped key)  : {counts['bug2']}")
print(f"\nChanged files ({len(changed_files)}):")
for f in changed_files:
    print(' ', f)
