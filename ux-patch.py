#!/usr/bin/env python3
"""
UX Batch (U1-U3) patcher.

U1 — Float timer: auto-dismiss 4s after DONE + tap-anywhere overlay
U2 — Week tab active state: subtle bg tint + scale(0.96) on :active
U3 — Finish Workout modal: "Skipped" row (only when exercises unchecked)
"""
import os
import re

HTML_DIR = '/home/user/4-Weeks-to-Open-'
counts = {'u1': 0, 'u2': 0, 'u3': 0, 'files': 0}

# ─────────────────────────────────────────────────────────────────────────────
# U1 helpers
# ─────────────────────────────────────────────────────────────────────────────

def patch_u1(src):
    changed = False

    # 1. Add _autoDismiss property to TMR object (after activeName line)
    old = "  activeName: '',\n"
    new = "  activeName: '',\n  _autoDismiss: null,\n"
    if old in src and new not in src:
        src = src.replace(old, new, 1)
        changed = True

    # 2. stop() — clear auto-dismiss + hide overlay
    # Target the last line of stop() before the closing brace
    old = "    const float = document.getElementById('timerFloat');\n    if (float) float.classList.remove('visible');\n  },"
    new = (
        "    const float = document.getElementById('timerFloat');\n"
        "    if (float) float.classList.remove('visible');\n"
        "    const _ov=document.getElementById('timerOverlay');if(_ov)_ov.style.display='none';\n"
        "    if(this._autoDismiss){clearTimeout(this._autoDismiss);this._autoDismiss=null;}\n"
        "  },"
    )
    if old in src and new not in src:
        src = src.replace(old, new, 1)
        changed = True

    # 3. start() — show overlay when float becomes visible
    old = "    float.classList.add('visible');\n    floatEx.textContent = exerciseName;"
    new = (
        "    float.classList.add('visible');\n"
        "    const _sov=document.getElementById('timerOverlay');if(_sov)_sov.style.display='block';\n"
        "    floatEx.textContent = exerciseName;"
    )
    if old in src and new not in src:
        src = src.replace(old, new, 1)
        changed = True

    # 4. start() tick — schedule auto-dismiss when remaining hits 0
    old = (
        "        floatLabel.textContent = 'DONE!';\n"
        "        if (el) el.className = 'rest-timer done';\n"
        "      } else {"
    )
    new = (
        "        floatLabel.textContent = 'DONE!';\n"
        "        if (el) el.className = 'rest-timer done';\n"
        "        if(!this._autoDismiss)this._autoDismiss=setTimeout(()=>this.stop(),4000);\n"
        "      } else {"
    )
    if old in src and new not in src:
        src = src.replace(old, new, 1)
        changed = True

    # 5. setTime() tick — auto-dismiss on DONE in minified branch
    old = 'if(tl2)tl2.textContent="DONE ✓";try{navigator.vibrate&&navigator.vibrate([200,100,200,100,400]);}catch(e){}}'
    new = 'if(tl2)tl2.textContent="DONE ✓";try{navigator.vibrate&&navigator.vibrate([200,100,200,100,400]);}catch(e){}if(!TMR._autoDismiss)TMR._autoDismiss=setTimeout(()=>TMR.stop(),4000);}'
    if old in src and new not in src:
        src = src.replace(old, new, 1)
        changed = True

    # 6. buildTimerFloat() — add overlay + make time display tappable to dismiss
    old = (
        '      <button class="timer-float-btn timer-float-skip" onclick="TMR.stop()">✓ Done</button>\n'
        '      <button class="timer-float-btn timer-float-reset" onclick="TMR.stop()">✕ Cancel</button>\n'
        "    </div>`;\n"
        "  document.body.appendChild(div);\n"
        "}"
    )
    new = (
        '      <button class="timer-float-btn timer-float-skip" onclick="TMR.stop()">✓ Done</button>\n'
        '      <button class="timer-float-btn timer-float-reset" onclick="TMR.stop()">✕ Cancel</button>\n'
        "    </div>`;\n"
        "  document.body.appendChild(div);\n"
        "  if(!document.getElementById('timerOverlay')){"
        "const _tov=document.createElement('div');"
        "_tov.id='timerOverlay';"
        "_tov.style.cssText='position:fixed;inset:0;z-index:99;display:none;cursor:pointer;';"
        "_tov.addEventListener('click',function(){TMR.stop();});"
        "document.body.insertBefore(_tov,div);}\n"
        "}"
    )
    if old in src and new not in src:
        src = src.replace(old, new, 1)
        changed = True

    if changed:
        counts['u1'] += 1
    return src


# ─────────────────────────────────────────────────────────────────────────────
# U2 helpers
# ─────────────────────────────────────────────────────────────────────────────

# Matches .wtab.active{color:XXX;border-bottom-color:XXX;} — any color value
WTAB_ACTIVE_RE = re.compile(
    r'(\.wtab\.active\{)(color:[^;]+;border-bottom-color:[^;]+;)(\})'
)

def patch_u2(src):
    # Add background tint to .wtab.active and append :active scale rule
    def replacer(m):
        return m.group(1) + m.group(2) + 'background:rgba(255,255,255,0.07);' + m.group(3)

    new_src, n = WTAB_ACTIVE_RE.subn(replacer, src)
    if n and 'background:rgba(255,255,255,0.07)' not in src:
        # Append the :active scale rule right after the .wtab.active rule
        new_src = WTAB_ACTIVE_RE.sub(
            lambda m: m.group(0).rstrip('}') + 'background:rgba(255,255,255,0.07);}',
            src,
            count=1
        )
        # Add .wtab:active rule after the .wtab.active rule
        new_src = re.sub(
            r'(\.wtab\.active\{[^}]+\})',
            r'\1\n.wtab:active{transform:scale(0.96);}',
            new_src,
            count=1
        )
        counts['u2'] += 1
        return new_src
    return src


# ─────────────────────────────────────────────────────────────────────────────
# U3 helpers
# ─────────────────────────────────────────────────────────────────────────────

SKIP_FN = """
  function getSkippedExercises(){
    var sk=[];
    document.querySelectorAll('.ex-card:not(.checked),.ss-ex:not(.checked)').forEach(function(c){
      var nm=c.querySelector('.ex-name,.ss-name');if(nm)sk.push(nm.textContent.trim());
    });
    return sk;
  }
"""

def patch_u3(src):
    # Inject getSkippedExercises before window._FW
    old_fw_open = "  window._FW={"
    if old_fw_open in src and 'getSkippedExercises' not in src:
        src = src.replace(old_fw_open, SKIP_FN + '  window._FW={', 1)

    # Add skipped row to _FW.open() summary — append after the PRs row
    old_prs_row = (
        "(prs?'<div class=\"fw-summary-row\"><span class=\"fw-summary-label\">PRs set</span>"
        "<span class=\"fw-summary-val\" style=\"color:#d4af37;\">🏆 '+prs+'</span></div>':'');"
    )
    new_prs_row = (
        "(prs?'<div class=\"fw-summary-row\"><span class=\"fw-summary-label\">PRs set</span>"
        "<span class=\"fw-summary-val\" style=\"color:#d4af37;\">🏆 '+prs+'</span></div>':'')+\n"
        "          (function(){var sk=getSkippedExercises();"
        "return sk.length?'<div class=\"fw-summary-row\"><span class=\"fw-summary-label\""
        " style=\"color:#f87171;\">Skipped</span><span class=\"fw-summary-val\""
        " style=\"color:#f87171;font-size:11px;\">'+sk.join(', ')+'</span></div>':'';}());"
    )
    if old_prs_row in src and 'getSkippedExercises()' not in src.split('window._FW')[1] if 'window._FW' in src else True:
        if old_prs_row in src:
            src = src.replace(old_prs_row, new_prs_row, 1)
            counts['u3'] += 1

    return src


# ─────────────────────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────────────────────

changed_files = []

for fname in sorted(os.listdir(HTML_DIR)):
    if not fname.endswith('.html'):
        continue
    fpath = os.path.join(HTML_DIR, fname)
    with open(fpath, encoding='utf-8') as f:
        src = f.read()

    original = src
    src = patch_u1(src)
    src = patch_u2(src)
    src = patch_u3(src)

    if src != original:
        counts['files'] += 1
        changed_files.append(fname)
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(src)

print(f"Files modified : {counts['files']}")
print(f"U1 timer UX    : {counts['u1']}")
print(f"U2 tab feedback: {counts['u2']}")
print(f"U3 skipped row : {counts['u3']}")
print(f"\nChanged files ({len(changed_files)}):")
for f in changed_files:
    print(' ', f)
