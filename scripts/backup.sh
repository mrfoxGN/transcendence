#!/usr/bin/env bash
set -Eeuo pipefail

# On the host, `make backup` asks the running backup container for a one-off copy.
if [[ "${BASH_SOURCE[0]}" != /scripts/backup.sh ]]; then
  root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
  exec docker compose -f "$root/docker-compose.prod.yml" exec -T backup \
    /bin/bash /scripts/backup.sh --once
fi

backup_once() {
  [[ -d /backups && -d /storage ]] || { echo 'Backup mounts missing' >&2; return 1; }
  umask 077
  owner="$(stat -c '%u:%g' /scripts/backup.sh)"
  chown "$owner" /backups
  chmod 700 /backups

  stamp="$(date -u +%Y-%m-%d_%H-%M-%S_UTC)"
  dest="/backups/$stamp"
  [[ ! -e "$dest" ]] || { echo "Backup already exists: $dest" >&2; return 1; }
  temp="$(mktemp -d "/backups/.partial-${stamp}-XXXXXX")"
  trap 'rm -rf -- "$temp"' EXIT

  mysqldump --protocol=TCP -h "$DB_HOST" -u "$DB_USER" \
    --single-transaction --quick --no-tablespaces \
    --routines --triggers --events "$DB_NAME" | gzip -c > "$temp/mysql.sql.gz"
  tar -czf "$temp/storage.tar.gz" -C /storage .
  gzip -t "$temp/mysql.sql.gz"
  tar -tzf "$temp/storage.tar.gz" >/dev/null
  chmod 600 "$temp/mysql.sql.gz" "$temp/storage.tar.gz"
  chown -R "$owner" "$temp"
  mv -T -- "$temp" "$dest"
  printf 'Backup OK: %s\n' "$dest"
}

if [[ "${1:-}" == --once ]]; then
  backup_once
elif [[ $# -eq 0 ]]; then
  while true; do
    if /bin/bash /scripts/backup.sh --once; then
      next="$(date -d 'tomorrow 03:00:00' +%s)"
      delay=$((next - $(date +%s)))
      (( delay > 0 )) || delay=60
      printf 'Next backup: %s\n' "$(date -d "@$next" '+%Y-%m-%d %H:%M:%S %Z')"
      sleep "$delay"
    else
      echo 'Backup failed; retrying in 5 minutes.' >&2
      sleep 300
    fi
  done
else
  echo 'Usage: backup.sh [--once]' >&2
  exit 2
fi
