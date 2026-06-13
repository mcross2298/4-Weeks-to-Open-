#!/usr/bin/env python3
"""
validate-overrides.py — structural validation of program-overrides.json

The committed program-overrides.json is the offline/fallback override source
shipped to every user. A malformed file (bad hand-edit, truncated export)
would silently break the paint layer. This guards its shape in CI.

Accepts both v1 ({ pages }) and v2 ({ pages, exercises, programs, splits,
badges }) — old clients ignore unknown sections, so v2 is backward compatible.

Run:  python3 tools/validate-overrides.py [path]   (default: program-overrides.json)
Exit: 0 valid, 1 invalid (with a specific reason).
"""
import json
import sys
from pathlib import Path

# fields allowed inside a single override "patch" object
PATCH_FIELDS = {"name", "sets", "rest", "note", "tempo", "reset", "label", "color", "icon", "desc"}
ONE_LEVEL = ("exercises", "programs")          # { key -> patch }
TWO_LEVEL = ("pages", "splits", "badges")      # { outer -> { key -> patch } }


def fail(msg):
    print("program-overrides.json INVALID: " + msg)
    sys.exit(1)


def check_patch(p, where):
    if not isinstance(p, dict):
        fail("%s: patch must be an object" % where)
    for k, v in p.items():
        if k not in PATCH_FIELDS:
            fail("%s: unknown field %r (allowed: %s)" % (where, k, ", ".join(sorted(PATCH_FIELDS))))
        if k == "reset":
            if not isinstance(v, bool):
                fail("%s.reset must be a boolean" % where)
        elif not isinstance(v, str):
            fail("%s.%s must be a string" % (where, k))


def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "program-overrides.json")
    if not path.exists():
        fail("file not found: %s" % path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        fail("not valid JSON: %s" % e)

    if not isinstance(data, dict):
        fail("root must be an object")
    if "version" in data and not isinstance(data["version"], int):
        fail("version must be a number")
    if "updated" in data and not isinstance(data["updated"], str):
        fail("updated must be a string")

    for sec in TWO_LEVEL:
        if sec not in data:
            continue
        node = data[sec]
        if not isinstance(node, dict):
            fail("%s must be an object" % sec)
        for outer, inner in node.items():
            if not isinstance(inner, dict):
                fail("%s[%r] must be an object" % (sec, outer))
            for key, patch in inner.items():
                check_patch(patch, "%s[%r][%r]" % (sec, outer, key))

    for sec in ONE_LEVEL:
        if sec not in data:
            continue
        node = data[sec]
        if not isinstance(node, dict):
            fail("%s must be an object" % sec)
        for key, patch in node.items():
            check_patch(patch, "%s[%r]" % (sec, key))

    print("program-overrides.json OK (%s, version %s)" % (path, data.get("version", "?")))


if __name__ == "__main__":
    main()
