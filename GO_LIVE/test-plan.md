# GO LIVE — test plan (MC Training)

## Strategy

The app already carries an unusually strong committed gate suite, so this assessment did not
re-litigate it — it **ran all of it**, then spent its effort where nothing in that suite looks:
driving real sessions, and validating the numbers the athlete acts on against *published formulas*
rather than against the app's own functions.

Three tiers, in order:

1. **Run every committed gate.** 50 node/python gates + 10 browser gates. Establishes the baseline
   and tells you which reported failures are environmental rather than real.
2. **Independently validate the calculations.** Expected values computed in the test file from the
   published formula (Epley, Mifflin-St Jeor, Atwater, the MET equation), never by calling the app
   and agreeing with it. This is what found DEF-02 and DEF-04.
3. **Drive the product as a person uses it.** Seven scenario sets in real headless Chromium against
   the real store. This is what found DEF-01 and DEF-03 — neither is visible in source.

## Scenario sets (all in `GO_LIVE/scenarios/`, all re-runnable)

| ID | File | What it attacks |
|---|---|---|
| S1 | `s1-workout-logger.js` | Full exercise logged · reload mid-session · duplicate rapid taps · negative/absurd/text/empty input · leave and return · cold reopen in a new tab · finish and bank · reopen from history |
| S2 | `s2-pr-progression.js` | PR detection against seeded history with independently computed expectations: no history, beat it, miss it, equal it, beat-the-latest-not-the-best, multiple PRs, cross-page scope |
| S3 | `s3-timer-accessibility.js` | Timer: start · ±15 · −15 spam past zero · cancel · 8 overlapping starts · 1 s and 2 h durations · bogus durations · scroll · navigate away. A11y: native button, keyboard focus, Enter/Space, `role=checkbox`, `aria-checked`, 44×44, reduced motion |
| S4 | `s4-pwa-nutrition-tools.js` | Manifest/install meta · SW registration and precache · offline launch and offline logging · goal calculator round-trip · 7 training tools · Quick Pump · storage exhaustion |
| S4b | `s4b-isolation-probes.js` | Reproduction harness for the three S4 failures — separates app defect from harness artifact |
| — | `indep-1rm-math.js` | 141 assertions: Epley vs the published formula, rep cap, leverage coefficient, monotonicity, garbage guards, cluster top-set rule |
| — | `indep-strain-math.js` | Tonnage as an independent sum, kcal vs `MET × kg × h`, the saturation boundary, RPE-bonus reachability, duration cap |
| — | `indep-macro-math.js` | BMR/TDEE/target/split vs Mifflin-St Jeor and Atwater across four bodies × five activity levels × three goals |

## Environment

- Node v22.22.2, Python 3.11.15, Playwright installed to `/tmp/pw-ci`, Chromium 1194 at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (via `MC_CHROMIUM`).
- Static server on `http://localhost:8080` serving the real tree.
- Viewports 390×844 (iPhone 13) and 320 where a gate covers it.

## How to reproduce

```bash
npm install --no-save --prefix /tmp/pw-ci playwright@latest pixelmatch pngjs
python3 -m http.server 8080 &
export NODE_PATH=/tmp/pw-ci/node_modules
export MC_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # adjust to the installed build
node GO_LIVE/scenarios/s1-workout-logger.js http://localhost:8080
node GO_LIVE/scenarios/s2-pr-progression.js http://localhost:8080
node GO_LIVE/scenarios/s3-timer-accessibility.js http://localhost:8080
node GO_LIVE/scenarios/s4-pwa-nutrition-tools.js http://localhost:8080
node GO_LIVE/scenarios/indep-1rm-math.js
node GO_LIVE/scenarios/indep-macro-math.js
```

## Deliberately out of scope for this phase

Cross' Finances and Mike's Cookbook (protocol §2 and §3 were not read). Real-device QA, two-device
Supabase reconciliation, signed-in-only features, and the live food API — each named in
`GO_LIVE/risks.md` as an unverified axis rather than quietly counted as passing.
