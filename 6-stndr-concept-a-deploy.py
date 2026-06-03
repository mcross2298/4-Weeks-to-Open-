#!/usr/bin/env python3
"""
6-stndr-concept-a-deploy.py — ship the Concept A exercise-card redesign to the
four STNDR program pages.

What it does (idempotent):
  1. Replaces each page's inline renderExercise() with the Concept A markup.
     The new markup keeps every behavioural hook other modules depend on:
       - root .ex-card  + inner .ex-body          (mc-setlog host, mc-card-actions
                                                    notes/reorder/meatball host,
                                                    mc-summary / progress counting)
       - .ex-name + [data-field=name]             (check-off id + edit + summary name)
       - exactly ONE [data-field=sets] (raw sets) (mc-setlog parse + mc-summary
                                                    set/rep counting + edit)
       - makeRestTimer() .rest-timer[data-rest]   (rest seconds + auto-start + hop)
     It additionally renders tempo pills (weeks/PPL), a notes block (bro-split)
     and any tag (SUPERSET / TRI-SET / CLUSTER) so all four pages are covered by
     one uniform function.
  2. Appends the accent-driven Concept A styles to base.css, scoped strictly to
     .ex-card.a-card / .a-* so no other program is affected.

Run from the repo root:  python3 6-stndr-concept-a-deploy.py
"""
import io, sys, os

PAGES = ["weeks-to-open.html", "push-pull-legs.html", "bro-split.html", "legacy-prep.html"]
SIG = "function renderExercise(ex,dIdx,eIdx){"

NEW_FN = r'''function renderExercise(ex,dIdx,eIdx){
  // Concept A — accent-driven exercise card. Preserves all behavioural hooks
  // (.ex-card/.ex-body/.ex-name/[data-field=sets|name|rest]/.rest-timer) that
  // mc-setlog.js, mc-card-actions.js, mc-summary.js and stndr-checkoff.js use.
  const grouped=ex.tag==="SUPERSET"||ex.tag==="TRI-SET";
  const ssCls=grouped?" is-ss":(ex.tag==="CLUSTER"?" is-cluster":"");
  const legsArr=String(ex.sets||"—").split("/").map(s=>s.trim());
  const repsHtml=legsArr.map((part,pi)=>{
    const reps=part.split(",").map(r=>r.trim());
    const legTag=legsArr.length>1?`<span class="a-legtag">${pi===0?"A":"B"}</span>`:"";
    const chips=reps.map((rep,ri)=>{
      const special=rep.toUpperCase().includes("AMRAP")||rep.includes("Drop")||rep.includes("×");
      const cls=special?"a-rep special":(ri===0?"a-rep live":"a-rep");
      const sep=ri<reps.length-1?'<span class="a-sep">·</span>':"";
      return `<span class="${cls}">${escapeHtml(rep)}</span>${sep}`;
    }).join("");
    return `<div class="a-leg">${legTag}${chips}</div>`;
  }).join("");
  const badges=[];
  if(ex.tag)badges.push(`<span class="a-pill grp">${escapeHtml(ex.tag)}</span>`);
  if(ex.tempo)ex.tempo.split("/").forEach(t=>badges.push(`<span class="a-pill tempo">⏱ ${escapeHtml(t.trim())}</span>`));
  const badgeHtml=badges.length?`<div class="a-badges">${badges.join("")}</div>`:"";
  const notesHtml=ex.notes?`<div class="a-notes">📝 ${escapeHtml(ex.notes)}</div>`:"";
  return `<div class="ex-card a-card${ssCls}"><div class="ex-body">
    <div class="a-top">
      <div class="a-idx">${eIdx+1}</div>
      <div class="a-head">
        <div class="ex-name a-name"><span class="editable" data-field="name" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.name)}</span></div>
        ${badgeHtml}
      </div>
    </div>
    <div class="a-reps">${repsHtml}</div>
    <div class="a-strip">
      <div class="a-cell"><span class="k">Sets</span><span class="v"><span class="editable" data-field="sets" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.sets)}</span></span></div>
      <div class="a-cell"><span class="k">Rest</span><span class="v"><span class="editable" data-field="rest" data-d="${dIdx}" data-e="${eIdx}">${escapeHtml(ex.rest)}</span></span></div>
    </div>
    <div class="a-timerbar">${makeRestTimer(ex.rest||'60 sec',ex.name)}</div>
    ${notesHtml}
  </div></div>`;
}'''

CSS_MARK = "/* ==== STNDR Concept A exercise card (deploy: 6-stndr-concept-a) ==== */"
CSS = CSS_MARK + r"""
/* Accent-driven so each program keeps its own hue (gold / orange / green).
   Scoped to .ex-card.a-card so no other program's cards are affected. */
.ex-card.a-card{
  border:1px solid rgba(var(--accent-rgb),0.18);
  background:linear-gradient(180deg,#0d0f12,#0a0b0d);
  box-shadow:0 10px 30px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.05);
  border-radius:16px;overflow:hidden;position:relative;
}
.ex-card.a-card::after{content:none;}              /* drop base square affordance */
.ex-card.a-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;z-index:1;
  background:linear-gradient(180deg,rgba(var(--accent-rgb),1),rgba(var(--accent-rgb),0.45));
  box-shadow:0 0 16px rgba(var(--accent-rgb),0.5);}
.ex-card.a-card.is-ss::before{background:linear-gradient(180deg,#a855f7,#6d28d9);box-shadow:0 0 16px rgba(168,85,247,0.5);}
.ex-card.a-card.is-cluster::before{background:linear-gradient(180deg,#22d3ee,#0e7490);box-shadow:0 0 16px rgba(34,211,238,0.45);}
.ex-card.a-card .stndr-ck{display:none;}           /* completion shown via idx + strike; beats checkoff's injected style */
.a-top{display:flex;align-items:flex-start;gap:11px;padding:14px 42px 10px 18px;}
.a-idx{font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;min-width:30px;height:30px;
  border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:1px;
  background:rgba(var(--accent-rgb),0.12);color:var(--accent);border:1px solid rgba(var(--accent-rgb),0.3);}
.a-card.is-ss .a-idx{background:rgba(168,85,247,0.14);color:#c084fc;border-color:rgba(168,85,247,0.35);}
.a-card.checked .a-idx{background:#16a34a;color:#fff;border-color:transparent;}
.a-head{flex:1;min-width:0;}
.a-card .ex-name.a-name{font-size:15px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;margin-bottom:0;color:var(--text);padding-right:0;}
.a-badges{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap;}
.a-pill{font-size:10px;font-weight:900;letter-spacing:0.07em;text-transform:uppercase;padding:3px 8px;border-radius:6px;}
.a-pill.grp{background:rgba(168,85,247,0.16);color:#c084fc;border:1px solid rgba(168,85,247,0.32);}
.a-pill.tempo{background:rgba(var(--accent-rgb),0.1);color:var(--accent);border:1px solid rgba(var(--accent-rgb),0.28);font-family:"SF Mono",ui-monospace,monospace;letter-spacing:0.02em;}
.a-reps{padding:2px 16px 12px 18px;}
.a-leg{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.a-leg + .a-leg{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.07);}
.a-rep{font-size:25px;font-weight:900;letter-spacing:-0.03em;font-variant-numeric:tabular-nums;color:#3a4661;line-height:1;}
.a-rep.live{color:#fff;text-shadow:0 0 18px rgba(var(--accent-rgb),0.65);}
.a-rep.special{color:#fb7185;font-size:18px;text-shadow:0 0 14px rgba(251,113,133,0.4);}
.a-sep{font-size:12px;color:#475569;font-weight:900;align-self:center;}
.a-legtag{font-size:9px;font-weight:900;letter-spacing:0.14em;color:#475569;text-transform:uppercase;align-self:center;}
.a-strip{display:flex;align-items:stretch;border-top:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.22);}
.a-cell{flex:1;padding:9px 14px;display:flex;flex-direction:column;gap:3px;min-width:0;}
.a-cell + .a-cell{border-left:1px solid rgba(255,255,255,0.07);}
.a-cell .k{font-size:9.5px;font-weight:900;letter-spacing:0.14em;color:#475569;text-transform:uppercase;}
.a-cell .v{font-size:13px;font-weight:800;color:var(--text);}
.a-card .a-cell .v .editable{border-bottom:1px dashed rgba(var(--accent-rgb),0.4);color:var(--text);}
.a-timerbar{padding:10px 16px 12px 18px;}
.a-card .a-timerbar .rest-timer{width:100%;justify-content:center;}
.a-card .a-timerbar .rest-timer.idle{background:rgba(var(--accent-rgb),0.1);border:1px solid rgba(var(--accent-rgb),0.26);}
.a-card .a-timerbar .rest-timer.idle .rest-timer-label{color:var(--accent);}
.a-notes{margin:0 16px 12px 18px;padding:7px 10px;background:rgba(var(--accent-rgb),0.06);
  border-left:3px solid rgba(var(--accent-rgb),0.5);border-radius:4px;font-size:11px;color:var(--text);line-height:1.5;}
/* tidy the logger that mc-setlog injects at the foot of .ex-body */
.a-card .mcl-toggle,.a-card .setlog-toggle{border-top:1px solid rgba(255,255,255,0.07);}
/* ==== /STNDR Concept A ==== */
"""

def replace_fn(src):
    i = src.find(SIG)
    if i < 0:
        return None
    # find the closing brace: first line after the signature that is exactly "}"
    nl = src.find("\n", i)
    j = nl
    while True:
        nxt = src.find("\n", j + 1)
        if nxt < 0:
            line = src[j+1:]
            end = len(src)
        else:
            line = src[j+1:nxt]
            end = nxt
        if line.strip() == "}":
            return src[:i] + NEW_FN + src[end:]
        if nxt < 0:
            return None
        j = nxt

def main():
    changed = []
    for p in PAGES:
        with io.open(p, encoding="utf-8") as f:
            src = f.read()
        out = replace_fn(src)
        if out is None:
            print("  !! could not locate renderExercise in", p); sys.exit(1)
        if out != src:
            with io.open(p, "w", encoding="utf-8") as f:
                f.write(out)
            changed.append(p)
            print("  ok renderExercise ->", p)
        else:
            print("  -- unchanged", p)
    # base.css
    with io.open("base.css", encoding="utf-8") as f:
        css = f.read()
    if CSS_MARK in css:
        print("  -- base.css already has Concept A block")
    else:
        if not css.endswith("\n"):
            css += "\n"
        with io.open("base.css", "w", encoding="utf-8") as f:
            f.write(css + "\n" + CSS + "\n")
        print("  ok appended Concept A styles -> base.css")
    print("done. pages changed:", len(changed))

if __name__ == "__main__":
    main()
