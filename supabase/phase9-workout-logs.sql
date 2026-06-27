-- ===========================================================================
-- MC Training — workout_logs table (phase 9)
-- Per-set workout history: durable across device clears, queryable for
-- auto-weight suggestions and fatigue detection.
-- Run once in the Supabase SQL editor.
-- ===========================================================================

create table if not exists workout_logs (
  id           bigint generated always as identity primary key,
  user_id      uuid         not null references auth.users on delete cascade,
  session_id   text         not null,  -- client-generated per page load
  exercise     text         not null,
  muscle       text,                   -- auto-classified from exercise name
  set_number   int          not null,
  weight_lbs   numeric,
  reps         int,
  rpe          text,
  logged_at    timestamptz  not null default now(),
  workout_name text,                   -- page title / split name
  program_id   text                    -- active program id at log time
);

alter table workout_logs enable row level security;

drop policy if exists "user_rls" on workout_logs;
create policy "user_rls" on workout_logs
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fast per-exercise weight lookups (auto-weight suggestion)
create index if not exists workout_logs_exercise_idx
  on workout_logs (user_id, exercise, logged_at desc);

-- Fast per-muscle rolling counts (fatigue flag)
create index if not exists workout_logs_muscle_idx
  on workout_logs (user_id, muscle, logged_at desc);
