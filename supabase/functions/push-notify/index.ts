// ===========================================================================
// push-notify — Web Push milestone notification sender (Supabase Edge Function)
// ---------------------------------------------------------------------------
// Called by the client after detecting a milestone (new PR, streak).
// Looks up the user's push subscription and sends a Web Push message.
//
//   POST /functions/v1/push-notify
//   Authorization: Bearer <user-access-token>
//   Body: { "title": "...", "body": "..." }
//   -> { sent: true } | { sent: false, reason: "..." }
//
// Secrets (set with `supabase secrets set`):
//   VAPID_PUBLIC_KEY   (the applicationServerKey shipped in mc-push.js)
//   VAPID_PRIVATE_KEY  (raw 32-byte base64url scalar — keep server-side only)
//   VAPID_SUBJECT      (e.g. "mailto:owner@example.com")
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected on deploy)
// ===========================================================================
import webpush from "npm:web-push@3";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")  ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")     ?? "mailto:noreply@example.com";
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return json({ sent: false, reason: "unauthorized" }, 401);

  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json({ sent: false, reason: "invalid_token" }, 401);

  let title = "MC Training", body = "You have a new milestone!";
  try {
    const payload = await req.json();
    if (payload.title) title = String(payload.title).slice(0, 100);
    if (payload.body)  body  = String(payload.body).slice(0, 200);
  } catch (_) { /* use defaults */ }

  // Look up the user's push subscription
  const { data: rows } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .limit(1);

  if (!rows || rows.length === 0) {
    return json({ sent: false, reason: "no_subscription" });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ sent: false, reason: "vapid_not_configured" }, 503);
  }

  const sub = rows[0];
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title, body, icon: "./icon.svg", badge: "./icon.svg" })
    );
    return json({ sent: true });
  } catch (err: any) {
    // 410 Gone = subscription expired; remove it
    if (err?.statusCode === 410) {
      await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      return json({ sent: false, reason: "subscription_expired" });
    }
    console.error("push error", err?.message);
    return json({ sent: false, reason: "send_failed" }, 502);
  }
});
