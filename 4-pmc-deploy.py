#!/usr/bin/env python3
# Group 4-pmc: 40 files
import os,sys,base64,json,urllib.request,urllib.error

GITHUB_TOKEN="YOUR_GITHUB_TOKEN_HERE"
REPO_OWNER="mcross2298"
REPO_NAME="4-Weeks-to-Open-"
BRANCH="main"

FILES=[
    ("cat-pmc.html","cat-pmc.html"),
    ("pmc-back.html","pmc-back.html"),
    ("pmc-bis-tris.html","pmc-bis-tris.html"),
    ("pmc-chest-shoulders.html","pmc-chest-shoulders.html"),
    ("pmc-home.html","pmc-home.html"),
    ("pmc-instructions.html","pmc-instructions.html"),
    ("pmc-legs-hams.html","pmc-legs-hams.html"),
    ("pmc-legs-quad.html","pmc-legs-quad.html"),
    ("pmc-s2-back.html","pmc-s2-back.html"),
    ("pmc-s2-chest-biceps.html","pmc-s2-chest-biceps.html"),
    ("pmc-s2-cst.html","pmc-s2-cst.html"),
    ("pmc-s2-legs-day2.html","pmc-s2-legs-day2.html"),
    ("pmc-s2-legs-quad.html","pmc-s2-legs-quad.html"),
    ("pmc-s3-back-bis-forearms.html","pmc-s3-back-bis-forearms.html"),
    ("pmc-s3-back.html","pmc-s3-back.html"),
    ("pmc-s3-chest.html","pmc-s3-chest.html"),
    ("pmc-s3-legs.html","pmc-s3-legs.html"),
    ("pmc-s3-shoulders-tris.html","pmc-s3-shoulders-tris.html"),
    ("pmc-s4-bis-tris.html","pmc-s4-bis-tris.html"),
    ("pmc-s4-chest-tris.html","pmc-s4-chest-tris.html"),
    ("pmc-s4-legs-back.html","pmc-s4-legs-back.html"),
    ("pmc-s4-legs-day2.html","pmc-s4-legs-day2.html"),
    ("pmc-s4-shoulders.html","pmc-s4-shoulders.html"),
    ("pmc-s5-core.html","pmc-s5-core.html"),
    ("pmc-s5-legs.html","pmc-s5-legs.html"),
    ("pmc-s5-pull.html","pmc-s5-pull.html"),
    ("pmc-s5-push.html","pmc-s5-push.html"),
    ("pmc-s6-abs-circuit.html","pmc-s6-abs-circuit.html"),
    ("pmc-s6-back-traps.html","pmc-s6-back-traps.html"),
    ("pmc-s6-chest.html","pmc-s6-chest.html"),
    ("pmc-s6-delts-arms.html","pmc-s6-delts-arms.html"),
    ("pmc-s6-legs.html","pmc-s6-legs.html"),
    ("pmc-s7-giant.html","pmc-s7-giant.html"),
    ("pmc-split1.html","pmc-split1.html"),
    ("pmc-split2.html","pmc-split2.html"),
    ("pmc-split3.html","pmc-split3.html"),
    ("pmc-split4.html","pmc-split4.html"),
    ("pmc-split5.html","pmc-split5.html"),
    ("pmc-split6.html","pmc-split6.html"),
    ("pmc-split7.html","pmc-split7.html"),
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
