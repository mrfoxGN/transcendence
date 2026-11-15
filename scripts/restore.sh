#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE_PATH:-docker-compose.prod.yml}"
[[ "$COMPOSE_FILE" = /* ]] || COMPOSE_FILE="$PROJECT_ROOT/$COMPOSE_FILE"
[[ -f "$COMPOSE_FILE" ]] || { echo "Missing Compose file: $COMPOSE_FILE" >&2; exit 1; }
COMPOSE=(docker compose -f "$COMPOSE_FILE")

CHECK_ONLY=0
if [[ "${1:-}" == "--check" ]]; then CHECK_ONLY=1; shift; fi
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 [--check] backups/YYYY-MM-DD_HH-MM-SS_UTC" >&2
  exit 2
fi
BACKUP_DIR="$(realpath -- "$1")"
[[ "$BACKUP_DIR" == "$PROJECT_ROOT/backups/"* ]] || {
  echo "Backup must be inside $PROJECT_ROOT/backups/" >&2; exit 1;
}
SQL="$BACKUP_DIR/mysql.sql.gz"
STORAGE="$BACKUP_DIR/storage.tar.gz"
[[ -f "$SQL" && -f "$STORAGE" ]] || {
  echo "Missing mysql.sql.gz or storage.tar.gz in $BACKUP_DIR" >&2; exit 1;
}
gzip -t "$SQL"
tar -tzf "$STORAGE" >/dev/null
echo "Backup archives OK: $BACKUP_DIR"
if (( CHECK_ONLY )); then exit 0; fi

BACKEND_ID="$("${COMPOSE[@]}" ps -aq backend)"
[[ -n "$BACKEND_ID" ]] || { echo "Backend container not found" >&2; exit 1; }
STORAGE_VOL="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/storage"}}{{.Name}}{{end}}{{end}}' "$BACKEND_ID")"
[[ -n "$STORAGE_VOL" ]] || { echo "No named volume at /app/storage" >&2; exit 1; }
docker volume inspect "$STORAGE_VOL" >/dev/null

printf 'WARNING: restore overwrites MySQL tables and matching storage files.\n'
printf 'Extra storage files not in the backup are NOT deleted.\n'
printf 'Type RESTORE to proceed: '
read -r CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || { echo 'Cancelled.'; exit 0; }

WAS_RUNNING="$(docker inspect --format '{{.State.Running}}' "$BACKEND_ID")"
if [[ "$WAS_RUNNING" == "true" ]]; then
  "${COMPOSE[@]}" stop backend
fi

# If an import fails, backend stays stopped to avoid serving partial data.
gzip -dc "$SQL" | "${COMPOSE[@]}" exec -T mysql sh -c \
  'MYSQL_PWD="${MYSQL_PASSWORD:?MYSQL_PASSWORD missing}" exec mysql \
   -u"${MYSQL_USER:?MYSQL_USER missing}" "${MYSQL_DATABASE:?MYSQL_DATABASE missing}"'
docker run --rm -i --network none \
  --mount "type=volume,source=${STORAGE_VOL},target=/data" \
  alpine:3.22 tar -xzf - -C /data < "$STORAGE"

if [[ "$WAS_RUNNING" == "true" ]]; then
  "${COMPOSE[@]}" start backend
fi
echo 'Restore OK.'
