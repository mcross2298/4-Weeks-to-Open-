# GO LIVE — remaining risk

## Release blockers

None in the code as it now stands.

**One blocker on the product claim, not the code:** `DEF-08` — the weekly check-in push has failed
**10 of 10** scheduled runs since 2026-07-12 and `push_subscriptions` holds **0 rows**. Executive
Summary §7 promises "a short recap lands once a week". Either set the secret and prove one run
succeeds, or remove the claim before launch. This is owner action and cannot be closed from a session.

## Accepted risks (evidence-backed, non-blocking)

| Risk | Evidence | Why it is acceptable now |
|---|---|---|
| Session calorie estimate is duration-dominated | DEF-02 — MET saturates above 100 lb/min; 4× tonnage returns the identical 816 kcal | It is an estimate, the clamp is physiologically right, and the ring is normalised against the athlete's own trailing baseline so *relative* strain still reads correctly. The boundary is now pinned in CI so any recalibration is deliberate. |
| 273 light-mode contrast findings | `check-contrast.js`, 141 pages, none over budget | Ratcheted — can only shrink. 8 pages improved and could bank lower budgets from a CI run. |
| 160 dark-mode contrast findings, ungated | `check-contrast.js --dark`, no baseline file | Dark is the app's **default** theme, so this is the axis a regression can still ship on invisibly. Needs one `--dark --update` from CI. |
| 4 chrome controls under the 44 px floor | `check-journey` chrome pass: topbar icon and tour step dot, at 320 and 390 | Tracked by a ratchet that can only tighten; the fix (`W-I2`) is a separate design-reviewed change. |
| `TMR.start()` accepts a non-numeric duration | S3, 6 assertions | Unreachable from all three live call sites, verified by reading each. |
| PR occurrence-suffix case | DEF-03's own note | `<exId>` and `<exId>-2` on one page still count as separate lifts. Narrower than the fixed defect and wants its own measurement. |

## Known limitations — verified as *unverified*, not passed

| Axis | Why it could not be closed here |
|---|---|
| **Real offline behaviour** | DEF-09 — `sw.js`'s fetch handler is gated to `https://mcross2298.github.io`, so it is inert on localhost. What is verified: the SW registers, activates, precaches 131 entries, the strategy logic passes three committed suites in isolation, and a set logged with the network down persists. What is not: a real offline reload, offline cold launch, the update banner against a real new SW, reconnect/sync. |
| **Row-level security, live** | `tests/test_rls.py` needs `SUPABASE_DB_URL`, which this session does not have. Substituted with read-only evidence: **all 16 public tables have RLS enabled**, and the security advisor reports **no missing-policy findings** — one WARN only, leaked-password protection disabled ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). The 7 cross-user attacks themselves were not re-run. |
| **Two-device sync reconciliation** | Needs two signed-in physical devices. `test-mc-sync-runtime` and `test-mc-sync-merge` cover the merge logic; actual Supabase reconciliation is unproven. Same residual `B5` already records. |
| **Real-device QA** | iOS Safari, Android Chrome, installed PWA. Safe-area handling is covered by *source* gates (`check-topbar-inset`) and a replayed 59 px inset, which is not a real notch. |
| **Signed-in features** | Coach Note, Coach suggestions, AI exercise suggestions, cloud PR pushes, PM mode. Invite-only auth; not exercised. |
| **Food search / barcode / natural-language entry** | Needs the live food API. The *calculator* behind the rings is now fully covered; the lookup path is not. |
| **Biometric protection** | Device-bound; not testable headlessly. |
| **Both visual ratchets** | The CA-trust issue in `GO_LIVE/regression.md`. Enforcing runs from CI are trustworthy; re-baselining from a session is not. |

## Corrections to the existing record

- **`user_programs` exists.** The `D0–D3` note in CLAUDE.md states "there are no
  `user_programs`/`program_days` tables". `user_programs` is present with 1 row. `program_days` is
  not. The design decision it describes is unaffected; the factual claim is wrong.
- **The font constraint is a CA-trust failure, not a network block** — see `GO_LIVE/regression.md`.
  This matters because it is fixable, and four phases have been blocked on it.
- **`daily_health` 0 rows** and **`push_subscriptions` 0 rows** corroborate two existing residuals
  (`upsert-health` has no client caller; notifications have never delivered).
