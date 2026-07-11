// ===========================================================================
// weekly-checkin — automated weekly recap push (Supabase Edge Function)
// ---------------------------------------------------------------------------
// Roadmap 4.6. Unlike coach-claude/coach-substitute/push-notify, this
// function is not called by a signed-in trainee's own browser — it runs on a
// schedule (see .github/workflows/weekly-checkin.yml) and fans a push out to
// every subscribed user. There is no per-user bearer token to check, so it's
// gated on a shared secret instead.
//
// Deterministic by design (per the council's LLM-placement principle:
// scheduling and recap composition are deterministic-logic territory, not an
// LLM's job) — a templated recap from real numbers, not a per-user model
// call fired weekly across the whole user base.
//
//   POST /functions/v1/weekly-checkin
//   Header: x-cron-secret: <CRON_SECRET>
//   -> { sent: number, skipped: number, total: number }
//
// Secrets (set with `supabase secrets set`):
//   CRON_SECRET                              (shared secret — generate your own, e.g. `openssl rand -hex 32`)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT   (already set for push-notify)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected on deploy)
// ===========================================================================
import webpush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_SECRET   = Deno.env.get("CRON_SECRET") ?? "";
const VAPID_PUBLIC   = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE  = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT  = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:noreply@example.com";
const SB_URL         = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-cron-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

interface BodyEntry { id?: string; date?: string; w?: number; }
interface MacroFoodEntry { qty?: number; per?: { kcal?: number } }
interface MacroDay { entries?: MacroFoodEntry[]; }
interface MacroStore { goals?: { kcal?: number }; days?: Record<string, MacroDay>; }

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

// Builds the recap text from whatever real data exists — never invents a
// number, and silently omits a clause when that signal has nothing to say.
function buildRecap(trainingDays: number, bodyweightDelta: number | null, macroDaysLogged: number, macroAvgKcal: number | null, macroGoalKcal: number | null): string {
  const clauses: string[] = [];

  clauses.push(trainingDays === 1 ? "1 workout logged this week" : `${trainingDays} workouts logged this week`);

  if (bodyweightDelta !== null && Math.abs(bodyweightDelta) >= 0.1) {
    const dir = bodyweightDelta > 0 ? "up" : "down";
    clauses.push(`bodyweight ${dir} ${Math.abs(bodyweightDelta).toFixed(1)} lb`);
  }

  if (macroDaysLogged > 0) {
    let macroClause = `nutrition logged ${macroDaysLogged}/7 days`;
    if (macroAvgKcal && macroGoalKcal) {
      macroClause += ` (avg ${macroAvgKcal}/${macroGoalKcal} kcal)`;
    }
    clauses.push(macroClause);
  }

  if (trainingDays === 0 && macroDaysLogged === 0) {
    return "Quiet week on the books — no pressure, just a nudge. Open the app when you're ready to pick it back up.";
  }

  return clauses.join(" · ") + ".";
}

async function computeRecap(sb: ReturnType<typeof createClient>, userId: string) {
  const since7 = isoDaysAgo(7);
  const since30 = isoDaysAgo(30);

  const { data: logs } = await sb
    .from("workout_logs")
    .select("logged_at")
    .eq("user_id", userId)
    .gte("logged_at", since7);
  const trainingDays = new Set((logs || []).map((r: { logged_at: string }) => r.logged_at.slice(0, 10))).size;

  const { data: syncRows } = await sb
    .from("user_sync")
    .select("store_key, data")
    .eq("user_id", userId)
    .in("store_key", ["mc_body_v1", "mc_macros_v1"]);

  let bodyweightDelta: number | null = null;
  let macroDaysLogged = 0;
  let macroAvgKcal: number | null = null;
  let macroGoalKcal: number | null = null;

  for (const row of syncRows || []) {
    if (row.store_key === "mc_body_v1" && Array.isArray(row.data)) {
      const recent = (row.data as BodyEntry[])
        .filter((e) => e.date && e.date >= since30.slice(0, 10) && typeof e.w === "number")
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (recent.length >= 2) {
        bodyweightDelta = (recent[recent.length - 1].w as number) - (recent[0].w as number);
      }
    }
    if (row.store_key === "mc_macros_v1" && row.data) {
      const store = row.data as MacroStore;
      macroGoalKcal = store.goals?.kcal ?? null;
      const days = store.days || {};
      const last7Dates = Object.keys(days).filter((d) => d >= since7.slice(0, 10));
      const dayTotals = last7Dates
        .map((d) => (days[d].entries || []).reduce((sum, e) => sum + (e.per?.kcal ?? 0) * (e.qty ?? 1), 0))
        .filter((kcal) => kcal > 0);
      macroDaysLogged = dayTotals.length;
      if (dayTotals.length > 0) {
        macroAvgKcal = Math.round(dayTotals.reduce((a, b) => a + b, 0) / dayTotals.length);
      }
    }
  }

  return { trainingDays, bodyweightDelta, macroDaysLogged, macroAvgKcal, macroGoalKcal };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: "VAPID not configured" }, 503);
  }

  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const { data: subs, error: subsErr } = await sb
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth");

  if (subsErr || !subs) return json({ error: "Could not load subscriptions" }, 500);

  // One recap per user (a user can only have distinct endpoints, but we only
  // need to compute the recap text once per user_id even if they somehow
  // have more than one device subscribed).
  const recapCache = new Map<string, string>();
  let sent = 0, skipped = 0;

  for (const sub of subs) {
    try {
      let body = recapCache.get(sub.user_id);
      if (body === undefined) {
        const r = await computeRecap(sb, sub.user_id);
        body = buildRecap(r.trainingDays, r.bodyweightDelta, r.macroDaysLogged, r.macroAvgKcal, r.macroGoalKcal);
        recapCache.set(sub.user_id, body);
      }

      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: "Your weekly check-in", body, icon: "./icon.svg", badge: "./icon.svg" })
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 410) {
        await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("weekly-checkin send error", sub.user_id, err?.message);
      }
      skipped++;
    }
  }

  return json({ sent, skipped, total: subs.length });
});
