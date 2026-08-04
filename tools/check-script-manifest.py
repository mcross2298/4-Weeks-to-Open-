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

--------------------------------------------------------------------------
CAPABILITY CONTRACT (Volume II Phase 5 / Initiative 07 — "Module Parity")

The FAMILIES check above only ever compares a page against its own filename
clones — a page that's unique by design (cat-pmc.html, run-workout.html, ...)
is exempt from every check in the whole suite. That exemption is the audit's
own stated root cause of D-1: the substitute picker (mc-card-actions.js) was
on 8 such pages with NO repaint implementation reachable at all (neither
inline nor via mc-replace.js) — a trainee would swap an exercise, see it
apply, reload, and lose it silently, while it sat correctly in localStorage
the whole time. Coverage of the ten modules below ranged 39-78 of 79 pages,
decided entirely by which page a trainee happened to open, not by any
declared requirement.

REQUIRED_MODULES below is that declared requirement: any page that loads
mc-setlog.js (the working definition of "this is a workout page" — it's
the module that renders the per-set weight/reps logger under every exercise
card) MUST also load every module in the list. No exemption for "unique by
design" — capability grouping has none, which is the point; a page that
needs its own exemption from a real requirement needs the requirement
questioned, not the page quietly carved out.
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
    # `pmc-s3-s4-day` used to cover all three of the groups below at once: they
    # loaded the same module list, so one family was enough. G5 gave the pmc
    # pages and the three Split-3 day pages their own render engines, which
    # means those groups now legitimately load different modules. Splitting the
    # family keeps the check strict inside each real clone group instead of
    # loosening it to accommodate a difference that is intentional.
    "pmc-day":       r"^pmc-(back|bis-tris|chest-shoulders|legs-hams|legs-quad)\.html$",
    "s3-day":        r"^s3-(back-traps|chest-biceps|shoulders-triceps)\.html$",
    "s3-s4-day":     r"^(s3-upper-body|s4-(pull|push))\.html$",
    # New coverage: these two were clone families all along but had no filename
    # signal tying them together until G5 gave each a shared engine to load.
    "pump-day":      r"^((back-traps|bis-tris|chest-tri|hams-glutes|legs"
                     r"|shoulders-back|shoulders-bis-forearms)-pump"
                     r"|bonus-pump-(cst|lats))\.html$",
    "freq-split":    r"^(2on-1off|3on-1off-high-freq|5on-2off|every-(arms|chest)-day"
                     r"|lets-get-shredded|mens-(lean-bulk|shred))\.html$",
    "split-index":   r"^(mc|pmc)-split\d+\.html$",
    "instructions":  r"^[a-z0-9]+-instructions\.html$",
    "kitchen-sink":  r"^kitchen-sink(-s\d+)?\.html$",
}


# The capability contract itself: any page loading mc-setlog.js must load
# every one of these too. mc-setlog.js is the trigger, not a member of the
# list — it's the "is this a workout page" test, not part of what parity
# means once that test passes.
#
# mc-rep-progress.js shipped fleet-wide in this same phase (Volume II Phase
# 5, owner decision via AskUserQuestion) rather than staying an accepted
# 39/79 inconsistency — it degrades safely wherever it was missing (no
# error, just no trend line), so bringing it to parity here is a real,
# deliberate product call, not a silent bundle-in.
REQUIRED_MODULES = [
    "mc-suggest.js",
    "mc-summary.js",
    "mc-card-actions.js",
    "mc-cues.js",
    "mc-superset-hop.js",
    "mc-finish.js",
    "mc-live-tracker.js",
    "mc-timer.js",
    "mc-replace.js",
    "mc-rep-progress.js",
]
CAPABILITY_TRIGGER = "mc-setlog.js"

# Three pages load mc-setlog.js without being workout pages in any sense the
# contract cares about — verified, not assumed: none renders a single
# .ex-card/.ss-card, and none calls mc-setlog.js's own exported API
# (window.MCSetlogUtil never appears in any of the three). workout-logs.html
# reads the mc_setlog_v1 localStorage KEY directly for its own history
# display — it needs the STORE mc-setlog.js writes to, not the RENDERING
# code mc-setlog.js loads to provide; mc-cardio.html doesn't reference
# setlog/mcl anything at all. cat-gainz.html is a pure link-out index page
# (every card is a <a class="plan-card"> to a DIFFERENT page, e.g.
# mens-lean-bulk.html) carrying a full dead "WAVE3-SETLOG MODULE" script
# block — a page-local, hand-rolled duplicate of mc-setlog.js's own
# set-logging (its own saveSet/checkSet/buildRows, keyed on the identical
# mc_setlog_v1 store) that operates on '.ex-card[data-id]' selectors that
# never exist anywhere in this page's DOM, since it never renders exercise
# cards at all — confirmed a separate, real finding (a third duplicate-
# implementation defect, this time for set-logging, not scoped to Phase 5)
# and left alone rather than silently absorbed into this phase's declared
# scope. Loading the other nine required modules on any of these three pages
# would find no matching DOM and do nothing — nine more script requests
# with nothing to attach to, working against this same phase's sibling
# Initiative 09 ("Offline Diet") cost-consciousness for no real behavior.
# This is NOT the family-based blanket exemption D-1's root cause describes
# (a page that DOES render exercise cards, wrongly carved out of every check
# by matching no clone family) — it's three pages verified to not render
# exercise cards at all, correctly out of scope for a contract about
# exercise-card modules.
NOT_ACTUALLY_WORKOUT_PAGES = {"workout-logs.html", "mc-cardio.html", "cat-gainz.html"}


def check_capability_contract():
    problems = []
    pages = sorted(glob.glob("*.html"))
    workout_pages = [
        f for f in pages
        if CAPABILITY_TRIGGER in manifest(ROOT / f) and f not in NOT_ACTUALLY_WORKOUT_PAGES
    ]
    for f in workout_pages:
        loaded = set(manifest(ROOT / f))
        missing = [m for m in REQUIRED_MODULES if m not in loaded]
        if missing:
            problems.append(
                f"[capability] {f} loads {CAPABILITY_TRIGGER} (a workout page) but is "
                f"missing: {', '.join(missing)}"
            )
    return problems, len(workout_pages)


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

    cap_problems, cap_count = check_capability_contract()
    print(f"\nCapability contract: {cap_count} page(s) load {CAPABILITY_TRIGGER} "
          f"(workout pages), checked against {len(REQUIRED_MODULES)} required module(s).")

    if problems:
        print("\nSCRIPT-MANIFEST DRIFT:\n")
        print("\n\n".join(problems))
    else:
        print("\nAll declared clone families share one manifest — no drift.")

    if cap_problems:
        print("\nCAPABILITY CONTRACT VIOLATIONS:\n")
        print("\n".join(cap_problems))
    else:
        print("Every workout page carries the full required module set — no gaps.")

    if (problems or cap_problems) and args.check:
        sys.exit(1)


if __name__ == "__main__":
    main()
