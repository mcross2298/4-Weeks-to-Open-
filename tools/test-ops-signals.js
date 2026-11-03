#!/usr/bin/env node
'use strict';
/* ==========================================================================
   test-ops-signals.js — supabase/phase18-ops-signals.sql, executed (#421).

   tests/test_rls.py needs a connection to the live database and skips until
   the owner applies the migration, so on its own it would prove nothing about
   a file before it runs on production. This runs the REAL file in PGlite, a
   real Postgres, against a stand-in of the Supabase objects it depends on, so
   RLS, grants and the trigger are all exercised with no credential.

   Needs @electric-sql/pglite on NODE_PATH (verify.yml installs a pinned copy
   into a scratch prefix). It FAILS rather than skips without it: a gate that
   skips for want of a package gets forgotten.

   The stand-in copies workout_logs from phase 9 + phase 12's constraint.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

let PGlite;
try { ({ PGlite } = require('@electric-sql/pglite')); }
catch (e) { console.error('test-ops-signals: @electric-sql/pglite is not installed'); process.exit(1); }

const SQL_FILE = path.resolve(__dirname, '../supabase/phase18-ops-signals.sql');
if (!fs.existsSync(SQL_FILE)) { console.error('test-ops-signals: phase18-ops-signals.sql is missing'); process.exit(1); }
const SQL = fs.readFileSync(SQL_FILE, 'utf8');
const ATHLETE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';

const STANDIN = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth, public to anon, authenticated, service_role;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant select on auth.users to authenticated, anon;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  insert into auth.users values ('${ATHLETE}'), ('${OTHER}'), ('${ADMIN}');
  create table public.admins (user_id uuid primary key references auth.users(id));
  alter table public.admins enable row level security;
  create policy admins_self on public.admins for select using (user_id = auth.uid());
  grant select on public.admins to authenticated;
  insert into public.admins values ('${ADMIN}');
  create table public.workout_logs (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users on delete cascade,
    session_id text not null, exercise text not null, muscle text,
    set_number int not null, weight_lbs numeric, reps int, rpe text,
    logged_at timestamptz not null default now(), workout_name text, program_id text,
    constraint workout_logs_set_uniq unique (user_id, session_id, exercise, set_number)
  );
  alter table public.workout_logs enable row level security;
  create policy user_rls on public.workout_logs for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
  grant all on public.workout_logs to authenticated;
`;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) pass++; else { fail++; console.error('  ✗ ' + name); } }

(async () => {
  const db = new PGlite();
  await db.exec(STANDIN);
  await db.exec(SQL);
  await db.exec(SQL);   // the header promises a re-run is safe
  ok('the file applies twice without error', true);

  async function as(role, uid, fn) {
    await db.exec(`begin; set local role ${role}; select set_config('request.uid', '${uid || ''}', true);`);
    try { return await fn(); } finally { await db.exec('rollback'); }
  }
  async function refused(role, uid, sql) {
    let threw = false, rows = 0;
    try { await as(role, uid, async () => { rows = (await db.query(sql)).affectedRows || 0; }); }
    catch (e) { threw = true; }
    return threw || rows === 0;
  }
  const logSet = (uid, n, extra) => `insert into public.workout_logs (user_id, session_id, exercise, set_number, weight_lbs, reps)
    values ('${uid}', 's1', 'Bench Press', ${n}, 135, 8) ${extra || ''}`;
  const count = async (w) => (await db.query(`select count(*)::int n from public.ops_events ${w || ''}`)).rows[0].n;

  // ---- the producer ----
  await db.exec(`begin; set local role authenticated; select set_config('request.uid', '${ATHLETE}', true);`);
  await db.exec(logSet(ATHLETE, 1));
  await db.exec(`commit;`);
  ok('an athlete with no write grant on ops_events still produces an event', (await count()) === 1);
  const ev = (await db.query('select * from public.ops_events')).rows[0];
  ok('type is workout.logged', ev.type === 'workout.logged');
  ok('source_app is training', ev.source_app === 'training');
  ok('status starts new', ev.status === 'new');
  ok('correlation_id is the session', ev.correlation_id === 's1');
  ok('user_id is the athlete', ev.user_id === ATHLETE);
  ok('idempotency_key is the log id', /^workout_logs:\d+$/.test(ev.idempotency_key));
  ok('the payload carries no load, reps or exercise name',
    Object.keys(ev.payload).sort().join() === 'log_id,program_id,session_id,set_number');

  await db.exec(logSet(ATHLETE, 1, `on conflict on constraint workout_logs_set_uniq do update set reps = 9`));
  ok('re-checking a set through the upsert makes no second event', (await count()) === 1);

  await db.exec(`insert into public.ops_events (source_app, type, idempotency_key) values ('training', 'workout.logged', 'dup')
                 on conflict (idempotency_key) do nothing;
                 insert into public.ops_events (source_app, type, idempotency_key) values ('training', 'workout.logged', 'dup')
                 on conflict (idempotency_key) do nothing;`);
  ok('a replayed idempotency_key is one row', (await count(`where idempotency_key = 'dup'`)) === 1);
  await db.exec(`delete from public.ops_events where idempotency_key = 'dup'`);

  await db.exec(logSet(ATHLETE, 2)); await db.exec(logSet(ATHLETE, 3));
  ok('every new set is exactly one event', (await count()) === 3);

  // ---- the producer can never cost a set ----
  await db.exec(`alter table public.ops_events add constraint force_fail check (false) not valid`);
  let lost = false;
  try { await db.exec(logSet(ATHLETE, 4)); } catch (e) { lost = true; }
  ok('a failure inside the producer does not fail the workout_logs insert', !lost);
  ok('...and the set is saved', (await db.query(`select 1 from public.workout_logs where set_number = 4`)).rows.length === 1);
  await db.exec(`alter table public.ops_events drop constraint force_fail`);

  // ---- ops_state ----
  await db.exec(`insert into public.ops_state (key, owner_app) values ('training.phase', 'training')`);
  await db.exec(`update public.ops_state set value = '{"a":1}' where key = 'training.phase'`);
  const st = (await db.query(`select * from public.ops_state`)).rows[0];
  ok('an update moves version', Number(st.version) === 2);
  let stolen = false;
  try { await db.exec(`update public.ops_state set owner_app = 'cookbook' where key = 'training.phase'`); } catch (e) { stolen = true; }
  ok('a key cannot change owning app', stolen);

  await db.exec(`insert into public.metric_baselines (user_id, metric, window_days, center, spread, n)
                 values ('${ATHLETE}', 'sessions_per_week', 28, 4, 1, 4)`);

  // ---- cross-user attacks ----
  for (const t of ['ops_events', 'ops_state', 'metric_baselines']) {
    for (const [who, role, uid] of [['another athlete', 'authenticated', OTHER], ['the row\'s own athlete', 'authenticated', ATHLETE]]) {
      const n = await as(role, uid, async () => (await db.query(`select count(*)::int n from public.${t}`)).rows[0].n);
      ok(`${who} reads nothing from ${t}`, n === 0);
    }
    let anonDenied = false;
    try { await as('anon', '', () => db.query(`select count(*) from public.${t}`)); } catch (e) { anonDenied = true; }
    ok(`anon has no access to ${t}`, anonDenied);
    const n = await as('authenticated', ADMIN, async () => (await db.query(`select count(*)::int n from public.${t}`)).rows[0].n);
    ok(`an admin reads ${t}`, n > 0);
    ok(`no client may delete from ${t}`, await refused('authenticated', ADMIN, `delete from public.${t}`));
  }
  ok('no client may forge an event', await refused('authenticated', ATHLETE,
    `insert into public.ops_events (source_app, type, idempotency_key) values ('training', 'workout.logged', 'x')`));
  ok('not even an admin may mark an event handled from a client', await refused('authenticated', ADMIN,
    `update public.ops_events set status = 'handled'`));
  ok('no client may write ops_state', await refused('authenticated', ADMIN,
    `insert into public.ops_state (key, owner_app) values ('k', 'training')`));
  ok('no client may write a baseline', await refused('authenticated', ATHLETE,
    `update public.metric_baselines set center = 0`));
  // Not "does calling it throw": a trigger function always refuses a direct
  // call, grant or no grant, so that assertion could not fail.
  for (const role of ['anon', 'authenticated']) {
    const r = await db.query(`select has_function_privilege('${role}', 'public.ops_workout_logged()', 'execute') p`);
    ok(`${role} holds no EXECUTE on the producer`, r.rows[0].p === false);
  }

  // ---- account deletion stays complete (phase 13) ----
  await db.exec(`delete from auth.users where id = '${ATHLETE}'`);
  ok('deleting the account removes its events', (await count(`where user_id = '${ATHLETE}'`)) === 0);
  ok('deleting the account removes its baselines',
    (await db.query(`select count(*)::int n from public.metric_baselines`)).rows[0].n === 0);

  console.log(fail ? `\ntest-ops-signals: ${fail} FAILED of ${pass + fail}` : `test-ops-signals: all ${pass} assertions passed`);
  await db.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('test-ops-signals: ' + (e.stack || e)); process.exit(1); });
