# GO LIVE multi-app run — 2026-09-17 — residual risk

## Blockers (owner action)

- **`DEF-08`** — the weekly check-in has never worked. 10/10 scheduled runs failed, 2026-07-12 to
  2026-09-13, every one in 5-8 seconds at the workflow's own `WEEKLY_CHECKIN_SECRET` guard.
  Set the repository secret and the matching Supabase `CRON_SECRET`, prove one run — or remove the
  claim from the specification.
- **`DEF-CB-01` / `DEF-CB-02`** — 18 cookbook records contradict themselves. The correct values are
  an authoring decision; update the two named allowlists in `tools/validate-recipes.js` once decided.

## Accepted risks

- The portable half of `DEF-FIN-01` is unported. `household-finance` (`main` @ `c7ca218`) carries the
  identical unguarded `data.rules` iteration and the identical `if (v < 3)` gating. Recorded in that
  repo's sync manifest as needing a port; not fixed here because it was outside this session's scope.
- Seven of the ten cookbook scaling anomalies are 6-8x overshoots that may be deliberate re-authoring.

## Known limitations — not measured

Real-device QA (iOS Safari, Android Chrome, installed PWA); true multi-device sync reconciliation;
offline reload; live RLS; the cookbook smoke test; Cooking Mode's step-by-step UI and the weekly
planner's three generator modes (driven only at the store/API layer); font-dependent visual and
contrast ratchets (`fonts.googleapis.com` is reachable by `curl` but blocked to headless Chromium
here — re-derived this run rather than cited).


---

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
| The 🧩 cluster breakdown needs a reload to take effect | DEF-12 — mid-session: attribute stamped, store written, **0 bubbles**; after reload: 5 bubble rows seeded correctly | Nothing is lost and the feature works from the next load. The fix needs new rebuild/repaint plumbing across `mc-setlog.js` and `mc-session.js` — the two modules that own set persistence — so getting it wrong loses a logged set mid-workout, which is worse than the bug. |
| Three Nutrition entry controls at 38px | DEF-13 — `.ntx-ico` at both 390 and 320 | Now ratcheted so it cannot shrink further, carries correct `aria-label`s, and the resize belongs with `W-I2`'s design-reviewed pass. |
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
| **Row-level security, live** | **CLOSED in Phase 2.** `tests/test_rls.py` still needs `SUPABASE_DB_URL`, so the attacks were run directly against the project instead — 12 of them, simulating each actor with `set local role` + `request.jwt.claims`, reads in a `read only` transaction and writes rolled back. **All 12 blocked**; database verified untouched afterwards. One WARN remains from the advisor: leaked-password protection disabled ([remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). |
| **Two-device sync reconciliation** | Needs two signed-in physical devices. `test-mc-sync-runtime` and `test-mc-sync-merge` cover the merge logic; actual Supabase reconciliation is unproven. Same residual `B5` already records. |
| **Real-device QA** | iOS Safari, Android Chrome, installed PWA. Safe-area handling is covered by *source* gates (`check-topbar-inset`) and a replayed 59 px inset, which is not a real notch. |
| **Signed-in features** | Still the largest unknown. Phase 2 drove the **signed-OUT** path — the Coach Note card degrades to a sensible empty state and throws nothing — and proved the data layer holds under 12 cross-user attacks. What remains unexercised is the signed-in CONTENT: Coach Note's generated read, coach suggestions, AI exercise suggestions, cloud PR pushes, PM-mode publishing and a real two-device sync. All need a real session in a browser, which needs an invite. |
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
