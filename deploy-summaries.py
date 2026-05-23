#!/usr/bin/env python3
"""deploy-summaries.py — Deploy all 37 workout summary fixes"""
import os,sys,base64,json,urllib.request,urllib.error

GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"
REPO_OWNER   = "mcross2298"
REPO_NAME    = "4-Weeks-to-Open-"
BRANCH       = "main"

FILES = [
  ("pmc-back.html","pmc-back.html"),("pmc-bis-tris.html","pmc-bis-tris.html"),
  ("pmc-chest-shoulders.html","pmc-chest-shoulders.html"),("pmc-legs-hams.html","pmc-legs-hams.html"),
  ("pmc-legs-quad.html","pmc-legs-quad.html"),("weeks-to-open.html","weeks-to-open.html"),
  ("push-pull-legs.html","push-pull-legs.html"),("legacy-prep.html","legacy-prep.html"),
  ("bro-split.html","bro-split.html"),("s3-back-traps.html","s3-back-traps.html"),
  ("s3-chest-biceps.html","s3-chest-biceps.html"),("s3-shoulders-triceps.html","s3-shoulders-triceps.html"),
  ("s3-upper-body.html","s3-upper-body.html"),("mens-lean-bulk.html","mens-lean-bulk.html"),
  ("mens-shred.html","mens-shred.html"),("lets-get-shredded.html","lets-get-shredded.html"),
  ("every-chest-day.html","every-chest-day.html"),("every-arms-day.html","every-arms-day.html"),
  ("5on-2off.html","5on-2off.html"),("3on-1off-high-freq.html","3on-1off-high-freq.html"),
  ("2on-1off.html","2on-1off.html"),("bis-tris-pump.html","bis-tris-pump.html"),
  ("shoulders-back-pump.html","shoulders-back-pump.html"),("hams-glutes-pump.html","hams-glutes-pump.html"),
  ("back-traps-pump.html","back-traps-pump.html"),("chest-tri-pump.html","chest-tri-pump.html"),
  ("shoulders-bis-forearms-pump.html","shoulders-bis-forearms-pump.html"),
  ("legs-pump.html","legs-pump.html"),("bonus-pump-lats.html","bonus-pump-lats.html"),
  ("bonus-pump-cst.html","bonus-pump-cst.html"),("45-minute-burner.html","45-minute-burner.html"),
  ("battle-ropes.html","battle-ropes.html"),("boxing-routine.html","boxing-routine.html"),
  ("driveway-demolition.html","driveway-demolition.html"),("hell-week.html","hell-week.html"),
  ("popeye.html","popeye.html"),("psu-strength.html","psu-strength.html"),
]

API = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {"Authorization":f"token {GITHUB_TOKEN}","Accept":"application/vnd.github.v3+json","Content-Type":"application/json"}

def api(method,url,data=None):
    b=json.dumps(data).encode() if data else None
    req=urllib.request.Request(url,data=b,headers=HEADERS,method=method)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read()),r.status
    except urllib.error.HTTPError as e:
        b=e.read().decode(); return json.loads(b) if b else {},e.code

def sha(p):
    r,s=api("GET",f"{API}/{p}"); return r.get("sha") if s==200 else None

def push(local,repo):
    if not os.path.exists(local): print(f"  ⚠️  SKIP: {local}"); return False
    with open(local,"rb") as f: content=base64.b64encode(f.read()).decode()
    s=sha(repo); action="UPDATE" if s else "CREATE"
    payload={"message":f"feat: workout summary {repo}","content":content,"branch":BRANCH}
    if s: payload["sha"]=s
    r,st=api("PUT",f"{API}/{repo}",payload)
    if st in(200,201): print(f"  ✅ {action:<7} {repo}"); return True
    print(f"  ❌ FAILED {repo} — {st}: {r.get('message','')}"); return False

def main():
    if GITHUB_TOKEN=="YOUR_PERSONAL_ACCESS_TOKEN_HERE":
        print("\n⛔  Set your GITHUB_TOKEN first.\n"); sys.exit(1)
    print(f"\n🚀 Deploying {len(FILES)} summary fixes → {REPO_OWNER}/{REPO_NAME}\n")
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    p=f=sk=0
    for local,repo in FILES:
        r=push(local,repo)
        if r is True: p+=1
        elif not os.path.exists(local): sk+=1
        else: f+=1
    print(f"\n{'─'*50}")
    print(f"  ✅ Deployed: {p}  ⚠️  Skipped: {sk}  ❌ Failed: {f}")
    print(f"\n  View: https://{REPO_OWNER}.github.io/{REPO_NAME}/\n")

if __name__=="__main__": main()
