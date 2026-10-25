#!/usr/bin/env node
/* tools/test-field-reports-sync.js — field triage (field-feedback-roadmap.md FB2)

   Runs the real tools/field-reports-sync.js against a fake GitHub API and a
   fake field-reports function, and holds it to:
     * REDACTION — an issue never carries a report's message or a user id,
       even if the function were to send one by mistake;
     * no @mention or broken code fence from device text;
     * one issue per report and per new crash type; a known crash type gets a
       comment, and a resolved one that recurs is reopened;
     * what was filed is reported back, so nothing is filed twice;
     * closed / not planned / reopened map to fixed / wontfix / reopen, and a
       non-triage issue is ignored. */
'use strict';
const S = require('./field-reports-sync.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('FAIL ' + m); } }

function fakeWorld(pendingPayload) {
  const calls = { gh: [], fn: [] };
  let next = 100;
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (/functions\/v1\/field-reports/.test(url)) {
      calls.fn.push({ body, secret: init.headers['x-cron-secret'] });
      const data = body.action === 'pending' ? pendingPayload : { ok: true, reports: 1 };
      return { status: 200, text: async () => JSON.stringify(data) };
    }
    const path = url.replace('https://api.github.com/repos/o/r', '');
    calls.gh.push({ method: init.method, path, body, auth: init.headers.Authorization });
    if (path === '/labels') return { status: 422, text: async () => '{}' };
    if (init.method === 'POST' && path === '/issues') return { status: 201, text: async () => JSON.stringify({ number: next++ }) };
    if (/\/comments$/.test(path)) return { status: 201, text: async () => '{}' };
    return { status: 200, text: async () => '{}' };
  };
  return { calls, fetchImpl };
}
const env = { FIELD_SECRET: 's3cret', GITHUB_TOKEN: 'ghs_x', GITHUB_REPOSITORY: 'o/r' };

(async () => {
  // 1. formatting and redaction
  const leaky = { id: 7, category: 'friction', severity: 'blocker', page: 'workout-settings.html',
    workout_page: 'mm-p1.html', program: 'mm', build: 'mc-training-v189', platform: 'ios-pwa',
    error_fps: ['a1b2c3', 'not a fp!'], created_at: '2026-10-25T12:00:00Z',
    message: 'SECRET athlete words', user_id: 'uuid-123' };
  const body = S.reportBody(leaky), title = S.reportTitle(leaky);
  ok(!/SECRET athlete words/.test(body + title), 'a report message never reaches the issue');
  ok(!/uuid-123/.test(body + title), 'a user id never reaches the issue');
  ok(/client_reports/.test(body) && /id = 7/.test(body), 'the issue says where the description lives');
  ok(/<!-- field-report:7 -->/.test(body), 'report marker present');
  ok(/`a1b2c3`/.test(body) && !/not a fp/.test(body), 'only well-formed fingerprints are listed');
  ok(title === 'Report #7: Hard to use · Stopped me · mm-p1.html', 'report title, got ' + title);
  ok(JSON.stringify(S.reportLabels(leaky)) === JSON.stringify(['field-report', 'category:friction', 'severity:blocker']), 'report labels');
  ok(JSON.stringify(S.reportLabels({ category: 'x', severity: 'y' })) === '["field-report"]', 'unknown enums add no label');

  const err = { fingerprint: 'ff00', kind: 'error', message: 'ping @mcross2298 | x\nnext', stack: 'at a\n```\nat b',
    source: 'mc-setlog.js', line: 42, count: 5, devices: 2, pages: ['mm-p1.html'], platforms: ['ios-pwa'],
    first_seen: 'a', last_seen: 'b', issue_number: null, reported_count: 0 };
  const eb = S.errorBody(err), et = S.errorTitle(err);
  ok(!/@mcross2298/.test(eb + et), 'device text cannot @mention an account');
  ok((eb.match(/```/g) || []).length === 2, 'a stack cannot close the code fence early');
  ok(!/\| x\nnext/.test(eb), 'a message cannot break its table row');
  ok(/<!-- field-error:ff00 -->/.test(eb), 'crash marker present');
  ok(/mc-setlog\.js:42/.test(et), 'crash title names the file and line');
  ok(/3 more occurrences \(5 in total, on 2 devices\)/.test(S.errorUpdate({ ...err, reported_count: 2 })), 'update counts only what is new');
  ok(/Seen again after this was closed/.test(S.errorUpdate({ ...err, resolved: true })), 'a recurrence says so');

  // 2. a sync run
  const world = fakeWorld({
    reports: [leaky],
    errors: [err, { ...err, fingerprint: 'ee11', issue_number: 50, reported_count: 3 },
             { ...err, fingerprint: 'dd22', issue_number: 60, reported_count: 1, resolved: true }]
  });
  const r = await S.runSync(env, world.fetchImpl, () => {});
  ok(r.reports === 1 && r.errors === 3, 'filed 1 report and 3 crash types, got ' + JSON.stringify(r));
  const created = world.calls.gh.filter((c) => c.method === 'POST' && c.path === '/issues');
  ok(created.length === 2, 'two new issues (one report, one new crash type), got ' + created.length);
  ok(created.every((c) => !/SECRET athlete words|uuid-123/.test(JSON.stringify(c.body))), 'no new issue carries the message or the user id');
  ok(world.calls.gh.some((c) => c.path === '/issues/50/comments'), 'known crash type gets a comment');
  ok(world.calls.gh.some((c) => c.method === 'PATCH' && c.path === '/issues/60' && c.body.state === 'open'), 'a resolved crash type that recurs is reopened');
  ok(world.calls.fn.some((c) => c.body.action === 'status' && c.body.issue === 60 && c.body.status === 'filed'), 'and the database is told it reopened');
  const filedCall = world.calls.fn.find((c) => c.body.action === 'filed');
  ok(filedCall && filedCall.body.reports[0].id === 7 && filedCall.body.reports[0].issue === 100, 'report filing reported back');
  ok(filedCall && filedCall.body.errors.length === 3 && filedCall.body.errors.every((e) => e.count === 5), 'crash counts reported back');
  ok(world.calls.fn.every((c) => c.secret === 's3cret'), 'every function call carries the secret');
  ok(world.calls.gh.every((c) => c.auth === 'Bearer ghs_x'), 'every GitHub call carries the token');

  const quiet = fakeWorld({ reports: [], errors: [] });
  await S.runSync(env, quiet.fetchImpl, () => {});
  ok(quiet.calls.gh.length === 0 && quiet.calls.fn.length === 1, 'nothing pending touches nothing on GitHub');

  // 3. issue events
  ok(S.outcomeFor('closed', 'completed') === 'fixed', 'closed -> fixed');
  ok(S.outcomeFor('closed', 'not_planned') === 'wontfix', 'not planned -> wontfix');
  ok(S.outcomeFor('reopened', null) === 'reopen', 'reopened -> reopen');
  ok(S.outcomeFor('edited', null) === null, 'other actions ignored');
  const ev = fakeWorld({});
  const out = await S.runIssueEvent(env, { action: 'closed', issue: { number: 100, state: 'closed', state_reason: 'completed', labels: [{ name: 'field-report' }] } }, ev.fetchImpl, () => {});
  ok(out === 'fixed' && ev.calls.fn[0].body.issue === 100 && ev.calls.fn[0].body.action === 'status' && ev.calls.fn[0].body.status === 'fixed', 'a closed triage issue sets its reports fixed');
  const ev2 = fakeWorld({});
  const out2 = await S.runIssueEvent(env, { action: 'closed', issue: { number: 5, labels: [{ name: 'bug' }] } }, ev2.fetchImpl, () => {});
  ok(out2 === null && ev2.calls.fn.length === 0, 'a non-triage issue is ignored');

  // 4. FB5 — labels and PRs drive status
  const L = (...n) => n.map((name) => ({ name }));
  ok(S.statusFor({ state: 'open', labels: L('field-report') }) === 'filed', 'open, no status label -> filed');
  ok(S.statusFor({ state: 'open', labels: L('field-report', 'in-progress') }) === 'fixing', 'in-progress -> fixing');
  ok(S.statusFor({ state: 'open', labels: L('field-error', 'needs-decision') }) === 'needs_decision', 'needs-decision -> needs_decision');
  ok(S.statusFor({ state: 'open', labels: L('field-report', 'needs-decision', 'in-progress') }) === 'fixing', 'in-progress outranks needs-decision');
  ok(S.statusFor({ state: 'closed', state_reason: 'completed', labels: L('field-report', 'in-progress') }) === 'fixed', 'closed outranks labels');
  ok(S.statusFor({ state: 'closed', state_reason: 'not_planned', labels: L('field-report') }) === 'wontfix', 'not planned -> wontfix');
  for (const [action, labels, want] of [['labeled', L('field-report', 'in-progress'), 'fixing'], ['unlabeled', L('field-report'), 'filed'], ['reopened', L('field-report', 'needs-decision'), 'needs_decision']]) {
    const w = fakeWorld({});
    const r = await S.runIssueEvent(env, { action, issue: { number: 9, state: 'open', labels } }, w.fetchImpl, () => {});
    ok(r === want && w.calls.fn[0].body.status === want, action + ' -> ' + want + ', got ' + r);
  }
  const wEdit = fakeWorld({});
  ok((await S.runIssueEvent(env, { action: 'edited', issue: { number: 9, state: 'open', labels: L('field-report') } }, wEdit.fetchImpl, () => {})) === null && wEdit.calls.fn.length === 0, 'an edit changes nothing');

  ok(JSON.stringify(S.closingRefs('Fixes #12, closes #3 and resolves: #4. Refs #9. Fixes #12')) === '[12,3,4]', 'closing keywords found once each, plain refs ignored');
  ok(S.closingRefs('fixed #7').length === 1 && S.closingRefs('prefix#7').length === 0, 'keyword needed before the number');

  // a PR that fixes a triage issue labels it and sets fixing; a non-triage or closed issue is left alone
  function prWorld(issues) {
    const calls = { gh: [], fn: [] };
    const fetchImpl = async (url, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      if (/functions\/v1/.test(url)) { calls.fn.push(body); return { status: 200, text: async () => '{"reports":1}' }; }
      const path = url.replace('https://api.github.com/repos/o/r', '');
      calls.gh.push({ method: init.method, path, body });
      const m = path.match(/^\/issues\/(\d+)$/);
      if (init.method === 'GET' && m) { const i = issues[m[1]]; return { status: i ? 200 : 404, text: async () => JSON.stringify(i || {}) }; }
      if (path === '/labels') return { status: 422, text: async () => '{}' };
      return { status: 200, text: async () => '{}' };
    };
    return { calls, fetchImpl };
  }
  const pw = prWorld({
    5: { number: 5, state: 'open', labels: L('field-report') },
    6: { number: 6, state: 'open', labels: L('bug') },
    7: { number: 7, state: 'closed', labels: L('field-error') },
    8: { number: 8, state: 'open', labels: L('field-error', 'in-progress') }
  });
  const moved = await S.runPullRequestEvent(env, { action: 'opened', pull_request: { number: 50, title: 'Fix timer', body: 'Fixes #5\nFixes #6\nCloses #7\nResolves #8\nFixes #99' } }, pw.fetchImpl, () => {});
  ok(JSON.stringify(moved) === '[5,8]', 'only open triage issues move to in progress, got ' + JSON.stringify(moved));
  ok(pw.calls.gh.some((c) => c.method === 'POST' && c.path === '/issues/5/labels' && c.body.labels[0] === 'in-progress'), 'the in-progress label is added');
  ok(!pw.calls.gh.some((c) => c.path === '/issues/8/labels'), 'an issue already in progress is not relabelled');
  ok(pw.calls.fn.filter((b) => b.action === 'status' && b.status === 'fixing').map((b) => b.issue).join() === '5,8', 'the database is told both');
  const pw2 = prWorld({});
  ok((await S.runPullRequestEvent(env, { action: 'closed', pull_request: { number: 51, body: 'Fixes #5' } }, pw2.fetchImpl, () => {})).length === 0 && pw2.calls.gh.length === 0, 'a closed PR is not an in-progress signal');
  ok(S.LABELS['in-progress'] && S.LABELS['needs-decision'], 'both status labels are created');

  // 5. FB7 — the Project board
  ok(!S.makeBoard({ GITHUB_REPOSITORY: 'o/r' }, null, () => {}).enabled, 'no token or number: the board is off');
  ok(!S.makeBoard({ GITHUB_REPOSITORY: 'o/r', FIELD_PROJECT_TOKEN: 't', FIELD_PROJECT_NUMBER: 'x' }, null, () => {}).enabled, 'a bad number: the board is off');
  function boardWorld(opts) {
    opts = opts || {};
    const q = [];
    const fetchImpl = async (url, init) => {
      const body = JSON.parse(init.body);
      q.push({ url, body, auth: init.headers.Authorization });
      if (opts.fail) return { status: 401, text: async () => '{"message":"Bad credentials"}' };
      if (/projectV2\(number/.test(body.query)) return { status: 200, text: async () => JSON.stringify({ data: { user: { projectV2: { id: 'P1', field: { id: 'F1',
        options: [{ id: 'o-new', name: 'New' }, { id: 'o-prog', name: 'In progress' }, { id: 'o-dec', name: 'Needs decision' }, { id: 'o-fix', name: 'Fixed' }] } } } } }) };
      if (/addProjectV2ItemById/.test(body.query)) return { status: 200, text: async () => JSON.stringify({ data: { addProjectV2ItemById: { item: { id: 'I-' + body.variables.c } } } }) };
      return { status: 200, text: async () => '{"data":{}}' };
    };
    return { q, fetchImpl };
  }
  const benv = { GITHUB_REPOSITORY: 'o/r', FIELD_PROJECT_TOKEN: 'pat', FIELD_PROJECT_NUMBER: '3' };
  const bw = boardWorld();
  const board = S.makeBoard(benv, bw.fetchImpl, () => {});
  ok(board.enabled, 'token + number: the board is on');
  ok(await board.sync('ISSUE_1', 'needs_decision'), 'sync succeeds');
  const setq = bw.q.find((c) => /updateProjectV2ItemFieldValue/.test(c.body.query));
  ok(setq && setq.body.variables.o === 'o-dec' && setq.body.variables.i === 'I-ISSUE_1' && setq.body.variables.f === 'F1', 'needs_decision lands in the Needs decision column');
  ok(bw.q[0].body.variables.login === 'o' && bw.q[0].body.variables.n === 3, 'the board is looked up by owner and number');
  ok(bw.q.every((c) => c.auth === 'Bearer pat'), 'the board uses its own token, not GITHUB_TOKEN');
  await board.sync('ISSUE_2', 'fixed');
  ok(bw.q.filter((c) => /projectV2\(number/.test(c.body.query)).length === 1, 'board metadata is read once per run');
  const logs = [];
  ok((await board.sync('ISSUE_3', 'wontfix')) === false, "a missing Won't fix column is a warning, not a crash");
  const failw = boardWorld({ fail: true });
  const failLogs = [];
  ok((await S.makeBoard(benv, failw.fetchImpl, (m) => failLogs.push(m)).sync('X', 'filed')) === false && /warning/.test(failLogs.join()), 'a bad token warns and never throws');
  ok(S.BOARD_OPTION.filed === 'New' && S.BOARD_OPTION.fixing === 'In progress', 'status -> column names');

  // the board is updated on an issue event when enabled
  const ew = boardWorld();
  const evFetch = async (url, init) => /graphql/.test(url) ? ew.fetchImpl(url, init) : { status: 200, text: async () => '{"reports":1}' };
  await S.runIssueEvent(benv, { action: 'labeled', issue: { number: 4, node_id: 'N4', state: 'open', labels: L('field-report', 'in-progress') } }, evFetch, () => {});
  const ev4 = ew.q.find((c) => /updateProjectV2ItemFieldValue/.test(c.body.query));
  ok(ev4 && ev4.body.variables.o === 'o-prog', 'labelling in-progress moves the card to In progress');

  console.log((fail ? 'FAIL' : 'ok') + ' test-field-reports-sync: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
