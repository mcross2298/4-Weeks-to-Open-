#!/usr/bin/env python3
"""
Phase 2 — Global base.css Extraction
For every HTML page:
  1. Injects <link rel="stylesheet" href="base.css"> before existing CSS links
  2. For workout pages (those with .ex-card in their inline style):
     - Extracts accent color, accent-rgb, header gradient, inactive tab color
     - Replaces the full inline <style> block with a minimal ~5-line token override
  3. For non-workout pages: adds base.css link only (leaves inline styles intact)
"""

import re
import os
import glob

REPO = os.path.dirname(os.path.abspath(__file__))

# ── Helpers ────────────────────────────────────────────────────────────────

def hex_to_rgb(h):
    h = h.lstrip('#')
    r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    return f"{r},{g},{b}"

def extract_accent(style_block):
    """Return (#hex, 'r,g,b') from .eyebrow{color:#xxxxxx} or .back-link{color:#xxxxxx}"""
    m = re.search(r'\.eyebrow\{[^}]*color\s*:\s*(#[0-9a-fA-F]{6})', style_block)
    if not m:
        m = re.search(r'\.back-link\{[^}]*color\s*:\s*(#[0-9a-fA-F]{6})', style_block)
    if not m:
        return None, None
    hex_val = m.group(1)
    return hex_val, hex_to_rgb(hex_val)

def extract_header_gradient(style_block):
    """Return full gradient value string from .header{background:linear-gradient(...)}"""
    m = re.search(
        r'\.header\{[^}]*background\s*:\s*(linear-gradient\([^;)]+\))',
        style_block
    )
    return m.group(1) if m else None

def extract_wtab_color(style_block):
    """Return inactive .wtab color (the dark muted tone unique per theme)"""
    # Look for .wtab{color:#xxxxxx} that is NOT .wtab.active
    m = re.search(r'(?<!\.active)\.wtab\{color\s*:\s*(#[0-9a-fA-F]{6})', style_block)
    return m.group(1) if m else None

def extract_week_tabs_border(style_block):
    """Return border-bottom from .week-tabs override block, if present"""
    m = re.search(r'\.week-tabs\{[^}]*border-bottom\s*:\s*([^;}]+)', style_block)
    return m.group(1).strip() if m else None

def is_workout_page(style_block):
    """True if page has .ex-card structural CSS (workout detail pages)"""
    return '.ex-card{' in style_block or '.ex-card {' in style_block

def build_minimal_style(accent_hex, accent_rgb, header_gradient, wtab_color, week_tabs_border):
    lines = []
    if accent_hex:
        lines.append(f':root{{--accent:{accent_hex};--accent-rgb:{accent_rgb};}}')
    if header_gradient:
        border_part = ''
        if week_tabs_border:
            # capture border-bottom for the week-tabs override below
            pass
        lines.append(f'.header{{background:{header_gradient};}}')
    if wtab_color:
        lines.append(f'.wtab{{color:{wtab_color};}}')
    if week_tabs_border:
        lines.append(f'.week-tabs{{border-bottom:{week_tabs_border};}}')
    return '\n'.join(lines)

# ── Style block patterns ───────────────────────────────────────────────────

STYLE_BLOCK_RE = re.compile(r'<style>(.*?)</style>', re.DOTALL)

BASE_LINK = '<link rel="stylesheet" href="base.css"/>'

def has_base_link(content):
    return 'href="base.css"' in content or "href='base.css'" in content

def inject_base_link(content):
    """Insert base.css before the first <link> or before </head>"""
    # Insert before first existing link tag
    m = re.search(r'<link\s', content)
    if m:
        return content[:m.start()] + BASE_LINK + '\n' + content[m.start():]
    # Fallback: before </head>
    return content.replace('</head>', BASE_LINK + '\n</head>', 1)

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    original = content

    # 1. Inject base.css link if not present
    if not has_base_link(content):
        content = inject_base_link(content)

    # 2. Find the first inline <style> block
    style_match = STYLE_BLOCK_RE.search(content)
    if not style_match:
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return 'link-only'
        return 'unchanged'

    style_block = style_match.group(1)

    # 3. Only strip inline CSS for workout pages
    if not is_workout_page(style_block):
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return 'link-only'
        return 'unchanged'

    # 4. Extract per-page tokens
    accent_hex, accent_rgb   = extract_accent(style_block)
    header_gradient          = extract_header_gradient(style_block)
    wtab_color               = extract_wtab_color(style_block)
    week_tabs_border         = extract_week_tabs_border(style_block)

    # 5. Build minimal replacement style block
    minimal = build_minimal_style(accent_hex, accent_rgb, header_gradient, wtab_color, week_tabs_border)

    if not minimal.strip():
        # Nothing to replace — leave page alone (safety fallback)
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return 'link-only'
        return 'unchanged'

    # 6. Replace the FIRST <style>...</style> block with minimal override
    new_style_tag = f'<style>\n{minimal}\n</style>'
    content = content[:style_match.start()] + new_style_tag + content[style_match.end():]

    # 7. Remove any subsequent <style> blocks that duplicate base rules
    #    (some split pages have a second <style> block for week-tabs)
    #    We keep them IF they contain rules not in base.css (unique classes)
    #    Simple heuristic: remove second block only if it only contains .week-tab / .week-tabs rules
    def remove_redundant_style(m):
        block = m.group(1)
        classes = set(re.findall(r'\.([\w-]+)\s*[{,]', block))
        base_only = classes.issubset({'week-tab','week-tabs','active'})
        return '' if base_only else m.group(0)

    # Apply to all style blocks after the first one
    first_end = content.find('</style>') + len('</style>')
    remainder = content[first_end:]
    remainder = STYLE_BLOCK_RE.sub(remove_redundant_style, remainder)
    content = content[:first_end] + remainder

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return 'full-strip'


if __name__ == '__main__':
    results = {'full-strip': [], 'link-only': [], 'unchanged': []}

    for path in sorted(glob.glob(os.path.join(REPO, '*.html'))):
        fname = os.path.basename(path)
        result = process_file(path)
        results[result].append(fname)

    print(f"Full inline CSS stripped → minimal tokens : {len(results['full-strip'])}")
    print(f"base.css link injected (no strip)         : {len(results['link-only'])}")
    print(f"Unchanged                                  : {len(results['unchanged'])}")

    print("\nFull-strip pages:")
    for f in results['full-strip']:
        print(f"  {f}")

    print("\nLink-only pages:")
    for f in results['link-only']:
        print(f"  {f}")
