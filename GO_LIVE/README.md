# GO_LIVE — multi-app release assessment evidence

**Start with [`go_live_report.html`](go_live_report.html)** — the consolidated interactive report:
executive verdict, all 33 individual agent reports (11 agents x 3 phases), the defect matrix with
root causes, Lean Six Sigma DPMO and 5 Whys, the full feature-coverage matrix, and residual risk.

Produced under `claude_code_go_live_protocol.md` §0-§3 (2026-09-17), covering MC Training,
Cross' Finances and Mike's Cookbook. The two sibling apps' own scenarios and evidence live in their
own repositories under the same `GO_LIVE/` layout.

| File | What it holds |
|---|---|
| [`go_live_report.html`](go_live_report.html) | **The report.** Everything below, rendered and cross-linked |
| [`release-report.md`](release-report.md) | The verdict and per-phase summary, markdown form |
| [`bugs.md`](bugs.md) | Every defect: scenario, expected, observed, root cause, fix, regression test |
| [`fixes.md`](fixes.md) | Every change made, with the proof each was re-verified |
| [`feature-matrix.md`](feature-matrix.md) | Product areas x driven / gated / independently validated |
| [`test-plan.md`](test-plan.md) | Strategy, scenarios, environment, how to reproduce |
| [`regression.md`](regression.md) | Full gate results after every fix |
| [`risks.md`](risks.md) | Blockers, accepted risks, and the axes verified as *unverified* |
| `scenarios/cr/` | This run's clean-room campaigns — all committed and re-runnable |
| `evidence/cr/` | Raw per-assertion output as captured |

Everything here is scratch-listed in `content-manifest.json`, so it ships to neither the
GitHub Pages deploy nor the public Rolodex build.

---

# GO_LIVE — MC Training release assessment evidence

Produced under the GO LIVE Autonomous Release Protocol, §0 + §1 (2026-09-15).

| File | What it holds |
|---|---|
| [`release-report.md`](release-report.md) | The verdict, coverage, validation and the Final Auditor's independent challenge |
| [`bugs.md`](bugs.md) | 9 defects: scenario, expected, observed, root cause, fix, regression test, status |
| [`fixes.md`](fixes.md) | Every change made, with the proof each one was re-verified |
| [`feature-matrix.md`](feature-matrix.md) | All 61 protocol product areas × driven / gated / independently validated |
| [`test-plan.md`](test-plan.md) | Strategy, the 8 scenario sets, environment, how to reproduce |
| [`regression.md`](regression.md) | Full gate results, the three non-defects resolved by reproducing them, and the CA-trust diagnosis |
| [`risks.md`](risks.md) | Blockers, accepted risks, axes verified as *unverified*, corrections to the record |
| `scenarios/` | The 8 runnable campaigns — 5 browser, 3 independent-formula |
| `evidence/` | Raw gate output as captured |

Start with `release-report.md`.
