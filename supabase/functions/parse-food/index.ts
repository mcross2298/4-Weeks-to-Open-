// ===========================================================================
// parse-food — natural-language food logging parser (Supabase Edge Function)
// ---------------------------------------------------------------------------
// Roadmap 4.2. Turns free text ("two eggs and a slice of toast with butter")
// into structured search queries the client can feed straight into the
// EXISTING food search pipeline (mc-foodapi.js -> the `food` aggregator ->
// USDA/Open Food Facts). The model's job stops at parsing language into
// {query, qty, unit} — it never supplies nutrition numbers itself, so macro
// data always stays grounded in the real food database, never invented.
//
// No authentication beyond the Supabase anon apikey (matches the `food`
// function's precedent) — parsing free text touches no private user data,
// and the nutrition tracker is deliberately usable signed-out. Input length
// and item count are capped to bound cost and abuse given there's no
// per-user session to rate-limit against.
//
//   POST /functions/v1/parse-food
//   Body: { text: "two eggs and a slice of toast with butter" }
//   -> { items: [{ query, qty, unit }, ...] }
//
// Secrets (set with `supabase secrets set`):
//   ANTHROPIC_API_KEY   (from console.anthropic.com)
// ===========================================================================
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_TEXT_LEN = 300;
const MAX_ITEMS = 8;

const PARSE_TOOL = {
  name: "parsed_foods",
  description: "The individual foods mentioned in the trainee's description, as search-ready queries.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One entry per distinct food/drink mentioned. Empty array if nothing food-related was said.",
        items: {
          type: "object",
          properties: {
            query: { type: "string", description: "A short, generic search term for a food database — e.g. 'large egg', not '2 eggs'." },
            qty: { type: "number", description: "How many of that item, as a plain number (e.g. 2, 0.5, 1)." },
            unit: { type: "string", description: "Short display label for the quantity, e.g. 'egg', 'slice', 'cup', 'oz'." },
          },
          required: ["query", "qty", "unit"],
        },
      },
    },
    required: ["items"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const text = String(body.text || "").trim().slice(0, MAX_TEXT_LEN);
  if (!text) return json({ items: [] });

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
      max_tokens: 400,
      system: "You extract individual foods from a casual description of a meal so they can be looked up in a food database. " +
        "You never estimate or state calories/macros yourself — only what was eaten and how much.",
      messages: [{ role: "user", content: `Call the parsed_foods tool for: "${text}"` }],
      tools: [PARSE_TOOL],
      tool_choice: { type: "tool", name: "parsed_foods" },
    }),
  });

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    console.error("Anthropic error", anthropicRes.status, errText);
    return json({ error: "AI unavailable" }, 502);
  }

  const result = await anthropicRes.json();
  const toolUse = (result?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  const rawItems = toolUse?.input?.items;

  if (!Array.isArray(rawItems)) {
    console.error("Unexpected parsed_foods shape", JSON.stringify(result));
    return json({ items: [] });
  }

  const items = rawItems
    .filter((it) => it && typeof it.query === "string" && it.query.trim())
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      query: String(it.query).trim().slice(0, 80),
      qty: Number.isFinite(Number(it.qty)) && Number(it.qty) > 0 ? Number(it.qty) : 1,
      unit: String(it.unit || "serving").trim().slice(0, 30),
    }));

  return json({ items });
});
