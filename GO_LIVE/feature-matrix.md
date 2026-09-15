# GO LIVE — feature coverage matrix (MC Training)

Specification: the **Executive Summary** (`quick-tour-overview.html`), 8 sections, ~120 declared
capabilities. Protocol §1 names **61 product areas**. Inventory: **142 HTML pages, 163 JS modules,
14 stylesheets, 78 tools, 16 Supabase tables** (all RLS-enabled).

Legend — **D** driven in a real browser · **G** covered by a committed CI gate that passed ·
**I** independently validated against a published formula · **—** not exercised

**Updated after Phase 2 (2026-09-15):** pages rendered 38 → **142 (all)**; workout pages driven
through a complete session 9 → **71 of 79**; set types, the ⋮ menu, cluster, supersets, Build Your
Own, Quick Pump, replacement, nutrition, conditioning and live RLS all exercised.

| Product area | D | G | I | Evidence / note |
|---|:-:|:-:|:-:|---|
| Dashboard | ✓ | ✓ | | rendered clean; smoke test + contrast + journey |
| Current Program hero / rail | | ✓ | | `check-program-colors`, `gen-program-css --check` |
| Training Tools grid | ✓ | | | all 7 tools opened and rendered non-empty |
| Programs (10, five designers) | | ✓ | | `check-program-data`, `validate-programs`, `check-set-schemes` |
| Conditioning Corner | ✓ | ✓ | | **9 routines render on the tab; a real conditioning page opens, run controls ≥44px** |
| Smart Resume | ✓ | | | left mid-session → banner present → every set intact |
| Coach Note / Coach suggestions | ~ | | | signed-OUT path driven: sensible empty state, throws nothing. The signed-in content itself still not exercised |
| Recipes/Cookbook integration | | ✓ | | `test-mc-bridge`, `test-mc-sync-merge` |
| Today's planned meals | ✓ | ✓ | | card renders its signed-out state correctly |
| Weekly pulse / Weekly Review | | ✓ | | `test-mc-readiness`, `test-mc-streak` |
| Muscle Map (Stats) | ✓ | | | `stats.html` renders SVG figures |
| Daily Vitals | | ✓ | | `check-store-coverage` (`mc_vitals_v1`) |
| Readiness Brief / Lighter mode | | ✓ | | `test-mc-program-day`, `gen-schedules --check` |
| Program deload weeks | | ✓ | | `test-mc-gen-schedules` (no peak week flagged) |
| Exercise library (580) | ✓ | ✓ | | 1,510 elements rendered; `test-mc-catalog-integrity` |
| **Workout logging** | ✓ | ✓ | | **S1: 20/20** — full exercise, reload, cold reopen, garbage input |
| Rest timers | ✓ | ✓ | | **S3: timer attack**, `check-one-timer` |
| Supersets / tri-sets | ✓ | ✓ | | **both legs of a real pair driven on `iron-engine`; each stores under its own history key** |
| Drop sets / AMRAP | ✓ | ✓ | | **12 drop rows and 64 AMRAP rows driven across 10 pages; DEF-11 found + fixed** |
| Cluster sets | ✓ | ✓ | ✓ | **🧩 flow driven end to end — works after a reload, not mid-session (DEF-12)** |
| Tempo | | ✓ | | `test-mc-pmc-confusion`, `check-program-data` |
| Guided Mode | | ✓ | | `check-journey` subsystem pass, 3/3 |
| Voice control | | ✓ | | load-and-publish assertion only (no `SpeechRecognition` headless) |
| **PR detection** | ✓ | ✓ | ✓ | **S2: 16/16 independent expectations**; **DEF-03 found + fixed**; new gate |
| Strain / estimated calories | | ✓ | ✓ | `test-mc-strain`; **DEF-02 found** — saturates above 100 lb/min |
| Session muscle map | | ✓ | | rendered inside the recap; `check-dangling-refs` |
| Refuel recommendations | | ✓ | ✓ | `proteinTarget` bounds verified |
| Workout history | ✓ | | | finished session appeared as a real history card |
| Rep progression | | ✓ | ✓ | `test-mc-suggest`; Epley monotonicity verified |
| Max-Out Calculator | ✓ | ✓ | ✓ | **141 independent 1RM assertions**, rep cap 12, ×0.85 coefficient |
| MC Wrapped | ✓ | ✓ | | renders; `check-dangling-refs` |
| Replace / reorder / notes | ✓ | ✓ | | **all 9 ⋮ actions present and 46–49px; notes persist + gold dot; replacement repaints in place and after reload** |
| AI exercise suggestions | | | | signed-in only — **not exercised** |
| Build Your Own | ✓ | ✓ | | page renders; **a custom workout runs and logs through `run-workout.html`** |
| Quick Pump / Short-on-time | ✓ | ✓ | | **driven on `quick-pump.html`**: 30-min Full Body = 5 exercises, 45-min = 9, Chest focus = 5, all named and prescribed; plus `test-mc-quick-pump`, `test-mc-quick-pump-catalog` |
| Program Guide | ✓ | ✓ | | 2,443 chars rendered |
| **Nutrition / macro tracking** | ✓ | ✓ | ✓ | rings render; goals persist a reload |
| **Goal calculator** | ✓ | ✓ | ✓ | **230 assertions vs Mifflin-St Jeor / Atwater**; **DEF-04/05 found + fixed** |
| Food search / barcode / NL entry | | | | needs a live food API — **not exercised** |
| Nutrition facts sheet / favorites | ~ | | | **favorites + a logged food + goals all survive a reload**; the ◎/★/⚙ entry controls measure 38px (DEF-13). The facts sheet itself still needs the live food API |
| **Offline-first operation** | ~ | ✓ | | SW registers, **131 entries precached**; with the network dropped mid-session a set logs and persists (1 → 2) and the rest timer keeps running; **offline NAVIGATION unverifiable — DEF-09** |
| PWA installation | ✓ | ✓ | | manifest, 192+512 icons, standalone, `viewport-fit=cover`, iOS meta, `check-topbar-inset` |
| Account / sync | | ✓ | | `test-mc-sync-runtime`, `test-mc-sync-merge`; **no two-device test** |
| Export / import | | ✓ | | `check-store-coverage` (registry vs `mc-export.js` KEYS) |
| Appearance customization | ✓ | ✓ | | **dark mode driven on 26 pages: 3 invisible-text findings, all one defect (DEF-14), fixed** |
| Biometric protection | | | | device-bound — **not testable headlessly** |
| **Notifications** | | | | **DEF-08 — 10/10 scheduled runs failed; 0 push subscriptions** |
| Accessibility | ✓ | ✓ | | **S3**: native `<button>`, `role=checkbox`, `aria-checked` flips, 44×44, Space/Enter work, reduced-motion honoured |
| Security / data isolation | ✓ | ~ | | **12 live cross-user attacks, all blocked** (read, update, delete, forge, self-grant admin/tester, non-admin override write); 16/16 tables RLS-enabled; 1 advisory |

## Personas run

| Persona | Status | Evidence |
|---|---|---|
| Serious lifter | ✓ | S1.1, S1.7 — full exercise logged, workout banked with all 11 sets |
| New user (no history) | ✓ | S2.1 — a first log is a baseline, not a record |
| Real gym user (phone, moving) | ✓ | S1.2/S1.5, S3.6 — reload, leave and return, timer across scroll and navigation |
| Custom user | ✓ | Phase 2 D5/E4 — a custom workout and a Quick Pump session both run and log through `run-workout.html` |
| Coach | — | PM mode is biometric/owner-gated; not exercised |
| Offline user | ~ | S4.3 — signal drops mid-session: the set logs, persists and the timer runs; offline navigation blocked by DEF-09 |
| Chaos user | ✓ | S1.3/S1.4, S3.2/S3.4, S4.7 — duplicate taps, hostile values, timer spam, full storage |
