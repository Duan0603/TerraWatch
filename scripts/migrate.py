#!/usr/bin/env python3
"""
TerraWatch Database Migration Runner
Unified CLI migration tool (similar to 'npx prisma migrate' or 'npm run typeorm migration:run')
Can run via local Python/psycopg2 or via Docker container execution.
"""

import os
import sys
import glob
import subprocess
from datetime import datetime

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "database", "migrations")
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "postgrespassword")
DB_NAME = os.getenv("POSTGRES_DB", "terrawatch")
DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
CONTAINER_NAME = "terrawatch-postgis"

def run_sql(sql_content: str) -> bool:
    """Execute SQL string either through psql locally or via docker exec"""
    # 1. Try docker exec first if container is running
    try:
        check_docker = subprocess.run(["docker", "ps", "--filter", f"name={CONTAINER_NAME}", "--format", "{{.Names}}"],
                                      capture_output=True, text=True)
        if CONTAINER_NAME in check_docker.stdout:
            proc = subprocess.run(
                ["docker", "exec", "-i", CONTAINER_NAME, "psql", "-U", DB_USER, "-d", DB_NAME],
                input=sql_content,
                text=True,
                capture_output=True
            )
            if proc.returncode == 0:
                return True
            else:
                print(f"[Error via Docker psql]: {proc.stderr}")
                return False
    except FileNotFoundError:
        pass

    # 2. Try psycopg2 if installed
    try:
        import psycopg2
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            host=DB_HOST,
            port=DB_PORT
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql_content)
        conn.close()
        return True
    except ImportError:
        pass
    except Exception as e:
        print(f"[Error via psycopg2]: {e}")
        return False

    # 3. Fallback to local psql
    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = DB_PASS
        proc = subprocess.run(
            ["psql", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME],
            input=sql_content,
            text=True,
            capture_output=True,
            env=env
        )
        if proc.returncode == 0:
            return True
        else:
            print(f"[Error via local psql]: {proc.stderr}")
            return False
    except Exception as e:
        print(f"[Execution failed]: Ensure Docker container '{CONTAINER_NAME}' is running or psql/psycopg2 is installed.\n{e}")
        return False

def ensure_migration_table():
    create_table_sql = """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    return run_sql(create_table_sql)

def get_applied_migrations() -> set:
    try:
        import psycopg2
        conn = psycopg2.connect(dbname=DB_NAME, user=DB_USER, password=DB_PASS, host=DB_HOST, port=DB_PORT)
        with conn.cursor() as cur:
            cur.execute("SELECT version FROM schema_migrations;")
            rows = cur.fetchall()
            return {r[0] for r in rows}
    except Exception:
        # Query via docker
        cmd = ["docker", "exec", "-i", CONTAINER_NAME, "psql", "-U", DB_USER, "-d", DB_NAME, "-t", "-c", "SELECT version FROM schema_migrations;"]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode == 0:
            return {line.strip() for line in proc.stdout.splitlines() if line.strip()}
    return set()

def migrate_up():
    print("🚀 [TerraWatch Migration] Running pending database migrations...")
    ensure_migration_table()
    applied = get_applied_migrations()

    migration_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "V*__*.sql")))
    if not migration_files:
        print(f"No migration files found in {MIGRATIONS_DIR}")
        return

    count = 0
    for filepath in migration_files:
        filename = os.path.basename(filepath)
        version = filename.split("__")[0]
        if version not in applied:
            print(f"  ⚡ Applying: {filename}...")
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            if run_sql(content):
                record_sql = f"INSERT INTO schema_migrations (version, name) VALUES ('{version}', '{filename}');"
                run_sql(record_sql)
                print(f"  ✅ Applied:  {filename}")
                count += 1
            else:
                print(f"  ❌ Failed to apply: {filename}")
                sys.exit(1)
        else:
            print(f"  ✓ Up to date: {filename}")

    print(f"\n🎉 Migration finished! {count} migration(s) applied successfully.")

def migrate_status():
    ensure_migration_table()
    applied = get_applied_migrations()
    migration_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "V*__*.sql")))

    print("\n📊 [Database Migration Status]")
    print(f"{'Version':<10} | {'Status':<12} | {'Migration File'}")
    print("-" * 65)
    for filepath in migration_files:
        filename = os.path.basename(filepath)
        version = filename.split("__")[0]
        status = "APPLIED" if version in applied else "PENDING"
        print(f"{version:<10} | {status:<12} | {filename}")
    print("-" * 65 + "\n")

if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "up"
    if action == "status":
        migrate_status()
    elif action in ("up", "run"):
        migrate_up()
    else:
        print("Usage: python scripts/migrate.py [up|status]")
