"""scripts/migrate.py: migration discovery/ordering, run_sql fallbacks, CLI dispatch.
subprocess and psycopg2 are faked; nothing touches Docker, psql or a database."""
import importlib.util
import runpy
import subprocess
import sys
import types
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "migrate.py"
spec = importlib.util.spec_from_file_location("migrate_script", SCRIPT)
mig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mig)


def cp(returncode=0, stdout="", stderr=""):
    return subprocess.CompletedProcess([], returncode, stdout, stderr)


class FakeConn:
    def __init__(self, fail=None, rows=()):
        self.fail, self.rows, self.executed, self.autocommit, self.closed = fail, list(rows), [], False, False

    def cursor(self):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def execute(self, sql):
        self.executed.append(sql)

    def fetchall(self):
        return [(r,) for r in self.rows]

    def close(self):
        self.closed = True


def fake_psycopg2(monkeypatch, conn=None, connect_exc=None):
    m = types.ModuleType("psycopg2")
    kwargs = []

    def connect(**kw):
        kwargs.append(kw)
        if connect_exc:
            raise connect_exc
        return conn
    m.connect = connect
    monkeypatch.setitem(sys.modules, "psycopg2", m)
    return kwargs


def no_psycopg2(monkeypatch):
    monkeypatch.setitem(sys.modules, "psycopg2", None)  # import raises ImportError


# ---------------------------------------------------------------- constants
def test_migrations_dir_points_at_repo_database_migrations():
    assert Path(mig.MIGRATIONS_DIR) == SCRIPT.parents[1] / "database" / "migrations"
    assert Path(mig.MIGRATIONS_DIR).is_dir()


# ---------------------------------------------------------------- run_sql
def test_run_sql_prefers_running_docker_container(monkeypatch):
    calls = []

    def run(cmd, **kw):
        calls.append((cmd, kw))
        return cp(stdout=mig.CONTAINER_NAME + "\n") if cmd[1] == "ps" else cp(0)
    monkeypatch.setattr(mig.subprocess, "run", run)
    assert mig.run_sql("SELECT 1;") is True
    assert calls[1][0][:5] == ["docker", "exec", "-i", mig.CONTAINER_NAME, "psql"]
    assert calls[1][1]["input"] == "SELECT 1;"


def test_run_sql_docker_failure_returns_false_and_reports(monkeypatch, capsys):
    monkeypatch.setattr(mig.subprocess, "run",
                        lambda cmd, **kw: cp(stdout=mig.CONTAINER_NAME) if cmd[1] == "ps" else cp(1, stderr="boom"))
    assert mig.run_sql("x") is False
    assert "boom" in capsys.readouterr().out


def test_run_sql_uses_psycopg2_when_docker_missing(monkeypatch):
    def run(cmd, **kw):
        raise FileNotFoundError("docker")
    monkeypatch.setattr(mig.subprocess, "run", run)
    conn = FakeConn()
    kwargs = fake_psycopg2(monkeypatch, conn)
    assert mig.run_sql("SELECT 1;") is True
    assert conn.executed == ["SELECT 1;"] and conn.autocommit is True and conn.closed is True
    assert kwargs[0]["dbname"] == mig.DB_NAME and kwargs[0]["host"] == mig.DB_HOST


def test_run_sql_psycopg2_error_returns_false_without_psql_fallback(monkeypatch, capsys):
    monkeypatch.setattr(mig.subprocess, "run", lambda cmd, **kw: cp(stdout=""))
    fake_psycopg2(monkeypatch, connect_exc=RuntimeError("no db"))
    assert mig.run_sql("x") is False
    assert "no db" in capsys.readouterr().out


def test_run_sql_falls_back_to_local_psql_with_password_in_env(monkeypatch):
    calls = []

    def run(cmd, **kw):
        calls.append((cmd, kw))
        return cp(stdout="") if cmd[0] == "docker" else cp(0)
    monkeypatch.setattr(mig.subprocess, "run", run)
    monkeypatch.setattr(mig, "DB_PASS", "unique-test-pass")  # CI exports POSTGRES_PASSWORD=postgres, same as the user
    no_psycopg2(monkeypatch)
    assert mig.run_sql("SELECT 1;") is True
    cmd, kw = calls[-1]
    assert cmd[0] == "psql" and "-h" in cmd and kw["env"]["PGPASSWORD"] == mig.DB_PASS
    assert mig.DB_PASS not in cmd  # password never on the command line


def test_run_sql_local_psql_failure_false(monkeypatch, capsys):
    monkeypatch.setattr(mig.subprocess, "run", lambda cmd, **kw: cp(stdout="") if cmd[0] == "docker" else cp(2, stderr="bad"))
    no_psycopg2(monkeypatch)
    assert mig.run_sql("x") is False and "bad" in capsys.readouterr().out


def test_run_sql_psql_not_installed_false(monkeypatch):
    def run(cmd, **kw):
        if cmd[0] == "docker":
            return cp(stdout="")
        raise FileNotFoundError("psql")
    monkeypatch.setattr(mig.subprocess, "run", run)
    no_psycopg2(monkeypatch)
    assert mig.run_sql("x") is False


# ---------------------------------------------------------------- applied migrations
def test_get_applied_migrations_reads_versions_via_psycopg2(monkeypatch):
    fake_psycopg2(monkeypatch, FakeConn(rows=["V1", "V2"]))
    assert mig.get_applied_migrations() == {"V1", "V2"}


def test_get_applied_migrations_falls_back_to_docker_output(monkeypatch):
    fake_psycopg2(monkeypatch, connect_exc=RuntimeError("x"))
    monkeypatch.setattr(mig.subprocess, "run", lambda cmd, **kw: cp(stdout=" V1\n\n V3 \n"))
    assert mig.get_applied_migrations() == {"V1", "V3"}


def test_get_applied_migrations_empty_when_everything_fails(monkeypatch):
    fake_psycopg2(monkeypatch, connect_exc=RuntimeError("x"))
    monkeypatch.setattr(mig.subprocess, "run", lambda cmd, **kw: cp(1))
    assert mig.get_applied_migrations() == set()


# ---------------------------------------------------------------- migrate_up / status
@pytest.fixture
def mdir(tmp_path, monkeypatch):
    for name in ("V2__b.sql", "V10__c.sql", "V1__a.sql", "notes.txt", "R__repeatable.sql"):
        (tmp_path / name).write_text(f"-- {name}\n", encoding="utf-8")
    monkeypatch.setattr(mig, "MIGRATIONS_DIR", str(tmp_path))
    return tmp_path


def test_migrate_up_applies_only_pending_and_records_each(mdir, monkeypatch, capsys):
    ran = []
    monkeypatch.setattr(mig, "run_sql", lambda sql: ran.append(sql) or True)
    monkeypatch.setattr(mig, "get_applied_migrations", lambda: {"V1"})
    mig.migrate_up()
    applied_files = [s for s in ran if s.startswith("-- V")]
    assert applied_files == ["-- V2__b.sql\n", "-- V10__c.sql\n"]  # numeric order, V1 skipped
    records = [s for s in ran if s.startswith("INSERT")]
    assert records == ["INSERT INTO schema_migrations (version, name) VALUES ('V2', 'V2__b.sql');",
                       "INSERT INTO schema_migrations (version, name) VALUES ('V10', 'V10__c.sql');"]
    out = capsys.readouterr().out
    assert "2 migration(s) applied" in out and "Up to date: V1__a.sql" in out


def test_migrate_up_orders_versions_numerically(mdir, monkeypatch):
    ran = []
    monkeypatch.setattr(mig, "run_sql", lambda sql: ran.append(sql) or True)
    monkeypatch.setattr(mig, "get_applied_migrations", lambda: set())
    mig.migrate_up()
    assert [s for s in ran if s.startswith("-- V")] == ["-- V1__a.sql\n", "-- V2__b.sql\n", "-- V10__c.sql\n"]


def test_migrate_up_stops_with_exit_1_on_failure_and_records_nothing(mdir, monkeypatch):
    ran = []

    def run_sql(sql):
        ran.append(sql)
        return not sql.startswith("-- V2")
    monkeypatch.setattr(mig, "run_sql", run_sql)
    monkeypatch.setattr(mig, "get_applied_migrations", lambda: {"V1"})
    with pytest.raises(SystemExit) as e:
        mig.migrate_up()
    assert e.value.code == 1
    assert not any(s.startswith("INSERT") for s in ran)
    assert not any(s.startswith("-- V10") for s in ran)  # later migrations are not attempted


def test_migrate_up_with_no_files_reports(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(mig, "MIGRATIONS_DIR", str(tmp_path))
    monkeypatch.setattr(mig, "run_sql", lambda sql: True)
    monkeypatch.setattr(mig, "get_applied_migrations", lambda: set())
    mig.migrate_up()
    assert "No migration files found" in capsys.readouterr().out


def test_migrate_status_marks_applied_and_pending(mdir, monkeypatch, capsys):
    monkeypatch.setattr(mig, "run_sql", lambda sql: True)
    monkeypatch.setattr(mig, "get_applied_migrations", lambda: {"V2"})
    mig.migrate_status()
    out = capsys.readouterr().out
    assert "V2         | APPLIED      | V2__b.sql" in out
    assert "V1         | PENDING      | V1__a.sql" in out
    assert "R__repeatable" not in out and "notes.txt" not in out


def test_ensure_migration_table_runs_idempotent_create(monkeypatch):
    ran = []
    monkeypatch.setattr(mig, "run_sql", lambda sql: ran.append(sql) or True)
    assert mig.ensure_migration_table() is True
    assert "CREATE TABLE IF NOT EXISTS public.schema_migrations" in ran[0] and "PRIMARY KEY" in ran[0]


# ---------------------------------------------------------------- CLI dispatch (__main__)
def test_cli_unknown_action_prints_usage_and_touches_nothing(monkeypatch, capsys):
    def forbid(*a, **k):
        raise AssertionError("must not run a subprocess")
    monkeypatch.setattr(subprocess, "run", forbid)
    monkeypatch.setattr(sys, "argv", ["migrate.py", "bogus"])
    runpy.run_path(str(SCRIPT), run_name="__main__")
    assert "Usage: python scripts/migrate.py [up|status]" in capsys.readouterr().out
