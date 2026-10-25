# Field feedback loop — report, triage, fix, close (`FB1`–`FB4`)

Opened 2026-10-25. Scratch-listed in `content-manifest.json`, so it never ships
to the public Rolodex build.

## Why

Phase E / S5 made errors leave the device: the head boot logs them in
`mc_errors_v1`, and `mc-error-beacon.js` copies them to `public.client_errors`
when the athlete opts in. That is capture only. Nothing tells anyone a report
arrived, an athlete cannot describe friction ("the timer didn't beep"), and
nothing moves a report toward a fix. This roadmap closes the loop:

```
athlete / owner ── Report a problem ──┐
head boot (crashes, opt-in) ──────────┤
                                      ▼
                  Supabase: client_reports, client_errors
                                      │  hourly workflow (CRON_SECRET)
                                      ▼
                  GitHub Issues — REDACTED: type, severity, page, build,
                  fingerprint, report number. Never the athlete's words.
                                      │  scheduled Claude session (weekly)
                                      ▼
                  reads full text from Supabase, reproduces, draft fix PR
                                      │  PR merged → issue closed → workflow
                                      ▼
                  client_reports.status = fixed → athlete sees "Fixed"
```

## Decisions locked with the owner (`AskUserQuestion`, 2026-10-25)

1. **Reporters:** athletes **and** the owner. Automatic crash capture stays
   (opt-in, default off); the Report form is an explicit act, so it sends
   without the telemetry switch.
2. **Triage:** GitHub Issues in `4-Weeks-to-Open-`.
3. **Redacted issues.** The repository is **public**, so its issues are too.
   An issue carries only what a fix needs — category, severity, page, build,
   platform, crash fingerprint/stack, and a report number. The athlete's
   words and identity stay in Supabase, readable by admins only.
4. **Fixing:** a scheduled Claude session reviews new issues, reproduces what
   it can, and opens **draft** PRs. Nothing merges without the owner.
5. **Close the loop:** when a report is fixed, the reporter sees it in the app.

## Phases

| Phase | Objective | Files |
|---|---|---|
| FB1 | Capture: `client_reports` table + RLS; **Report a problem** sheet (category, severity, description) reachable from the account sheet and Workout Settings; page / workout page / program / build / platform / last error fingerprints attached automatically; offline or signed-out reports queue on the device and send later | `supabase/phase15-client-reports.sql`, `mc-report.js`, `mc-account.js`, `workout-settings.html`, `dashboard.html`, `store-registry.json`, tour |
| FB2 | Triage: `field-reports` Edge Function (CRON_SECRET, service role) hands the workflow redacted pending reports and new crash fingerprints, and records issue numbers; `field-reports.yml` (hourly + manual) files issues with `GITHUB_TOKEN`, one issue per crash fingerprint, one per report, labelled | `supabase/functions/field-reports/`, `.github/workflows/field-reports.yml` |
| FB3 | Fix: a scheduled Claude session (weekly) reads open `field-report` / `field-error` issues, pulls full text from Supabase, reproduces, opens draft PRs that say `Fixes #N` | scheduled task (no repo code) |
| FB4 | Close: `issues: closed` → the workflow marks the report `fixed`; Diagnostics lists "Your reports" with status, and a one-time "Fixed in the latest update" note | `field-reports.yml`, `mc-report.js` |

Each phase after FB1 opens with an `AskUserQuestion` check-in (the
multi-phase rule in `CLAUDE.md`).

## Owner actions

- Run `supabase/phase15-client-reports.sql` (FB1).
- FB2 reuses the `CRON_SECRET` / `WEEKLY_CHECKIN_SECRET` pair; if it is not
  set yet, set it (see `.github/workflows/weekly-checkin.yml`'s header).
