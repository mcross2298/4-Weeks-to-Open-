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

## FB5–FB7 — the history, and an "in progress" that means something (opened 2026-10-25)

The loop test passed end to end (report #1 → issue #377 → closed → Fixed on the
phone). Two gaps the owner named next: **a historical log** with open / in
progress / closed, fed automatically, and a clear path for a real problem that
needs a code or design change. Decisions (`AskUserQuestion`, 2026-10-25):
**both** an in-app admin page and a GitHub Project board; **labels drive
status**.

| Phase | Objective | Files |
|---|---|---|
| FB5 | Labels drive status. `in-progress` (or a PR whose body says `Fixes #N`) → `fixing`, so the athlete sees **Being fixed**; `needs-decision` (added by the weekly review when it asks a question) → `needs_decision`; removing them, or reopening, goes back to `filed`. One new Edge Function action (`status`) replaces the closed-only `resolve`, which stays as an alias. `client_error_issues` gains the same status, so crash types read the same way. | `supabase/phase17-field-status.sql`, `supabase/functions/field-reports/`, `tools/field-reports-sync.js`, `.github/workflows/field-reports.yml`, `mc-report.js` |
| FB6 | **Field log** (`field-log.html`), admins only (`MC_SB.isOwner()`): every report and crash type, newest first, with status filters (All / Open / In progress / Needs decision / Closed), the athlete's own words (admins can read them under the phase-15 policy), a link to the GitHub issue, and counts. Read-only: status is changed by labels on GitHub, one source of truth. Reached from Diagnostics, shown only to an admin. | `field-log.html`, `mc-account.js`, `sw.js` |
| FB7 | **GitHub Project board.** Every triage issue is added to a user-level Project with a Status of New / In progress / Needs decision / Fixed / Won't fix, kept in step by the same workflow. Needs a fine-grained personal access token (Projects read/write) stored as a repo secret, because `GITHUB_TOKEN` cannot write to a user-level board. Redacted like the issues. | `.github/workflows/field-reports.yml`, `tools/field-reports-sync.js` |

**FB5 + FB6 shipped (2026-10-25).** Owner action: run
`supabase/phase17-field-status.sql`, after which the updated `field-reports`
Edge Function is deployed (it writes the new status column, so it must not
go out first).

**FB7 shipped (2026-10-25), off until the owner sets it up.** The same
workflow keeps a user-level Project board in step (`makeBoard()` in
`tools/field-reports-sync.js`): a new issue lands in **New**, and labels,
PRs and closing move it. It needs:
1. A Project (Settings → Projects → New project, Board layout) whose **Status**
   field has the options **New, In progress, Needs decision, Fixed, Won't fix**
   (names matched case-insensitively; a missing option is a warning, not a
   failure).
2. A token that can write to it, stored as the repo secret
   **`FIELD_PROJECT_TOKEN`**: a classic token with the `project` scope, or a
   fine-grained token with Projects read/write on the account.
3. Nothing else, if the board is titled **Field log**: with no number set, the
   workflow finds the owner's project by that title (case-insensitive). The
   number is hard to find in the GitHub app, which is why the title is the
   default. A board with another name: set the repo variable
   **`FIELD_PROJECT_TITLE`**, or its number (the `/projects/N` in its web URL)
   as **`FIELD_PROJECT_NUMBER`**, which wins when both are set.
Without the token it does nothing; a bad token or a missing board warns and
never fails the job.

FB5 and FB6 ship together; FB7 opens with its own `AskUserQuestion` gate, since
it needs a token the owner has to create.

### What happens to a real problem

1. A report or a new crash type becomes a redacted issue within the hour.
2. The weekly review (or **Run now**) reads the full report from Supabase and
   reproduces it. A plain code bug becomes a **draft PR** that says `Fixes #N`,
   which moves the issue to **In progress**. Anything that needs a product or
   design call gets **one question** on the issue and the `needs-decision` label.
3. The owner answers on the issue, or opens a session with "work on #N". A
   design change follows `CLAUDE.md`'s planning rule (a short roadmap or
   mockup first, an `AskUserQuestion` between phases).
4. Merging the PR closes the issue; the report becomes **Fixed** and the athlete
   sees it after the next deploy.

## Owner actions

- ~~Run `phase15` and `phase16`.~~ Applied 2026-10-25, read back from `pg_catalog`.
- ~~Set the `CRON_SECRET` / `WEEKLY_CHECKIN_SECRET` pair.~~ Set 2026-10-25; the
  first manual `field-reports.yml` run reached the function and found nothing new.
- Add the **Supabase** connector to the "Weekly field review" scheduled task in
  claude.ai, so it can read report descriptions.
