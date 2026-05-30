#!/usr/bin/env python3
"""
force-deploy.py — Hard-override deploy: pushes ALL local HTML/JS/JSON to GitHub.
Token is read from the GITHUB_TOKEN environment variable (never hardcoded).

Usage:
    GITHUB_TOKEN=ghp_... python3 force-deploy.py
    GITHUB_TOKEN=ghp_... python3 force-deploy.py --files cat-pmc.html cat-pump-new4.html
"""
import os, sys, base64, json, glob, urllib.request, urllib.error, argparse

REPO_OWNER = "mcross2298"
REPO_NAME  = "4-Weeks-to-Open-"
BRANCH     = "main"

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
if not GITHUB_TOKEN:
    print("ERROR: Set GITHUB_TOKEN env var before running.")
    print("  export GITHUB_TOKEN=ghp_<your_personal_access_token>")
    sys.exit(1)

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

def push_file(local_path, repo_path):
    if not os.path.exists(local_path):
        print(f"  SKIP (not found): {local_path}")
        return "skip"

    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()

    sha    = get_sha(repo_path)
    action = "UPDATE" if sha else "CREATE"
    payload = {"message": f"force-deploy: {repo_path}", "content": content, "branch": BRANCH}
    if sha:
        payload["sha"] = sha

    r, st = api_req("PUT", f"{API}/{repo_path}", payload)

    if st in (200, 201):
        print(f"  OK {action:<7} {repo_path}")
        return "ok"

    # Single retry on 409 SHA conflict (stale SHA race condition)
    if st == 409:
        sha = get_sha(repo_path)
        if sha:
            payload["sha"] = sha
        r, st = api_req("PUT", f"{API}/{repo_path}", payload)
        if st in (200, 201):
            print(f"  OK {action:<7} {repo_path} (retry)")
            return "ok"

    print(f"  FAIL {repo_path} — {st}: {r.get('message', '')}")
    return "fail"

def discover_files():
    exts = ("*.html", "*.js", "*.json")
    files = []
    for pattern in exts:
        files.extend(glob.glob(pattern))
    files.sort()
    return [(f, f) for f in files]

def main():
    parser = argparse.ArgumentParser(description="Force-push local files to GitHub Pages.")
    parser.add_argument("--files", nargs="*", help="Specific filenames to deploy (default: all .html/.js/.json)")
    args = parser.parse_args()

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    if args.files:
        file_pairs = [(f, f) for f in args.files]
    else:
        file_pairs = discover_files()

    print(f"\nForce-deploying {len(file_pairs)} files → {REPO_OWNER}/{REPO_NAME} [{BRANCH}]\n")

    ok = fail = skip = 0
    for local, repo in file_pairs:
        result = push_file(local, repo)
        if result == "ok":     ok   += 1
        elif result == "skip": skip += 1
        else:                  fail += 1

    print(f"\n{'─'*50}")
    print(f"  Deployed: {ok}  Skipped: {skip}  Failed: {fail}")
    print(f"\n  Live: https://{REPO_OWNER}.github.io/{REPO_NAME}/")
    print(f"\n  NOTE: Close app, wait 2 min, reopen to clear service worker cache.\n")
    if fail:
        sys.exit(1)

if __name__ == "__main__":
    main()
