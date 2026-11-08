#!/usr/bin/env python3
"""Create/update only the dedicated monitoring account on the running prod MySQL.

Run after starting MySQL, and after restoring to a fresh MySQL volume.
Requires MYSQL_EXPORTER_PASSWORD (64 hex characters) in Compose's environment.
Never prints rendered Compose configuration, passwords, or SQL on errors.
"""
import json
import re
import subprocess
from pathlib import Path


def main():
    root = Path(__file__).resolve().parents[1]
    compose = ["docker", "compose", "-f", str(root / "docker-compose.prod.yml")]
    config = subprocess.run(compose + ["config", "--format", "json"], cwd=root,
                            capture_output=True, text=True)
    if config.returncode:
        raise SystemExit("Compose validation failed. Check required .env settings.")
    password = json.loads(config.stdout)["services"]["mysqld-exporter"]["environment"]["MYSQLD_EXPORTER_PASSWORD"]
    if not re.fullmatch(r"[0-9a-fA-F]{64}", password):
        raise SystemExit("MYSQL_EXPORTER_PASSWORD must contain exactly 64 hexadecimal characters.")

    def sql(statement):
        result = subprocess.run(
            compose + ["exec", "-T", "mysql", "sh", "-c",
                       'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root --batch --skip-column-names'],
            input=statement, cwd=root, capture_output=True, text=True)
        if result.returncode:
            raise SystemExit("MySQL monitoring setup failed; SQL output suppressed to protect credentials.")
        return result.stdout.strip()

    exists = sql("SELECT COUNT(*) FROM mysql.user WHERE User='monitoring_exporter' AND Host='%';")
    if exists != "0":
        grants = sql("SHOW GRANTS FOR 'monitoring_exporter'@'%';").splitlines()
        if not grants or any(not line.startswith("GRANT USAGE ON *.* TO ") for line in grants):
            raise SystemExit("Existing monitoring account has unexpected privileges; review it before setup.")
    sql("CREATE USER IF NOT EXISTS 'monitoring_exporter'@'%' IDENTIFIED BY '" + password + "' WITH MAX_USER_CONNECTIONS 3;\n"
        "ALTER USER 'monitoring_exporter'@'%' IDENTIFIED BY '" + password + "' WITH MAX_USER_CONNECTIONS 3;\n")
    print("Monitoring account ready: USAGE only, maximum 3 connections. No application tables or accounts changed.")


if __name__ == "__main__":
    main()
