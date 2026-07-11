#!/usr/bin/env python3
"""
build-market.py — generate the clean, marketable app (MC-Training-Rolodex)
from this master repo.

The public app ships ONLY the original content — the engine (every mc-*.js
module), the flagship programs, Conditioning Corner, the exercise library,
and the builders. Influencer program content is licensed work that cannot
ship in a marketed product. content-manifest.json is the single source of
truth for which files are licensed; this script turns that manifest into a
clean market tree and proves nothing leaked.

What extract does:
  1. Copies every deployable file except manifest "licensed" + "scratch"
     entries (dev dirs — tools/, supabase/, .github/ — and *.py stay behind,
     and content-manifest.json itself is not shipped).
  2. Strips MARKET:STRIP-marked regions from text files (dashboard influencer
     cards/CSS/PROGS entries, program-guide cards, quick-tour narration,
     mc-theme colors, engine comments).
  3. Materializes MARKET:ADD-marked regions in text files — the inverse of
     MARKET:STRIP: content that is HTML-commented-out (inert) in this repo's
     own source and only uncommented in the market build. Used for surfaces
     (like the Recipes nav tile) that only make sense once roadmap 4.7's
     cookbook merge (below) has actually mounted that content.
  4. Filters the licensed program names out of every "programs":[...] array
     in exercise-catalog.js (the exercises themselves are original and stay).
  5. Rewrites manifest.json's description for the market app (the master
     description names the licensed programs).
  6. Writes a market README.md and regenerates sw.js for --base.
  7. Roadmap 4.7 — unified market: if --cookbook-root is given (a checkout of
     mcross2298/Mikes-Cookbook, driven by content-manifest.json's "cookbook"
     block), recursively copies it under out/cookbook/ and regenerates that
     mount's own sw.js via the cookbook repo's own tools/build-sw.py --root.
     Omitted entirely when not passed — local/CI runs of this repo alone
     don't need a second checkout just to validate their own leak-safety.
  8. Leak-scans the result (including any cookbook/ mount): references to
     licensed files are HARD failures; any brand-term mention in a shipped
     file is also a failure in --check.

Usage:
  python3 tools/build-market.py --extract DIR [--base URL] [--cookbook-root DIR]
  python3 tools/build-market.py --check          # CI guard (dry extract)
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "content-manifest.json"
DEFAULT_BASE = "https://mcross2298.github.io/MC-Training-Rolodex/"

STRIP_RE = re.compile(
    r"[ \t]*(?:<!--|/\*) MARKET:STRIP (\S+) START.*?MARKET:STRIP \1 END (?:-->|\*/)\n?",
    re.S)

# Inverse of STRIP_RE: content commented out in master, uncommented in market.
# Supports both HTML and JS comment syntax, same as STRIP_RE.
ADD_RE = re.compile(
    r"[ \t]*(?:<!--|/\*) MARKET:ADD (\S+) START\n(.*?)"
    r"[ \t]*MARKET:ADD \1 END (?:-->|\*/)\n?",
    re.S)

TEXT_EXT = {".html", ".js", ".css", ".json", ".md", ".txt", ".yml", ".svg"}

# Roadmap 4.7 — files/dirs that never leave the Mikes-Cookbook checkout, dev
# docs mirroring this repo's own "scratch" list (README/CLAUDE/roadmap docs).
COOKBOOK_SKIP_DIRS = {"tools", ".github", ".git"}
COOKBOOK_SKIP_FILES = {"CLAUDE.md", "README.txt", "ROADMAP.md"}

# Files whose "programs":[...] arrays carry per-program tags that must be
# filtered down to the original (non-licensed) programs.
PROGRAM_TAG_FILES = {"exercise-catalog.js"}
PROGRAMS_ARRAY_RE = re.compile(r'("programs"\s*:\s*)(\[[^\]]*\])')

MARKET_DESCRIPTION = ("Workout programs, conditioning and custom builders — "
                      "strength training in your pocket")

MARKET_README = """\
# MC Training

Mike Cross Training — an installable workout PWA: flagship programs,
Conditioning Corner, a full exercise library, and program/workout builders
with per-set logging, rest timers, charts and offline support.

**This repository is generated automatically** from the master training repo
by `tools/build-market.py`. Do not edit it by hand — changes will be
overwritten by the next deploy.
"""


def load_manifest():
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    licensed = sorted({f for src in m["licensed"].values() for f in src["files"]})
    missing = [f for f in licensed + m["scratch"] if not (ROOT / f).exists()]
    if missing:
        sys.exit("content-manifest.json lists files that don't exist: %s" % missing)
    programs = sorted({src["program"] for src in m["licensed"].values()
                       if "program" in src})
    return (m, set(licensed), set(m["scratch"]), m.get("brand_terms", []),
            programs, m.get("cookbook", {}))


def filter_program_tags(src, programs):
    """Remove licensed program names from every "programs":[...] array."""
    drop = set(programs)

    def repl(match):
        tags = json.loads(match.group(2))
        kept = [t for t in tags if t not in drop]
        return match.group(1) + json.dumps(kept, separators=(",", ":"))

    return PROGRAMS_ARRAY_RE.sub(repl, src)


def patch_pwa_manifest(out):
    """The master manifest.json description names licensed programs."""
    mf = out / "manifest.json"
    if not mf.exists():
        return
    data = json.loads(mf.read_text(encoding="utf-8"))
    data["description"] = MARKET_DESCRIPTION
    mf.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def copy_cookbook_tree(cookbook_root, mount, exclude):
    """Roadmap 4.7 — recursively copy a Mikes-Cookbook checkout into `mount`
    (out/cookbook), applying the same MARKET:STRIP/MARKET:ADD text rules as
    the main copy loop. Unlike the main loop this DOES walk subdirectories
    (e.g. images/recipes/), since the cookbook repo isn't flat."""
    copied = []
    for p in sorted(cookbook_root.rglob("*")):
        rel = p.relative_to(cookbook_root)
        if rel.parts[0] in COOKBOOK_SKIP_DIRS or rel.parts[0].startswith("."):
            continue
        if p.is_dir():
            continue
        if p.name in COOKBOOK_SKIP_FILES or str(rel) in exclude:
            continue
        if p.suffix == ".py":
            continue
        dest = mount / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if p.suffix in TEXT_EXT:
            src = p.read_text(encoding="utf-8")
            src = STRIP_RE.sub("", src)
            src = ADD_RE.sub(lambda m: m.group(2), src)
            dest.write_text(src, encoding="utf-8")
        else:
            shutil.copy2(p, dest)
        copied.append(str(Path("cookbook") / rel))
    return copied


def extract(out, base, manifest, licensed, scratch, programs, sw_version="market-v1",
            cookbook_root=None):
    out.mkdir(parents=True, exist_ok=True)
    skip_names = licensed | scratch | {MANIFEST.name}
    copied = []
    for p in sorted(ROOT.iterdir()):
        if p.name in skip_names or p.name.startswith("."):
            continue
        if p.is_dir():
            continue                       # tools/, supabase/, .github stay behind
        if p.suffix == ".py":
            continue                       # legacy deploy scripts stay behind
        if p.suffix in TEXT_EXT:
            src = p.read_text(encoding="utf-8")
            src = STRIP_RE.sub("", src)
            src = ADD_RE.sub(lambda m: m.group(2), src)
            if p.name in PROGRAM_TAG_FILES:
                src = filter_program_tags(src, programs)
            (out / p.name).write_text(src, encoding="utf-8")
        else:
            shutil.copy2(p, out / p.name)
        copied.append(p.name)

    patch_pwa_manifest(out)
    (out / "README.md").write_text(MARKET_README, encoding="utf-8")

    # regenerate the service worker for the market deployment URL. The cache
    # name carries the version, and browsers only treat sw.js as "changed" when
    # its bytes change — so a static version would never bust the cache on a
    # content-only edit. The deploy passes a unique per-run version to guarantee
    # every deploy ships a fresh service worker.
    subprocess.run(
        [sys.executable, str(ROOT / "tools" / "build-sw.py"),
         "--version", sw_version, "--root", str(out), "--base", base],
        check=True)

    if cookbook_root is not None:
        cb_conf = manifest.get("cookbook", {})
        mount_name = cb_conf.get("mount", "cookbook")
        mount = out / mount_name
        cb_copied = copy_cookbook_tree(cookbook_root, mount, set(cb_conf.get("exclude", [])))
        copied += cb_copied
        cb_sw = mount / "sw.js"
        if cb_sw.exists():
            subprocess.run(
                [sys.executable, str(cookbook_root / "tools" / "build-sw.py"),
                 "--version", sw_version, "--root", str(mount)],
                check=True)
    return copied


def leak_scan(out, licensed, brand_terms):
    hard, soft = [], []
    # boundary guard: "s4-legs.html" must not match inside "mc-s4-legs.html"
    pats = {f: re.compile(r"(?<![\w-])" + re.escape(f)) for f in licensed}
    # letter boundaries so short terms don't match inside ordinary words
    # ("PSU" must not flag "capsule") but still catch psu-strength / .psu / 'psu'
    terms = {t: re.compile(r"(?<![A-Za-z])" + re.escape(t) + r"(?![A-Za-z])", re.I)
             for t in brand_terms}
    for p in sorted(out.rglob("*")):
        if not p.is_file() or p.suffix not in TEXT_EXT:
            continue
        src = p.read_text(encoding="utf-8", errors="replace")
        for f, rx in pats.items():
            if rx.search(src):
                hard.append("%s references licensed file %s" % (p.name, f))
        for t, rx in terms.items():
            if rx.search(src):
                soft.append("%s mentions '%s'" % (p.relative_to(out), t))
    return hard, soft


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--extract", metavar="DIR", help="write the market tree here")
    g.add_argument("--check", action="store_true",
                   help="dry-extract + leak scan; exit 1 on any leak (CI)")
    ap.add_argument("--base", default=DEFAULT_BASE,
                    help="deploy URL for the market app's service worker")
    ap.add_argument("--sw-version", default="market-v1",
                    help="cache version baked into the market service worker; "
                         "pass a unique value per deploy so the cache always busts")
    ap.add_argument("--cookbook-root", metavar="DIR",
                    help="roadmap 4.7: a checkout of mcross2298/Mikes-Cookbook "
                         "to merge under out/cookbook/. Omit to skip the merge "
                         "entirely (this repo's own leak-check doesn't need it).")
    args = ap.parse_args()

    manifest, licensed, scratch, brand_terms, programs, cb_conf = load_manifest()
    cookbook_root = None
    if args.cookbook_root:
        cookbook_root = Path(args.cookbook_root).resolve()
        if not (cookbook_root / "sw.js").exists():
            sys.exit("--cookbook-root %s doesn't look like a Mikes-Cookbook checkout "
                     "(no sw.js)" % cookbook_root)
        brand_terms = list(brand_terms) + list(cb_conf.get("brand_terms", []))

    if args.check:
        tmp = Path(tempfile.mkdtemp(prefix="mc-market-"))
        try:
            extract(tmp, args.base, manifest, licensed, scratch, programs,
                    args.sw_version, cookbook_root)
            hard, soft = leak_scan(tmp, licensed, brand_terms)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        out = Path(args.extract).resolve()
        if ROOT in out.parents or out == ROOT:
            sys.exit("--extract target must be outside the repo")
        copied = extract(out, args.base, manifest, licensed, scratch, programs,
                         args.sw_version, cookbook_root)
        hard, soft = leak_scan(out, licensed, brand_terms)
        print("market tree: %d files -> %s" % (len(copied), out))

    if soft:
        print("\nbrand-term mentions in shipped files (%d):" % len(soft))
        for s in sorted(set(soft)):
            print("  •", s)
    if hard:
        print("\nHARD LEAKS — licensed files referenced by shipped files:")
        for h in sorted(set(hard)):
            print("  ✗", h)
    if hard or soft:
        sys.exit(1)
    print("\nleak check passed: no licensed content or brand term reachable from "
          "the market build (%d licensed files excluded)" % len(licensed))


if __name__ == "__main__":
    main()
