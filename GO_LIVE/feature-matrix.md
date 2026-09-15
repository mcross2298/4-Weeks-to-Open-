# GO LIVE — feature coverage matrix (MC Training)

Specification: the **Executive Summary** (`quick-tour-overview.html`), 8 sections, ~120 declared
capabilities. Protocol §1 names **61 product areas**. Inventory: **142 HTML pages, 163 JS modules,
14 stylesheets, 78 tools, 16 Supabase tables** (all RLS-enabled).

Legend — **D** driven in a real browser this session · **G** covered by a committed CI gate that
passed · **I** independently validated against a published formula · **—** not exercised

| Product area | D | G | I | Evidence / note |
|---|:-:|:-:|:-:|---|
| Dashboard | ✓ | ✓ | | rendered clean; smoke test + contrast + journey |
| Current Program hero / rail | | ✓ | | `check-program-colors`, `gen-program-css --check` |
| Training Tools grid | ✓ | | | all 7 tools opened and rendered non-empty |
| Programs (10, five designers) | | ✓ | | `check-program-data`, `validate-programs`, `check-set-schemes` |
| Conditioning Corner | | ✓ | | `battle-ropes.html` in smoke sample; journey interval timer |
| Smart Resume | ✓ | | | left mid-session → banner present → every set intact |
| Coach Note / Coach suggestions | | | | signed-in only — **not exercised** |
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
| Supersets / tri-sets | | ✓ | | `test-mc-setlog-plan`, `check-set-schemes`, journey superset pages |
| Drop sets / AMRAP | | ✓ | | `test-mc-setlog-plan`, `validate-programs` |
| Cluster sets | | ✓ | ✓ | `test-mc-cluster-reps`; independently: 200×(5+5+5) = 3,000 lb summed |
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
| Replace / reorder / notes | | ✓ | | `test-mc-biomech`, `check-single-impl` |
| AI exercise suggestions | | | | signed-in only — **not exercised** |
| Build Your Own | ✓ | ✓ | | page renders and accepts input |
| Quick Pump / Short-on-time | ✓ | ✓ | | **driven on `quick-pump.html`**: 30-min Full Body = 5 exercises, 45-min = 9, Chest focus = 5, all named and prescribed; plus `test-mc-quick-pump`, `test-mc-quick-pump-catalog` |
| Program Guide | ✓ | ✓ | | 2,443 chars rendered |
| **Nutrition / macro tracking** | ✓ | ✓ | ✓ | rings render; goals persist a reload |
| **Goal calculator** | ✓ | ✓ | ✓ | **230 assertions vs Mifflin-St Jeor / Atwater**; **DEF-04/05 found + fixed** |
| Food search / barcode / NL entry | | | | needs a live food API — **not exercised** |
| Nutrition facts sheet / favorites | | | | behind a sheet — **not exercised** |
| **Offline-first operation** | ~ | ✓ | | SW registers, **131 entries precached**; with the network dropped mid-session a set logs and persists (1 → 2) and the rest timer keeps running; **offline NAVIGATION unverifiable — DEF-09** |
| PWA installation | ✓ | ✓ | | manifest, 192+512 icons, standalone, `viewport-fit=cover`, iOS meta, `check-topbar-inset` |
| Account / sync | | ✓ | | `test-mc-sync-runtime`, `test-mc-sync-merge`; **no two-device test** |
| Export / import | | ✓ | | `check-store-coverage` (registry vs `mc-export.js` KEYS) |
| Appearance customization | | ✓ | | `check-design-tokens`, contrast ratchet |
| Biometric protection | | | | device-bound — **not testable headlessly** |
| **Notifications** | | | | **DEF-08 — 10/10 scheduled runs failed; 0 push subscriptions** |
| Accessibility | ✓ | ✓ | | **S3**: native `<button>`, `role=checkbox`, `aria-checked` flips, 44×44, Space/Enter work, reduced-motion honoured |
| Security / data isolation | | ~ | | 16/16 tables RLS-enabled; 1 advisory (leaked-password protection off); **`tests/test_rls.py` not runnable — no `SUPABASE_DB_URL`** |

## Personas run

| Persona | Status | Evidence |
|---|---|---|
| Serious lifter | ✓ | S1.1, S1.7 — full exercise logged, workout banked with all 11 sets |
| New user (no history) | ✓ | S2.1 — a first log is a baseline, not a record |
| Real gym user (phone, moving) | ✓ | S1.2/S1.5, S3.6 — reload, leave and return, timer across scroll and navigation |
| Custom user | ~ | S4.5 — Build Your Own renders; a full custom build was not driven |
| Coach | — | PM mode is biometric/owner-gated; not exercised |
| Offline user | ~ | S4.3 — signal drops mid-session: the set logs, persists and the timer runs; offline navigation blocked by DEF-09 |
| Chaos user | ✓ | S1.3/S1.4, S3.2/S3.4, S4.7 — duplicate taps, hostile values, timer spam, full storage |
