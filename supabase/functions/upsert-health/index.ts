// ===========================================================================
// upsert-health — one day's health row for the signed-in user
// ---------------------------------------------------------------------------
// COMMITTED FROM THE LIVE DEPLOYMENT (2026-09-20), not newly written. This
// function has been ACTIVE since 2026-06-28 (version 1, verify_jwt: true) with
// no source in this repository, which is why two separate passes concluded
// daily_health had "no writer anywhere — not in the app, not in an Edge
// Function": a search of pg_proc and a search of the repo both miss a deployed
// function whose code lives only on Supabase. The body below is byte-for-byte
// what is deployed; nothing was cleaned up on the way in, so this file can be
// trusted as the record of what actually runs.
//
//   POST /functions/v1/upsert-health
//   Header: Authorization: Bearer <user JWT>
//   Body:   { date, steps?, resting_heart_rate?, hrv_ms?, sleep_hours?,
//             active_calories? }
//   -> { ok: true, date }
//
// Writes public.daily_health (see supabase/daily-health.sql), upserting on
// (user_id, date).
//
// TWO THINGS TO KNOW BEFORE CHANGING IT.
//
// 1. IT HAS NO CALLER. Nothing in this app or in Mike's Cookbook posts to it —
//    the intended source is an iOS Shortcuts / Apple Health bridge
//    (flagship-immersive-roadmap.md's H3 names that path as needing a
//    platform-support spike before it is scoped). The table and this function
//    are a pipeline waiting on its client, which is a feature, not a residual.
//    mc-vitals.js (H3) writes the manual wellness entry to mc_vitals_v1 in
//    localStorage and does NOT go through here.
//
// 2. IT WRITES WITH THE SERVICE ROLE. The row's user_id comes from a SECOND,
//    anon-key client that calls auth.getUser() on the same bearer token, so a
//    caller cannot write another user's row — the id is never read from the
//    request body. That is sound, but it is broader than the job needs: the
//    same upsert through the anon client would be constrained by
//    daily_health's own RLS instead of bypassing it. Left exactly as deployed
//    rather than narrowed here, because changing a live function is a separate
//    change from committing its source, and a silent edit would make this file
//    stop being the record it exists to be.
// ===========================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }

  // Require date
  if (!body.date) {
    return new Response(JSON.stringify({ error: 'Missing required field: date' }), { status: 400 });
  }

  // Get user from JWT (verify_jwt: true means this is already validated)
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  // Get the calling user
  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await anonClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Upsert the health row for this user+date
  const payload = {
    user_id: user.id,
    date: body.date,
    steps: body.steps ?? null,
    resting_heart_rate: body.resting_heart_rate ?? null,
    hrv_ms: body.hrv_ms ?? null,
    sleep_hours: body.sleep_hours ?? null,
    active_calories: body.active_calories ?? null,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('daily_health')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) {
    console.error('Upsert error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, date: body.date }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
