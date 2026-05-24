#!/usr/bin/env python3
# Group 1-infra: 4 files
import os,sys,base64,json,urllib.request,urllib.error

GITHUB_TOKEN="ghp_dkCxPFypC5TcmE2Mij1LOwE43zYh7"
REPO_OWNER="mcross2298"
REPO_NAME="4-Weeks-to-Open-"
BRANCH="main"

FILES=[
    ("sw.js","sw.js"),
    ("manifest.json","manifest.json"),
    ("index-v4.html","index.html"),
    ("exercise-library.html","exercise-library.html"),
]

API="https://api.github.com/repos/"+REPO_OWNER+"/"+REPO_NAME+"/contents"
HEADERS={"Authorization":"token "+GITHUB_TOKEN,"Accept":"application/vnd.github.v3+json","Content-Type":"application/json"}
def api(m,u,d=None):
    b=json.dumps(d).encode() if d else None
    req=urllib.request.Request(u,data=b,headers=HEADERS,method=m)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read()),r.status
    except urllib.error.HTTPError as e:
        b=e.read().decode(); return json.loads(b) if b else {},e.code
def sha(p):
    r,s=api("GET",API+"/"+p); return r.get("sha") if s==200 else None
def push(l,r):
    if not os.path.exists(l): print("  SKIP: "+l); return False
    with open(l,"rb") as f: c=base64.b64encode(f.read()).decode()
    s=sha(r); a="UPDATE" if s else "CREATE"
    p={"message":"deploy: "+r,"content":c,"branch":BRANCH}
    if s: p["sha"]=s
    r2,st=api("PUT",API+"/"+r,p)
    if st in(200,201): print("  OK "+a+" "+r); return True
    print("  FAIL "+r+" "+str(st)); return False
def main():
    if GITHUB_TOKEN=="YOUR_PERSONAL_ACCESS_TOKEN_HERE":
        print("Set GITHUB_TOKEN first."); sys.exit(1)
    print("Deploying "+str(len(FILES))+" files...")
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    p=f=sk=0
    for l,r in FILES:
        x=push(l,r)
        if x is True: p+=1
        elif not os.path.exists(l): sk+=1
        else: f+=1
    print("Done: "+str(p)+" deployed "+str(sk)+" skipped "+str(f)+" failed")
    print("View: https://"+REPO_OWNER+".github.io/"+REPO_NAME+"/")
if __name__=="__main__": main()
