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
  3. Filters the licensed program names out of every "programs":[...] array
     in exercise-catalog.js / exercisedata.json (the exercises themselves are
     original and stay).
  4. Rewrites manifest.json's description for the market app (the master
     description names the licensed programs).
  5. Writes a market README.md and regenerates sw.js for --base.
  6. Leak-scans the result: references to licensed files are HARD failures;
     any brand-term mention in a shipped file is also a failure in --check.

Usage:
  python3 tools/build-market.py --extract DIR [--base URL]
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

TEXT_EXT = {".html", ".js", ".css", ".json", ".md", ".txt", ".yml", ".svg"}

# Files whose "programs":[...] arrays carry per-program tags that must be
# filtered down to the original (non-licensed) programs.
PROGRAM_TAG_FILES = {"exercise-catalog.js", "exercisedata.json"}
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
    return m, set(licensed), set(m["scratch"]), m.get("brand_terms", []), programs


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


def extract(out, base, manifest, licensed, scratch, programs):
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
            if p.name in PROGRAM_TAG_FILES:
                src = filter_program_tags(src, programs)
            (out / p.name).write_text(src, encoding="utf-8")
        else:
            shutil.copy2(p, out / p.name)
        copied.append(p.name)

    patch_pwa_manifest(out)
    (out / "README.md").write_text(MARKET_README, encoding="utf-8")

    # regenerate the service worker for the market deployment URL
    subprocess.run(
        [sys.executable, str(ROOT / "tools" / "build-sw.py"),
         "--version", "market-v1", "--root", str(out), "--base", base],
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
    args = ap.parse_args()

    manifest, licensed, scratch, brand_terms, programs = load_manifest()

    if args.check:
        tmp = Path(tempfile.mkdtemp(prefix="mc-market-"))
        try:
            extract(tmp, args.base, manifest, licensed, scratch, programs)
            hard, soft = leak_scan(tmp, licensed, brand_terms)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        out = Path(args.extract).resolve()
        if ROOT in out.parents or out == ROOT:
            sys.exit("--extract target must be outside the repo")
        copied = extract(out, args.base, manifest, licensed, scratch, programs)
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
