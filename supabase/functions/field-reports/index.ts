// ===========================================================================
// field-reports — the server half of field triage (field-feedback-roadmap.md FB2)
//
// Called only by .github/workflows/field-reports.yml (tools/field-reports-sync.js),
// never by the app. Guarded by the same shared secret as weekly-checkin:
//   Header: x-cron-secret: <CRON_SECRET>      (GitHub secret WEEKLY_CHECKIN_SECRET)
// It reads and writes with the service role, so the GitHub side needs no
// database credentials at all, and GitHub's own token never reaches Supabase.
//
// POST { action: "pending" }
//   -> { reports: [...], errors: [...] }
//   reports: client_reports still 'new', REDACTED — no message, no user id.
//     The repository is public; the athlete's words stay in this database.
//   errors: one entry per client_errors fingerprint that has no issue yet, or
//     has more occurrences than its issue was last told about. `devices` is a
//     count of distinct accounts, never the accounts themselves.
//
// POST { action: "filed", reports: [{id, issue}], errors: [{fingerprint, issue, count, last_seen}] }
//   Records what the workflow filed: a report becomes 'filed' with its issue
//   number; a fingerprint's issue and reported count are upserted.
//
// POST { action: "status", issue, status: filed | fixing | needs_decision | fixed | wontfix }
//   FB5. The workflow derives the status from the issue's state and labels
//   (in-progress, needs-decision) and sends it here. Every report filed under
//   the issue, and the crash type's row, follow. FB4's in-app "Fixed" note and
//   the Field log read client_reports.status.
//
// POST { action: "resolve", issue, outcome: "fixed" | "wontfix" | "reopen" }
//   The FB2 form, kept as an alias of "status".
//
// Deploy with verify_jwt: false — the cron secret is the authentication, as
// for weekly-checkin.
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// The error scan reads at most this many rows, newest first. At today's
// volume that is all of them; past it, move the grouping into SQL.
const ERROR_SCAN_LIMIT = 5000;

interface ErrRow {
  fingerprint: string; kind: string; message: string; stack: string | null;
  source: string | null; line: number | null; page: string | null;
  platform: string | null; user_id: string; occurred_at: string;
}
interface Group {
  fingerprint: string; kind: string; message: string; stack: string | null;
  source: string | null; line: number | null; count: number;
  users: Set<string>; pages: Set<string>; platforms: Set<string>;
  first_seen: string; last_seen: string;
}

async function pending(sb: ReturnType<typeof createClient>) {
  const { data: reps, error: repErr } = await sb
    .from("client_reports")
    .select("id, created_at, category, severity, page, workout_page, program, build, platform, error_fps")
    .eq("status", "new")
    .order("id", { ascending: true })
    .limit(50);
  if (repErr) throw new Error("client_reports: " + repErr.message);

  const { data: errs, error: errErr } = await sb
    .from("client_errors")
    .select("fingerprint, kind, message, stack, source, line, page, platform, user_id, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(ERROR_SCAN_LIMIT);
  if (errErr) throw new Error("client_errors: " + errErr.message);

  const groups = new Map<string, Group>();
  for (const e of (errs || []) as ErrRow[]) {
    let g = groups.get(e.fingerprint);
    if (!g) {
      // rows are newest first, so the first row seen is the latest sample
      g = { fingerprint: e.fingerprint, kind: e.kind, message: e.message, stack: e.stack,
        source: e.source, line: e.line, count: 0, users: new Set(), pages: new Set(),
        platforms: new Set(), first_seen: e.occurred_at, last_seen: e.occurred_at };
      groups.set(e.fingerprint, g);
    }
    g.count++;
    g.users.add(e.user_id);
    if (e.page) g.pages.add(e.page);
    if (e.platform) g.platforms.add(e.platform);
    if (e.occurred_at < g.first_seen) g.first_seen = e.occurred_at;
  }

  const fps = [...groups.keys()];
  const filed = new Map<string, { issue_number: number; reported_count: number; resolved_at: string | null }>();
  if (fps.length) {
    const { data: known, error: kErr } = await sb
      .from("client_error_issues")
      .select("fingerprint, issue_number, reported_count, resolved_at")
      .in("fingerprint", fps);
    if (kErr) throw new Error("client_error_issues: " + kErr.message);
    for (const k of known || []) filed.set(k.fingerprint, k);
  }

  const errors = [];
  for (const g of groups.values()) {
    const k = filed.get(g.fingerprint);
    if (k && g.count <= k.reported_count) continue;
    errors.push({
      fingerprint: g.fingerprint, kind: g.kind, message: g.message, stack: g.stack,
      source: g.source, line: g.line, count: g.count, devices: g.users.size,
      pages: [...g.pages].slice(0, 10), platforms: [...g.platforms].slice(0, 10),
      first_seen: g.first_seen, last_seen: g.last_seen,
      issue_number: k ? k.issue_number : null, reported_count: k ? k.reported_count : 0,
      resolved: !!(k && k.resolved_at),
    });
  }
  return { reports: reps || [], errors };
}

async function filed(sb: ReturnType<typeof createClient>, body: any) {
  let reports = 0, errors = 0;
  for (const r of Array.isArray(body.reports) ? body.reports : []) {
    if (!Number.isInteger(r.id) || !Number.isInteger(r.issue)) continue;
    const { error } = await sb.from("client_reports")
      .update({ status: "filed", issue_number: r.issue })
      .eq("id", r.id).eq("status", "new");
    if (!error) reports++;
  }
  for (const e of Array.isArray(body.errors) ? body.errors : []) {
    if (typeof e.fingerprint !== "string" || !Number.isInteger(e.issue) || !Number.isInteger(e.count)) continue;
    const { error } = await sb.from("client_error_issues").upsert({
      fingerprint: e.fingerprint.slice(0, 64), issue_number: e.issue,
      reported_count: e.count, last_seen: e.last_seen ?? null,
    }, { onConflict: "fingerprint" });
    if (!error) errors++;
  }
  return { reports, errors };
}

// The statuses a triage issue can be in, as both tables store them. A report's
// own 'new' / 'duplicate' are never set from here.
const ISSUE_STATUSES = ["filed", "fixing", "needs_decision", "fixed", "wontfix"];

// POST { action: "status", issue, status } — FB5. Labels on GitHub drive this:
// the workflow works out the status from the issue's state and labels and
// sends it. Every report filed under the issue, and the crash type's row,
// follow. resolved_at is set on the way into fixed / wontfix and cleared on
// the way out, so "when was this closed" stays true through a reopen.
async function setStatus(sb: ReturnType<typeof createClient>, issue: unknown, status: unknown) {
  if (!Number.isInteger(issue)) throw new Error("issue must be an integer");
  if (typeof status !== "string" || !ISSUE_STATUSES.includes(status)) throw new Error("bad status");
  const closed = status === "fixed" || status === "wontfix";
  const resolved_at = closed ? new Date().toISOString() : null;
  const { data: reps, error } = await sb.from("client_reports")
    .update({ status, resolved_at })
    .eq("issue_number", issue)
    .select("id");
  if (error) throw new Error("client_reports: " + error.message);
  const { error: e2 } = await sb.from("client_error_issues")
    .update({ status, resolved_at })
    .eq("issue_number", issue);
  if (e2) throw new Error("client_error_issues: " + e2.message);
  return { reports: (reps || []).length, status };
}

// POST { action: "resolve", issue, outcome } — the FB2 form, kept as an alias.
function resolve(sb: ReturnType<typeof createClient>, body: any) {
  const map: Record<string, string> = { fixed: "fixed", wontfix: "wontfix", reopen: "filed" };
  if (!(body.outcome in map)) throw new Error("bad outcome");
  return setStatus(sb, body.issue, map[body.outcome]);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  try {
    if (body.action === "pending") return json(await pending(sb));
    if (body.action === "filed") return json(await filed(sb, body));
    if (body.action === "resolve") return json(await resolve(sb, body));
    if (body.action === "status") return json(await setStatus(sb, body.issue, body.status));
    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: String((err as Error).message || err).slice(0, 300) }, 500);
  }
});
