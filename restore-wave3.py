#!/usr/bin/env python3
"""
restore-wave3.py — Restores Wave 3 setlog layout to all programs
                   except MC and Daily Pump (which are already correct).

Run this from the claude/fix-deployment-sync-dSsFf branch checkout,
where all 57 files below have the correct Wave 3 code.

Usage (Windows CMD):
    set GITHUB_TOKEN=ghp_yourtoken
    python3 restore-wave3.py

Usage (Mac/Linux):
    GITHUB_TOKEN=ghp_yourtoken python3 restore-wave3.py
"""
import os, sys, base64, json, urllib.request, urllib.error

REPO_OWNER = "mcross2298"
REPO_NAME  = "4-Weeks-to-Open-"
BRANCH     = "main"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
if not GITHUB_TOKEN:
    print("ERROR: Set GITHUB_TOKEN env var before running.")
    print("  Windows CMD: set GITHUB_TOKEN=ghp_yourtoken")
    sys.exit(1)

# All programs that need Wave 3 restored (MC and Daily Pump excluded — already correct)
FILES = [
    # STNDR splits
    "s3-back-traps.html",
    "s3-chest-biceps.html",
    "s3-shoulders-triceps.html",
    "s3-upper-body.html",
    "s4-pull.html",
    "s4-push.html",
    # PMC individual workouts
    "pmc-back.html",
    "pmc-bis-tris.html",
    "pmc-chest-shoulders.html",
    "pmc-legs-hams.html",
    "pmc-legs-quad.html",
    "pmc-s2-back.html",
    "pmc-s2-chest-biceps.html",
    "pmc-s2-cst.html",
    "pmc-s2-legs-day2.html",
    "pmc-s2-legs-quad.html",
    "pmc-s3-back-bis-forearms.html",
    "pmc-s3-back.html",
    "pmc-s3-chest.html",
    "pmc-s3-legs.html",
    "pmc-s3-shoulders-tris.html",
    "pmc-s4-bis-tris.html",
    "pmc-s4-chest-tris.html",
    "pmc-s4-legs-back.html",
    "pmc-s4-legs-day2.html",
    "pmc-s4-shoulders.html",
    "pmc-s5-core.html",
    "pmc-s5-legs.html",
    "pmc-s5-pull.html",
    "pmc-s5-push.html",
    "pmc-s6-abs-circuit.html",
    "pmc-s6-back-traps.html",
    "pmc-s6-chest.html",
    "pmc-s6-delts-arms.html",
    "pmc-s6-legs.html",
    "pmc-s7-giant.html",
    # Other programs
    "2on-1off.html",
    "3on-1off-high-freq.html",
    "45-minute-burner.html",
    "5on-2off.html",
    "battle-ropes.html",
    "boxing-routine.html",
    "bro-split.html",
    "cat-gainz.html",
    "driveway-demolition.html",
    "every-arms-day.html",
    "every-chest-day.html",
    "full-body-pyramid.html",
    "hell-week.html",
    "legacy-prep.html",
    "lets-get-shredded.html",
    "mens-lean-bulk.html",
    "mens-shred.html",
    "popeye.html",
    "psu-strength.html",
    "push-pull-legs.html",
    "the-500.html",
    "turn-and-burn.html",
    "weeks-to-open.html",
]

API     = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
}

def api_req(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return (json.loads(body) if body else {}), e.code

def get_sha(repo_path):
    r, s = api_req("GET", f"{API}/{repo_path}")
    return r.get("sha") if s == 200 else None

def push_file(filename):
    if not os.path.exists(filename):
        print(f"  SKIP (not found locally): {filename}")
        return "skip"
    with open(filename, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    sha    = get_sha(filename)
    action = "UPDATE" if sha else "CREATE"
    payload = {"message": f"restore-wave3: {filename}", "content": content, "branch": BRANCH}
    if sha:
        payload["sha"] = sha
    r, st = api_req("PUT", f"{API}/{filename}", payload)
    if st in (200, 201):
        print(f"  OK {action:<7} {filename}")
        return "ok"
    if st == 409:
        sha = get_sha(filename)
        if sha:
            payload["sha"] = sha
        r, st = api_req("PUT", f"{API}/{filename}", payload)
        if st in (200, 201):
            print(f"  OK {action:<7} {filename} (retry)")
            return "ok"
    print(f"  FAIL {filename} — {st}: {r.get('message', '')}")
    return "fail"

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"\nRestoring Wave 3 to {len(FILES)} programs → {REPO_OWNER}/{REPO_NAME} [main]\n")
    ok = fail = skip = 0
    for filename in FILES:
        result = push_file(filename)
        if result == "ok":     ok   += 1
        elif result == "skip": skip += 1
        else:                  fail += 1
    print(f"\n{'─'*50}")
    print(f"  Restored: {ok}  Skipped: {skip}  Failed: {fail}")
    print(f"\n  Live: https://{REPO_OWNER}.github.io/{REPO_NAME}/")
    print(f"\n  NOTE: Close app, wait 2 min, reopen to clear service worker cache.\n")
    if fail:
        sys.exit(1)

if __name__ == "__main__":
    main()
