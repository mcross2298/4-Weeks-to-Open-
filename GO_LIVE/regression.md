# GO LIVE — regression results

Baseline `main` @ `905286f`, CI green (`pages.yml` #357, which calls `verify.yml`). That green run is
what lets this assessment separate a real failure from an environment artifact: any gate that fails
here but passed in CI on the same tree is the environment, not the app.

## Committed gates — full run

| Tier | Executed | Passed | Notes |
|---|---:|---:|---|
| JS syntax (`node --check`, every tracked file) | 163 | 163 | |
| Node/Python gates (canonical list) | 46 | 46 | |
| Node gates in `verify.yml` but absent from the canonical list | 3 | 3 | `check-set-schemes`, `test-mc-setlog-plan`, `test-mc-streak` — see DEF-07 |
| New gates added by this assessment | 2 | 2 | `test-mc-macrocalc` (230 assertions), `test-mc-pr-scope` (7 cases) |
| Browser correctness gates | 5 | 5 | identity · concurrency · store-resilience · crash-recovery · PR-scope |
| Journey gate | 1 | 1 | 9/9 journeys · 3/3 subsystems · real 59 px inset pass on 9 pages |
| Render smoke test | 1 | 1 | 38 pages, zero console errors, no duplicate ids |
| Light-mode contrast ratchet | 1 | 1 | 141 pages, 273 findings, **none over budget**; 8 pages improved |
| **Total** | **60** | **58** | plus 1 informational and 1 not runnable here — below |

### The two that did not produce a verdict here

- **`check-contrast.js --dark`** — ran clean (`rc=0`) but is **informational only**:
  `contrast-budgets-dark.json` does not exist, so it measures and never fails. Measured **160
  findings across 141 pages**. Not comparable to the 587 recorded in `W-I3`, because the font
  constraint below changes text metrics.
- **`check-visual-ratchet.js`** — failed on 5 kitchen-sink baselines with page-height deltas of
  **2–35 px** (e.g. 1099 → 1108). **Environment, not a regression**: the same tree passed this gate
  in CI on this commit.

## The font constraint, reproduced — and its real cause identified

Four roadmap phases (`P4`, `W-I3`, `V-10`, `V-13`) record that the ratchets cannot be re-baselined
from an agent session, attributing it to the browser's network being blocked. Reproduced here, and
the mechanism is narrower and more actionable than that:

```
document.fonts.size        = 0
body font-family           = Manrope, system-ui, sans-serif   (asking for a font it never got)
failed font request        = net::ERR_CERT_AUTHORITY_INVALID
                             https://fonts.googleapis.com/css2?family=Archivo:...
curl the same URL          = HTTP 200
```

It is **not** a network block — it is a **CA-trust failure**. `curl` trusts the agent proxy's CA
(`/root/.ccr/ca-bundle.crt`, also on `NODE_EXTRA_CA_CERTS`); the Playwright-launched Chromium uses
its own NSS store and does not. So every page renders in the `system-ui` fallback and text metrics
differ from CI by a few pixels per block — exactly the deltas the visual ratchet reported.

**Remedy** (not applied — `certutil` is absent and `libnss3-tools` is not fetchable here): add the
proxy CA to Chromium's NSS store, e.g.
`certutil -d sql:$HOME/.pki/nssdb -A -n agentproxy -t C,, -i /root/.ccr/ca-bundle.crt`.
That would make both ratchets honestly re-baselinable from a session for the first time. Disabling
certificate verification is **not** the fix and was not done.

## Scenario campaigns

| Campaign | Result | Notes |
|---|---|---|
| S1 workout logger | **20 / 20** | re-run after the `mc-finish.js` change — no regression |
| S2 PR & progression | **16 / 16** | independently computed expectations; re-run after the fix |
| S3 timer & accessibility | **28 / 34** | 6 remaining are unreachable-input hardening (below) |
| S4 PWA / nutrition / tools | **33 / 33** | after DEF-10's corrections; was 23/26 |
| Independent 1RM math | **141 / 141** | vs the published Epley formula |
| Independent strain math | **14 / 14** | vs `MET × kg × h`; surfaced DEF-02 |
| Independent macro math | **119 / 119** | vs Mifflin-St Jeor / Atwater; promoted to a 230-assertion CI gate |

### Three reported failures that were not defects — resolved by reproducing them

1. **"a 1 s rest never stops itself."** It does. At expiry the timer latches DONE, buzzes, announces,
   and schedules `stop()` **4 s later**. Measured: `running=true` at +1.5 s (label `DONE!`), still
   true at +4.5 s (`OVERTIME`), `running=false` by +6 s. The harness waited 2.2 s.
2. **"the storage-full banner never appears."** It appears when a write genuinely fails. With storage
   full, *replacing* `mc_setlog_v1` still succeeds because the old bytes are freed first — which
   independently re-confirms the `M7` correction in `engine-repair-roadmap.md`. Handing the guarded
   writer a 3 MB value produced a real `role="alert"`: *"Storage full — this set was not saved. Keep
   training — your sets still reach the cloud if you are signed in."*
3. **"the Nutrition tab renders no macro content."** It renders 17 ring elements, the week calendar,
   the four macro readouts and the planned-meals card. The harness regex required
   `calorie|protein|carb|fat|kcal`; the tab says "macros".

### The 6 remaining S3 assertions — hardening, not live defects

`TMR.start(el, durationSecs, name)` does not validate `durationSecs`, so `'abc'`, `null`, `NaN`,
`Infinity` and `-30` land in `TMR.duration` unchanged. **No live call site can reach it**, verified:
the delegated handler passes `parseInt(btn.dataset.secs, 10) || 0`, `mc-setlog.js` passes
`TMR.parseSeconds(...) || rs`, and `cat-gainz.html` passes a computed number — all finite and
non-negative. Filed as P3 hardening; a one-line clamp at entry would close it and match the
"finite and non-negative" invariant the repo already holds its calculations to.

## The CI round on PR #351

The first CI run went red, and every one of the three failures was correct — see `DEF-10`. All three
gates sweep **tracked** `.js` files, and the local sweep had run while `GO_LIVE/scenarios/` was still
untracked, so none of them could see it. The lesson is small and worth keeping: **run the fleet-wide
scans after `git add`, not before**, or they are blind to exactly the files being added.

| Gate | What it caught | Resolution |
|---|---|---|
| `test-mc-maxout` | A second Epley implementation in the independent validator | Frozen golden table instead — satisfies the gate and is the better test |
| `check-dangling-refs` | `window.MC_QUICK_PUMP` and `window.MC_MAXOUT` assigned nowhere — the assessment's own guessed names | Real globals used; Quick Pump now genuinely exercised |
| `check-store-coverage` | `mc_setlog_probe_v1`, an undeclared key in a governed namespace | Renamed out of the `mc_*` namespace |

After the fixes: JS syntax 163/163, all 46 canonical static gates plus the 4 CI-only node gates green,
`check-dangling-refs` resolving 497 element ids and 161 globals across 315 files, and all three
independent validators passing (169 / 119 / 14).
