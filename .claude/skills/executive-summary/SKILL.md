---
name: executive-summary
description: >
  Generate a Word-document-style executive summary of any planned code change or
  improvement and obtain explicit user approval before implementing. Use this skill
  at the start of every non-trivial implementation task — feature additions,
  refactors, bug fixes that touch multiple files, dashboard/conditioning changes,
  exercise-data updates, deploy-script changes, and Supabase schema migrations.
---

# Executive Summary Skill

Before writing a single line of code, produce a structured executive summary for the user to review and approve. Only proceed after receiving explicit approval.

---

## Workflow

### 1. Research the task

Use Glob, Grep, and Read to understand:
- Which files will be touched and why
- What existing patterns you must follow (check CLAUDE.md first)
- Any constraints or risks (Supabase migration, deploy pipeline, MARKET:STRIP markers, downstream Rolodex impact, etc.)

### 2. Draft the executive summary

Render it using the exact template below. Keep each section tight — one to three sentences or a short bullet list. This is a summary, not a design doc.

---

## Executive Summary Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 EXECUTIVE SUMMARY — [TASK TITLE IN CAPS]
 Project : 4 Weeks to Open / MC Training Rolodex
 Date    : [today's date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OBJECTIVE
[One sentence: what problem does this solve or what value does it deliver?]

SCOPE OF CHANGES
Files affected:
  • [file path] — [what changes and why]
  • [file path] — [what changes and why]
  (list every file; mark NEW if creating, DEL if removing)

IMPLEMENTATION APPROACH
[Two to four bullet points describing HOW you will implement it —
data structure changes, rendering logic, Supabase queries, deploy-script impact, etc.]

DEPLOY PIPELINE NOTES  (omit if no deploy-script or Rolodex impact)
[Note any MARKET:STRIP marker additions/removals, downstream Rolodex changes,
or deploy-script (1-infra, 2-programs, 3-mc, 4-pmc, 5-rest) updates needed.]

RISKS & MITIGATIONS
  • [Risk] → [Mitigation]
  • [Risk] → [Mitigation]
  (include Supabase migration safety, JS syntax gate, duplicate exercise dedup, etc. as relevant)

ESTIMATED EFFORT
  Complexity : Low | Medium | High
  Files      : N files changed
  Key concern: [the one thing most likely to go wrong]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ACTION REQUIRED
 Reply "approved" or "go" to proceed.
 Reply with feedback to revise the plan before any code is written.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Wait for approval

**Do not write, edit, or create any file until the user explicitly approves.**

- If the user replies with revisions, update the summary and re-present it.
- If the user approves, thank them briefly and begin implementation.
- If the task turns out to be simpler than expected mid-implementation (single-line fix, obvious typo), you may note that in the summary and ask if a full plan is still needed.

### 4. Implement

Follow the approved plan exactly. If you discover a material deviation is needed, pause, note the change, and confirm before continuing.

---

## Scope guidance

**Always generate a summary for:**
- Dashboard feature additions or layout changes (`dashboard.html`, `conditioning-data.js`, `mc-pm-inline.js`, `mc-layout.js`)
- Exercise data changes that affect `exercisedata.json` structure (not just adding a single entry)
- Supabase schema migrations or RLS policy changes
- Deploy-script modifications (`1-infra-deploy.py` through `5-rest-deploy.py`)
- New HTML pages or program files (`*.html` workout pages)
- Changes that touch `MARKET:STRIP` markers (affects downstream Rolodex build)
- `base.css` or design-token changes

**Summary optional (use judgement) for:**
- Adding a single exercise entry to `exercisedata.json`
- Pure copy/wording fixes in one file
- Trivial CSS colour or spacing tweaks in isolation

---

## Example invocation

User: "Add a rest-day banner to the conditioning tab"

You: [research dashboard.html, conditioning-data.js, mc-pm-inline.js, base.css] → render executive summary → wait for "approved" → implement.
