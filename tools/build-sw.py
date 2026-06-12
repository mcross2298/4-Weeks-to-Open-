#!/usr/bin/env python3
"""
build-sw.py — regenerate the service worker precache list and cache version.

The committed sw.js stays valid at all times; this script rewrites two things
in place:
  1. The URL list between the /* AUTOGEN:URLS START */ and
     /* AUTOGEN:URLS END */ markers — built by globbing the repo for real,
     deployable files (no more hand-maintained list, no dead entries).
  2. The CACHE_NAME version.

Usage:
  python3 tools/build-sw.py --bump                 # local: v76 -> v77
  python3 tools/build-sw.py --version ci-123       # CI: deterministic per run
  python3 tools/build-sw.py --check                # CI guard: fail if stale
"""

import argparse
import re
import sys
from pathlib import Path

# Defaults target this repo; tools/build-market.py re-runs the generator on
# the extracted market tree with --root/--base pointing at its own deployment.
ROOT = Path(__file__).resolve().parent.parent
SW = ROOT / "sw.js"
BASE = "https://mcross2298.github.io/4-Weeks-to-Open-/"

START = "/* AUTOGEN:URLS START */"
END = "/* AUTOGEN:URLS END */"

# Deployable file types. Everything else (python scripts, markdown, sql,
# templates) never reaches users' caches.
INCLUDE_EXT = {".html", ".js", ".css"}
INCLUDE_FILES = {"manifest.json", "exercisedata.json",
                 "program-overrides.json", "icon.svg",
                 "icon-192.png", "icon-512.png"}

# Scratch/concept pages and superseded data files — exist in the repo but
# should not be shipped to every device.
DENY_FILES = {
    "index-v4.html",
    "stndr-card-concepts.html",
    "exercisedata-phase8.json",
    "exercisedata-phase8_1.json",
}
DENY_DIRS = {"tools", "supabase", "templates", ".github", ".git"}


def collect_urls(root, base):
    urls = [base]  # the root scope itself
    for p in sorted(root.iterdir()):
        if p.is_dir():
            continue
        if p.name in DENY_FILES:
            continue
        if p.suffix in INCLUDE_EXT or p.name in INCLUDE_FILES:
            urls.append(base + p.name)
    return urls


def render_block(urls):
    lines = [f"    {START}"]
    lines += [f"    '{u}'," for u in urls[:-1]]
    lines.append(f"    '{urls[-1]}'")
    lines.append(f"    {END}")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--bump", action="store_true",
                   help="increment the numeric cache version (local use)")
    g.add_argument("--version", help="set an explicit cache version suffix")
    g.add_argument("--check", action="store_true",
                   help="exit 1 if the URL list is out of date (CI guard)")
    ap.add_argument("--root", help="tree to scan + sw.js to rewrite (default: this repo)")
    ap.add_argument("--base", help="absolute deploy URL prefix (default: this repo's Pages URL)")
    args = ap.parse_args()

    root = Path(args.root).resolve() if args.root else ROOT
    base = args.base if args.base else BASE
    if not base.endswith("/"):
        base += "/"
    sw = root / "sw.js"
    src = sw.read_text()

    if START not in src or END not in src:
        sys.exit("sw.js is missing the AUTOGEN:URLS markers")

    urls = collect_urls(root, base)
    block = render_block(urls)
    pre, rest = src.split(START, 1)
    _, post = rest.split(END, 1)
    new_src = pre + block.strip() + post

    # keep the SW's own origin constant + fetch-handler origin gate in step
    # with the deploy URL (matters when rebuilding for the market repo)
    new_src = re.sub(r"const BASE = '[^']*';", f"const BASE = '{base}';", new_src, count=1)
    origin = re.match(r"(https?://[^/]+)", base).group(1)
    new_src = re.sub(r"url\.startsWith\('https?://[^']*'\)",
                     f"url.startsWith('{origin}')", new_src)

    name_re = re.compile(r"const CACHE_NAME = 'mc-training-([^']+)';")
    m = name_re.search(new_src)
    if not m:
        sys.exit("sw.js: CACHE_NAME pattern not found")

    if args.check:
        if new_src != src:
            sys.exit("sw.js precache list is stale — run "
                     "`python3 tools/build-sw.py --bump` and commit")
        print(f"sw.js up to date ({len(urls)} URLs, cache {m.group(1)})")
        return

    if args.bump:
        cur = m.group(1)
        n = re.fullmatch(r"v(\d+)", cur)
        if not n:
            sys.exit(f"--bump needs a numeric version, found '{cur}'")
        version = f"v{int(n.group(1)) + 1}"
    else:
        version = args.version

    new_src = name_re.sub(f"const CACHE_NAME = 'mc-training-{version}';",
                          new_src, count=1)
    sw.write_text(new_src)
    print(f"sw.js written: cache mc-training-{version}, {len(urls)} URLs")


if __name__ == "__main__":
    main()
