#!/usr/bin/env python3
"""
deploy-timer-fix.py — Fix timers in 11 workout files
(9 Faint of Heart + pmc-s5-core + pmc-s6-abs-circuit)
"""
import os, sys, base64, json, urllib.request, urllib.error

GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"
REPO_OWNER   = "mcross2298"
REPO_NAME    = "4-Weeks-to-Open-"
BRANCH       = "main"

FILES = [
    ("the-500.html",             "the-500.html"),
    ("driveway-demolition.html", "driveway-demolition.html"),
    ("hell-week.html",           "hell-week.html"),
    ("turn-and-burn.html",       "turn-and-burn.html"),
    ("full-body-pyramid.html",   "full-body-pyramid.html"),
    ("45-minute-burner.html",    "45-minute-burner.html"),
    ("popeye.html",              "popeye.html"),
    ("boxing-routine.html",      "boxing-routine.html"),
    ("battle-ropes.html",        "battle-ropes.html"),
    ("pmc-s5-core.html",         "pmc-s5-core.html"),
    ("pmc-s6-abs-circuit.html",  "pmc-s6-abs-circuit.html"),
]

API     = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json"}

def api_request(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        b = e.read().decode(); return json.loads(b) if b else {}, e.code

def get_sha(p):
    r, s = api_request("GET", f"{API}/{p}"); return r.get("sha") if s == 200 else None

def push_file(local, repo):
    if not os.path.exists(local):
        print(f"  ⚠️  SKIP — not found: {local}"); return False
    with open(local,"rb") as f: content = base64.b64encode(f.read()).decode()
    sha = get_sha(repo); action = "UPDATE" if sha else "CREATE"
    payload = {"message": f"fix: timer {repo}", "content": content, "branch": BRANCH}
    if sha: payload["sha"] = sha
    r, s = api_request("PUT", f"{API}/{repo}", payload)
    if s in (200,201): print(f"  ✅  {action:<7} {repo}"); return True
    print(f"  ❌  FAILED {repo} — {s}: {r.get('message','')}"); return False

def main():
    if GITHUB_TOKEN == "YOUR_PERSONAL_ACCESS_TOKEN_HERE":
        print("\n⛔  Set your GITHUB_TOKEN first.\n   → https://github.com/settings/tokens\n"); sys.exit(1)
    print(f"\n🚀 Deploying {len(FILES)} timer fixes → {REPO_OWNER}/{REPO_NAME}\n")
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    passed = failed = skipped = 0
    for local, repo in FILES:
        r = push_file(local, repo)
        if r is True: passed += 1
        elif not os.path.exists(local): skipped += 1
        else: failed += 1
    print(f"\n{'─'*50}")
    print(f"  ✅ Deployed: {passed}  ⚠️  Skipped: {skipped}  ❌ Failed: {failed}")
    print(f"\n  View: https://{REPO_OWNER}.github.io/{REPO_NAME}/\n")

if __name__ == "__main__": main()
