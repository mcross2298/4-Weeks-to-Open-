#!/usr/bin/env python3
import os, sys, base64, json, urllib.request, urllib.error

GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"
REPO_OWNER   = "mcross2298"
REPO_NAME    = "4-Weeks-to-Open-"
BRANCH       = "main"

FILES = [
    ("sw.js", "sw.js"),
    ("manifest.json", "manifest.json"),
    ("index-v4.html", "index.html"),
    ("2on-1off.html", "2on-1off.html"),
    ("3on-1off-high-freq.html", "3on-1off-high-freq.html"),
    ("45-minute-burner.html", "45-minute-burner.html"),
    ("5on-2off.html", "5on-2off.html"),
    ("back-traps-pump.html", "back-traps-pump.html"),
    ("battle-ropes.html", "battle-ropes.html"),
    ("bis-tris-pump.html", "bis-tris-pump.html"),
    ("bonus-pump-cst.html", "bonus-pump-cst.html"),
    ("bonus-pump-lats.html", "bonus-pump-lats.html"),
    ("boxing-routine.html", "boxing-routine.html"),
    ("bro-split.html", "bro-split.html"),
    ("cat-faint.html", "cat-faint.html"),
    ("cat-gainz.html", "cat-gainz.html"),
    ("cat-mc.html", "cat-mc.html"),
    ("cat-pmc.html", "cat-pmc.html"),
    ("cat-psu.html", "cat-psu.html"),
    ("cat-pump-new4.html", "cat-pump-new4.html"),
    ("cat-stndr.html", "cat-stndr.html"),
    ("chest-tri-pump.html", "chest-tri-pump.html"),
    ("driveway-demolition.html", "driveway-demolition.html"),
    ("every-arms-day.html", "every-arms-day.html"),
    ("every-chest-day.html", "every-chest-day.html"),
    ("faint-instructions.html", "faint-instructions.html"),
    ("full-body-pyramid.html", "full-body-pyramid.html"),
    ("gainz-instructions.html", "gainz-instructions.html"),
    ("hams-glutes-pump.html", "hams-glutes-pump.html"),
    ("hell-week.html", "hell-week.html"),
    ("legacy-prep.html", "legacy-prep.html"),
    ("legs-pump.html", "legs-pump.html"),
    ("lets-get-shredded.html", "lets-get-shredded.html"),
    ("mc-cardio.html", "mc-cardio.html"),
    ("mc-home.html", "mc-home.html"),
    ("mc-instructions.html", "mc-instructions.html"),
    ("mc-s1-back.html", "mc-s1-back.html"),
    ("mc-s1-bis-tris.html", "mc-s1-bis-tris.html"),
    ("mc-s1-chest-shoulders.html", "mc-s1-chest-shoulders.html"),
    ("mc-s1-legs.html", "mc-s1-legs.html"),
    ("mc-s1-legs2.html", "mc-s1-legs2.html"),
    ("mc-s2-back.html", "mc-s2-back.html"),
    ("mc-s2-chest-bis.html", "mc-s2-chest-bis.html"),
    ("mc-s2-cst.html", "mc-s2-cst.html"),
    ("mc-s2-legs.html", "mc-s2-legs.html"),
    ("mc-s2-legs2.html", "mc-s2-legs2.html"),
    ("mc-s3-back-bis-forearms.html", "mc-s3-back-bis-forearms.html"),
    ("mc-s3-back.html", "mc-s3-back.html"),
    ("mc-s3-chest.html", "mc-s3-chest.html"),
    ("mc-s3-legs-back.html", "mc-s3-legs-back.html"),
    ("mc-s3-legs.html", "mc-s3-legs.html"),
    ("mc-s3-shoulders-tris.html", "mc-s3-shoulders-tris.html"),
    ("mc-s4-bis-tris.html", "mc-s4-bis-tris.html"),
    ("mc-s4-chest-tris.html", "mc-s4-chest-tris.html"),
    ("mc-s4-legs.html", "mc-s4-legs.html"),
    ("mc-s4-shoulders.html", "mc-s4-shoulders.html"),
    ("mc-s5-legs.html", "mc-s5-legs.html"),
    ("mc-s5-pull.html", "mc-s5-pull.html"),
    ("mc-s5-push.html", "mc-s5-push.html"),
    ("mc-split1.html", "mc-split1.html"),
    ("mc-split2.html", "mc-split2.html"),
    ("mc-split3.html", "mc-split3.html"),
    ("mc-split4.html", "mc-split4.html"),
    ("mc-split5.html", "mc-split5.html"),
    ("mens-lean-bulk.html", "mens-lean-bulk.html"),
    ("mens-shred.html", "mens-shred.html"),
    ("pmc-back.html", "pmc-back.html"),
    ("pmc-bis-tris.html", "pmc-bis-tris.html"),
    ("pmc-chest-shoulders.html", "pmc-chest-shoulders.html"),
    ("pmc-home.html", "pmc-home.html"),
    ("pmc-instructions.html", "pmc-instructions.html"),
    ("pmc-legs-hams.html", "pmc-legs-hams.html"),
    ("pmc-legs-quad.html", "pmc-legs-quad.html"),
    ("pmc-s2-back.html", "pmc-s2-back.html"),
    ("pmc-s2-chest-biceps.html", "pmc-s2-chest-biceps.html"),
    ("pmc-s2-cst.html", "pmc-s2-cst.html"),
    ("pmc-s2-legs-day2.html", "pmc-s2-legs-day2.html"),
    ("pmc-s2-legs-quad.html", "pmc-s2-legs-quad.html"),
    ("pmc-s3-back-bis-forearms.html", "pmc-s3-back-bis-forearms.html"),
    ("pmc-s3-back.html", "pmc-s3-back.html"),
    ("pmc-s3-chest.html", "pmc-s3-chest.html"),
    ("pmc-s3-legs.html", "pmc-s3-legs.html"),
    ("pmc-s3-shoulders-tris.html", "pmc-s3-shoulders-tris.html"),
    ("pmc-s4-bis-tris.html", "pmc-s4-bis-tris.html"),
    ("pmc-s4-chest-tris.html", "pmc-s4-chest-tris.html"),
    ("pmc-s4-legs-back.html", "pmc-s4-legs-back.html"),
    ("pmc-s4-legs-day2.html", "pmc-s4-legs-day2.html"),
    ("pmc-s4-shoulders.html", "pmc-s4-shoulders.html"),
    ("pmc-s5-core.html", "pmc-s5-core.html"),
    ("pmc-s5-legs.html", "pmc-s5-legs.html"),
    ("pmc-s5-pull.html", "pmc-s5-pull.html"),
    ("pmc-s5-push.html", "pmc-s5-push.html"),
    ("pmc-s6-abs-circuit.html", "pmc-s6-abs-circuit.html"),
    ("pmc-s6-back-traps.html", "pmc-s6-back-traps.html"),
    ("pmc-s6-chest.html", "pmc-s6-chest.html"),
    ("pmc-s6-delts-arms.html", "pmc-s6-delts-arms.html"),
    ("pmc-s6-legs.html", "pmc-s6-legs.html"),
    ("pmc-s7-giant.html", "pmc-s7-giant.html"),
    ("pmc-split1.html", "pmc-split1.html"),
    ("pmc-split2.html", "pmc-split2.html"),
    ("pmc-split3.html", "pmc-split3.html"),
    ("pmc-split4.html", "pmc-split4.html"),
    ("pmc-split5.html", "pmc-split5.html"),
    ("pmc-split6.html", "pmc-split6.html"),
    ("pmc-split7.html", "pmc-split7.html"),
    ("popeye.html", "popeye.html"),
    ("psu-strength.html", "psu-strength.html"),
    ("pump-instructions.html", "pump-instructions.html"),
    ("push-pull-legs.html", "push-pull-legs.html"),
    ("quads-pump.html", "quads-pump.html"),
    ("s3-back-traps.html", "s3-back-traps.html"),
    ("s3-chest-biceps.html", "s3-chest-biceps.html"),
    ("s3-shoulders-triceps.html", "s3-shoulders-triceps.html"),
    ("s3-upper-body.html", "s3-upper-body.html"),
    ("s4-pull.html", "s4-pull.html"),
    ("s4-push.html", "s4-push.html"),
    ("shoulders-back-pump.html", "shoulders-back-pump.html"),
    ("shoulders-bis-forearms-pump.html", "shoulders-bis-forearms-pump.html"),
    ("stndr-instructions.html", "stndr-instructions.html"),
    ("the-500.html", "the-500.html"),
    ("turn-and-burn.html", "turn-and-burn.html"),
    ("weeks-to-open.html", "weeks-to-open.html"),
]

API = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents"
HEADERS = {"Authorization":"token "+GITHUB_TOKEN,"Accept":"application/vnd.github.v3+json","Content-Type":"application/json"}

def api_req(method,url,data=None):
    body=json.dumps(data).encode() if data else None
    req=urllib.request.Request(url,data=body,headers=HEADERS,method=method)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read()),r.status
    except urllib.error.HTTPError as e:
        b=e.read().decode(); return json.loads(b) if b else {},e.code

def get_sha(p):
    r,s=api_req("GET",API+"/"+p)
    return r.get("sha") if s==200 else None

def push(local,repo):
    if not os.path.exists(local): print("  SKIP: "+local); return False
    with open(local,"rb") as f: content=base64.b64encode(f.read()).decode()
    sha=get_sha(repo); action="UPDATE" if sha else "CREATE"
    payload={"message":"quick-wins: progress+timer+rv+offline "+repo,"content":content,"branch":BRANCH}
    if sha: payload["sha"]=sha
    r,st=api_req("PUT",API+"/"+repo,payload)
    if st in(200,201): print("  OK "+action+" "+repo); return True
    print("  FAIL "+repo+" -- "+str(st)); return False

def main():
    if GITHUB_TOKEN=="YOUR_PERSONAL_ACCESS_TOKEN_HERE":
        print("Set your GITHUB_TOKEN first."); sys.exit(1)
    print("Deploying "+str(len(FILES))+" files (Quick Wins)...")
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    p=f=sk=0
    for local,repo in FILES:
        r=push(local,repo)
        if r is True: p+=1
        elif not os.path.exists(local): sk+=1
        else: f+=1
    print("Done: "+str(p)+" deployed, "+str(sk)+" skipped, "+str(f)+" failed")
    print("")
    print("IMPORTANT: Close the app, wait 2 min, reopen.")
    print("The v3 service worker will clear old cache automatically.")
    print("View: https://"+REPO_OWNER+".github.io/"+REPO_NAME+"/")

if __name__=="__main__": main()
