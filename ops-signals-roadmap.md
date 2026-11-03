# Ops signals — a shared event layer, training first (`O1`–`O3`)

Opened 2026-11-02 for owner initiative #421. Each phase is one builder run with
a check-in before the next, per CLAUDE.md's multi-phase rule.

## Objective

Let cross-app loops react to what just happened, not only to a weekly schedule.
For example, a missed training week re-planning meals and the grocery forecast.

## Scope

Training is the only producer this can build against today. As of 2026-11-01,
`workout_logs` holds 120 rows, `daily_health` is empty, and Mike's Cookbook is
not in production.

Out of scope: finance data, notifications, Plaid, and any change to push or the
weekly check-in. Where cross-app signals finally live is an open owner question,
and phase 1 does not depend on it.

## Phases

### `O1` — schema and first producer (this PR)

- `supabase/phase18-ops-signals.sql`: `ops_events`, `ops_state`,
  `metric_baselines`, and an insert trigger on `workout_logs` writing one
  `workout.logged` event, idempotent on the log's id.
- Admin read only, no client writes, on all three tables.
- `tools/test-ops-signals.js` runs the real file in PGlite. `tests/test_rls.py`
  gains cases for the deployed tables.

Departures from the issue, each for a stated reason:

- **Phase 18, not 16.** 16 and 17 are taken.
- **`ops_events.user_id` added,** with an account-deletion cascade. Inside a
  payload it would survive the account, and phase 13 made deletion complete.
- **"Owner-only" is read as admin read.** `ops_events` and `ops_state` hold
  nothing an athlete's own screen needs, and `public.admins` is the owner test
  `client_errors` already uses.
- **Payload is ids and set position only.** No weight, reps or exercise name.

### `O2` — baselines and the first rule

A nightly Edge Function, scheduled by pg_cron, refreshes `metric_baselines`,
starting with planned-vs-logged sessions per week. A rule emits
`training.sessions_missed` on the second consecutive missed planned session.
Rules write events only.

### `O3` — training state and the Cookbook producer

`training.phase` and `training.week_load` into `ops_state`. Cookbook producers
once it is in production.

## Done when (`O1`)

After the owner applies the migration:

- every new `workout_logs` insert produces exactly one `workout.logged` event
  within 1 minute;
- replays produce no duplicates;
- `tests/test_rls.py` passes, including the new cases.

## Known limits

- An untick deletes the row, so a re-tick is a new row with a new id and so a
  second event for that set. `O2` counts sessions, so this does not reach its
  rule, but anything counting events as sets would need to allow for it.
- Rows inserted before the migration produce no events. There is no backfill.
- If the trigger's write fails, the set is kept and that event is lost.
