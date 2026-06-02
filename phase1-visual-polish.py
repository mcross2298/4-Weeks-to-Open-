#!/usr/bin/env python3
"""
Phase 1 — Visual Polish
Applies across all HTML and CSS files in the repo:
  1. Body background → #0a0a0a (app shell standard)
  2. Card surfaces (ex-card, ss-card, badge-card, inline sum-card) → #0f0f0f
  3. Sticky bars (week-tabs, tabs-bar) → #0a0a0a
  4. Category card box-shadows → 0 4px 20px rgba(accent, 0.15)
  5. Typography 9px/10px → 11px everywhere
  6. Timer float CSS → full-width bottom bar
"""

import re
import os
import glob

REPO = os.path.dirname(os.path.abspath(__file__))

# ── 1. body background surface patterns ─────────────────────────────────────
# Matches: body{background:#xxxxxx; OR body { background: #xxxxxx;
# Skips gradient backgrounds (contain 'linear-gradient' or 'radial-gradient')
BODY_BG_RE = re.compile(
    r'(body\s*\{[^}]{0,40}?background\s*:\s*)#(?!0a0a0a)([0-9a-fA-F]{6})\b'
)

# ── 2. card surface patterns ─────────────────────────────────────────────────
EX_CARD_BG_RE  = re.compile(r'(\.ex-card\s*\{[^}]{0,60}?background\s*:\s*)#(?!0f0f0f)([0-9a-fA-F]{6})\b')
SS_CARD_BG_RE  = re.compile(r'(\.ss-card\s*\{[^}]{0,60}?background\s*:\s*)#(?!0f0f0f)([0-9a-fA-F]{6})\b')
BADGE_CARD_RE  = re.compile(r'(\.badge-card\s*\{[^}]{0,60}?background\s*:\s*)#(?!0f0f0f)([0-9a-fA-F]{6})\b')

# Inline style sum-card backgrounds: style="background:#211700;..." → #0f0f0f
INLINE_SUMCARD_RE = re.compile(
    r'(class="sum-card"\s+style="background\s*:\s*)#(?!0f0f0f)([0-9a-fA-F]{6})\b'
)
# Also reverse order: style="background:#..." class="sum-card"
INLINE_SUMCARD_RE2 = re.compile(
    r'(style="background\s*:\s*)#(?!0f0f0f)([0-9a-fA-F]{6})(\b[^"]*"\s+class="[^"]*sum-card[^"]*")'
)

# ── 3. sticky bar backgrounds ────────────────────────────────────────────────
WEEKTABS_BG_RE = re.compile(
    r'(\.week-tabs\s*\{[^}]{0,80}?background\s*:\s*)#(?!0a0a0a)([0-9a-fA-F]{6})\b'
)
TABSBAR_BG_RE = re.compile(
    r'(\.tabs-bar\s*\{[^}]{0,80}?background\s*:\s*)#(?!0a0a0a)([0-9a-fA-F]{6})\b'
)

# ── 4. category card box-shadow standardisation ──────────────────────────────
# Current patterns like: box-shadow:0 8px 28px rgba(212,175,55,0.2)
#                         box-shadow:0 8px 28px rgba(139,92,246,0.25)
# Target:                 box-shadow:0 4px 20px rgba(212,175,55,0.15)
BOXSHADOW_RE = re.compile(
    r'box-shadow\s*:\s*0\s+\d+px\s+\d+px\s+(rgba\([^)]+,\s*)[\d.]+(\))'
)

# ── 5. micro typography (9px → 11px, 10px → 11px) ───────────────────────────
FONTSIZE_9_RE  = re.compile(r'font-size\s*:\s*9px')
FONTSIZE_10_RE = re.compile(r'font-size\s*:\s*10px')

# ── 6. timer-float: full-width bottom bar CSS replacement ────────────────────
TIMER_FLOAT_OLD = re.compile(
    r'\.timer-float\s*\{[^}]+\}',
    re.DOTALL
)
TIMER_FLOAT_NEW = (
    '.timer-float{'
    'position:fixed;bottom:0;left:0;right:0;'
    'width:100%;height:64px;'
    'background:rgba(10,10,10,0.97);backdrop-filter:blur(16px);'
    'display:none;flex-direction:row;align-items:center;justify-content:space-between;'
    'padding:0 20px;gap:12px;'
    'border-top:1px solid rgba(255,255,255,0.1);'
    'box-shadow:0 -4px 24px rgba(0,0,0,0.6);'
    'z-index:100;'
    '}'
)


def apply_card_surface(content):
    content = EX_CARD_BG_RE.sub(r'\g<1>#0f0f0f', content)
    content = SS_CARD_BG_RE.sub(r'\g<1>#0f0f0f', content)
    content = BADGE_CARD_RE.sub(r'\g<1>#0f0f0f', content)
    content = INLINE_SUMCARD_RE.sub(r'\g<1>#0f0f0f', content)
    content = INLINE_SUMCARD_RE2.sub(r'\g<1>#0f0f0f\g<3>', content)
    return content


def apply_boxshadow(content):
    # Only standardise box-shadows that already have rgba accent colour
    # Keep offset at 0 4px 20px and opacity at 0.15
    def _replace(m):
        rgba_start = m.group(1)  # e.g. "rgba(212,175,55,"
        return f'box-shadow:0 4px 20px {rgba_start}0.15{m.group(2)}'
    return BOXSHADOW_RE.sub(_replace, content)


def apply_timer_float(content):
    # Only replace if the timer-float block exists in the file
    if '.timer-float{' not in content and '.timer-float {' not in content:
        return content
    return TIMER_FLOAT_OLD.sub(TIMER_FLOAT_NEW, content)


def process_html(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    original = content

    content = BODY_BG_RE.sub(r'\g<1>#0a0a0a', content)
    content = apply_card_surface(content)
    content = WEEKTABS_BG_RE.sub(r'\g<1>#0a0a0a', content)
    content = TABSBAR_BG_RE.sub(r'\g<1>#0a0a0a', content)
    content = apply_boxshadow(content)
    content = FONTSIZE_9_RE.sub('font-size:11px', content)
    content = FONTSIZE_10_RE.sub('font-size:11px', content)
    content = apply_timer_float(content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


def process_css(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    original = content

    content = apply_card_surface(content)
    content = apply_boxshadow(content)
    content = FONTSIZE_9_RE.sub('font-size:11px', content)
    content = FONTSIZE_10_RE.sub('font-size:11px', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False


if __name__ == '__main__':
    changed_html = []
    changed_css  = []

    for path in sorted(glob.glob(os.path.join(REPO, '*.html'))):
        if process_html(path):
            changed_html.append(os.path.basename(path))

    for path in sorted(glob.glob(os.path.join(REPO, '*.css'))):
        if process_css(path):
            changed_css.append(os.path.basename(path))

    print(f"HTML files modified : {len(changed_html)}")
    print(f"CSS files modified  : {len(changed_css)}")
    if changed_html:
        print("\nHTML changes:")
        for f in changed_html:
            print(f"  {f}")
    if changed_css:
        print("\nCSS changes:")
        for f in changed_css:
            print(f"  {f}")
