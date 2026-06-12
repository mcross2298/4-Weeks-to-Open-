#!/usr/bin/env python3
"""
extract-shared-modules.py — Phase 1.2 of the continuous-improvement roadmap.

The rest-timer engine (TMR + buildTimerFloat), the progress-bar/timer-presets
block, the Finish-Workout module, and the Replace-Exercise module were pasted
inline into every workout page. This script extracts the canonical copies out
of a donor page into shared files:

    mc-timer.js    TMR engine + timer float + progress bar + presets
    mc-finish.js   Finish-Workout bar/modal + mc_workout_log_v1 writes + PRs
    mc-replace.js  saved-replacement renderer (REPLACED badge)

…then rewrites every page that carries a byte-identical copy to load the
shared file instead. Pages whose inline copy differs from the canonical text
(older variants: bro-split.html, s4-legs.html, cat-gainz.html, conditioning
pages with custom finish modules) are left untouched — the match is exact, so
this cannot change behavior anywhere it edits.

The legacy WAVE3-SETLOG inline module is deleted outright: mc-setlog.js is the
single source of truth for set logging and already strips WAVE3's UI at
runtime on every page.

Run from the repo root:  python3 tools/extract-shared-modules.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DONOR = ROOT / "mc-s1-back.html"


def script_el(src, marker):
    i = src.find(marker)
    if i < 0:
        sys.exit(f"donor missing marker: {marker}")
    s = src.rfind("<script>", 0, i)
    e = src.find("</script>", i)
    return src[s:e + 9]


def inner(el):
    return el[len("<script>"):-len("</script>")].strip("\n")


def main():
    donor = DONOR.read_text(encoding="utf-8")
    if "const TMR = {" not in donor:
        sys.exit("modules already extracted — donor has no inline TMR engine")

    start = donor.find("const TMR = {")
    end = donor.find("function makeRestTimer", start)
    tmr_core = donor[start:end].rstrip()
    wave3 = script_el(donor, "WAVE3-SETLOG MODULE")
    finish = script_el(donor, "FINISH-WORKOUT MODULE")
    progress = script_el(donor, "SESSION PROGRESS BAR")
    replace = script_el(donor, "REPLACE EXERCISE")

    (ROOT / "mc-timer.js").write_text(
        "/* ==========================================================================\n"
        "   mc-timer.js — shared rest-timer engine (extracted from the per-page copy)\n"
        "   Globals kept: TMR, buildTimerFloat, makeRestTimer stays per-page,\n"
        "   updateProgress, addTimerPresets — mc-setlog.js / superset-timers.js /\n"
        "   inline onclick handlers all keep working unmodified.\n"
        "   ========================================================================== */\n"
        + tmr_core + "\n"
        + "buildTimerFloat();\n\n"
        + inner(progress) + "\n",
        encoding="utf-8")

    (ROOT / "mc-finish.js").write_text(
        "/* mc-finish.js — Finish-Workout module (extracted from the per-page copy).\n"
        "   Contracts kept: window._FW, mc_workout_log_v1 entry shape. */\n"
        + inner(finish) + "\n",
        encoding="utf-8")

    (ROOT / "mc-replace.js").write_text(
        "/* mc-replace.js — renders saved exercise replacements (REPLACED badge).\n"
        "   Replacement itself is triggered from the meatball menu in\n"
        "   mc-card-actions.js; this module only re-applies saved swaps. */\n"
        + inner(replace) + "\n",
        encoding="utf-8")

    counts = {"timer": 0, "wave3": 0, "finish": 0, "progress": 0, "replace": 0}
    for p in sorted(ROOT.glob("*.html")):
        src = p.read_text(encoding="utf-8")
        orig = src

        if tmr_core in src and 'src="mc-timer.js"' not in src:
            i = src.find(tmr_core)
            s = src.rfind("<script>", 0, i)
            src = (src[:s] + '<script src="mc-timer.js"></script>\n' + src[s:])
            # drop the engine (and its banner comment when present)
            src = src.replace("// ── TIMER ENGINE (hoisted) ──\n" + tmr_core,
                              tmr_core, 1)
            src = src.replace(tmr_core + "\n", "", 1).replace(tmr_core, "", 1)
            counts["timer"] += 1

        if wave3 in src:
            src = src.replace(wave3, "", 1)
            counts["wave3"] += 1
        if finish in src:
            src = src.replace(finish, '<script src="mc-finish.js"></script>', 1)
            counts["finish"] += 1
        if progress in src:
            src = src.replace(progress, "", 1)
            counts["progress"] += 1
        if replace in src:
            src = src.replace(replace, '<script src="mc-replace.js"></script>', 1)
            counts["replace"] += 1

        if src != orig:
            p.write_text(src, encoding="utf-8")

    print("rewritten:", counts)


if __name__ == "__main__":
    main()
