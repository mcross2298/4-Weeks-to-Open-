#!/usr/bin/env python3
"""
check-script-manifest.py — LS-3 of the Lean Six Sigma audit roadmap
(lean-six-sigma-audit.md, finding W-05).

The workout fleet has ~100 program/day/split pages that each hand-list 20-odd
shared-module <script> tags. Pages that play the same structural role (all the
mc-s* day pages, all the split-index pages, …) are clones that MUST load the
same modules in the same order — but nothing enforced that, so a page could
silently drop a tag (a trainee without a rest timer) or let the list drift out
of order, with no error and no CI failure. This checker makes that drift a
build failure instead of an invisible regression.

How it works (generate-and-verify, same spirit as build-sw.py --check):
  * A page's "manifest" is the ordered list of its local <script src="*.js">
    tags, exactly as written (including any ?v= query — so a stray, unmatched
    cache-bust param is caught too).
  * FAMILIES groups pages by FILENAME (a role regex), never by their current
    module set. Grouping by set would be circular (every set-group is trivially
    set-consistent) AND would wrongly lump in pages that only coincidentally
    share a module set while legitimately interleaving inline config between
    their tags (e.g. cat-pump-new4.html) — those are not clones and must not be
    forced to match. Filename role is the honest signal for "these are clones."
  * Within each family every member must have a byte-identical manifest. The
    canonical is the majority manifest; any member that differs is reported
    with the exact added/removed/moved tags.

Pages matching no family are unique by design and are not checked.

Usage:
  python3 tools/check-script-manifest.py            # human report
  python3 tools/check-script-manifest.py --check    # CI: exit 1 on any drift
  python3 tools/check-script-manifest.py --list      # show families + members
"""

import argparse
import collections
import difflib
import glob
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# family name -> filename regex. Only clone families with a clean filename
# signal live here; heterogeneously-named groups (the assorted standard-day and
# conditioning-workout pages) are deliberately left unchecked rather than pinned
# to a brittle hand-listed membership. Add a family here when a new clone group
# appears; add a page to an existing family just by naming it to match.
FAMILIES = {
    "mc-day":        r"^mc-s\d+-.+\.html$",
    "pmc-s3-s4-day": r"^(pmc-(back|bis-tris|chest-shoulders|legs-hams|legs-quad)"
                     r"|s3-(back-traps|chest-biceps|shoulders-triceps|upper-body)"
                     r"|s4-(pull|push))\.html$",
    "split-index":   r"^(mc|pmc)-split\d+\.html$",
    "instructions":  r"^[a-z0-9]+-instructions\.html$",
    "kitchen-sink":  r"^kitchen-sink(-s\d+)?\.html$",
}


def manifest(path):
    """Ordered list of local <script src="*.js"> as written (keeps any ?v=)."""
    text = path.read_text(encoding="utf-8", errors="ignore")
    out = []
    for m in re.finditer(r'<script[^>]*\bsrc="([^"]+)"', text):
        src = m.group(1)
        if src.startswith(("http:", "https:", "//")):
            continue
        if src.split("?")[0].endswith(".js"):
            out.append(src)
    return out


def members(regex):
    rx = re.compile(regex)
    return sorted(f for f in glob.glob("*.html") if rx.match(f))


def check():
    problems = []
    summary = []
    for fam, regex in FAMILIES.items():
        files = members(regex)
        if len(files) < 2:
            summary.append(f"  {fam}: {len(files)} page(s) — skipped (need ≥2 to compare)")
            continue
        variants = collections.defaultdict(list)
        for f in files:
            variants[tuple(manifest(ROOT / f))].append(f)
        summary.append(f"  {fam}: {len(files)} pages, {len(variants)} manifest(s)")
        if len(variants) == 1:
            continue
        # majority = canonical; everything else is drift
        ranked = sorted(variants.items(), key=lambda kv: -len(kv[1]))
        canon, canon_files = ranked[0]
        for variant, vfiles in ranked[1:]:
            diff = "\n".join(
                "        " + line
                for line in difflib.unified_diff(
                    list(canon), list(variant),
                    fromfile="canonical", tofile=vfiles[0], lineterm="", n=1)
            )
            problems.append(
                f"[{fam}] these pages drifted from the family manifest "
                f"(canonical shared by {len(canon_files)} pages, e.g. {canon_files[0]}):\n"
                f"    {', '.join(vfiles)}\n{diff}"
            )
    return problems, summary


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="exit non-zero if any family has drifted (CI mode)")
    ap.add_argument("--list", action="store_true",
                    help="list families and their member pages, then exit")
    args = ap.parse_args()

    import os
    os.chdir(ROOT)

    if args.list:
        for fam, regex in FAMILIES.items():
            files = members(regex)
            print(f"{fam} ({len(files)} pages):")
            for f in files:
                print(f"  {f}")
        return

    problems, summary = check()
    print("Script-manifest families:")
    print("\n".join(summary))

    if problems:
        print("\nSCRIPT-MANIFEST DRIFT:\n")
        print("\n\n".join(problems))
        if args.check:
            sys.exit(1)
    else:
        print("\nAll declared clone families share one manifest — no drift.")


if __name__ == "__main__":
    main()
