#!/usr/bin/env bash
set -euo pipefail
umask 077

# Also works under cron, which does not load interactive shell profiles.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$ROOT/backups"

# One file: manual backup, scheduled execution, and cron installation.
case "${1:-}" in
    --install-cron)
        python3 - "$ROOT" <<'PY_CRON'
import sys
import shlex
import subprocess

root = sys.argv[1]
begin = "# BEGIN transcendence automatic backup"
end = "# END transcendence automatic backup"
current = subprocess.run(["crontab", "-l"], capture_output=True, text=True)
if current.returncode != 0 and "no crontab for" not in current.stderr:
    raise SystemExit(current.stderr)
lines = []
inside = False
for line in current.stdout.splitlines():
    if line == begin:
        if inside:
            raise SystemExit("Malformed backup cron block; inspect crontab manually.")
        inside = True
    elif line == end:
        if not inside:
            raise SystemExit("Malformed backup cron block; inspect crontab manually.")
        inside = False
    elif not inside:
        lines.append(line)
if inside:
    raise SystemExit("Unterminated backup cron block; inspect crontab manually.")
command = "/bin/bash " + shlex.quote(root + "/scripts/backup.sh")
command += " --scheduled"
command += " >> " + shlex.quote(root + "/backups/cron-bootstrap.log") + " 2>&1"
# cron treats percent signs specially even inside shell quotes.
command = command.replace("%", r"\%")
lines.extend([begin, "# Daily at 03:00 in the cron daemon's system timezone.", "0 3 * * * " + command, end])
subprocess.run(["crontab", "-"], input="\n".join(lines) + "\n", text=True, check=True)
print("Installed daily backup at 03:00 in the system timezone; other jobs preserved.")
PY_CRON
        exit 0
        ;;
    --scheduled)
        log="$ROOT/backups/scheduled-backup.log"
        if [[ -f "$log" ]] && [[ $(stat -c %s "$log") -gt 1048576 ]]; then
            mv -f "$log" "$log.1"
        fi
        exec >> "$log" 2>&1
        echo "[$(date -Is)] Scheduled backup starting"
        result=0
        bash "$ROOT/scripts/backup.sh" || result=$?
        case "$result" in
            0) echo "[$(date -Is)] SUCCESS: backup completed" ;;
            75) echo "[$(date -Is)] SKIPPED: another backup is running"; exit 0 ;;
            *) echo "[$(date -Is)] FAILED: backup exited with status $result"; exit "$result" ;;
        esac
        exit 0
        ;;
    "") ;;
    *) echo "Usage: $0 [--scheduled | --install-cron]" >&2; exit 1 ;;
esac

COMPOSE=(docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.prod.yml")

mkdir -p "$ROOT/backups"
exec 9> "$ROOT/backups/.backup.lock"
if ! flock -n 9; then
    echo "Another backup is already running; skipping this run." >&2
    exit 75
fi

backend_id=$("${COMPOSE[@]}" ps -q backend)
if [[ -z "$backend_id" ]]; then
    echo "Start the production backend before taking a backup." >&2
    exit 1
fi

backup_dir=$(mktemp -d "$ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
docker inspect --format '{{.Image}}' "$backend_id" > "$backup_dir/backend-image.txt"
docker inspect --format '{{.Image}}' "$("${COMPOSE[@]}" ps -q mysql)" > "$backup_dir/mysql-image.txt"

# Pause application writes so the database and uploaded files form one snapshot.
# Always restart the backend, even if a backup command fails.
resume_backend() {
    result=$?
    trap - EXIT
    if ! "${COMPOSE[@]}" start backend; then
        echo "Backend restart failed; run docker compose -f docker-compose.prod.yml start backend." >&2
        result=1
    fi
    exit "$result"
}
trap resume_backend EXIT
"${COMPOSE[@]}" stop backend

"${COMPOSE[@]}" exec -T mysql sh -c '
    export MYSQL_PWD="$MYSQL_PASSWORD"
    exec mysqldump --user="$MYSQL_USER" --single-transaction \
        --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"
' | gzip > "$backup_dir/database.sql.gz"

"${COMPOSE[@]}" run --rm --no-deps -T --entrypoint tar backend \
    -czf - -C /app/storage . > "$backup_dir/files.tar.gz"

gzip -t "$backup_dir/database.sql.gz"
tar -tzf "$backup_dir/files.tar.gz" > /dev/null
(
    cd "$backup_dir"
    sha256sum database.sql.gz files.tar.gz backend-image.txt mysql-image.txt > SHA256SUMS
)

# Keep only the seven newest completed backups whose checksums are valid.
python3 - "$ROOT/backups" <<'PY_RETENTION'
import sys
import hashlib
import re
import shutil
from pathlib import Path


def valid_backup(directory):
    names = {"database.sql.gz", "files.tar.gz", "backend-image.txt", "mysql-image.txt"}
    try:
        files = [directory / name for name in names | {"SHA256SUMS"}]
        if any(path.is_symlink() or not path.is_file() for path in files):
            return False
        recorded = {}
        for line in (directory / "SHA256SUMS").read_text().splitlines():
            digest, name = line.split("  ", 1)
            if name not in names or name in recorded or not re.fullmatch(r"[0-9a-f]{64}", digest):
                return False
            recorded[name] = digest
        if set(recorded) != names:
            return False
        for name, expected in recorded.items():
            checksum = hashlib.sha256()
            with (directory / name).open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    checksum.update(chunk)
            if checksum.hexdigest() != expected:
                return False
        return True
    except (OSError, ValueError, UnicodeError):
        return False


def prune(root, keep):
    complete = []
    for directory in root.iterdir():
        if directory.is_symlink() or not directory.is_dir():
            continue
        if not re.fullmatch(r"\d{8}T\d{6}Z-[A-Za-z0-9]{6}", directory.name):
            continue
        if valid_backup(directory):
            complete.append(directory)
        else:
            print(f"Retention skipped incomplete or invalid backup: {directory.name}")
    complete.sort(key=lambda path: path.name, reverse=True)
    for directory in complete[keep:]:
        shutil.rmtree(directory)
        print(f"Retention removed old completed backup: {directory.name}")
    print(f"Retention: kept {min(len(complete), keep)} completed backups (limit {keep}).")


prune(Path(sys.argv[1]).resolve(strict=True), 7)
PY_RETENTION

echo "Backup complete: $backup_dir"
echo "Keep a separate copy outside this machine; local volumes and backups alone are not disaster recovery."
