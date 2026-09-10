// ===========================================================================
// coach-claude — AI coaching report generator (Supabase Edge Function)
// ---------------------------------------------------------------------------
// Reads the authenticated user's last 30 days of workout_logs and asks Claude
// for a structured coaching report (short summary + per-lift flags + volume
// warnings + exercise swap ideas) instead of a prose paragraph, so the
// frontend can render actionable chips. The Anthropic API key never touches
// the browser — it lives only in this server-side function.
//
//   POST /functions/v1/coach-claude
//   Authorization: Bearer <user-access-token>
//   -> { summary: string, flags: [...], volumeWarnings: [...], swaps: [...] }
//
// Secrets (set with `supabase secrets set`):
//   ANTHROPIC_API_KEY              (from console.anthropic.com)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected on deploy)
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Empty report shape — every response (including early-exit fallbacks) uses
// this so the frontend never has to special-case a missing field.
function emptyReport(summary: string) {
  return { summary, flags: [], volumeWarnings: [], swaps: [] };
}

const REPORT_TOOL = {
  name: "coaching_report",
  description: "Structured coaching report derived from the trainee's recent workout log.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "One-sentence headline observation about the training pattern. Plain text, no markdown.",
      },
      flags: {
        type: "array",
        description: "Per-lift observations worth calling out (plateau, stalled progress, notable PR). Omit if none.",
        items: {
          type: "object",
          properties: {
            exercise: { type: "string" },
            severity: { type: "string", enum: ["info", "warn"] },
            message: { type: "string", description: "Short, specific, under 15 words." },
          },
          required: ["exercise", "severity", "message"],
        },
      },
      volumeWarnings: {
        type: "array",
        description: "Muscle groups that look under- or over-trained relative to the rest of the log. Omit if balanced.",
        items: {
          type: "object",
          properties: {
            muscle: { type: "string" },
            message: { type: "string", description: "Short, specific, under 15 words." },
          },
          required: ["muscle", "message"],
        },
      },
      swaps: {
        type: "array",
        description: "Optional exercise swap ideas grounded in what's actually in the log — do not invent exercises.",
        items: {
          type: "object",
          properties: {
            exercise: { type: "string", description: "An exercise name that appears in the trainee's log." },
            suggestion: { type: "string" },
            reason: { type: "string", description: "Short, under 15 words." },
          },
          required: ["exercise", "suggestion", "reason"],
        },
      },
    },
    required: ["summary", "flags", "volumeWarnings", "swaps"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  // Verify token and get user identity
  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json({ error: "Invalid token" }, 401);

  // Query last 30 days of workout logs (RLS enforced via user_id filter)
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: logs, error: logsErr } = await sb
    .from("workout_logs")
    .select("exercise, muscle, weight_lbs, reps, logged_at, workout_name")
    .eq("user_id", user.id)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false })
    .limit(300);

  if (logsErr || !logs || logs.length === 0) {
    return json(emptyReport(
      "Keep showing up — every session counts. Log a few workouts and I'll have personalized insights for you next time."
    ));
  }

  // Summarize volume by muscle and top exercises
  const muscleCounts: Record<string, number> = {};
  const exerciseSeen = new Set<string>();
  const recentExercises: string[] = [];
  const sessionDates = new Set<string>();

  for (const row of logs) {
    const m = row.muscle || "Other";
    muscleCounts[m] = (muscleCounts[m] || 0) + 1;
    if (!exerciseSeen.has(row.exercise)) {
      exerciseSeen.add(row.exercise);
      recentExercises.push(row.exercise);
    }
    if (row.logged_at) sessionDates.add(row.logged_at.slice(0, 10));
  }

  const topMuscles = Object.entries(muscleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([m, c]) => `${m} (${c} sets)`)
    .join(", ");

  const topExercises = recentExercises.slice(0, 8).join(", ");
  const totalSets = logs.length;
  const trainingDays = sessionDates.size;

  const userMessage =
    `Training data — last 30 days:\n` +
    `• Sessions: ${trainingDays} days\n` +
    `• Total sets logged: ${totalSets}\n` +
    `• Volume by muscle: ${topMuscles}\n` +
    `• Recent exercises: ${topExercises}\n\n` +
    `Call the coaching_report tool with your analysis. Be specific about what you actually see in the data — ` +
    `flags and swaps must reference exercises from the list above, never invented ones. Leave flags/volumeWarnings/` +
    `swaps as empty arrays when there's nothing worth flagging; don't manufacture filler.`;

  if (!ANTHROPIC_KEY) return json({ error: "AI not configured" }, 503);

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: "You are a knowledgeable, encouraging strength coach reviewing a client's workout log. Be direct, specific, and practical.",
      messages: [{ role: "user", content: userMessage }],
      tools: [REPORT_TOOL],
      tool_choice: { type: "tool", name: "coaching_report" },
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("Anthropic error", anthropicRes.status, errText);
    return json({ error: "AI unavailable" }, 502);
  }

  const result = await anthropicRes.json();
  const toolUse = (result?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  const input = toolUse?.input;

  if (!input || typeof input.summary !== "string") {
    console.error("Unexpected coaching_report shape", JSON.stringify(result));
    return json(emptyReport("Coach unavailable right now — check back later."));
  }

  return json({
    summary: input.summary,
    flags: Array.isArray(input.flags) ? input.flags : [],
    volumeWarnings: Array.isArray(input.volumeWarnings) ? input.volumeWarnings : [],
    swaps: Array.isArray(input.swaps) ? input.swaps : [],
  });
});
