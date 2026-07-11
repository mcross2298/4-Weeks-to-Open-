// ===========================================================================
// coach-substitute — LLM exercise-substitution fallback (Supabase Edge Function)
// ---------------------------------------------------------------------------
// mc-biomech.js's alternatives() is a strict deterministic matcher (same
// movement pattern + muscle, then same muscle any pattern). For thin muscle
// groups it can return fewer than 3 results. This function is the fallback:
// it is handed the source exercise plus a client-computed, catalog-grounded
// candidate pool (mc-biomech.js's fallbackCandidates()) and asked to PICK
// indices into that pool — it is never allowed to invent an exercise name
// that isn't already in the caller's own catalog. The Anthropic API key
// never touches the browser — it lives only in this server-side function.
//
//   POST /functions/v1/coach-substitute
//   Authorization: Bearer <user-access-token>
//   Body: { name, muscle, pattern, equipment, need, candidates: [{name,
//           equipment, pattern, muscle}, ...] }
//   -> { picks: number[] }   (indices into the request's candidates array)
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

interface Candidate {
  name: string;
  equipment?: string;
  pattern?: string;
  muscle?: string;
}

const MAX_CANDIDATES = 200;
const MAX_NEED = 5;

const PICK_TOOL = {
  name: "pick_substitutes",
  description: "Pick the best exercise substitutes from the numbered candidate list.",
  input_schema: {
    type: "object",
    properties: {
      picks: {
        type: "array",
        description: "Indices into the candidate list, best match first. Empty array if nothing plausible.",
        items: { type: "integer" },
      },
    },
    required: ["picks"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json({ error: "Invalid token" }, 401);

  let body: {
    name?: string; muscle?: string; pattern?: string; equipment?: string;
    need?: number; candidates?: Candidate[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const name = String(body.name || "").trim();
  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, MAX_CANDIDATES) : [];
  const need = Math.min(Math.max(1, Number(body.need) || 3), MAX_NEED);

  if (!name || candidates.length === 0) {
    return json({ picks: [] });
  }

  if (!ANTHROPIC_KEY) return json({ error: "AI not configured" }, 503);

  const list = candidates
    .map((c, i) => `${i}: ${c.name}${c.equipment ? ` (${c.equipment}${c.muscle ? `, ${c.muscle}` : ""})` : ""}`)
    .join("\n");

  const userMessage =
    `A trainee wants a substitute for "${name}"` +
    `${body.muscle ? ` (target muscle: ${body.muscle}` : ""}${body.pattern ? `, movement pattern: ${body.pattern}` : ""}${body.muscle ? ")" : ""}. ` +
    `The strict same-muscle catalog matches were already exhausted, so pick from this broader candidate list ` +
    `the ${need} that would make the most gym-plausible substitutes despite not matching muscle/pattern exactly ` +
    `(similar plane of movement, adjacent muscle group, or comparable training stimulus). ` +
    `Only use candidates from the numbered list below — never suggest anything not listed.\n\n${list}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "You are a knowledgeable strength coach picking gym-plausible exercise substitutes from a fixed candidate list.",
      messages: [{ role: "user", content: userMessage }],
      tools: [PICK_TOOL],
      tool_choice: { type: "tool", name: "pick_substitutes" },
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("Anthropic error", anthropicRes.status, errText);
    return json({ error: "AI unavailable" }, 502);
  }

  const result = await anthropicRes.json();
  const toolUse = (result?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  const rawPicks = toolUse?.input?.picks;

  if (!Array.isArray(rawPicks)) {
    console.error("Unexpected pick_substitutes shape", JSON.stringify(result));
    return json({ picks: [] });
  }

  // Validate: integers, in range, deduped, capped — the only place a
  // malformed or out-of-range model response could otherwise leak through.
  const seen = new Set<number>();
  const picks: number[] = [];
  for (const p of rawPicks) {
    const i = Number(p);
    if (!Number.isInteger(i) || i < 0 || i >= candidates.length || seen.has(i)) continue;
    seen.add(i);
    picks.push(i);
    if (picks.length >= need) break;
  }

  return json({ picks });
});
