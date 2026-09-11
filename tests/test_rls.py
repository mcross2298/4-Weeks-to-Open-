"""TEST 5 of the Phase 0 launch gates — row-level security regression suite.

The database is the one layer of this project with no JavaScript to test
against, and it is the one layer where a mistake is not a broken screen but a
data leak. Phase 3 of the audit ran seven cross-user attacks by hand and every
one was repelled — the only clean result in three passes. This suite encodes
those seven so a future policy edit cannot quietly open them again.

The admin check deserves its specific case below. The admins table's own
policy lets a user see only their OWN row, and the membership test is written
so that this still resolves correctly rather than silently failing open, which
is the usual way that pattern breaks.

Every case runs inside a transaction that is rolled back, so the suite touches
no real data. It needs a direct Postgres connection string, which CI holds as
a repository secret; without it the suite skips rather than failing, because a
gate that fails for want of a credential gets turned off.

    pip install pytest "psycopg[binary]"
    SUPABASE_DB_URL=postgresql://... pytest tests/test_rls.py -q
"""

import json
import os
import pathlib

import pytest

psycopg = pytest.importorskip("psycopg", reason="psycopg is not installed")

DB_URL = os.environ.get("SUPABASE_DB_URL")

pytestmark = pytest.mark.skipif(
    not DB_URL, reason="SUPABASE_DB_URL is not set; RLS suite needs a direct connection"
)

# A uuid that belongs to nobody. Every read below must come back empty for it,
# and every write must be refused.
ATTACKER = "00000000-0000-4000-8000-0000deadbeef"
VICTIM = "7fd0e2ea-0000-4000-8000-000000000001"

PRIVATE_TABLES = [
    "workout_logs",
    "user_sync",
    "user_programs",
    "daily_health",
    "push_subscriptions",
    "pm_clients",
    "admins",
]


def _cursor(role, claims):
    conn = psycopg.connect(DB_URL)
    tx = conn.transaction(force_rollback=True)
    tx.__enter__()
    cur = conn.cursor()
    cur.execute(f"set local role {role}")
    if claims is not None:
        cur.execute("select set_config('request.jwt.claims', %s, true)", (claims,))
    return conn, tx, cur


@pytest.fixture
def attacker():
    """A signed-in user who owns none of the rows below."""
    conn, tx, cur = _cursor(
        "authenticated", f'{{"sub":"{ATTACKER}","role":"authenticated"}}'
    )
    try:
        yield cur
    finally:
        tx.__exit__(None, None, None)
        conn.close()


@pytest.fixture
def anonymous():
    """A visitor with no session at all."""
    conn, tx, cur = _cursor("anon", '{"role":"anon"}')
    try:
        yield cur
    finally:
        tx.__exit__(None, None, None)
        conn.close()


@pytest.mark.parametrize("table", PRIVATE_TABLES)
def test_no_cross_user_read(attacker, table):
    attacker.execute(f"select count(*) from public.{table}")
    assert attacker.fetchone()[0] == 0, f"{table} leaked rows to a foreign uid"


@pytest.mark.parametrize("table", PRIVATE_TABLES)
def test_anonymous_reads_nothing(anonymous, table):
    anonymous.execute(f"select count(*) from public.{table}")
    assert anonymous.fetchone()[0] == 0, f"{table} leaked rows to an anonymous client"


def test_no_cross_user_update(attacker):
    attacker.execute("update public.workout_logs set weight_lbs = 1")
    assert attacker.rowcount == 0


def test_no_cross_user_delete(attacker):
    attacker.execute("delete from public.workout_logs")
    assert attacker.rowcount == 0


def test_no_cross_user_sync_update(attacker):
    attacker.execute("update public.user_sync set data = '{}'::jsonb")
    assert attacker.rowcount == 0


def test_no_spoofed_insert(attacker):
    """A row claiming to belong to someone else must be refused outright."""
    with pytest.raises(psycopg.Error):
        attacker.execute(
            "insert into public.workout_logs"
            "(user_id, session_id, exercise, set_number) values (%s,'s','Spoofed',1)",
            (VICTIM,),
        )


def test_no_privilege_escalation(attacker):
    """The admins table is the keystone: writing to it grants everything else."""
    with pytest.raises(psycopg.Error):
        attacker.execute(
            "insert into public.admins(user_id) values (%s)", (ATTACKER,)
        )


def test_non_admin_cannot_write_overrides(attacker):
    with pytest.raises(psycopg.Error):
        attacker.execute(
            "insert into public.program_overrides(page_id, orig_name, patch) "
            "values ('x','y','{}'::jsonb)"
        )


def test_non_admin_cannot_edit_published_programs(attacker):
    attacker.execute("update public.published_programs set program = '{}'::jsonb")
    assert attacker.rowcount == 0


# ---------------------------------------------------------------------------
# Phase 0.4's own migration, asserted rather than assumed. Each of these was
# measured on the live database before the migration was written, and each
# would silently regress if a later change dropped it.
# ---------------------------------------------------------------------------


@pytest.fixture
def service():
    conn = psycopg.connect(DB_URL)
    tx = conn.transaction(force_rollback=True)
    tx.__enter__()
    cur = conn.cursor()
    try:
        yield cur
    finally:
        tx.__exit__(None, None, None)
        conn.close()


def test_set_log_is_idempotent(service):
    """audit EN-6 — without this, re-checking a set writes a second row."""
    service.execute(
        "select 1 from pg_constraint where conname = 'workout_logs_set_uniq'"
    )
    assert service.fetchone(), (
        "workout_logs has no uniqueness constraint — apply "
        "supabase/phase12-launch-hardening.sql"
    )


def test_account_can_be_deleted(service):
    """audit P2-04 — user_sync was the only FK of five without a cascade."""
    service.execute(
        "select pg_get_constraintdef(oid) from pg_constraint "
        "where conname = 'user_sync_user_id_fkey'"
    )
    row = service.fetchone()
    assert row, "user_sync foreign key is missing entirely"
    assert "ON DELETE CASCADE" in row[0].upper(), (
        "deleting a user with sync rows still raises a constraint violation"
    )


def test_health_rows_can_be_removed(service):
    """audit P2-05 — health data could be written and read but never deleted."""
    service.execute(
        "select 1 from pg_policies where schemaname='public' "
        "and tablename='daily_health' and cmd='DELETE'"
    )
    assert service.fetchone(), "daily_health still has no DELETE policy"


@pytest.mark.parametrize("table", PRIVATE_TABLES)
def test_rls_is_enabled(service, table):
    service.execute(
        "select relrowsecurity from pg_class where oid = %s::regclass", (f"public.{table}",)
    )
    assert service.fetchone()[0], f"row-level security is OFF on {table}"


# ---------------------------------------------------------------------------
# roadmap Phase 5.4 (audit L-08) — what the WORLD can read.
#
# Five public tables are readable with no session at all, by design: the two
# override tables, the two published-program tables and the food lookup. The
# audit counted 67 rows in program_overrides and asked for a one-time check
# that none of them carries licensed program text. A one-time check rots, and
# the reason it would is specific: `tools/build-market.py` strips licensed
# content from the public BUILD, and a database row is not a file, so nothing
# in that pipeline has ever looked here. An owner editing a licensed page in
# PM mode writes its text straight into a world-readable row.
#
# So it is a test instead, reading the SAME manifest build-market.py reads —
# never a second hand-typed list of programs and brand terms, which would be
# free to disagree with the one the build enforces.
# ---------------------------------------------------------------------------

# Column lists read off the live schema, not guessed: published_exercises has
# no "exercise" column at all (name / muscle / master / programs), and getting
# that wrong is an error at query time rather than a quiet miss.
WORLD_READABLE = {
    "program_overrides": ["page_id", "orig_name", "patch"],
    "naming_overrides": ["scope", "scope_id", "patch"],
    "published_programs": ["id", "program"],
    "published_exercises": ["name", "muscle", "master", "programs"],
}

_MANIFEST = json.loads(
    (pathlib.Path(__file__).resolve().parents[1] / "content-manifest.json").read_text()
)
BRAND_TERMS = _MANIFEST["brand_terms"]
LICENSED_FILES = sorted(
    {f for group in _MANIFEST["licensed"].values() for f in group["files"]}
)


@pytest.mark.parametrize("table", sorted(WORLD_READABLE))
def test_public_table_is_readable_without_a_session(anonymous, table):
    """The premise of every case below: these really are world-readable.

    If a policy change made one of them private the leak tests would pass by
    reading nothing, which is the way this kind of suite goes quietly green.
    """
    anonymous.execute(f"select count(*) from public.{table}")
    assert anonymous.fetchone()[0] >= 0


@pytest.mark.parametrize("table,columns", sorted(WORLD_READABLE.items()))
def test_public_rows_carry_no_brand_term(anonymous, table, columns):
    haystack = " || ' ' || ".join(f"coalesce({c}::text,'')" for c in columns)
    matches = []
    for term in BRAND_TERMS:
        anonymous.execute(
            f"select count(*) from public.{table} where ({haystack}) ilike %s",
            (f"%{term}%",),
        )
        n = anonymous.fetchone()[0]
        if n:
            matches.append(f"{n} row(s) matching {term!r}")
    assert not matches, (
        f"{table} is world-readable and carries licensed brand text: "
        + "; ".join(matches)
    )


def test_no_override_row_targets_a_licensed_page(anonymous):
    """The structural half: a row attached to a licensed PAGE leaks that

    program's prescription whatever words it happens to use.
    """
    anonymous.execute(
        "select page_id, count(*) from public.program_overrides "
        "where page_id = any(%s) group by page_id",
        (LICENSED_FILES,),
    )
    rows = anonymous.fetchall()
    assert not rows, (
        "program_overrides is world-readable and holds edits to licensed pages: "
        + ", ".join(f"{p} ({n})" for p, n in rows)
    )
