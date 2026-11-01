# CI agents — playbook

The standing rules for the scheduled Claude agents that look for continuous
improvement on MC Training. Every agent reads this file, then
`DECISIONS.md`, before doing anything else. This file and `DECISIONS.md` win
over the scheduled-task prompt where they disagree; `CLAUDE.md` wins over
both.

Change the rules by editing this file in a PR, not by editing the prompts.

## The pipeline

One weekly cycle, in this order. Each agent reads what the one before it
produced, so the owner decides once a week with everything in front of them.

| Stage | Agent | When (America/New_York) | Reads first | Produces | Notifies owner |
|---|---|---|---|---|---|
| Act | **Builder** | Monday 7:43 pm | Open `ci-approved` issues with no PR; approved "continue to phase N?" issues | Up to 2 draft PRs implementing approved work (large initiatives one phase at a time) + a "CI Builder" artifact | Push |
| Check + identify | **Live QA** | Wednesday 8:23 pm | PRs merged to `main` in the last 8 days; `live-qa` issues | Verification of last week's merges; draft fix PRs; `needs-decision` issues; a "Live QA" artifact with unconfirmed suspicions | Push |
| Propose | **Scout** | Thursday 8:41 pm | The newest "Live QA" artifact; `live-qa`, `field-*` issues; draft PRs | Up to 5 `ci-idea` issues + a "CI Scout" artifact | No |
| Qualify | **Critic** | Friday 8:13 pm | Unscored `ci-idea` issues; overlap with field and live-qa issues and open PRs | A score comment per idea; the decision-log PR | No |
| Change | **Field review** | Saturday 2:37 pm | `field-*` issues; `ci-idea` scores; open PRs | Draft fix PRs, or deferral to the `ci-idea` that fixes the root cause; `needs-decision` issues | Default |
| Decide | **Digest** | Sunday 8:17 pm | Everything above | One "Weekly Decisions" artifact; refreshes the pinned Agent Control page | Yes — one push |

The owner decides Sunday night, the builder turns approvals into draft PRs on
Monday, and the owner merges early in the week. The next Wednesday's Live QA
is the check on what was merged.

Always-on inputs run outside the cycle: `.github/workflows/field-reports.yml`
(hourly) files field issues and `.github/workflows/live-qa.yml` (nightly)
files `live-qa` issues.

**Hand-off rules.**
- A defect already covered by an open PR or a `ci-idea` is linked, never
  fixed twice.
- An idea that is the root-cause fix for several field or live-qa issues
  holds those issues. The field review defers them to the idea until the
  owner approves it, then may implement the idea itself.

**Starting work.** The builder acts only on `ci-approved`. To start an
initiative of your own, open an issue describing it and add `ci-approved`
yourself; it enters the same queue, ahead of agent ideas. A large or
multi-phase initiative is built one phase per week: the builder ships phase 1,
opens a `needs-decision` issue "Continue <initiative> to phase 2?", and builds
the next phase the Monday after the owner approves (CLAUDE.md's between-phase
check-in).

## Hard rules (every agent)

1. **Never merge, never push to `main`, never push to `MC-Training-Rolodex`,
   never close an issue, never remove an owner's label.** Branches are
   `claude/ci-<agent>-<short-name>`; PRs are drafts.
2. **The repository is public.** No athlete or owner data in anything written
   to GitHub: no emails, names, user ids, free-text report wording, weights,
   body or health numbers, or screenshots that show real logged data.
   Aggregates are fine ("27 of 120 logged sessions in the last 30 days were
   abandoned before Finish"). Screenshots are taken on a fresh profile with no
   sign-in, or with seeded demo data only.
3. **No licensed brand terms** in issues, PRs or code you add — the list is
   `content-manifest.json` → `brand_terms`. Refer to licensed programs by
   their file name if you must.
4. **Read-only on Supabase** (project `dhlxmoyjfxohbeiexwnr`): `select` only,
   aggregate queries only, never return or store row-level user data. No
   migrations, no Edge Function deploys.
5. **Blocked rule:** try 2–3 reasonable approaches, then stop and say what
   broke, what you tried and what is needed. Never present a guess as a
   finding.
6. **Target honesty:** if the live site is unreachable and you test a local
   `main` instead, say so at the top of every output.

## Evidence rule

Every idea names its evidence source and the number it is based on:

| Source | How to read it |
|---|---|
| Field reports / crash types | Open GitHub issues labelled `field-report`, `field-error` |
| Usage | Aggregate `select count(*) … group by …` on `public.workout_logs`, `public.client_errors`, `public.client_reports` |
| Live behaviour | Playwright at 390×844 and 320×568, touch emulation, console errors |
| Performance | `node tools/measure-session.js`, `tools/perf-budgets.json`, `tools/measure-first-visit.js` |
| Design standards | The workout UI standards (48 px targets, safe areas, WCAG AA contrast); `tools/check-contrast.js`, `tools/check-design-tokens.js` |
| Repo history | `git log` on the area — churn and repeat fixes are a signal |
| Outside reference | Web search for how comparable apps solve the same problem — cite the URL; never copy content |

An idea with no measurable evidence is still allowed, but it gets the
`hypothesis` label and must include **how to measure it** (what to log, for
how long, what result would confirm it).

## Lenses

The scout rotates its primary lens weekly and records which one it used in
its artifact, so coverage is even:

1. **Friction** — taps, steps, dead ends, confusing states during a workout.
2. **Reliability** — errors, sync failures, data loss risk, offline gaps.
3. **Performance** — first visit, session cost, bundle size, battery.
4. **Design** — hierarchy, consistency, contrast, gym-use readability.
5. **Feature** — new capability backed by usage or a field report.

## Idea issue format (scout)

Title: `CI idea: <outcome, not solution>` — e.g. "CI idea: fewer taps to log a
drop set". Labels: `ci-idea`, one `lens:*`, plus `hypothesis` when it applies.

Body sections, in order:

- **Problem** — what happens now, for whom, how often (with the number).
- **Evidence** — sources and numbers; links to issues, runs, or URLs.
- **Proposal** — the smallest change that tests the idea.
- **Before / after** — link to the scout artifact card (screenshots live in
  the private artifact, not on GitHub).
- **Success measure** — the metric, the target, and when to check it.
- **Risks / open questions** — including anything that needs an owner call.

Before filing, search open *and closed* `ci-idea` issues and `DECISIONS.md`
for the same idea. A rejected idea is not re-filed unless there is new
evidence; if so, link the old issue and state what changed.

## Scoring (critic)

The critic never sees how an idea was produced and scores only what the issue
says. Each factor is 1–5:

- **Impact** — how much it improves a real session for the athlete.
- **Confidence** — strength of the evidence (a `hypothesis` is capped at 2).
- **Ease** — 5 = a one-file change with an existing test to extend; 1 = new
  schema, new page, or a multi-phase change.

**Score = Impact × Confidence × Ease** (1–125).

- **≥ 45** → label `ci-scored`, recommend for the digest.
- **20–44** → label `ci-scored`, keep in backlog.
- **< 20**, duplicate, conflicts with `DECISIONS.md`, or needs licensed
  content → label `ci-scored` and comment a recommendation to close with the
  reason. The owner closes; agents never do.

The score comment starts with the marker line `<!-- ci-score -->` and shows
the three factors, the product, and one sentence of reasoning per factor.
An issue whose latest comment carries that marker is skipped unless something
newer was added.

## Decisions

- **Approve:** owner adds `ci-approved` (optionally with a comment on scope).
- **Reject:** owner closes the issue as *not planned* with a one-line reason.
- **Defer:** owner comments; the idea stays open.

The critic keeps one rolling draft PR, branch `claude/ci-decision-log`, that
appends each newly decided idea to `DECISIONS.md` (date, issue, decision,
owner's reason in the owner's own words — owner text is not athlete data).
Until that PR merges, agents also read the decisions directly from the
issues, so an unmerged log never causes a re-pitch.

## Reports (every agent that publishes one)

Use `report-template.html` in this folder. Load the `artifact-design` skill
before writing the page, then fill the template — keep its structure so every
report reads the same way. Publish it as a **private** artifact titled
`<Agent> — <YYYY-MM-DD>`.

- Screenshots: JPEG, 390 px wide, quality ~70, embedded as data URIs. Keep the
  page under 8 MB. "Before" = `main`; "after" = the branch or a local
  prototype that is **not pushed**. Label which.
- Sections in order: decisions needed, before/after cards, gate and audit
  results with exact pass/fail counts, error log summary, what could not be
  done and why. Omit a section that would be empty.
- Never paste raw user data into a report; aggregates only.
