#!/usr/bin/env python3
"""
build-market.py — Horizon 1: generate the marketable app from this repo.

The long-term plan is a public app built from ONLY the original content —
the engine (every mc-*.js module), the five flagship programs, Conditioning
Corner, the exercise library, and the builders. Influencer program content
(STNDR, Daily Pump, Daily Gainz, PSU) is licensed work that cannot ship in
a marketed product. content-manifest.json is the single source of truth for
which files are licensed; this script turns that manifest into a clean
market tree and proves nothing leaked.

Usage:
  python3 tools/build-market.py --extract DIR [--base URL]
      Build the market tree: copy everything except licensed/scratch files,
      strip MARKET:STRIP-marked regions (dashboard influencer cards + PROGS
      entries, program-guide influencer cards), rewrite sw.js for --base.
  python3 tools/build-market.py --check
      CI guard: dry-extract to a temp dir and fail on any hard leak
      (a reference to a licensed file from a shipped file). Brand-term
      mentions are reported as warnings — copy that needs a human pass.
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
DEFAULT_BASE = "https://example.github.io/mc-training/"

STRIP_RE = re.compile(
    r"[ \t]*(?:<!--|/\*) MARKET:STRIP (\S+) START.*?MARKET:STRIP \1 END (?:-->|\*/)\n?",
    re.S)

TEXT_EXT = {".html", ".js", ".css", ".json", ".md", ".txt", ".yml", ".svg"}


def load_manifest():
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    licensed = sorted({f for src in m["licensed"].values() for f in src["files"]})
    missing = [f for f in licensed + m["scratch"] if not (ROOT / f).exists()]
    if missing:
        sys.exit("content-manifest.json lists files that don't exist: %s" % missing)
    return m, set(licensed), set(m["scratch"]), m.get("brand_terms", [])


def extract(out, base, manifest, licensed, scratch):
    out.mkdir(parents=True, exist_ok=True)
    skip_names = licensed | scratch
    copied = []
    for p in sorted(ROOT.iterdir()):
        if p.name in skip_names or p.name.startswith("."):
            continue
        if p.is_dir():
            if p.name in ("tools", "supabase", ".github"):
                shutil.copytree(p, out / p.name, dirs_exist_ok=True)
            continue
        if p.suffix == ".py":
            continue                       # legacy deploy scripts stay behind
        if p.suffix in TEXT_EXT:
            src = p.read_text(encoding="utf-8")
            stripped = STRIP_RE.sub("", src)
            (out / p.name).write_text(stripped, encoding="utf-8")
        else:
            shutil.copy2(p, out / p.name)
        copied.append(p.name)

    # the manifest itself documents provenance — ship it
    shutil.copy2(MANIFEST, out / MANIFEST.name)

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
    terms = {t: re.compile(re.escape(t), re.I) for t in brand_terms}
    for p in sorted(out.rglob("*")):
        if not p.is_file() or p.suffix not in TEXT_EXT:
            continue
        if p.name == "content-manifest.json":
            continue                       # the provenance record itself
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
                   help="dry-extract + leak scan; exit 1 on hard leaks (CI)")
    ap.add_argument("--base", default=DEFAULT_BASE,
                    help="deploy URL for the market app's service worker")
    args = ap.parse_args()

    manifest, licensed, scratch, brand_terms = load_manifest()

    if args.check:
        tmp = Path(tempfile.mkdtemp(prefix="mc-market-"))
        try:
            extract(tmp, args.base, manifest, licensed, scratch)
            hard, soft = leak_scan(tmp, licensed, brand_terms)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    else:
        out = Path(args.extract).resolve()
        if ROOT in out.parents or out == ROOT:
            sys.exit("--extract target must be outside the repo")
        copied = extract(out, args.base, manifest, licensed, scratch)
        hard, soft = leak_scan(out, licensed, brand_terms)
        print("market tree: %d files -> %s" % (len(copied), out))

    if soft:
        print("\nbrand-term mentions to hand-clean before marketing (%d):" % len(soft))
        for s in sorted(set(soft)):
            print("  •", s)
    if hard:
        print("\nHARD LEAKS — licensed files referenced by shipped files:")
        for h in sorted(set(hard)):
            print("  ✗", h)
        sys.exit(1)
    print("\nleak check passed: no licensed content reachable from the market build "
          "(%d licensed files excluded)" % len(licensed))


if __name__ == "__main__":
    main()
