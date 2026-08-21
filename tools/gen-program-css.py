#!/usr/bin/env python3
"""
gen-program-css.py — generate dashboard.html's per-program card CSS from
mc-pm-data.js (card-integration-roadmap DG-5).

dashboard.html used to hand-maintain four near-identical CSS blocks per
program (dark .cat-card.<id> / dark .rail-card.<id> / light .cat-card.<id> /
light .rail-card.<id>) — ~101 lines of hand-copied rgba() variants of the
same hex, one drift away from a card silently going out of sync with
mc-pm-data.js's `color` field (exactly what tools/check-program-colors.js
exists to catch after the fact). Every value in those blocks is either a
fixed-alpha rgba() of `color`'s RGB or a plain function of `tier`
(flagship gets the --fs-rest/--fs-peak/--fs-ring glow tokens + a 2.5px
border-top + a 26px/24px active-glow blur radius; influencer gets a plainer
2px border-top, no glow tokens, and a smaller un-!important active glow) —
except .cat-tag's text color, a hand-tuned lighter tint per program with no
formula, which is why `tagTint`/`tagTintLight` are explicit fields on each
program object rather than derived here.

Normalization note: 'ss' and 'mc' hand-carried a border/border-top alpha of
.3 where the other four flagship programs used .28, on both the cat-card
and rail-card blocks, with no other value differing by tier membership —
treated as accumulated hand-authoring drift (not a deliberate "extra
premium" tier, since nothing else about those two differs) and normalized
to .28 here, matching the four-of-six majority. This is the only value this
generator does not reproduce byte-for-byte from the pre-DG-5 source.

Regenerates the content between four marker pairs in dashboard.html:
  AUTOGEN:RAIL-CARDS-DARK, AUTOGEN:PROGRAM-CARDS-DARK,
  AUTOGEN:RAIL-CARDS-LIGHT, AUTOGEN:PROGRAM-CARDS-LIGHT

Usage:
  python3 tools/gen-program-css.py           # write
  python3 tools/gen-program-css.py --check   # CI guard: fail if stale
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PM_DATA = ROOT / "mc-pm-data.js"
DASH = ROOT / "dashboard.html"

MARKERS = {
    "rail-dark": ("/* AUTOGEN:RAIL-CARDS-DARK START */", "/* AUTOGEN:RAIL-CARDS-DARK END */"),
    # The dark cat-card block is split in two because dashboard.html has an
    # unrelated CSS chunk (the .influencer-grid layout rules + a comment)
    # sitting between the flagship color blocks and the influencer color
    # blocks — a single marker pair spanning both would delete that chunk.
    "cards-dark-flagship": ("/* AUTOGEN:PROGRAM-CARDS-DARK START */", "/* AUTOGEN:PROGRAM-CARDS-DARK END */"),
    "cards-dark-influencer": ("/* AUTOGEN:PROGRAM-CARDS-DARK-INFLUENCER START */", "/* AUTOGEN:PROGRAM-CARDS-DARK-INFLUENCER END */"),
    "rail-light": ("/* AUTOGEN:RAIL-CARDS-LIGHT START */", "/* AUTOGEN:RAIL-CARDS-LIGHT END */"),
    "cards-light": ("/* AUTOGEN:PROGRAM-CARDS-LIGHT START */", "/* AUTOGEN:PROGRAM-CARDS-LIGHT END */"),
}

FLAGSHIP_BORDER_ALPHA = ".28"  # normalized; see module docstring


def hex_to_rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def parse_programs(src):
    """Extract {id, tier, color, tagTint, tagTintLight} per program object,
    in source order, by locating each `{ id: '...', ... }` top-level entry
    and pulling fields out of its own text span (brace-depth bounded, so a
    `splits: [...]` array inside one entry can't leak fields into another)."""
    programs = []
    for m in re.finditer(r"\{\s*id:\s*'([a-z0-9-]+)'", src):
        start = m.start()
        depth = 0
        i = start
        for i in range(start, len(src)):
            if src[i] == '{':
                depth += 1
            elif src[i] == '}':
                depth -= 1
                if depth == 0:
                    break
        body = src[start:i + 1]
        tier_m = re.search(r"tier:\s*'([a-z]+)'", body)
        color_m = re.search(r"color:\s*'(#[0-9a-fA-F]{3,8})'", body)
        if not (tier_m and color_m):
            continue
        tag_m = re.search(r"tagTint:\s*'([^']+)'", body)
        tag_light_m = re.search(r"tagTintLight:\s*'([^']+)'", body)
        programs.append({
            "id": m.group(1),
            "tier": tier_m.group(1),
            "color": color_m.group(1).lower(),
            "tagTint": tag_m.group(1) if tag_m else None,
            "tagTintLight": tag_light_m.group(1) if tag_light_m else None,
        })
    return programs


def rgba(rgb, a):
    return "rgba(%d,%d,%d,%s)" % (rgb[0], rgb[1], rgb[2], a)


def render_cards_dark_flagship(programs):
    flagship = [p for p in programs if p["tier"] == "flagship"]
    out = []
    for p in flagship:
        rgb = hex_to_rgb(p["color"])
        out.append(
            "#scr-programs .cat-card.%s{background:linear-gradient(160deg,%s,%s);"
            "border:1px solid %s;border-top:2.5px solid %s;"
            "--fs-rest:0 4px 20px %s;--fs-peak:0 6px 30px %s;--fs-ring:0 0 0 1px %s;}\n"
            "#scr-programs .cat-card.%s .cat-icon{background:%s;}\n"
            "#scr-programs .cat-card.%s .cat-tag{background:%s;border:1px solid %s;color:%s;}\n"
            "#scr-programs .cat-card.%s:active{box-shadow:0 0 0 2px %s,0 0 26px %s!important;}" % (
                p["id"], rgba(rgb, ".16"), rgba((20, 20, 22), ".5"),
                rgba(rgb, FLAGSHIP_BORDER_ALPHA), p["color"],
                rgba(rgb, ".18"), rgba(rgb, ".4"), rgba(rgb, ".22"),
                p["id"], rgba(rgb, ".18"),
                p["id"], rgba(rgb, ".2"), rgba(rgb, ".4"), p["tagTint"],
                p["id"], p["color"], rgba(rgb, ".55"),
            )
        )
    return "\n\n".join(out)


def render_cards_dark_influencer(programs):
    influencer = [p for p in programs if p["tier"] == "influencer"]
    inf_out = []
    for p in influencer:
        rgb = hex_to_rgb(p["color"])
        inf_out.append(
            "#scr-programs .cat-card.%s{background:linear-gradient(160deg,%s,%s);"
            "border:1px solid %s;border-top:2px solid %s;}\n"
            "#scr-programs .cat-card.%s .cat-icon{background:%s;}\n"
            "#scr-programs .cat-card.%s .cat-tag{background:%s;border:1px solid %s;color:%s;}\n"
            "#scr-programs .cat-card.%s:active{box-shadow:0 0 0 2px %s,0 0 24px %s;}" % (
                p["id"], rgba(rgb, ".14"), rgba((20, 20, 22), ".5"), rgba(rgb, ".26"), p["color"],
                p["id"], rgba(rgb, ".18"),
                p["id"], rgba(rgb, ".2"), rgba(rgb, ".4"), p["tagTint"],
                p["id"], p["color"], rgba(rgb, ".5"),
            )
        )
    influencer_block = "\n\n".join(inf_out)
    return ("/* MARKET:STRIP influencer-css START */\n"
            + influencer_block + "\n"
            "/* MARKET:STRIP influencer-css END */")


def render_rail_dark(programs):
    flagship = [p for p in programs if p["tier"] == "flagship"]
    out = []
    for p in flagship:
        rgb = hex_to_rgb(p["color"])
        out.append(
            "#scr-dashboard .rail-card.%s{background:linear-gradient(160deg,%s,%s);"
            "border:1px solid %s;border-top:2.5px solid %s;"
            "--fs-rest:0 4px 18px %s;--fs-peak:0 6px 28px %s;--fs-ring:0 0 0 1px %s;}\n"
            "#scr-dashboard .rail-card.%s .rail-icon{background:%s;}\n"
            "#scr-dashboard .rail-card.%s:active{box-shadow:0 0 0 2px %s,0 0 24px %s!important;}" % (
                p["id"], rgba(rgb, ".16"), rgba((20, 20, 22), ".4"),
                rgba(rgb, FLAGSHIP_BORDER_ALPHA), p["color"],
                rgba(rgb, ".18"), rgba(rgb, ".4"), rgba(rgb, ".22"),
                p["id"], rgba(rgb, ".16"),
                p["id"], p["color"], rgba(rgb, ".55"),
            )
        )
    return "\n".join(out)


def render_cards_light(programs):
    flagship = [p for p in programs if p["tier"] == "flagship"]
    influencer = [p for p in programs if p["tier"] == "influencer"]

    def block(p, bg_alpha):
        rgb = hex_to_rgb(p["color"])
        lines = ["html[data-theme=\"light\"] #scr-programs .cat-card.%s{background:linear-gradient(160deg,%s,%s);}" % (
            p["id"], rgba(rgb, bg_alpha), rgba((245, 242, 236), ".92"))]
        if p["tagTintLight"]:
            lines.append("html[data-theme=\"light\"] #scr-programs .cat-card.%s .cat-tag{color:%s;}" % (
                p["id"], p["tagTintLight"]))
        return "\n".join(lines)

    flagship_block = "\n".join(block(p, ".14") for p in flagship)
    influencer_block = "\n".join(block(p, ".13") for p in influencer)
    return (flagship_block + "\n"
            "/* MARKET:STRIP influencer-css START */\n"
            + influencer_block + "\n"
            "/* MARKET:STRIP influencer-css END */")


def render_rail_light(programs):
    flagship = [p for p in programs if p["tier"] == "flagship"]
    out = []
    for p in flagship:
        rgb = hex_to_rgb(p["color"])
        out.append(
            "html[data-theme=\"light\"] #scr-dashboard .rail-card.%s{background:linear-gradient(160deg,%s,%s);}" % (
                p["id"], rgba(rgb, ".14"), rgba((245, 242, 236), ".9"))
        )
    return "\n".join(out)


def apply_markers(dash_src, key, content):
    start, end = MARKERS[key]
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    replacement = start + "\n" + content.strip() + "\n" + end
    if not pattern.search(dash_src):
        print(f"::error::dashboard.html is missing the {start} / {end} marker pair", file=sys.stderr)
        sys.exit(1)
    return pattern.sub(lambda _m: replacement, dash_src, count=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="fail if dashboard.html is stale, write nothing")
    args = ap.parse_args()

    pm_src = PM_DATA.read_text(encoding="utf-8")
    dash_src = DASH.read_text(encoding="utf-8")
    programs = parse_programs(pm_src)

    if not programs:
        print("::error::gen-program-css.py found no programs in mc-pm-data.js", file=sys.stderr)
        sys.exit(1)
    missing_tint = [p["id"] for p in programs if not p["tagTint"]]
    if missing_tint:
        print(f"::error::mc-pm-data.js program(s) missing tagTint: {', '.join(missing_tint)}", file=sys.stderr)
        sys.exit(1)

    new_src = dash_src
    new_src = apply_markers(new_src, "rail-dark", render_rail_dark(programs))
    new_src = apply_markers(new_src, "cards-dark-flagship", render_cards_dark_flagship(programs))
    new_src = apply_markers(new_src, "cards-dark-influencer", render_cards_dark_influencer(programs))
    new_src = apply_markers(new_src, "rail-light", render_rail_light(programs))
    new_src = apply_markers(new_src, "cards-light", render_cards_light(programs))

    if args.check:
        if new_src != dash_src:
            print("::error::dashboard.html's program-card CSS is stale — run `python3 tools/gen-program-css.py`", file=sys.stderr)
            sys.exit(1)
        print(f"Program card CSS OK — {len(programs)} programs, dashboard.html matches mc-pm-data.js.")
        return

    if new_src != dash_src:
        DASH.write_text(new_src, encoding="utf-8")
        print(f"dashboard.html regenerated — {len(programs)} programs.")
    else:
        print(f"dashboard.html already up to date — {len(programs)} programs.")


if __name__ == "__main__":
    main()
