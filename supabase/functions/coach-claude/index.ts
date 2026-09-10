// ===========================================================================
// coach-claude — the coaching note on the dashboard
// ---------------------------------------------------------------------------
// engine-repair-roadmap.md Phase 1.2, audit EN-3.
//
// What was wrong. The client has posted to /functions/v1/coach-claude since
// the coaching card shipped, and nothing was ever deployed at that slug: the
// function NAMED coach-claude sits at the slug `hyper-function`, carrying the
// unmodified starter template (identical bundle hash to the push one). The
// card has therefore read "Coach unavailable right now" for its whole life.
//
//   POST /functions/v1/coach-claude
//   Header: Authorization: Bearer <user access token>
//   -> { summary, flags[], volumeWarnings[], swaps[] }   (dashboard.html's
//                                                         renderCoachReport)
//
// DESIGN NOTE, and it is deliberate. The audit's own finding is that a
// thirty-day read of workout_logs cannot group by muscle or by program,
// because every row's muscle and program_id are null (Phase 1.4 fixes the
// writer). Beyond that, this repo already records a council principle that
// scheduling and recap composition are deterministic-logic territory, not an
// LLM's job — see weekly-checkin's own header.
//
// So the structure here is computed from the log in code: plateaus, drops,
// and per-exercise frequency are arithmetic, and arithmetic does not
// hallucinate. The model is used for ONE thing, the prose summary, and when
// ANTHROPIC_API_KEY is absent the function returns a templated summary from
// the same numbers instead of failing. That means the card works today,
// without a key, and reads better once a key is set.
//
// Secrets:
//   ANTHROPIC_API_KEY                        (optional — see above)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected on deploy)
// ===========================================================================
import Anthropic from "npm:@anthropic-ai/sdk@0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const LOOKBACK_DAYS = 30;
const PLATEAU_SESSIONS = 3;   // sessions at the same top weight before it is worth saying

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

interface LogRow {
  exercise: string;
  muscle: string | null;
  weight_lbs: number | null;
  reps: number | null;
  logged_at: string;
}
interface Flag { exercise: string; message: string; severity: "warn" | "info" }
interface VolumeWarning { muscle: string; message: string }
interface Swap { exercise: string; suggestion: string; reason: string }

/** Top weight per exercise per day, oldest first. */
function byExerciseByDay(rows: LogRow[]) {
  const out = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const w = Number(r.weight_lbs);
    if (!isFinite(w) || w <= 0) continue;
    const name = String(r.exercise || "").trim();
    if (!name) continue;
    const day = String(r.logged_at || "").slice(0, 10);
    if (!day) continue;
    const days = out.get(name) ?? new Map<string, number>();
    days.set(day, Math.max(days.get(day) ?? 0, w));
    out.set(name, days);
  }
  return out;
}

function buildFlags(rows: LogRow[]): Flag[] {
  const flags: Flag[] = [];
  for (const [exercise, days] of byExerciseByDay(rows)) {
    const series = [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map((e) => e[1]);
    if (series.length < PLATEAU_SESSIONS) continue;
    const tail = series.slice(-PLATEAU_SESSIONS);
    const first = tail[0], last = tail[tail.length - 1];
    if (tail.every((w) => w === first)) {
      flags.push({
        exercise,
        message: `same top set (${first} lb) ${tail.length} sessions running`,
        severity: "warn",
      });
    } else if (last < first) {
      flags.push({
        exercise,
        message: `top set down ${first - last} lb over ${tail.length} sessions`,
        severity: "warn",
      });
    } else if (last > first) {
      flags.push({ exercise, message: `up ${last - first} lb over ${tail.length} sessions`, severity: "info" });
    }
  }
  // Warnings first, then the strongest signal; a chip row is not a report.
  flags.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1));
  return flags.slice(0, 6);
}

function buildVolumeWarnings(rows: LogRow[]): VolumeWarning[] {
  // Every row's muscle column is null until Phase 1.4 lands, so this returns
  // nothing rather than inventing a taxonomy in a second place. The dashboard
  // omits the section when the array is empty; that is honest, and it starts
  // working on its own the moment the writer fills the column.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const m = (r.muscle || "").trim();
    if (!m) continue;
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  if (counts.size < 2) return [];
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0], bottom = sorted[sorted.length - 1];
  if (top[1] < bottom[1] * 3) return [];
  return [{
    muscle: bottom[0],
    message: `${bottom[1]} sets in ${LOOKBACK_DAYS} days against ${top[1]} for ${top[0]}`,
  }];
}

function buildSwaps(rows: LogRow[], flags: Flag[]): Swap[] {
  // Only ever suggested for a lift that is actually stalled, and only as a
  // variation of the same movement — this function has no catalog, so it must
  // not invent an exercise name out of nothing.
  return flags
    .filter((f) => f.severity === "warn" && /same top set/.test(f.message))
    .slice(0, 2)
    .map((f) => ({
      exercise: f.exercise,
      suggestion: "a rep-range change",
      reason: "load has not moved for three sessions; change the stimulus before the load",
    }));
}

function templateSummary(sessions: number, sets: number, flags: Flag[]): string {
  if (!sets) return "No sets logged in the last month. Open a workout and log a set to start the record.";
  const stalled = flags.filter((f) => f.severity === "warn").length;
  const parts = [
    `${sets} set${sets === 1 ? "" : "s"} across ${sessions} session${sessions === 1 ? "" : "s"} in the last ${LOOKBACK_DAYS} days`,
  ];
  if (stalled) parts.push(`${stalled} lift${stalled === 1 ? "" : "s"} worth a second look`);
  else parts.push("nothing stalled");
  return parts.join(" · ") + ".";
}

async function modelSummary(sessions: number, sets: number, flags: Flag[]): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const facts = [
      `${sets} sets across ${sessions} sessions in the last ${LOOKBACK_DAYS} days.`,
      ...flags.map((f) => `${f.exercise}: ${f.message}`),
    ].join("\n");
    const res = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      system:
        "You write one short paragraph for a lifter's dashboard. Two or three sentences, " +
        "plain and specific, no headings, no lists, no emoji. Use only the numbers given — " +
        "never invent an exercise, a weight or a date. If nothing notable happened, say so.",
      messages: [{ role: "user", content: facts }],
    });
    const text = (res.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.error("coach-claude model call failed", (err as Error)?.message);
    return null;   // the templated summary is a real answer, not an error page
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: userRes, error: userErr } = await sb.auth.getUser(auth.slice(7));
  const user = userRes?.user;
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
  const { data, error } = await sb
    .from("workout_logs")
    .select("exercise, muscle, weight_lbs, reps, logged_at")
    .eq("user_id", user.id)
    .gte("logged_at", since)
    .order("logged_at", { ascending: true });

  if (error) return json({ error: "Could not load history" }, 500);

  const rows = (data || []) as LogRow[];
  const sessions = new Set(rows.map((r) => String(r.logged_at || "").slice(0, 10))).size;
  const flags = buildFlags(rows);
  const volumeWarnings = buildVolumeWarnings(rows);
  const swaps = buildSwaps(rows, flags);
  const summary = (await modelSummary(sessions, rows.length, flags))
    ?? templateSummary(sessions, rows.length, flags);

  return json({ summary, flags, volumeWarnings, swaps });
});
