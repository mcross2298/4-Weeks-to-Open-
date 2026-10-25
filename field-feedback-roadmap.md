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

## Shipped

- **FB1 (2026-10-25)** — Report a problem sheet, outbox, `phase15` SQL, 34-check gate.
- **FB2 (2026-10-25)** — `field-reports` Edge Function (deployed), `field-reports.yml`,
  `tools/field-reports-sync.js`, `phase16` SQL, 32-check gate including a planted
  redaction leak. Issue closed/reopened → report status already wired (FB4's server half).
- **FB3 (2026-10-25)** — scheduled task **"Weekly field review"**, Sundays 7:42pm
  America/New_York (8pm, moved 18 minutes earlier so it doesn't land on the hour),
  each run a fresh session. It files anything new, reviews up to 5 open triage
  issues (blockers first), reads each description from Supabase, reproduces,
  opens **draft** PRs that say `Fixes #N`, or comments one question. It marks
  what it handled with `<!-- field-review -->` so the next run skips it until
  something new arrives. It never quotes an athlete on GitHub.

- **FB4 (2026-10-25)** — Diagnostics → **Your reports** (Waiting to send / Sent /
  Being looked at / Fixed / Won't fix), and a one-time **Fixed** note on Home
  ("the fix arrives with the next app update" — the issue closes at merge, and the
  deploy follows about 20 minutes later). 45-check gate.

## Running it on demand

Owner decision: weekly, **plus a way to pull reports and errors at any time.**
- **File what's new right now:** GitHub → Actions → **Field reports → issues**
  → Run workflow. New reports and crash types become issues within a minute.
- **Run the full review right now:** claude.ai → scheduled tasks → **Weekly
  field review** → Run now, or ask any session to fire it.
- **Read the raw reports:** Supabase → Table Editor → `client_reports` /
  `client_errors` (admins only).

## Owner actions

- Run `supabase/phase15-client-reports.sql` (FB1), then `supabase/phase16-field-triage.sql` (FB2).
- FB2 reuses the `CRON_SECRET` / `WEEKLY_CHECKIN_SECRET` pair; if it is not
  set yet, set it (see `.github/workflows/weekly-checkin.yml`'s header).
