// ===========================================================================
// pm-lookup-client — resolve a client's email to an existing user id
// (Supabase Edge Function, roadmap 4.5)
// ---------------------------------------------------------------------------
// Client roster in PM Mode assigns a program/macro goals to an "existing
// Supabase identity" — a user who has already signed into the app at least
// once. There is no client-side way to look up another user by email (RLS
// rightly hides auth.users from the anon/authenticated roles), so this
// function does it server-side with the service-role key, and ONLY for a
// caller who is themselves an admin (checked against the same `admins`
// allow-list every other PM write already keys off).
//
//   POST /functions/v1/pm-lookup-client
//   Authorization: Bearer <admin's own access token>
//   Body: { email: "trainee@example.com" }
//   -> { user_id, email } | { error: "not_found" } (404)
//
// Secrets (set with `supabase secrets set`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected on deploy)
// ===========================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_PAGES = 20; // 20 * 1000 = 20k users — generous ceiling for an invite-only app

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const sb = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return json({ error: "Invalid token" }, 401);

  // Admin check — the same allow-list every PM write RLS policy already uses.
  const { data: adminRow } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return json({ error: "Forbidden" }, 403);

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email) return json({ error: "Email required" }, 400);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return json({ error: "Lookup failed" }, 502);
    const match = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return json({ user_id: match.id, email: match.email });
    if (!data?.users || data.users.length < 1000) break; // last page
  }

  return json({ error: "not_found" }, 404);
});
