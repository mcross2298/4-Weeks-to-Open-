#!/usr/bin/env python3
"""
2-programs-deploy.py
Phase 2 : New leg-day pages  (mc-s1-quads-calves.html, mc-s3-legs-quads.html)
Phase 6 : MC Favorite Splits  – Weeks 2, 3, 4 injected into all 23 workout files
"""
import os, sys, re, base64, json, urllib.request, urllib.error

GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"
REPO_OWNER   = "mcross2298"
REPO_NAME    = "4-Weeks-to-Open-"
BRANCH       = "main"

API     = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents"
HEADERS = {"Authorization": f"token {GITHUB_TOKEN}",
           "Accept": "application/vnd.github.v3+json",
           "Content-Type": "application/json"}

# ── GitHub helpers ──────────────────────────────────────────────────────────
def gh(method, url, data=None):
    body = json.dumps(data).encode() if data else None
    req  = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        b = e.read().decode()
        return (json.loads(b) if b else {}), e.code

def remote_sha(path):
    r, s = gh("GET", f"{API}/{path}")
    return r.get("sha") if s == 200 else None

def deploy_file(local_path, remote_path):
    if not os.path.exists(local_path):
        print(f"  SKIP (missing): {local_path}"); return False
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    sha   = remote_sha(remote_path)
    verb  = "UPDATE" if sha else "CREATE"
    body  = {"message": f"deploy: {remote_path}", "content": content, "branch": BRANCH}
    if sha: body["sha"] = sha
    _, st = gh("PUT", f"{API}/{remote_path}", body)
    if st in (200, 201):
        print(f"  OK {verb} {remote_path}"); return True
    print(f"  FAIL {remote_path} (HTTP {st})"); return False

# ── Exercise-dict helpers ────────────────────────────────────────────────────
P  = ['tb-pyramid']
LR = ['tb-lowrep']
TM = ['tb-tempo']
HR = ['tb-highrep']
MS = ['tb-midset']
DR = ['tb-drop']
AM = ['tb-amrap']
HS = ['tb-highset']

def s(num, name, sets, b, note=None):
    d = {'type':'single','num':num,'name':name,'sets':sets,'b':b}
    if note: d['note'] = note
    return d

def ss(num, an, ases, ab, bn, bses, bb, anote=None, bnote=None):
    a = {'name':an,'sets':ases,'b':ab}
    b = {'name':bn,'sets':bses,'b':bb}
    if anote: a['note'] = anote
    if bnote: b['note'] = bnote
    return {'type':'ss','num':num,'a':a,'b':b}

# ── JS serialiser ────────────────────────────────────────────────────────────
def _jv(v):
    if isinstance(v, bool):  return 'true' if v else 'false'
    if v is None:            return 'null'
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, str):
        return "'" + v.replace("\\","\\\\").replace("'","\\'") + "'"
    if isinstance(v, list):
        return '[' + ','.join(_jv(i) for i in v) + ']'
    if isinstance(v, dict):
        return '{' + ','.join(f"{k}:{_jv(val)}" for k, val in v.items()) + '}'
    return str(v)

def weeks_js(additions: dict) -> str:
    """additions = {2:[...], 3:[...], 4:[...]}"""
    parts = []
    for wk in sorted(additions):
        items = ','.join(_jv(e) for e in additions[wk])
        parts.append(f",\n  {wk}:[{items}]")
    return ''.join(parts)

# ── File patcher ─────────────────────────────────────────────────────────────
def patch_weeks(filepath, additions: dict):
    """Append week 2/3/4 blocks to an existing workout HTML file."""
    with open(filepath, encoding='utf-8') as f:
        html = f.read()
    # Skip if already patched
    if '  2:[' in html:
        print(f"  SKIP (already patched): {os.path.basename(filepath)}")
        return False
    # Find end of DATA block: ...last-array-item]};
    idx = html.find('const DATA={')
    if idx == -1:
        print(f"  ERR no DATA block: {filepath}"); return False
    close = html.find(']};', idx)
    if close == -1:
        print(f"  ERR no DATA end: {filepath}"); return False
    insert = weeks_js(additions)
    new_html = html[:close+1] + insert + '\n' + html[close+1:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_html)
    print(f"  PATCHED: {os.path.basename(filepath)}")
    return True

# ════════════════════════════════════════════════════════════════════════════
#  WEEK 2 / 3 / 4 DATA FOR ALL 23 MC WORKOUT FILES
# ════════════════════════════════════════════════════════════════════════════

PATCHES = {}

# ── mc-s1-legs.html ──────────────────────────────────────────────────────────
PATCHES['mc-s1-legs.html'] = {
  2:[
    ss(1,'Quad Extensions','12,10,8,8',P,'Romanian Deadlifts','5x5',LR,
       'Pyramid up · squeeze at top','Heavy bilateral · reset each rep'),
    ss(2,'Seated Hamstring Curl','5x12',HS,'Wide Stance Barbell or Goblet Squats','4x12',MS,
       '2 sec pause at peak','Upright torso · deep squat'),
    s(3,'Smith Machine Split Squats','3xfailure',AM,'Push to failure · slow controlled descent'),
    s(4,'Quad Extensions','4x15',HR,'High rep burnout · squeeze at top'),
    s(5,'Calf Raises','5x20',HR,'20 reps · 2 sec pause at top · 1:0:1:2'),
  ],
  3:[
    ss(1,'Quad Extensions','5x12',HS,'Romanian Deadlifts','4x10',MS,
       'High sets · squeeze at top','Bilateral DBs · feel the stretch'),
    s(2,'Leg Press (feet together, close stance)','12,10,8,8',P,'Pyramid up · full ROM'),
    s(3,'DB Walking Lunges','4x12 each leg',MS,'Torso upright · drive through front heel'),
    s(4,'Smith Machine Hip Thrust','4x15',HR,'Full hip extension · 2 sec squeeze at top'),
    s(5,'Calf Raises','5x20',HR,'20 reps · 2 sec pause at top'),
  ],
  4:[
    ss(1,'Quad Extensions','12,10,8,8',P,'Romanian Deadlifts','5x12',HS,
       'Pyramid up · 4 sec negative','High sets · controlled eccentric'),
    s(2,'Leg Press (feet together, close stance)','5x5',LR,'Heavy · slow descent'),
    s(3,'DB Walking Lunges','3xfailure',AM,'Walk to technical failure each set'),
    s(4,'Smith Machine Hip Thrust','4x10',MS,'3 sec negative on the way down'),
    s(5,'Calf Raises','4x12',MS,'2 sec pause at top and bottom'),
  ],
}

# ── mc-s1-chest-shoulders.html ───────────────────────────────────────────────
PATCHES['mc-s1-chest-shoulders.html'] = {
  2:[
    s(1,'High Incline DB Flies','5x12',HS,'High sets · deep stretch at bottom'),
    s(2,'Incline Barbell or DB Press','12,10,8,8',P,'Pyramid up · drive the bar'),
    s(3,'Slight Incline DB Press','4x15',HR,'High rep · full ROM · controlled descent'),
    ss(4,'Pronated DB Flies','4x10',MS,'Side Lateral Raises','4x20',HR,
       '2 sets out front · 2 sets to side','High rep pump · squeeze at top'),
    s(5,'Arnold Press','5x5',LR,'Heavy · full rotation · 3 sec negative'),
    ss(6,'Incline Bench DB Front Raises','4x12',MS,'Shrugs','5x12',HS,
       'Strict anterior delt focus','High sets · 2 sec pause at top'),
  ],
  3:[
    s(1,'High Incline DB Flies','12,10,8,8',P,'Pyramid up · deep stretch at bottom'),
    s(2,'Incline Barbell or DB Press','5x5',LR,'Heavy compound · drive the bar'),
    s(3,'Slight Incline DB Press','5x12',HS,'High sets · full ROM'),
    s(4,'Cable Lateral Raises','4x15',HR,'Constant tension · squeeze at top'),
    s(5,'Seated DB Shoulder Press','4x10',MS,'Strict press · 2 sec negative'),
    s(6,'DB Rear Delt Fly','4x12',MS,'Bilateral · squeeze rear delts at peak'),
  ],
  4:[
    s(1,'High Incline DB Flies','4x15',HR,'High rep pump · squeeze at top'),
    s(2,'Incline Barbell or DB Press','5x12',HS,'High sets · full ROM'),
    s(3,'Slight Incline DB Press','12,10,8,8',P,'Pyramid up · increase weight each set'),
    s(4,'Cable Lateral Raises','4x10',MS,'2 sec pause at top'),
    s(5,'Seated DB Shoulder Press','4x20',HR,'High rep · moderate weight'),
    s(6,'DB Rear Delt Fly','4x15',HR,'12-15 reps · constant tension'),
  ],
}

# ── mc-s1-bis-tris.html ──────────────────────────────────────────────────────
PATCHES['mc-s1-bis-tris.html'] = {
  2:[
    ss(1,'Double Arm DB Curls','12,10,8,8',P,'Dips','5x5',LR,
       'Pyramid up · full supination','Heavy dips · full ROM'),
    ss(2,'Spider Curls','5x12',HS,'Tricep Pushdowns (rope)','4x12',MS,
       'High sets · 2 sec peak hold','Squeeze at bottom · bilateral'),
    ss(3,'Barbell Curls','4x20',HR,'Skull Crushers','5x5',LR,
       '20 reps · squeeze at top','Low rep heavy · 2 sec pause at bottom'),
    ss(4,'Preacher Curls','4x15',HR,'Tricep Dip Machine','5x12',HS,
       'High rep pump · squeeze hard','High sets · bilateral · full ROM'),
  ],
  3:[
    ss(1,'Double Arm DB Curls','5x12',HS,'Dips','4x10',MS,
       'High sets · full supination','Full ROM · lean forward slightly'),
    ss(2,'Barbell Curls','5x5',LR,'Skull Crushers','4x10',MS,
       'Heavy · strict form','2 sec pause at bottom · 1:2:1:0'),
    ss(3,'Cable Curls','4x15',HR,'Overhead Cable Tricep Extension','4x15',HR,
       'Constant tension · squeeze at peak','Full overhead extension · bilateral'),
    ss(4,'Hammer Curls','12,10,8,8',P,'Tricep Kickbacks','4x12',MS,
       'Pyramid · neutral grip · both arms','Bilateral · squeeze at full extension'),
  ],
  4:[
    ss(1,'Double Arm DB Curls','12,10,8,8',P,'Dips','5x12',HS,
       'Pyramid up · full supination','High sets · full ROM'),
    ss(2,'Barbell Curls','4x12',MS,'Skull Crushers','5x5',LR,
       'Moderate weight · strict form','Heavy · 2 sec pause at bottom'),
    ss(3,'Cable Curls','4x10',MS,'Overhead Cable Tricep Extension','5x12',HS,
       '2 sec squeeze at peak','High sets · bilateral'),
    ss(4,'Hammer Curls','4x15',HR,'Tricep Kickbacks','4x20',HR,
       'High rep · both arms','Bilateral · squeeze at full extension'),
  ],
}

# ── mc-s1-back.html ──────────────────────────────────────────────────────────
PATCHES['mc-s1-back.html'] = {
  2:[
    s(1,'Wide Grip Lat Pulldowns','5x12',HS,'High sets · 2 sec pause at bottom · full stretch at top'),
    ss(2,'V Grip Pulldowns','5x5',LR,'Straight Arm Lat Pulldowns','4x12',MS,
       'Low rep · heavy · 2 sec pause','Constant tension · bilateral cable'),
    s(3,'DB Incline Row (6 sets — 2 high / 2 regular / 2 slight)','12,10,8,8',P,
       'Pyramid up · 2 sec pause at top · change angle every 2 sets'),
  ],
  3:[
    s(1,'Wide Grip Lat Pulldowns','5x5 then 5x10',LR+HS+TM,'3-4 sec negatives · full stretch at top'),
    ss(2,'V Grip Pulldowns','4x12',MS,'Straight Arm Lat Pulldowns','4x20',HR,
       '2 sec pause at bottom','20 reps · constant tension'),
    s(3,'Seated Cable Row','12,10,8,8',P,'Pyramid up · 2 sec pause at peak · elbows tight'),
  ],
  4:[
    s(1,'Wide Grip Lat Pulldowns','5x12',HS,'High sets · full stretch at top'),
    ss(2,'V Grip Pulldowns','5x5',LR,'Straight Arm Lat Pulldowns','4x15',HR,
       'Low rep · heavy pull','High rep · constant tension'),
    s(3,'Seated Cable Row','4x10',MS,'2 sec pause at peak · drive elbows back'),
  ],
}

# ── mc-s1-legs2.html ──────────────────────────────────────────────────────────
PATCHES['mc-s1-legs2.html'] = {
  2:[
    s(1,'Quad Extensions','5x12',HS,'High sets · 3 sec negative · squeeze at top'),
    s(2,'Barbell RDLs','12,10,8,8',P,'Pyramid up · strong hip hinge'),
    ss(3,'Seated Hamstring Curls','4x10',MS,'Close Stance Barbell or Goblet Squats','5x5',LR,
       'Controlled · 2 sec pause','Heavy · upright torso'),
    ss(4,'Single Leg RDLs','4x12 drop 15 each',DR,'Single Leg Quad Extension','5x12',HS,
       'Drop set · balance focus','High sets · squeeze at extension'),
    s(5,'Smith Machine Split Squats','3xfailure',AM,'Push to failure · slow descent'),
  ],
  3:[
    s(2,'Barbell RDLs','5x5',LR,'Low rep · heavy · strong hip hinge'),
    s(1,'Leg Press','12,10,8,8',P,'Pyramid up · full ROM'),
    s(3,'Goblet Squat (wide stance, toes out)','4x12',MS,'Heels flat · deep squat'),
    s(4,'DB Walking Lunges','4x15',HR,'Continuous · drive through front heel · required'),
    s(5,'Smith Machine Split Squats','5x12',HS,'3 sec negative · both legs'),
  ],
  4:[
    s(2,'Barbell RDLs','12,10,8,8',P,'Pyramid up · strong hip hinge'),
    s(1,'Leg Press','5x5',LR,'Heavy · slow controlled descent'),
    s(3,'Goblet Squat (wide stance, toes out)','4x15',HR,'High rep · upright torso'),
    s(4,'DB Walking Lunges','4x10',MS,'Torso upright · controlled lunge'),
    s(5,'Smith Machine Split Squats','3xfailure',AM,'Walk to technical failure'),
  ],
}

# ── mc-s2-chest-bis.html ─────────────────────────────────────────────────────
PATCHES['mc-s2-chest-bis.html'] = {
  2:[
    ss(1,'Slight Incline DB Flies','5x12',HS,'Double Arm Hammer Curls','4x12',MS,
       'High sets · deep stretch','Neutral grip · both arms'),
    s(2,'Flat Barbell or DB Press','12,10,8,8',P,'Pyramid up · drive the bar'),
    ss(3,'High Incline DB Press','4x10',MS,'Alternating Incline DB Curl','5x12',HS,
       '2 sec negative · full ROM','High sets · full supination'),
    ss(4,'Fly to Press','4x15',HR,'Concentration Curls','5x5',LR,
       'Fly in press out · pump','Low rep · heavy · squeeze at peak'),
    ss(5,'Single Arm DB Press (AMRAP)','4x20',HR,'Preacher Curls','3xfailure',AM,
       'Moderate weight · high rep','Push to failure · squeeze hard'),
  ],
  3:[
    ss(1,'Cable Chest Fly','12,10,8,8',P,'Cable Curls','4x15',HR,
       'Constant tension · deep stretch','Squeeze at peak · bilateral'),
    s(2,'Flat Barbell or DB Press','5x5',LR,'Low rep · heavy compound press'),
    ss(3,'High Incline DB Press','5x12',HS,'Alternating Incline DB Curl','4x12',MS,
       'High sets · full ROM','Alternate arms · full supination'),
    ss(4,'Pec Deck Fly','4x15',HR,'Spider Curls','4x12',MS,
       '2 sec peak contraction','2 sec pause at top · squeeze hard'),
    ss(5,'Decline DB Press','4x10',MS,'Incline DB Curl','5x12',HS,
       '2 sec negative · tricep emphasis','High sets · full supination'),
  ],
  4:[
    ss(1,'Cable Chest Fly','5x12',HS,'Cable Curls','4x10',MS,
       'High sets · constant tension','2 sec squeeze at peak'),
    s(2,'Flat Barbell or DB Press','12,10,8,8',P,'Pyramid up · drive the bar'),
    ss(3,'High Incline DB Press','4x15',HR,'Alternating Incline DB Curl','5x5',LR,
       'High rep · full ROM','Low rep heavy · full supination'),
    ss(4,'Pec Deck Fly','4x10',MS,'Spider Curls','5x12',HS,
       '2 sec peak hold','High sets · squeeze at top'),
    ss(5,'Decline DB Press','4x20',HR,'Incline DB Curl','12,10,8,8',P,
       'High rep pump','Pyramid up · squeeze at peak'),
  ],
}

# ── mc-s2-legs.html ──────────────────────────────────────────────────────────
PATCHES['mc-s2-legs.html'] = {
  2:[
    s(1,'Smith Machine Split Squats','3xfailure',AM,'Push to failure · slow controlled descent'),
    s(2,'Close Stance Barbell or Goblet Squats','12,10,8,8',P,'Pyramid up · heels elevated'),
    ss(3,'Quad Extensions','5x12',HS,'RDLs (Barbell or DB)','4x10',MS,
       'High sets · squeeze at top','3 sec negative · feel the stretch'),
    ss(4,'Seated Hamstring Curls','5x5',LR,'Quad Extensions (AMRAP)','4x15',HR,
       'Low rep · heavy','High rep burnout'),
    s(5,'Calf Raises','4x20',HR,'20 reps · 2 sec pause at top'),
  ],
  3:[
    s(1,'Smith Machine Split Squats','5x12',HS,'3 sec negative on descent · both legs'),
    s(2,'Leg Press (feet together)','12,10,8,8',P,'Pyramid up · full ROM'),
    ss(3,'Quad Extensions','4x12',MS,'Romanian Deadlifts','5x5',LR,
       '2 sec pause at top','Low rep heavy · bilateral'),
    s(4,'DB Walking Lunges','4x15',HR,'Continuous · drive through front heel · required'),
    s(5,'Calf Raises','5x20',HR,'20 reps · 2 sec pause at top'),
  ],
  4:[
    s(1,'Smith Machine Split Squats','12,10,8,8',P,'Pyramid up · 3 sec negative · both legs'),
    s(2,'Leg Press (feet together)','5x5',LR,'Heavy · slow controlled descent'),
    ss(3,'Quad Extensions','5x12',HS,'Romanian Deadlifts','4x12',MS,
       'High sets · squeeze at top','Bilateral · feel the stretch'),
    s(4,'DB Walking Lunges','4x10',MS,'Torso upright · controlled lunge'),
    s(5,'Calf Raises','4x10',MS,'2 sec pause at top and bottom'),
  ],
}

# ── mc-s2-back.html ──────────────────────────────────────────────────────────
PATCHES['mc-s2-back.html'] = {
  2:[
    s(1,'Incline DB Rows','12,10,8,8',P,'Pyramid up · 2 sec pause at top · change angle'),
    s(2,'Single Arm DB Rows','5x12 each',HS,'High sets · 2 sec pause at top · strict form'),
    ss(3,'Reverse Seated Pulldowns','5x5',LR,'Straight Arm Lat Pulldowns','4x12',MS,
       'Low rep · heavy pull','Constant tension · bilateral cable'),
    s(4,'Tri-Level DB Row (high / regular / slight incline)','4x10',MS,
       '2 sets each angle · 2 sec pause at top'),
  ],
  3:[
    s(1,'Incline DB Rows','5x5 then 5x10',LR+HS+TM,'2 sec pause at top · high sets'),
    s(2,'Seated Cable Row','12,10,8,8',P,'Pyramid up · 2 sec pause at peak · elbows tight'),
    ss(3,'Reverse Seated Pulldowns','4x12',MS,'Straight Arm Lat Pulldowns','4x20',HR,
       'Underhand · squeeze at bottom','20 reps · constant tension'),
    s(4,'T-Bar Row','4x10',MS,'2 sec pause at top · elbows tight · drive back hard'),
  ],
  4:[
    s(1,'Incline DB Rows','5x12',HS,'High sets · 2 sec pause at top'),
    s(2,'Seated Cable Row','5x5',LR,'Low rep heavy · drive elbows back'),
    ss(3,'Reverse Seated Pulldowns','12,10,8,8',P,'Straight Arm Lat Pulldowns','4x15',HR,
       'Pyramid up · underhand grip','High rep · constant tension'),
    s(4,'T-Bar Row','5x12',HS,'High sets · 2 sec pause at peak'),
  ],
}

# ── mc-s2-cst.html (Chest / Shoulders / Tris) ────────────────────────────────
PATCHES['mc-s2-cst.html'] = {
  2:[
    ss(1,'Close Grip Barbell or DB Press','12,10,8,8',P,'Dips','3xfailure',AM,
       'Pyramid up · tricep emphasis','Push to failure · full ROM'),
    ss(2,'Barbell Front Raises','4x20',HR,'Double Arm DB Tricep Extensions','4x15',HR,
       'High rep · anterior delt pump','High rep · overhead · bilateral'),
    ss(3,'Incline Chest Flies','4x10',MS,'Seated Front Raises','5x5',LR,
       'Moderate weight · deep stretch','Low rep · strict form · pause at top'),
  ],
  3:[
    ss(1,'Close Grip Barbell or DB Press','5x5',LR,'Dips','4x10',MS,
       'Low rep · heavy · tricep focus','Full ROM · chest upright'),
    ss(2,'Cable Lateral Raises','4x15',HR,'Rope Pushdowns','4x20',HR,
       'Constant tension · squeeze at top','Bilateral · squeeze at bottom'),
    ss(3,'Pec Deck Fly','12,10,8,8',P,'Overhead DB Tricep Extension','4x12',MS,
       'Pyramid · deep stretch','Bilateral · full overhead extension'),
  ],
  4:[
    ss(1,'Close Grip Barbell or DB Press','12,10,8,8',P,'Dips','5x5',LR,
       'Pyramid · tricep emphasis','Low rep heavy · full ROM'),
    ss(2,'Cable Lateral Raises','4x10',MS,'Rope Pushdowns','5x12',HS,
       '2 sec pause at top','High sets · squeeze at bottom'),
    ss(3,'Pec Deck Fly','4x15',HR,'Overhead DB Tricep Extension','5x5',LR,
       'High rep pump · deep stretch','Low rep · heavy overhead'),
  ],
}

# ── mc-s2-legs2.html ──────────────────────────────────────────────────────────
PATCHES['mc-s2-legs2.html'] = {
  2:[
    ss(1,'Quad Extensions','12,10,8,8',P,'Seated Hamstring Curls','5x12',HS,
       'Pyramid up · squeeze at top','High sets · 2 sec pause at peak'),
    ss(2,'Single Leg Quad Extensions','5x5 each',LR,'Barbell RDLs','12,10,8,8',P,
       'Heavy unilateral · strict form','Pyramid up · strong hip hinge'),
    s(3,'Neutral Stance Goblet Squats','3xfailure',AM,'Push to failure · upright torso'),
    s(4,'Single Leg Split Squats + Calf Raises','5x12 each · 4x20 calves',HS+HR,
       'High sets · controlled descent'),
  ],
  3:[
    ss(1,'Quad Extensions','5x12',HS,'Seated Hamstring Curls','4x10',MS,
       'High sets · 3 sec negative','2 sec pause at peak'),
    s(2,'Barbell RDLs','5x5',LR,'Low rep · heavy · strong hip hinge'),
    s(3,'Leg Press (feet together)','12,10,8,8',P,'Pyramid up · full ROM'),
    s(4,'DB Walking Lunges + Calf Raises','4x12 each · 4x20 calves',MS+HR,
       'Continuous lunges · 2 sec pause calves at top · required'),
  ],
  4:[
    ss(1,'Quad Extensions','12,10,8,8',P,'Seated Hamstring Curls','5x12',HS,
       'Pyramid · squeeze at top','High sets · 2 sec pause'),
    s(2,'Barbell RDLs','4x10',MS,'3 sec negative · bilateral'),
    s(3,'Leg Press (feet together)','5x5',LR,'Heavy · slow descent'),
    s(4,'DB Walking Lunges + Calf Raises','3xfailure · 5x20 calves',AM+HR,
       'Walk to failure · high rep calves'),
  ],
}

# ── mc-s3-back.html ──────────────────────────────────────────────────────────
PATCHES['mc-s3-back.html'] = {
  2:[
    s(1,'Barbell Row','5x10',HS,'High sets · reset each rep · drive elbows back'),
    s(2,'V Grip Pulldowns','12,10,8,8',P,'Pyramid up · 2 sec pause at bottom'),
    s(3,'DB Slight Incline Row','5x5',LR,'Low rep · heavy bilateral · 2 sec pause at top'),
    ss(4,'Reverse Grip Pulldowns','4x20',HR,'Straight Arm Lat Pulldowns','4x12',MS,
       'High rep pump · squeeze at bottom','Constant tension · bilateral'),
    s(5,'High Incline DB Row','12,10,8,8',P,'Pyramid up · 2 sec pause at top'),
  ],
  3:[
    s(1,'Barbell Row','5x5 then 12,10,8,8',LR+P,'Low rep heavy sets → pyramid up'),
    s(2,'V Grip Pulldowns','5x10',HS,'High sets · 2 sec pause at bottom'),
    s(3,'Seated Cable Row','12,10,8,8',P,'Pyramid up · elbows tight · 2 sec pause'),
    ss(4,'Wide Grip Lat Pulldowns','4x12',MS,'Straight Arm Lat Pulldowns','4x20',HR,
       '2 sec pause at bottom','20 reps · constant tension'),
    s(5,'T-Bar Row','4x12',MS,'2 sec pause at top · elbows tight · drive back'),
  ],
  4:[
    s(1,'Barbell Row','5x12',HS,'High sets · drive elbows back hard'),
    s(2,'V Grip Pulldowns','5x5',LR,'Low rep · heavy · 2 sec pause at bottom'),
    s(3,'Seated Cable Row','5x10',HS,'High sets · 2 sec pause at peak'),
    ss(4,'Wide Grip Lat Pulldowns','4x15',HR,'Straight Arm Lat Pulldowns','4x12',MS,
       'High rep · full stretch at top','Constant tension · bilateral cable'),
    s(5,'T-Bar Row','12,10,8,8',P,'Pyramid up · drive elbows back'),
  ],
}

# ── mc-s3-legs.html ──────────────────────────────────────────────────────────
PATCHES['mc-s3-legs.html'] = {
  2:[
    s(1,'Barbell Squats (shoulder width)','12,10,8,8',P,'Pyramid up · increase weight each set'),
    s(2,'Deadlifts','4x10',MS,'Bilateral · 3 sec negative · reset each rep'),
    s(3,'Leg Press','5x5',LR,'Low rep · heavy · full ROM'),
    ss(4,'DB RDLs','5x12',HS,'Close Stance Goblet Squats','4x10',MS,
       'High sets · bilateral · feel the stretch','Heels elevated · upright torso'),
    s(5,'DB Walking Lunges','4x12 each leg',MS,'Torso upright · required for leg days'),
  ],
  3:[
    s(1,'Barbell Squats (shoulder width)','5x10',HS,'High sets · 3 sec negative · 4:0:1:0'),
    s(2,'Deadlifts','5x5',LR,'Low rep · heavy · reset each rep'),
    s(3,'Hack Squat (low foot placement)','12,10,8,8',P,'Pyramid up · quad emphasis'),
    ss(4,'Romanian Deadlifts','4x12',MS,'Goblet Squat (heels elevated, together)','4x15',HR,
       'Bilateral · feel the stretch','High rep · upright torso'),
    s(5,'DB Walking Lunges','4x12 each leg',MS,'Continuous · torso upright · required'),
  ],
  4:[
    s(1,'Barbell Squats (shoulder width)','12,10,8,8',P,'Pyramid up · 3 sec negative'),
    s(2,'Deadlifts','4x10',MS,'3 sec negative · bilateral'),
    s(3,'Hack Squat (low foot placement)','5x5',LR,'Low rep heavy · full depth'),
    ss(4,'Romanian Deadlifts','5x12',HS,'Goblet Squat (heels elevated, together)','4x10',MS,
       'High sets · bilateral','Upright torso · deep squat'),
    s(5,'DB Walking Lunges','3xfailure',AM,'Walk to technical failure · required'),
  ],
}

# ── mc-s3-chest.html ──────────────────────────────────────────────────────────
PATCHES['mc-s3-chest.html'] = {
  2:[
    s(1,'Barbell Bench or DB Bench','4x10',MS,'2 sec pause at bottom · strict form'),
    s(2,'Barbell Bench','5x5',LR,'Low rep · heavy · drive the bar'),
    s(3,'Incline Barbell or DB Bench','5x12',HS,'High sets · full ROM'),
    ss(4,'Chest Fly Machine (pronated grip)','12,10,8,8',P,'Push-Ups','3xfailure',AM,
       'Pyramid up · 2 sec pause at peak','AMRAP · full ROM · to failure'),
    s(5,'DB Chest Flies','4x15',HR,'High rep · deep eccentric · squeeze at top'),
  ],
  3:[
    s(1,'Barbell Bench or DB Bench','5x5 then 5x12',LR+HS,'Heavy sets then high volume'),
    s(2,'Incline Barbell or DB Bench','12,10,8,8',P,'Pyramid up · increase weight each set'),
    s(3,'Low Cable Chest Fly','5x12',HS,'High sets · constant tension · squeeze at peak'),
    ss(4,'Decline DB Press','4x15',HR,'Push-Ups','3xfailure',AM,
       'High rep · tricep emphasis','AMRAP · full ROM'),
    s(5,'DB Chest Flies','4x8',MS+TM,'5-10 sec stretch hold at bottom · deep eccentric'),
  ],
  4:[
    s(1,'Barbell Bench or DB Bench','12,10,8,8',P,'Pyramid up · drive the bar'),
    s(2,'Incline Barbell or DB Bench','5x5',LR,'Low rep heavy · strict form'),
    s(3,'Low Cable Chest Fly','4x12',MS,'2 sec pause at peak · constant tension'),
    ss(4,'Decline DB Press','4x10',MS,'Push-Ups','3xfailure',AM,
       '2 sec negative · tricep emphasis','AMRAP · full ROM'),
    s(5,'DB Chest Flies','4x15',HR,'High rep pump · squeeze at peak'),
  ],
}

# ── mc-s3-shoulders-tris.html ─────────────────────────────────────────────────
PATCHES['mc-s3-shoulders-tris.html'] = {
  2:[
    ss(1,'Seated Side Lateral Raises','12,10,8,8',P,'Skull Crushers','5x5',LR,
       'Pyramid up · squeeze at top','Low rep heavy · 2 sec pause at bottom'),
    ss(2,'Pelican Raises','5x12',HS,'Seated Overhead DB Tricep Extension','4x10',MS,
       'High sets · anterior delt focus','2 sec negative · bilateral'),
    s(3,'Barbell or DB Shoulder Press','4x20',HR,'High rep · moderate weight'),
    ss(4,'Barbell Front Raises','4x10',MS,'Rope Pushdowns','12,10,8,8',P,
       '2 sec pause at top','Pyramid up · squeeze at bottom'),
    s(5,'Wide Grip Tricep Pulldowns','5x12',HS,'High sets · 2 sec pause at bottom'),
  ],
  3:[
    ss(1,'Seated Side Lateral Raises','5x12',HS,'Skull Crushers','4x10',MS,
       'High sets · squeeze at top','2 sec pause at bottom · 1:2:1:0'),
    ss(2,'Cable Lateral Raises','4x15',HR,'Rope Pushdowns','4x20',HR,
       'Constant tension · squeeze at top','20 reps · bilateral · squeeze at bottom'),
    s(3,'Barbell or DB Shoulder Press','5x5',LR,'Low rep · heavy · strict press'),
    ss(4,'DB Rear Delt Fly','4x12',MS,'Overhead Cable Tricep Extension','5x12',HS,
       'Bilateral · rear delt squeeze','High sets · full extension'),
    s(5,'Face Pulls','12,10,8,8',P,'Pyramid up · 2 sec hold at peak · rear delt focus'),
  ],
  4:[
    ss(1,'Seated Side Lateral Raises','12,10,8,8',P,'Skull Crushers','5x5',LR,
       'Pyramid up · squeeze','Low rep heavy · pause at bottom'),
    ss(2,'Cable Lateral Raises','4x10',MS,'Rope Pushdowns','5x12',HS,
       '2 sec pause at top','High sets · bilateral'),
    s(3,'Barbell or DB Shoulder Press','4x15',HR,'Moderate weight · high rep'),
    ss(4,'DB Rear Delt Fly','4x20',HR,'Overhead Cable Tricep Extension','4x10',MS,
       'High rep · rear delt pump','2 sec negative · bilateral'),
    s(5,'Face Pulls','4x15',HR,'High rep · 2 sec hold at peak'),
  ],
}

# ── mc-s3-back-bis-forearms.html ──────────────────────────────────────────────
PATCHES['mc-s3-back-bis-forearms.html'] = {
  2:[
    s(1,'Pendlay Barbell Rows','5x10',HS,'High sets · reset each rep · explosive pull'),
    s(2,'Wide Grip Lat Pulldown','12,10,8,8',P,'Pyramid up · full stretch at top'),
    ss(3,'Double Arm DB Incline Row','5x5',LR,'Spider Curls','4x15',HR,
       'Low rep heavy bilateral','High rep pump · squeeze at peak'),
    s(4,'Pinwheel Curls','5x12',HS,'High sets · alternate arms'),
    ss(5,'Barbell Curls (2 close / 2 wide grip)','4x20',HR,
       'Kneeling Reverse Forearm Curls (bench supported)','4x12',MS,
       '20 reps · both grips','2 sec pause · forearm squeeze'),
    s(6,'Bench Supported Kneeling Forearm Curl','5x5',LR,'Low rep heavy · 2 sec pause at top'),
  ],
  3:[
    s(1,'Pendlay Barbell Rows','5x5',LR,'Low rep heavy · reset each rep · explosive'),
    s(2,'Wide Grip Lat Pulldown','5x12',HS,'High sets · full stretch at top'),
    ss(3,'Seated Cable Row','4x12',MS,'Incline DB Curl','4x15',HR,
       '2 sec pause at peak · elbows tight','Alternate arms · full supination'),
    s(4,'Concentration Curls','12,10,8,8',P,'Pyramid up · squeeze at peak · single arm'),
    ss(5,'T-Bar Row','4x10',MS,'Reverse Barbell Curl','4x15',HR,
       '2 sec pause at top · drive elbows back','Forearm strength · strict form'),
    s(6,'Wrist Roller or Plate Pinch','4x30sec',MS,'Forearm and grip strength'),
  ],
  4:[
    s(1,'Pendlay Barbell Rows','5x12',HS,'High sets · explosive pull · reset each rep'),
    s(2,'Wide Grip Lat Pulldown','5x5',LR,'Low rep heavy · full stretch'),
    ss(3,'Seated Cable Row','5x12',HS,'Incline DB Curl','4x10',MS,
       'High sets · elbows tight','2 sec pause at peak'),
    s(4,'Concentration Curls','4x15',HR,'High rep · squeeze at peak · single arm'),
    ss(5,'T-Bar Row','12,10,8,8',P,'Reverse Barbell Curl','4x12',MS,
       'Pyramid up · drive back hard','Strict form · forearm focus'),
    s(6,'Wrist Roller or Plate Pinch','5x30sec',HS,'Forearm and grip endurance'),
  ],
}

# ── mc-s3-legs-back.html ─────────────────────────────────────────────────────
PATCHES['mc-s3-legs-back.html'] = {
  2:[
    ss(1,'Barbell Good Mornings','5x5',LR,'Pull-Ups','3xfailure',AM,
       'Low rep heavy · hip hinge','Failure · full hang · no kipping'),
    s(2,'Barbell Row','5x12',HS,'High sets · drive elbows back'),
    s(3,'Hack Squat','5x5',LR,'Low rep · heavy · full ROM'),
    ss(4,'Double Arm Bent Over DB Row','12,10,8,8',P,'Goblet Squats','4x10',MS,
       'Pyramid up · squeeze at peak','Heels elevated · upright torso'),
    ss(5,'DB RDLs','5x12',HS,'Reverse DB Flies','4x12',MS,
       'High sets · bilateral · feel stretch','Bilateral · rear delt squeeze'),
  ],
  3:[
    ss(1,'Barbell Good Mornings','4x10',MS,'Pull-Ups','3xfailure',AM,
       '2 sec pause at bottom · hip hinge','Failure · full hang'),
    s(2,'Barbell Row','5x5',LR,'Low rep heavy · drive elbows back hard'),
    s(3,'Leg Press','12,10,8,8',P,'Pyramid up · full ROM · 3 sec negative'),
    ss(4,'Seated Cable Row','5x12',HS,'Goblet Squats','4x15',HR,
       'High sets · squeeze at peak','High rep · heels elevated'),
    ss(5,'Romanian Deadlifts','4x12',MS,'DB Walking Lunges','4x10 each',MS,
       'Bilateral · feel the stretch · required','Torso upright · drive through heel'),
  ],
  4:[
    ss(1,'Barbell Good Mornings','5x5',LR,'Pull-Ups','3xfailure',AM,
       'Low rep heavy · hip hinge','Failure · full hang'),
    s(2,'Barbell Row','5x12',HS,'High sets · drive elbows back'),
    s(3,'Leg Press','5x5',LR,'Low rep heavy · slow controlled descent'),
    ss(4,'Seated Cable Row','12,10,8,8',P,'Goblet Squats','4x10',MS,
       'Pyramid up · elbows tight','Upright torso · deep squat'),
    ss(5,'Romanian Deadlifts','5x12',HS,'DB Walking Lunges','3xfailure',AM,
       'High sets · feel the stretch · required','Walk to failure · required'),
  ],
}

# ── mc-s4-chest-tris.html ─────────────────────────────────────────────────────
PATCHES['mc-s4-chest-tris.html'] = {
  2:[
    ss(1,'Close Grip DB Press (DBs touching)','12,10,8,8',P,'Dips or Dip Machine','3xfailure',AM,
       'Pyramid up · tricep emphasis','Push to failure · full ROM'),
    s(2,'Barbell Close Grip Bench','12,10,8,8',P,'Pyramid up · strict tricep press'),
    s(3,'Barbell or DB 1.5 Rep Bench','5x5',LR,'Heavy · feel the eccentric · strict form'),
    s(4,'Skull Crushers','5x12',HS,'High sets · 2 sec pause at bottom'),
    s(5,'Reverse Tricep Pushdowns','12,10,8,8',P,'Pyramid up · underhand bilateral · squeeze'),
    s(6,'Cable Decline or Incline Flies','5x5',LR,'Low rep · heavy · constant tension'),
  ],
  3:[
    ss(1,'Close Grip DB Press (DBs touching)','5x5',LR,'Dips or Dip Machine','4x10',MS,
       'Low rep heavy · tricep emphasis','Full ROM · chest upright'),
    s(2,'Barbell Close Grip Bench','5x12',HS,'High sets · strict tricep press'),
    s(3,'Pec Deck Fly','12,10,8,8',P,'Pyramid up · 2 sec peak contraction'),
    s(4,'Skull Crushers','4x15',HR,'High rep · 2 sec pause at bottom'),
    s(5,'Diamond Push-Ups','3xfailure',AM,'AMRAP · full ROM · tricep emphasis'),
    s(6,'Low Cable Chest Fly','5x12',HS,'High sets · constant tension · squeeze'),
  ],
  4:[
    ss(1,'Close Grip DB Press (DBs touching)','12,10,8,8',P,'Dips or Dip Machine','5x5',LR,
       'Pyramid · tricep emphasis','Low rep heavy · full ROM'),
    s(2,'Barbell Close Grip Bench','4x10',MS,'Moderate weight · strict form'),
    s(3,'Pec Deck Fly','5x12',HS,'High sets · 2 sec peak hold'),
    s(4,'Skull Crushers','5x5',LR,'Low rep heavy · 2 sec pause at bottom'),
    s(5,'Diamond Push-Ups','3xfailure',AM,'AMRAP · tricep emphasis'),
    s(6,'Low Cable Chest Fly','12,10,8,8',P,'Pyramid up · squeeze at peak'),
  ],
}

# ── mc-s4-shoulders.html ──────────────────────────────────────────────────────
PATCHES['mc-s4-shoulders.html'] = {
  2:[
    s(1,'Side Lateral Raises (DBs outside thighs)','5x12',HS,'High sets · start outside thighs'),
    ss(2,'Side Lateral Raises (DBs at quads)','12,10,8,8',P,
       'Supermans','3xfailure',AM,
       'Pyramid · quad position angle','AMRAP · full extension'),
    ss(3,'Standing or Incline Supported Barbell Front Raises','4x20',HR,
       'Alternating DB Front Raises','4x10',MS,
       'High rep · anterior delt','Alternate arms · controlled eccentric'),
    s(4,'Barbell or DB Shrugs or Barbell Upright Row','12,10,8,8',P,
       'Pyramid up · 2 sec pause at top'),
  ],
  3:[
    s(1,'Side Lateral Raises (DBs outside thighs)','12,10,8,8 then 5x15',P+HS,
       'Pyramid then high sets · constant tension'),
    ss(2,'Cable Lateral Raises','4x15',HR,'Face Pulls','4x15',HR,
       'Constant tension · squeeze at top','2 sec hold at peak · rear delt focus'),
    ss(3,'Seated DB Shoulder Press','5x5',LR,'DB Rear Delt Fly','4x12',MS,
       'Low rep heavy · strict press','Bilateral · squeeze rear delts'),
    s(4,'Barbell or DB Shrugs','4x10',MS,'2 sec pause at top · 1:0:1:2'),
  ],
  4:[
    s(1,'Side Lateral Raises (DBs outside thighs)','5x15',HS,'High sets · constant tension'),
    ss(2,'Cable Lateral Raises','4x10',MS,'Face Pulls','5x12',HS,
       '2 sec pause at top','High sets · 2 sec hold at peak'),
    ss(3,'Seated DB Shoulder Press','12,10,8,8',P,'DB Rear Delt Fly','4x15',HR,
       'Pyramid up · strict press','High rep pump · bilateral'),
    s(4,'Barbell or DB Shrugs','5x5',LR,'Low rep heavy · 2 sec pause at top'),
  ],
}

# ── mc-s4-bis-tris.html ──────────────────────────────────────────────────────
PATCHES['mc-s4-bis-tris.html'] = {
  2:[
    ss(1,'Pinwheel Curls','5x12',HS,'Lying DB Extension + Cross Chest Extension','4x20',HR,
       'High sets · neutral grip','High rep · 1 rep to ear + 1 cross = 1 rep'),
    ss(2,'Alternating Incline / Hammer Curl','12,10,8,8',P,
       'Bent Over DB Tricep Kickbacks','5x5',LR,
       'Pyramid · alternate each set','Low rep heavy · bilateral'),
    ss(3,'Concentration Curls','5x12',HS,'Skull Crushers','4x12',MS,
       'High sets · single arm','Moderate weight · 2 sec pause'),
    ss(4,'Barbell Curl','4x10',MS,'Tricep Pushdown','5x5',LR,
       '2 sec pause at top · strict form','Low rep heavy · constant tension'),
  ],
  3:[
    ss(1,'Pinwheel Curls','12,10,8,8',P,'Skull Crushers','5x5',LR,
       'Pyramid · alternate arms · neutral grip','Low rep heavy · 2 sec pause'),
    ss(2,'Cable Curls','5x12',HS,'Rope Pushdowns','4x15',HR,
       'High sets · constant tension','High rep · bilateral · squeeze at bottom'),
    ss(3,'Incline DB Curl','4x12',MS,'Overhead Cable Tricep Extension','5x12',HS,
       '2 sec peak hold · supination','High sets · bilateral · full extension'),
    ss(4,'Hammer Curls','4x15',HR,'Diamond Push-Ups','3xfailure',AM,
       'High rep · neutral grip','AMRAP · tricep emphasis'),
  ],
  4:[
    ss(1,'Pinwheel Curls','4x15',HR,'Skull Crushers','12,10,8,8',P,
       'High rep · neutral grip','Pyramid up · 2 sec pause'),
    ss(2,'Cable Curls','4x10',MS,'Rope Pushdowns','5x12',HS,
       '2 sec squeeze at peak','High sets · squeeze at bottom'),
    ss(3,'Incline DB Curl','5x12',HS,'Overhead Cable Tricep Extension','4x10',MS,
       'High sets · full supination','2 sec negative · bilateral'),
    ss(4,'Hammer Curls','5x5',LR,'Diamond Push-Ups','3xfailure',AM,
       'Low rep heavy · neutral grip','AMRAP · full ROM'),
  ],
}

# ── mc-s4-legs.html ──────────────────────────────────────────────────────────
PATCHES['mc-s4-legs.html'] = {
  2:[
    s(1,'Barbell or DB Goblet Squat','12,10,8,8',P,'Pyramid up · full depth'),
    ss(2,'Quad Extensions','12,10,8,8',P,'Seated Leg Curl','5x12',HS,
       'Pyramid · 3 sec negative','High sets · 2 sec pause at peak'),
    s(3,'Box Same Leg Step-Ups','5x5 each',LR,'Low rep heavy · drive through heel'),
    s(4,'Barbell or DB RDLs','5x12',HS,'High sets · feel the hamstring stretch'),
    ss(5,'Calf Raises','5x20',HR,'Smith Machine Split Squats','3xfailure',AM,
       '20 reps · 2 sec pause at top','Push to failure · 3 sec negative'),
  ],
  3:[
    s(1,'Barbell or DB Goblet Squat','5x5',LR,'Low rep heavy · full depth'),
    ss(2,'Quad Extensions','5x12',HS,'Lying Leg Curl','12,10,8,8',P,
       'High sets · 3 sec negative','Pyramid · 2 sec pause at peak'),
    s(3,'Leg Press (feet together)','4x12',MS,'Full ROM · controlled descent'),
    s(4,'Romanian Deadlifts','4x15',HR,'High rep · feel the hamstring stretch'),
    ss(5,'Calf Raises','4x20',HR,'DB Walking Lunges','4x10 each',MS,
       '20 reps · 2 sec pause at top','Torso upright · required for leg day'),
  ],
  4:[
    s(1,'Barbell or DB Goblet Squat','12,10,8,8',P,'Pyramid up · full depth'),
    ss(2,'Quad Extensions','12,10,8,8',P,'Lying Leg Curl','5x12',HS,
       'Pyramid up · 3 sec negative','High sets · 2 sec pause'),
    s(3,'Leg Press (feet together)','5x5',LR,'Heavy · slow controlled descent'),
    s(4,'Romanian Deadlifts','4x10',MS,'3 sec negative · bilateral'),
    ss(5,'Calf Raises','5x20',HR,'DB Walking Lunges','3xfailure',AM,
       '20 reps · pause at top','Walk to technical failure · required'),
  ],
}

# ── mc-s5-push.html ──────────────────────────────────────────────────────────
PATCHES['mc-s5-push.html'] = {
  2:[
    s(1,'Barbell Bench or DB Incline Bench','12,10,8,8',P,'Pyramid up · drive the bar'),
    s(2,'Arnold Press or Barbell Military Press','4x10',MS,'2 sec negative · 4:0:1:0'),
    s(3,'Tricep or Close Grip DB Bench','5x12',HS,'High sets · full ROM'),
    ss(4,'Pronated Chest Flies','4x15',HR,'Skull Crushers','5x5',LR,
       'High rep pump · deep stretch','Low rep heavy · 2 sec pause'),
    ss(5,'DB Alternating Press','12,10,8,8',P,'Barbell Upright Row','4x12',MS,
       'Pyramid · slight incline','2 sec pause at top · bilateral'),
  ],
  3:[
    s(1,'Barbell Bench or DB Incline Bench','5x5',LR,'Low rep heavy · drive the bar'),
    s(2,'Arnold Press or Barbell Military Press','5x12',HS,'High sets · full ROM'),
    s(3,'Pec Deck Fly','12,10,8,8',P,'Pyramid up · 2 sec peak contraction'),
    ss(4,'Cable Chest Press','4x15',HR,'Rope Pushdowns','4x20',HR,
       'Constant tension · full ROM','Bilateral · squeeze at bottom'),
    ss(5,'Seated DB Press','4x10',MS,'Cable Lateral Raises','4x12',MS,
       'Strict press · 2 sec negative','Constant tension · squeeze at top'),
  ],
  4:[
    s(1,'Barbell Bench or DB Incline Bench','12,10,8,8',P,'Pyramid up · drive the bar'),
    s(2,'Arnold Press or Barbell Military Press','4x15',HR,'High rep · moderate weight'),
    s(3,'Pec Deck Fly','5x12',HS,'High sets · 2 sec peak hold'),
    ss(4,'Cable Chest Press','4x10',MS,'Rope Pushdowns','5x12',HS,
       '2 sec pause at peak','High sets · squeeze at bottom'),
    ss(5,'Seated DB Press','5x5',LR,'Cable Lateral Raises','4x15',HR,
       'Low rep heavy · strict form','High rep · constant tension'),
  ],
}

# ── mc-s5-pull.html ──────────────────────────────────────────────────────────
PATCHES['mc-s5-pull.html'] = {
  2:[
    s(1,'Barbell Pendlay Rows','5x10',HS,'High sets · explosive pull · reset each rep'),
    ss(2,'DB Incline Row','12,10,8,8',P,'Spider Curls','5x5',LR,
       'Pyramid up · 2 sec pause at top','Low rep heavy · squeeze at peak'),
    s(3,'Concentration Curls','5x12',HS,'High sets · squeeze hard at peak · alternate arms'),
    ss(4,'Wide Grip Lat Pulldowns','4x20',HR,'Barbell Curls','4x10',MS,
       'High rep · full stretch at top','2 sec pause at top · controlled eccentric'),
    ss(5,'Straight Arm Lat Pulldowns','4x15',HR,'Preacher Curls','5x5',LR,
       'High rep · constant tension','Low rep heavy · 2 sec pause at bottom'),
  ],
  3:[
    s(1,'Barbell Pendlay Rows','5x5',LR,'Low rep heavy · explosive pull · reset each rep'),
    ss(2,'Seated Cable Row','5x12',HS,'Incline DB Curl','4x15',HR,
       'High sets · elbows tight · 2 sec pause','Alternate arms · full supination'),
    s(3,'Concentration Curls','12,10,8,8',P,'Pyramid up · squeeze hard at peak'),
    ss(4,'Wide Grip Lat Pulldowns','4x12',MS,'Cable Curls','4x20',HR,
       '2 sec pause at bottom · full stretch','20 reps · constant tension'),
    ss(5,'V-Grip Pulldowns','4x10',MS,'Hammer Curls','12,10,8,8',P,
       '2 sec pause at bottom · underhand','Pyramid up · neutral grip'),
  ],
  4:[
    s(1,'Barbell Pendlay Rows','5x12',HS,'High sets · reset each rep · drive elbows'),
    ss(2,'Seated Cable Row','12,10,8,8',P,'Incline DB Curl','5x5',LR,
       'Pyramid up · elbows tight','Low rep heavy · full supination'),
    s(3,'Concentration Curls','4x15',HR,'High rep · squeeze at peak · single arm'),
    ss(4,'Wide Grip Lat Pulldowns','5x12',HS,'Cable Curls','4x10',MS,
       'High sets · full stretch at top','2 sec squeeze at peak'),
    ss(5,'V-Grip Pulldowns','12,10,8,8',P,'Hammer Curls','4x15',HR,
       'Pyramid up · squeeze at bottom','High rep · neutral grip'),
  ],
}

# ── mc-s5-legs.html ──────────────────────────────────────────────────────────
PATCHES['mc-s5-legs.html'] = {
  2:[
    s(1,'Barbell or DB Goblet Squat','12,10,8,8',P,'Pyramid up · full depth · 3 sec negative'),
    ss(2,'Quad Extensions','12,10,8,8',P,'Seated Hamstring Curls','5x12',HS,
       'Pyramid up · squeeze at top','High sets · 2 sec pause at peak'),
    s(3,'Leg Press','5x5',LR,'Low rep heavy · 4 sec negative · 4:0:1:0'),
    ss(4,'DB RDLs','5x12',HS,'Smith Machine Split Squats','3xfailure',AM,
       'High sets · bilateral','Push to failure · 3 sec negative'),
    s(5,'Calf Raises','5x20',HR,'20 reps · 2 sec pause at top · 1:0:1:2'),
  ],
  3:[
    s(1,'Barbell or DB Goblet Squat','5x5',LR,'Low rep heavy · full depth · 3 sec negative'),
    ss(2,'Quad Extensions','5x12',HS,'Lying Leg Curl','12,10,8,8',P,
       'High sets · squeeze at top','Pyramid up · 2 sec pause at peak'),
    s(3,'Hack Squat (low foot placement)','4x10',MS,'4 sec negative · quad emphasis'),
    ss(4,'Romanian Deadlifts','4x15',HR,'DB Walking Lunges','4x10 each',MS,
       'High rep · feel the stretch','Torso upright · required for leg day'),
    s(5,'Calf Raises','4x20',HR,'20 reps · 2 sec pause at top'),
  ],
  4:[
    s(1,'Barbell or DB Goblet Squat','12,10,8,8',P,'Pyramid up · full depth'),
    ss(2,'Quad Extensions','12,10,8,8',P,'Lying Leg Curl','5x12',HS,
       'Pyramid up · 3 sec negative','High sets · 2 sec pause'),
    s(3,'Hack Squat (low foot placement)','5x5',LR,'Low rep heavy · full depth'),
    ss(4,'Romanian Deadlifts','5x12',HS,'DB Walking Lunges','3xfailure',AM,
       'High sets · bilateral · feel stretch','Walk to failure · required'),
    s(5,'Calf Raises','5x20',HR,'20 reps · 2 sec pause at top'),
  ],
}

# ════════════════════════════════════════════════════════════════════════════
#  NEW HTML PAGES — LEG DAY PHASE 2
# ════════════════════════════════════════════════════════════════════════════

MC_CSS = """*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif;}
.back-link{position:absolute;top:18px;left:18px;text-decoration:none;font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;z-index:10;}
.header{padding:60px 20px 22px;position:relative;}
.header-inner{max-width:680px;margin:0 auto;}
.eyebrow{font-size:11px;font-weight:800;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:8px;}
.title{font-size:24px;font-weight:900;color:#fff;margin-bottom:8px;letter-spacing:-0.02em;}
.tabs-bar{padding:0 12px;position:sticky;top:0;z-index:8;}
.tabs{max-width:680px;margin:0 auto;display:flex;gap:2px;overflow-x:auto;}
.tab{padding:12px 14px;border:none;cursor:pointer;font-weight:800;font-size:12px;background:transparent;border-bottom:3px solid transparent;white-space:nowrap;letter-spacing:0.04em;flex-shrink:0;}
.content{max-width:680px;margin:20px auto 0;padding:0 16px;}
.workout-title{font-size:17px;font-weight:900;color:#fff;margin-bottom:6px;}
.workout-note{font-size:12px;color:#94a3b8;margin-bottom:16px;line-height:1.5;border-left:3px solid rgba(251,191,36,0.4);padding:10px 14px;border-radius:0 6px 6px 0;}
.tap-hint{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;text-align:center;opacity:0.8;}
.ex-card{background:#0d1f3c;border-radius:12px;border:1.5px solid rgba(251,191,36,0.18);margin-bottom:10px;cursor:pointer;transition:all 0.15s;overflow:hidden;}
.ex-card.checked{background:#0a2a1a;border-color:rgba(52,211,153,0.35);}
.ex-card.checked .ex-name{text-decoration:line-through;color:#34d399;}
.ex-card.checked .ex-num{background:#065f46;color:#fff;}
.ex-row{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;}
.ex-num{display:inline-flex;align-items:center;justify-content:center;min-width:28px;width:28px;height:28px;border-radius:50%;font-size:12px;font-weight:900;flex-shrink:0;margin-top:1px;}
.ex-content{flex:1;min-width:0;}
.ex-name{font-weight:700;font-size:13px;color:#e2e8f0;line-height:1.4;margin-bottom:5px;}
.ex-sets-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.ex-sets{display:inline-block;font-size:11px;font-weight:800;padding:3px 9px;border-radius:5px;}
.ex-tempo{display:inline-block;background:rgba(255,255,255,0.05);color:#64748b;font-size:10px;font-weight:800;padding:3px 7px;border-radius:5px;font-family:monospace;}
.ex-note{font-size:11px;color:#475569;margin-top:4px;line-height:1.4;font-style:italic;}
.section-label{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:900;letter-spacing:0.2em;padding:5px 14px;border-radius:6px;margin:18px 0 12px;text-transform:uppercase;color:#fff;}
.rest-timer{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none;padding:4px 10px;border-radius:8px;transition:all 0.15s;margin-top:5px;}
.rest-timer.idle{background:rgba(100,116,139,0.12);border:1px solid rgba(100,116,139,0.2);}
.rest-timer.running{background:rgba(234,179,8,0.15);border:1px solid rgba(234,179,8,0.35);animation:rp 1s ease-in-out infinite;}
.rest-timer.done{background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.35);}
.rest-timer.overtime{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.35);}
@keyframes rp{0%,100%{opacity:1;}50%{opacity:0.7;}}
.rest-timer-icon{font-size:13px;}
.rest-timer-label{font-size:11px;font-weight:800;letter-spacing:0.04em;}
.rest-timer.idle .rest-timer-label{color:#64748b;}
.rest-timer.running .rest-timer-label{color:#fbbf24;}
.rest-timer.done .rest-timer-label{color:#34d399;}
.rest-timer.overtime .rest-timer-label{color:#f87171;}
.timer-float{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(10,10,16,0.95);backdrop-filter:blur(16px);border-radius:20px;padding:14px 24px;display:none;flex-direction:column;align-items:center;gap:4px;border:1px solid rgba(255,255,255,0.1);box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:100;min-width:200px;}
.timer-float.visible{display:flex;}
.timer-float-label{font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#475569;}
.timer-float-time{font-size:42px;font-weight:900;letter-spacing:-0.02em;color:#fbbf24;}
.timer-float-time.done{color:#34d399;}.timer-float-time.overtime{color:#f87171;}
.timer-float-ex{font-size:11px;color:#64748b;text-align:center;max-width:180px;line-height:1.4;}
.timer-float-bar{width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-top:4px;overflow:hidden;}
.timer-float-progress{height:100%;background:#fbbf24;border-radius:2px;transition:width 0.5s linear;width:100%;}
.timer-float-progress.done{background:#34d399;}.timer-float-progress.overtime{background:#f87171;}
.timer-float-actions{display:flex;gap:8px;margin-top:6px;}
.timer-float-btn{padding:6px 14px;border-radius:8px;border:none;font-size:11px;font-weight:800;cursor:pointer;}
.timer-float-skip{background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3);}
.timer-float-reset{background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.2);}
.prog-bar-wrap{position:fixed;top:0;left:0;right:0;height:3px;z-index:999;background:rgba(255,255,255,0.06);}
.prog-bar-fill{height:3px;background:linear-gradient(90deg,#22d3ee,#a78bfa);transition:width 0.4s ease;border-radius:0 2px 2px 0;}"""

MC_TIMER_JS = """
const TMR={interval:null,startTime:null,duration:0,activeEl:null,
  parseSeconds(s){if(!s||s==='—')return 0;s=s.toLowerCase().trim();const m=s.match(/(\\d+)\\s*min/),sec=s.match(/(\\d+)\\s*sec/);let t=0;if(m)t+=parseInt(m[1])*60;if(sec)t+=parseInt(sec[1]);if(!t){const p=s.match(/^(\\d+)/);if(p)t=parseInt(p[1]);}return t;},
  formatTime(s){const n=s<0,a=Math.abs(s),m=Math.floor(a/60),sc=a%60;return(n?'+':'')+(m>0?m+':'+String(sc).padStart(2,'0'):sc+'s');},
  buzz(){try{navigator.vibrate&&navigator.vibrate([200,100,200,100,400]);const c=new(window.AudioContext||window.webkitAudioContext)();[0,0.3,0.6].forEach((t,i)=>{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=i===2?880:660;g.gain.setValueAtTime(0.4,c.currentTime+t);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+t+0.25);o.start(c.currentTime+t);o.stop(c.currentTime+t+0.25);});}catch(e){}},
  start(el,secs,nm){this.stop();this.duration=secs;this.startTime=Date.now();this.activeEl=el;el.className='rest-timer running';const ft=document.getElementById('timerFloat');if(ft){ft.querySelector('.timer-float-label').textContent='REST';ft.querySelector('.timer-float-ex').textContent=nm;ft.querySelector('.timer-float-time').className='timer-float-time';ft.querySelector('.timer-float-progress').style.width='100%';ft.classList.add('visible');}this.interval=setInterval(()=>{const rem=Math.ceil(this.duration-(Date.now()-this.startTime)/1000);if(el)el.querySelector('.rest-timer-label').textContent=this.formatTime(rem);const tt=document.querySelector('.timer-float-time'),tp=document.querySelector('.timer-float-progress'),tl=document.querySelector('.timer-float-label');if(tt)tt.textContent=this.formatTime(rem);if(rem>0){if(tp)tp.style.width=Math.round((rem/this.duration)*100)+'%';if(tt)tt.className='timer-float-time';if(tp)tp.className='timer-float-progress';if(el)el.className='rest-timer running';}else if(rem===0){this.buzz();if(tt)tt.className='timer-float-time done';if(tp){tp.className='timer-float-progress done';tp.style.width='100%';}if(tl)tl.textContent='DONE!';if(el)el.className='rest-timer done';}else{if(tt){tt.textContent='+'+this.formatTime(-rem);tt.className='timer-float-time overtime';}if(tp)tp.className='timer-float-progress overtime';if(tl)tl.textContent='OVERTIME';if(el)el.className='rest-timer overtime';}},500);},
  stop(){if(this.interval)clearInterval(this.interval);this.interval=null;if(this.activeEl){this.activeEl.querySelector('.rest-timer-label').textContent=this.activeEl.dataset.label;this.activeEl.className='rest-timer idle';this.activeEl=null;}const ft=document.getElementById('timerFloat');if(ft)ft.classList.remove('visible');},
  toggle(el,secs,nm){this.activeEl===el&&this.interval?this.stop():this.start(el,secs,nm);}
};
function buildTimerFloat(){if(document.getElementById('timerFloat'))return;const d=document.createElement('div');d.id='timerFloat';d.className='timer-float';d.innerHTML='<div class="timer-float-label">REST</div><div class="timer-float-time">0s</div><div class="timer-float-ex"></div><div class="timer-float-bar"><div class="timer-float-progress"></div></div><div class="timer-float-actions"><button class="timer-float-btn timer-float-skip" onclick="TMR.stop()">✓ Done</button><button class="timer-float-btn timer-float-reset" onclick="TMR.stop()">✕ Cancel</button></div>';document.body.appendChild(d);}
buildTimerFloat();
function makeRT(rest,nm){const s=TMR.parseSeconds(rest);if(!s)return '<span style="opacity:0.5">'+rest+'</span>';return '<span class="rest-timer idle" data-label="'+rest+'" onclick="buildTimerFloat();TMR.toggle(this,'+s+',\\''+nm.substring(0,25).replace(/['"]/g,'')+'\\')"><span class="rest-timer-icon">⏱️</span><span class="rest-timer-label">'+rest+'</span></span>';}
function updateProgress(){const all=document.querySelectorAll('.ex-card');const done=document.querySelectorAll('.ex-card.checked');const pct=all.length?Math.round((done.length/all.length)*100):0;const fill=document.getElementById('progFill');if(fill)fill.style.width=pct+'%';}
"""

def esc(s): return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;').replace("'","&#39;")

def make_leg_html(filename, back_href, eyebrow, page_title, accent, accent_dim, body_bg, header_bg, workouts):
    """
    workouts = list of dicts: {id, label, title, note, sections:[{label, emoji, color, exercises:[{name,sets,tempo,rest,note}]}]}
    """
    def render_ex(ex, prefix, vidx, eidx):
        nm   = esc(ex['name'])
        rest = ex.get('rest','60 sec')
        tpo  = f'<span class="ex-tempo">{esc(ex["tempo"])}</span>' if ex.get('tempo') else ''
        note = f'<div class="ex-note">{esc(ex["note"])}</div>' if ex.get('note') else ''
        return f'''<div class="ex-card" data-id="{vidx}-{prefix}-{eidx}">
  <div class="ex-row">
    <div class="ex-num">{eidx+1}</div>
    <div class="ex-content">
      <div class="ex-name">{nm}</div>
      <div class="ex-sets-row"><span class="ex-sets">{esc(ex["sets"])}</span>{tpo}</div>
      <div>{{}}</div>{note}
    </div>
  </div>
</div>'''.replace('{}', f'<!--RT:{rest}:{ex["name"]}-->')

    sections_js = []
    for vi, w in enumerate(workouts):
        sec_html_parts = []
        for sec in w['sections']:
            ex_cards = ''.join(render_ex(e, sec['label'][:2], vi, ei) for ei, e in enumerate(sec['exercises']))
            sec_html_parts.append(
                f'<div class="section-label" style="background:{sec["color"]}">{sec["emoji"]} {sec["label"].upper()}</div>' + ex_cards
            )
        sections_js.append({'id':w['id'],'label':w['label'],'title':w['title'],'note':w.get('note',''),'body':''.join(sec_html_parts)})

    tabs_js = json.dumps([{'id':w['id'],'label':w['label'],'title':w['title'],'note':w.get('note','')} for w in workouts])

    # Build a JS-side WORKOUTS array
    workouts_js_arr = []
    for vi, w in enumerate(workouts):
        sec_html_parts = []
        for sec in w['sections']:
            ex_list = []
            for ei, ex in enumerate(sec['exercises']):
                nm   = ex['name'].replace("'", "\\'")
                sets = ex['sets'].replace("'", "\\'")
                rest = ex.get('rest','60 sec')
                tpo  = ex.get('tempo','')
                note = ex.get('note','').replace("'", "\\'")
                ex_list.append(f"{{name:'{nm}',sets:'{sets}',tempo:'{tpo}',rest:'{rest}',note:'{note}'}}")
            exercises_js = '[' + ','.join(ex_list) + ']'
            sec_html_parts.append(f"{{label:'{sec['label']}',emoji:'{sec['emoji']}',color:'{sec['color']}',exercises:{exercises_js}}}")
        sections_str = '[' + ','.join(sec_html_parts) + ']'
        title_esc = w['title'].replace("'", "\\'")
        note_esc  = w.get('note','').replace("'", "\\'")
        workouts_js_arr.append(f"{{id:'{w['id']}',label:'{w['label']}',title:'{title_esc}',note:'{note_esc}',sections:{sections_str}}}")

    workouts_js = 'const WORKOUTS=[' + ','.join(workouts_js_arr) + '];'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{esc(page_title)}</title>
<style>
{MC_CSS}
body{{background:{body_bg};min-height:100vh;padding-bottom:40px;}}
.back-link{{color:{accent};background:{accent_dim};border:1px solid {accent}55;}}
.header{{background:{header_bg};border-bottom:1px solid {accent}26;}}
.eyebrow{{color:{accent};}}
.tabs-bar{{background:{body_bg};border-bottom:1px solid {accent}1a;}}
.tab{{color:#334155;}}
.tab.active{{color:{accent};border-bottom-color:{accent};}}
.ex-num{{background:{accent_dim};color:{accent};border:1px solid {accent}40;}}
.ex-sets{{background:{accent_dim};color:{accent};border:1px solid {accent}33;}}
.workout-note{{background:{accent_dim};}}
.section-label{{background:{accent_dim};}}
</style>
</head>
<body>
<div class="prog-bar-wrap"><div class="prog-bar-fill" id="progFill"></div></div>
<div id="app"></div>
<script>
{MC_TIMER_JS}

{workouts_js}

let activeIdx=0;
const checkState={{}};

function render(){{
  const w=WORKOUTS[activeIdx];
  const tabs=WORKOUTS.map((wo,i)=>'<button class="tab '+(i===activeIdx?'active':'')+'" data-i="'+i+'">'+wo.label+'</button>').join('');
  let body='';
  w.sections.forEach(sec=>{{
    body+='<div class="section-label" style="background:'+sec.color+'">'+sec.emoji+' '+sec.label.toUpperCase()+'</div>';
    sec.exercises.forEach((ex,ei)=>{{
      const id=activeIdx+'-'+sec.label.substring(0,2)+'-'+ei;
      const ck=checkState[id]?'checked':'';
      const tpo=ex.tempo?'<span class="ex-tempo">'+ex.tempo+'</span>':'';
      const note=ex.note?'<div class="ex-note">'+ex.note+'</div>':'';
      body+='<div class="ex-card '+ck+'" data-id="'+id+'"><div class="ex-row"><div class="ex-num">'+(ei+1)+'</div><div class="ex-content"><div class="ex-name">'+ex.name+'</div><div class="ex-sets-row"><span class="ex-sets">'+ex.sets+'</span>'+tpo+'</div><div>'+makeRT(ex.rest||'60 sec',ex.name)+'</div>'+note+'</div></div></div>';
    }});
  }});
  const noteHtml=w.note?'<div class="workout-note">'+w.note+'</div>':'';
  document.getElementById('app').innerHTML=
    '<div class="header"><a href="{back_href}" class="back-link">← Back</a><div class="header-inner"><div class="eyebrow">{eyebrow}</div><div class="title">{page_title}</div></div></div>'+
    '<div class="tabs-bar"><div class="tabs">'+tabs+'</div></div>'+
    '<div class="content"><div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:6px;">'+w.title+'</div>'+noteHtml+'<div class="tap-hint">Tap any exercise to check off</div>'+body+'</div>';
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{{activeIdx=parseInt(b.dataset.i);render();updateProgress();setTimeout(initNotes,200);}}));
  document.querySelectorAll('.ex-card').forEach(c=>c.addEventListener('click',()=>{{const id=c.dataset.id;checkState[id]=!checkState[id];c.classList.toggle('checked');updateProgress();}}));
  updateProgress();setTimeout(initNotes,200);
}}
render();

const NOTES_KEY='mc_notes_{filename}';
function getNotes(){{try{{return JSON.parse(localStorage.getItem(NOTES_KEY)||'{{}}');}}catch(e){{return{{}};}}}}
function saveNote(id,val){{const n=getNotes();if(val.trim())n[id]=val.trim();else delete n[id];localStorage.setItem(NOTES_KEY,JSON.stringify(n));}}
function initNotes(){{
  const notes=getNotes();
  document.querySelectorAll('.ex-card[data-id]').forEach(card=>{{
    const id=card.dataset.id;
    if(!id||card.querySelector('.ex-notes-wrap'))return;
    const ex=notes[id]||'';
    const tog=document.createElement('div');tog.className='ex-notes-toggle';tog.style.cssText='display:inline-flex;align-items:center;gap:4px;margin-top:6px;cursor:pointer;font-size:10px;font-weight:800;color:#475569;letter-spacing:0.06em;text-transform:uppercase;user-select:none;';tog.innerHTML=ex?'✏️ '+ex.substring(0,20):'✚ Add weight/notes';
    const wrap=document.createElement('div');wrap.style.cssText='display:none;margin-top:8px;padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:8px;border:1px solid rgba(255,255,255,0.08);';wrap.innerHTML='<div style="font-size:9px;font-weight:800;letter-spacing:0.15em;color:#475569;text-transform:uppercase;margin-bottom:4px;">Weight / Notes</div><textarea rows="1" placeholder="e.g. 135 lbs" style="width:100%;background:transparent;border:none;outline:none;color:#e2e8f0;font-size:12px;font-family:inherit;resize:none;">'+ex+'</textarea>';
    if(ex)wrap.style.display='block';
    tog.addEventListener('click',e=>{{e.stopPropagation();wrap.style.display=wrap.style.display==='block'?'none':'block';}});
    const ta=wrap.querySelector('textarea');ta.addEventListener('input',()=>{{saveNote(id,ta.value);tog.innerHTML=ta.value.trim()?'✏️ '+ta.value.trim().substring(0,20):'✚ Add weight/notes';}});
    const cont=card.querySelector('.ex-content');if(cont){{cont.appendChild(tog);cont.appendChild(wrap);}}
  }});
}}
</script>
</body>
</html>"""


# ── legs-s3-pump.html data (Daily Pump Split #3 · Quads/Hams/Glutes) ─────────
S3_LQ_WORKOUTS = [
  { 'id':'v1','label':'V1','title':'Heavy Base Day',
    'note':'Follow the Split 3 structure: highset compound work, pyramid isolation, superset finishers.',
    'sections':[
      {'label':'Quads','emoji':'🦵','color':'rgba(251,146,60,0.15)','exercises':[
        {'name':'Smith Machine Cannonball Squats','sets':'5×10','tempo':'3:0:1:0','rest':'90 sec','note':'Close stance · deep squat · heels elevated'},
        {'name':'Leg Press (feet together, close stance)','sets':'12,10,8,8','tempo':'','rest':'90 sec','note':'Pyramid up · toes forward · quad emphasis'},
        {'name':'Quad Extensions','sets':'4×15','tempo':'1:0:1:2','rest':'60 sec','note':'High rep · 2-second squeeze at full extension'},
      ]},
      {'label':'Hamstrings & Glutes','emoji':'🏋️','color':'rgba(251,146,60,0.10)','exercises':[
        {'name':'Barbell Squat (feet outside shoulder width)','sets':'5×5','tempo':'','rest':'2 min','note':'Wide stance · shifts emphasis to posterior chain'},
        {'name':'Romanian Deadlift','sets':'4×10','tempo':'3:0:1:0','rest':'90 sec','note':'Bilateral · 3-second eccentric · feel the stretch'},
        {'name':'Goblet Squat (feet pointed out, outside shoulder width)','sets':'4×12','tempo':'1:2:1:0','rest':'60 sec','note':'Heels flat · deep squat · glute emphasis'},
        {'name':'DB Walking Lunges','sets':'3×12 each leg','tempo':'1:2:1:0','rest':'60 sec','note':'Required for leg days · torso upright'},
      ]},
      {'label':'Calves','emoji':'🦶','color':'rgba(251,146,60,0.08)','exercises':[
        {'name':'Seated Calf Raises (toes pointed out)','sets':'4×20','tempo':'1:2:1:2','rest':'60 sec','note':'Slight outward toe targets inner calf head'},
      ]},
    ]},
  { 'id':'v2','label':'V2','title':'Deadlift & Hack Focus',
    'note':'Heavy posterior chain anchor with hack squat quad variation and walking lunges.',
    'sections':[
      {'label':'Quads','emoji':'🦵','color':'rgba(251,146,60,0.15)','exercises':[
        {'name':'Barbell Squat (feet inside shoulder width)','sets':'5×10','tempo':'3:0:1:0','rest':'90 sec','note':'Close stance · toes forward · quad sweep focus'},
        {'name':'Hack Squat (low and inside shoulder width)','sets':'12,10,8,8','tempo':'4:0:1:0','rest':'90 sec','note':'Pyramid up · low foot placement'},
        {'name':'Quad Extensions','sets':'4×12','tempo':'1:0:1:2','rest':'60 sec','note':'2-second squeeze at full extension'},
      ]},
      {'label':'Hamstrings & Glutes','emoji':'🏋️','color':'rgba(251,146,60,0.10)','exercises':[
        {'name':'Deadlifts','sets':'5×5','tempo':'','rest':'2 min','note':'Low rep heavy · reset each rep · full stop at bottom'},
        {'name':'Leg Press (high and wide)','sets':'4×10','tempo':'2:0:1:0','rest':'90 sec','note':'High foot placement · wide stance · glute/ham emphasis'},
        {'name':'Smith Machine Hip Thrust','sets':'4×15','tempo':'1:0:1:2','rest':'60 sec','note':'Full hip extension · 2-second squeeze at top'},
        {'name':'DB Walking Lunges','sets':'3×12 each leg','tempo':'1:2:1:0','rest':'60 sec','note':'Required · torso upright · drive through front heel'},
      ]},
      {'label':'Calves','emoji':'🦶','color':'rgba(251,146,60,0.08)','exercises':[
        {'name':'Smith Machine Calf Raises','sets':'4×20','tempo':'1:2:1:2','rest':'60 sec','note':'Full plantarflexion at top · deep stretch at bottom'},
      ]},
    ]},
  { 'id':'v3','label':'V3','title':'Drop Set Volume Day',
    'note':'Pyramid into drop sets on key lifts. Posterior chain heavy anchor keeps intensity high.',
    'sections':[
      {'label':'Quads','emoji':'🦵','color':'rgba(251,146,60,0.15)','exercises':[
        {'name':'Goblet Squat (heels elevated and together)','sets':'5×10','tempo':'3:0:1:0','rest':'90 sec','note':'Heels elevated · close stance · deep range'},
        {'name':'Leg Press (feet together)','sets':'12,10,8 drop 8','tempo':'','rest':'90 sec','note':'Drop set final — drop weight, no rest, 8 more'},
        {'name':'Quad Extensions','sets':'12,10,8 drop 8','tempo':'1:0:1:2','rest':'60 sec','note':'Drop set — squeeze at full extension'},
      ]},
      {'label':'Hamstrings & Glutes','emoji':'🏋️','color':'rgba(251,146,60,0.10)','exercises':[
        {'name':'Romanian Dead Lift','sets':'5×5','tempo':'','rest':'2 min','note':'Low rep heavy · bilateral · full hip hinge'},
        {'name':'Smith Machine Hip Thrust','sets':'4×12','tempo':'1:0:1:2','rest':'60 sec','note':'Full hip extension · 2-second squeeze at top'},
        {'name':'Goblet Squat (feet pointed out, outside shoulder width)','sets':'4×15','tempo':'1:2:1:0','rest':'60 sec','note':'Toes out · heels flat · glute focus'},
        {'name':'DB Walking Lunges','sets':'3×12 each leg','tempo':'1:2:1:0','rest':'60 sec','note':'Required · continuous · drive through front heel'},
      ]},
      {'label':'Calves','emoji':'🦶','color':'rgba(251,146,60,0.08)','exercises':[
        {'name':'Seated Calf Raises','sets':'12,10,8 drop 15','tempo':'1:2:1:2','rest':'60 sec','note':'Drop set finisher — drop weight, pump out 15 more'},
      ]},
    ]},
  { 'id':'v4','label':'V4','title':'Pause & Isometric Day',
    'note':'Isometric holds and long eccentrics. Heavy posterior chain anchor with pause squats.',
    'sections':[
      {'label':'Quads','emoji':'🦵','color':'rgba(251,146,60,0.15)','exercises':[
        {'name':'Hack Squat (low and inside shoulder width)','sets':'4×8','tempo':'4:3:1:0','rest':'90 sec','note':'3-second isometric hold at bottom · heavy'},
        {'name':'Barbell Squat (feet inside shoulder width)','sets':'4×10','tempo':'1:2:1:0','rest':'90 sec','note':'Pause at bottom eliminates bounce'},
        {'name':'Leg Press (feet together)','sets':'4×10','tempo':'2:2:1:0','rest':'90 sec','note':'2-second pause at bottom of each rep'},
      ]},
      {'label':'Hamstrings & Glutes','emoji':'🏋️','color':'rgba(251,146,60,0.10)','exercises':[
        {'name':'Barbell Squat (feet outside shoulder width)','sets':'5×5','tempo':'','rest':'2 min','note':'Wide stance · heavy · posterior chain anchor'},
        {'name':'Romanian Deadlift','sets':'4×8','tempo':'4:2:1:0','rest':'90 sec','note':'4-second eccentric · 2-second stretch hold at bottom'},
        {'name':'Smith Machine Hip Thrust','sets':'4×15','tempo':'1:0:1:2','rest':'60 sec','note':'2-second squeeze at top each rep'},
        {'name':'DB Walking Lunges','sets':'3 sets to failure','tempo':'1:2:1:0','rest':'90 sec','note':'Required · walk to technical failure'},
      ]},
      {'label':'Calves','emoji':'🦶','color':'rgba(251,146,60,0.08)','exercises':[
        {'name':'Seated Calf Raises (toes pointed out)','sets':'4×15','tempo':'1:3:1:2','rest':'60 sec','note':'3-second isometric stretch at bottom · matches pause theme'},
      ]},
    ]},
  { 'id':'v5','label':'V5','title':'High Volume Pump Day',
    'note':'Moderate weight, maximum reps. High-set quad burnout and hamstring volume.',
    'sections':[
      {'label':'Quads','emoji':'🦵','color':'rgba(251,146,60,0.15)','exercises':[
        {'name':'Goblet Squat (heels elevated and together)','sets':'5×10','tempo':'3:0:1:0','rest':'60 sec','note':'High rep primer · heels elevated · deep range'},
        {'name':'Quad Extensions','sets':'5×15','tempo':'1:0:1:2','rest':'60 sec','note':'High sets · 2-second squeeze at full extension'},
        {'name':'Leg Press (feet together)','sets':'4×20','tempo':'1:0:1:0','rest':'60 sec','note':'High rep pump · moderate weight'},
      ]},
      {'label':'Hamstrings & Glutes','emoji':'🏋️','color':'rgba(251,146,60,0.10)','exercises':[
        {'name':'Deadlifts','sets':'5×5','tempo':'','rest':'2 min','note':'Low rep heavy anchor · reset each rep'},
        {'name':'Leg Press (high and wide)','sets':'4×15','tempo':'2:0:1:0','rest':'60 sec','note':'High foot placement · glute/ham emphasis'},
        {'name':'Goblet Squat (feet pointed out, outside shoulder width)','sets':'4×15','tempo':'1:2:1:0','rest':'60 sec','note':'Toes out · high rep glute pump'},
        {'name':'DB Walking Lunges','sets':'4×12 each leg','tempo':'1:2:1:0','rest':'60 sec','note':'Required · high rep · continuous'},
      ]},
      {'label':'Calves','emoji':'🦶','color':'rgba(251,146,60,0.08)','exercises':[
        {'name':'Standing Leg Press Calf Raise','sets':'4×20','tempo':'1:2:1:2','rest':'60 sec','note':'20 reps · full ROM · 2-second pause at top'},
      ]},
    ]},
  { 'id':'v6','label':'V6','title':'Pyramid & Superset Day',
    'note':'Pyramid loading into supersets. Full quad/posterior chain coverage with finisher lunges.',
    'sections':[
      {'label':'Quads','emoji':'🦵','color':'rgba(251,146,60,0.15)','exercises':[
        {'name':'Smith Machine Cannonball Squats','sets':'12,10,8,8','tempo':'3:0:1:0','rest':'90 sec','note':'Pyramid up · close stance · deep squat'},
        {'name':'Hack Squat (low and inside shoulder width)','sets':'12,10,8,8','tempo':'4:0:1:0','rest':'90 sec','note':'Pyramid up · quad emphasis'},
        {'name':'Leg Press (feet together) / Quad Extensions (superset)','sets':'4×10 / 15','tempo':'','rest':'90 sec','note':'Complete leg press immediately into extensions — no rest'},
      ]},
      {'label':'Hamstrings & Glutes','emoji':'🏋️','color':'rgba(251,146,60,0.10)','exercises':[
        {'name':'Barbell Squat (feet outside shoulder width)','sets':'5×5','tempo':'','rest':'2 min','note':'Wide stance · heavy · posterior chain anchor'},
        {'name':'Romanian Deadlift','sets':'4×12','tempo':'3:0:1:0','rest':'90 sec','note':'Bilateral · 3-second eccentric'},
        {'name':'Goblet Squat (feet pointed out, outside shoulder width)','sets':'4×15','tempo':'1:2:1:0','rest':'60 sec','note':'Toes out · glute emphasis'},
        {'name':'DB Walking Lunges','sets':'3 sets to failure','tempo':'1:2:1:0','rest':'90 sec','note':'Required · walk to technical failure'},
      ]},
      {'label':'Calves','emoji':'🦶','color':'rgba(251,146,60,0.08)','exercises':[
        {'name':'Smith Machine Calf Raises','sets':'12,10,8,8','tempo':'1:2:1:2','rest':'60 sec','note':'Pyramid up · 2-second squeeze at top'},
      ]},
    ]},
]

# ════════════════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════════════════

def main():
    if GITHUB_TOKEN == "YOUR_GITHUB_TOKEN_HERE":
        print("ERROR: Set GITHUB_TOKEN before running."); sys.exit(1)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    generated = []

    # ── Phase 2: Generate Daily Pump leg day pages ───────────────────────────
    print("\n── Phase 2: Generating Daily Pump leg day pages ──")

    # Split #1 (quads-pump.html) already exists — just deploy it
    generated.append(('quads-pump.html', 'quads-pump.html'))
    print("  QUEUED quads-pump.html (Daily Pump Split #1 · Quads & Calves)")

    # Split #3 — new pump-style quads/hams/glutes page (orange theme)
    s3_legs_html = make_leg_html(
        filename   = 'legs-s3-pump',
        back_href  = 'cat-pump-new4.html',
        eyebrow    = '🦵 Daily Pump · Split #3 · Legs',
        page_title = 'Quads / Hamstrings / Glutes',
        accent     = '#fb923c',
        accent_dim = 'rgba(251,146,60,0.13)',
        body_bg    = '#060c16',
        header_bg  = 'linear-gradient(135deg,#120a04,#060c16)',
        workouts   = S3_LQ_WORKOUTS,
    )
    with open('legs-s3-pump.html', 'w', encoding='utf-8') as f:
        f.write(s3_legs_html)
    print("  WROTE legs-s3-pump.html (Daily Pump Split #3 · Quads/Hams/Glutes)")
    generated.append(('legs-s3-pump.html', 'legs-s3-pump.html'))

    # Deploy updated category page
    generated.append(('cat-pump-new4.html', 'cat-pump-new4.html'))
    print("  QUEUED cat-pump-new4.html (updated with new leg day entries)")

    # ── Phase 6: Patch MC workout files with weeks 2/3/4 ────────────────────
    print("\n── Phase 6: Injecting Weeks 2/3/4 into MC workout files ──")
    patched = []
    for fname, additions in PATCHES.items():
        fpath = os.path.join(script_dir, fname)
        if not os.path.exists(fpath):
            print(f"  SKIP (not found): {fname}"); continue
        ok = patch_weeks(fpath, additions)
        if ok:
            patched.append((fname, fname))

    # ── Deploy all ────────────────────────────────────────────────────────────
    print("\n── Deploying to GitHub ──")
    all_files = generated + patched
    p = f = 0
    for local, remote in all_files:
        if deploy_file(local, remote): p += 1
        else: f += 1

    print(f"\nDone: {p} deployed, {f} failed")
    print(f"View: https://{REPO_OWNER}.github.io/{REPO_NAME}/")

if __name__ == "__main__":
    main()
