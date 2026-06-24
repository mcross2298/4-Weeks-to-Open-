// ===========================================================================
// food — master food database aggregator (Supabase Edge Function)
// ---------------------------------------------------------------------------
// One endpoint for the cookbook + workout app to search foods and look up
// barcodes against an OWNED, growing library, sourced from:
//   • USDA FoodData Central (public domain)  — authoritative whole + branded
//   • Open Food Facts (ODbL — attribute)     — global barcodes
// (Nutritionix is intentionally NOT used here — its terms forbid caching.)
//
// Flow: read our `foods` table first → fan out live to USDA + OFF on demand →
// normalize to one shape → dedupe by barcode → cache permissible hits so the
// library grows around what users actually eat.
//
//   GET  ?q=<text>       -> { items: [...] }     (search)
//   GET  ?barcode=<gtin> -> { item: {...}|null } (lookup)
//
// Secrets (set with `supabase secrets set`):
//   USDA_API_KEY                 (free: https://fdc.nal.usda.gov/api-key-signup)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected on deploy)
//
// Normalized item shape (matches the clients' existing expectation):
//   { code, name, brand, basis:'serving'|'100g', servingLabel, kcal,p,f,c, source }
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const USDA_KEY = Deno.env.get("USDA_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const n = (v: unknown) => { const x = parseFloat(String(v)); return isFinite(x) ? x : 0; };
const r0 = (v: number) => Math.round(v);

type Item = {
  code: string; name: string; brand: string;
  basis: "serving" | "100g"; servingLabel: string;
  kcal: number; p: number; f: number; c: number;
  source: "usda" | "off"; sid: string; // sid = source id (fdcId / OFF code) for caching
};

// ---- row <-> item -----------------------------------------------------------
function rowToItem(r: any): Item {
  return {
    code: r.barcode || "", name: r.name, brand: r.brand || "",
    basis: r.basis || "100g", servingLabel: r.serving_label || (r.basis === "serving" ? "serving" : "100 g"),
    kcal: r0(n(r.kcal)), p: r0(n(r.protein_g)), f: r0(n(r.fat_g)), c: r0(n(r.carbs_g)),
    source: r.source, sid: r.source_id || "",
  };
}
function itemToRow(it: Item) {
  return {
    barcode: it.code || null, name: it.name, brand: it.brand || null,
    source: it.source, source_id: it.sid || null, basis: it.basis, serving_label: it.servingLabel,
    kcal: it.kcal, protein_g: it.p, fat_g: it.f, carbs_g: it.c, updated_at: new Date().toISOString(),
  };
}

// ---- Open Food Facts --------------------------------------------------------
function offNormalize(prod: any): Item | null {
  if (!prod) return null;
  const nu = prod.nutriments || {};
  const name = (prod.product_name || "").trim();
  if (!name) return null;
  const hasServing = !!prod.serving_size && (nu["energy-kcal_serving"] != null || nu.proteins_serving != null);
  const it: Item = {
    code: prod.code || "", name,
    brand: ((prod.brands || "").split(",")[0] || "").trim(),
    basis: hasServing ? "serving" : "100g",
    servingLabel: hasServing ? String(prod.serving_size) : "100 g",
    kcal: r0(n(hasServing ? nu["energy-kcal_serving"] : nu["energy-kcal_100g"])),
    p: r0(n(hasServing ? nu.proteins_serving : nu.proteins_100g)),
    f: r0(n(hasServing ? nu.fat_serving : nu.fat_100g)),
    c: r0(n(hasServing ? nu.carbohydrates_serving : nu.carbohydrates_100g)),
    source: "off", sid: prod.code || "",
  };
  if (!it.kcal && !it.p && !it.f && !it.c) return null;
  return it;
}
async function offSearch(q: string): Promise<Item[]> {
  const url = "https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=12"
    + "&fields=code,product_name,brands,nutriments,serving_size&search_terms=" + encodeURIComponent(q);
  const res = await fetch(url); if (!res.ok) return [];
  const data = await res.json();
  return (data.products || []).map(offNormalize).filter(Boolean) as Item[];
}
async function offLookup(code: string): Promise<Item | null> {
  const url = "https://world.openfoodfacts.org/api/v2/product/" + encodeURIComponent(code)
    + ".json?fields=code,product_name,brands,nutriments,serving_size";
  const res = await fetch(url); if (!res.ok) return null;
  const data = await res.json();
  return data && data.product ? offNormalize(data.product) : null;
}

// ---- USDA FoodData Central (per-100g) ---------------------------------------
function usdaNum(food: any, num: string): number {
  for (const fn of (food.foodNutrients || [])) {
    const id = String(fn.nutrientNumber ?? (fn.nutrient && fn.nutrient.number) ?? "");
    if (id === num) return n(fn.value ?? fn.amount);
  }
  return 0;
}
function usdaNormalize(food: any): Item | null {
  const name = (food.description || "").trim();
  if (!name) return null;
  const it: Item = {
    code: food.gtinUpc || "", name,
    brand: (food.brandName || food.brandOwner || "").trim(),
    basis: "100g", servingLabel: "100 g",
    kcal: r0(usdaNum(food, "208")), p: r0(usdaNum(food, "203")),
    f: r0(usdaNum(food, "204")), c: r0(usdaNum(food, "205")),
    source: "usda", sid: String(food.fdcId || ""),
  };
  if (!it.kcal && !it.p && !it.f && !it.c) return null;
  return it;
}
async function usdaSearch(q: string): Promise<Item[]> {
  if (!USDA_KEY) return [];
  const res = await fetch("https://api.nal.usda.gov/fdc/v1/foods/search?api_key=" + USDA_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, pageSize: 10, dataType: ["Foundation", "SR Legacy", "Branded"] }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.foods || []).map(usdaNormalize).filter(Boolean) as Item[];
}

// ---- dedupe + cache ---------------------------------------------------------
// Collapse by barcode (else name|brand); USDA wins ties (more authoritative).
function dedupe(items: Item[]): Item[] {
  const order = ["usda", "off"];
  const map = new Map<string, Item>();
  for (const it of items) {
    const key = it.code ? "b:" + it.code : "n:" + (it.name + "|" + it.brand).toLowerCase();
    const cur = map.get(key);
    if (!cur || order.indexOf(it.source) < order.indexOf(cur.source)) map.set(key, it);
  }
  return [...map.values()];
}
// Best-effort cache; never let a write failure break the response.
async function cache(items: Item[]) {
  try {
    const rows = items.map(itemToRow);
    const barcoded = rows.filter((r) => r.barcode);
    if (barcoded.length) await db.from("foods").upsert(barcoded, { onConflict: "barcode" });
    for (const row of rows.filter((r) => !r.barcode && r.source_id)) {
      const { data } = await db.from("foods").select("id")
        .eq("source", row.source).eq("source_id", row.source_id).maybeSingle();
      if (!data) await db.from("foods").insert(row);
    }
  } catch (_) { /* swallow */ }
}

// ---- handlers ---------------------------------------------------------------
async function handleSearch(q: string): Promise<Item[]> {
  const fromDb: Item[] = [];
  try {
    const { data } = await db.from("foods").select("*").textSearch("search", q, { type: "websearch" }).limit(20);
    (data || []).forEach((r) => fromDb.push(rowToItem(r)));
  } catch (_) { /* ignore */ }
  if (fromDb.length < 8) {
    try {
      const { data } = await db.from("foods").select("*").ilike("name", "%" + q + "%").limit(20);
      (data || []).forEach((r) => fromDb.push(rowToItem(r)));
    } catch (_) { /* ignore */ }
  }

  const [off, usda] = await Promise.all([offSearch(q).catch(() => []), usdaSearch(q).catch(() => [])]);
  const live = [...usda, ...off];
  if (live.length) await cache(live);

  return dedupe([...fromDb, ...live]).slice(0, 20);
}

async function handleLookup(code: string): Promise<Item | null> {
  try {
    const { data } = await db.from("foods").select("*").eq("barcode", code).maybeSingle();
    if (data) return rowToItem(data);
  } catch (_) { /* ignore */ }
  const [off, usda] = await Promise.all([offLookup(code).catch(() => null), usdaSearch(code).catch(() => [])]);
  const usdaHit = (usda as Item[]).find((x) => x.code === code) || null;
  const best = usdaHit || off;
  if (best) await cache([best]);
  return best;
}

// ---- entry ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const barcode = (url.searchParams.get("barcode") || "").replace(/\D/g, "");
    const q = (url.searchParams.get("q") || "").trim();
    if (barcode) return json({ item: await handleLookup(barcode) });
    if (q.length >= 2) return json({ items: await handleSearch(q) });
    return json({ items: [] });
  } catch (e) {
    return json({ error: String((e as Error).message || e), items: [] }, 200);
  }
});
