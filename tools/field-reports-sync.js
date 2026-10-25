#!/usr/bin/env node
/* tools/field-reports-sync.js — the GitHub half of field triage (field-feedback-roadmap.md FB2)

   Run by .github/workflows/field-reports.yml, hourly and on demand, and again
   whenever a triage issue is closed or reopened.

     scheduled / manual run:
       1. ask the `field-reports` Edge Function what is pending;
       2. open one issue per new report and one per new crash TYPE; comment on
          a crash type's existing issue when it has more occurrences, and
          reopen it if it was closed and came back;
       3. tell the function what was filed, so nothing is filed twice.
     `issues` closed / reopened event (a triage issue only):
       tell the function, so the reporter's app can say "Fixed" (FB4).

   REDACTION. This repository is public, so its issues are too. An issue carries
   what a fix needs (category, severity, page, build, platform, report number,
   crash fingerprint, message and stack) and never the athlete's own words or
   identity: the function does not send either, and nothing here asks for
   them. The scheduled fix session reads the description from Supabase.

   Environment: FIELD_SECRET (the CRON_SECRET value; GitHub secret
   WEEKLY_CHECKIN_SECRET), GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_NAME,
   GITHUB_EVENT_PATH, and optionally FIELD_REPORTS_URL. With no secret it
   warns and exits 0 — an hourly job that failed every hour until a secret is
   set would bury real failures in email. */
'use strict';

const DEFAULT_URL = 'https://dhlxmoyjfxohbeiexwnr.supabase.co/functions/v1/field-reports';

const CATEGORY = { bug: 'Something broke', friction: 'Hard to use', idea: 'Idea' };
const SEVERITY = { blocker: 'Stopped me', annoying: 'Slowed me down', minor: 'Minor' };

const LABELS = {
  'field-report': { color: 'd4af37', description: 'A problem an athlete or the owner reported in the app' },
  'field-error': { color: 'b91c1c', description: 'A crash type the app caught on a device' },
  'category:bug': { color: 'e11d48', description: 'Report: something broke' },
  'category:friction': { color: 'f59e0b', description: 'Report: hard to use' },
  'category:idea': { color: '10b981', description: 'Report: an idea' },
  'severity:blocker': { color: '7f1d1d', description: 'It stopped the athlete' },
  'severity:annoying': { color: 'c2410c', description: 'It slowed the athlete down' },
  'severity:minor': { color: 'a3a3a3', description: 'Minor' }
};

// ---- formatting (pure; tools/test-field-reports-sync.js) ---------------------
// Text that came off a device is quoted, never interpreted: no @mentions
// (GitHub would notify a real account), no closing a code fence early, and a
// table cell cannot break its row.
function safe(s) {
  return String(s == null ? '' : s).replace(/@/g, '@​').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}
function fence(s) {
  return String(s == null ? '' : s).replace(/@/g, '@​').replace(/`{3,}/g, '``​`');
}
function one(s, n) { s = safe(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function reportTitle(r) {
  return 'Report #' + r.id + ': ' + (CATEGORY[r.category] || 'Report') + ' · ' +
    (SEVERITY[r.severity] || r.severity) + ' · ' + one(r.workout_page || r.page || 'unknown page', 60);
}
function reportLabels(r) {
  const out = ['field-report'];
  if (CATEGORY[r.category]) out.push('category:' + r.category);
  if (SEVERITY[r.severity]) out.push('severity:' + r.severity);
  return out;
}
function reportBody(r) {
  const rows = [
    ['Report', '#' + r.id],
    ['Kind', CATEGORY[r.category] || safe(r.category)],
    ['How much it got in the way', SEVERITY[r.severity] || safe(r.severity)],
    ['Reported from', '`' + safe(r.page || '—') + '`'],
    ['Workout page', r.workout_page ? '`' + safe(r.workout_page) + '`' : '—'],
    ['Program', r.program ? '`' + safe(r.program) + '`' : '—'],
    ['Build', r.build ? '`' + safe(r.build) + '`' : '—'],
    ['Platform', r.platform ? '`' + safe(r.platform) + '`' : '—'],
    ['Reported at', safe(r.created_at || '—')]
  ];
  const fps = Array.isArray(r.error_fps) ? r.error_fps.filter((f) => /^[0-9a-f]{1,16}$/.test(f)) : [];
  return [
    '| | |', '|---|---|',
    ...rows.map((x) => '| ' + x[0] + ' | ' + x[1] + ' |'),
    '',
    fps.length
      ? 'Errors this phone logged just before the report (fingerprints; search issues for `field-error:<fp>`): ' + fps.map((f) => '`' + f + '`').join(', ')
      : 'No errors were logged on the phone just before the report.',
    '',
    '> The athlete’s own description is **not** copied here: this repository is public. ' +
      'It is in Supabase, `public.client_reports` where `id = ' + r.id + '`, readable by admins.',
    '',
    '<!-- field-report:' + r.id + ' -->'
  ].join('\n');
}

function errorTitle(e) {
  const where = e.source ? ' · ' + one(e.source, 40) + (e.line ? ':' + e.line : '') : '';
  return 'Crash ' + e.fingerprint + ': ' + one(e.message || 'Unknown error', 80) + where;
}
function errorLabels() { return ['field-error']; }
function errorBody(e) {
  const rows = [
    ['Fingerprint', '`' + safe(e.fingerprint) + '`'],
    ['Kind', '`' + safe(e.kind) + '`'],
    ['Where', e.source ? '`' + safe(e.source) + (e.line ? ':' + e.line : '') + '`' : '—'],
    ['Occurrences', String(e.count)],
    ['Devices (accounts)', String(e.devices)],
    ['Pages', (e.pages || []).map((p) => '`' + safe(p) + '`').join(', ') || '—'],
    ['Platforms', (e.platforms || []).map((p) => '`' + safe(p) + '`').join(', ') || '—'],
    ['First seen', safe(e.first_seen || '—')],
    ['Last seen', safe(e.last_seen || '—')]
  ];
  return [
    '**Message:** `' + safe(e.message || 'Unknown error').replace(/`/g, "'") + '`',
    '',
    '| | |', '|---|---|',
    ...rows.map((x) => '| ' + x[0] + ' | ' + x[1] + ' |'),
    '',
    e.stack ? '```\n' + fence(e.stack) + '\n```' : '_No stack trace was captured._',
    '',
    '> Sent only by athletes who turned on **Send error reports**. Message and stack are as the browser reported them; no account is named.',
    '',
    '<!-- field-error:' + e.fingerprint + ' -->'
  ].join('\n');
}
function errorUpdate(e) {
  const more = e.count - (e.reported_count || 0);
  return (e.resolved ? '**Seen again after this was closed.** ' : '') +
    more + ' more occurrence' + (more === 1 ? '' : 's') + ' (' + e.count + ' in total, on ' + e.devices +
    ' device' + (e.devices === 1 ? '' : 's') + '). Last seen ' + safe(e.last_seen || '—') + '.';
}

// closed + not planned = won't fix; closed otherwise = fixed; reopened = reopen
function outcomeFor(action, stateReason) {
  if (action === 'reopened') return 'reopen';
  if (action === 'closed') return stateReason === 'not_planned' ? 'wontfix' : 'fixed';
  return null;
}
function isTriageIssue(issue) {
  return !!(issue && Array.isArray(issue.labels) &&
    issue.labels.some((l) => (typeof l === 'string' ? l : l && l.name) === 'field-report' ||
                             (typeof l === 'string' ? l : l && l.name) === 'field-error'));
}

// ---- I/O ---------------------------------------------------------------------
function makeClients(env, fetchImpl) {
  const f = fetchImpl || fetch;
  const repo = env.GITHUB_REPOSITORY;
  async function gh(method, path, body) {
    const res = await f('https://api.github.com/repos/' + repo + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
    return { status: res.status, data };
  }
  async function fn(body) {
    const res = await f(env.FIELD_REPORTS_URL || DEFAULT_URL, {
      method: 'POST',
      headers: { 'x-cron-secret': env.FIELD_SECRET, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch (e) {}
    if (res.status !== 200) throw new Error('field-reports ' + body.action + ' -> HTTP ' + res.status + ': ' + text.slice(0, 300));
    return data;
  }
  return { gh, fn };
}

async function ensureLabels(gh) {
  for (const [name, l] of Object.entries(LABELS)) {
    const r = await gh('POST', '/labels', { name, color: l.color, description: l.description });
    if (r.status !== 201 && r.status !== 422) throw new Error('label ' + name + ' -> HTTP ' + r.status);
  }
}

async function runSync(env, fetchImpl, log) {
  log = log || console.log;
  const { gh, fn } = makeClients(env, fetchImpl);
  const p = await fn({ action: 'pending' });
  const reports = (p && p.reports) || [], errors = (p && p.errors) || [];
  if (!reports.length && !errors.length) { log('field-reports: nothing new'); return { reports: 0, errors: 0 }; }
  await ensureLabels(gh);
  const filedReports = [], filedErrors = [];
  for (const r of reports) {
    const res = await gh('POST', '/issues', { title: reportTitle(r), body: reportBody(r), labels: reportLabels(r) });
    if (res.status !== 201) { log('::warning::report ' + r.id + ' -> HTTP ' + res.status); continue; }
    filedReports.push({ id: r.id, issue: res.data.number });
    log('field-reports: report ' + r.id + ' -> #' + res.data.number);
  }
  for (const e of errors) {
    let issue = e.issue_number;
    if (!issue) {
      const res = await gh('POST', '/issues', { title: errorTitle(e), body: errorBody(e), labels: errorLabels(e) });
      if (res.status !== 201) { log('::warning::crash ' + e.fingerprint + ' -> HTTP ' + res.status); continue; }
      issue = res.data.number;
      log('field-reports: crash ' + e.fingerprint + ' -> #' + issue);
    } else {
      const c = await gh('POST', '/issues/' + issue + '/comments', { body: errorUpdate(e) });
      if (c.status !== 201) { log('::warning::comment #' + issue + ' -> HTTP ' + c.status); continue; }
      if (e.resolved) {
        // An issue reopened with GITHUB_TOKEN fires no workflow, so the
        // database is told here rather than by the `issues` event.
        await gh('PATCH', '/issues/' + issue, { state: 'open' });
        await fn({ action: 'resolve', issue, outcome: 'reopen' });
      }
      log('field-reports: crash ' + e.fingerprint + ' -> comment on #' + issue);
    }
    filedErrors.push({ fingerprint: e.fingerprint, issue, count: e.count, last_seen: e.last_seen });
  }
  await fn({ action: 'filed', reports: filedReports, errors: filedErrors });
  return { reports: filedReports.length, errors: filedErrors.length };
}

async function runIssueEvent(env, payload, fetchImpl, log) {
  log = log || console.log;
  const issue = payload && payload.issue;
  if (!isTriageIssue(issue)) { log('field-reports: not a triage issue'); return null; }
  const outcome = outcomeFor(payload.action, issue.state_reason);
  if (!outcome) return null;
  const { fn } = makeClients(env, fetchImpl);
  const r = await fn({ action: 'resolve', issue: issue.number, outcome });
  log('field-reports: #' + issue.number + ' -> ' + outcome + ' (' + ((r && r.reports) || 0) + ' report(s))');
  return outcome;
}

async function main() {
  const env = process.env;
  if (!env.FIELD_SECRET) {
    console.log('::warning::WEEKLY_CHECKIN_SECRET is not set, so field reports cannot be read. See field-feedback-roadmap.md.');
    return;
  }
  if (env.GITHUB_EVENT_NAME === 'issues') {
    const payload = JSON.parse(require('fs').readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
    await runIssueEvent(env, payload);
  } else {
    const r = await runSync(env);
    console.log('field-reports: filed ' + r.reports + ' report(s), ' + r.errors + ' crash type(s)');
  }
}

module.exports = {
  reportTitle, reportBody, reportLabels, errorTitle, errorBody, errorLabels, errorUpdate,
  outcomeFor, isTriageIssue, runSync, runIssueEvent, safe, LABELS
};
if (require.main === module) main().catch((e) => { console.error('::error::' + e.message); process.exit(1); });
