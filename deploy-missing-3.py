#!/usr/bin/env python3
"""
deploy-missing-3.py — Deploy the 3 files missing from workout-site-FINAL.zip
Targets: quads-pump.html, s4-pull.html, s4-push.html

Usage: python3 deploy-missing-3.py
Place this file in the SAME folder as your HTML files.
"""

import os
import sys
import base64
import json
import urllib.request
import urllib.error

# ─── CONFIGURE THESE ──────────────────────────────────────────────────────────
GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"   # https://github.com/settings/tokens
REPO_OWNER   = "mcross2298"
REPO_NAME    = "4-Weeks-to-Open-"
BRANCH       = "main"

# ─── FILES TO DEPLOY ──────────────────────────────────────────────────────────
FILES = [
    ("quads-pump.html",    "quads-pump.html"),
    ("s4-pull.html",       "s4-pull.html"),
    ("s4-push.html",       "s4-push.html"),
    ("cat-pump-new4.html", "cat-pump.html"),   # updates Split #1 count + adds quads link
]

# ─── ENGINE — do not edit below ───────────────────────────────────────────────

API = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
}

def api_request(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return json.loads(body) if body else {}, e.code

def get_sha(repo_path):
    resp, status = api_request("GET", f"{API}/{repo_path}")
    if status == 200:
        return resp.get("sha")
    return None

def push_file(local_path, repo_path):
    if not os.path.exists(local_path):
        print(f"  ⚠️  SKIP  — file not found locally: {local_path}")
        return False

    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()

    sha = get_sha(repo_path)
    action = "UPDATE" if sha else "CREATE"

    payload = {
        "message": f"deploy: {action.lower()} {repo_path}",
        "content": content,
        "branch": BRANCH,
    }
    if sha:
        payload["sha"] = sha

    resp, status = api_request("PUT", f"{API}/{repo_path}", payload)

    if status in (200, 201):
        print(f"  ✅  {action:<7} {repo_path}")
        return True
    else:
        msg = resp.get("message", "unknown error")
        print(f"  ❌  FAILED  {repo_path} — {status}: {msg}")
        return False

def main():
    if GITHUB_TOKEN == "YOUR_PERSONAL_ACCESS_TOKEN_HERE":
        print("\n⛔  ERROR: Set your GITHUB_TOKEN before running.")
        print("   → Go to https://github.com/settings/tokens")
        print("   → Generate a token with 'repo' scope")
        print("   → Paste it into this file where it says YOUR_PERSONAL_ACCESS_TOKEN_HERE\n")
        sys.exit(1)

    print(f"\n🚀 Deploying 4 files to {REPO_OWNER}/{REPO_NAME} (branch: {BRANCH})")
    print(f"   Files: quads-pump.html · s4-pull.html · s4-push.html · cat-pump.html\n")

    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    passed = 0
    failed = 0
    skipped = 0

    for local_path, repo_path in FILES:
        result = push_file(local_path, repo_path)
        if result is True:
            passed += 1
        elif result is False and not os.path.exists(local_path):
            skipped += 1
        else:
            failed += 1

    print(f"\n{'─'*50}")
    print(f"  ✅ Deployed:  {passed}")
    print(f"  ⚠️  Skipped:   {skipped}  (file not found locally)")
    print(f"  ❌ Failed:    {failed}")
    print(f"\n  GitHub Pages usually updates within 1-2 minutes.")
    print(f"  View site: https://{REPO_OWNER}.github.io/{REPO_NAME}/\n")

if __name__ == "__main__":
    main()
