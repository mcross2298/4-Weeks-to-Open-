// ===========================================================================
// push-notify — Web Push to the calling user's own devices
// ---------------------------------------------------------------------------
// engine-repair-roadmap.md Phase 1.2, audit EN-3.
//
// What was wrong. The client has posted to /functions/v1/push-notify since the
// push layer shipped. Nothing was ever deployed at that slug: the function
// NAMED push-notify sits at the slug `quick-service`, and its body is the
// unmodified Supabase starter template returning `Hello {name}`. Invocation
// routes by slug, so every personal-record notification in the app has been
// hitting a path that does not resolve — silently, because the client helper
// did not check the response status and its callers swallow errors by design.
// push_subscriptions holds zero rows, which is the same story from the other
// end. This file is the real body, deployed at the slug the client calls.
//
//   POST /functions/v1/push-notify
//   Header: Authorization: Bearer <user access token>
//   Body:   { title?: string, body?: string, url?: string }
//   -> { sent: number, failed: number, subscriptions: number }
//
// Sends only to the CALLER's own subscriptions. The user id comes from the
// verified JWT, never from the request body, so this cannot be used to push
// to somebody else's device.
//
// Secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT  (shared with weekly-checkin)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY             (auto-injected on deploy)
//
// A missing VAPID pair returns a NAMED 503 rather than a generic failure —
// the whole point of this phase is that a broken notification path should be
// diagnosable from the response instead of disappearing into a catch block.
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
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

interface Payload { title?: string; body?: string; url?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: "VAPID not configured", detail: "set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY" }, 503);
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

  // Resolve the caller from their own token. verify_jwt already rejects an
  // invalid one; this reads WHO it belongs to.
  const { data: userRes, error: userErr } = await sb.auth.getUser(auth.slice(7));
  const user = userRes?.user;
  if (userErr || !user) return json({ error: "Unauthorized" }, 401);

  let payload: Payload = {};
  try { payload = await req.json(); } catch { /* an empty body is fine */ }

  const { data: subs, error: subsErr } = await sb
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (subsErr) return json({ error: "Could not load subscriptions" }, 500);
  if (!subs || !subs.length) return json({ sent: 0, failed: 0, subscriptions: 0 });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const note = JSON.stringify({
    title: payload.title || "MC Training",
    body: payload.body || "",
    url: payload.url || "./dashboard.html",
    icon: "./icon.svg",
    badge: "./icon.svg",
  });

  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        note,
      );
      sent++;
    } catch (err) {
      // 410/404 mean the browser dropped the subscription. Reaping it here is
      // what keeps push_subscriptions from filling with dead endpoints, the
      // same handling weekly-checkin already does.
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 410 || code === 404) {
        await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } else {
        console.error("push-notify send error", user.id, (err as Error)?.message);
      }
      failed++;
    }
  }

  return json({ sent, failed, subscriptions: subs.length });
});
